/* eslint-disable no-console */
/**
 * Client-side logger utility
 *
 * This is a simple logger that can be used in client-side components.
 * It provides a similar interface to the main logger but uses console methods.
 */

interface ClientLogEntry {
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  timestamp: string;
  context?: Record<string, any>;
}

class ClientLogger {
  private isProduction: boolean;
  private serviceName: string;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.serviceName = 'expropriation-platform';
  }

  private formatMessage(entry: ClientLogEntry): string {
    const { level, message, timestamp, context } = entry;

    if (this.isProduction) {
      // JSON format for production
      return JSON.stringify({
        level,
        message,
        timestamp,
        service: this.serviceName,
        client: true,
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

  private log(level: ClientLogEntry['level'], message: string, context?: Record<string, any>) {
    const entry: ClientLogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
    };

    const formattedMessage = this.formatMessage(entry);

    // Use appropriate console method based on level
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
}

// Create singleton instance
export const clientLogger = new ClientLogger();

// Export default for compatibility
export default clientLogger;