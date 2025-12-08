/**
 * useDirectTransport Hook
 *
 * Performance-optimized hook for widgets that need direct access to TransportAdapter
 * without the overhead of multiple event processing layers.
 *
 * FAANG FIX: Uses memoized callbacks and stable refs to prevent:
 * - Unnecessary rerenders on every transport event
 * - Memory leaks from uncleared subscriptions
 * - Stale closures in event handlers
 *
 * @module widgets/hooks/useDirectTransport
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { TransportAdapter } from '@/domains/playback/services/core/TransportAdapter';
import type { EventBus } from '@/domains/playback/services/core/EventBus';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import {
  useEventBusSubscriptions,
  useStableCallback,
} from '@/domains/playback/hooks/utils/useEventBusSubscription.js';

/**
 * Result type for useDirectTransport hook
 */
export interface UseDirectTransportResult {
  /** Direct ref to TransportAdapter for performance-critical access */
  transportRef: React.MutableRefObject<TransportAdapter | null>;
  /** Direct ref to EventBus */
  eventBusRef: React.MutableRefObject<EventBus | null>;
  /** Whether transport is currently playing */
  isPlaying: boolean;
  /** Current tempo in BPM */
  tempo: number;
  /** Start playback */
  start: () => Promise<void>;
  /** Stop playback */
  stop: () => Promise<void>;
  /** Pause playback */
  pause: () => Promise<void>;
  /** Toggle play/pause */
  toggle: () => Promise<void>;
  /** Set tempo */
  setTempo: (bpm: number) => Promise<void>;
  /** Whether the transport is initialized and ready */
  isReady: boolean;
}

/**
 * Performance-optimized hook for direct transport access
 *
 * This hook provides:
 * - Direct refs for zero-overhead access in timing-critical code
 * - Memoized control methods that don't change between renders
 * - Minimal state updates (only on actual state changes)
 * - Proper subscription cleanup
 *
 * @example
 * ```tsx
 * const { isPlaying, start, stop, transportRef } = useDirectTransport();
 *
 * // Use refs for timing-critical code
 * const handleTick = useCallback(() => {
 *   const pos = transportRef.current?.getCurrentPosition();
 *   // ... timing-critical updates
 * }, []);
 *
 * // Use state for UI
 * return <button onClick={isPlaying ? stop : start}>{isPlaying ? 'Stop' : 'Play'}</button>;
 * ```
 */
export function useDirectTransport(): UseDirectTransportResult {
  // Refs for direct access without React re-renders
  const transportRef = useRef<TransportAdapter | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);

  // Minimal state for UI updates
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempoState] = useState(120);
  const [isReady, setIsReady] = useState(false);

  // Memoized event handlers (stable references)
  const handleStart = useCallback(() => setIsPlaying(true), []);
  const handleStop = useCallback(() => setIsPlaying(false), []);
  const handlePause = useCallback(() => setIsPlaying(false), []);
  const handleTempo = useCallback(
    (data: { tempo?: number; bpm?: number }) => {
      const newTempo = data.tempo ?? data.bpm;
      if (newTempo !== undefined) {
        setTempoState(newTempo);
      }
    },
    [],
  );

  // Initialize direct references (one-time setup)
  useEffect(() => {
    let mounted = true;
    let unsubscribers: Array<() => void> = [];

    const initializeRefs = async () => {
      // Wait for CoreServices with exponential backoff
      let attempts = 0;
      const maxAttempts = 30;

      while (attempts < maxAttempts && mounted) {
        const coreServices = WindowRegistry.getCoreServices();

        if (coreServices) {
          try {
            // Get direct references
            transportRef.current = coreServices.getUnifiedTransport();
            eventBusRef.current = coreServices.getEventBus();

            // Set initial state from transport
            if (transportRef.current && mounted) {
              setIsPlaying(transportRef.current.getState() === 'playing');
              setTempoState(transportRef.current.getTempo());
            }

            if (mounted) {
              setIsReady(true);
            }

            // Subscribe to transport events using stable handlers
            if (eventBusRef.current) {
              unsubscribers = [
                eventBusRef.current.on('transport:start', handleStart),
                eventBusRef.current.on('transport:stop', handleStop),
                eventBusRef.current.on('transport:pause', handlePause),
                eventBusRef.current.on('transport:tempo-change', handleTempo),
              ];
            }

            break;
          } catch {
            // Services not fully initialized yet, retry
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
    };

    initializeRefs();

    // Cleanup function
    return () => {
      mounted = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [handleStart, handleStop, handlePause, handleTempo]);

  // Memoized control methods (stable references)
  const start = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.start();
    }
  }, []);

  const stop = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.stop();
    }
  }, []);

  const pause = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.pause();
    }
  }, []);

  const toggle = useCallback(async () => {
    if (transportRef.current) {
      const state = transportRef.current.getState();
      if (state === 'playing') {
        await transportRef.current.pause();
      } else {
        await transportRef.current.start();
      }
    }
  }, []);

  const setTempo = useCallback(async (bpm: number) => {
    if (transportRef.current) {
      await transportRef.current.setTempo(bpm);
    }
  }, []);

  return {
    transportRef,
    eventBusRef,
    isPlaying,
    tempo,
    start,
    stop,
    pause,
    toggle,
    setTempo,
    isReady,
  };
}

/**
 * Position data structure
 */
interface PositionData {
  bars: number;
  beats: number;
  sixteenths: number;
}

/**
 * Helper hook for widgets that need position updates without React re-renders
 *
 * Uses requestAnimationFrame for smooth updates and calls the callback directly
 * instead of triggering React state updates.
 *
 * @param callback - Function to call with position data (should be memoized)
 * @param intervalMs - Minimum interval between updates (default: 50ms)
 */
export function useDirectTransportPosition(
  callback: (position: PositionData) => void,
  intervalMs = 50,
): void {
  const { transportRef, isPlaying, isReady } = useDirectTransport();

  // Use stable callback to prevent effect reruns
  const stableCallback = useStableCallback(callback);

  useEffect(() => {
    if (!isReady || !isPlaying || !transportRef.current) return;

    let rafId: number;
    let lastTime = 0;

    const updatePosition = () => {
      if (transportRef.current) {
        try {
          const pos = transportRef.current.getCurrentPosition();
          stableCallback({
            bars: pos.bars,
            beats: pos.beats,
            sixteenths: pos.sixteenths,
          });
        } catch {
          // Transport might not be fully initialized
        }
      }
    };

    const animate = (time: number) => {
      if (time - lastTime >= intervalMs) {
        updatePosition();
        lastTime = time;
      }
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isReady, isPlaying, intervalMs, stableCallback]);
}
