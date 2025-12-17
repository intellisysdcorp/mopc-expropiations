import { NextRequest } from 'next/server';

// Rate limiting configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  maxUploads?: number; // Maximum uploads per window (separate from requests)
  maxStorageMB?: number; // Maximum storage in MB per window
}

// Define the user role type for better type safety
export type UserRole =
  | 'super_admin'
  | 'department_admin'
  | 'analyst'
  | 'supervisor'
  | 'observer'
  | 'default';

// Rate limit configurations for different user roles
export const RATE_LIMIT_CONFIGS: Record<UserRole, RateLimitConfig> = {
  super_admin: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 1000,
    maxUploads: 100,
    maxStorageMB: 1000,
  },
  department_admin: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 500,
    maxUploads: 50,
    maxStorageMB: 500,
  },
  analyst: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 200,
    maxUploads: 20,
    maxStorageMB: 200,
  },
  supervisor: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 300,
    maxUploads: 30,
    maxStorageMB: 300,
  },
  observer: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 50,
    maxUploads: 5,
    maxStorageMB: 50,
  },
  default: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 100,
    maxUploads: 10,
    maxStorageMB: 100,
  },
};

// In-memory storage for rate limiting (in production, use Redis or similar)
const rateLimitStore = new Map<string, {
  requests: number;
  uploads: number;
  storageMB: number;
  resetTime: number;
  lastReset: number;
}>();

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Get client identifier from request
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from session first
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');

  // In a real implementation, you'd extract the user ID from the session token
  // For now, use IP address as fallback
  return forwardedFor?.split(',')[0]?.trim() ||
             realIP?.trim() ||
             'unknown';
}

/**
 * Get or create rate limit entry for client
 */
function getRateLimitEntry(clientId: string, config: RateLimitConfig) {
  const now = Date.now();
  let entry = rateLimitStore.get(clientId);

  if (!entry || now > entry.resetTime) {
    entry = {
      requests: 0,
      uploads: 0,
      storageMB: 0,
      resetTime: now + config.windowMs,
      lastReset: now,
    };
    rateLimitStore.set(clientId, entry);
  }

  return entry;
}

/**
 * Check if request is rate limited
 */
export function checkRateLimit(
  request: NextRequest,
  userRole: UserRole = 'default',
  isUpload: boolean = false,
  uploadSizeMB: number = 0
): {
  allowed: boolean;
  remainingRequests: number;
  remainingUploads: number;
  remainingStorageMB: number;
  resetTime: number;
  error?: string;
} {
  const config = RATE_LIMIT_CONFIGS[userRole] ?? RATE_LIMIT_CONFIGS.default;
  const clientId = getClientIdentifier(request);
  const entry = getRateLimitEntry(clientId, config);

  // Check request limit
  if (entry.requests >= config.maxRequests) {
    return {
      allowed: false,
      remainingRequests: 0,
      remainingUploads: Math.max(0, (config.maxUploads || 0) - entry.uploads),
      remainingStorageMB: Math.max(0, (config.maxStorageMB || 0) - entry.storageMB),
      resetTime: entry.resetTime,
      error: `Request rate limit exceeded. Maximum ${config.maxRequests} requests per ${config.windowMs / 60000} minutes.`,
    };
  }

  // Check upload limit for upload requests
  if (isUpload) {
    if (config.maxUploads && entry.uploads >= config.maxUploads) {
      return {
        allowed: false,
        remainingRequests: Math.max(0, config.maxRequests - entry.requests),
        remainingUploads: 0,
        remainingStorageMB: Math.max(0, (config.maxStorageMB || 0) - entry.storageMB),
        resetTime: entry.resetTime,
        error: `Upload rate limit exceeded. Maximum ${config.maxUploads} uploads per ${config.windowMs / 60000} minutes.`,
      };
    }

    // Check storage limit
    if (config.maxStorageMB && entry.storageMB + uploadSizeMB > config.maxStorageMB) {
      return {
        allowed: false,
        remainingRequests: Math.max(0, config.maxRequests - entry.requests),
        remainingUploads: Math.max(0, (config.maxUploads || 0) - entry.uploads),
        remainingStorageMB: Math.max(0, config.maxStorageMB - entry.storageMB),
        resetTime: entry.resetTime,
        error: `Storage limit exceeded. Maximum ${config.maxStorageMB}MB per ${config.windowMs / 60000} minutes.`,
      };
    }
  }

  return {
    allowed: true,
    remainingRequests: Math.max(0, config.maxRequests - entry.requests - 1),
    remainingUploads: Math.max(0, (config.maxUploads || 0) - entry.uploads - (isUpload ? 1 : 0)),
    remainingStorageMB: Math.max(0, (config.maxStorageMB || 0) - entry.storageMB - (isUpload ? uploadSizeMB : 0)),
    resetTime: entry.resetTime,
  };
}

