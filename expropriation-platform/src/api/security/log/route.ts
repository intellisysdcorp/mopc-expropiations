import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { event, details, level = 'info' } = body;

    // Add request context
    const ip = request.ip ||
               request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
               request.headers.get('x-real-ip') ||
               'unknown';

    const userAgent = request.headers.get('user-agent') || 'unknown';
    const timestamp = new Date().toISOString();

    const logEntry = {
      type: 'security',
      event,
      ip,
      userAgent,
      timestamp,
      ...details,
    };

    // Use Winston for proper security logging
    switch (level) {
      case 'error':
        logger.error(`Security: ${event}`, logEntry);
        break;
      case 'warn':
        logger.warn(`Security: ${event}`, logEntry);
        break;
      case 'info':
      default:
        logger.info(`Security: ${event}`, logEntry);
        break;
    }

    return NextResponse.json({ success: true, logged: true });

  } catch (error) {
    logger.error('Security logging API error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      { success: false, error: 'Failed to log security event' },
      { status: 500 }
    );
  }
}