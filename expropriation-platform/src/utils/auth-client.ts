/**
 * Client-side authentication utility functions
 * These functions are safe to use in the browser and don't require server-side resources
 */

export interface PasswordResetRequest {
  email: string;
  token: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
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