/**
 * ProductionLogger - Comprehensive production logging
 * Story 3.18.5: Audio Reliability & Technical Debt Elimination
 * 
 * Professional logging system for production environments
 */

import { EventBus } from '../core/EventBus.js';
import { AudioError } from '../../errors/AudioErrors.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: number;
  level: LogLevel;
  category: string;
  message: string;
  data?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
  context?: {
    userId?: string;
    sessionId?: string;
    browserInfo?: string;
    audioState?: string;
    performance?: {
      memory?: number;
      cpu?: number;
      latency?: number;
    };
  };
}

export interface LoggerConfig {
  enabled?: boolean;
  minLevel?: LogLevel;
  maxBufferSize?: number;
  flushInterval?: number;
  enableConsole?: boolean;
  enableRemote?: boolean;
  remoteEndpoint?: string;
  contextEnricher?: () => Record<string, any>;
  sanitizers?: Array<(entry: LogEntry) => LogEntry>;
}

export interface LoggerStats {
  totalLogs: number;
  byLevel: Record<LogLevel, number>;
  byCategory: Record<string, number>;
  errors: number;
  bufferSize: number;
  lastFlush: number;
}

export class ProductionLogger {
  private static instance: ProductionLogger | null = null;
  
  private eventBus: EventBus;
  private config: Required<LoggerConfig>;
  private buffer: LogEntry[] = [];
  private stats: LoggerStats;
  private flushTimer?: NodeJS.Timeout;
  private sessionId: string;
  private isProduction: boolean;

