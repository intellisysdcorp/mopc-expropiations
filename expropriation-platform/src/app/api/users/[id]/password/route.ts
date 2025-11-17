import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';

// Schema for password change
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
});

// Schema for admin password reset
const resetPasswordSchema = z.object({
  newPassword: z.string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
           'La contraseña debe contener al menos una mayúscula, una minúscula, un número y un carácter especial'),
  reason: z.string().optional(),
  forceChange: z.boolean().default(false),
});

// PUT /api/users/[id]/password - Change user password
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
    const isOwnPassword = id === session.user.id;

    let validatedData;

    if (isOwnPassword) {
      // User changing their own password
      validatedData = changePasswordSchema.parse(body);
    } else {
      // Admin resetting user password
      validatedData = resetPasswordSchema.parse(body);

      // Check if user has permission to reset passwords
      const currentUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        include: { role: true },
      });

      const userPermissions = currentUser?.role?.permissions as any;
      if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
        return NextResponse.json(
          { error: 'No tienes permisos para resetear contraseñas' },
          { status: 403 }
        );
      }
    }

    // Get target user
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // For self password change, verify current password
    if (isOwnPassword) {
      const isCurrentPasswordValid = await bcrypt.compare(
        validatedData.currentPassword,
        user.passwordHash
      );

      if (!isCurrentPasswordValid) {
        return NextResponse.json(
          { error: 'La contraseña actual es incorrecta' },
          { status: 400 }
        );
      }
    }

    // Check if new password is the same as current
    const isSamePassword = await bcrypt.compare(
      validatedData.newPassword,
      user.passwordHash
    );

    if (isSamePassword) {
      return NextResponse.json(
        { error: 'La nueva contraseña no puede ser igual a la actual' },
        { status: 400 }
      );
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(validatedData.newPassword, 12);

    // Get current password history to prevent reuse
    const passwordHistory = await prisma.passwordHistory.findMany({
      where: { userId: id },
      orderBy: { changedAt: 'desc' },
      take: 5, // Check last 5 passwords
    });

    // Check if new password was used before
    for (const historyEntry of passwordHistory) {
      const isReusedPassword = await bcrypt.compare(
        validatedData.newPassword,
        historyEntry.passwordHash
      );

      if (isReusedPassword) {
        return NextResponse.json(
          { error: 'Esta contraseña ya fue utilizada recientemente. Por favor, elige otra.' },
          { status: 400 }
        );
      }
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // Store current password in history
      await tx.passwordHistory.create({
        data: {
          userId: id,
          passwordHash: user.passwordHash,
          changedBy: isOwnPassword ? id : session.user.id,
          changeReason: isOwnPassword ? 'user_change' : 'admin_reset',
          ipAddress: request.headers.get('x-forwarded-for') || request.ip,
          userAgent: request.headers.get('user-agent'),
        },
      });

      // Update user password
      await tx.user.update({
        where: { id },
        data: {
          passwordHash: newPasswordHash,
          passwordChangedAt: new Date(),
          mustChangePassword: !isOwnPassword ? validatedData.forceChange : false,
          passwordResetToken: null,
          passwordResetExpires: null,
          // Reset failed login attempts
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });

      // Deactivate all sessions except current if it's self change
      if (isOwnPassword) {
        const currentSessionToken = session.sessionToken;
        await tx.userSession.updateMany({
          where: {
            userId: id,
            sessionToken: { not: currentSessionToken },
          },
          data: { isActive: false },
        });
      } else {
        // Deactivate all sessions for admin reset
        await tx.userSession.updateMany({
          where: { userId: id },
          data: { isActive: false },
        });
      }
    });

    // Log activity
    await logActivity({
      userId: session.user.id,
      action: isOwnPassword ? 'UPDATED' : 'RESET_PASSWORD',
      entityType: 'user',
      entityId: id,
      description: isOwnPassword
        ? 'Contraseña actualizada'
        : `Contraseña reseteada por administrador: ${user.firstName} ${user.lastName}`,
      metadata: {
        targetUserId: id,
        targetUserName: `${user.firstName} ${user.lastName}`,
        reason: !isOwnPassword ? validatedData.reason : undefined,
        forceChange: !isOwnPassword ? validatedData.forceChange : undefined,
      },
    });

    return NextResponse.json({
      message: isOwnPassword
        ? 'Contraseña actualizada correctamente'
        : 'Contraseña reseteada correctamente',
      forceChange: !isOwnPassword ? validatedData.forceChange : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.errors },
        { status: 400 }
      );
    }

    logger.error('Error changing password:', error);
    return NextResponse.json(
      { error: 'Error al cambiar la contraseña' },
      { status: 500 }
    );
  }
}