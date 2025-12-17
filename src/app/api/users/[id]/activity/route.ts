import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';

// GET /api/users/[id]/activity - Get user activity history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const activityType = searchParams.get('type');
    const entityType = searchParams.get('entityType');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Check if user has permission to view activity
    if (id !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const userPermissions = currentUser?.role?.permissions as any;
      if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
        return NextResponse.json(
          { error: 'No tienes permisos para ver el historial de actividad de este usuario' },
          { status: 403 }
        );
      }
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Build where clause
    const where: any = { userId: id };

    if (activityType) {
      where.action = activityType;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    // Get total count
    const total = await prisma.activity.count({ where });

    // Get activities
    const activities = await prisma.activity.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        case: {
          select: {
            id: true,
            fileNumber: true,
            title: true,
          },
        },
      },
    });

    // Format activities
    const formattedActivities = activities.map((activity) => ({
      id: activity.id,
      action: activity.action,
      entityType: activity.entityType,
      entityId: activity.entityId,
      description: activity.description,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
      case: activity.case,
    }));

    // Get activity statistics
    const [actionStats, entityTypeStats, recentLoginActivity] = await Promise.all([
      prisma.activity.groupBy({
        by: ['action'],
        where: {
          userId: id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        _count: {
          action: true,
        },
        orderBy: {
          _count: {
            action: 'desc',
          },
        },
        take: 10,
      }),
      prisma.activity.groupBy({
        by: ['entityType'],
        where: {
          userId: id,
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
          },
        },
        _count: {
          entityType: true,
        },
        orderBy: {
          _count: {
            entityType: 'desc',
          },
        },
        take: 10,
      }),
      prisma.activity.findMany({
        where: {
          userId: id,
          action: { in: ['LOGIN', 'LOGOUT'] },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          action: true,
          createdAt: true,
          metadata: true,
        },
      }),
    ]);

    // Get password history
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId: id },
      orderBy: { changedAt: 'desc' },
      take: 10,
      select: {
        changedAt: true,
        changeReason: true,
        ipAddress: true,
      },
    });

    // Get failed login attempts
    const failedLogins = await prisma.user.findUnique({
      where: { id },
      select: {
        failedLoginAttempts: true,
        lockedUntil: true,
        lastLoginAt: true,
        lastLoginIp: true,
      },
    });

    return NextResponse.json({
      user,
      activities: formattedActivities,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      statistics: {
        actionStats,
        entityTypeStats,
        recentLoginActivity,
        passwordHistory,
        securityInfo: failedLogins,
      },
    });
  } catch (error) {
    logger.error('Error fetching user activity:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de actividad' },
      { status: 500 }
    );
  }
}