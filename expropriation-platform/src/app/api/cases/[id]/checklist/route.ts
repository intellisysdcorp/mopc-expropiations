import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const checklistItemSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  description: z.string().optional(),
  isRequired: z.boolean().default(true),
  itemType: z.enum(['DOCUMENT', 'ACTION', 'VERIFICATION', 'APPROVAL']),
  sequence: z.number().int().positive().optional(),
  isActive: z.boolean().default(true)
});

const checklistCompletionSchema = z.object({
  checklistId: z.string().min(1, 'ID del checklist es requerido'),
  isCompleted: z.boolean(),
  notes: z.string().optional(),
  attachmentPath: z.string().optional()
});

// Get checklist items for a case's current stage
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
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get('stage');

    // Get case data
    const caseData = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        stageAssignments: {
          where: { isActive: true },
          include: {
            checklistCompletions: {
              include: {
                checklist: true,
                completedByUser: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true
                  }
                }
              }
            }
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
    const hasAccess = user.role.name === 'super_admin' ||
                     caseData.departmentId === user.departmentId ||
                     caseData.assignedToId === user.id ||
                     caseData.supervisedById === user.id;

    if (!hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Determine which stage to get checklist for
    const targetStage = stage || caseData.currentStage;

    // Get checklist items for the stage
    const checklistItems = await prisma.stageChecklist.findMany({
      where: {
        stage: targetStage as any,
        isActive: true
      },
      orderBy: [
        { isRequired: 'desc' },
        { sequence: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    // Get current stage assignment
    const currentAssignment = caseData.stageAssignments.find(
      assignment => assignment.stage === targetStage
    );

    // Map checklist items with completion status
    const checklistWithStatus = checklistItems.map(item => {
      const completion = currentAssignment?.checklistCompletions.find(
        c => c.checklistId === item.id
      );

      return {
        ...item,
        completion: completion ? {
          id: completion.id,
          isCompleted: completion.isCompleted,
          completedAt: completion.completedAt,
          completedBy: completion.completedByUser,
          notes: completion.notes,
          attachmentPath: completion.attachmentPath
        } : null
      };
    });

    // Calculate progress statistics
    const totalItems = checklistWithStatus.filter(item => item.isRequired).length;
    const completedItems = checklistWithStatus.filter(
      item => item.isRequired && item.completion?.isCompleted
    ).length;
    const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;

    return NextResponse.json({
      stage: targetStage,
      items: checklistWithStatus,
      statistics: {
        total: totalItems,
        completed: completedItems,
        pending: totalItems - completedItems,
        percentage: progressPercentage,
        canProgress: progressPercentage === 100
      },
      stageAssignment: currentAssignment
    });

  } catch (error) {
    logger.error('Error fetching checklist:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Add new checklist item to a stage (admin function)
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
    const validatedData = checklistItemSchema.parse(body);

    // Get case data and user
    const [caseData, user] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        select: {
          currentStage: true,
          departmentId: true
        }
      }),
      prisma.user.findUnique({
        where: { email: session.user?.email as string },
        include: { role: true }
      })
    ]);

    if (!caseData) {
      return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check permissions (only admins can add checklist items)
    const hasPermission = user.role.name === 'super_admin' ||
                         user.role.name === 'department_admin';

    if (!hasPermission) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Create checklist item
    const checklistItem = await prisma.stageChecklist.create({
      data: {
        stage: caseData.currentStage as any,
        title: validatedData.title,
        description: validatedData.description,
        isRequired: validatedData.isRequired,
        itemType: validatedData.itemType,
        sequence: validatedData.sequence || 1,
        isActive: validatedData.isActive
      }
    });

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: 'CREATED',
        entityType: 'checklist_item',
        entityId: checklistItem.id,
        description: `Added checklist item: ${checklistItem.title} to case ${caseId}`,
        metadata: {
          caseId,
          stage: caseData.currentStage,
          checklistId: checklistItem.id
        }
      }
    });

    return NextResponse.json({
      success: true,
      checklistItem
    });

  } catch (error) {
    logger.error('Error creating checklist item:', error);

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

// Update checklist completion status
export async function PUT(
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
    const validatedData = checklistCompletionSchema.parse(body);

    // Get case data and user
    const [caseData, user] = await Promise.all([
      prisma.case.findUnique({
        where: { id: caseId },
        include: {
          stageAssignments: {
            where: { isActive: true },
            include: {
              checklistCompletions: true
            }
          }
        }
      }),
      prisma.user.findUnique({
        where: { email: session.user?.email as string },
        include: { role: true }
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

    // Get current stage assignment
    const currentAssignment = caseData.stageAssignments[0];
    if (!currentAssignment) {
      return NextResponse.json({ error: 'No active stage assignment found' }, { status: 404 });
    }

    // Verify checklist item exists
    const checklistItem = await prisma.stageChecklist.findUnique({
      where: { id: validatedData.checklistId }
    });

    if (!checklistItem) {
      return NextResponse.json({ error: 'Checklist item not found' }, { status: 404 });
    }

    // Check if checklist belongs to current stage
    if (checklistItem.stage !== caseData.currentStage) {
      return NextResponse.json({ error: 'Checklist item does not belong to current stage' }, { status: 400 });
    }

    // Update or create checklist completion
    let completion;
    const existingCompletion = currentAssignment.checklistCompletions.find(
      c => c.checklistId === validatedData.checklistId
    );

    if (existingCompletion) {
      completion = await prisma.checklistCompletion.update({
        where: { id: existingCompletion.id },
        data: {
          isCompleted: validatedData.isCompleted,
          completedAt: validatedData.isCompleted ? new Date() : null,
          completedBy: validatedData.isCompleted ? user.id : null,
          notes: validatedData.notes,
          attachmentPath: validatedData.attachmentPath
        }
      });
    } else {
      completion = await prisma.checklistCompletion.create({
        data: {
          caseStageId: currentAssignment.id,
          checklistId: validatedData.checklistId,
          isCompleted: validatedData.isCompleted,
          completedAt: validatedData.isCompleted ? new Date() : null,
          completedBy: validatedData.isCompleted ? user.id : null,
          notes: validatedData.notes,
          attachmentPath: validatedData.attachmentPath
        }
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        userId: user.id,
        action: validatedData.isCompleted ? 'UPDATED' : 'UPDATED',
        entityType: 'checklist_completion',
        entityId: completion.id,
        description: `${validatedData.isCompleted ? 'Completed' : 'Updated'} checklist item: ${checklistItem.title}`,
        metadata: {
          caseId,
          checklistId: checklistItem.id,
          isCompleted: validatedData.isCompleted,
          notes: validatedData.notes
        }
      }
    });

    // Calculate updated progress
    const allChecklistItems = await prisma.stageChecklist.findMany({
      where: {
        stage: caseData.currentStage as any,
        isRequired: true,
        isActive: true
      }
    });

    const allCompletions = await prisma.checklistCompletion.findMany({
      where: {
        caseStageId: currentAssignment.id,
        isCompleted: true
      },
      include: {
        checklist: true
      }
    });

    const completedRequiredItems = allCompletions.filter(
      c => c.checklist.isRequired
    ).length;

    const progressPercentage = allChecklistItems.length > 0
      ? (completedRequiredItems / allChecklistItems.length) * 100
      : 100;

    return NextResponse.json({
      success: true,
      completion,
      progress: {
        total: allChecklistItems.length,
        completed: completedRequiredItems,
        percentage: progressPercentage,
        canProgress: progressPercentage === 100
      }
    });

  } catch (error) {
    logger.error('Error updating checklist completion:', error);

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