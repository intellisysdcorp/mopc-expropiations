import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const updateCompletionSchema = z.object({
  completions: z.array(z.object({
    itemId: z.string(),
    isCompleted: z.boolean(),
    notes: z.string().optional(),
    attachmentPath: z.string().optional(),
  })),
});

const createCompletionSchema = z.object({
  caseStageId: z.string(),
  itemId: z.string(),
  isCompleted: z.boolean().default(false),
  notes: z.string().optional(),
  attachmentPath: z.string().optional(),
});

// GET /api/checklist/completions - Get checklist completions for a case
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseStageId = searchParams.get('caseStageId');
    const caseId = searchParams.get('caseId');
    const stage = searchParams.get('stage');

    let where: any = {};

    if (caseStageId) {
      where.caseStageId = caseStageId;
    } else if (caseId && stage) {
      // Find case stage assignment first
      const caseStageAssignment = await prisma.caseStageAssignment.findFirst({
        where: {
          caseId,
          stage: stage as any,
          isActive: true,
        },
      });

      if (caseStageAssignment) {
        where.caseStageId = caseStageAssignment.id;
      }
    }

    const completions = await prisma.checklistItemCompletion.findMany({
      where,
      include: {
        caseStageAssignment: {
          include: {
            case: {
              select: {
                id: true,
                fileNumber: true,
                title: true,
              },
            },
          },
        },
        item: {
          include: {
            template: {
              select: {
                id: true,
                name: true,
                stage: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json(completions);
  } catch (error) {
    logger.error('Error fetching checklist completions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch checklist completions' },
      { status: 500 }
    );
  }
}

// POST /api/checklist/completions - Create or update checklist completions
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateCompletionSchema.parse(body);

    const results = [];

    for (const completion of validatedData.completions) {
      // Find or create completion
      const existingCompletion = await prisma.checklistItemCompletion.findUnique({
        where: {
          caseStageId_itemId: {
            caseStageId: body.caseStageId,
            itemId: completion.itemId,
          },
        },
      });

      let result;
      if (existingCompletion) {
        // Update existing completion
        result = await prisma.checklistItemCompletion.update({
          where: {
            id: existingCompletion.id,
          },
          data: {
            isCompleted: completion.isCompleted,
            notes: completion.notes,
            attachmentPath: completion.attachmentPath,
            completedAt: completion.isCompleted ? new Date() : null,
            completedBy: completion.isCompleted ? session.user.id : null,
          },
          include: {
            item: true,
            caseStageAssignment: {
              include: {
                case: true,
              },
            },
          },
        });
      } else {
        // Create new completion
        result = await prisma.checklistItemCompletion.create({
          data: {
            caseStageId: body.caseStageId,
            itemId: completion.itemId,
            isCompleted: completion.isCompleted,
            notes: completion.notes,
            attachmentPath: completion.attachmentPath,
            completedAt: completion.isCompleted ? new Date() : null,
            completedBy: completion.isCompleted ? session.user.id : null,
          },
          include: {
            item: true,
            caseStageAssignment: {
              include: {
                case: true,
              },
            },
          },
        });
      }

      // Log activity
      await prisma.activity.create({
        data: {
          action: completion.isCompleted ? ActivityType.UPDATED : ActivityType.UPDATED,
          entityType: 'checklist_completion',
          entityId: result.id,
          description: `${completion.isCompleted ? 'Completed' : 'Updated'} checklist item: ${result.item.title}`,
          userId: session.user.id,
          caseId: result.caseStageAssignment.caseId,
        },
      });

      results.push(result);
    }

    return NextResponse.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating checklist completions:', error);
    return NextResponse.json(
      { error: 'Failed to update checklist completions' },
      { status: 500 }
    );
  }
}