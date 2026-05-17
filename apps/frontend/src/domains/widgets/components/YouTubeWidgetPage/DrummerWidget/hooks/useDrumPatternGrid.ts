'use client';

/**
 * useDrumPatternGrid Hook
 *
 * Manages the drum pattern grid state including:
 * - Current pattern (from exercise or preset)
 * - Display measure for multi-measure patterns
 * - Pattern conversion from DrumHit[] to grid format
 * - Measure counting and wrapping
 */

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import type { Exercise } from '@bassnotion/contracts';
import { getLogger } from '@/utils/logger.js';
import {
  type GridPatternWithSixteenths,
  DRUM_PATTERNS,
  EMPTY_GRID_PATTERN,
} from '../types.js';
import {
  drumHitsToGridPattern,
  getPatternMeasureCount,
} from '../utils/drum-pattern-utils.js';

const logger = getLogger('useDrumPatternGrid');

/**
 * Options for the useDrumPatternGrid hook
 */
export interface UseDrumPatternGridOptions {
  /** Exercise containing drum pattern data */
  exercise?: Exercise;
  /** Preset pattern name (e.g., "Rock Steady") */
  presetPattern: string;
  /** Current measure index from playback */
  currentMeasure: number;
  /** Whether playback is active */
  isPlaying: boolean;
}

/**
 * Return type for the useDrumPatternGrid hook
 */
export interface UseDrumPatternGridReturn {
  /** Current grid pattern for display */
  currentPattern: GridPatternWithSixteenths;
  /** Update current pattern manually */
  setCurrentPattern: React.Dispatch<
    React.SetStateAction<GridPatternWithSixteenths>
  >;
  /** Whether the pattern is from an exercise (vs preset) */
  isExercisePattern: boolean;
  /** Number of measures in the exercise pattern */
  exercisePatternMeasureCount: number;
  /** Current display measure index */
  displayMeasure: number;
  /** Exercise grid pattern (if available) */
  exerciseGridPattern: GridPatternWithSixteenths | null;
  /** Toggle a drum hit at a specific position */
  toggleDrum: (drum: 'kick' | 'snare' | 'hihat', index: number) => void;
}

/**
 * Hook for managing drum pattern grid state and conversions
 */
