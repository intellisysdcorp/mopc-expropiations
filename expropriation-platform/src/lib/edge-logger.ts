/* eslint-disable no-console */
/**
 * Edge Runtime-compatible logger for Next.js middleware
 *
 * NOTE: This logger uses console methods because Winston is not compatible with Edge Runtime.
 * The actual security logging with Winston should be handled in API routes where Node.js runtime is available.
 * This logger provides structured logging for middleware-only scenarios.
 */

interface LogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
  type?: string;
  event?: string;
}

class EdgeLogger {
  private isProduction: boolean;
  private serviceName: string;
  private version: string;

  constructor() {
    this.isProduction = (globalThis as any).process?.env?.NODE_ENV === 'production';
    this.serviceName = 'expropriation-platform';
    this.version = (globalThis as any).process?.env?.npm_package_version || '1.0.0';
  }

  private formatMessage(entry: LogEntry): string {
    const { level, message, timestamp, context, type, event } = entry;

    if (this.isProduction) {
      // JSON format for production
      return JSON.stringify({
        level,
        message,
        timestamp,
        service: this.serviceName,
        version: this.version,
        type,
        event,
        ...context,
      });
    } else {
      // Colored format for development
      const colors = {
        error: '\x1b[31m',
        warn: '\x1b[33m',
        info: '\x1b[32m',
        debug: '\x1b[37m',
        reset: '\x1b[0m',
      };

      const color = colors[level] || colors.reset;
      const contextStr = context && Object.keys(context).length > 0
        ? `\n${JSON.stringify(context, null, 2)}`
        : '';

      return `${timestamp} ${color}${level}${colors.reset}: ${message}${contextStr}`;
    }
  }

  private log(level: LogEntry['level'], message: string, context?: Record<string, any>) {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    };

    const formattedMessage = this.formatMessage(entry);

    // Use structured console logging for Edge Runtime
    switch (level) {
      case 'error':
        console.error(formattedMessage);
        break;
      case 'warn':
        console.warn(formattedMessage);
        break;
      case 'info':
        console.info(formattedMessage);
        break;
      case 'debug':
      default:
        console.log(formattedMessage);
        break;
    }
  }

  error(message: string, context?: Record<string, any>) {
    this.log('error', message, context);
  }

  warn(message: string, context?: Record<string, any>) {
    this.log('warn', message, context);
  }

  info(message: string, context?: Record<string, any>) {
    this.log('info', message, context);
  }

  debug(message: string, context?: Record<string, any>) {
    this.log('debug', message, context);
  }

  // Security-specific logging methods
  security = {
    loginAttempt: (email: string, ip: string, success: boolean, userId?: string) => {
      this.warn('Security: Login attempt', {
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
      this.error('Security: Role validation failed', {
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
      this.error('Security: Suspicious activity detected', {
        type: 'security',
        event: 'suspicious_activity',
        details,
        timestamp: new Date().toISOString(),
      });
    },

    configurationIssue: (issue: string, details: Record<string, any>) => {
      this.error('Security: Configuration issue', {
        type: 'security',
        event: 'configuration_issue',
        issue,
        details,
        timestamp: new Date().toISOString(),
      });
    },
  };
}

// Create singleton instance
export const edgeLogger = new EdgeLogger();

// Export default for compatibility
export default edgeLogger;