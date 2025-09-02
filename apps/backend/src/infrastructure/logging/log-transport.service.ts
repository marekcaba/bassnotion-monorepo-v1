import { Injectable } from '@nestjs/common';
import { LogAggregatorService } from './log-aggregator.service.js';

/**
 * Service that connects the structured logger to the log aggregator
 */
@Injectable()
export class LogTransportService {
  private originalConsole = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error };

  constructor(
    private readonly logAggregator: LogAggregatorService,
  ) {
    this.interceptConsoleLogs();
  }

  /**
   * Intercept console logs and send them to the aggregator
   */
  private interceptConsoleLogs(): void {
    // Only intercept in production or when LOG_AGGREGATION is enabled
    const shouldIntercept = 
      process.env.NODE_ENV === 'production' || 
      process.env.LOG_AGGREGATION === 'true';

    if (!shouldIntercept) {
      return;
    }

    // Override console methods to capture structured logs
    console.debug = this.createInterceptor('debug');
    console.info = this.createInterceptor('info');
    console.warn = this.createInterceptor('warn');
    console.error = this.createInterceptor('error');
  }

  /**
   * Create an interceptor for a specific log level
   */
  private createInterceptor(level: 'debug' | 'info' | 'warn' | 'error') {
    return (...args: any[]) => {
      // Call original console method
      this.originalConsole[level](...args);

      // Parse structured log if it's JSON
      if (args.length === 1 && typeof args[0] === 'string') {
        try {
          const parsed = JSON.parse(args[0]);
          
          // Check if it's a structured log
          if (parsed.service && parsed.message && parsed.correlationId) {
            this.logAggregator.log({
              timestamp: parsed.timestamp || new Date().toISOString(),
              level: parsed.level || level.toUpperCase(),
              service: parsed.service,
              message: parsed.message,
              correlationId: parsed.correlationId,
              userId: parsed.userId,
              sessionId: parsed.sessionId,
              data: parsed.data,
              error: parsed.error }).catch(() => {
              // Ignore aggregator errors to prevent loops
            });
          }
        } catch {
          // Not JSON, ignore
        }
      }
    };
  }

  /**
   * Log a message directly to the aggregator
   */
  async log(
    level: string,
    service: string,
    message: string,
    options?: {
      correlationId?: string;
      userId?: string;
      sessionId?: string;
      data?: Record<string, any>;
      error?: Error;
    }
  ): Promise<void> {
    await this.logAggregator.log({
      timestamp: new Date().toISOString(),
      level: level.toUpperCase(),
      service,
      message,
      correlationId: options?.correlationId || 'system',
      userId: options?.userId,
      sessionId: options?.sessionId,
      data: options?.data,
      error: options?.error ? {
        name: options.error.name,
        message: options.error.message,
        stack: options.error.stack } : undefined });
  }

  /**
   * Create a logger instance that sends to the aggregator
   */
  createLogger(service: string, defaultContext?: Record<string, any>) {
    return {
      debug: (message: string, data?: Record<string, any>) => 
        this.log('debug', service, message, { ...defaultContext, data }),
      info: (message: string, data?: Record<string, any>) => 
        this.log('info', service, message, { ...defaultContext, data }),
      warn: (message: string, data?: Record<string, any>) => 
        this.log('warn', service, message, { ...defaultContext, data }),
      error: (message: string, error?: Error, data?: Record<string, any>) => 
        this.log('error', service, message, { ...defaultContext, error, data }) };
  }
}