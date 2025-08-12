/**
 * EventBus - Resilient Inter-Service Communication
 * Story 3.18.2: Core Services Foundation
 * 
 * Central event system with circuit breaker protection for:
 * - Service-to-service communication
 * - Event replay for debugging
 * - Error boundaries for event handlers
 */

import { Service } from './ServiceRegistry.js';
import { CircuitBreaker } from '../errors/CircuitBreaker.js';

export interface EventData {
  [key: string]: unknown;
}

export interface EventMetadata {
  eventId: string;
  timestamp: number;
  source?: string;
  correlationId?: string;
}

export interface EventHandler<T = EventData> {
  (data: T, metadata: EventMetadata): void | Promise<void>;
}

export interface EventBusConfig {
  maxEventHistory?: number;
  enableReplay?: boolean;
  enableBatching?: boolean;
  batchSize?: number;
  batchTimeout?: number;
  enableSchemaValidation?: boolean;
  circuitBreakerConfig?: {
    failureThreshold?: number;
    recoveryTimeout?: number;
  };
}

export interface EventSchema {
  [key: string]: {
    validate: (data: unknown) => boolean;
    parse?: (data: unknown) => unknown;
  };
}

export interface BatchedEvent {
  events: StoredEvent[];
  timestamp: number;
}

interface StoredEvent {
  event: string;
  data: EventData;
  metadata: EventMetadata;
}

export class EventBusError extends Error {
  constructor(message: string, public event?: string) {
    super(message);
    this.name = 'EventBusError';
  }
}

