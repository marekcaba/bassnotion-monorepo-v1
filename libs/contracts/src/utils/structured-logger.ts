/**
 * Structured Logger for consistent logging across the platform
 */

import { CorrelationContext } from './correlation.js';

// Global log transporter that can be set by the application
let globalLogTransporter: ((entry: LogEntry) => void) | null = null;

export function setGlobalLogTransporter(
  transporter: (entry: LogEntry) => void,
): void {
  globalLogTransporter = transporter;
}

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

// Numeric log levels for comparison
export enum LogLevelValue {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,
}

// Map string levels to numeric values
const LOG_LEVEL_MAP: Record<LogLevel, number> = {
  error: LogLevelValue.ERROR,
  warn: LogLevelValue.WARN,
  info: LogLevelValue.INFO,
  debug: LogLevelValue.DEBUG,
  trace: LogLevelValue.TRACE,
};

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

// Get current log level from environment
function getCurrentLogLevel(): LogLevelValue {
  // Temporarily allow INFO level for debugging
  const envLevel = process.env.NEXT_PUBLIC_LOG_LEVEL?.toUpperCase();

  switch (envLevel) {
    case 'ERROR':
      return LogLevelValue.ERROR;
    case 'WARN':
      return LogLevelValue.WARN;
    case 'INFO':
      return LogLevelValue.INFO;
    case 'DEBUG':
      return LogLevelValue.DEBUG;
    case 'TRACE':
      return LogLevelValue.TRACE;
    default:
      // Default to ERROR in production, INFO in development
      return process.env.NODE_ENV === 'production'
        ? LogLevelValue.ERROR
        : LogLevelValue.INFO;
  }
}

// Contexts that generate excessive logs
const NOISY_CONTEXTS = [
  'useWidgetPageState',
  // 'AudioProvider', // TEMPORARILY ENABLED for audio initialization debugging
  'TransportController',
  'SchedulerService',
  'MetronomeService',
  'usePlaybackControls',
  'useFretboardAnimation',
  'PositionManager',
  'TimingEngine',
  'EventScheduler',
  'SyncManager',
  'standardized-audio-context-mock',
  'useFretboard',
  'FretboardCard',
  // 'youtube-widget', // Temporarily enabled for debugging
  'global-controls',
  'useAudioContext',
  'useAudioEngine',
  'TrackStateContainer',
  'AudioContextCompatibility',
  'WamKeyboard',
  'HarmonyWidgetV2',
  'CorrelationProvider',
  'AudioSession',
  'UnifiedTransport',
  'TransportAdapter',
  'WidgetSyncService',
  'CoreServices',
  'EventBus',
  'CircuitBreaker',
  'AudioEngine',
  'Transport',
  'TransportTimeline',
  'MusicalPositionManager',
  'ToneWrapper',
  'TrackManager',
  'Track',
  'SyncedWidget',
  'SyncProvider',
  'DebugUtils',
  'FeatureFlags',
  'HealthStatus',
  'TransportClock',
  'useFretboardExercise',
  'AudioContextManager',
  'CacheMonitor',
  'GlobalSampleCache',
  'InitialSamplePreloader',
];

// Check if a context should be suppressed
function shouldSuppressContext(context: string): boolean {
  const env = process.env.NODE_ENV;

  // Never suppress in test environment
  if (env === 'test') return false;

  // In production, suppress noisy contexts unless explicitly enabled
  if (env === 'production') {
    const allowNoisy = process.env.NEXT_PUBLIC_ALLOW_NOISY_LOGS === 'true';
    if (!allowNoisy) {
      return NOISY_CONTEXTS.some((noisy) => context.includes(noisy));
    }
  }

  // In development, suppress noisy contexts by default unless explicitly enabled
  const allowNoisy = process.env.NEXT_PUBLIC_ALLOW_NOISY_LOGS === 'true';
  if (!allowNoisy) {
    return NOISY_CONTEXTS.some((noisy) => context.includes(noisy));
  }

  return false;
}

/**
 * Create a structured logger instance
 */
export function createStructuredLogger(
  service: string,
  defaultContext?: Partial<CorrelationContext>,
): StructuredLogger {
  const log = (
    level: LogLevel,
    message: string,
    data?: Record<string, unknown>,
    error?: Error,
  ) => {
    // Get current log level at runtime (not cached)
    const currentLogLevel = getCurrentLogLevel();
    const isSuppressed = shouldSuppressContext(service);

    // Check if this log level should be shown
    const levelValue = LOG_LEVEL_MAP[level];

    // Skip if below current threshold (CRITICAL FIX: Check this FIRST)
    if (levelValue > currentLogLevel) return;

    // In production/development, suppress ALL non-error logs from noisy contexts
    if (isSuppressed && level !== 'error') return;

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

    // Safe JSON.stringify replacer — strips circular references and node
    // internals (setTimeout handles, sockets, etc.) that callers sometimes
    // include in log payloads and would otherwise throw
    // "Converting circular structure to JSON".
    const seen = new WeakSet<object>();
    const safeReplacer = (_key: string, value: unknown): unknown => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value as object)) return '[Circular]';
        seen.add(value as object);
      }
      return value;
    };
    const safeStringify = (data: unknown): string => {
      try {
        return JSON.stringify(data, safeReplacer);
      } catch {
        // Last-resort fallback for values WeakSet still can't handle.
        return '[Unserializable]';
      }
    };

    // In production, use structured JSON logging
    // In development, use simpler format for readability
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      // Simple, readable format for development
      const prefix = `[${level.toUpperCase()}] [${service}]`;
      const logMessage = `${prefix} ${message}`;

      switch (level) {
        case 'error':
          console.error(logMessage, error || '', data || '');
          break;
        case 'warn':
          console.warn(logMessage, data || '');
          break;
        case 'info':
          console.info(logMessage, data || '');
          break;
        case 'debug':
          console.debug(logMessage, data || '');
          break;
        case 'trace':
          console.log(logMessage, data || '');
          break;
      }
    } else {
      // Structured JSON for production/test
      switch (level) {
        case 'error':
          console.error(safeStringify(logData));
          break;
        case 'warn':
          console.warn(safeStringify(logData));
          break;
        case 'info':
          console.info(safeStringify(logData));
          break;
        case 'debug':
          console.debug(safeStringify(logData));
          break;
        case 'trace':
          console.log(safeStringify(logData));
          break;
      }
    }
  };

  return {
    debug: (message: string, data?: Record<string, unknown>) =>
      log('debug', message, data),
    info: (message: string, data?: Record<string, unknown>) =>
      log('info', message, data),
    warn: (message: string, data?: Record<string, unknown>) =>
      log('warn', message, data),
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
      level: (parsed.level?.toLowerCase() as LogLevel) || 'info',
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
