import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { queryMonitor } from '@/lib/query-monitor';
import { logger } from '@/lib/logger';

interface DashboardStats {
  totalCases: number
  activeCases: number
  completedCases: number
  pendingCases: number
  inProgressCases: number
  overdueCases: number
  totalUsers: number
  activeUsers: number
  totalDepartments: number
  avgCompletionTime: number
  casesThisMonth: number
  casesLastMonth: number
  monthlyTrend: number
  monthlyTrendPercent: number
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get('departmentId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Track the entire dashboard stats query
    return await queryMonitor.trackQuery('dashboard-stats', async () => {

    // Build date filter
    const dateFilter: any = {};
    if (startDate && endDate) {
      dateFilter.gte = new Date(startDate);
      dateFilter.lte = new Date(endDate);
    } else if (startDate) {
      dateFilter.gte = new Date(startDate);
    } else if (endDate) {
      dateFilter.lte = new Date(endDate);
    }

    // Build department filter
    const departmentFilter = departmentId ? { departmentId } : {};

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Optimized query execution with comprehensive aggregations
    const [
      caseStats,
      completionData,
      monthlyCaseStats,
      userStats,
      activeUsersCount,
      totalDepartments,
      overdueCasesCount
    ] = await Promise.all([
      // Main case statistics - optimized single aggregation
      prisma.case.groupBy({
        by: ['status', 'priority', 'currentStage'],
        where: {
          ...departmentFilter,
          deletedAt: null,
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        },
        _count: true,
      }),

      // Completion time data - optimized with minimal fields
      prisma.case.findMany({
        where: {
          ...departmentFilter,
          deletedAt: null,
          status: 'COMPLETADO',
          actualEndDate: { not: null },
          ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter })
        },
        select: {
          startDate: true,
          actualEndDate: true,
          expectedEndDate: true
        }
      }),

      // Monthly statistics - optimized aggregation using Prisma
      prisma.case.groupBy({
        by: ['createdAt'],
        where: {
          ...departmentFilter,
          deletedAt: null,
          createdAt: {
            gte: lastMonthStart
          }
        },
        _count: true,
      }).then(data => {
        // Group by month and count
        const monthlyData = data.reduce((acc: { [key: string]: number }, item) => {
          const month = item.createdAt.toISOString().substring(0, 7); // YYYY-MM
          acc[month] = (acc[month] || 0) + item._count
          return acc
        }, {})

        // Convert to array format and return last 2 months
        return Object.entries(monthlyData)
          .map(([month, count]) => ({ month, count: BigInt(count) }))
          .sort((a, b) => b.month.localeCompare(a.month))
          .slice(0, 2)
      }),

      // User statistics - optimized single query
      prisma.user.aggregate({
        where: {
          deletedAt: null,
          ...(departmentId && { departmentId }),
          isActive: true
        },
        _count: {
          id: true
        }
      }),

      // Active users query - optimized with date filter
      prisma.user.count({
        where: {
          deletedAt: null,
          isActive: true,
          lastLoginAt: {
            gte: thirtyDaysAgo
          },
          ...(departmentId && { departmentId })
        }
      }),

      // Total departments count
      prisma.department.count({
        where: { isActive: true }
      }),

      // Overdue cases count - optimized query
      prisma.case.count({
        where: {
          ...departmentFilter,
          deletedAt: null,
          status: { notIn: ['COMPLETADO', 'ARCHIVED', 'CANCELLED'] },
          expectedEndDate: { lt: now }
        }
      })
    ]);

    // Process monthly data from Prisma groupBy
    const monthlyData = monthlyCaseStats.reduce((acc, item) => {
      const monthDate = new Date(item.month + '-01');
      if (monthDate >= thisMonthStart) {
        acc.thisMonth += Number(item.count);
      } else {
        acc.lastMonth += Number(item.count);
      }
      return acc;
    }, { thisMonth: 0, lastMonth: 0 });

    // Process case statistics from aggregated data
    const stats: DashboardStats = {
      totalCases: caseStats.reduce((sum, item) => sum + item._count, 0),
      completedCases: caseStats.find(item => item.status === 'COMPLETADO')?._count || 0,
      pendingCases: caseStats.find(item => item.status === 'PENDIENTE')?._count || 0,
      inProgressCases: caseStats.find(item => item.status === 'EN_PROGRESO')?._count || 0,
      activeCases: caseStats
        .filter(item => !['COMPLETADO', 'ARCHIVED', 'SUSPENDED', 'CANCELLED'].includes(item.status))
        .reduce((sum, item) => sum + item._count, 0),
      overdueCases: overdueCasesCount,
      totalUsers: userStats._count.id,
      activeUsers: activeUsersCount,
      totalDepartments: totalDepartments,
      avgCompletionTime: 0,
      casesThisMonth: monthlyData.thisMonth,
      casesLastMonth: monthlyData.lastMonth,
      monthlyTrend: monthlyData.thisMonth - monthlyData.lastMonth,
      monthlyTrendPercent: monthlyData.lastMonth > 0
        ? ((monthlyData.thisMonth - monthlyData.lastMonth) / monthlyData.lastMonth) * 100
        : 0
    };

    // Calculate average completion time
    if (completionData.length > 0) {
      const totalDays = completionData.reduce((sum, case_) => {
        if (case_.actualEndDate && case_.startDate) {
          const days = Math.ceil(
            (new Date(case_.actualEndDate).getTime() - new Date(case_.startDate).getTime()) /
            (1000 * 60 * 60 * 24)
          );
          return sum + days;
        }
        return sum;
      }, 0);
      stats.avgCompletionTime = Math.round(totalDays / completionData.length);
    }

    // Create distributions from the same grouped data
    const priorityDistribution = caseStats.reduce((acc, item) => {
      const existing = acc.find(p => p.name === item.priority);
      if (existing) {
        existing.value += item._count;
      } else {
        acc.push({ name: item.priority, value: item._count });
      }
      return acc;
    }, [] as { name: string; value: number }[]);

    const statusDistribution = caseStats.reduce((acc, item) => {
      const existing = acc.find(s => s.name === item.status);
      if (existing) {
        existing.value += item._count;
      } else {
        acc.push({ name: item.status, value: item._count });
      }
      return acc;
    }, [] as { name: string; value: number }[]);

    const stageDistribution = caseStats
      .filter(item => !['COMPLETADO', 'ARCHIVED', 'CANCELLED'].includes(item.status))
      .reduce((acc, item) => {
        if (item.currentStage) {
          const existing = acc.find(s => s.name === item.currentStage);
          if (existing) {
            existing.value += item._count;
          } else {
            acc.push({ name: item.currentStage, value: item._count });
          }
        }
        return acc;
      }, [] as { name: string; value: number }[]);

    const statistics = {
      success: true,
      data: stats,
      distributions: {
        priority: priorityDistribution,
        status: statusDistribution,
        stage: stageDistribution
      }
    };

    return NextResponse.json(statistics);

    }, { departmentId, startDate, endDate }); // End of query tracking

  } catch (error) {
    logger.error('Error fetching dashboard statistics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch dashboard statistics' },
      { status: 500 }
    );
  }
}