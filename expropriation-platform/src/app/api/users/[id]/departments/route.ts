import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// GET /api/users/[id]/departments - Get user department assignments
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

    // Check permissions
    if (id !== session.user.id) {
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const userPermissions = currentUser?.role?.permissions as any;
      if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
        return NextResponse.json(
          { error: 'No tienes permisos para ver las asignaciones de este usuario' },
          { status: 403 }
        );
      }
    }

    const assignments = await prisma.userDepartmentAssignment.findMany({
      where: { userId: id },
      include: {
        department: {
          select: { id: true, name: true, code: true, parentId: true },
        },
      },
      orderBy: [
        { isPrimary: 'desc' },
        { assignedAt: 'desc' },
      ],
    });

    return NextResponse.json(assignments);
  } catch (error) {
    logger.error('Error fetching department assignments:', error);
    return NextResponse.json(
      { error: 'Error al obtener asignaciones de departamento' },
      { status: 500 }
    );
  }
}

// POST /api/users/[id]/departments - Assign department to user
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { departmentId, isPrimary = false } = body;

    if (!departmentId) {
      return NextResponse.json(
        { error: 'El departamento es requerido' },
        { status: 400 }
      );
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    const userPermissions = currentUser?.role?.permissions as any;
    if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
      return NextResponse.json(
        { error: 'No tienes permisos para asignar departamentos' },
        { status: 403 }
      );
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Check if department exists
    const department = await prisma.department.findUnique({
      where: { id: departmentId },
    });

    if (!department) {
      return NextResponse.json(
        { error: 'Departamento no encontrado' },
        { status: 404 }
      );
    }

    // Check if assignment already exists
    const existingAssignment = await prisma.userDepartmentAssignment.findUnique({
      where: {
        userId_departmentId: {
          userId: id,
          departmentId,
        },
      },
    });

    if (existingAssignment) {
      return NextResponse.json(
        { error: 'El usuario ya está asignado a este departamento' },
        { status: 400 }
      );
    }

    // If setting as primary, update all existing assignments to non-primary
    if (isPrimary) {
      await prisma.userDepartmentAssignment.updateMany({
        where: { userId: id },
        data: { isPrimary: false },
      });
    }

    // Create assignment
    const assignment = await prisma.userDepartmentAssignment.create({
      data: {
        userId: id,
        departmentId,
        isPrimary,
        assignedBy: session.user.id,
      },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'ASSIGNED',
      entityType: 'user_department',
      entityId: assignment.id,
      description: `Departamento asignado: ${department.name} a ${user.firstName} ${user.lastName}`,
      metadata: {
        targetUserId: id,
        targetUserName: `${user.firstName} ${user.lastName}`,
        departmentId,
        departmentName: department.name,
        isPrimary,
      },
    });

    return NextResponse.json(assignment, { status: 201 });
  } catch (error) {
    logger.error('Error assigning department:', error);
    return NextResponse.json(
      { error: 'Error al asignar departamento' },
      { status: 500 }
    );
  }
}