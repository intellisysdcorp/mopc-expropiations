import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { logActivity } from '@/lib/activity-logger';
import type { Prisma } from '@/prisma/client';

// GET /api/users/[id] - Get a specific user
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        role: {
          select: { id: true, name: true, description: true },
        },
        departmentAssignments: {
          include: {
            department: {
              select: { id: true, name: true, code: true },
            },
          },
        },
        sessions: {
          where: { isActive: true },
          orderBy: { lastAccessAt: 'desc' },
          take: 5,
        },
        _count: {
          select: {
            createdCases: true,
            assignedCases: true,
            supervisedCases: true,
            activities: true,
            documents: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Remove sensitive data
    const sanitizedUser = removeSensitiveData(user);

    return NextResponse.json(sanitizedUser);
  } catch (error) {
    logger.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Error al obtener usuario' },
      { status: 500 }
    );
  }
}

// PUT /api/users/[id] - Update a user
export async function PUT(
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

    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        role: true,
      },
    });

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Check if email or username already exists (for other users)
    if (body.email || body.username) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                body.email ? { email: body.email } : {},
                body.username ? { username: body.username } : {},
              ].filter((condition) => Object.keys(condition).length > 0),
            },
          ],
        },
      });

      if (duplicateUser) {
        return NextResponse.json(
          { error: 'El correo electrónico o nombre de usuario ya existe' },
          { status: 400 }
        );
      }
    }

    // Validate department and role if they're being updated
    if (body.departmentId || body.roleId) {
      const [department, role] = await Promise.all([
        body.departmentId
          ? prisma.department.findUnique({
              where: { id: body.departmentId },
            })
          : Promise.resolve(existingUser.department),
        body.roleId
          ? prisma.role.findUnique({
              where: { id: body.roleId },
            })
          : Promise.resolve(existingUser.role),
      ]);

      if (body.departmentId && !department) {
        return NextResponse.json(
          { error: 'Departamento no encontrado' },
          { status: 400 }
        );
      }

      if (body.roleId && !role) {
        return NextResponse.json(
          { error: 'Rol no encontrado' },
          { status: 400 }
        );
      }
    }

    // Handle suspension logic
    const updateData: Prisma.UserUpdateInput = { ...body };

    if (body.isSuspended && !existingUser.isSuspended) {
      updateData.suspendedAt = new Date();
      updateData.suspendedBy = session.user.id;
    } else if (!body.isSuspended && existingUser.isSuspended) {
      updateData.suspendedAt = null;
      updateData.suspendedBy = null;
      updateData.suspensionReason = null;
      updateData.lockedUntil = null;
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        department: {
          select: { id: true, name: true, code: true },
        },
        role: {
          select: { id: true, name: true, description: true },
        },
      },
    });

    // Update primary department assignment if department changed
    if (body.departmentId && body.departmentId !== existingUser.departmentId) {
      await prisma.userDepartmentAssignment.updateMany({
        where: {
          userId: id,
          isPrimary: true,
        },
        data: {
          isPrimary: false,
        },
      });

      await prisma.userDepartmentAssignment.create({
        data: {
          userId: id,
          departmentId: body.departmentId,
          isPrimary: true,
          assignedBy: session.user.id,
        },
      });
    }

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'UPDATED',
      entityType: 'user',
      entityId: id,
      description: `Usuario actualizado: ${updatedUser.firstName} ${updatedUser.lastName}`,
      metadata: {
        userName: `${updatedUser.firstName} ${updatedUser.lastName}`,
        changes: body,
      },
    });

    // Remove sensitive data
    const sanitizedUser = removeSensitiveData(updatedUser);

    return NextResponse.json(sanitizedUser);
  } catch (error) {

    logger.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete a user
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

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

    // Prevent self-deletion
    if (id === session.user.id) {
      return NextResponse.json(
        { error: 'No puedes eliminar tu propia cuenta' },
        { status: 400 }
      );
    }

    // Soft delete user
    await prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: session.user.id,
        isActive: false,
        email: `deleted_${Date.now()}_${user.email}`,
        username: `deleted_${Date.now()}_${user.username}`,
      },
    });

    // Deactivate all sessions
    await prisma.userSession.updateMany({
      where: { userId: id },
      data: { isActive: false },
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: 'DELETED',
      entityType: 'user',
      entityId: id,
      description: `Usuario eliminado: ${user.firstName} ${user.lastName}`,
      metadata: {
        userName: `${user.firstName} ${user.lastName}`,
        email: user.email,
      },
    });

    return NextResponse.json({ message: 'Usuario eliminado correctamente' });
  } catch (error) {
    logger.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Error al eliminar usuario' },
      { status: 500 }
    );
  }
}

/**
 * Remove sensitive user data for server response
 */
function removeSensitiveData (userObject: {
  [key: string]: unknown;
  passwordHash?: string;
  twoFactorSecret?: string | null;
  backupCodes?: string | null;
}) {
  const { passwordHash: _1, twoFactorSecret: _2, backupCodes: _3, ...sanitizedUser } = userObject;
  return sanitizedUser;
}