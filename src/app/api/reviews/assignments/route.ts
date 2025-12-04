import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { CreateAssignmentInput, ReviewType } from '@/types/review';

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
    const validatedData: CreateAssignmentInput = {
      caseId: body.caseId,
      reviewType: body.reviewType,
      assignedTo: body.assignedTo,
      assignedBy: session.user.id,
      priority: body.priority || 'medium',
      parallelWith: body.parallelWith as Prisma.InputJsonValue,
      dependsOn: body.dependsOn as Prisma.InputJsonValue,
    };

    if (body.instructions) validatedData.instructions = body.instructions;
    if (body.dueDate) validatedData.dueDate = new Date(body.dueDate);
    if (body.estimatedTime) validatedData.estimatedTime = body.estimatedTime;

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
      data: validatedData,
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

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    logger.error('Error creating review assignment:', error);
    return NextResponse.json(
      { error: 'Failed to create review assignment' },
      { status: 500 }
    );
  }
}