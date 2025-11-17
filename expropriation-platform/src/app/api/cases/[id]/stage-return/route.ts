import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { CaseStage } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const stageReturnSchema = z.object({
  toStage: z.nativeEnum(CaseStage),
  reason: z.string().min(10, 'El motivo debe tener al menos 10 caracteres'),
  observations: z.string().min(20, 'Las observaciones deben tener al menos 20 caracteres'),
  requiresApproval: z.boolean().default(true),
  approverId: z.string().optional(),
  attachmentPath: z.string().optional(),
  notifyStakeholders: z.boolean().default(true),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('high')
});

// Get available stages for return
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;

    // Get case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        stageProgressions: {
          include: {
            fromStageConfig: {
              select: {
                stage: true,
                name: true,
                description: true,
                sequenceOrder: true
              }
            },
            toStageConfig: {
              select: {
                stage: true,
                name: true,
                description: true,
                sequenceOrder: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Get user permissions
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check access permissions
    const hasPermission = user.role.name === 'super_admin' ||
                         user.role.name === 'department_admin' ||
                         user.role.name === 'supervisor' ||
                         (user.role.name === 'analyst' && caseData.assignedToId === user.id);

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get all stages
    const allStages = await prisma.stage.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: 'asc' }
    });

    const currentStageIndex = allStages.findIndex(s => s.stage === caseData.currentStage);

    // Get completed stages (can return to any previous stage)
    const completedStages = allStages.slice(0, currentStageIndex);

    // Get recent returns to avoid too many back-and-forth
    const recentReturns = caseData.stageProgressions.filter(
      p => p.progressionType === 'BACKWARD' &&
           p.createdAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
    );

    // Build available stages with metadata
    const availableStages = completedStages.map(stage => {
      const lastVisit = caseData.stageProgressions.find(
        p => p.toStage === stage.stage
      );

      const recentReturnCount = recentReturns.filter(
        p => p.toStage === stage.stage
      ).length;

      return {
        stage: stage.stage,
        name: stage.name,
        description: stage.description,
        sequenceOrder: stage.sequenceOrder,
        responsibleDepartment: stage.responsibleDepartment,
        lastVisitDate: lastVisit?.createdAt,
        visitCount: caseData.stageProgressions.filter(
          p => p.toStage === stage.stage
        ).length,
        recentReturnCount,
        isRecommended: stage.sequenceOrder >= currentStageIndex - 2, // Recommend nearby stages
        warning: recentReturnCount > 1 ? 'Este caso ha sido devuelto a esta etapa recientemente' : undefined
      };
    });

    return NextResponse.json({
      currentStage: caseData.currentStage,
      availableStages,
      recentReturns: recentReturns.map(r => ({
        toStage: r.toStage,
        toStageName: r.toStageConfig?.name,
        reason: r.reason,
        observations: r.observations,
        createdAt: r.createdAt,
        createdBy: r.approvedBy
      }))
    });

  } catch (error) {
    logger.error('Error fetching return options:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Process stage return
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: caseId } = await params;
    const body = await request.json();

    // Validate request body
    const validatedData = stageReturnSchema.parse(body);

    // Get case data and user
    const [caseData, user] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        include: {
          stageAssignments: {
            where: { isActive: true },
            include: {
              checklistCompletions: {
                include: {
                  checklist: true
                }
              }
            }
          }
        }
      }),
      prisma.user.findUnique({
        where: { email: session.user?.email as string },
        include: { role: true, department: true }
      })
    ]);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    const hasPermission = user.role.name === 'super_admin' ||
                         user.role.name === 'department_admin' ||
                         user.role.name === 'supervisor' ||
                         (user.role.name === 'analyst' && caseData.assignedToId === user.id);

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Validate target stage
    const allStages = await prisma.stage.findMany({
      where: { isActive: true },
      orderBy: { sequenceOrder: 'asc' }
    });

    const currentStageConfig = allStages.find(s => s.stage === caseData.currentStage);
    const targetStageConfig = allStages.find(s => s.stage === validatedData.toStage);

    if (!targetStageConfig) {
      return NextResponse.json({ error: 'Target stage not found' }, { status: 404 });
    }

    if (!currentStageConfig) {
      return NextResponse.json({ error: 'Current stage not found' }, { status: 404 });
    }

    // Can only return to previous stages
    if (targetStageConfig.sequenceOrder >= currentStageConfig.sequenceOrder) {
      return NextResponse.json({
        error: 'Invalid return',
        message: 'Solo se puede devolver a etapas anteriores'
      }, { status: 400 });
    }

    // Check if approval is required
    let approvedAt = new Date();
    let approverId = user.id;

    if (validatedData.requiresApproval && user.role.name !== 'super_admin') {
      // For now, auto-approve for department_admin and supervisor
      if (user.role.name === 'department_admin' || user.role.name === 'supervisor') {
        // Already approved
      } else {
        // Would need approval workflow - for now, allow with notification
        await createApprovalNotification(caseId, validatedData, user);
      }
    }

    // Calculate duration at current stage
    let duration = null;
    const currentAssignment = caseData.stageAssignments.find(
      assignment => assignment.stage === caseData.currentStage && assignment.isActive
    );

    if (currentAssignment) {
      duration = Math.floor(
        (Date.now() - currentAssignment.assignedAt.getTime()) / (1000 * 60 * 60 * 24)
      );
    }

    // Create stage progression record for return
    const progression = await prisma.stageProgression.create({
      data: {
        caseId,
        fromStage: caseData.currentStage,
        toStage: validatedData.toStage,
        progressionType: 'BACKWARD',
        reason: validatedData.reason,
        observations: validatedData.observations,
        approvedBy: approverId,
        approvedAt,
        duration,
        ipAddress: request.ip || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      }
    });

    // Update case current stage
    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: {
        currentStage: validatedData.toStage,
        status: 'EN_PROGRESO' // Ensure status is active when returning
      }
    });

    // Deactivate current stage assignment
    await prisma.caseStageAssignment.updateMany({
      where: {
        caseId,
        stage: caseData.currentStage,
        isActive: true
      },
      data: {
        isActive: false,
        notes: `Devuelto: ${validatedData.reason}`
      }
    });

    // Create new stage assignment for target stage
    const newStageAssignment = await prisma.caseStageAssignment.create({
      data: {
        caseId,
        stage: validatedData.toStage,
        assignedBy: user.id,
        dueDate: targetStageConfig.estimatedDuration ?
          new Date(Date.now() + (targetStageConfig.estimatedDuration * 24 * 60 * 60 * 1000)) :
          undefined,
        isActive: true,
        notes: `Caso devuelto desde ${currentStageConfig.name}: ${validatedData.reason}`
      }
    });

    // Reset checklist completions for target stage if they exist
    const existingChecklistCompletions = await prisma.checklistCompletion.findMany({
      where: {
        caseStageId: newStageAssignment.id
      }
    });

    if (existingChecklistCompletions.length > 0) {
      await prisma.checklistCompletion.updateMany({
        where: {
          caseStageId: newStageAssignment.id
        },
        data: {
          isCompleted: false,
          completedAt: null,
          completedBy: null,
          notes: `Reiniciado por devolución desde ${currentStageConfig.name}`
        }
      });
    }

    // Create notifications
    if (validatedData.notifyStakeholders) {
      await createReturnNotifications(caseId, validatedData, user, caseData);
    }

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'STAGE_CHANGED',
        entityType: 'case',
        entityId: caseId,
        description: `Caso ${caseData.fileNumber} devuelto de ${caseData.currentStage} a ${validatedData.toStage}`,
        metadata: {
          progressionType: 'BACKWARD',
          reason: validatedData.reason,
          observations: validatedData.observations,
          requiresApproval: validatedData.requiresApproval,
          priority: validatedData.priority,
          progressionId: progression.id
        }
      }
    });

    // Create case history record
    await prisma.caseHistory.create({
      data: {
        caseId,
        action: 'stage_return',
        field: 'currentStage',
        previousValue: caseData.currentStage,
        newValue: validatedData.toStage,
        reason: validatedData.reason,
        notes: validatedData.observations,
        changedById: user.id,
        ipAddress: request.ip || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
        duration
      }
    });

    return NextResponse.json({
      success: true,
      progression,
      updatedCase,
      newStageAssignment,
      message: 'Caso devuelto exitosamente',
      nextSteps: `Revisar las observaciones y completar los requisitos pendientes en la etapa: ${targetStageConfig.name}`
    });

  } catch (error) {
    logger.error('Error processing stage return:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Helper function to create return notifications
async function createReturnNotifications(
  caseId: string,
  returnData: any,
  user: any,
  caseData: any
) {
  try {
    const targetStageConfig = await prisma.stage.findUnique({
      where: { stage: returnData.toStage }
    });

    if (!targetStageConfig) return;

    const department = await prisma.department.findUnique({
      where: { code: targetStageConfig.responsibleDepartment }
    });

    if (!department) return;

    // Find users to notify
    const usersToNotify = await prisma.user.findMany({
      where: {
        departmentId: department.id,
        isActive: true,
        role: {
          name: {
            in: ['department_admin', 'supervisor', 'analyst']
          }
        }
      }
    });

    const notifications = usersToNotify.map(recipient => ({
      caseId,
      stage: returnData.toStage,
      type: 'WARNING' as const,
      title: `Caso Devuelto - ${targetStageConfig.name}`,
      message: `El caso ${caseData.fileNumber} ha sido devuelto a la etapa ${targetStageConfig.name}. Motivo: ${returnData.reason}`,
      recipientId: recipient.id,
      priority: returnData.priority,
      sendEmail: true,
      metadata: {
        caseFileNumber: caseData.fileNumber,
        stageName: targetStageConfig.name,
        reason: returnData.reason,
        observations: returnData.observations,
        returnedBy: `${user.firstName} ${user.lastName}`,
        requiresAction: true
      }
    }));

    await prisma.stageNotification.createMany({
      data: notifications
    });

  } catch (error) {
    logger.error('Error creating return notifications:', error);
  }
}

// Helper function to create approval notification
async function createApprovalNotification(
  caseId: string,
  returnData: any,
  user: any
) {
  try {
    // Find supervisor or department admin to approve
    const approvers = await prisma.user.findMany({
      where: {
        departmentId: user.departmentId,
        isActive: true,
        role: {
          name: {
            in: ['department_admin', 'supervisor']
          }
        }
      },
      take: 1
    });

    if (approvers.length === 0) return;

    const notification = {
      caseId,
      stage: returnData.toStage,
      type: 'TASK_ASSIGNED' as const,
      title: 'Aprobación Requerida - Devolución de Caso',
      message: `Se requiere su aprobación para devolver el caso a la etapa solicitada`,
      recipientId: approvers[0].id,
      priority: 'high',
      sendEmail: true,
      metadata: {
        requiresApproval: true,
        requestedBy: user.id,
        returnData,
        caseId
      }
    };

    await prisma.stageNotification.create({
      data: notification
    });

  } catch (error) {
    logger.error('Error creating approval notification:', error);
  }
}