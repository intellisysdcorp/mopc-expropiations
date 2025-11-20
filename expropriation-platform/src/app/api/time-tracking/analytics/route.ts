import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/time-tracking/analytics - Get time tracking analytics
export async function GET(request: NextRequest) {
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