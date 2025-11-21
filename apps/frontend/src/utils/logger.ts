/**
 * Centralized logging utility for BassNotion
 * Controls log levels and formatting across the application
 */

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4,
  VERBOSE = 5,
}

export interface LoggerConfig {
  level: LogLevel;
  enabledCategories: Set<string>;
  disabledCategories: Set<string>;
  useEmojis: boolean;
  useColors: boolean;
  showTimestamp: boolean;
  production: boolean;
}

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private categoryLoggers: Map<string, CategoryLogger> = new Map();

  private constructor() {
    // Default noisy categories to suppress
    const defaultDisabledCategories = new Set([
      'FretboardCard',
      'useFretboard',
      'useFretboardExercise',
      // 'global-controls', // TEMPORARILY ENABLED to debug exercise MIDI loading
      'youtube-widget',
      'CoreServices',
      'EventBus',
      'CircuitBreaker',
      'CacheMonitor',
      'WidgetSyncService',
      'TransportClock',
      'SyncedWidget',
      'DebugUtils',
      // 'GlobalSampleCache', // TEMPORARILY ENABLED to see cache operations
      // 'InitialSamplePreloader', // TEMPORARILY ENABLED to see performance timing logs
    ]);

    // Get log level from environment
    const envLogLevel = process.env.NEXT_PUBLIC_LOG_LEVEL?.toUpperCase();
    let defaultLevel = LogLevel.ERROR; // Default to ERROR

    if (envLogLevel) {
      // Map environment string to LogLevel enum
      switch(envLogLevel) {
        case 'ERROR': defaultLevel = LogLevel.ERROR; break;
        case 'WARN': defaultLevel = LogLevel.WARN; break;
        case 'INFO': defaultLevel = LogLevel.INFO; break;
        case 'DEBUG': defaultLevel = LogLevel.DEBUG; break;
        case 'VERBOSE': defaultLevel = LogLevel.VERBOSE; break;
        default: defaultLevel = LogLevel.ERROR;
      }
    }

    // Default configuration - ERROR level to reduce noise
    this.config = {
      level: defaultLevel, // Use environment or default to ERROR
      enabledCategories: new Set(['*']), // All categories enabled by default
      disabledCategories: defaultDisabledCategories,
      useEmojis: process.env.NODE_ENV !== 'production',
      useColors: true,
      showTimestamp: false,
      production: process.env.NODE_ENV === 'production',
    };

    // Load config from localStorage if available
    if (typeof window !== 'undefined') {
      this.loadConfig();
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Get or create a logger for a specific category
   */
  getLogger(category: string): CategoryLogger {
    if (!this.categoryLoggers.has(category)) {
      this.categoryLoggers.set(category, new CategoryLogger(category, this));
    }
    return this.categoryLoggers.get(category)!;
  }

  /**
   * Configure logger settings
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
    this.saveConfig();
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
    this.saveConfig();
  }

  /**
   * Enable specific categories
   */
  enableCategories(...categories: string[]): void {
    categories.forEach((cat) => {
      this.config.enabledCategories.add(cat);
      this.config.disabledCategories.delete(cat);
    });
    this.saveConfig();
  }

  /**
   * Disable specific categories
   */
  disableCategories(...categories: string[]): void {
    categories.forEach((cat) => {
      this.config.disabledCategories.add(cat);
      this.config.enabledCategories.delete(cat);
    });
    this.saveConfig();
  }

  /**
   * Check if a category should log
   */
  shouldLog(category: string, level: LogLevel): boolean {
    // Check log level
    if (level > this.config.level) {
      return false;
    }

    // Check if category is explicitly disabled
    if (this.config.disabledCategories.has(category)) {
      return false;
    }

    // Check if all categories are enabled
    if (this.config.enabledCategories.has('*')) {
      return true;
    }

    // Check if specific category is enabled
    return this.config.enabledCategories.has(category);
  }

  /**
   * Get current configuration
   */
  getConfig(): LoggerConfig {
    return { ...this.config };
  }

  /**
   * Format log message
   */
  formatMessage(
    category: string,
    level: LogLevel,
    message: string,
    data?: any,
  ): string {
    const parts: string[] = [];

    // Timestamp
    if (this.config.showTimestamp) {
      parts.push(`[${new Date().toISOString()}]`);
    }

    // Category
    if (this.config.useColors) {
      parts.push(`[${category}]`);
    } else {
      parts.push(`[${category}]`);
    }

    // Emoji (if enabled and not in production)
    if (this.config.useEmojis && !this.config.production) {
      const emoji = this.getEmoji(category, level);
      if (emoji) {
        parts.push(emoji);
      }
    }

    // Message
    parts.push(message);

    return parts.join(' ');
  }

  private getEmoji(category: string, level: LogLevel): string {
    // Level-based emojis
    if (level === LogLevel.ERROR) return '❌';
    if (level === LogLevel.WARN) return '⚠️';

    // Category-based emojis
    const emojiMap: Record<string, string> = {
      transport: '🎵',
      audio: '🔊',
      timing: '⏱️',
      worklet: '🎯',
      service: '⚙️',
      ui: '🎨',
      network: '🌐',
      storage: '💾',
      performance: '📊',
      security: '🔒',
    };

    return emojiMap[category] || '📝';
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem('bassnotion:logger:config');
      if (stored) {
        const parsed = JSON.parse(stored);
        const disabledCats = new Set(parsed.disabledCategories || []);

        // FORCE ENABLE these categories for debugging (override localStorage)
        disabledCats.delete('GlobalSampleCache');
        disabledCats.delete('InitialSamplePreloader');

        this.config = {
          ...this.config,
          ...parsed,
          enabledCategories: new Set(parsed.enabledCategories || ['*']),
          disabledCategories: disabledCats,
        };
      }
    } catch (e) {
      // Ignore errors
    }
  }

  private saveConfig(): void {
    try {
      const toStore = {
        ...this.config,
        enabledCategories: Array.from(this.config.enabledCategories),
        disabledCategories: Array.from(this.config.disabledCategories),
      };
      localStorage.setItem('bassnotion:logger:config', JSON.stringify(toStore));
    } catch (e) {
      // Ignore errors
    }
  }
}

/**
 * Category-specific logger
 */
export class CategoryLogger {
  constructor(
    private category: string,
    private logger: Logger,
  ) {}

  error(message: string, data?: any): void {
    this.log(LogLevel.ERROR, message, data);
  }

  warn(message: string, data?: any): void {
    this.log(LogLevel.WARN, message, data);
  }

  info(message: string, data?: any): void {
    this.log(LogLevel.INFO, message, data);
  }

  debug(message: string, data?: any): void {
    this.log(LogLevel.DEBUG, message, data);
  }

  verbose(message: string, data?: any): void {
    this.log(LogLevel.VERBOSE, message, data);
  }

  private log(level: LogLevel, message: string, data?: any): void {
    if (!this.logger.shouldLog(this.category, level)) {
      return;
    }

    const formatted = this.logger.formatMessage(
      this.category,
      level,
      message,
      data,
    );

    // Use appropriate console method
    switch (level) {
      case LogLevel.ERROR:
        console.error(formatted, data ? data : '');
        break;
      case LogLevel.WARN:
        console.warn(formatted, data ? data : '');
        break;
      default:
        console.log(formatted, data ? data : '');
    }
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience functions
export const getLogger = (category: string) => logger.getLogger(category);

// Development helpers - make logger available on window but don't log about it
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
  (window as any).logger = logger;
  (window as any).LogLevel = LogLevel;
  // Removed console.log statements to reduce initial noise
}
