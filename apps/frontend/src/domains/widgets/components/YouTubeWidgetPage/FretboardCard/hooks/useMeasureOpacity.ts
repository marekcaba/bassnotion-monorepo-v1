'use client';

import { useCallback, useMemo } from 'react';
import {
  MusicalTimeConverter,
  type MusicalPosition,
  type TimeSignature,
  type ExerciseNote,
} from '@bassnotion/contracts';
import type { Fret } from '../types/fretboardTypes';

/**
 * Opacity values for notes based on their measure relative to current playback
 */
export interface MeasureOpacityConfig {
  /** Opacity for the currently playing note (default: 1.0) */
  currentMeasureActive: number;
  /** Opacity for other notes in the currently playing measure (default: 0.8) */
  currentMeasureInactive: number;
  /** Opacity for notes in the currently playing measure - legacy/fallback (default: 1.0) */
  currentMeasure: number;
  /** Opacity for notes in the next measure (default: 0.3) */
  nextMeasure: number;
  /** Opacity for notes in all other measures (default: 0) */
  otherMeasures: number;
  /**
   * Beat at which to start transitioning to next measure (default: 3 for 4/4 time)
   * This gives the user time to see upcoming notes before measure changes
   */
  transitionBeat: number;
  /** Duration of the opacity transition in milliseconds (default: 250) */
  transitionDurationMs: number;
}

/**
 * Configuration for the useMeasureOpacity hook
 */
export interface UseMeasureOpacityConfig {
  /** Exercise notes with position data */
  exerciseNotes: ExerciseNote[];
  /** Current playback time in milliseconds - used for beat calculation only */
  currentTime: number;
  /** Whether playback is active */
  isPlaying: boolean;
  /** Tempo in BPM */
  tempo: number;
  /** Time signature (default: 4/4) */
  timeSignature?: TimeSignature;
  /** String count for mapping exercise strings to fretboard indices */
  stringCount: 4 | 5 | 6;
  /** Optional opacity configuration overrides */
  opacityConfig?: Partial<MeasureOpacityConfig>;
  /**
   * SINGLE SOURCE OF TRUTH: The current measure (0-based) from note-based tracking.
   * This is the authoritative source for which measure we're currently in.
   * Calculated by useFretboardExercise based on which note is playing.
   * This eliminates the flicker caused by competing time-based vs note-based calculations.
   */
  currentMeasure: number;
}

/**
 * Highlight state for a note based on its measure position
 */
export type MeasureHighlightState = 'current' | 'next' | 'other';

/**
 * Result of getMeasureHighlight function
 */
export interface MeasureHighlightResult {
  /** Whether this note should be highlighted (green) - true for current and next measure */
  shouldHighlight: boolean;
  /** The highlight state: 'current' (100%), 'next' (30%), or 'other' (grey/unhighlighted) */
  state: MeasureHighlightState;
  /** Opacity value for the highlight (1.0 for current, 0.3 for next, 1.0 for other since it's grey) */
  opacity: number;
}

/**
 * Return type for useMeasureOpacity hook
 */
export interface UseMeasureOpacityReturn {
  /** Get the opacity for a specific fretboard position */
  getNoteOpacity: (stringIndex: number, fret: Fret) => number;
  /**
   * Get the highlight state for a specific fretboard position (whether to show green or grey)
   * FLICKER FIX v14: Now accepts measure as parameter to avoid stale closure issues.
   * The caller must pass the measure explicitly for consistency with other calculations.
   */
  getMeasureHighlight: (
    stringIndex: number,
    fret: Fret,
    measure: number,
  ) => MeasureHighlightResult;
  /** Current measure being played (0-based, same as input) */
  currentMeasure: number;
  /** Current beat within the measure (1-based) */
  currentBeat: number;
  /** Whether we're in the transition zone (showing next measure at full opacity) */
  isInTransition: boolean;
  /** CSS transition duration string */
  transitionDuration: string;
}

