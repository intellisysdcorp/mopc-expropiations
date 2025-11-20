import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Schema for status changes
const statusChangeSchema = z.object({
  isActive: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspensionReason: z.string().optional(),
  notes: z.string().optional(),
});

// PATCH /api/departments/[id]/status - Update department status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check if user has permission to manage departments
    const userPermissions = session.user.permissions as Record<string, boolean>;
    if (!userPermissions?.canManageDepartments && !userPermissions?.canManageUsers) {
      return NextResponse.json(
        { error: 'No tiene permisos para cambiar el estado de departamentos' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validatedData = statusChangeSchema.parse(body);

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: (await params).id },
      include: {
        _count: {
          select: {
            users: {
              where: { isActive: true, deletedAt: null },
            },
            cases: true,
          },
        },
      },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    const updateData: any = {};
    const activityChanges: string[] = [];

    // Handle active status change
    if (validatedData.isActive !== undefined && validatedData.isActive !== department.isActive) {
      if (validatedData.isActive === false && department._count.users > 0) {
        return NextResponse.json(
          { error: 'No se puede desactivar un departamento con usuarios activos' },
          { status: 400 }
        );
      }

      if (validatedData.isActive === false && department._count.cases > 0) {
        return NextResponse.json(
          { error: 'No se puede desactivar un departamento con casos activos' },
          { status: 400 }
        );
      }

      updateData.isActive = validatedData.isActive;
      activityChanges.push(validatedData.isActive ? 'Activado' : 'Desactivado');
    }

    // Handle suspension status change
    if (validatedData.isSuspended !== undefined && validatedData.isSuspended !== department.isSuspended) {
      if (validatedData.isSuspended === true) {
        if (!validatedData.suspensionReason) {
          return NextResponse.json(
            { error: 'Se requiere una razón para la suspensión' },
            { status: 400 }
          );
        }

        updateData.isSuspended = true;
        updateData.suspensionReason = validatedData.suspensionReason;
        updateData.suspendedAt = new Date();
        updateData.suspendedBy = session.user.id;
        activityChanges.push(`Suspendido: ${validatedData.suspensionReason}`);
      } else {
        updateData.isSuspended = false;
        updateData.suspensionReason = null;
        updateData.suspendedAt = null;
        updateData.suspendedBy = null;
        activityChanges.push('Reactivado');
      }
    }

    // If no changes to make
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No hay cambios que realizar' },
        { status: 400 }
      );
    }

    // Update department status
    const updatedDepartment = await prisma.department.update({
      where: { id: (await params).id },
      data: updateData,
      include: {
        parent: {
          select: { id: true, name: true, code: true },
        },
        headUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        _count: {
          select: {
            users: true,
            cases: true,
            children: true,
          },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: (await params).id,
      description: `Estado del departamento actualizado: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        changes: activityChanges,
        reason: validatedData.suspensionReason,
        notes: validatedData.notes,
        previousStatus: {
          isActive: department.isActive,
          isSuspended: department.isSuspended,
        },
        newStatus: {
          isActive: updatedDepartment.isActive,
          isSuspended: updatedDepartment.isSuspended,
        },
      },
    });

    // If department is being suspended, suspend all active users
    if (validatedData.isSuspended === true) {
      await prisma.user.updateMany({
        where: {
          departmentId: (await params).id,
          isActive: true,
          isSuspended: false,
        },
        data: {
          isSuspended: true,
          suspensionReason: `Suspensión automática por suspensión del departamento: ${validatedData.suspensionReason}`,
          suspendedAt: new Date(),
          suspendedBy: session.user.id,
        },
      });

      // Log suspension for affected users
      const affectedUsers = await prisma.user.findMany({
        where: {
          departmentId: (await params).id,
          isActive: true,
        },
        select: { id: true, firstName: true, lastName: true },
      });

      await Promise.all(
        affectedUsers.map(user =>
          logActivity({
            userId: session.user.id,
            action: 'SUSPENDED',
            entityType: 'user',
            entityId: user.id,
            description: `Usuario suspendido automáticamente: ${user.firstName} ${user.lastName}`,
            metadata: {
              userName: `${user.firstName} ${user.lastName}`,
              reason: `Suspensión automática por suspensión del departamento: ${validatedData.suspensionReason}`,
              departmentSuspension: true,
            },
          })
        )
      );
    }

    // If department is being reactivated, reactivate suspended users (if they were suspended due to department suspension)
    if (validatedData.isSuspended === false && department.isSuspended === true) {
      await prisma.user.updateMany({
        where: {
          departmentId: (await params).id,
          isSuspended: true,
          suspensionReason: {
            contains: 'Suspensión automática por suspensión del departamento',
          },
        },
        data: {
          isSuspended: false,
          suspensionReason: null,
          suspendedAt: null,
          suspendedBy: null,
        },
      });
    }

    // Return formatted response
    const sanitizedDepartment = {
      ...updatedDepartment,
      userCount: updatedDepartment._count.users,
      caseCount: updatedDepartment._count.cases,
      childCount: updatedDepartment._count.children,
      _count: undefined,
    };

    return NextResponse.json({
      department: sanitizedDepartment,
      message: `Estado del departamento actualizado: ${activityChanges.join(', ')}`,
      changes: activityChanges,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating department status:', error);
    return NextResponse.json(
      { error: 'Error al actualizar estado del departamento' },
      { status: 500 }
    );
  }
}

// GET /api/departments/[id]/status - Get department status history
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: (await params).id },
      select: { id: true, name: true, code: true, isActive: true, isSuspended: true },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    const activities = await prisma.activity.findMany({
      where: {
        entityType: 'department',
        entityId: (await params).id,
        action: 'UPDATED',
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Filter activities related to status changes
    const statusActivities = activities.filter(activity => {
      const metadata = activity.metadata as any;
      return metadata?.previousStatus || metadata?.changes?.some((change: string) =>
        change.includes('Activado') || change.includes('Desactivado') ||
        change.includes('Suspendido') || change.includes('Reactivado')
      );
    });

    return NextResponse.json({
      department,
      statusHistory: statusActivities.map(activity => ({
        id: activity.id,
        action: activity.action,
        description: activity.description,
        metadata: activity.metadata,
        createdAt: activity.createdAt,
        user: activity.user,
      })),
      pagination: {
        page,
        limit,
        total: statusActivities.length,
        pages: Math.ceil(statusActivities.length / limit),
      },
    });
  } catch (error) {
    logger.error('Error fetching department status history:', error);
    return NextResponse.json(
      { error: 'Error al obtener historial de estado del departamento' },
      { status: 500 }
    );
  }
}