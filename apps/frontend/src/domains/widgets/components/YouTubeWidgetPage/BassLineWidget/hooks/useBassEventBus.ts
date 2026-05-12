'use client';

/**
 * useBassEventBus Hook
 *
 * Handles EventBus subscriptions for bass trigger events:
 * - Listens for bass-trigger events from RegionProcessor/BassScheduler
 * - Updates visual feedback when notes are triggered
 * - Manages note highlight timing
 *
 * @example
 * useBassEventBus({
 *   audioContextRef,
 *   samplerReady,
 *   trackIsPlaying,
 *   onNoteTrigger,
 *   onSelectedNotesChange,
 * });
 */

import { useEffect } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { getLogger } from '@/utils/logger.js';
import type { UseBassEventBusOptions, UseBassEventBusReturn, BassNote } from '../types.js';

const logger = getLogger('bassline-widget');

/**
 * EventBus bass trigger event payload
 */
interface BassTriggerEvent {
  midiNote?: number;
  note?: number;
  velocity?: number;
  duration?: number;
  audioTime?: number;
  string?: number;
  fret?: number;
  beat?: number;
}

/**
 * Hook for handling EventBus bass trigger events
 */
export function useBassEventBus(options: UseBassEventBusOptions): UseBassEventBusReturn {
  const {
    audioContextRef,
    samplerReady,
    trackIsPlaying,
    onNoteTrigger,
    onSelectedNotesChange,
  } = options;

  /**
   * Subscribe to bass trigger events from the transport/track system
   */
  useEffect(() => {
    if (!samplerReady) return;

    // Get EventBus instance
    const eventBus = WindowRegistry.getCoreServices()?.getEventBus?.();
    if (!eventBus) {
      logger.warn('EventBus not available for bass triggers');
      return;
    }

    /**
     * Handle bass trigger events from RegionProcessor/BassScheduler
     */
    const handleBassTrigger = (event: BassTriggerEvent) => {
      logger.debug('Bass received trigger event:', event);

      const context = audioContextRef.current;
      if (!context) return;

      // Extract event data
      const midiNote = event.midiNote ?? event.note ?? 28;
      const duration = event.duration ?? 0.5;
      const audioTime = event.audioTime ?? context.currentTime;
      const stringNum = event.string;
      const fret = event.fret;

      // Calculate delay for visual feedback timing
      const currentTime = context.currentTime;
      const delay = Math.max(0, (audioTime - currentTime) * 1000);

      setTimeout(() => {
        if (trackIsPlaying) {
          // Set currently playing note for highlight animation
          if (stringNum !== undefined && fret !== undefined) {
            onNoteTrigger({ midiNote, string: stringNum, fret }, duration);

            // Update selected notes for visual feedback
            const noteForVisualization: BassNote = {
              note: midiNote,
              string: stringNum,
              fret,
              beat: event.beat || 0,
            };
            onSelectedNotesChange([noteForVisualization]);
          }
        }
      }, delay);
    };

    // Subscribe to bass trigger events
    const unsubscribe = eventBus.on('bass-trigger', handleBassTrigger);
    logger.info('Bass widget subscribed to trigger events');

    return () => {
      unsubscribe();
      logger.debug('Bass widget unsubscribed from trigger events');
    };
  }, [samplerReady, trackIsPlaying, audioContextRef, onNoteTrigger, onSelectedNotesChange]);

  // No return values - all state updates via callbacks
  return {};
}
