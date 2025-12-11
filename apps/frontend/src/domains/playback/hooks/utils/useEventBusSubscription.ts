/**
 * EventBus Subscription Utilities
 *
 * Provides stable, memoized patterns for subscribing to EventBus events
 * in React hooks. These utilities prevent unnecessary rerenders by using
 * refs for callbacks and proper cleanup.
 *
 * @module playback/hooks/utils/useEventBusSubscription
 */

import { useCallback, useEffect, useRef } from 'react';
import { WindowRegistry } from '../../services/WindowRegistry.js';
import type { EventBus } from '../../services/core/eventBus/EventBus.js';

/**
 * Single event subscription with stable callback
 *
 * Uses a ref to store the handler, ensuring the subscription doesn't change
 * when the handler function is recreated. This prevents unnecessary
 * unsubscribe/resubscribe cycles.
 *
 * @param eventName - The event to subscribe to
 * @param handler - The handler function (can change without causing resubscription)
 * @param enabled - Whether the subscription is active (default: true)
 *
 * @example
 * ```tsx
 * useEventBusSubscription(
 *   'transport:position-updated',
 *   (data) => console.log(data.position),
 *   isPlaying
 * );
 * ```
 */
export function useEventBusSubscription<T = unknown>(
  eventName: string,
  handler: (data: T) => void,
  enabled = true,
): void {
  // Store handler in ref to avoid dependency changes
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      return;
    }

    const eventBus = coreServices.getEventBus() as EventBus;
    if (!eventBus) {
      return;
    }

    // Create stable handler that delegates to ref
    const stableHandler = (data: T) => {
      handlerRef.current(data);
    };

    const unsubscribe = eventBus.on(eventName, stableHandler);

    return () => {
      unsubscribe();
    };
  }, [eventName, enabled]);
}

/**
 * Event subscription configuration
 */
export interface EventSubscription<T = unknown> {
  /** Event name to subscribe to */
  event: string;
  /** Handler function */
  handler: (data: T) => void;
}

/**
 * Batch subscription to multiple events
 *
 * Subscribes to multiple events at once, all managed by a single effect.
 * Handlers are stored in refs to prevent dependency changes.
 *
 * @param subscriptions - Array of event/handler pairs
 * @param enabled - Whether subscriptions are active (default: true)
 *
 * @example
 * ```tsx
 * const handleStart = useCallback(() => setIsPlaying(true), []);
 * const handleStop = useCallback(() => setIsPlaying(false), []);
 *
 * useEventBusSubscriptions([
 *   { event: 'transport:start', handler: handleStart },
 *   { event: 'transport:stop', handler: handleStop },
 * ]);
 * ```
 */
export function useEventBusSubscriptions(
  subscriptions: EventSubscription[],
  enabled = true,
): void {
  // Store subscriptions in ref for stable reference
  const subscriptionsRef = useRef(subscriptions);
  subscriptionsRef.current = subscriptions;

  useEffect(() => {
    if (!enabled || subscriptionsRef.current.length === 0) {
      return;
    }

    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      return;
    }

    const eventBus = coreServices.getEventBus() as EventBus;
    if (!eventBus) {
      return;
    }

    // Subscribe to all events
    const unsubscribers = subscriptionsRef.current.map(({ event, handler }) => {
      // Create stable handler that delegates to current ref
      const stableHandler = (data: unknown) => {
        // Find current handler (may have been updated)
        const currentSub = subscriptionsRef.current.find(
          (s) => s.event === event,
        );
        if (currentSub) {
          currentSub.handler(data);
        }
      };

      return eventBus.on(event, stableHandler);
    });

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
    // Only re-run if enabled changes or subscription count changes
  }, [enabled, subscriptions.length]);
}

/**
 * Create a memoized event handler factory
 *
 * Returns a stable callback that can be passed to EventBus subscriptions
 * without causing resubscriptions when dependencies change.
 *
 * @param handler - The handler function
 * @returns Stable callback reference
 *
 * @example
 * ```tsx
 * const handlePosition = useStableCallback((data: PositionUpdate) => {
 *   setPosition(data.position);
 * });
 * ```
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  handler: T,
): T {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useCallback(
    ((...args: Parameters<T>) => {
      return handlerRef.current(...args);
    }) as T,
    [],
  );
}

/**
 * Hook that returns the EventBus instance with caching
 *
 * @returns EventBus instance or null if not available
 */
export function useEventBus(): EventBus | null {
  const eventBusRef = useRef<EventBus | null>(null);

  if (!eventBusRef.current) {
    const coreServices = WindowRegistry.getCoreServices();
    if (coreServices) {
      eventBusRef.current = coreServices.getEventBus() as EventBus;
    }
  }

  return eventBusRef.current;
}
