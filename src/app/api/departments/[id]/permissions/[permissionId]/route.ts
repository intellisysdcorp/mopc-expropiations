import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Schema for permission update
const permissionUpdateSchema = z.object({
  isGranted: z.boolean().optional(),
  expiresAt: z.iso.datetime().optional(),
});

// PUT /api/departments/[id]/permissions/[permissionId] - Update specific permission
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: departmentId, permissionId } = await params;
    const body = await request.json();
    const { isGranted, expiresAt } = permissionUpdateSchema.parse(body);

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

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return NextResponse.json(
        { error: 'Permiso no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.departmentPermission.findUnique({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Asignación de permiso no encontrada' },
        { status: 404 }
      );
    }

    // Update assignment
    const assignment = await prisma.departmentPermission.update({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
      data: {
        isGranted: isGranted !== undefined ? isGranted : existingAssignment.isGranted,
        expiresAt: expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : existingAssignment.expiresAt,
        assignedBy: session.user.id,
      },
      include: {
        permission: true,
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'department',
      entityId: departmentId,
      description: `Permiso actualizado para el departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        permission: {
          id: permission.id,
          name: permission.name,
          type: permission.type,
        },
        previousState: {
          isGranted: existingAssignment.isGranted,
          expiresAt: existingAssignment.expiresAt,
        },
        newState: {
          isGranted: assignment.isGranted,
          expiresAt: assignment.expiresAt,
        },
      },
    });

    return NextResponse.json({
      message: `Permiso ${permission.name} actualizado correctamente`,
      assignment: {
        id: assignment.id,
        permission: assignment.permission,
        isGranted: assignment.isGranted,
        expiresAt: assignment.expiresAt,
        assignedAt: assignment.assignedAt,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error updating department permission:', error);
    return NextResponse.json(
      { error: 'Error al actualizar permiso del departamento' },
      { status: 500 }
    );
  }
}

// DELETE /api/departments/[id]/permissions/[permissionId] - Remove permission assignment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id: departmentId, permissionId } = await params;

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

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
    });

    if (!permission) {
      return NextResponse.json(
        { error: 'Permiso no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment exists
    const existingAssignment = await prisma.departmentPermission.findUnique({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
    });

    if (!existingAssignment) {
      return NextResponse.json(
        { error: 'Asignación de permiso no encontrada' },
        { status: 404 }
      );
    }

    // Delete assignment
    await prisma.departmentPermission.delete({
      where: {
        departmentId_permissionId: {
          departmentId,
          permissionId,
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'department',
      entityId: departmentId,
      description: `Permiso eliminado del departamento: ${department.name}`,
      metadata: {
        departmentName: department.name,
        departmentCode: department.code,
        permission: {
          id: permission.id,
          name: permission.name,
          type: permission.type,
        },
        previousAssignment: existingAssignment,
      },
    });

    return NextResponse.json({
      message: `Permiso ${permission.name} eliminado correctamente`,
    });
  } catch (error) {
    logger.error('Error removing department permission:', error);
    return NextResponse.json(
      { error: 'Error al eliminar permiso del departamento' },
      { status: 500 }
    );
  }
}
