import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Schema for user updates
const updateUserSchema = z.object({
  email: z.string().email('Correo electrónico inválido').optional(),
  username: z.string().min(3, 'El nombre de usuario debe tener al menos 3 caracteres').optional(),
  firstName: z.string().min(1, 'El nombre es requerido').optional(),
  lastName: z.string().min(1, 'El apellido es requerido').optional(),
  phone: z.string().optional(),
  departmentId: z.string().min(1, 'El departamento es requerido').optional(),
  roleId: z.string().min(1, 'El rol es requerido').optional(),
  jobTitle: z.string().optional(),
  bio: z.string().optional(),
  officeLocation: z.string().optional(),
  workingHours: z.string().optional(),
  preferredLanguage: z.string().optional(),
  timezone: z.string().optional(),
  emailNotifications: z.boolean().optional(),
  emailMarketing: z.boolean().optional(),
  emailDigest: z.boolean().optional(),
  theme: z.string().optional(),
  dateRange: z.string().optional(),
  dashboardConfig: z.string().optional(),
  isActive: z.boolean().optional(),
  isSuspended: z.boolean().optional(),
  suspensionReason: z.string().optional(),
  twoFactorEnabled: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
});

// GET /api/users/[id] - Get a specific user
export async function GET(
  request: NextRequest,
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
    const { passwordHash, twoFactorSecret, backupCodes, ...sanitizedUser } = user;

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
  const { id } = await params;
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

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
    if (validatedData.email || validatedData.username) {
      const duplicateUser = await prisma.user.findFirst({
        where: {
          AND: [
            { id: { not: id } },
            {
              OR: [
                validatedData.email ? { email: validatedData.email } : {},
                validatedData.username ? { username: validatedData.username } : {},
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
    if (validatedData.departmentId || validatedData.roleId) {
      const [department, role] = await Promise.all([
        validatedData.departmentId
          ? prisma.department.findUnique({
              where: { id: validatedData.departmentId },
            })
          : Promise.resolve(existingUser.department),
        validatedData.roleId
          ? prisma.role.findUnique({
              where: { id: validatedData.roleId },
            })
          : Promise.resolve(existingUser.role),
      ]);

      if (validatedData.departmentId && !department) {
        return NextResponse.json(
          { error: 'Departamento no encontrado' },
          { status: 400 }
        );
      }

      if (validatedData.roleId && !role) {
        return NextResponse.json(
          { error: 'Rol no encontrado' },
          { status: 400 }
        );
      }
    }

    // Handle suspension logic
    const updateData: any = { ...validatedData };

    if (validatedData.isSuspended && !existingUser.isSuspended) {
      updateData.suspendedAt = new Date();
      updateData.suspendedBy = session.user.id;
    } else if (!validatedData.isSuspended && existingUser.isSuspended) {
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
    if (validatedData.departmentId && validatedData.departmentId !== existingUser.departmentId) {
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
          departmentId: validatedData.departmentId,
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
        changes: validatedData,
      },
    });

    // Remove sensitive data
    const { passwordHash, twoFactorSecret, backupCodes, ...sanitizedUser } = updatedUser;

    return NextResponse.json(sanitizedUser);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Error al actualizar usuario' },
      { status: 500 }
    );
  }
}

// DELETE /api/users/[id] - Soft delete a user
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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