/**
 * Record a request in the rate limiter
 */
export function recordRequest(
  request: NextRequest,
  userRole: UserRole = 'default',
  isUpload: boolean = false,
  uploadSizeMB: number = 0
): void {
  const config = RATE_LIMIT_CONFIGS[userRole] ?? RATE_LIMIT_CONFIGS.default;
  const clientId = getClientIdentifier(request);
  const entry = getRateLimitEntry(clientId, config);

  entry.requests++;

  if (isUpload) {
    entry.uploads++;
    entry.storageMB += uploadSizeMB;
  }
}

/**
 * Get current rate limit status for a client
 */
export function getRateLimitStatus(
  request: NextRequest,
  userRole: UserRole = 'default'
): {
  requests: number;
  uploads: number;
  storageMB: number;
  maxRequests: number;
  maxUploads: number;
  maxStorageMB: number;
  resetTime: number;
  windowMs: number;
} {
  const config = RATE_LIMIT_CONFIGS[userRole] ?? RATE_LIMIT_CONFIGS.default;
  const clientId = getClientIdentifier(request);
  const entry = getRateLimitEntry(clientId, config);

  return {
    requests: entry.requests,
    uploads: entry.uploads,
    storageMB: entry.storageMB,
    maxRequests: config.maxRequests,
    maxUploads: config.maxUploads || 0,
    maxStorageMB: config.maxStorageMB || 0,
    resetTime: entry.resetTime,
    windowMs: config.windowMs,
  };
}

/**
 * Middleware function for Next.js API routes
 */
export function createRateLimitMiddleware(userRole: UserRole = 'default') {
  return async function rateLimitMiddleware(
    request: NextRequest,
    options: { isUpload?: boolean; uploadSizeMB?: number } = {}
  ) {
    const { isUpload = false, uploadSizeMB = 0 } = options;

    // Check rate limit
    const limitResult = checkRateLimit(request, userRole, isUpload, uploadSizeMB);

    if (!limitResult.allowed) {
      return {
        success: false,
        error: limitResult.error,
        headers: {
          'X-RateLimit-Limit': RATE_LIMIT_CONFIGS[userRole]?.maxRequests.toString() || '100',
          'X-RateLimit-Remaining': limitResult.remainingRequests.toString(),
          'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
          'Retry-After': Math.ceil((limitResult.resetTime - Date.now()) / 1000).toString(),
        },
      };
    }

    // Record the request
    recordRequest(request, userRole, isUpload, uploadSizeMB);

    return {
      success: true,
      headers: {
        'X-RateLimit-Limit': RATE_LIMIT_CONFIGS[userRole]?.maxRequests.toString() || '100',
        'X-RateLimit-Remaining': limitResult.remainingRequests.toString(),
        'X-RateLimit-Reset': new Date(limitResult.resetTime).toISOString(),
      },
    };
  };
}

/**
 * Check if user is being rate limited for suspicious activity
 */
export function checkSuspiciousActivity(request: NextRequest): boolean {
  const clientId = getClientIdentifier(request);
  const entry = rateLimitStore.get(clientId);

  if (!entry) {
    return false;
  }

  // Check for rapid successive requests (potential DoS)
  const timeSinceLastReset = Date.now() - entry.lastReset;
  const requestsPerMinute = entry.requests / (timeSinceLastReset / 60000);

  // If more than 10 requests per minute, flag as suspicious
  if (requestsPerMinute > 10) {
    return true;
  }

  return false;
}

/**
 * Apply additional restrictions for suspicious activity
 */
export function applySuspiciousActivityRestrictions(clientId: string): void {
  const entry = rateLimitStore.get(clientId);
  if (entry) {
    // Reduce limits by 75% for suspicious clients
    entry.requests = Math.floor(entry.requests * 1.75);
    entry.uploads = Math.floor(entry.uploads * 1.75);
  }
}