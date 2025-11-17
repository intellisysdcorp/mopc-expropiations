import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ReviewType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createAssignmentSchema = z.object({
  caseId: z.string(),
  reviewType: z.nativeEnum(ReviewType),
  assignedTo: z.string(),
  priority: z.string().default('medium'),
  instructions: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  estimatedTime: z.number().optional(),
  parallelWith: z.array(z.string()).optional(),
  dependsOn: z.array(z.string()).optional(),
});

// GET /api/reviews/assignments - Get review assignments
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const reviewType = searchParams.get('reviewType');
    const assignedTo = searchParams.get('assignedTo');
    const status = searchParams.get('status');

    const where: any = {};

    if (caseId) where.caseId = caseId;
    if (reviewType) where.reviewType = reviewType as ReviewType;
    if (assignedTo) where.assignedTo = assignedTo;
    if (status) where.status = status;

    const assignments = await prisma.reviewAssignment.findMany({
      where,
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            currentStage: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviews: {
          include: {
            reviewer: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(assignments);
  } catch (error) {
    logger.error('Error fetching review assignments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review assignments' },
      { status: 500 }
    );
  }
}

// POST /api/reviews/assignments - Create review assignment
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createAssignmentSchema.parse(body);

    // Check if case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: validatedData.caseId },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // Check if assignee exists
    const assigneeExists = await prisma.user.findUnique({
      where: { id: validatedData.assignedTo },
    });

    if (!assigneeExists) {
      return NextResponse.json(
        { error: 'Assignee not found' },
        { status: 404 }
      );
    }

    // Create assignment
    const assignment = await prisma.reviewAssignment.create({
      data: {
        caseId: validatedData.caseId,
        reviewType: validatedData.reviewType,
        assignedTo: validatedData.assignedTo,
        assignedBy: session.user.id,
        priority: validatedData.priority,
        instructions: validatedData.instructions,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        estimatedTime: validatedData.estimatedTime,
        parallelWith: validatedData.parallelWith,
        dependsOn: validatedData.dependsOn,
      },
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
          },
        },
        assignee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assigner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.ASSIGNED,
        entityType: 'review_assignment',
        entityId: assignment.id,
        description: `Created ${assignment.reviewType} review assignment for case ${caseExists.fileNumber}`,
        userId: session.user.id,
        caseId: validatedData.caseId,
        metadata: {
          reviewType: validatedData.reviewType,
          assignedTo: validatedData.assignedTo,
          priority: validatedData.priority,
        },
      },
    });

    // Create notification for assignee
    if (validatedData.assignedTo !== session.user.id) {
      await prisma.notification.create({
        data: {
          title: 'New Review Assignment',
          message: `You have been assigned a ${assignment.reviewType.replace('_', ' ')} review for case ${caseExists.fileNumber}`,
          type: 'TASK_ASSIGNED',
          userId: validatedData.assignedTo,
          entityType: 'review_assignment',
          entityId: assignment.id,
        },
      });
    }

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating review assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create review assignment' },
      { status: 500 }
    );
  }
}