/**
 * Default opacity configuration
 *
 * SINGLE-LAYER ARCHITECTURE: All dots are visible. Notes from "other" measures
 * are shown as GREY (opacity 1), not hidden (opacity 0).
 */
const DEFAULT_OPACITY_CONFIG: MeasureOpacityConfig = {
  currentMeasureActive: 1.0,
  currentMeasureInactive: 0.8,
  currentMeasure: 1.0, // Legacy fallback, kept for backward compatibility
  nextMeasure: 0.3,
  otherMeasures: 1, // GREY (visible) - same as non-exercise dots
  transitionBeat: 5, // Only transition AFTER beat 4 (when we cross into next measure)
  transitionDurationMs: 0, // TEMPORARY: Immediate transitions for debugging (was 250)
};

/**
 * Hook to calculate note opacity based on measure-relative playback position
 *
 * SINGLE-LAYER ARCHITECTURE: All dots are visible. Implements the following rules:
 * - Current measure: 100% opacity (highlighted green/orange)
 * - Next measure: 30% opacity (preview, highlighted)
 * - All other measures (past/future): 100% opacity (GREY - visible as non-exercise dots)
 *
 * The transition between measures happens when the measure number naturally changes
 * (crossing from beat 4 to beat 1 of the next bar). The transitionBeat config
 * controls when to start showing the next measure early (set to 5 by default to disable).
 *
 * IMPORTANT: ExerciseNote.position uses 0-based measure indexing:
 * - measure 0 = first bar/measure
 * - measure 1 = second bar/measure
 * This hook internally converts to 0-based for comparison with note data.
 *
 * @param config - Configuration for the opacity calculation
 * @returns Functions and state for managing note opacity
 */