export function useDrumPatternGrid(
  options: UseDrumPatternGridOptions,
): UseDrumPatternGridReturn {
  const { exercise, presetPattern, currentMeasure, isPlaying } = options;

  // Track which measure to display in grid (wraps around exercisePatternMeasureCount)
  const [displayMeasure, setDisplayMeasure] = useState(0);

  // Initialize with empty pattern - useEffect will populate with correct data
  const [currentPattern, setCurrentPattern] =
    useState<GridPatternWithSixteenths>(EMPTY_GRID_PATTERN);

  // Calculate how many unique measures are in the exercise drum pattern
  const exercisePatternMeasureCount = useMemo(() => {
    const drumHits = (exercise as any)?.drumPattern;
    if (!drumHits || !Array.isArray(drumHits) || drumHits.length === 0) {
      return 1;
    }
    return getPatternMeasureCount(drumHits);
  }, [exercise?.id, (exercise as any)?.drumPattern]);

  // Memoize exercise drum pattern to avoid recalculating on every render
  const exerciseGridPattern = useMemo(() => {
    // Access drum pattern data - handle multiple possible field names and formats
    const drumHits = (exercise as any)?.drumPattern;
    const legacyPattern = exercise?.drum_pattern;

    // Try DrumHit[] format first (new MIDI-converted format)
    if (drumHits && Array.isArray(drumHits) && drumHits.length > 0) {
      const beatsPerBar = exercise?.timeSignature?.numerator || 4;

      // For single-measure patterns, always show measure 0
      const measureToShow =
        exercisePatternMeasureCount === 1
          ? 0
          : displayMeasure % exercisePatternMeasureCount;

      logger.debug('🥁 Converting DrumHit[] to grid', {
        exerciseId: exercise?.id,
        hitCount: drumHits.length,
        beatsPerBar,
        displayMeasure,
        measureToShow,
        totalMeasures: exercisePatternMeasureCount,
      });

      const pattern = drumHitsToGridPattern(
        drumHits,
        beatsPerBar,
        measureToShow,
      );

      // If the target measure has no hits, fallback to measure 0
      const hasHits =
        pattern.kick.some((c) => c.main === 1 || c.sixteenth === 1) ||
        pattern.snare.some((c) => c.main === 1 || c.sixteenth === 1) ||
        pattern.hihat.some((c) => c.main === 1 || c.sixteenth === 1);

      if (!hasHits && measureToShow !== 0) {
        logger.debug(
          '🥁 Target measure has no hits, falling back to measure 0',
          {
            measureToShow,
          },
        );
        return drumHitsToGridPattern(drumHits, beatsPerBar, 0);
      }

      return pattern;
    }

    // Try legacy DrumPattern format (enabled + pattern array)
    if (
      legacyPattern?.enabled &&
      legacyPattern?.pattern &&
      legacyPattern.pattern.length > 0
    ) {
      logger.info('🥁 Converting legacy drum pattern to grid', {
        exerciseId: exercise?.id,
        hitCount: legacyPattern.pattern.length,
      });

      const createEmptyRow = () =>
        Array.from({ length: 8 }, () => ({ main: 0, sixteenth: 0 }));

      const grid: GridPatternWithSixteenths = {
        kick: createEmptyRow(),
        snare: createEmptyRow(),
        hihat: createEmptyRow(),
      };

      const bpm = exercise?.bpm || 120;
      const msPerBeat = 60000 / bpm / 2;
      const msPerSixteenth = msPerBeat / 2;

      for (const hit of legacyPattern.pattern) {
        const gridType =
          hit.type === 'kick'
            ? 'kick'
            : hit.type === 'snare'
              ? 'snare'
              : hit.type === 'hihat' ||
                  hit.type === 'crash' ||
                  hit.type === 'ride'
                ? 'hihat'
                : null;

        if (!gridType) continue;

        const sixteenthIndex = Math.floor(hit.timestamp / msPerSixteenth) % 16;
        const gridIndex = Math.floor(sixteenthIndex / 2);
        const isSixteenth = sixteenthIndex % 2 === 1;

        if (gridIndex >= 0 && gridIndex < 8) {
          if (isSixteenth) {
            grid[gridType][gridIndex].sixteenth = 1;
          } else {
            grid[gridType][gridIndex].main = 1;
          }
        }
      }

      return grid;
    }

    return null;
  }, [
    exercise?.id,
    (exercise as any)?.drumPattern,
    exercise?.drum_pattern,
    exercise?.timeSignature?.numerator,
    exercise?.bpm,
    displayMeasure,
    exercisePatternMeasureCount,
  ]);

  // Update pattern when selection changes or exercise drum data changes
  useEffect(() => {
    let newPattern: GridPatternWithSixteenths;

    if (exerciseGridPattern) {
      newPattern = exerciseGridPattern;
      logger.info('🥁 Using exercise drum pattern for grid display', {
        exerciseId: exercise?.id,
        kicks: newPattern.kick.filter((c) => c.main === 1).length,
        snares: newPattern.snare.filter((c) => c.main === 1).length,
        hihats: newPattern.hihat.filter((c) => c.main === 1).length,
      });
    } else if (exercise) {
      newPattern = EMPTY_GRID_PATTERN;
      logger.debug('🥁 Exercise has no drum data, showing empty grid');
    } else {
      newPattern =
        DRUM_PATTERNS[presetPattern as keyof typeof DRUM_PATTERNS] ||
        DRUM_PATTERNS['Rock Steady'];
      logger.debug('🥁 Using preset pattern for grid display', {
        presetPattern,
      });
    }

    setCurrentPattern(newPattern);
  }, [presetPattern, exerciseGridPattern, exercise?.id]);

  // Reset measure when exercise changes
  useEffect(() => {
    setDisplayMeasure(0);
  }, [exercise?.id]);

  // Reset display measure when stopped
  useEffect(() => {
    if (!isPlaying) {
      setDisplayMeasure(0);
    }
  }, [isPlaying]);

  // Update displayMeasure when measure changes during playback
  const prevMeasureRef = useRef(currentMeasure);
  useEffect(() => {
    if (currentMeasure !== prevMeasureRef.current) {
      prevMeasureRef.current = currentMeasure;
      if (exercisePatternMeasureCount > 1) {
        setDisplayMeasure(currentMeasure);
      }
    }
  }, [currentMeasure, exercisePatternMeasureCount]);

  // Toggle drum hit at position
  const toggleDrum = useCallback(
    (drum: 'kick' | 'snare' | 'hihat', index: number) => {
      setCurrentPattern((prev) => ({
        ...prev,
        [drum]: prev[drum].map((cell, i) =>
          i === index ? { ...cell, main: cell.main ? 0 : 1 } : cell,
        ),
      }));
    },
    [],
  );

  return {
    currentPattern,
    setCurrentPattern,
    isExercisePattern: !!exerciseGridPattern,
    exercisePatternMeasureCount,
    displayMeasure,
    exerciseGridPattern,
    toggleDrum,
  };
}
