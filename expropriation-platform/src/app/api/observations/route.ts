import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ObservationPriority, ObservationStatus } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createObservationSchema = z.object({
  caseId: z.string(),
  stage: z.string().optional(),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  category: z.string(),
  subcategory: z.string().optional(),
  priority: z.nativeEnum(ObservationPriority),
  assignedTo: z.string().optional(),
  deadline: z.string().datetime().optional(),
  parentObservationId: z.string().optional(),
  responseTo: z.string().optional(),
  tags: z.string().optional(),
});

const createResponseSchema = z.object({
  observationId: z.string(),
  response: z.string().min(1, 'Response is required'),
  responseType: z.enum(['ACKNOWLEDGMENT', 'CLARIFICATION', 'ACTION', 'RESOLUTION']),
  attachments: z.array(z.string()).optional(),
});

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
    const priority = searchParams.get('priority');
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assignedTo');
    const observedBy = searchParams.get('observedBy') || session.user.id;
    const parentObservationId = searchParams.get('parentObservationId');

    const where: any = {};

    if (caseId) where.caseId = caseId;
    if (stage) where.stage = stage as any;
    if (priority) where.priority = priority as ObservationPriority;
    if (status) where.status = status as ObservationStatus;
    if (assignedTo) where.assignedTo = assignedTo;
    if (observedBy) where.observedBy = observedBy;
    if (parentObservationId) where.parentObservationId = parentObservationId;

    const observations = await prisma.observation.findMany({
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

    const body = await request.json();
    const validatedData = createObservationSchema.parse(body);

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

    // If assignedTo is provided, check if user exists
    if (validatedData.assignedTo) {
      const assigneeExists = await prisma.user.findUnique({
        where: { id: validatedData.assignedTo },
      });

      if (!assigneeExists) {
        return NextResponse.json(
          { error: 'Assigned user not found' },
          { status: 404 }
        );
      }
    }

    // If parentObservationId is provided, check if it exists
    if (validatedData.parentObservationId) {
      const parentExists = await prisma.observation.findUnique({
        where: { id: validatedData.parentObservationId },
      });

      if (!parentExists) {
        return NextResponse.json(
          { error: 'Parent observation not found' },
          { status: 404 }
        );
      }
    }

    const observation = await prisma.observation.create({
      data: {
        caseId: validatedData.caseId,
        stage: validatedData.stage as any,
        title: validatedData.title,
        description: validatedData.description,
        category: validatedData.category,
        subcategory: validatedData.subcategory,
        priority: validatedData.priority,
        status: ObservationStatus.OPEN,
        observedBy: session.user.id,
        assignedTo: validatedData.assignedTo,
        deadline: validatedData.deadline ? new Date(validatedData.deadline) : null,
        parentObservationId: validatedData.parentObservationId,
        responseTo: validatedData.responseTo,
        tags: validatedData.tags,
      },
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
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
        caseId: validatedData.caseId,
        metadata: {
          observationId: observation.id,
          priority: observation.priority,
          category: observation.category,
        },
      },
    });

    // Create notification for assignee if specified
    if (validatedData.assignedTo && validatedData.assignedTo !== session.user.id) {
      await prisma.notification.create({
        data: {
          title: 'New Observation Assigned',
          message: `You have been assigned a new observation: ${observation.title}`,
          type: 'TASK_ASSIGNED',
          userId: validatedData.assignedTo,
          entityType: 'observation',
          entityId: observation.id,
        },
      });
    }

    return NextResponse.json(observation, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating observation:', error);
    return NextResponse.json(
      { error: 'Failed to create observation' },
      { status: 500 }
    );
  }
}

// POST /api/observations/responses - Create observation response
export async function POST_RESPONSE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createResponseSchema.parse(body);

    // Check if observation exists
    const observation = await prisma.observation.findUnique({
      where: { id: validatedData.observationId },
    });

    if (!observation) {
      return NextResponse.json(
        { error: 'Observation not found' },
        { status: 404 }
      );
    }

    // Calculate response time
    const responseTime = Math.floor(
      (new Date().getTime() - new Date(observation.createdAt).getTime()) / (1000 * 60 * 60)
    );

    const response = await prisma.observationResponse.create({
      data: {
        observationId: validatedData.observationId,
        userId: session.user.id,
        response: validatedData.response,
        responseType: validatedData.responseType,
        attachments: validatedData.attachments,
        responseTime,
      },
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
          include: {
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
    });

    // Update observation status if it's a resolution
    if (validatedData.responseType === 'RESOLUTION') {
      await prisma.observation.update({
        where: { id: validatedData.observationId },
        data: {
          status: ObservationStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
    } else if (validatedData.responseType === 'ACTION') {
      await prisma.observation.update({
        where: { id: validatedData.observationId },
        data: {
          status: ObservationStatus.IN_PROGRESS,
        },
      });
    }

    // Log activity
    await prisma.activity.create({
      data: {
        action: ActivityType.COMMENTED,
        entityType: 'observation_response',
        entityId: response.id,
        description: `Added response to observation: ${observation.title}`,
        userId: session.user.id,
        caseId: observation.caseId,
        metadata: {
          observationId: validatedData.observationId,
          responseType: validatedData.responseType,
        },
      },
    });

    // Create notification for observation observer if they're not the responder
    if (observation.observedBy !== session.user.id) {
      await prisma.notification.create({
        data: {
          title: 'Response to Your Observation',
          message: `New response to observation: ${observation.title}`,
          type: 'STATUS_UPDATE',
          userId: observation.observedBy,
          entityType: 'observation',
          entityId: validatedData.observationId,
        },
      });
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error creating observation response:', error);
    return NextResponse.json(
      { error: 'Failed to create observation response' },
      { status: 500 }
    );
  }
}