export function useMeasureOpacity(
  config: UseMeasureOpacityConfig,
): UseMeasureOpacityReturn {
  const {
    exerciseNotes,
    currentTime,
    isPlaying,
    tempo,
    timeSignature = { numerator: 4, denominator: 4 },
    stringCount,
    opacityConfig: userConfig,
    currentMeasure: currentMeasure0Based,
  } = config;

  // Merge user config with defaults
  const opacityConfig = useMemo(
    () => ({ ...DEFAULT_OPACITY_CONFIG, ...userConfig }),
    [userConfig],
  );

  // TIME SYNC FIX: Use currentTime directly from useFretboardExercise
  // The caller (useFretboardExercise) already handles:
  // 1. RAF-based interpolation for smooth 60fps updates
  // 2. First-beat fix (forcing time to 0 on playback start)
  // 3. Race condition protection (rejecting stale events)
  // 4. Countdown duration offset (exerciseTime = rawCurrentTime - countdownDuration)
  //
  // Previously, this hook had its own first-beat fix logic that used a DIFFERENT
  // timing mechanism (performance.now() vs transport events), causing effectiveTime
  // to stay stuck at 0 while useFretboardExercise's exerciseTime was progressing.
  // This resulted in measure calculations being desynchronized.
  const effectiveTime = currentTime;

  // OPACITY BUG FIX v2: Determine if playback is "effective" for opacity calculations.
  const isPlaybackEffective =
    isPlaying && effectiveTime >= 0 && !Number.isNaN(effectiveTime);

  // Calculate current musical position from playback time
  const currentPosition = useMemo((): MusicalPosition => {
    // DEBUG: Log currentTime value to understand why measure isn't updating
    // Enable with: window.__DEBUG_FRETBOARD__ = true
    if (isPlaybackEffective && (window as any).__DEBUG_FRETBOARD__) {
      console.log(
        `[OPACITY-TIME-DEBUG] effectiveTime=${effectiveTime}ms, tempo=${tempo}, isPlaybackEffective=${isPlaybackEffective}`,
      );
    }

    if (!isPlaybackEffective) {
      // Default to measure 1, beat 1 when not effectively playing
      // This handles both: not playing AND playing but time not yet propagating
      return { measure: 1, beat: 1, subdivision: 0 };
    }

    try {
      const pos = MusicalTimeConverter.msToPosition(effectiveTime, {
        tempo,
        timeSignature,
      });
      return pos;
    } catch {
      return { measure: 1, beat: 1, subdivision: 0 };
    }
  }, [effectiveTime, isPlaybackEffective, tempo, timeSignature]);

  // Determine if we're in the transition zone (near end of measure)
  const isInTransition = useMemo(() => {
    return currentPosition.beat >= opacityConfig.transitionBeat;
  }, [currentPosition.beat, opacityConfig.transitionBeat]);

  // Build a map of note positions to their measures for fast lookup
  const notePositionToMeasure = useMemo(() => {
    const positionMap = new Map<string, number>();

    // Detect if notes use 0-indexed or 1-indexed measures
    // This matches the logic in organizeNotesIntoMeasures from exerciseToMusicXML.ts
    // If any note has measure: 0, they're 0-indexed; otherwise 1-indexed
    const isZeroIndexed = exerciseNotes.some((n) => n.position?.measure === 0);

    exerciseNotes.forEach((note) => {
      // Get the measure for this note and normalize to 0-based
      let rawMeasure: number;

      if (note.position) {
        // Use musical position if available
        rawMeasure = note.position.measure;
      } else if (note.timestamp !== undefined) {
        // Convert legacy timestamp to musical position
        try {
          const position = MusicalTimeConverter.msToPosition(note.timestamp, {
            tempo,
            timeSignature,
          });
          rawMeasure = position.measure;
        } catch {
          rawMeasure = isZeroIndexed ? 0 : 1; // Default based on indexing style
        }
      } else {
        rawMeasure = isZeroIndexed ? 0 : 1; // Default based on indexing style
      }

      // Normalize to 0-based measure index
      const noteMeasure = isZeroIndexed ? rawMeasure : rawMeasure - 1;

      // Map exercise string to fretboard string index
      // Exercise strings are 1-based, fretboard indices depend on string count
      const maxString = Math.max(...exerciseNotes.map((n) => n.string));
      let stringIndex: number;

      if (maxString <= 4) {
        // 4-string bass: strings 1-4 map to G(4), D(3), A(2), E(1)
        stringIndex = 5 - note.string;
      } else if (maxString <= 5) {
        // 5-string bass: strings 1-5 map to G(4), D(3), A(2), E(1), B(0)
        stringIndex = 5 - note.string;
      } else {
        // 6-string bass: strings 1-6 map to C(5), G(4), D(3), A(2), E(1), B(0)
        stringIndex = 6 - note.string;
      }

      // Convert fret (0 = open string)
      const fret: Fret = note.fret === 0 ? 'open' : note.fret;
      const positionKey = `${stringIndex},${fret}`;

      // Store the earliest measure for this position (in case of repeated notes)
      const existingMeasure = positionMap.get(positionKey);
      if (existingMeasure === undefined || noteMeasure < existingMeasure) {
        positionMap.set(positionKey, noteMeasure);
      }

      // Also store all measures where this position appears for multi-measure exercises
      const allMeasuresKey = `${positionKey}:measures`;
      const existingMeasures = positionMap.get(allMeasuresKey) as unknown as
        | number[]
        | undefined;
      if (existingMeasures) {
        if (!existingMeasures.includes(noteMeasure)) {
          existingMeasures.push(noteMeasure);
        }
      } else {
        // Use a different storage approach - store measures as a special entry
        // We'll handle this with a separate map for multi-measure tracking
      }
    });

    return positionMap;
  }, [exerciseNotes, tempo, timeSignature]);

  // Build a separate map for notes that appear in multiple measures
  const notePositionToAllMeasures = useMemo(() => {
    const measuresMap = new Map<string, number[]>();

    // Debug: Log all unique measures found in exercise notes
    const allMeasures = new Set<number>();

    // Calculate maxString once before the loop
    const maxString =
      exerciseNotes.length > 0
        ? Math.max(...exerciseNotes.map((n) => n.string))
        : 4;

    // Detect if notes use 0-indexed or 1-indexed measures
    // This matches the logic in organizeNotesIntoMeasures from exerciseToMusicXML.ts
    const isZeroIndexed = exerciseNotes.some((n) => n.position?.measure === 0);

    exerciseNotes.forEach((note) => {
      let rawMeasure: number;

      if (note.position) {
        rawMeasure = note.position.measure;
      } else if (note.timestamp !== undefined) {
        try {
          const position = MusicalTimeConverter.msToPosition(note.timestamp, {
            tempo,
            timeSignature,
          });
          rawMeasure = position.measure;
        } catch {
          rawMeasure = isZeroIndexed ? 0 : 1;
        }
      } else {
        rawMeasure = isZeroIndexed ? 0 : 1;
      }

      // Normalize to 0-based measure index
      const noteMeasure = isZeroIndexed ? rawMeasure : rawMeasure - 1;

      let stringIndex: number;

      if (maxString <= 4) {
        stringIndex = 5 - note.string;
      } else if (maxString <= 5) {
        stringIndex = 5 - note.string;
      } else {
        stringIndex = 6 - note.string;
      }

      const fret: Fret = note.fret === 0 ? 'open' : note.fret;
      const positionKey = `${stringIndex},${fret}`;

      // Track all measures for debugging
      allMeasures.add(noteMeasure);

      const existingMeasures = measuresMap.get(positionKey) || [];
      if (!existingMeasures.includes(noteMeasure)) {
        existingMeasures.push(noteMeasure);
        measuresMap.set(positionKey, existingMeasures);
      }
    });

    // Debug: Log measure indexing information
    // Enable with: window.__DEBUG_OPACITY__ = true
    if (exerciseNotes.length > 0 && typeof window !== 'undefined' && (window as any).__DEBUG_OPACITY__) {
      const sortedMeasures = Array.from(allMeasures).sort((a, b) => a - b);
      const isZeroIndexedLocal = exerciseNotes.some((n) => n.position?.measure === 0);
      // eslint-disable-next-line no-console
      console.log(
        `📊 [OPACITY-MAP] Built notePositionToAllMeasures | ` +
        `isZeroIndexed=${isZeroIndexedLocal} | ` +
        `measures=[${sortedMeasures.join(',')}] | ` +
        `notes=${exerciseNotes.length} | ` +
        `positions=${measuresMap.size}`
      );
      // Log first 5 position mappings
      let count = 0;
      measuresMap.forEach((measures, key) => {
        if (count < 5) {
          // eslint-disable-next-line no-console
          console.log(`  📍 ${key} → measures=[${measures.join(',')}]`);
          count++;
        }
      });
    }

    return measuresMap;
  }, [exerciseNotes, tempo, timeSignature]);

  /**
   * Get the opacity for a specific fretboard position
   *
   * @param stringIndex - The string index (0-based from low B)
   * @param fret - The fret number or 'open'
   * @returns Opacity value (0-1)
   */
  /**
   * Get the highlight state for a specific fretboard position
   * Returns whether the note should be highlighted (green) and its opacity
   *
   * SINGLE SOURCE OF TRUTH: Uses currentMeasure0Based from config (note-based tracking)
   * No more competing time-based calculations - eliminates measure transition flicker.
   * FLICKER FIX v14: Now accepts measure as parameter to avoid stale closure issues.
   * Previously, this callback captured currentMeasure0Based in its closure, which could
   * desync from the caller's currentMeasureFromNote during React's batched updates.
   * Now the caller passes the measure explicitly for guaranteed consistency.
   *
   * @param stringIndex - The string index (0-based from low B)
   * @param fret - The fret number or 'open'
   * @param measure - The current measure (0-based) - passed explicitly to avoid closure issues
   * @returns MeasureHighlightResult with shouldHighlight, state, and opacity
   */
  const getMeasureHighlight = useCallback(
    (stringIndex: number, fret: Fret, measure: number): MeasureHighlightResult => {
      const positionKey = `${stringIndex},${fret}`;
      const noteMeasures = notePositionToAllMeasures.get(positionKey);

      // If no notes at this position, it's not an exercise note
      if (!noteMeasures || noteMeasures.length === 0) {
        return { shouldHighlight: false, state: 'other', opacity: 1.0 };
      }

      // FLICKER FIX v14: Use the measure passed as parameter, NOT the closure-captured value
      // This ensures consistency with other calculations in FretboardGrid that also use
      // the same currentMeasureFromNote prop
      const nextMeasure0Based = measure + 1;

      // DEBUG: Log opacity decisions
      // Enable with: window.__DEBUG_OPACITY__ = true
      const debugOpacity = typeof window !== 'undefined' && (window as any).__DEBUG_OPACITY__;

      // Check if note appears in current measure - full highlight
      if (noteMeasures.includes(measure)) {
        if (debugOpacity) {
          // eslint-disable-next-line no-console
          console.log(
            `🔍 [OPACITY] ${positionKey} | measure=${measure} | noteMeasures=[${noteMeasures.join(',')}] | ` +
            `MATCH CURRENT → 100% opacity`
          );
        }
        return {
          shouldHighlight: true,
          state: 'current',
          opacity: opacityConfig.currentMeasure, // 1.0
        };
      }

      // Check if note appears in next measure - preview highlight at 30%
      if (noteMeasures.includes(nextMeasure0Based)) {
        if (debugOpacity) {
          // eslint-disable-next-line no-console
          console.log(
            `🔍 [OPACITY] ${positionKey} | measure=${measure} | noteMeasures=[${noteMeasures.join(',')}] | ` +
            `MATCH NEXT (${nextMeasure0Based}) → 30% opacity`
          );
        }
        return {
          shouldHighlight: true,
          state: 'next',
          opacity: opacityConfig.nextMeasure, // 0.3
        };
      }

      // TWO-LAYER ARCHITECTURE: Note is in a past or distant future measure
      // These are HIDDEN (0% opacity) - only static grey canvas shows through
      if (debugOpacity) {
        // eslint-disable-next-line no-console
        console.log(
          `🔍 [OPACITY] ${positionKey} | measure=${measure} | noteMeasures=[${noteMeasures.join(',')}] | ` +
          `NO MATCH → HIDDEN (other)`
        );
      }
      return {
        shouldHighlight: false,
        state: 'other',
        opacity: 0, // TWO-LAYER: Hidden - grey canvas shows through
      };
    },
    [notePositionToAllMeasures, opacityConfig], // Removed currentMeasure0Based - now passed as parameter
  );

  const getNoteOpacity = useCallback(
    (stringIndex: number, fret: Fret): number => {
      const positionKey = `${stringIndex},${fret}`;
      const noteMeasures = notePositionToAllMeasures.get(positionKey);

      // If no notes at this position, return 0 (invisible)
      if (!noteMeasures || noteMeasures.length === 0) {
        return 0;
      }

      // SINGLE SOURCE OF TRUTH: Use the note-based measure directly
      const nextMeasure0Based = currentMeasure0Based + 1;

      // Check if note appears in current measure
      if (noteMeasures.includes(currentMeasure0Based)) {
        return opacityConfig.currentMeasure;
      }

      // Check if note appears in next measure (preview)
      if (noteMeasures.includes(nextMeasure0Based)) {
        return opacityConfig.nextMeasure;
      }

      // Note is in a past or distant future measure - hide it
      return opacityConfig.otherMeasures;
    },
    [currentMeasure0Based, notePositionToAllMeasures, opacityConfig],
  );

  // CSS transition duration string
  const transitionDuration = useMemo(
    () => `${opacityConfig.transitionDurationMs}ms`,
    [opacityConfig.transitionDurationMs],
  );

  return {
    getNoteOpacity,
    getMeasureHighlight,
    // SINGLE SOURCE OF TRUTH: Return the same measure we received (0-based)
    // This is purely for consumers who need to know the current measure
    currentMeasure: currentMeasure0Based,
    currentBeat: currentPosition.beat,
    isInTransition,
    transitionDuration,
  };
}

export default useMeasureOpacity;
