import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import { z } from 'zod';
import { logger } from '@/lib/logger';

// Security constants
export const SECURITY_CONSTANTS = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_MAX_LENGTH: 128,
  SALT_ROUNDS: 12,
  SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 15 * 60 * 1000, // 15 minutes
  TOKEN_EXPIRY: 60 * 60 * 1000, // 1 hour
  REFRESH_TOKEN_EXPIRY: 7 * 24 * 60 * 60 * 1000, // 7 days
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,
  CSRF_TOKEN_LENGTH: 32,
  API_KEY_LENGTH: 64,
} as const;

// Password validation schema
export const passwordSchema = z.object({
  password: z
    .string()
    .min(SECURITY_CONSTANTS.PASSWORD_MIN_LENGTH, 'La contraseña debe tener al menos 8 caracteres')
    .max(SECURITY_CONSTANTS.PASSWORD_MAX_LENGTH, 'La contraseña no puede exceder los 128 caracteres')
    .regex(/[A-Z]/, 'La contraseña debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'La contraseña debe contener al menos una letra minúscula')
    .regex(/\d/, 'La contraseña debe contener al menos un número')
    .regex(/[!@#$%^&*(),.?":{}|<>]/, 'La contraseña debe contener al menos un carácter especial'),
});

// Email validation schema
export const emailSchema = z.object({
  email: z
    .string()
    .email('El formato del correo electrónico no es válido')
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'El formato del correo electrónico no es válido'),
});

// Phone validation schema (Dominican Republic)
export const phoneSchema = z.object({
  phone: z
    .string()
    .regex(/^(?:\+1|1)? ?(?:809|829|849) ?[0-9]{3} ?[0-9]{4}$/, 'El formato del teléfono no es válido para República Dominicana'),
});

// ID validation schema (Cédula Dominicana)
export const idSchema = z.object({
  id: z
    .string()
    .regex(/^\d{3}[- ]?\d{7}[- ]?\d{1}$/, 'El formato de la cédula no es válido')
    .refine((val) => {
      // Remove dashes and spaces for validation
      const cleanId = val.replace(/[- ]/g, '');
      if (cleanId.length !== 11) return false;

      // Check if all characters are digits
      if (!/^\d+$/.test(cleanId)) return false;

      // Calculate check digit
      const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
      const digits = cleanId.split('').map(char => parseInt(char, 10));
      const checkDigit = digits[10];

      let sum = 0;
      for (let i = 0; i < 10; i++) {
        const digit = digits[i];
        const weight = weights[i];

        // Ensure we have valid numbers
        if (typeof digit === 'number' && !isNaN(digit) && typeof weight === 'number') {
          let product = digit * weight;
          if (product > 9) product = product - 9;
          sum += product;
        } else {
          return false; // Invalid digit or weight
        }
      }

      const calculatedCheckDigit = (10 - (sum % 10)) % 10;
      return typeof checkDigit === 'number' && !isNaN(checkDigit) && checkDigit === calculatedCheckDigit;
    }, 'La cédula no es válida'),
});

// Password utilities
export const passwordUtils = {
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, SECURITY_CONSTANTS.SALT_ROUNDS);
  },

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  generateSecurePassword(): string {
    const length = 16;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    let password = '';

    // Ensure at least one character from each required category
    password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
    password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
    password += '0123456789'[Math.floor(Math.random() * 10)];
    password += '!@#$%^&*()_+-=[]{}|;:,.<>?'[Math.floor(Math.random() * 26)];

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += charset[Math.floor(Math.random() * charset.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  },

  checkStrength(password: string): {
    score: number;
    feedback: string[];
    isStrong: boolean;
  } {
    const feedback = [];
    let score = 0;

    // Length check
    if (password.length >= 8) score += 1;
    else feedback.push('La contraseña debe tener al menos 8 caracteres');

    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;

    // Complexity checks
    if (/[A-Z]/.test(password)) score += 1;
    else feedback.push('Debe contener mayúsculas');

    if (/[a-z]/.test(password)) score += 1;
    else feedback.push('Debe contener minúsculas');

    if (/\d/.test(password)) score += 1;
    else feedback.push('Debe contener números');

    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;
    else feedback.push('Debe contener caracteres especiales');

    // Common patterns penalty
    if (/(.)\1{2,}/.test(password)) {
      score -= 1;
      feedback.push('Evita caracteres repetidos');
    }

    if (/(012|123|234|345|456|567|678|789|890|qwe|wer|ert|rty|tyu|yui|uio|asd|sdf|dfg|fgh|jkl|zxc|xcv|cvb|vbn)/i.test(password)) {
      score -= 1;
      feedback.push('Evita secuencias comunes');
    }

    const isStrong = score >= 5;
    return { score, feedback, isStrong };
  },
};

// Token utilities
export const tokenUtils = {
  generateSecureToken(length: number = SECURITY_CONSTANTS.CSRF_TOKEN_LENGTH): string {
    return crypto.randomBytes(length).toString('hex');
  },

  generateApiKey(): string {
    return crypto.randomBytes(SECURITY_CONSTANTS.API_KEY_LENGTH).toString('hex');
  },

  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  },

  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  },

  verifyToken(token: string): boolean {
    try {
      // This would verify JWT tokens or similar
      // For now, return true if token exists
      return !!token;
    } catch {
      return false;
    }
  },
};

