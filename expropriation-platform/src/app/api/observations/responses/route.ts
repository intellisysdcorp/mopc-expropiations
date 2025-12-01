import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType, ObservationStatus, Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import type { CreateObservationResponseRequest } from '@/types';

// POST /api/observations/responses - Create observation response
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: CreateObservationResponseRequest = await request.json();

    // Check if observation exists
    const observation = await prisma.observation.findUnique({
      where: { id: body.observationId },
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

    // Create base response data with required fields only
    const responseData: Prisma.ObservationResponseUncheckedCreateInput = {
      observationId: body.observationId,
      userId: session.user.id,
      response: body.response,
      responseType: body.responseType as string,
      responseTime,
    };

    // Add nullable/optional fields conditionally
    if (body.attachments) responseData.attachments = body.attachments as Prisma.InputJsonValue;

    const response = await prisma.observationResponse.create({
      data: responseData,
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
    if (body.responseType === 'RESOLUTION') {
      await prisma.observation.update({
        where: { id: body.observationId },
        data: {
          status: ObservationStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
    } else if (body.responseType === 'ACTION') {
      await prisma.observation.update({
        where: { id: body.observationId },
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
          observationId: body.observationId,
          responseType: body.responseType,
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
          entityId: body.observationId,
        },
      });
    }

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    logger.error('Error creating observation response:', error);
    return NextResponse.json(
      { error: 'Failed to create observation response' },
      { status: 500 }
    );
  }
}