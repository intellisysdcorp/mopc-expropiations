import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import { URLParams } from '@/types';

// DELETE /api/users/[id]/departments/[assignmentId] - Remove department assignment
export async function DELETE(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, assignmentId } = await params;

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    const userPermissions = currentUser?.role?.permissions as any;
    if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
      return NextResponse.json(
        { error: 'No tienes permisos para remover asignaciones' },
        { status: 403 }
      );
    }

    // Get assignment details
    const assignment = await prisma.userDepartmentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    // Prevent removing primary assignment if it's the only one
    if (assignment.isPrimary) {
      const totalAssignments = await prisma.userDepartmentAssignment.count({
        where: { userId: id },
      });

      if (totalAssignments === 1) {
        return NextResponse.json(
          { error: 'No puedes remover la única asignación principal del usuario' },
          { status: 400 }
        );
      }
    }

    // Delete assignment
    await prisma.userDepartmentAssignment.delete({
      where: { id: assignmentId },
    });

    // If this was the primary assignment, set another one as primary
    if (assignment.isPrimary) {
      const remainingAssignment = await prisma.userDepartmentAssignment.findFirst({
        where: { userId: id },
        orderBy: { assignedAt: 'asc' },
      });

      if (remainingAssignment) {
        await prisma.userDepartmentAssignment.update({
          where: { id: remainingAssignment.id },
          data: { isPrimary: true },
        });
      }
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'REMOVED',
      entityType: 'user_department',
      entityId: assignmentId,
      description: `Asignación removida: ${assignment.department.name} de ${assignment.user.firstName} ${assignment.user.lastName}`,
      metadata: {
        targetUserId: id,
        targetUserName: `${assignment.user.firstName} ${assignment.user.lastName}`,
        departmentId: assignment.departmentId,
        departmentName: assignment.department.name,
        wasPrimary: assignment.isPrimary,
      },
    });

    return NextResponse.json({ message: 'Asignación removida correctamente' });
  } catch (error) {
    logger.error('Error removing department assignment:', error);
    return NextResponse.json(
      { error: 'Error al remover asignación' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id]/departments/[assignmentId]/primary - Set as primary department
export async function PUT(
  _request: NextRequest,
  { params }: URLParams
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id, assignmentId } = await params;

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    const userPermissions = currentUser?.role?.permissions as any;
    if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
      return NextResponse.json(
        { error: 'No tienes permisos para cambiar asignaciones principales' },
        { status: 403 }
      );
    }

    // Get assignment details
    const assignment = await prisma.userDepartmentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        user: { select: { firstName: true, lastName: true } },
        department: { select: { name: true } },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        { error: 'Asignación no encontrada' },
        { status: 404 }
      );
    }

    // Check if it's already primary
    if (assignment.isPrimary) {
      return NextResponse.json(
        { error: 'Esta asignación ya es la principal' },
        { status: 400 }
      );
    }

    // Update all assignments to non-primary
    await prisma.userDepartmentAssignment.updateMany({
      where: { userId: id },
      data: { isPrimary: false },
    });

    // Set this assignment as primary
    await prisma.userDepartmentAssignment.update({
      where: { id: assignmentId },
      data: { isPrimary: true },
    });

    // Also update the user's main departmentId
    await prisma.user.update({
      where: { id },
      data: { departmentId: assignment.departmentId },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'user_department',
      entityId: assignmentId,
      description: `Departamento principal cambiado: ${assignment.department.name} para ${assignment.user.firstName} ${assignment.user.lastName}`,
      metadata: {
        targetUserId: id,
        targetUserName: `${assignment.user.firstName} ${assignment.user.lastName}`,
        departmentId: assignment.departmentId,
        departmentName: assignment.department.name,
      },
    });

    return NextResponse.json({ message: 'Departamento principal actualizado correctamente' });
  } catch (error) {
    logger.error('Error updating primary department:', error);
    return NextResponse.json(
      { error: 'Error al actualizar departamento principal' },
      { status: 500 }
    );
  }
}