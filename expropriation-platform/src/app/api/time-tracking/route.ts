import { NextRequest, NextResponse } from 'next/server';
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
  endTime: z.string().datetime().optional(),
  duration: z.number().optional(),
  pausedDuration: z.number().optional(),
  alertThreshold: z.number().optional(),
});

const updateTimeEntrySchema = z.object({
  endTime: z.string().datetime().optional(),
  duration: z.number().optional(),
  pausedDuration: z.number().optional(),
  reason: z.string().optional(),
  justification: z.string().optional(),
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
      await prisma.timeTracking.update({
        where: { id: startEntry.id },
        data: {
          endTime: validatedData.endTime ? new Date(validatedData.endTime) : new Date(),
          duration,
          pausedDuration: validatedData.pausedDuration,
        },
      });
    }

    // Create the new time entry
    const timeEntry = await prisma.timeTracking.create({
      data: {
        caseId: validatedData.caseId,
        stage: validatedData.stage as any,
        action: validatedData.action,
        reason: validatedData.reason,
        justification: validatedData.justification,
        endTime: validatedData.endTime ? new Date(validatedData.endTime) : null,
        duration: validatedData.duration,
        pausedDuration: validatedData.pausedDuration,
        alertThreshold: validatedData.alertThreshold,
        userId: session.user.id,
      },
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
        { error: 'Validation failed', details: error.errors },
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

// GET /api/time-tracking/analytics - Get time tracking analytics
export async function GET_ANALYTICS(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const caseId = searchParams.get('caseId');
    const departmentId = searchParams.get('departmentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const where: any = {};
    if (caseId) where.caseId = caseId;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    let timeEntries;
    if (departmentId) {
      // Filter by department
      timeEntries = await prisma.timeTracking.findMany({
        where: {
          ...where,
          case: {
            departmentId,
          },
        },
        include: {
          case: {
            select: {
              id: true,
              fileNumber: true,
              title: true,
              departmentId: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
            },
          },
        },
      });
    } else {
      timeEntries = await prisma.timeTracking.findMany({
        where,
        include: {
          case: {
            select: {
              id: true,
              fileNumber: true,
              title: true,
              departmentId: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              departmentId: true,
            },
          },
        },
      });
    }

    // Calculate analytics
    const analytics = {
      overview: {
        totalEntries: timeEntries.length,
        totalDuration: timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0),
        averageDuration: timeEntries.length > 0
          ? Math.floor(timeEntries.reduce((sum, entry) => sum + (entry.duration || 0), 0) / timeEntries.length)
          : 0,
        totalPausedTime: timeEntries.reduce((sum, entry) => sum + (entry.pausedDuration || 0), 0),
      },
      byStage: timeEntries.reduce((acc, entry) => {
        if (!acc[entry.stage]) {
          acc[entry.stage] = {
            count: 0,
            totalDuration: 0,
            averageDuration: 0,
            entries: [],
          };
        }
        acc[entry.stage].count++;
        acc[entry.stage].totalDuration += entry.duration || 0;
        acc[entry.stage].entries.push(entry);
        return acc;
      }, {} as Record<string, any>),
      byAction: timeEntries.reduce((acc, entry) => {
        acc[entry.action] = (acc[entry.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      byUser: timeEntries.reduce((acc, entry) => {
        const userName = `${entry.user.firstName} ${entry.user.lastName}`;
        if (!acc[userName]) {
          acc[userName] = {
            userId: entry.user.id,
            count: 0,
            totalDuration: 0,
            averageDuration: 0,
          };
        }
        acc[userName].count++;
        acc[userName].totalDuration += entry.duration || 0;
        return acc;
      }, {} as Record<string, any>),
      overdueEntries: timeEntries.filter(entry => {
        if (entry.alertThreshold && entry.duration) {
          return entry.duration > entry.alertThreshold * 60; // Convert hours to minutes
        }
        return false;
      }),
    };

    // Calculate averages
    Object.values(analytics.byStage).forEach((stage: any) => {
      stage.averageDuration = stage.count > 0
        ? Math.floor(stage.totalDuration / stage.count)
        : 0;
    });

    Object.values(analytics.byUser).forEach((user: any) => {
      user.averageDuration = user.count > 0
        ? Math.floor(user.totalDuration / user.count)
        : 0;
    });

    return NextResponse.json(analytics);
  } catch (error) {
    logger.error('Error fetching time tracking analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch time tracking analytics' },
      { status: 500 }
    );
  }
}