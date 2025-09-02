import { generateCorrelationId, createStructuredLogger } from '@bassnotion/contracts';
import * as Sentry from '@sentry/nextjs';

const logger = createStructuredLogger('GlobalErrorHandler');

export interface ErrorWithCorrelation extends Error {
  correlationId?: string;
}

/**
 * Global error handler that ensures all errors have correlation IDs
 */
export class GlobalErrorHandler {
  private static instance: GlobalErrorHandler;
  
  private constructor() {
    this.setupGlobalHandlers();
  }
  
  static getInstance(): GlobalErrorHandler {
    if (!GlobalErrorHandler.instance) {
      GlobalErrorHandler.instance = new GlobalErrorHandler();
    }
    return GlobalErrorHandler.instance;
  }
  
  private setupGlobalHandlers() {
    // Handle unhandled promise rejections
    if (typeof window !== 'undefined') {
      window.addEventListener('unhandledrejection', (event) => {
        const correlationId = generateCorrelationId();
        const error = event.reason instanceof Error 
          ? event.reason 
          : new Error(String(event.reason));
        
        this.handleError(error, correlationId, 'unhandledrejection');
        
        // Prevent default browser behavior
        event.preventDefault();
      });
      
      // Handle global errors
      window.addEventListener('error', (event) => {
        const correlationId = generateCorrelationId();
        
        this.handleError(event.error, correlationId, 'window.error', {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        });
        
        // Prevent default browser behavior
        event.preventDefault();
      });
    }
  }
  
  /**
   * Central error handling method
   */
  handleError(
    error: Error | ErrorWithCorrelation,
    correlationId?: string,
    source?: string,
    additionalContext?: Record<string, any>
  ) {
    const errorCorrelationId = correlationId || (error as ErrorWithCorrelation).correlationId || generateCorrelationId();
    
    // Add correlation ID to error object
    (error as ErrorWithCorrelation).correlationId = errorCorrelationId;
    
    // Log with structured logger
    logger.error(`Error from ${source || 'unknown source'}`, error, {
      correlationId: errorCorrelationId,
      source,
      ...additionalContext,
    });
    
    // Send to Sentry with correlation ID
    Sentry.withScope((scope) => {
      scope.setTag('correlationId', errorCorrelationId);
      scope.setContext('errorSource', { source: source || 'unknown' });
      
      if (additionalContext) {
        scope.setContext('additionalContext', additionalContext);
      }
      
      Sentry.captureException(error);
    });
    
    return errorCorrelationId;
  }
  
  /**
   * Wrap an async function with error handling
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    componentName?: string
  ): T {
    return (async (...args: any[]) => {
      try {
        return await fn(...args);
      } catch (error) {
        const correlationId = this.handleError(
          error instanceof Error ? error : new Error(String(error)),
          undefined,
          `async-${componentName || 'function'}`
        );
        
        // Re-throw with correlation ID
        const enhancedError = error as ErrorWithCorrelation;
        enhancedError.correlationId = correlationId;
        throw enhancedError;
      }
    }) as T;
  }
  
  /**
   * Create a component-specific error handler
   */
  createComponentErrorHandler(componentName: string) {
    const componentLogger = createStructuredLogger(componentName);
    
    return {
      handleError: (error: Error, correlationId?: string, context?: Record<string, any>) => {
        const errorCorrelationId = correlationId || generateCorrelationId();
        
        componentLogger.error('Component error', error, {
          correlationId: errorCorrelationId,
          ...context,
        });
        
        return this.handleError(error, errorCorrelationId, componentName, context);
      },
      
      wrapAsync: <T extends (...args: any[]) => Promise<any>>(fn: T): T => {
        return this.wrapAsync(fn, componentName);
      },
    };
  }
}

// Initialize global error handler
export const globalErrorHandler = GlobalErrorHandler.getInstance();

/**
 * React hook for component error handling
 */
export function useComponentErrorHandler(componentName: string) {
  return globalErrorHandler.createComponentErrorHandler(componentName);
}

/**
 * Utility to ensure error has correlation ID
 */
export function ensureCorrelationId(error: Error | ErrorWithCorrelation, correlationId?: string): string {
  if ((error as ErrorWithCorrelation).correlationId) {
    return (error as ErrorWithCorrelation).correlationId!;
  }
  
  const newCorrelationId = correlationId || generateCorrelationId();
  (error as ErrorWithCorrelation).correlationId = newCorrelationId;
  return newCorrelationId;
}

/**
 * Extract correlation ID from various sources
 */
export function extractCorrelationId(
  ...sources: (string | { correlationId?: string } | Error | undefined | null)[]
): string | undefined {
  for (const source of sources) {
    if (!source) continue;
    
    if (typeof source === 'string') {
      // Check if it looks like a correlation ID (UUID format)
      if (source.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        return source;
      }
    } else if (typeof source === 'object') {
      if ('correlationId' in source && source.correlationId) {
        return source.correlationId;
      }
    }
  }
  
  return undefined;
}