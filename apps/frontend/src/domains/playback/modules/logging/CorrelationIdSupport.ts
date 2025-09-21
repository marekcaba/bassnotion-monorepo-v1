/**
 * Enhanced Correlation ID Support for Playback Domain
 * Phase 5.1.4: Correlation ID propagation and async operation tracking
 *
 * Provides advanced correlation ID management for complex async operations,
 * cross-component communication, and distributed tracing in the playback domain.
 */

import {
  generateCorrelationId,
  CORRELATION_HEADER,
} from '@bassnotion/contracts';
import { EventBus } from '../../services/core/EventBus.js';
import { createPlaybackLogger } from './PlaybackLoggerIntegration.js';

/**
 * Correlation context for tracking related operations
 */
export interface CorrelationContext {
  correlationId: string;
  parentId?: string;
  spanId: string;
  operationName: string;
  startTime: number;
  metadata?: Record<string, any>;
  children: CorrelationContext[];
}

/**
 * Async operation wrapper with correlation tracking
 */
export interface CorrelatedOperation<T> {
  correlationId: string;
  spanId: string;
  promise: Promise<T>;
  cancel?: () => void;
}

/**
 * Enhanced correlation manager for the playback domain
 */
export class PlaybackCorrelationManager {
  private static instance: PlaybackCorrelationManager | null = null;

  private contexts: Map<string, CorrelationContext> = new Map();
  private activeOperations: Map<string, CorrelatedOperation<any>> = new Map();
  private eventBus: EventBus;
  private logger = createPlaybackLogger('CorrelationManager');

