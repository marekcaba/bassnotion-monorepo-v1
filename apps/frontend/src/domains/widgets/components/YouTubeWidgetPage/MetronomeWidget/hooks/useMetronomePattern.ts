'use client';

/**
 * useMetronomePattern Hook
 *
 * Creates metronome patterns based on time signature and subdivision settings.
 * Generates pattern events for one bar that can be used by the playback engine.
 *
 * @example
 * const { createMetronomePattern } = useMetronomePattern({
 *   beats: 4,
 *   noteValue: 4,
 *   subdivisions: 1,
 * });
 *
 * const pattern = createMetronomePattern();
 */

import { useCallback } from 'react';
import { toMusicalPosition } from '@/domains/playback/types/pattern';
import type {
  MetronomePattern,
  MetronomePatternEvent,
  UseMetronomePatternOptions,
  UseMetronomePatternReturn,
} from '../types.js';

/**
 * Hook for creating metronome patterns
 */
export function useMetronomePattern(
  options: UseMetronomePatternOptions
): UseMetronomePatternReturn {
  const { beats, noteValue, subdivisions } = options;

  /**
   * Create a metronome pattern based on current settings
   */
  const createMetronomePattern = useCallback((): MetronomePattern => {
    const pattern: MetronomePattern = {
      id: 'metronome-pattern',
      events: [],
      timeSignature: {
        numerator: beats,
        denominator: noteValue,
      },
    };

    // Generate pattern events for one bar
    for (let beat = 0; beat < beats; beat++) {
      for (let subdiv = 0; subdiv < subdivisions; subdiv++) {
        const isAccent = beat === 0 && subdiv === 0;
        // Convert subdivision to sixteenths
        const sixteenth = subdiv * (16 / subdivisions / noteValue) * 4;

        const event: MetronomePatternEvent = {
          position: toMusicalPosition(0, beat, Math.round(sixteenth)),
          type: isAccent ? 'accent' : 'click',
          velocity: isAccent ? 0.8 : 0.6,
          duration: '16n',
        };

        pattern.events.push(event);
      }
    }

    return pattern;
  }, [beats, noteValue, subdivisions]);

  return {
    createMetronomePattern,
  };
}
