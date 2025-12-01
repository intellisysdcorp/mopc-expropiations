import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { logActivity } from '@/lib/activity-logger';
import bcrypt from 'bcryptjs';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';

// Schema for bulk operations
const bulkOperationSchema = z.object({
  userIds: z.array(z.string()).min(1, 'Se debe seleccionar al menos un usuario'),
  operation: z.enum([
    'ACTIVATE',
    'DEACTIVATE',
    'SUSPEND',
    'UNSUSPEND',
    'DELETE',
    'ASSIGN_ROLE',
    'ASSIGN_DEPARTMENT',
    'RESET_PASSWORD',
    'FORCE_LOGOUT',
  ]),
  data: z.object({
    roleId: z.string().optional(),
    departmentId: z.string().optional(),
    suspensionReason: z.string().optional(),
    reason: z.string().optional(),
  }).optional(),
});

// POST /api/users/bulk - Perform bulk operations on users
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Check permissions
    const currentUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { role: true },
    });

    const userPermissions = currentUser?.role?.permissions as any;
    if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
      return NextResponse.json(
        { error: 'No tienes permisos para realizar operaciones masivas' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { userIds, operation, data } = bulkOperationSchema.parse(body);

    // Validate users exist
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      include: {
        department: { select: { name: true } },
        role: { select: { name: true } },
      },
    });

    if (users.length !== userIds.length) {
      return NextResponse.json(
        { error: 'Algunos usuarios no fueron encontrados' },
        { status: 404 }
      );
    }

    // Prevent self-operations for certain operations
    const selfUserId = session.user.id;
    if (userIds.includes(selfUserId) && ['DELETE', 'SUSPEND', 'DEACTIVATE'].includes(operation)) {
      return NextResponse.json(
        { error: 'No puedes realizar esta operación sobre tu propia cuenta' },
        { status: 400 }
      );
    }

    const operationStartTime = new Date();
    let result: Prisma.BatchPayload;
    let tempPasswords: any[] | undefined;

    switch (operation) {
      case 'ACTIVATE':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: {
            isActive: true,
            isSuspended: false,
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
            lockedUntil: null,
          },
        });
        break;

      case 'DEACTIVATE':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: {
            isActive: false,
          },
        });
        break;

      case 'SUSPEND':
        if (!data?.suspensionReason) {
          return NextResponse.json(
            { error: 'Se debe proporcionar una razón para la suspensión' },
            { status: 400 }
          );
        }
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: {
            isSuspended: true,
            suspendedAt: operationStartTime,
            suspendedBy: selfUserId,
            suspensionReason: data.suspensionReason,
          },
        });
        break;

      case 'UNSUSPEND':
        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: {
            isSuspended: false,
            suspendedAt: null,
            suspendedBy: null,
            suspensionReason: null,
            lockedUntil: null,
          },
        });
        break;

      case 'DELETE':
        // Soft delete
        const deletePromises = userIds.map(async (userId) => {
          const user = users.find(u => u.id === userId);
          return prisma.user.update({
            where: { id: userId },
            data: {
              deletedAt: operationStartTime,
              deletedBy: selfUserId,
              isActive: false,
              email: `deleted_${Date.now()}_${user?.email}`,
              username: `deleted_${Date.now()}_${user?.username}`,
            },
          });
        });
        result = { count: (await Promise.all(deletePromises)).length };
        break;

      case 'ASSIGN_ROLE':
        if (!data?.roleId) {
          return NextResponse.json(
            { error: 'Se debe especificar un rol' },
            { status: 400 }
          );
        }

        // Validate role exists
        const role = await prisma.role.findUnique({
          where: { id: data.roleId },
        });

        if (!role) {
          return NextResponse.json(
            { error: 'Rol no encontrado' },
            { status: 404 }
          );
        }

        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { roleId: data.roleId },
        });
        break;

      case 'ASSIGN_DEPARTMENT':
        if (!data?.departmentId) {
          return NextResponse.json(
            { error: 'Se debe especificar un departamento' },
            { status: 400 }
          );
        }

        // Validate department exists
        const department = await prisma.department.findUnique({
          where: { id: data.departmentId },
        });

        if (!department) {
          return NextResponse.json(
            { error: 'Departamento no encontrado' },
            { status: 404 }
          );
        }

        result = await prisma.user.updateMany({
          where: { id: { in: userIds } },
          data: { departmentId: data.departmentId },
        });

        // Update department assignments
        await Promise.all(userIds.map(async (userId) => {
          // Deactivate existing primary assignment
          await prisma.userDepartmentAssignment.updateMany({
            where: {
              userId,
              isPrimary: true,
            },
            data: {
              isPrimary: false,
            },
          });

          // Create new primary assignment
          await prisma.userDepartmentAssignment.create({
            data: {
              userId,
              departmentId: data.departmentId!,
              isPrimary: true,
              assignedBy: selfUserId,
            },
          });
        }));
        break;

      case 'RESET_PASSWORD':
        // Generate temporary passwords
        const resetPromises = users.map(async (user) => {
          const tempPassword = Math.random().toString(36).slice(-8) + 'A1!';
          const tempPasswordHash = await bcrypt.hash(tempPassword, 12);

          await prisma.user.update({
            where: { id: user.id },
            data: {
              passwordHash: tempPasswordHash,
              passwordChangedAt: operationStartTime,
              mustChangePassword: true,
              passwordResetToken: null,
              passwordResetExpires: null,
            },
          });

          // Deactivate all sessions
          await prisma.userSession.updateMany({
            where: { userId: user.id },
            data: { isActive: false },
          });

          return { userId: user.id, tempPassword, email: user.email };
        });

        const resetResults = await Promise.all(resetPromises);
        result = { count: resetResults.length } as Prisma.BatchPayload;
        tempPasswords = resetResults;
        break;

      case 'FORCE_LOGOUT':
        result = await prisma.userSession.updateMany({
          where: { userId: { in: userIds }, isActive: true },
          data: { isActive: false },
        });
        break;

      default:
        return NextResponse.json(
          { error: 'Operación no válida' },
          { status: 400 }
        );
    }

    // Log bulk activity
    await logActivity({
      userId: session.user.id,
      action: 'BULK_OPERATION',
      entityType: 'user',
      entityId: 'bulk',
      description: `Operación masiva: ${operation} sobre ${userIds.length} usuarios`,
      metadata: {
        operation,
        userIds,
        affectedUsers: users.map(u => ({
          id: u.id,
          name: `${u.firstName} ${u.lastName}`,
          email: u.email,
        })),
        data,
        resultCount: result.count,
        performedAt: operationStartTime,
      },
    });

    // Prepare response
    const response: any = {
      message: `Operación ${operation} completada exitosamente`,
      affectedUsers: result.count,
      operation,
    };

    if (operation === 'RESET_PASSWORD' && tempPasswords) {
      response.tempPasswords = tempPasswords;
    }

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    logger.error('Error in bulk operation:', error);
    return NextResponse.json(
      { error: 'Error en operación masiva' },
      { status: 500 }
    );
  }
}