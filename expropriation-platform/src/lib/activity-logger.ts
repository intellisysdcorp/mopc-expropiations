import { prisma } from '@/lib/prisma';
import { ActivityType } from '@prisma/client';
import { logger } from '@/lib/logger';

interface LogActivityParams {
  userId: string;
  action: ActivityType | string;
  entityType: string;
  entityId: string;
  description?: string;
  metadata?: any;
  caseId?: string;
}

export async function logActivity({
  userId,
  action,
  entityType,
  entityId,
  description,
  metadata,
  caseId,
}: LogActivityParams) {
  try {
    // Verify that the user exists before logging activity
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });

    if (!userExists) {
      logger.warn(`Cannot log activity: User ${userId} not found`);
      return;
    }

    await prisma.activity.create({
      data: {
        userId,
        action: action as ActivityType,
        entityType,
        entityId,
        description,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : null,
        caseId,
      },
    });
  } catch (error) {
    logger.error('Error logging activity:', error);
    logger.error('Activity details:', {
      userId,
      action,
      entityType,
      entityId,
      description,
      hasCaseId: !!caseId
    });
    // Don't throw the error to avoid breaking the main flow
  }
}

export async function logUserLogin(userId: string, ipAddress?: string, userAgent?: string) {
  await Promise.all([
    // Update user login info
    prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
        lastLoginUserAgent: userAgent,
        loginCount: { increment: 1 },
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    }),
    // Log activity
    logActivity({
      userId,
      action: 'LOGIN',
      entityType: 'user',
      entityId: userId,
      description: 'Inicio de sesión',
      metadata: {
        ipAddress,
        userAgent,
        timestamp: new Date().toISOString(),
      },
    }),
  ]);
}

export async function logUserLogout(userId: string, sessionToken?: string) {
  await logActivity({
    userId,
    action: 'LOGOUT',
    entityType: 'user',
    entityId: userId,
    description: 'Cierre de sesión',
    metadata: {
      sessionToken,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function logFailedLogin(email: string, ipAddress?: string, userAgent?: string) {
  try {
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const failedAttempts = user.failedLoginAttempts + 1;
      const maxAttempts = 5;
      const lockDuration = 30 * 60 * 1000; // 30 minutes

      let lockedUntil: Date | null = null;
      let shouldLock = false;

      if (failedAttempts >= maxAttempts) {
        lockedUntil = new Date(Date.now() + lockDuration);
        shouldLock = true;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: failedAttempts,
          lockedUntil,
        },
      });

      await logActivity({
        userId: user.id,
        action: 'FAILED_LOGIN',
        entityType: 'user',
        entityId: user.id,
        description: `Intento de login fallido ${shouldLock ? '(cuenta bloqueada)' : ''}`,
        metadata: {
          email,
          ipAddress,
          userAgent,
          failedAttempts,
          lockedUntil: lockedUntil?.toISOString(),
          timestamp: new Date().toISOString(),
        },
      });
    }
  } catch (error) {
    logger.error('Error logging failed login:', error);
  }
}

export async function logPasswordChange(
  userId: string,
  changedBy: string,
  reason: string = 'user_change',
  ipAddress?: string,
  userAgent?: string
) {
  await logActivity({
    userId: changedBy,
    action: 'UPDATED',
    entityType: 'user',
    entityId: userId,
    description: `Contraseña actualizada: ${reason}`,
    metadata: {
      targetUserId: userId,
      reason,
      ipAddress,
      userAgent,
      timestamp: new Date().toISOString(),
    },
  });
}

export async function logCaseActivity(
  userId: string,
  action: ActivityType,
  caseId: string,
  description?: string,
  metadata?: any
) {
  await logActivity({
    userId,
    action,
    entityType: 'case',
    entityId: caseId,
    description,
    metadata,
    caseId,
  });
}

export async function logDocumentActivity(
  userId: string,
  action: ActivityType,
  documentId: string,
  caseId?: string,
  description?: string,
  metadata?: any
) {
  await logActivity({
    userId,
    action,
    entityType: 'document',
    entityId: documentId,
    description,
    metadata,
    caseId,
  });
}