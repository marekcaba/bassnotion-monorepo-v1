/**
 * EventScope - Scoped Event Subscriptions with Automatic Cleanup
 *
 * Part of the PlaybackSession architecture to solve the "Singleton Soup" problem.
 *
 * PROBLEM SOLVED:
 * EventBus handlers accumulate across playback runs because components
 * subscribe via eventBus.on() but don't always call the returned unsubscribe
 * function. After 100 exercise switches, the same event fires 100 times.
 *
 * SOLUTION:
 * EventScope wraps EventBus subscriptions and tracks all handlers registered
 * through this scope. When the scope is disposed (e.g., when a PlaybackSession
 * ends), ALL handlers are automatically unsubscribed.
 *
 * USAGE:
 * ```typescript
 * // Create scope tied to a PlaybackSession
 * const scope = new EventScope(eventBus);
 *
 * // Subscribe through scope (handler tracked automatically)
 * scope.on('transport:tempo-change', (data) => { ... });
 * scope.on('transport:stop', (data) => { ... });
 *
 * // When session ends, dispose scope to remove ALL handlers
 * scope.dispose(); // Both handlers removed!
 * ```
 */

import {
  EventBus,
  EventData,
  EventHandler,
  EventMetadata,
} from './EventBus.js';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('EventScope');

export interface EventScopeConfig {
  /** Name for debugging/logging */
  name?: string;
  /** Warn if handler count exceeds this (potential leak detection) */
  maxHandlers?: number;
}

export class EventScope {
  private parentBus: EventBus;
  private subscriptions: Array<() => void> = [];
  private isDisposed = false;
  private config: Required<EventScopeConfig>;
  private scopeId: string;

  constructor(parentBus: EventBus, config: EventScopeConfig = {}) {
    this.parentBus = parentBus;
    this.scopeId = `scope-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.config = {
      name: config.name || this.scopeId,
      maxHandlers: config.maxHandlers || 50,
    };

    logger.debug(`EventScope created: ${this.config.name}`, {
      scopeId: this.scopeId,
    });
  }

  /**
   * Subscribe to an event through this scope.
   * The subscription is tracked and will be automatically unsubscribed
   * when this scope is disposed.
   *
   * @param event - Event name to subscribe to
   * @param handler - Handler function to call when event fires
   * @returns Unsubscribe function (also called automatically on dispose)
   */
  on<T = EventData>(event: string, handler: EventHandler<T>): () => void {
    if (this.isDisposed) {
      logger.warn(
        `EventScope ${this.config.name} already disposed, cannot subscribe to ${event}`,
      );
      return () => {}; // Return no-op
    }

    // Subscribe via parent EventBus
    const unsubscribe = this.parentBus.on<T>(event, handler);

    // Track this subscription
    this.subscriptions.push(unsubscribe);

    // Warn if we're accumulating too many handlers (potential leak)
    if (this.subscriptions.length > this.config.maxHandlers) {
      logger.warn(
        `EventScope ${this.config.name} has ${this.subscriptions.length} handlers (max: ${this.config.maxHandlers}). Potential leak?`,
      );
    }

    logger.debug(`EventScope ${this.config.name}: Subscribed to ${event}`, {
      totalSubscriptions: this.subscriptions.length,
    });

    // Return wrapped unsubscribe that also removes from our tracking
    return () => {
      const index = this.subscriptions.indexOf(unsubscribe);
      if (index !== -1) {
        this.subscriptions.splice(index, 1);
      }
      unsubscribe();
    };
  }

  /**
   * Alias for on() to match EventBus interface
   */
  subscribe<T = EventData>(
    event: string,
    handler: EventHandler<T>,
  ): () => void {
    return this.on<T>(event, handler);
  }

  /**
   * Emit an event through the parent EventBus.
   * This is a pass-through - events emitted here are global.
   */
  emit(event: string, data: EventData = {}, source?: string): Promise<void> {
    if (this.isDisposed) {
      logger.warn(
        `EventScope ${this.config.name} already disposed, cannot emit ${event}`,
      );
      return Promise.resolve();
    }
    return this.parentBus.emit(event, data, source);
  }

  /**
   * Dispose this scope, unsubscribing ALL handlers registered through it.
   * This is the key feature that prevents handler accumulation.
   *
   * IMPORTANT: After dispose(), no new subscriptions can be made through this scope.
   */
  dispose(): void {
    if (this.isDisposed) {
      logger.debug(`EventScope ${this.config.name} already disposed`);
      return;
    }

    this.isDisposed = true;
    const handlerCount = this.subscriptions.length;

    // Unsubscribe ALL handlers registered through this scope
    for (const unsubscribe of this.subscriptions) {
      try {
        unsubscribe();
      } catch (error) {
        logger.error(
          `Error unsubscribing handler in scope ${this.config.name}:`,
          error as Error,
        );
      }
    }

    this.subscriptions = [];

    logger.info(`EventScope disposed: ${this.config.name}`, {
      scopeId: this.scopeId,
      handlersRemoved: handlerCount,
    });
  }

  /**
   * Get the number of active subscriptions in this scope.
   * Useful for debugging and leak detection.
   */
  getSubscriptionCount(): number {
    return this.subscriptions.length;
  }

  /**
   * Check if this scope has been disposed.
   */
  getIsDisposed(): boolean {
    return this.isDisposed;
  }

  /**
   * Get scope identifier for debugging.
   */
  getScopeId(): string {
    return this.scopeId;
  }

  /**
   * Get scope name for logging.
   */
  getName(): string {
    return this.config.name;
  }
}

/**
 * Create an EventScope from the global EventBus singleton.
 * Convenience factory function.
 */
export function createEventScope(name?: string): EventScope {
  const eventBus = EventBus.getGlobalInstance();
  return new EventScope(eventBus, { name });
}
