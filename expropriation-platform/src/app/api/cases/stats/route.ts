import { logger } from '@/lib/logger';
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/cases/stats - Get case statistics
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user to check permissions
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        role: true,
        department: true
      }
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const role = user.role.name as string

    // Build where clause based on user permissions
    const where: {
      deletedAt: null;
      AND?: Array<{
        OR: Array<{ departmentId?: string; assignedToId?: string; supervisedById?: string; createdById?: string; }>;
      }>;
    } = {
      deletedAt: null
    }

    if (role !== 'super_admin') {
      // Non-super admins can only see stats from their department or assigned to them
      where.AND = [
        {
          OR: [
            { departmentId: user.departmentId },
            { assignedToId: user.id },
            { supervisedById: user.id },
            { createdById: user.id }
          ]
        }
      ]
    }

    // Get basic counts
    const [
      totalCases,
      pendingCases,
      inProgressCases,
      completedCases,
      suspendedCases,
      cancelledCases,
      archivedCases
    ] = await Promise.all([
      prisma.case.count({ where }),
      prisma.case.count({ where: { ...where, status: 'PENDIENTE' } }),
      prisma.case.count({ where: { ...where, status: 'EN_PROGRESO' } }),
      prisma.case.count({ where: { ...where, status: 'COMPLETADO' } }),
      prisma.case.count({ where: { ...where, status: 'SUSPENDED' } }),
      prisma.case.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.case.count({ where: { ...where, status: 'ARCHIVED' } })
    ])

    // Get cases by priority
    const priorityStats = await prisma.case.groupBy({
      by: ['priority'],
      where,
      _count: {
        priority: true
      }
    })

    // Get cases by current stage
    const stageStats = await prisma.case.groupBy({
      by: ['currentStage'],
      where,
      _count: {
        currentStage: true
      }
    })

    // Get cases by department (only for super admins)
    let departmentStats: Array<{
      departmentId: string;
      departmentName: string;
      departmentCode: string;
      count: number;
    }> = []
    if (role === 'super_admin') {
      const rawDepartmentStats = await prisma.case.groupBy({
        by: ['departmentId'],
        where,
        _count: {
          departmentId: true
        }
      })

      // Get department names
      const departments = await prisma.department.findMany({
        where: {
          id: { in: rawDepartmentStats.map(stat => stat.departmentId) }
        },
        select: {
          id: true,
          name: true,
          code: true
        }
      })

      departmentStats = rawDepartmentStats.map(stat => {
        const dept = departments.find(d => d.id === stat.departmentId)
        return {
          departmentId: stat.departmentId,
          departmentName: dept?.name || 'Unknown',
          departmentCode: dept?.code || 'Unknown',
          count: stat._count.departmentId
        }
      })
    }

    // Get cases created in last 30 days
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const recentCases = await prisma.case.count({
      where: {
        ...where,
        createdAt: {
          gte: thirtyDaysAgo
        }
      }
    })

    // Get cases completed in last 30 days
    const recentCompletions = await prisma.case.count({
      where: {
        ...where,
        actualEndDate: {
          gte: thirtyDaysAgo
        },
        status: 'COMPLETADO'
      }
    })

    
    // Get user's personal stats (cases assigned to, supervised by, created by)
    const userStats = await Promise.all([
      prisma.case.count({ where: { ...where, assignedToId: user.id } }),
      prisma.case.count({ where: { ...where, supervisedById: user.id } }),
      prisma.case.count({ where: { ...where, createdById: user.id } })
    ])

    // Get overdue cases (cases past expected end date and not completed)
    const overdueCases = await prisma.case.count({
      where: {
        ...where,
        expectedEndDate: {
          lt: new Date()
        },
        status: {
          notIn: ['COMPLETADO', 'CANCELLED', 'ARCHIVED']
        }
      }
    })

    return NextResponse.json({
      overview: {
        total: totalCases,
        pending: pendingCases,
        inProgress: inProgressCases,
        completed: completedCases,
        suspended: suspendedCases,
        cancelled: cancelledCases,
        archived: archivedCases,
        recent: recentCases,
        recentCompletions,
        overdue: overdueCases
      },
      priority: priorityStats.reduce((acc, stat) => {
        acc[stat.priority] = stat._count.priority
        return acc
      }, {} as Record<string, number>),
      stages: stageStats.reduce((acc, stat) => {
        acc[stat.currentStage] = stat._count.currentStage
        return acc
      }, {} as Record<string, number>),
      departments: departmentStats,
      user: {
        assigned: userStats[0],
        supervising: userStats[1],
        created: userStats[2]
      },
      completionRate: totalCases > 0 ? Math.round((completedCases / totalCases) * 100) : 0
    })
  } catch (error) {
    logger.error('Error fetching case statistics:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}