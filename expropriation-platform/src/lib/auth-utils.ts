import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { prisma } from '@/lib/prisma';

export interface PasswordResetRequest {
  email: string;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
}

/**
 * Verify a password against its hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a secure random token
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Generate a password reset token and store it
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  // Clean up any existing unused tokens for this email
  await prisma.user.updateMany({
    where: {
      email,
      passwordResetToken: {
        not: null,
      },
      passwordResetExpires: {
        lt: new Date(),
      },
    },
    data: {
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });

  // Generate new token
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

  // Store token in user record
  await prisma.user.update({
    where: { email },
    data: {
      passwordResetToken: token,
      passwordResetExpires: expiresAt,
    },
  });

  return token;
}

/**
 * Verify a password reset token
 */
export async function verifyPasswordResetToken(token: string): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date(),
      },
      isActive: true,
    },
  });

  return !!user;
}

/**
 * Reset password using token
 */
export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: token,
      passwordResetExpires: {
        gt: new Date(),
      },
      isActive: true,
    },
  });

  if (!user) {
    throw new AuthError('Token inválido o expirado', 'INVALID_TOKEN');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password and clear token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: hashedPassword,
      passwordResetToken: null,
      passwordResetExpires: null,
    },
  });
}

/**
 * Change password for authenticated user
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get user with current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      passwordHash: true,
      isActive: true,
    },
  });

  if (!user || !user.isActive) {
    throw new AuthError('Usuario no encontrado o inactivo', 'USER_NOT_FOUND');
  }

  // Verify current password
  const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    throw new AuthError('Contraseña actual incorrecta', 'INVALID_CURRENT_PASSWORD');
  }

  // Hash new password
  const hashedPassword = await hashPassword(newPassword);

  // Update password
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: hashedPassword,
    },
  });
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }

  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }

  if (!/[a-z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra minúscula');
  }

  if (!/\d/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }

  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if user has specific permission
 */
export function hasPermission(
  userPermissions: Record<string, boolean>,
  permission: string
): boolean {
  return userPermissions[permission] === true;
}

/**
 * Check if user has any of the specified roles
 */
export function hasRole(userRole: string, allowedRoles: string[]): boolean {
  return allowedRoles.includes(userRole);
}

/**
 * Get session error message from URL parameters
 */
export function getAuthErrorMessage(error?: string): string | null {
  if (!error) return null;

  const errorMessages: Record<string, string> = {
    CredentialsSignin: 'Credenciales inválidas',
    AccessDenied: 'Acceso denegado',
    Verification: 'Verificación requerida',
    Default: 'Error de autenticación',
    Configuration: 'Error de configuración del servidor',
    OAuthSignin: 'Error al iniciar sesión con OAuth',
    OAuthCallback: 'Error en el callback de OAuth',
    OAuthCreateAccount: 'Error al crear cuenta con OAuth',
    EmailCreateAccount: 'Error al crear cuenta con email',
    Callback: 'Error en el callback de autenticación',
    OAuthAccountNotLinked: 'Cuenta de OAuth no vinculada',
    SessionRequired: 'Sesión requerida',
  };

  return (errorMessages[error] ?? errorMessages.Default) as string;
}

/**
 * Rate limiting for login attempts (simple in-memory implementation)
 * In production, use Redis or a database-backed solution
 */
const loginAttempts = new Map<string, { count: number; lastAttempt: Date }>();

export function checkRateLimit(email: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean {
  const now = new Date();
  const attempts = loginAttempts.get(email);

  if (!attempts) {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if window has expired
  if (now.getTime() - attempts.lastAttempt.getTime() > windowMs) {
    loginAttempts.set(email, { count: 1, lastAttempt: now });
    return true;
  }

  // Check if max attempts reached
  if (attempts.count >= maxAttempts) {
    return false;
  }

  // Increment attempts
  attempts.count++;
  attempts.lastAttempt = now;
  loginAttempts.set(email, attempts);
  return true;
}

/**
 * Clear rate limit for email (called after successful login)
 */
export function clearRateLimit(email: string): void {
  loginAttempts.delete(email);
}