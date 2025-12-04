import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';

// Validation schemas
const createTimeEntrySchema = z.object({
  caseId: z.string(),
  stage: z.string(),
  action: z.enum(['START', 'PAUSE', 'RESUME', 'COMPLETE', 'EXTEND']),
  reason: z.string().optional(),
  justification: z.string().optional(),
  endTime: z.iso.datetime().optional(),
  duration: z.number().optional(),
  pausedDuration: z.number().optional(),
  alertThreshold: z.number().optional(),
});

// GET /api/time-tracking - Get time tracking entries
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const stage = searchParams.get('stage');
    const action = searchParams.get('action');
    const userId = searchParams.get('userId') || session.user.id;
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};

    if (caseId) where.caseId = caseId;
    if (stage) where.stage = stage as any;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    const timeEntries = await prisma.timeTracking.findMany({
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    // Calculate summary statistics
    const summary = {
      totalEntries: timeEntries.length,
      totalDuration: timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0),
      averageDuration: timeEntries.length > 0
        ? Math.floor(timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0) / timeEntries.length)
        : 0,
      entriesByStage: timeEntries.reduce((acc, entry) => {
        acc[entry.stage] = (acc[entry.stage] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      entriesByAction: timeEntries.reduce((acc, entry) => {
        acc[entry.action] = (acc[entry.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      entries: timeEntries,
      summary,
    });
  } catch (error) {
    logger.error('Error fetching time tracking entries:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time tracking entries' },
      { status: 500 }
    );
  }
}

// POST /api/time-tracking - Create time tracking entry
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createTimeEntrySchema.parse(body);

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

    // For START action, check if there's already an active time entry
    if (validatedData.action === 'START') {
      const activeEntry = await prisma.timeTracking.findFirst({
        where: {
          caseId: validatedData.caseId,
          stage: validatedData.stage as any,
          action: 'START',
          endTime: null,
        },
      });

      if (activeEntry) {
        return NextResponse.json(
          { error: 'Time tracking already started for this case and stage' },
          { status: 400 }
        );
      }
    }

    // For PAUSE, RESUME, COMPLETE, EXTEND actions, check if there's an active START entry
    if (['PAUSE', 'RESUME', 'COMPLETE', 'EXTEND'].includes(validatedData.action)) {
      const startEntry = await prisma.timeTracking.findFirst({
        where: {
          caseId: validatedData.caseId,
          stage: validatedData.stage as any,
          action: 'START',
          endTime: null,
        },
      });

      if (!startEntry) {
        return NextResponse.json(
          { error: 'No active time tracking found for this case and stage' },
          { status: 400 }
        );
      }

      // Calculate duration if not provided
      let duration = validatedData.duration;
      if (!duration && validatedData.endTime) {
        duration = Math.floor(
          (new Date(validatedData.endTime).getTime() - startEntry.startTime.getTime()) / (1000 * 60)
        );
      } else if (!duration) {
        duration = Math.floor(
          (new Date().getTime() - startEntry.startTime.getTime()) / (1000 * 60)
        );
      }

      // Update the START entry with end time and duration
      const updateData: any = {
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : new Date(),
      };

      if (duration !== undefined) {
        updateData.duration = duration;
      }

      if (validatedData.pausedDuration !== undefined) {
        updateData.pausedDuration = validatedData.pausedDuration;
      }

      await prisma.timeTracking.update({
        where: { id: startEntry.id },
        data: updateData,
      });
    }

    // Create the new time entry
    const createData: any = {
      caseId: validatedData.caseId,
      stage: validatedData.stage as any,
      action: validatedData.action,
      userId: session.user.id,
    };

    if (validatedData.reason !== undefined) {
      createData.reason = validatedData.reason;
    }

    if (validatedData.justification !== undefined) {
      createData.justification = validatedData.justification;
    }

    if (validatedData.endTime) {
      createData.endTime = new Date(validatedData.endTime);
    }

    if (validatedData.duration !== undefined) {
      createData.duration = validatedData.duration;
    }

    if (validatedData.pausedDuration !== undefined) {
      createData.pausedDuration = validatedData.pausedDuration;
    }

    if (validatedData.alertThreshold !== undefined) {
      createData.alertThreshold = validatedData.alertThreshold;
    }

    const timeEntry = await prisma.timeTracking.create({
      data: createData,
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
            currentStage: true,
          },
        },
        user: {
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
        action: ActivityType.UPDATED,
        entityType: 'time_tracking',
        entityId: timeEntry.id,
        description: `Time tracking ${validatedData.action.toLowerCase()} for case ${caseExists.fileNumber}`,
        userId: session.user.id,
        caseId: validatedData.caseId,
        metadata: {
          action: validatedData.action,
          stage: validatedData.stage,
          duration: timeEntry.duration,
        },
      },
    });

    return NextResponse.json(timeEntry, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error creating time tracking entry:', error);
    return NextResponse.json(
      { error: 'Failed to create time tracking entry' },
      { status: 500 }
    );
  }
}

