import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withLogging } from '@/lib/logging-middleware';
import { logger, loggers } from '@/lib/logger';

async function testHandler(req: NextRequest): Promise<NextResponse> {
  const { method, url } = req;

  logger.info('Test logging endpoint called', {
    method,
    url,
    headers: Object.fromEntries(req.headers.entries()),
  });

  if (method === 'GET') {
    // Test different log levels
    logger.debug('Debug message from test endpoint');
    logger.info('Info message from test endpoint');
    logger.warn('Warning message from test endpoint');

    // Test structured logging
    loggers.business.caseCreated('test-case-123', 'test-user-456', {
      testMode: true,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json({
      message: 'Logging test endpoint working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      logLevel: logger.level,
    });
  }

  if (method === 'POST') {
    const body = await req.json();

    logger.info('POST request received', {
      body,
      contentType: req.headers.get('content-type'),
    });

    // Test error logging
    if (body.triggerError) {
      const testError = new Error('Test error from logging endpoint');
      logger.error('Deliberate test error', {
        error: testError.message,
        stack: testError.stack,
        body,
      });

      return NextResponse.json({
        error: 'Test error triggered',
        timestamp: new Date().toISOString(),
      }, { status: 500 });
    }

    // Test security logging
    if (body.testSecurityLogging) {
      loggers.security.suspiciousActivity('test_security_event', {
        testMode: true,
        triggeredBy: body.userId || 'anonymous',
        details: body.details || 'Test security event',
      });
    }

    return NextResponse.json({
      message: 'POST request processed',
      receivedData: body,
      timestamp: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    error: 'Method not allowed',
    allowedMethods: ['GET', 'POST'],
  }, { status: 405 });
}

// Wrap the handler with logging middleware
export const GET = withLogging(testHandler);
export const POST = withLogging(testHandler);
export const PUT = withLogging(testHandler);
export const DELETE = withLogging(testHandler);