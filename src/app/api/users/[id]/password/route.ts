import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { logActivity } from '@/lib/activity-logger';
import { logger } from '@/lib/logger';
import type { Session } from 'next-auth';
import type { User, Role } from '@/prisma/client';

// Type definitions
interface ChangePasswordData {
  currentPassword: string;
  newPassword: string;
}

interface ResetPasswordData {
  newPassword: string;
  reason?: string;
  forceChange?: boolean;
}

interface PasswordChangeParams {
  session: Session;
  user: User & { role?: Role | null };
  newPassword: string;
  request: NextRequest;
  isOwnPassword: boolean;
  forceChange?: boolean;
  reason?: string;
}

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

// Handle user changing their own password
async function handleSelfPasswordChange(
  session: Session,
  user: User & { role?: Role | null },
  body: ChangePasswordData,
  request: NextRequest
) {
  const validatedData = changePasswordSchema.parse(body);

  // Verify current password
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

  return executePasswordChange({
    session,
    user,
    newPassword: validatedData.newPassword,
    request,
    isOwnPassword: true,
  });
}

// Handle admin resetting user password
async function handleAdminPasswordReset(
  session: Session,
  user: User & { role?: Role | null },
  body: ResetPasswordData,
  request: NextRequest
) {
  const validatedData = resetPasswordSchema.parse(body);

  // Check if user has permission to reset passwords
  const currentUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true },
  });

  const userPermissions = currentUser?.role?.permissions as Record<string, boolean> | undefined;
  if (!userPermissions?.MANAGE_USERS && !userPermissions?.SYSTEM_CONFIG) {
    return NextResponse.json(
      { error: 'No tienes permisos para resetear contraseñas' },
      { status: 403 }
    );
  }

  const passwordChangePayload: PasswordChangeParams = {
    session,
    user,
    newPassword: validatedData.newPassword,
    request,
    isOwnPassword: false,
    forceChange: validatedData.forceChange,
  };

  if (validatedData.reason) passwordChangePayload.reason = validatedData.reason

  return executePasswordChange(passwordChangePayload);
}

// Common password change execution
async function executePasswordChange({
  session,
  user,
  newPassword,
  request,
  isOwnPassword,
  forceChange = false,
  reason,
}: PasswordChangeParams) {
  // Check if new password is the same as current
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);

  if (isSamePassword) {
    return NextResponse.json(
      { error: 'La nueva contraseña no puede ser igual a la actual' },
      { status: 400 }
    );
  }

  // Hash new password
  const newPasswordHash = await bcrypt.hash(newPassword, 12);

  // Get current password history to prevent reuse
  const passwordHistory = await prisma.passwordHistory.findMany({
    where: { userId: user.id },
    orderBy: { changedAt: 'desc' },
    take: 5, // Check last 5 passwords
  });

  // Check if new password was used before
  for (const historyEntry of passwordHistory) {
    const isReusedPassword = await bcrypt.compare(
      newPassword,
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
        userId: user.id,
        passwordHash: user.passwordHash,
        changedBy: isOwnPassword ? user.id : session.user.id,
        changeReason: isOwnPassword ? 'user_change' : 'admin_reset',
        ipAddress: request.headers.get('x-forwarded-for'),
      },
    });

    // Update user password
    await tx.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: !isOwnPassword ? forceChange : false,
        passwordResetToken: null,
        passwordResetExpires: null,
        // Reset failed login attempts
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Deactivate sessions based on the type of change
    if (isOwnPassword) {
      const currentSessionToken = session.user.sessionToken;
      const where: any = { userId: user.id };
      if (currentSessionToken) where.sessionToken = { not: currentSessionToken }
      await tx.userSession.updateMany({
        where,
        data: { isActive: false },
      });
    } else {
      // Deactivate all sessions for admin reset
      await tx.userSession.updateMany({
        where: { userId: user.id },
        data: { isActive: false },
      });
    }
  });

  // Log activity
  await logActivity({
    userId: session.user.id,
    action: isOwnPassword ? 'UPDATED' : 'RESET_PASSWORD',
    entityType: 'user',
    entityId: user.id,
    description: isOwnPassword
      ? 'Contraseña actualizada'
      : `Contraseña reseteada por administrador: ${user.firstName} ${user.lastName}`,
    metadata: {
      targetUserId: user.id,
      targetUserName: `${user.firstName} ${user.lastName}`,
      reason: !isOwnPassword ? reason : undefined,
      forceChange: !isOwnPassword ? forceChange : undefined,
    },
  });

  return NextResponse.json({
    message: isOwnPassword
      ? 'Contraseña actualizada correctamente'
      : 'Contraseña reseteada correctamente',
    forceChange: !isOwnPassword ? forceChange : undefined,
  });
}

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

    // Route to appropriate handler
    if (isOwnPassword) {
      return await handleSelfPasswordChange(session, user, body, request);
    } else {
      return await handleAdminPasswordReset(session, user, body, request);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
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