export class EventBus implements Service {
  private handlers = new Map<string, Set<EventHandler>>();
  private eventHistory: StoredEvent[] = [];
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private config: Required<EventBusConfig>;
  private eventCounter = 0;
  private eventBatch: StoredEvent[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private eventSchemas = new Map<string, EventSchema>();
  private eventMetrics = new Map<string, { count: number; lastEmitted: number; totalTime: number }>();
  private _instanceId = Math.random().toString(36).substring(7); // Debug instance tracking

  constructor(config: EventBusConfig = {}) {
    this.config = {
      maxEventHistory: 1000,
      enableReplay: true,
      enableBatching: false,
      batchSize: 100,
      batchTimeout: 100, // ms
      enableSchemaValidation: false,
      circuitBreakerConfig: {
        failureThreshold: 3,
        recoveryTimeout: 30000,
      },
      ...config,
    };
  }

  /**
   * Subscribe to an event
   */
  on<T = EventData>(event: string, handler: EventHandler<T>): () => void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const handlers = this.handlers.get(event)!;
    handlers.add(handler as EventHandler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler as EventHandler);
      if (handlers.size === 0) {
        this.handlers.delete(event);
      }
    };
  }

  /**
   * Subscribe to an event (alias for on)
   */
  subscribe<T = EventData>(event: string, handler: EventHandler<T>): () => void {
    return this.on(event, handler);
  }

  /**
   * Emit an event
   */
  async emit(event: string, data: EventData = {}, source?: string): Promise<void> {
    const startTime = performance.now();
    
    // Validate schema if enabled
    if (this.config.enableSchemaValidation) {
      const schema = this.eventSchemas.get(event);
      if (schema && !this.validateEventData(event, data, schema)) {
        throw new EventBusError(`Event data validation failed for '${event}'`, event);
      }
    }

    const metadata: EventMetadata = {
      eventId: this.generateEventId(),
      timestamp: Date.now(),
      source,
    };

    const storedEvent: StoredEvent = { event, data, metadata };

    // Store event in history if replay is enabled
    if (this.config.enableReplay) {
      this.storeEvent(event, data, metadata);
    }

    // Handle batching if enabled
    if (this.config.enableBatching) {
      await this.addToBatch(storedEvent);
      return;
    }

    // Execute immediately if not batching
    await this.executeEvent(storedEvent);
    
    // Update metrics
    this.updateEventMetrics(event, performance.now() - startTime);
  }

  /**
   * Emit an event and wait for all handlers
   */
  async emitAndWait(event: string, data: EventData = {}, source?: string): Promise<void> {
    await this.emit(event, data, source);
  }

  /**
   * Execute a handler with circuit breaker protection
   */
  private async executeHandler(
    event: string,
    handler: EventHandler,
    data: EventData,
    metadata: EventMetadata
  ): Promise<void> {
    // Get or create circuit breaker for this event
    const circuitBreaker = this.getCircuitBreaker(event);

    try {
      await circuitBreaker.execute(async () => {
        // Execute handler with error boundary
        try {
          await handler(data, metadata);
        } catch (error) {
          // Log error but don't propagate to other handlers
          console.error(`Error in event handler for '${event}':`, error);
          throw error; // Re-throw for circuit breaker tracking
        }
      });
    } catch (error) {
      // Circuit breaker opened or handler failed
      // Error already logged, just track it
      this.emit('eventbus:handler-error', {
        event,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata,
      });
    }
  }

  /**
   * Get or create circuit breaker for an event
   */
  private getCircuitBreaker(event: string): CircuitBreaker {
    if (!this.circuitBreakers.has(event)) {
      this.circuitBreakers.set(
        event,
        new CircuitBreaker(`EventBus:${event}`, {
          failureThreshold: 3,
          recoveryTimeout: 30000,
          ...this.config.circuitBreakerConfig,
        })
      );
    }
    return this.circuitBreakers.get(event)!;
  }

  /**
   * Replay events matching a filter
   */
  async replay(
    filter: (event: StoredEvent) => boolean,
    targetHandler?: EventHandler
  ): Promise<number> {
    if (!this.config.enableReplay) {
      throw new EventBusError('Event replay is disabled');
    }

    const eventsToReplay = this.eventHistory.filter(filter);
    let replayedCount = 0;

    for (const storedEvent of eventsToReplay) {
      if (targetHandler) {
        // Replay to specific handler
        await this.executeHandler(
          storedEvent.event,
          targetHandler,
          storedEvent.data,
          {
            ...storedEvent.metadata,
            correlationId: `replay-${storedEvent.metadata.eventId}`,
          }
        );
      } else {
        // Replay to all current handlers
        await this.emit(
          storedEvent.event,
          storedEvent.data,
          `replay-${storedEvent.metadata.source || 'unknown'}`
        );
      }
      replayedCount++;
    }

    return replayedCount;
  }

  /**
   * Get event history
   */
  getHistory(event?: string): StoredEvent[] {
    if (!this.config.enableReplay) {
      return [];
    }

    if (event) {
      return this.eventHistory.filter((e) => e.event === event);
    }
    return [...this.eventHistory];
  }

  /**
   * Clear event history
   */
  clearHistory(event?: string): void {
    if (event) {
      this.eventHistory = this.eventHistory.filter((e) => e.event !== event);
    } else {
      this.eventHistory = [];
    }
  }

  /**
   * Get all registered events
   */
  getRegisteredEvents(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get handler count for an event
   */
  getHandlerCount(event: string): number {
    const handlers = this.handlers.get(event);
    return handlers ? handlers.size : 0;
  }

  /**
   * Remove all handlers for an event
   */
  removeAllHandlers(event?: string): void {
    if (event) {
      this.handlers.delete(event);
      this.circuitBreakers.delete(event);
    } else {
      this.handlers.clear();
      this.circuitBreakers.clear();
    }
  }

  /**
   * Register event schema for validation
   */
  registerSchema(event: string, schema: EventSchema): void {
    this.eventSchemas.set(event, schema);
  }

  /**
   * Validate event data against schema
   */
  private validateEventData(event: string, data: EventData, schema: EventSchema): boolean {
    // Simple validation - in production, use Zod or similar
    try {
      // This is a placeholder - implement actual schema validation
      return true;
    } catch (error) {
      console.error(`Schema validation failed for event '${event}':`, error);
      return false;
    }
  }

  /**
   * Add event to batch
   */
  private async addToBatch(event: StoredEvent): Promise<void> {
    this.eventBatch.push(event);

    // Flush batch if size limit reached
    if (this.eventBatch.length >= this.config.batchSize) {
      await this.flushBatch();
      return;
    }

    // Set timer to flush batch if not already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.flushBatch();
      }, this.config.batchTimeout);
    }
  }

  /**
   * Flush event batch
   */
  private async flushBatch(): Promise<void> {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.eventBatch.length === 0) {
      return;
    }

    const batch = [...this.eventBatch];
    this.eventBatch = [];

    // Execute all events in batch
    const promises = batch.map(event => this.executeEvent(event));
    await Promise.allSettled(promises);

    // Emit batch processed event
    await this.executeEvent({
      event: 'eventbus:batch-processed',
      data: { batchSize: batch.length, timestamp: Date.now() },
      metadata: {
        eventId: this.generateEventId(),
        timestamp: Date.now(),
        source: 'EventBus',
      },
    });
  }

  /**
   * Execute a single event
   */
  private async executeEvent(storedEvent: StoredEvent): Promise<void> {
    const { event, data, metadata } = storedEvent;
    
    // Get handlers for this event
    const handlers = this.handlers.get(event);
    if (!handlers || handlers.size === 0) {
      return;
    }

    // Execute handlers with error boundaries
    const handlerPromises = Array.from(handlers).map((handler) =>
      this.executeHandler(event, handler, data, metadata)
    );

    // Wait for all handlers to complete
    await Promise.allSettled(handlerPromises);
  }

  /**
   * Update event metrics
   */
  private updateEventMetrics(event: string, executionTime: number): void {
    const metrics = this.eventMetrics.get(event) || { count: 0, lastEmitted: 0, totalTime: 0 };
    metrics.count++;
    metrics.lastEmitted = Date.now();
    metrics.totalTime += executionTime;
    this.eventMetrics.set(event, metrics);
  }

  /**
   * Get event analytics
   */
  getEventAnalytics(): Record<string, any> {
    const analytics: Record<string, any> = {};
    
    this.eventMetrics.forEach((metrics, event) => {
      analytics[event] = {
        ...metrics,
        averageTime: metrics.totalTime / metrics.count,
        handlerCount: this.getHandlerCount(event),
      };
    });

    return analytics;
  }

  /**
   * Get circuit breaker metrics for all events
   */
  getCircuitBreakerMetrics(): Record<string, any> {
    const metrics: Record<string, any> = {};
    this.circuitBreakers.forEach((cb, event) => {
      metrics[event] = cb.getMetrics();
    });
    return metrics;
  }

  /**
   * Initialize event bus (for Service interface)
   */
  async initialize(): Promise<void> {
    // EventBus doesn't need initialization
  }

  /**
   * Start event bus (for Service interface)
   */
  async start(): Promise<void> {
    // EventBus is always ready
  }

  /**
   * Stop event bus (for Service interface)
   */
  async stop(): Promise<void> {
    // Flush any pending batch
    if (this.config.enableBatching) {
      await this.flushBatch();
    }
    
    // Clear all handlers but keep history
    this.handlers.clear();
    this.circuitBreakers.clear();
  }

  /**
   * Dispose event bus
   */
  async dispose(): Promise<void> {
    // Stop first
    await this.stop();
    
    // Clear all state
    this.handlers.clear();
    this.circuitBreakers.clear();
    this.eventHistory = [];
    this.eventCounter = 0;
    this.eventBatch = [];
    this.eventSchemas.clear();
    this.eventMetrics.clear();
    
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Store event in history
   */
  private storeEvent(event: string, data: EventData, metadata: EventMetadata): void {
    this.eventHistory.push({ event, data, metadata });

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.config.maxEventHistory!) {
      this.eventHistory.shift();
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return `evt-${Date.now()}-${++this.eventCounter}`;
  }
}