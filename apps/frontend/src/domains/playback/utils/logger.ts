/**
 * Centralized logging utility for the playback domain
 * Controls log verbosity and formatting
 */

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  VERBOSE = 4,
}

export interface LoggerConfig {
  level: LogLevel;
  enableTimestamps: boolean;
  enableDuplicateFiltering: boolean;
  duplicateWindowMs: number;
  compactInitialization: boolean;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig = {
    level: LogLevel.ERROR, // Only show errors
    enableTimestamps: false,
    enableDuplicateFiltering: true,
    duplicateWindowMs: 100,
    compactInitialization: true,
  };

  private recentLogs = new Map<string, number>();
  private initializationLogs = new Set<string>();
  private initPhaseActive = true;

  private constructor() {
    // Set initial log level based on environment
    if (
      typeof window !== 'undefined' &&
      window.location.hostname === 'localhost'
    ) {
      this.config.level = LogLevel.ERROR; // Only errors
    } else {
      this.config.level = LogLevel.ERROR;
    }

    // Deactivate init phase after 5 seconds
    setTimeout(() => {
      this.initPhaseActive = false;
      this.initializationLogs.clear();
    }, 5000);
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  public setCompactInitialization(enabled: boolean): void {
    this.config.compactInitialization = enabled;
  }

  public getLevel(): LogLevel {
    return this.config.level;
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.config.level;
  }

  private isDuplicate(message: string): boolean {
    if (!this.config.enableDuplicateFiltering) return false;
    if (!message || typeof message !== 'string') return false;

    const now = Date.now();
    const lastTime = this.recentLogs.get(message);

    if (lastTime && now - lastTime < this.config.duplicateWindowMs) {
      return true;
    }

    this.recentLogs.set(message, now);

    // Clean up old entries
    if (this.recentLogs.size > 100) {
      const cutoff = now - this.config.duplicateWindowMs * 10;
      for (const [msg, time] of this.recentLogs) {
        if (time < cutoff) {
          this.recentLogs.delete(msg);
        }
      }
    }

    return false;
  }

  private isInitializationLog(message: string): boolean {
    if (!message || typeof message !== 'string') return false;

    const initPatterns = [
      'Initializing',
      'Loading',
      'Ensuring AudioContext',
      'Creating',
      'Registering',
      'Setting up',
      'Configuring',
      'Transport instance',
      'loaded successfully',
      'initialized successfully',
      'Starting initialization',
      'Widget',
      'Ready',
      'Layer v',
      'velocity',
      'Sampler',
      'successfully',
      'Processor',
      'Context',
      'Worker',
      'calibration',
      'monitoring',
      'optimization',
      'scheduler',
      'persistence',
    ];

    return initPatterns.some((pattern) =>
      message.toLowerCase().includes(pattern.toLowerCase()),
    );
  }

  private formatMessage(
    level: LogLevel,
    prefix: string,
    message: string,
    ...args: any[]
  ): void {
    // Skip duplicate logs
    if (this.isDuplicate(message)) return;

    // Handle initialization logs
    if (
      this.config.compactInitialization &&
      this.initPhaseActive &&
      this.isInitializationLog(message)
    ) {
      // Group similar initialization logs
      const category = this.categorizeInitLog(message);
      if (this.initializationLogs.has(category)) {
        return; // Skip duplicate initialization logs
      }
      this.initializationLogs.add(category);
    }

    // Format and output based on level
    const timestamp = this.config.enableTimestamps
      ? `[${new Date().toISOString()}] `
      : '';
    const formattedMessage = `${timestamp}${prefix} ${message}`;

    switch (level) {
      case LogLevel.ERROR:
        console.error(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LogLevel.DEBUG:
      case LogLevel.VERBOSE:
        console.log(formattedMessage, ...args);
        break;
    }
  }

  private categorizeInitLog(message: string): string {
    // Categorize similar logs to prevent duplicates
    if (!message || typeof message !== 'string') return 'unknown';

    if (message.includes('AudioContext')) return 'audio-context';
    if (message.includes('Transport')) return 'transport';
    if (message.includes('sampler') || message.includes('Sampler'))
      return 'sampler';
    if (message.includes('Widget') || message.includes('widget'))
      return 'widget';
    if (message.includes('Asset') || message.includes('asset')) return 'asset';
    if (message.includes('Tone.js') || message.includes('ToneProvider'))
      return 'tone-init';
    return message.substring(0, 20); // Use first 20 chars as category
  }

  public error(prefix: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      this.formatMessage(LogLevel.ERROR, prefix, message, args);
    }
  }

  public warn(prefix: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      this.formatMessage(LogLevel.WARN, prefix, message, args);
    }
  }

  public info(prefix: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      this.formatMessage(LogLevel.INFO, prefix, message, args);
    }
  }

  public debug(prefix: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      this.formatMessage(LogLevel.DEBUG, prefix, message, args);
    }
  }

  public verbose(prefix: string, message: string, ...args: any[]): void {
    if (this.shouldLog(LogLevel.VERBOSE)) {
      this.formatMessage(LogLevel.VERBOSE, prefix, message, args);
    }
  }

  public group(
    title: string,
    logs: Array<{ prefix: string; message: string }>,
  ): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    console.group(title);
    logs.forEach(({ prefix, message }) => {
      console.info(`${prefix} ${message}`);
    });
    console.groupEnd();
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const logError = (prefix: string, message: string, ...args: any[]) =>
  logger.error(prefix, message, ...args);

export const logWarn = (prefix: string, message: string, ...args: any[]) =>
  logger.warn(prefix, message, ...args);

export const logInfo = (prefix: string, message: string, ...args: any[]) =>
  logger.info(prefix, message, ...args);

export const logDebug = (prefix: string, message: string, ...args: any[]) =>
  logger.debug(prefix, message, ...args);

export const logVerbose = (prefix: string, message: string, ...args: any[]) =>
  logger.verbose(prefix, message, ...args);

export const logGroup = (
  title: string,
  logs: Array<{ prefix: string; message: string }>,
) => logger.group(title, logs);
