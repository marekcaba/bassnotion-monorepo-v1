/**
 * Structured Logger for consistent logging across the platform
 */

import { CorrelationContext } from './correlation.js';

// Global log transporter that can be set by the application
let globalLogTransporter: ((entry: LogEntry) => void) | null = null;

export function setGlobalLogTransporter(transporter: (entry: LogEntry) => void): void {
  globalLogTransporter = transporter;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  context: CorrelationContext;
  data?: Record<string, unknown>;
  error?: Error;
}

export interface StructuredLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, error?: Error, data?: Record<string, unknown>): void;
}

/**
 * Create a structured logger instance
 */
export function createStructuredLogger(
  service: string,
  defaultContext?: Partial<CorrelationContext>
): StructuredLogger {
  const log = (level: LogLevel, message: string, data?: Record<string, unknown>, error?: Error) => {
    const entry: LogEntry = {
      level,
      message,
      context: {
        ...defaultContext,
        service,
        timestamp: new Date().toISOString(),
        correlationId: defaultContext?.correlationId || 'system',
      },
      data,
      error,
    };

    // Send to global log transporter if available
    if (globalLogTransporter) {
      try {
        globalLogTransporter(entry);
      } catch (error) {
        // Fallback to console if transporter fails
        console.error('Log transporter error:', error);
      }
    }

    // Always log to console as well (can be disabled in production)
    const logData = {
      ...entry.context,
      level: entry.level.toUpperCase(),
      message: entry.message,
      ...(entry.data && { data: entry.data }),
      ...(entry.error && {
        error: {
          name: entry.error.name,
          message: entry.error.message,
          stack: entry.error.stack,
        },
      }),
    };

    // Only log to console if not in production or if explicitly enabled
    const shouldLogToConsole = 
      process.env.NODE_ENV !== 'production' || 
      process.env.LOG_TO_CONSOLE === 'true';

    if (shouldLogToConsole) {
      switch (level) {
        case 'debug':
          console.debug(JSON.stringify(logData));
          break;
        case 'info':
          console.info(JSON.stringify(logData));
          break;
        case 'warn':
          console.warn(JSON.stringify(logData));
          break;
        case 'error':
          console.error(JSON.stringify(logData));
          break;
      }
    }
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) => log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) => log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) => log('warn', message, data),
    error: (message: string, error?: Error, data?: Record<string, unknown>) => 
      log('error', message, data, error),
  };
}

/**
 * Parse structured logs for debugging
 */
export function parseStructuredLog(logLine: string): LogEntry | null {
  try {
    const parsed = JSON.parse(logLine);
    return {
      level: parsed.level?.toLowerCase() as LogLevel || 'info',
      message: parsed.message,
      context: {
        correlationId: parsed.correlationId,
        timestamp: parsed.timestamp,
        service: parsed.service,
        userId: parsed.userId,
        sessionId: parsed.sessionId,
      },
      data: parsed.data,
      error: parsed.error,
    };
  } catch {
    return null;
  }
}