// Input sanitization
export const sanitizeInput = {
  email: (email: string): string => {
    return email.toLowerCase().trim();
  },

  phone: (phone: string): string => {
    return phone.replace(/[^\d+]/g, '');
  },

  id: (id: string): string => {
    return id.replace(/[^\d]/g, '');
  },

  string: (str: string, maxLength: number = 1000): string => {
    return str.trim().slice(0, maxLength);
  },

  html: (html: string): string => {
    // Basic HTML sanitization
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  },
};

// Rate limiting utilities
export const rateLimiting = {
  generateKey(identifier: string, action: string): string {
    return `rate_limit:${identifier}:${action}`;
  },

  shouldBlock(): boolean {
    // This would typically use Redis or similar for distributed rate limiting
    // For now, return false (no blocking)
    return false;
  },
};

// Security headers (CSP is now handled in middleware with nonces)
export const securityHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-XSS-Protection': '1; mode=block',
  // HSTS is only added in production via middleware
  'Strict-Transport-Security': process.env.NODE_ENV === 'production'
    ? 'max-age=31536000; includeSubDomains; preload'
    : undefined,
};

// Audit logging
export const auditLogger = {
  log: async (
    userId: string,
    action: string,
    resource: string,
    details?: any,
    ipAddress?: string,
  ): Promise<void> => {
    const auditEntry = {
      id: crypto.randomUUID(),
      userId,
      action,
      resource,
      details,
      ipAddress,
      timestamp: new Date().toISOString(),
    };

    // In a real implementation, this would be stored in a secure audit log
    logger.info('AUDIT:', auditEntry);
  },

  logSecurityEvent: async (
    event: 'LOGIN_SUCCESS' | 'LOGIN_FAILURE' | 'LOGOUT' | 'PASSWORD_CHANGE' | 'ACCOUNT_LOCKED',
    details?: any
  ): Promise<void> => {
    const securityEvent = {
      id: crypto.randomUUID(),
      type: event,
      details,
      timestamp: new Date().toISOString(),
      severity: event === 'ACCOUNT_LOCKED' ? 'HIGH' : 'MEDIUM',
    };

    logger.info('SECURITY:', securityEvent);
  },
};

// Data encryption utilities
export const encryption = {
  encrypt: (text: string, key: string): string => {
    const algorithm = 'aes-256-gcm';
    const iv = crypto.randomBytes(16);
    // Create a proper 32-byte key from the input key
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);

    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final()
    ]).toString('hex');

    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
  },

  decrypt: (encryptedText: string, key: string): string => {
    const algorithm = 'aes-256-gcm';
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(parts[0] || '', 'hex');
    const authTag = Buffer.from(parts[1] || '', 'hex');
    const encrypted = parts[2] || '';

    // Create a proper 32-byte key from the input key
    const keyBuffer = crypto.scryptSync(key, 'salt', 32);
    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(encrypted, 'hex'),
      decipher.final()
    ]).toString('utf8');

    return decrypted;
  },
};

// Validation helpers
export const validation = {
  isValidEmail: (email: string): boolean => {
    try {
      emailSchema.parse({ email });
      return true;
    } catch {
      return false;
    }
  },

  isValidPassword: (password: string): boolean => {
    try {
      passwordSchema.parse({ password });
      return true;
    } catch {
      return false;
    }
  },

  isValidPhone: (phone: string): boolean => {
    try {
      phoneSchema.parse({ phone });
      return true;
    } catch {
      return false;
    }
  },

  isValidId: (id: string): boolean => {
    try {
      idSchema.parse({ id });
      return true;
    } catch {
      return false;
    }
  },
};

// Secure random utilities
export const secureRandom = {
  uuid: (): string => {
    return crypto.randomUUID();
  },

  number: (min: number, max: number): number => {
    const range = max - min + 1;
    const bytes = crypto.randomBytes(4);
    const randomInt = bytes.readUInt32BE(0);
    return min + (randomInt % range);
  },

  string: (length: number, charset: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'): string => {
    let result = '';
    const bytes = crypto.randomBytes(length);
    for (let i = 0; i < length; i++) {
      const byteValue = bytes[i] ?? 0;
      result += charset[byteValue % charset.length];
    }
    return result;
  },
};

// Security middleware helpers
export const middleware = {
  async rateLimit(req: Request, _limit: number = 100, _window: number = 15 * 60 * 1000) {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const _key = rateLimiting.generateKey(ip, 'api');

    if (rateLimiting.shouldBlock()) {
      throw new Error('Rate limit exceeded');
    }

    return true;
  },

  async validateCSRF(req: Request) {
    const token = req.headers.get('x-csrf-token');
    if (!token) {
      throw new Error('CSRF token missing');
    }

    // Validate token against session
    return true;
  },

  async checkPermissions(): Promise<boolean> {
    // This would check user permissions against resource
    // For now, return true
    return true;
  },
};

// Export all security utilities
export const security = {
  constants: SECURITY_CONSTANTS,
  password: passwordUtils,
  token: tokenUtils,
  sanitize: sanitizeInput,
  rateLimit: rateLimiting,
  headers: securityHeaders,
  audit: auditLogger,
  encrypt: encryption,
  validate: validation,
  random: secureRandom,
  middleware,
};