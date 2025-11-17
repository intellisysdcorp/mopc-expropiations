import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createReviewSchema = z.object({
  assignmentId: z.string(),
  findings: z.string(),
  recommendations: z.string().optional(),
  conclusion: z.string(),
  rating: z.number().min(1).max(5).optional(),
  decision: z.enum(['APPROVED', 'REJECTED', 'CONDITIONAL', 'NEEDS_REVISION']),
  attachments: z.array(z.string()).optional(),
});

// POST /api/reviews - Create review
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createReviewSchema.parse(body);

    // Check if assignment exists and user is assigned
    const assignment = await prisma.reviewAssignment.findUnique({
      where: { id: validatedData.assignmentId },
      include: {
        case: true,
        assignee: true,
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Review assignment not found' },
        { status: 404 }
      );
    }

    if (assignment.assignedTo !== session.user.id) {
      return NextResponse.json(
        { error: 'You are not assigned to this review' },
        { status: 403 }
      );
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        assignmentId: validatedData.assignmentId,
        reviewerId: session.user.id,
        findings: validatedData.findings,
        recommendations: validatedData.recommendations,
        conclusion: validatedData.conclusion,
        rating: validatedData.rating,
        decision: validatedData.decision,
        attachments: validatedData.attachments,
        ipAddress: request.ip || request.headers.get('x-forwarded-for') || '',
        userAgent: request.headers.get('user-agent') || '',
      },
      include: {
        assignment: {
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
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Update assignment status
    await prisma.reviewAssignment.update({
      where: { id: validatedData.assignmentId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.COMMENTED,
        entityType: 'review',
        entityId: review.id,
        description: `Submitted ${validatedData.decision} review for case ${assignment.case.fileNumber}`,
        userId: session.user.id,
        caseId: assignment.caseId,
        metadata: {
          decision: validatedData.decision,
          rating: validatedData.rating,
          reviewType: assignment.reviewType,
        },
      },
    });

    // Create notification for assigner
    if (assignment.assignedBy !== session.user.id) {
      await prisma.notification.create({
        data: {
          title: 'Review Completed',
          message: `Review for case ${assignment.case.fileNumber} has been completed with decision: ${validatedData.decision}`,
          type: 'STATUS_UPDATE',
          userId: assignment.assignedBy,
          entityType: 'review',
          entityId: review.id,
        },
      });
    }

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
}

// GET /api/reviews - Get reviews
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const assignmentId = searchParams.get('assignmentId');
    const reviewerId = searchParams.get('reviewerId') || session.user.id;
    const decision = searchParams.get('decision');

    const where: any = {};

    if (assignmentId) where.assignmentId = assignmentId;
    if (reviewerId) where.reviewerId = reviewerId;
    if (decision) where.decision = decision;

    const reviews = await prisma.review.findMany({
      where,
      include: {
        assignment: {
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
          },
        },
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
    });

    return NextResponse.json(reviews);
  } catch (error) {
    logger.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}