  private constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupEventListeners();
  }

  /**
   * Get singleton instance
   */
  static getInstance(eventBus: EventBus): PlaybackCorrelationManager {
    if (!PlaybackCorrelationManager.instance) {
      PlaybackCorrelationManager.instance = new PlaybackCorrelationManager(
        eventBus,
      );
    }
    return PlaybackCorrelationManager.instance;
  }

  /**
   * Create a new correlation context
   */
  createContext(
    operationName: string,
    parentId?: string,
    metadata?: Record<string, any>,
  ): CorrelationContext {
    const correlationId = parentId || generateCorrelationId();
    const spanId = generateCorrelationId();

    const context: CorrelationContext = {
      correlationId,
      parentId,
      spanId,
      operationName,
      startTime: performance.now(),
      metadata,
      children: [],
    };

    this.contexts.set(spanId, context);

    // If this has a parent, add it to parent's children
    if (parentId) {
      const parent = this.contexts.get(parentId);
      if (parent) {
        parent.children.push(context);
      }
    }

    this.logger.debug('Correlation context created', {
      correlationId,
      spanId,
      operationName,
      parentId,
    });

    return context;
  }

  /**
   * Wrap an async operation with correlation tracking
   */
  async wrapAsync<T>(
    operation: () => Promise<T>,
    operationName: string,
    parentContext?: CorrelationContext,
    metadata?: Record<string, any>,
  ): Promise<T> {
    const context = this.createContext(
      operationName,
      parentContext?.spanId,
      metadata,
    );

    const startTime = performance.now();

    try {
      // Create cancellable operation
      let cancelled = false;
      const promise = operation();

      const correlatedOp: CorrelatedOperation<T> = {
        correlationId: context.correlationId,
        spanId: context.spanId,
        promise,
        cancel: () => {
          cancelled = true;
        },
      };

      this.activeOperations.set(context.spanId, correlatedOp);

      // Emit start event
      this.eventBus.emit('correlation:operation-start', {
        correlationId: context.correlationId,
        spanId: context.spanId,
        operationName,
        parentId: context.parentId,
      });

      const result = await promise;

      if (cancelled) {
        throw new Error('Operation cancelled');
      }

      const duration = performance.now() - startTime;

      // Emit success event
      this.eventBus.emit('correlation:operation-complete', {
        correlationId: context.correlationId,
        spanId: context.spanId,
        operationName,
        duration,
        success: true,
      });

      this.logger.info('Correlated operation completed', {
        correlationId: context.correlationId,
        spanId: context.spanId,
        operationName,
        duration,
      });

      return result;
    } catch (error) {
      const duration = performance.now() - startTime;

      // Emit error event
      this.eventBus.emit('correlation:operation-error', {
        correlationId: context.correlationId,
        spanId: context.spanId,
        operationName,
        duration,
        error,
      });

      this.logger.error('Correlated operation failed', {
        correlationId: context.correlationId,
        spanId: context.spanId,
        operationName,
        duration,
        error,
      });

      throw error;
    } finally {
      this.activeOperations.delete(context.spanId);
      this.cleanupContext(context.spanId);
    }
  }

  /**
   * Create a correlation propagator for cross-component communication
   */
  createPropagator(correlationId: string): CorrelationPropagator {
    return new CorrelationPropagator(correlationId, this);
  }

  /**
   * Get active operations for a correlation ID
   */
  getActiveOperations(correlationId: string): CorrelatedOperation<any>[] {
    const operations: CorrelatedOperation<any>[] = [];

    for (const op of this.activeOperations.values()) {
      if (op.correlationId === correlationId) {
        operations.push(op);
      }
    }

    return operations;
  }

  /**
   * Cancel all operations for a correlation ID
   */
  cancelCorrelation(correlationId: string): void {
    const operations = this.getActiveOperations(correlationId);

    for (const op of operations) {
      if (op.cancel) {
        op.cancel();
      }
    }

    this.logger.info('Cancelled correlation', {
      correlationId,
      operationCount: operations.length,
    });
  }

  /**
   * Get correlation trace
   */
  getTrace(correlationId: string): CorrelationContext[] {
    const trace: CorrelationContext[] = [];

    for (const context of this.contexts.values()) {
      if (context.correlationId === correlationId) {
        trace.push(context);
      }
    }

    // Sort by start time
    trace.sort((a, b) => a.startTime - b.startTime);

    return trace;
  }

  /**
   * Clean up old contexts
   */
  private cleanupContext(spanId: string): void {
    const context = this.contexts.get(spanId);
    if (!context) return;

    // Clean up children first
    for (const child of context.children) {
      this.cleanupContext(child.spanId);
    }

    this.contexts.delete(spanId);
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Clean up old contexts periodically
    setInterval(() => {
      const cutoff = performance.now() - 300000; // 5 minutes

      for (const [spanId, context] of this.contexts.entries()) {
        if (context.startTime < cutoff && !this.activeOperations.has(spanId)) {
          this.cleanupContext(spanId);
        }
      }
    }, 60000); // Every minute
  }

  /**
   * Get statistics
   */
  getStats(): {
    activeContexts: number;
    activeOperations: number;
    correlationIds: string[];
  } {
    const correlationIds = new Set<string>();

    for (const context of this.contexts.values()) {
      correlationIds.add(context.correlationId);
    }

    return {
      activeContexts: this.contexts.size,
      activeOperations: this.activeOperations.size,
      correlationIds: Array.from(correlationIds),
    };
  }
}

/**
 * Correlation propagator for passing context between components
 */
export class CorrelationPropagator {
  constructor(
    private correlationId: string,
    private manager: PlaybackCorrelationManager,
  ) {}

  /**
   * Create a child context
   */
  createChild(
    operationName: string,
    metadata?: Record<string, any>,
  ): CorrelationContext {
    return this.manager.createContext(
      operationName,
      this.correlationId,
      metadata,
    );
  }

