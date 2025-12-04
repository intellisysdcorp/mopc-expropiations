import winston from 'winston';
import path from 'path';

// Define log levels with custom colors
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

winston.addColors(logColors);

// Custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}` +
    (info.splat !== undefined ? `${info.splat}` : " ") +
    (info.stack !== undefined ? `${info.stack}` : " ") +
    (info.metadata !== undefined && info.metadata !== null && Object.keys(info.metadata).length > 0
      ? `\n${JSON.stringify(info.metadata, null, 2)}`
      : "")
  ),
);

// Custom format for production (JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Determine if we're in production
const isProduction = process.env.NODE_ENV === 'production';

// Create transports array
const transports: winston.transport[] = [];

// Console transport for development
if (!isProduction) {
  transports.push(
    new winston.transports.Console({
      format: developmentFormat,
    })
  );
}

// File transports for production
if (isProduction) {
  transports.push(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      format: productionFormat,
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      format: productionFormat,
    })
  );
}

// Create the main logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  levels: logLevels,
  format: isProduction ? productionFormat : developmentFormat,
  defaultMeta: {
    service: 'expropriation-platform',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  exitOnError: false, // Don't exit on handled exceptions
});

// Create a child logger with additional context
export function createChildLogger(context: Record<string, any>): winston.Logger {
  return logger.child(context);
}

// Create a request-scoped logger for API routes
export function createRequestLogger(
  requestId: string,
  userId?: string,
  additionalContext?: Record<string, any>
): winston.Logger {
  return logger.child({
    requestId,
    userId,
    type: 'request',
    ...additionalContext,
  });
}

// Helper functions for structured logging
export const loggers = {
  // Security events logging
  security: {
    loginAttempt: (email: string, ip: string, success: boolean, userId?: string) => {
      logger.warn('Security: Login attempt', {
        type: 'security',
        event: 'login_attempt',
        email,
        ip,
        success,
        userId,
        timestamp: new Date().toISOString(),
      });
    },

    roleValidation: (userRole: string, requiredRole: string, userId: string, ip: string) => {
      logger.error('Security: Role validation failed', {
        type: 'security',
        event: 'role_validation_failed',
        userRole,
        requiredRole,
        userId,
        ip,
        timestamp: new Date().toISOString(),
      });
    },

    suspiciousActivity: (event: string, details: Record<string, any>) => {
      logger.error('Security: Suspicious activity detected', {
        type: 'security',
        event: 'suspicious_activity',
        details,
        timestamp: new Date().toISOString(),
      });
    },

    configurationIssue: (issue: string, details: Record<string, any>) => {
      logger.error('Security: Configuration issue', {
        type: 'security',
        event: 'configuration_issue',
        issue,
        details,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Database operations logging
  database: {
    query: (operation: string, table: string, duration?: number, error?: Error) => {
      const level = error ? 'error' : 'debug';
      logger[level]('Database operation', {
        type: 'database',
        operation,
        table,
        duration,
        error: error?.message,
        timestamp: new Date().toISOString(),
      });
    },

    connection: (status: 'connected' | 'disconnected' | 'error', error?: Error) => {
      const level = status === 'error' ? 'error' : 'info';
      logger[level](`Database ${status}`, {
        type: 'database',
        event: `connection_${status}`,
        error: error?.message,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // API request/response logging
  api: {
    request: (method: string, url: string, userId?: string, requestId?: string) => {
      logger.http('API Request', {
        type: 'api',
        event: 'request_start',
        method,
        url,
        userId,
        requestId,
        timestamp: new Date().toISOString(),
      });
    },

    response: (method: string, url: string, statusCode: number, duration: number, requestId?: string) => {
      const level = statusCode >= 400 ? 'warn' : 'http';
      logger[level]('API Response', {
        type: 'api',
        event: 'request_complete',
        method,
        url,
        statusCode,
        duration,
        requestId,
        timestamp: new Date().toISOString(),
      });
    },

    error: (method: string, url: string, error: Error, requestId?: string) => {
      logger.error('API Error', {
        type: 'api',
        event: 'request_error',
        method,
        url,
        error: error.message,
        stack: error.stack,
        requestId,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Business operations logging
  business: {
    caseCreated: (caseId: string, userId: string, details: Record<string, any>) => {
      logger.info('Business: Case created', {
        type: 'business',
        event: 'case_created',
        caseId,
        userId,
        details,
        timestamp: new Date().toISOString(),
      });
    },

    documentUploaded: (documentId: string, caseId: string, userId: string, filename: string) => {
      logger.info('Business: Document uploaded', {
        type: 'business',
        event: 'document_uploaded',
        documentId,
        caseId,
        userId,
        filename,
        timestamp: new Date().toISOString(),
      });
    },

    stageProgression: (caseId: string, fromStage: string, toStage: string, userId: string) => {
      logger.info('Business: Stage progression', {
        type: 'business',
        event: 'stage_progression',
        caseId,
        fromStage,
        toStage,
        userId,
        timestamp: new Date().toISOString(),
      });
    },
  },

  // Performance logging
  performance: {
    slowQuery: (query: string, duration: number, threshold: number) => {
      logger.warn('Performance: Slow query detected', {
        type: 'performance',
        event: 'slow_query',
        query: query.substring(0, 200), // Truncate long queries
        duration,
        threshold,
        timestamp: new Date().toISOString(),
      });
    },

    memoryUsage: (used: number, total: number, percentage: number) => {
      const level = percentage > 80 ? 'warn' : 'debug';
      logger[level]('Performance: Memory usage', {
        type: 'performance',
        event: 'memory_usage',
        used,
        total,
        percentage,
        timestamp: new Date().toISOString(),
      });
    },
  },
};

// Handle uncaught exceptions and rejections
if (isProduction) {
  logger.exceptions.handle(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'exceptions.log'),
      format: productionFormat,
    })
  );

  logger.rejections.handle(
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'rejections.log'),
      format: productionFormat,
    })
  );
}

export default logger;