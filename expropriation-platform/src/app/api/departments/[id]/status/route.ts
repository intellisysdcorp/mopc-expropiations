import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Type definitions for department status updates
interface DepartmentStatusUpdate {
  isActive?: boolean;
}

interface ActivityMetadata {
  departmentName?: string;
  departmentCode?: string;
  changes?: string[];
  notes?: string;
  previousStatus?: {
    isActive: boolean;
  };
  newStatus?: {
    isActive: boolean;
  };
}

// Schema for status changes
const statusChangeSchema = z.object({
  isActive: z.boolean().optional(),
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

    const updateData: DepartmentStatusUpdate = {};
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
        notes: validatedData.notes,
        previousStatus: {
          isActive: department.isActive,
        },
        newStatus: {
          isActive: updatedDepartment.isActive,
        },
      },
    });

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
        { error: 'Datos inválidos', details: error.issues },
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
      select: { id: true, name: true, code: true, isActive: true },
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
      const metadata = activity.metadata as ActivityMetadata;
      return metadata?.previousStatus || metadata?.changes?.some((change: string) =>
        change.includes('Activado') || change.includes('Desactivado')
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