  /**
   * Wrap an async operation
   */
  wrapAsync<T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>,
  ): Promise<T> {
    return this.manager.wrapAsync(
      operation,
      operationName,
      { correlationId: this.correlationId } as any,
      metadata,
    );
  }

  /**
   * Add correlation headers to fetch requests
   */
  addHeaders(
    headers: Headers | Record<string, string> = {},
  ): Record<string, string> {
    const result = headers instanceof Headers ? {} : { ...headers };
    result[CORRELATION_HEADER] = this.correlationId;
    return result;
  }

  /**
   * Create a correlated fetch function
   */
  createFetch(): typeof fetch {
    const correlationId = this.correlationId;

    return async (input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      headers.set(CORRELATION_HEADER, correlationId);

      return fetch(input, {
        ...init,
        headers,
      });
    };
  }

  /**
   * Create a correlated WebSocket
   */
  createWebSocket(url: string): WebSocket {
    // Add correlation ID to URL
    const wsUrl = new URL(url);
    wsUrl.searchParams.set('correlationId', this.correlationId);

    return new WebSocket(wsUrl.toString());
  }

  /**
   * Create a correlated Worker
   */
  createWorker(scriptURL: string | URL, options?: WorkerOptions): Worker {
    const worker = new Worker(scriptURL, options);

    // Send correlation ID as first message
    worker.postMessage({
      type: 'correlation:init',
      correlationId: this.correlationId,
    });

    return worker;
  }
}

/**
 * React hook for correlation in playback components
 */
export function usePlaybackCorrelation(
  componentName: string,
  parentCorrelationId?: string,
): {
  correlationId: string;
  propagator: CorrelationPropagator;
  wrapAsync: <T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>,
  ) => Promise<T>;
} {
  const eventBus = EventBus.getInstance();
  const manager = PlaybackCorrelationManager.getInstance(eventBus);

  const correlationId = parentCorrelationId || generateCorrelationId();
  const propagator = manager.createPropagator(correlationId);

  const wrapAsync = <T>(
    operation: () => Promise<T>,
    operationName: string,
    metadata?: Record<string, any>,
  ) => {
    return propagator.wrapAsync(
      operation,
      `${componentName}.${operationName}`,
      metadata,
    );
  };

  return { correlationId, propagator, wrapAsync };
}

/**
 * Decorator for adding correlation to class methods
 */
export function Correlated(operationName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const manager = PlaybackCorrelationManager.getInstance(
        EventBus.getInstance(),
      );
      const opName =
        operationName || `${target.constructor.name}.${propertyKey}`;

      // Try to extract correlation ID from arguments
      let correlationId: string | undefined;

      // Check if first argument has correlationId
      if (args[0]?.correlationId) {
        correlationId = args[0].correlationId;
      }

      // Check if 'this' has correlationId
      if (!correlationId && (this as any).correlationId) {
        correlationId = (this as any).correlationId;
      }

      // If we have a correlation ID, use it
      if (correlationId) {
        const propagator = manager.createPropagator(correlationId);
        return propagator.wrapAsync(
          () => originalMethod.apply(this, args),
          opName,
        );
      }

      // Otherwise, create a new correlation context
      return manager.wrapAsync(() => originalMethod.apply(this, args), opName);
    };

    return descriptor;
  };
}

/**
 * Middleware for Express-like servers to extract correlation ID
 */
export function correlationMiddleware() {
  return (req: any, res: any, next: any) => {
    const correlationId =
      req.headers[CORRELATION_HEADER] || generateCorrelationId();

    req.correlationId = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);

    next();
  };
}

/**
 * Utility to create a correlated event emitter
 */
export function createCorrelatedEventEmitter(
  correlationId: string,
  eventBus: EventBus,
): {
  emit: (event: string, data?: any) => void;
  on: (event: string, handler: (data: any) => void) => void;
  off: (event: string, handler: (data: any) => void) => void;
} {
  const emit = (event: string, data?: any) => {
    eventBus.emit(event, {
      ...data,
      correlationId,
      timestamp: Date.now(),
    });
  };

  const on = (event: string, handler: (data: any) => void) => {
    const wrappedHandler = (data: any) => {
      if (data.correlationId === correlationId) {
        handler(data);
      }
    };

    eventBus.on(event, wrappedHandler);
    return wrappedHandler;
  };

  const off = (event: string, handler: (data: any) => void) => {
    eventBus.off(event, handler);
  };

  return { emit, on, off };
}
