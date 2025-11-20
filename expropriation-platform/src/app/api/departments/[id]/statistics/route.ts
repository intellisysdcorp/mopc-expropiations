import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/departments/[id]/statistics - Get department statistics
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const departmentId = (await params).id;

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
      select: { id: true, name: true, code: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Get user statistics
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      userRoleDistribution,
      recentUserActivity,
    ] = await Promise.all([
      // Total users
      prisma.user.count({
        where: { departmentId, deletedAt: null },
      }),
      // Active users
      prisma.user.count({
        where: {
          departmentId,
          isActive: true,
          isSuspended: false,
          deletedAt: null
        },
      }),
      // Inactive users
      prisma.user.count({
        where: {
          departmentId,
          isActive: false,
          isSuspended: false,
          deletedAt: null
        },
      }),
      // Suspended users
      prisma.user.count({
        where: {
          departmentId,
          isSuspended: true,
          deletedAt: null
        },
      }),
      // User role distribution
      prisma.user.groupBy({
        by: ['roleId'],
        where: {
          departmentId,
          deletedAt: null
        },
        _count: { id: true },
      }),
      // Recent user activity (last 30 days)
      prisma.activity.count({
        where: {
          userId: {
            in: (
              await prisma.user.findMany({
                where: { departmentId, deletedAt: null },
                select: { id: true },
              })
            ).map(u => u.id),
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          },
        },
      }),
    ]);

    // Get case statistics
    const [
      totalCases,
      activeCases,
      completedCases,
      casesByStage,
      casesByPriority,
      averageCaseDuration,
      recentCaseActivity,
    ] = await Promise.all([
      // Total cases
      prisma.case.count({
        where: { departmentId },
      }),
      // Active cases
      prisma.case.count({
        where: {
          departmentId,
          status: 'ACTIVE'
        },
      }),
      // Completed cases
      prisma.case.count({
        where: {
          departmentId,
          status: 'COMPLETED'
        },
      }),
      // Cases by stage
      prisma.case.groupBy({
        by: ['currentStage'],
        where: { departmentId },
        _count: { id: true },
      }),
      // Cases by priority
      prisma.case.groupBy({
        by: ['priority'],
        where: { departmentId },
        _count: { id: true },
      }),
      // Average case duration (in days)
      prisma.$queryRaw`
        SELECT AVG(CAST(julianday(COALESCE(actualEndDate, datetime('now'))) - julianday(startDate) AS INTEGER)) as avgDuration
        FROM cases
        WHERE departmentId = ${departmentId}
        AND status IN ('COMPLETED', 'ARCHIVED')
      `,
      // Recent case activity (last 30 days)
      prisma.activity.count({
        where: {
          caseId: {
            in: (
              await prisma.case.findMany({
                where: { departmentId },
                select: { id: true },
              })
            ).map(c => c.id),
          },
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          },
        },
      }),
    ]);

    // Get role names for distribution
    const roleIds = userRoleDistribution.map(d => d.roleId);
    const roles = await prisma.role.findMany({
      where: { id: { in: roleIds } },
      select: { id: true, name: true },
    });
    const roleMap = new Map(roles.map(r => [r.id, r.name]));

    const roleDistribution = userRoleDistribution.map(d => ({
      roleId: d.roleId,
      roleName: roleMap.get(d.roleId) || 'Unknown',
      count: d._count.id,
    }));

    // Get stage assignments
    const stageAssignments = await prisma.departmentStageAssignment.findMany({
      where: {
        departmentId,
        isActive: true
      },
      include: {
        department: {
          select: { id: true, name: true },
        },
      },
    });

    // Get monthly trend data (last 12 months)
    const monthlyTrend = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        date.setDate(1);
        date.setHours(0, 0, 0, 0);

        const nextMonth = new Date(date);
        nextMonth.setMonth(nextMonth.getMonth() + 1);

        const [newUsers, newCases, completedCases] = await Promise.all([
          prisma.user.count({
            where: {
              departmentId,
              createdAt: {
                gte: date,
                lt: nextMonth,
              },
              deletedAt: null,
            },
          }),
          prisma.case.count({
            where: {
              departmentId,
              startDate: {
                gte: date,
                lt: nextMonth,
              },
            },
          }),
          prisma.case.count({
            where: {
              departmentId,
              actualEndDate: {
                gte: date,
                lt: nextMonth,
              },
              status: 'COMPLETED',
            },
          }),
        ]);

        return {
          month: date.toLocaleDateString('es-ES', { year: 'numeric', month: 'short' }),
          newUsers,
          newCases,
          completedCases,
        };
      })
    ).then(results => results.reverse());

    // Performance metrics
    const performanceMetrics = {
      userSatisfaction: 4.2, // Placeholder - would need survey data
      averageResolutionTime: typeof averageCaseDuration === 'object' && averageCaseDuration[0]?.avgDuration
        ? Math.round(Number(averageCaseDuration[0].avgDuration))
        : 0,
      caseCompletionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0,
      userUtilizationRate: totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
    };

    const statistics = {
      department: {
        id: department.id,
        name: department.name,
        code: department.code,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        inactive: inactiveUsers,
        suspended: suspendedUsers,
        roleDistribution,
        recentActivity: recentUserActivity,
      },
      cases: {
        total: totalCases,
        active: activeCases,
        completed: completedCases,
        byStage: casesByStage.map(d => ({ stage: d.currentStage, count: d._count.id })),
        byPriority: casesByPriority.map(d => ({ priority: d.priority, count: d._count.id })),
        recentActivity: recentCaseActivity,
      },
      workflow: {
        assignedStages: stageAssignments.map(sa => ({
          stage: sa.stage,
          assignedAt: sa.assignedAt,
        })),
      },
      performance: performanceMetrics,
      trends: monthlyTrend,
      generatedAt: new Date().toISOString(),
    };

    return NextResponse.json(statistics);
  } catch (error) {
    logger.error('Error fetching department statistics:', error);
    return NextResponse.json(
      { error: 'Error al obtener estadísticas del departamento' },
      { status: 500 }
    );
  }
}