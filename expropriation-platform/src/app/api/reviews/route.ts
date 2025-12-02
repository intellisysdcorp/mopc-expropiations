import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';
import { CreateReviewInput, ReviewCreatePayload } from '@/types/review';

// POST /api/reviews - Create review
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateReviewInput = await request.json();

    // Check if assignment exists and user is assigned
    const assignment = await prisma.reviewAssignment.findUnique({
      where: { id: body.assignmentId },
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

    // Create review payload with required fields
    const reviewPayload: ReviewCreatePayload = {
      assignmentId: body.assignmentId,
      reviewerId: session.user.id,
      findings: body.findings,
      conclusion: body.conclusion,
      decision: body.decision,
      ipAddress: request.headers.get('x-forwarded-for') || '',
      userAgent: request.headers.get('user-agent') || '',
    };

    // Add optional fields conditionally
    if (body.recommendations) {
      reviewPayload.recommendations = body.recommendations;
    }
    if (body.rating) {
      reviewPayload.rating = body.rating;
    }
    if (body.attachments) {
      reviewPayload.attachments = body.attachments;
    }

    // Create review
    const review = await prisma.review.create({
      data: reviewPayload,
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
      where: { id: body.assignmentId },
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
        description: `Submitted ${body.decision} review for case ${assignment.case.fileNumber}`,
        userId: session.user.id,
        caseId: assignment.caseId,
        metadata: {
          decision: body.decision,
          rating: body.rating,
          reviewType: assignment.reviewType,
        },
      },
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.message },
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

    const where: {
      assignmentId?: string;
      reviewerId?: string;
      decision?: string;
    } = {};

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