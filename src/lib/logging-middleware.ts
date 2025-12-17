import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { loggers } from './logger';

// Request context interface
interface RequestContext {
  requestId: string;
  startTime: number;
  userId?: string;
  method: string;
  url: string;
  ip?: string;
}

// Store for active requests (in production, use Redis or similar)
const activeRequests = new Map<string, RequestContext>();

// Generate a unique request ID
function generateRequestId(): string {
  return randomBytes(16).toString('hex');
}

// Helper function to get client IP
function getClientIP(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const real = req.headers.get('x-real-ip');

  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }
  if (real) {
    return real.trim() || 'unknown';
  }
  return 'unknown';
}

// Middleware function to wrap API routes
export function withLogging(
  handler: (req: NextRequest, context?: any) => Promise<NextResponse>
) {
  return async (req: NextRequest, context?: any): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const method = req.method;
    const url = req.url;
    const ip = getClientIP(req);

    // Store request context
    const requestContext: RequestContext = {
      requestId,
      startTime,
      method,
      url,
      ip,
    };

    activeRequests.set(requestId, requestContext);

    try {
      // Log request start
      loggers.api.request(method, url, undefined, requestId);

      // Execute the handler
      const response = await handler(req, context);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Log successful response
      loggers.api.response(method, url, response.status, duration, requestId);

      // Add response headers for debugging
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-response-time', `${duration}ms`);

      // Clean up
      activeRequests.delete(requestId);

      return response;

    } catch (error) {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Log error
      const errorObj = error instanceof Error ? error : new Error(String(error));
      loggers.api.error(method, url, errorObj, requestId);

      // Clean up
      activeRequests.delete(requestId);

      // Return error response
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          requestId,
          timestamp: new Date().toISOString(),
        },
        {
          status: 500,
          headers: {
            'x-request-id': requestId,
            'x-response-time': `${duration}ms`,
          }
        }
      );
    }
  };
}

// Higher-order function for routes with user authentication
export function withAuthenticatedLogging(
  handler: (req: NextRequest, context: { user: any }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { user: any }): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const method = req.method;
    const url = req.url;
    const ip = getClientIP(req);
    const userId = context.user?.id;

    // Store request context
    const requestContext: RequestContext = {
      requestId,
      startTime,
      userId,
      method,
      url,
      ip,
    };

    activeRequests.set(requestId, requestContext);

    try {
      // Log authenticated request start
      loggers.api.request(method, url, userId, requestId);

      // Execute the handler
      const response = await handler(req, context);

      // Calculate duration
      const duration = Date.now() - startTime;

      // Log successful response
      loggers.api.response(method, url, response.status, duration, requestId);

      // Add response headers
      response.headers.set('x-request-id', requestId);
      response.headers.set('x-response-time', `${duration}ms`);

      // Clean up
      activeRequests.delete(requestId);

      return response;

    } catch (error) {
      // Calculate duration
      const duration = Date.now() - startTime;

      // Log error with user context
      const errorObj = error instanceof Error ? error : new Error(String(error));
      loggers.api.error(method, url, errorObj, requestId);

      // Log security-relevant errors
      if (errorObj.message.includes('Unauthorized') ||
          errorObj.message.includes('Forbidden') ||
          errorObj.message.includes('authentication')) {
        loggers.security.suspiciousActivity('authentication_error', {
          userId,
          method,
          url,
          ip,
          error: errorObj.message,
          requestId,
        });
      }

      // Clean up
      activeRequests.delete(requestId);

      // Return error response
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          requestId,
          timestamp: new Date().toISOString(),
        },
        {
          status: 500,
          headers: {
            'x-request-id': requestId,
            'x-response-time': `${duration}ms`,
          }
        }
      );
    }
  };
}

// Get active requests for monitoring
export function getActiveRequests(): RequestContext[] {
  return Array.from(activeRequests.values());
}

// Clean up old requests (call this periodically)
export function cleanupOldRequests(maxAge: number = 5 * 60 * 1000): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [requestId, context] of activeRequests.entries()) {
    if (now - context.startTime > maxAge) {
      activeRequests.delete(requestId);
      cleaned++;
    }
  }

  return cleaned;
}

// Performance monitoring
export function logSlowRequests(threshold: number = 5000): void {
  const now = Date.now();

  for (const [, context] of activeRequests.entries()) {
    const duration = now - context.startTime;
    if (duration > threshold) {
      loggers.performance.slowQuery(
        `${context.method} ${context.url}`,
        duration,
        threshold
      );
    }
  }
}