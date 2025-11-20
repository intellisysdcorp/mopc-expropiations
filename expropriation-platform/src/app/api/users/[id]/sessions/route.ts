import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// GET /api/users/[id]/sessions - Get user sessions
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
    const activeOnly = searchParams.get('activeOnly') === 'true';

    // Check if user has permission to view sessions
    if (id !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const userPermissions = currentUser?.role?.permissions as any;
      if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
        return NextResponse.json(
          { error: 'No tienes permisos para ver las sesiones de este usuario' },
          { status: 403 }
        );
      }
    }

    const where: any = { userId: id };
    if (activeOnly) {
      where.isActive = true;
      where.expiresAt = { gt: new Date() };
    }

    const sessions = await prisma.userSession.findMany({
      where,
      orderBy: { lastAccessAt: 'desc' },
      take: 50,
    });

    // Format sessions for display
    const formattedSessions = sessions.map((session) => ({
      id: session.id,
      sessionToken: session.sessionToken,
      isActive: session.isActive,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      lastAccessAt: session.lastAccessAt,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      deviceInfo: session.deviceInfo ? JSON.parse(session.deviceInfo) : null,
      isCurrent: session.sessionToken === session.sessionToken,
    }));

    return NextResponse.json(formattedSessions);
  } catch (error) {
    logger.error('Error fetching sessions:', error);
    return NextResponse.json(
      { error: 'Error al obtener sesiones' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id]/sessions - Terminate all user sessions
export async function DELETE(
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
    const sessionId = searchParams.get('sessionId');
    const exceptCurrent = searchParams.get('exceptCurrent') === 'true';

    // Check if user has permission to terminate sessions
    if (id !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const userPermissions = currentUser?.role?.permissions as any;
      if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
        return NextResponse.json(
          { error: 'No tienes permisos para terminar las sesiones de este usuario' },
          { status: 403 }
        );
      }
    }

    let result;

    if (sessionId) {
      // Terminate specific session
      const targetSession = await prisma.userSession.findUnique({
        where: { id: sessionId },
      });

      if (!targetSession || targetSession.userId !== id) {
        return NextResponse.json(
          { error: 'Sesión no encontrada' },
          { status: 404 }
        );
      }

      await prisma.userSession.update({
        where: { id: sessionId },
        data: { isActive: false },
      });

      result = { message: 'Sesión terminada correctamente', terminatedSessions: 1 };
    } else {
      // Terminate all or all except current session
      const whereClause: any = { userId: id, isActive: true };

      if (exceptCurrent && id === session.user.id) {
        whereClause.sessionToken = { not: session.sessionToken };
      }

      const terminatedCount = await prisma.userSession.updateMany({
        where: whereClause,
        data: { isActive: false },
      });

      result = {
        message: exceptCurrent
          ? 'Sesiones terminadas correctamente (excepto la actual)'
          : 'Todas las sesiones terminadas correctamente',
        terminatedSessions: terminatedCount.count,
      };
    }

    // Get user details for logging
    const user = await prisma.user.findUnique({
      where: { id },
      select: { firstName: true, lastName: true },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'TERMINATED_SESSIONS',
      entityType: 'user',
      entityId: id,
      description: sessionId
        ? `Sesión terminada: ${user?.firstName} ${user?.lastName}`
        : `Sesiones terminadas: ${user?.firstName} ${user?.lastName}`,
      metadata: {
        targetUserId: id,
        targetUserName: `${user?.firstName} ${user?.lastName}`,
        sessionId: sessionId || undefined,
        exceptCurrent: exceptCurrent || undefined,
        terminatedCount: result.terminatedSessions,
      },
    });

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error terminating sessions:', error);
    return NextResponse.json(
      { error: 'Error al terminar sesiones' },
      { status: 500 }
    );
  }
}