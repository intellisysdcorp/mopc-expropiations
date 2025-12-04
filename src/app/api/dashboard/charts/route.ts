import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const chartType = searchParams.get('type') || 'overview';
    const period = searchParams.get('period') || '30'; // days

    const days = parseInt(period);
    const startDate = startOfDay(subDays(new Date(), days));
    const endDate = endOfDay(new Date());

    // Build department filter
    const departmentFilter = departmentId ? { departmentId } : {};

    switch (chartType) {
      case 'timeline':
        return getTimelineData(departmentFilter, startDate, endDate, days);
      case 'department':
        return getDepartmentData(departmentFilter, startDate, endDate);
      case 'stage':
        return getStageData(departmentFilter, startDate, endDate);
      case 'performance':
        return getPerformanceData(departmentFilter, startDate, endDate);
      default:
        return getOverviewData(departmentFilter, startDate, endDate, days);
    }
  } catch (error) {
    logger.error('Error fetching chart data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch chart data' },
      { status: 500 }
    );
  }
}

async function getTimelineData(departmentFilter: any, startDate: Date, endDate: Date, days: number) {
  // Generate daily data points
  const dailyData = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = startOfDay(subDays(new Date(), i));
    const nextDate = endOfDay(subDays(new Date(), i));

    const [created, completed, inProgress] = await Promise.all([
      prisma.case.count({
        where: {
          ...departmentFilter,
          deletedAt: null,
          createdAt: {
            gte: date,
            lte: nextDate
          }
        }
      }),
      prisma.case.count({
        where: {
          ...departmentFilter,
          deletedAt: null,
          actualEndDate: {
            gte: date,
            lte: nextDate
          },
          status: 'COMPLETADO'
        }
      }),
      prisma.case.count({
        where: {
          ...departmentFilter,
          deletedAt: null,
          createdAt: {
            lte: nextDate
          },
          status: 'EN_PROGRESO'
        }
      })
    ]);

    dailyData.push({
      date: format(date, 'yyyy-MM-dd'),
      created,
      completed,
      inProgress,
      total: created + completed + inProgress
    });
  }

  return NextResponse.json({ timeline: dailyData });
}

async function getOverviewData(departmentFilter: any, startDate: Date, endDate: Date, _days: number) {
  // Get priority distribution
  const priorityData = await prisma.case.groupBy({
    by: ['priority'],
    where: {
      ...departmentFilter,
      deletedAt: null,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true
  });

  // Get status distribution
  const statusData = await prisma.case.groupBy({
    by: ['status'],
    where: {
      ...departmentFilter,
      deletedAt: null,
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true
  });

  return NextResponse.json({
    priority: priorityData.map(item => ({
      name: item.priority,
      value: item._count,
      fill: getPriorityColor(item.priority)
    })),
    status: statusData.map(item => ({
      name: item.status,
      value: item._count,
      fill: getStatusColor(item.status)
    }))
  });
}

async function getDepartmentData(departmentFilter: any, startDate: Date, endDate: Date) {
  const departmentStats = await prisma.department.findMany({
    where: { isActive: true },
    include: {
      _count: {
        select: {
          cases: {
            where: {
              deletedAt: null,
              createdAt: {
                gte: startDate,
                lte: endDate
              }
            }
          }
        }
      }
    }
  });

  
  const data = departmentStats.map(dept => ({
    name: dept.name,
    cases: dept._count.cases,
    efficiency: Math.floor(Math.random() * 30) + 70, // Placeholder
    completion: Math.floor(Math.random() * 25) + 75 // Placeholder
  }));

  return NextResponse.json({ departments: data });
}

async function getStageData(departmentFilter: any, startDate: Date, endDate: Date) {
  const stageData = await prisma.case.groupBy({
    by: ['currentStage'],
    where: {
      ...departmentFilter,
      deletedAt: null,
      status: { notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED'] }
    },
    _count: true
  });

  const stageProgression = await prisma.stageProgression.groupBy({
    by: ['toStage'],
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      }
    },
    _count: true
  });

  const avgTimePerStage = await prisma.stageProgression.groupBy({
    by: ['toStage'],
    where: {
      createdAt: {
        gte: startDate,
        lte: endDate
      },
      duration: { not: null }
    },
    _avg: {
      duration: true
    }
  });

  const data = stageData.map(item => ({
    stage: item.currentStage,
    current: item._count,
    progression: stageProgression.find(p => p.toStage === item.currentStage)?._count || 0,
    avgTime: Math.floor((avgTimePerStage.find(p => p.toStage === item.currentStage)?._avg.duration || 0) / 24) || 0 // Convert to days
  }));

  return NextResponse.json({ stages: data });
}

async function getPerformanceData(departmentFilter: any, startDate: Date, endDate: Date) {
  // Get cases completed in the period
  const completedCases = await prisma.case.findMany({
    where: {
      ...departmentFilter,
      deletedAt: null,
      status: 'COMPLETADO',
      actualEndDate: {
        gte: startDate,
        lte: endDate
      },
      startDate: { not: null }
    },
    select: {
      id: true,
      startDate: true,
      actualEndDate: true,
      currentStage: true
    }
  });

  // Calculate performance metrics
  const performanceData = completedCases.map(case_ => {
    const duration = Math.floor(
      (new Date(case_.actualEndDate!).getTime() - new Date(case_.startDate).getTime()) /
      (1000 * 60 * 60 * 24)
    );

    return {
      caseId: case_.id,
      duration,
      efficiency: duration < 30 ? 'high' : duration < 60 ? 'medium' : 'low'
    };
  });

  // Group by efficiency
  const efficiencyData = performanceData.reduce((acc, item) => {
    acc[item.efficiency] = (acc[item.efficiency] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Get monthly trend
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth() - i, 1);
    const monthEnd = new Date(new Date().getFullYear(), new Date().getMonth() - i + 1, 0);

    const completed = await prisma.case.count({
      where: {
        ...departmentFilter,
        deletedAt: null,
        status: 'COMPLETADO',
        actualEndDate: {
          gte: monthStart,
          lte: monthEnd
        }
      }
    });

    monthlyTrend.push({
      month: format(monthStart, 'MMM yyyy'),
      completed,
      avgDuration: Math.floor(Math.random() * 20) + 35 // Placeholder
    });
  }

  return NextResponse.json({
    efficiency: Object.entries(efficiencyData).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      fill: name === 'high' ? '#10b981' : name === 'medium' ? '#f59e0b' : '#ef4444'
    })),
    monthlyTrend
  });
}

function getPriorityColor(priority: string): string {
  const colors = {
    LOW: '#10b981',
    MEDIUM: '#f59e0b',
    HIGH: '#f97316',
    URGENT: '#ef4444'
  };
  return colors[priority as keyof typeof colors] || '#6b7280';
}

function getStatusColor(status: string): string {
  const colors = {
    PENDIENTE: '#f59e0b',
    EN_PROGRESO: '#3b82f6',
    COMPLETADO: '#10b981',
    ARCHIVED: '#6b7280',
    SUSPENDED: '#ef4444',
    CANCELLED: '#ef4444'
  };
  return colors[status as keyof typeof colors] || '#6b7280';
}