  private readonly LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
    fatal: 4
  };

  private constructor(eventBus: EventBus, config: LoggerConfig = {}) {
    this.eventBus = eventBus;
    this.config = {
      enabled: true,
      minLevel: 'info',
      maxBufferSize: 1000,
      flushInterval: 30000, // 30 seconds
      enableConsole: process.env.NODE_ENV !== 'production',
      enableRemote: true,
      remoteEndpoint: '/api/logs',
      contextEnricher: () => ({}),
      sanitizers: [],
      ...config
    };

    this.sessionId = this.generateSessionId();
    this.isProduction = process.env.NODE_ENV === 'production';
    this.stats = this.initializeStats();

    this.setupEventListeners();
    this.startFlushTimer();
  }

  /**
   * Get singleton instance
   */
  static getInstance(eventBus: EventBus, config?: LoggerConfig): ProductionLogger {
    if (!ProductionLogger.instance) {
      ProductionLogger.instance = new ProductionLogger(eventBus, config);
    }
    return ProductionLogger.instance;
  }

  /**
   * Log debug information
   */
  debug(category: string, message: string, data?: Record<string, any>): void {
    this.log('debug', category, message, data);
  }

  /**
   * Log info
   */
  info(category: string, message: string, data?: Record<string, any>): void {
    this.log('info', category, message, data);
  }

  /**
   * Log warning
   */
  warn(category: string, message: string, data?: Record<string, any>): void {
    this.log('warn', category, message, data);
  }

  /**
   * Log error
   */
  error(category: string, message: string, error?: Error | AudioError, data?: Record<string, any>): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error instanceof AudioError ? error.code : undefined
    } : undefined;

    this.log('error', category, message, data, errorData);
  }

  /**
   * Log fatal error
   */
  fatal(category: string, message: string, error?: Error | AudioError, data?: Record<string, any>): void {
    const errorData = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: error instanceof AudioError ? error.code : undefined
    } : undefined;

    this.log('fatal', category, message, data, errorData);
    
    // Immediately flush on fatal errors
    this.flush();
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    category: string,
    message: string,
    data?: Record<string, any>,
    error?: LogEntry['error']
  ): void {
    if (!this.config.enabled) return;
    
    // Check minimum log level
    if (this.LOG_LEVELS[level] < this.LOG_LEVELS[this.config.minLevel]) {
      return;
    }

    // Create log entry
    let entry: LogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      error,
      context: this.enrichContext()
    };

    // Apply sanitizers
    for (const sanitizer of this.config.sanitizers) {
      entry = sanitizer(entry);
    }

    // Update stats
    this.updateStats(entry);

    // Console output in development
    if (this.config.enableConsole && !this.isProduction) {
      this.consoleLog(entry);
    }

    // Add to buffer
    this.buffer.push(entry);

    // Check buffer size
    if (this.buffer.length >= this.config.maxBufferSize) {
      this.flush();
    }

    // Emit to event bus for real-time monitoring
    this.eventBus.emit('logger:entry', entry);
  }

  /**
   * Enrich log context
   */
  private enrichContext(): LogEntry['context'] {
    const customContext = this.config.contextEnricher();
    
    return {
      sessionId: this.sessionId,
      browserInfo: navigator.userAgent,
      audioState: this.getAudioState(),
      performance: this.getPerformanceContext(),
      ...customContext
    };
  }

  /**
   * Get current audio state
   */
  private getAudioState(): string {
    // This would be injected or retrieved from AudioEngine
    return 'unknown';
  }

  /**
   * Get performance context
   */
  private getPerformanceContext(): LogEntry['context']['performance'] {
    const memory = performance.memory ? {
      memory: Math.round(performance.memory.usedJSHeapSize / (1024 * 1024))
    } : {};

    return {
      ...memory,
      latency: 0 // Would be retrieved from AudioEngine
    };
  }

  /**
   * Console output formatting
   */
  private consoleLog(entry: LogEntry): void {
    const styles = {
      debug: 'color: gray',
      info: 'color: blue',
      warn: 'color: orange',
      error: 'color: red',
      fatal: 'color: red; font-weight: bold'
    };

    const timestamp = new Date(entry.timestamp).toISOString();
    const prefix = `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.category}]`;

    console.log(`%c${prefix} ${entry.message}`, styles[entry.level]);
    
    if (entry.data) {
      console.log('Data:', entry.data);
    }
    
    if (entry.error) {
      console.error('Error:', entry.error);
    }
  }

  /**
   * Update statistics
   */
  private updateStats(entry: LogEntry): void {
    this.stats.totalLogs++;
    this.stats.byLevel[entry.level]++;
    
    if (!this.stats.byCategory[entry.category]) {
      this.stats.byCategory[entry.category] = 0;
    }
    this.stats.byCategory[entry.category]++;
    
    if (entry.level === 'error' || entry.level === 'fatal') {
      this.stats.errors++;
    }
    
    this.stats.bufferSize = this.buffer.length;
  }

  /**
   * Flush logs to remote
   */
  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.config.enableRemote) {
      return;
    }

    const logs = [...this.buffer];
    this.buffer = [];
    this.stats.lastFlush = Date.now();

    try {
      await this.sendToRemote(logs);
      this.eventBus.emit('logger:flushed', {
        count: logs.length,
        timestamp: Date.now()
      });
    } catch (error) {
      // Re-add logs to buffer on failure
      this.buffer.unshift(...logs);
      
      // Log the logging failure (meta!)
      this.eventBus.emit('logger:flush-failed', { error });
    }
  }

  /**
   * Send logs to remote endpoint
   */
  private async sendToRemote(logs: LogEntry[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    const response = await fetch(this.config.remoteEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        logs,
        sessionId: this.sessionId,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      throw new Error(`Log upload failed: ${response.status}`);
    }
  }

  /**
   * Start flush timer
   */
  private startFlushTimer(): void {
    if (this.flushTimer) return;

    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Log audio events
    this.eventBus.on('audio:initialized', (data) => {
      this.info('audio', 'Audio engine initialized', data);
    });

    this.eventBus.on('audio:error', ({ error }) => {
      this.error('audio', 'Audio error occurred', error);
    });

    this.eventBus.on('audio:state-changed', (data) => {
      this.debug('audio', 'Audio state changed', data);
    });

    // Log performance events
    this.eventBus.on('performance:warning', (data) => {
      this.warn('performance', 'Performance warning', data);
    });

    // Log window events
    if (typeof window !== 'undefined') {
      window.addEventListener('error', (event) => {
        this.error('window', 'Uncaught error', new Error(event.message), {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.error('window', 'Unhandled promise rejection', 
          event.reason instanceof Error ? event.reason : new Error(String(event.reason))
        );
      });

      // Flush on page unload
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  /**
   * Generate session ID
   */
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Initialize stats
   */
  private initializeStats(): LoggerStats {
    return {
      totalLogs: 0,
      byLevel: {
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0
      },
      byCategory: {},
      errors: 0,
      bufferSize: 0,
      lastFlush: 0
    };
  }

  /**
   * Get current statistics
   */
  getStats(): LoggerStats {
    return { ...this.stats };
  }

  /**
   * Export logs for debugging
   */
  exportLogs(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
    this.stats.bufferSize = 0;
  }

  /**
   * Dispose logger
   */
  dispose(): void {
    this.stopFlushTimer();
    this.flush();
    this.clearBuffer();
    ProductionLogger.instance = null;
  }
}