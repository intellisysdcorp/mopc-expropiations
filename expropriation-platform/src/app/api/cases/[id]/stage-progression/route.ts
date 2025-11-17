import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { CaseStage } from '@prisma/client';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const progressionSchema = z.object({
  toStage: z.nativeEnum(CaseStage),
  reason: z.string().optional(),
  observations: z.string().optional(),
  approvedBy: z.string().optional(),
});

const returnSchema = z.object({
  toStage: z.nativeEnum(CaseStage),
  reason: z.string().min(1, 'El motivo de devolución es requerido'),
  observations: z.string().min(1, 'Las observaciones son requeridas'),
  approvedBy: z.string().optional(),
});

// Get stage progression history for a case
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

    // Get case with current stage
    const currentCase = await prisma.case.findUnique({
      where: { id: caseId },
      select: {
        id: true,
        fileNumber: true,
        title: true,
        currentStage: true,
        status: true,
        stageProgressions: {
          include: {
            fromStageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
              }
            },
            toStageConfig: {
              select: {
                name: true,
                description: true,
                sequenceOrder: true,
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!currentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    // Check if user has permission to view this case
    const user = await prisma.user.findUnique({
      where: { email: session.user?.email as string },
      include: { role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check department access or admin role
    const hasAccess = user.role.name === 'super_admin' ||
                     currentCase.departmentId === user.departmentId;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({
      case: currentCase,
      progressions: currentCase.stageProgressions
    });

  } catch (error) {
    logger.error('Error fetching stage progression:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Progress case to next stage or return to previous stage
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
    const isReturn = body.type === 'return';
    const validatedData = isReturn ?
      returnSchema.parse(body) :
      progressionSchema.parse(body);

    // Get current case and user
    const [currentCase, user] = await Promise.all([
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

    if (!currentCase) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions
    const hasPermission = user.role.name === 'super_admin' ||
                         user.role.name === 'department_admin' ||
                         user.role.name === 'supervisor' ||
                         (user.role.name === 'analyst' && currentCase.assignedToId === user.id);

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get stage configurations
    const [fromStageConfig, toStageConfig] = await Promise.all([
      prisma.stage.findUnique({
        where: { stage: currentCase.currentStage }
      }),
      prisma.stage.findUnique({
        where: { stage: validatedData.toStage }
      })
    ]);

    if (!toStageConfig) {
      return NextResponse.json({ error: 'Target stage not found' }, { status: 404 });
    }

    // Determine progression type
    let progressionType: 'FORWARD' | 'BACKWARD' | 'JUMP';
    if (!fromStageConfig) {
      progressionType = 'FORWARD';
    } else if (fromStageConfig.sequenceOrder < toStageConfig.sequenceOrder) {
      progressionType = 'FORWARD';
    } else if (fromStageConfig.sequenceOrder > toStageConfig.sequenceOrder) {
      progressionType = 'BACKWARD';
    } else {
      progressionType = 'JUMP';
    }

    // For forward progression, validate checklist completion
    if (progressionType === 'FORWARD' && fromStageConfig) {
      const currentStageAssignment = currentCase.stageAssignments.find(
        assignment => assignment.stage === currentCase.currentStage && assignment.isActive
      );

      if (currentStageAssignment) {
        const requiredChecklistItems = await prisma.stageChecklist.findMany({
          where: {
            stage: currentCase.currentStage,
            isRequired: true,
            isActive: true
          }
        });

        const completedRequiredItems = currentStageAssignment.checklistCompletions.filter(
          completion => completion.isCompleted &&
                       requiredChecklistItems.some(item => item.id === completion.checklistId)
        );

        if (completedRequiredItems.length < requiredChecklistItems.length) {
          return NextResponse.json({
            error: 'Cannot progress to next stage',
            message: 'All required checklist items must be completed',
            missingItems: requiredChecklistItems.filter(
              item => !completedRequiredItems.some(completion => completion.checklistId === item.id)
            )
          }, { status: 400 });
        }
      }
    }

    // Calculate duration at current stage
    let duration = null;
    if (fromStageConfig && currentCase.stageAssignments.length > 0) {
      const currentAssignment = currentCase.stageAssignments.find(
        assignment => assignment.stage === currentCase.currentStage && assignment.isActive
      );
      if (currentAssignment) {
        duration = Math.floor(
          (Date.now() - currentAssignment.assignedAt.getTime()) / (1000 * 60 * 60 * 24)
        );
      }
    }

    // Create stage progression record
    const progression = await prisma.stageProgression.create({
      data: {
        caseId,
        fromStage: currentCase.currentStage,
        toStage: validatedData.toStage,
        progressionType,
        reason: validatedData.reason,
        observations: validatedData.observations,
        approvedBy: validatedData.approvedBy || user.id,
        approvedAt: new Date(),
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
        // Update status based on stage
        status: validatedData.toStage === CaseStage.CIERRE_ARCHIVO ? 'COMPLETADO' : 'EN_PROGRESO'
      }
    });

    // Deactivate current stage assignment and create new one
    if (fromStageConfig) {
      await prisma.caseStageAssignment.updateMany({
        where: {
          caseId,
          stage: currentCase.currentStage,
          isActive: true
        },
        data: {
          isActive: false
        }
      });
    }

    // Create new stage assignment
    const newStageAssignment = await prisma.caseStageAssignment.create({
      data: {
        caseId,
        stage: validatedData.toStage,
        assignedBy: user.id,
        dueDate: toStageConfig.estimatedDuration ?
          new Date(Date.now() + (toStageConfig.estimatedDuration * 24 * 60 * 60 * 1000)) :
          undefined,
        isActive: true,
        notes: validatedData.reason
      }
    });

    // Auto-assign based on stage rules
    if (toStageConfig.autoAssignmentRules) {
      const rules = toStageConfig.autoAssignmentRules as any;
      if (rules.autoAssign && rules.assignByRole) {
        // Find user to assign based on role and department
        const assignee = await prisma.user.findFirst({
          where: {
            department: { code: rules.assignToDepartment },
            role: { name: rules.assignByRole },
            isActive: true,
            // Find user with least cases assigned
            assignedCases: {
              some: {}
            }
          },
          orderBy: {
            assignedCases: {
              _count: 'asc'
            }
          }
        });

        if (assignee) {
          await prisma.case.update({
            where: { id: caseId },
            data: { assignedToId: assignee.id }
          });
        }
      }
    }

    // Create notification for relevant users
    await createStageNotifications(caseId, validatedData.toStage, user, updatedCase);

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'STAGE_CHANGED',
        entityType: 'case',
        entityId: caseId,
        description: `Case ${currentCase.fileNumber} progressed from ${currentCase.currentStage} to ${validatedData.toStage}`,
        metadata: {
          progressionType,
          reason: validatedData.reason,
          progressionId: progression.id
        }
      }
    });

    return NextResponse.json({
      success: true,
      progression,
      updatedCase,
      newStageAssignment
    });

  } catch (error) {
    logger.error('Error in stage progression:', error);

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

// Helper function to create stage notifications
async function createStageNotifications(
  caseId: string,
  stage: CaseStage,
  user: any,
  caseData: any
) {
  try {
    const stageConfig = await prisma.stage.findUnique({
      where: { stage }
    });

    if (!stageConfig) return;

    const department = await prisma.department.findUnique({
      where: { code: stageConfig.responsibleDepartment }
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
      stage,
      type: 'STATUS_UPDATE' as const,
      title: `Caso ${caseData.fileNumber} - Nueva etapa: ${stageConfig.name}`,
      message: `El caso ha pasado a la etapa: ${stageConfig.name}. ${stageConfig.description}`,
      recipientId: recipient.id,
      priority: 'high',
      metadata: {
        caseFileNumber: caseData.fileNumber,
        stageName: stageConfig.name,
        progressedBy: `${user.firstName} ${user.lastName}`
      }
    }));

    await prisma.stageNotification.createMany({
      data: notifications
    });

  } catch (error) {
    logger.error('Error creating notifications:', error);
  }
}