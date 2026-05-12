'use client';

/**
 * useTimeSignature Hook
 *
 * Manages time signature state for the metronome widget.
 * Syncs with external time signature props when provided.
 *
 * @example
 * const { beats, noteValue, setBeats, setNoteValue } = useTimeSignature({
 *   timeSignature: props.timeSignature,
 *   defaultBeats: 4,
 *   defaultNoteValue: 4,
 * });
 */

import { useState, useEffect } from 'react';
import { getLogger } from '@/utils/logger.js';
import type {
  UseTimeSignatureOptions,
  UseTimeSignatureReturn,
} from '../types.js';

const logger = getLogger('metronome-widget');

/**
 * Hook for managing time signature state
 */
export function useTimeSignature(
  options: UseTimeSignatureOptions
): UseTimeSignatureReturn {
  const {
    timeSignature,
    defaultBeats = 4,
    defaultNoteValue = 4,
  } = options;

  const [beats, setBeats] = useState(timeSignature?.numerator || defaultBeats);
  const [noteValue, setNoteValue] = useState(
    timeSignature?.denominator || defaultNoteValue
  );

  // Update time signature when prop changes
  useEffect(() => {
    if (timeSignature) {
      logger.debug('Time signature changed from props:', timeSignature);
      setBeats(timeSignature.numerator);
      setNoteValue(timeSignature.denominator);
    }
  }, [timeSignature?.numerator, timeSignature?.denominator]);

  return {
    beats,
    noteValue,
    setBeats,
    setNoteValue,
  };
}
