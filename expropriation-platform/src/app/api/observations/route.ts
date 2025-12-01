import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ObservationPriority, ObservationStatus, CaseStage, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import type {
  CreateObservationRequest,
  ObservationFilters
} from '@/types';

// GET /api/observations - Get observations
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const stage = searchParams.get('stage');
    const priority = searchParams.get('priority') as ObservationPriority | null;
    const status = searchParams.get('status') as ObservationStatus | null;
    const assignedTo = searchParams.get('assignedTo');
    const observedBy = searchParams.get('observedBy') || session.user.id;
    const parentObservationId = searchParams.get('parentObservationId');

    const where: ObservationFilters = {};

    if (caseId) where.caseId = caseId;
    if (stage) where.stage = stage;
    if (priority) where.priority = priority;
    if (status) where.status = status;
    if (assignedTo) where.assignedTo = assignedTo;
    if (observedBy) where.observedBy = observedBy;
    if (parentObservationId) where.parentObservationId = parentObservationId;

    const observations = await prisma.observation.findMany({
      where: where as Prisma.ObservationWhereInput,
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            currentStage: true,
          },
        },
        observer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
        parentObservation: {
          select: {
            id: true,
            title: true,
          },
        },
        childObservations: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            observation: {
              select: {
                id: true,
                title: true,
                observer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            childObservations: true,
            responses: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(observations);
  } catch (error) {
    logger.error('Error fetching observations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch observations' },
      { status: 500 }
    );
  }
}

// POST /api/observations - Create observation
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateObservationRequest = await request.json();

    // Check if case exists
    const caseExists = await prisma.case.findUnique({
      where: { id: body.caseId },
    });

    if (!caseExists) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      );
    }

    // If assignedTo is provided, check if user exists
    if (body.assignedTo) {
      const assigneeExists = await prisma.user.findUnique({
        where: { id: body.assignedTo },
      });

      if (!assigneeExists) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        );
      }
    }

    // If parentObservationId is provided, check if it exists
    if (body.parentObservationId) {
      const parentExists = await prisma.observation.findUnique({
        where: { id: body.parentObservationId },
      });

      if (!parentExists) {
        return NextResponse.json(
          { error: 'Parent observation not found' },
          { status: 404 }
        );
      }
    }

    // Create base observation data with required fields only
    const observationData: Prisma.ObservationUncheckedCreateInput = {
      caseId: body.caseId,
      title: body.title,
      description: body.description,
      category: body.category,
      priority: body.priority,
      status: ObservationStatus.OPEN,
      observedBy: session.user.id,
    };

    // Add nullable/optional fields conditionally
    if (body.stage) observationData.stage = body.stage as CaseStage;
    if (body.subcategory) observationData.subcategory = body.subcategory;
    if (body.assignedTo) observationData.assignedTo = body.assignedTo;
    if (body.deadline) observationData.deadline = new Date(body.deadline);
    if (body.parentObservationId) observationData.parentObservationId = body.parentObservationId;
    if (body.responseTo) observationData.responseTo = body.responseTo;
    if (body.tags) observationData.tags = body.tags;

    const observation = await prisma.observation.create({
      data: observationData,
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            currentStage: true,
          },
        },
        observer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
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
        parentObservation: {
          select: {
            id: true,
            title: true,
          },
        },
        childObservations: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        responses: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            observation: {
              select: {
                id: true,
                title: true,
                observer: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: {
          select: {
            childObservations: true,
            responses: true,
          },
        },
      },
    });

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.COMMENTED,
        entityType: 'observation',
        entityId: observation.id,
        description: `Created observation: ${observation.title}`,
        userId: session.user.id,
        caseId: body.caseId,
        metadata: {
          observationId: observation.id,
          priority: observation.priority,
          category: observation.category,
        },
      },
    });

    // Create notification for assignee if specified
    if (body.assignedTo && body.assignedTo !== session.user.id) {
      await prisma.notification.create({
        data: {
          title: 'New Observation Assigned',
          message: `You have been assigned a new observation: ${observation.title}`,
          type: 'TASK_ASSIGNED',
          userId: body.assignedTo,
          entityType: 'observation',
          entityId: observation.id,
        },
      });
    }

    return NextResponse.json(observation, { status: 201 });
  } catch (error) {
    logger.error('Error creating observation:', error);
    return NextResponse.json(
      { error: 'Failed to create observation' },
      { status: 500 }
    );
  }
}

