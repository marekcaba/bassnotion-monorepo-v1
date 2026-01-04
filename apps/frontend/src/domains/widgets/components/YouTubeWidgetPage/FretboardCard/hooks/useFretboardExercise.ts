import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { createStructuredLogger } from '@bassnotion/contracts';
import type { ExerciseNote, TimeSignature } from '@bassnotion/contracts';
import type {
  Fret,
  BasslineData,
  CustomBasslineEvent,
} from '../types/fretboardTypes';
import { useAudioFretboard } from '../../../../hooks/useAudioFretboard';
import { useMeasureOpacity } from './useMeasureOpacity';
// Use the same source of truth as the rest of the platform
import {
  musicalTruth,
  type MusicalTruth,
} from '@/domains/playback/modules/tempo/MusicalTruthAuthority';
// TIMING SYNC FIX: Use AtomicPlaybackClock via useFretboardAtomicSync hook
// This ensures FretboardCard uses the same timing source as all other widgets
import { useFretboardAtomicSync } from '@/domains/widgets/hooks/useBeatGridSync';

const logger = createStructuredLogger('useFretboardExercise');

/**
 * Hook to manage exercise integration with the fretboard
 */
// Minimal sync props interface to avoid unnecessary re-renders
interface MinimalSyncProps {
  selectedExercise: any;
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  masterVolume: number;
  sync: any;
}

export const useFretboardExercise = (
  syncProps: MinimalSyncProps,
  options?: {
    setSelectedDots?: (dots: Map<string, number[]>) => void;
    autoPopulateOnExerciseLoad?: boolean;
    onManualReset?: () => void;
    stringCount?: 4 | 5 | 6;
  },
) => {
  // Hook logging disabled for performance (runs every render)
  // Uncomment for debugging hook behavior

  // Extract options with defaults
  const {
    setSelectedDots,
    autoPopulateOnExerciseLoad = true,
    onManualReset,
    stringCount = 4,
  } = options || {};

  // Audio fretboard integration with dynamic string count
  const audioIntegration = useAudioFretboard({
    stringCount: stringCount === 6 ? 5 : stringCount === 5 ? 5 : 4, // Ensure audio system gets correct string count
    autoPlayOnClick: true,
  });

  // Track if user has manually reset to prevent auto-population
  const userHasManuallyResetRef = useRef(false);
  const lastExerciseIdRef = useRef<string | null>(null);
  const lastPopulationTimestampRef = useRef<number>(0);

  // NOTE: Previous refs (wasPlayingRef, playbackJustStartedRef, playbackStartedAtRef)
  // were removed as part of TIMING SYNC FIX - AtomicPlaybackClock handles all timing

  // Extract exercise data from sync props
  const exerciseData = useMemo(() => {
    const selectedExercise = syncProps.selectedExercise;
    const exerciseNotes = selectedExercise?.notes || [];
    const hasExercise = !!selectedExercise && exerciseNotes.length > 0;

    return {
      selectedExercise,
      exerciseNotes,
      hasExercise,
      exerciseProgress: hasExercise ? (exerciseNotes.length / 100) * 100 : 0, // Simple progress calculation
    };
  }, [syncProps.selectedExercise]);

  // CRITICAL FIX: Subscribe to musicalTruth changes to get REACTIVE tempo updates
  // Previously, musicalTruth.getBPM() was called once at render time,
  // which happened BEFORE setFromExercise() was called, returning default 120 BPM.
  // Now we use state + subscription to react when tempo actually changes.
  const [musicalTruthState, setMusicalTruthState] = useState<MusicalTruth>(() =>
    musicalTruth.getTruth(),
  );

  useEffect(() => {
    // Subscribe to musicalTruth changes
    const unsubscribe = musicalTruth.subscribe((truth) => {
      // Logging disabled for performance
      setMusicalTruthState(truth);
    });

    // Also sync on mount in case we missed an update
    setMusicalTruthState(musicalTruth.getTruth());

    return unsubscribe;
  }, []);

  // Use the reactive state instead of direct musicalTruth calls
  const exerciseTempo = musicalTruthState.bpm;
  const exerciseTimeSignature: TimeSignature = musicalTruthState.timeSignature;

  // Calculate countdown offset in milliseconds using MUSICAL TRUTH (reactive state)
  // The transport's currentTime includes the countdown period
  // We need to subtract this to get the "exercise time" for measure highlighting
  const countdownBars = musicalTruthState.countdownBars;
  const beatsPerBar = exerciseTimeSignature.numerator;
  const msPerBeat = (60 / exerciseTempo) * 1000;
  const countdownDurationMs = countdownBars * beatsPerBar * msPerBeat;

  // =============================================================================
  // TIMING SYNC FIX: Use AtomicPlaybackClock via useFretboardAtomicSync
  // =============================================================================
  // Previously, this hook used a custom useAnimationTime() function that:
  // 1. Subscribed to EventBus 'transport:position-updated' events (~30Hz)
  // 2. Ran its own RAF loop for time interpolation
  //
  // This was redundant because useFretboardNoteSync already subscribes to
  // AtomicPlaybackClock for note highlighting. Now ALL timing comes from
  // the same source, ensuring perfect sync with other widgets.
  // =============================================================================
  const atomicSync = useFretboardAtomicSync({
    isPlaying: syncProps.isPlaying,
    isVisible: true,
    // Use countdown beats (bars * beatsPerBar)
    countdownBeats: countdownBars * beatsPerBar,
    beatsPerMeasure: beatsPerBar,
  });

  // exerciseTimeMs from atomicSync is already countdown-adjusted:
  // - Negative during countdown
  // - Positive after countdown starts
  // We use Math.max(0, ...) to ensure we don't use negative values for note lookup
  const exerciseTime = Math.max(0, atomicSync.exerciseTimeMs);

  // rawCurrentTime is needed for countdown detection in unifiedPlaybackState
  // Calculate it from atomicSync: visualSeconds includes countdown, so we need to convert
  const rawCurrentTime = atomicSync.visualSeconds * 1000;

  // Track previous note index for transition logging (must be outside useMemo!)
  const prevNoteIndexRef = useRef<number>(-1);

  // Reset note tracking when playback stops or exercise changes
  useEffect(() => {
    if (!syncProps.isPlaying) {
      prevNoteIndexRef.current = -1;
    }
  }, [syncProps.isPlaying, syncProps.selectedExercise?.id]);

  // DEBUG: Time logging disabled after timing fix verification
  // Uncomment for debugging timing issues
  // if (syncProps.isPlaying && rawCurrentTime > 0) {
  //   const expectedMsPerBar = (60 / exerciseTempo) * 1000 * beatsPerBar;
  //   const currentBar = Math.floor(exerciseTime / expectedMsPerBar) + 1;
  //   console.log(`[TIMING-DEBUG] rawCurrentTime=${rawCurrentTime.toFixed(0)}ms, exerciseTime=${exerciseTime.toFixed(0)}ms, currentBar=${currentBar}`);
  // }

  // Track previous measure for transition logging
  const prevMeasureRef = useRef<number>(-1);

  // =============================================================================
  // FLICKER FIX v9: UNIFIED PLAYBACK STATE CALCULATION
  // =============================================================================
  // CRITICAL: Both currentMeasureFromNote AND nextNoteToPlay MUST be calculated
  // in the SAME useMemo to prevent React batching from causing them to desync.
  //
  // Previously, these were in separate useMemo hooks. During React's batched updates,
  // one could update before the other, causing:
  // - currentMeasureFromNote = 0 (old value)
  // - nextNoteToPlay.noteIndex = 5 (new value, in measure 1)
  //
  // This caused FretboardGrid to render dots with inconsistent state:
  // - isDotPlayedInCurrentMeasure used nextNoteToPlay.noteIndex (new)
  // - getMeasureHighlight used currentMeasure (old)
  // Result: ~50ms flicker where wrong dots briefly highlight
  //
  // Solution: Calculate BOTH values in a single useMemo so they're always consistent.
  // =============================================================================

  // FLICKER DEBUG v16: Track previous unified state to detect measure transitions
  const prevUnifiedMeasureRef = useRef<number>(-1);

  // PERFORMANCE FIX: Quantize exerciseTime to reduce useMemo recalculations
  // The visual ring animation runs at 60fps via useFretboardNoteSync (direct DOM).
  // React state only needs to update when the NOTE INDEX changes (~1-10x per second).
  // By quantizing to 20ms, we reduce recalculations from 60/sec to ~50/sec max,
  // while still catching note changes promptly (notes are typically 100-500ms apart).
  const quantizedExerciseTime = useMemo(() => {
    // Quantize to 20ms buckets - fine enough to catch note changes
    return Math.floor(exerciseTime / 20) * 20;
  }, [exerciseTime]);

  const unifiedPlaybackState = useMemo(() => {
    // Default return value for when there's no exercise
    const defaultState = {
      currentMeasureFromNote: 0,
      nextNoteToPlay: null as {
        stringIndex: number;
        fret: Fret;
        noteIndex: number;
      } | null,
    };

    if (!exerciseData.hasExercise || exerciseData.exerciseNotes.length === 0) {
      return defaultState;
    }

    const notes = exerciseData.exerciseNotes;
    const maxString = Math.max(...notes.map((n: ExerciseNote) => n.string));

    // Helper to convert note to fretboard position
    const noteToPosition = (note: ExerciseNote, index: number) => {
      let stringIndex: number;
      if (maxString <= 4) {
        stringIndex = 5 - note.string;
      } else if (maxString <= 5) {
        stringIndex = 5 - note.string;
      } else {
        stringIndex = 6 - note.string;
      }
      const fret: Fret = note.fret === 0 ? 'open' : note.fret;
      return { stringIndex, fret, noteIndex: index };
    };

    // When not playing, return first note's measure and position
    if (!syncProps.isPlaying) {
      return {
        currentMeasureFromNote: notes[0].position?.measure ?? 0,
        nextNoteToPlay: noteToPosition(notes[0], 0),
      };
    }

    // During countdown (before exercise starts), show first note
    if (rawCurrentTime < countdownDurationMs) {
      return {
        currentMeasureFromNote: 0,
        nextNoteToPlay: noteToPosition(notes[0], 0),
      };
    }

    // Calculate timing constants
    const msPerBeat = (60 / exerciseTempo) * 1000;
    const beatsPerMeasure = exerciseTimeSignature.numerator;
    const msPerMeasure = msPerBeat * beatsPerMeasure;
    const TICKS_PER_BEAT = 480;

    // Helper to convert MusicalPosition to milliseconds
    const positionToMs = (
      pos:
        | {
            measure?: number;
            beat?: number;
            subdivision?: number;
            tick?: number;
          }
        | undefined,
    ): number => {
      const measure = pos?.measure ?? 0;
      const beat = pos?.beat ?? 0;
      const subdivision = pos?.subdivision ?? 0;
      const tick = pos?.tick;

      const tickWithinBeat =
        tick !== undefined ? tick : subdivision * (TICKS_PER_BEAT / 4);
      const fractionalBeat = tickWithinBeat / TICKS_PER_BEAT;

      return (
        measure * msPerMeasure + beat * msPerBeat + fractionalBeat * msPerBeat
      );
    };

    // Find which note is currently playing - this determines BOTH measure and next note
    // PERF FIX: Use quantizedExerciseTime for note lookup to reduce recalculations
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const noteStartMs = positionToMs(note.position);

      let noteEndMs: number;
      if (i < notes.length - 1) {
        const nextNote = notes[i + 1];
        noteEndMs = positionToMs(nextNote.position);
      } else {
        // Use durationTicks for precise timing (480 ticks = 1 beat)
        // Fallback to 480 (quarter note) if not available
        const durationTicks = note.durationTicks ?? TICKS_PER_BEAT;
        const durationBeats = durationTicks / TICKS_PER_BEAT;
        noteEndMs = noteStartMs + durationBeats * msPerBeat;
      }

      if (quantizedExerciseTime >= noteStartMs && quantizedExerciseTime < noteEndMs) {
        // Found the current note - return BOTH measure and position together
        // This ensures they're always consistent!
        return {
          currentMeasureFromNote: note.position?.measure ?? 0,
          nextNoteToPlay: noteToPosition(note, i),
        };
      }
    }

    // If before first note, show first note
    const firstNoteStart = positionToMs(notes[0].position);
    if (quantizedExerciseTime < firstNoteStart) {
      return {
        currentMeasureFromNote: notes[0].position?.measure ?? 0,
        nextNoteToPlay: noteToPosition(notes[0], 0),
      };
    }

    // All notes played - calculate measure from time, no note to play
    const measureFromTime = Math.floor(quantizedExerciseTime / msPerMeasure);
    return {
      currentMeasureFromNote: measureFromTime,
      nextNoteToPlay: null,
    };
  }, [
    syncProps.isPlaying,
    exerciseData.hasExercise,
    exerciseData.exerciseNotes,
    quantizedExerciseTime, // PERF FIX: Use quantized time (20ms buckets) instead of raw time
    exerciseTempo,
    exerciseTimeSignature.numerator,
    rawCurrentTime,
    countdownDurationMs,
    // PERF FIX: Removed animationState.time - visual ring animation at 60fps
    // is handled by useFretboardNoteSync (direct DOM), not React state.
    // React state only needs to update when note changes, not every frame.
  ]);

  // Extract values from unified state for use in the rest of the hook
  const { currentMeasureFromNote, nextNoteToPlay } = unifiedPlaybackState;

  // FLICKER DEBUG v16: Log measure transitions at the useMemo level (not useEffect)
  // This shows us EXACTLY when React computes new values
  const debugMemo = (window as any).__DEBUG_MEMO_TIMING__ === true;
  if (debugMemo && syncProps.isPlaying) {
    const prevMeasure = prevUnifiedMeasureRef.current;
    if (prevMeasure !== currentMeasureFromNote) {
      console.log(
        `📊 [MEMO] Measure computed: ${prevMeasure}→${currentMeasureFromNote} | ` +
          `noteIdx=${nextNoteToPlay?.noteIndex ?? 'null'} | ` +
          `time=${performance.now().toFixed(1)}ms`,
      );
    }
    prevUnifiedMeasureRef.current = currentMeasureFromNote;
  }

  // =============================================================================
  // FLICKER DEBUG v10: Log EVERY state update to track the source of flicker
  // PERF FIX: All logging gated behind debug flag. Enable with:
  // window.__DEBUG_UNIFIED_STATE__ = true
  // =============================================================================
  const debugUnifiedState = (window as any).__DEBUG_UNIFIED_STATE__ === true;
  const prevUnifiedStateRef = useRef<{
    measure: number;
    noteIndex: number | null;
    exerciseTime: number;
  } | null>(null);

  // This runs on EVERY render (not in useEffect) to catch state during React's commit phase
  // PERF FIX: Only track state when debug is enabled
  if (debugUnifiedState && syncProps.isPlaying) {
    const currState = {
      measure: currentMeasureFromNote,
      noteIndex: nextNoteToPlay?.noteIndex ?? null,
      exerciseTime: Math.round(exerciseTime),
    };

    const prevState = prevUnifiedStateRef.current;
    if (prevState) {
      const measureChanged = prevState.measure !== currState.measure;

      // Only log measure transitions (these are the ones that matter for flicker)
      // Note changes within the same measure are expected and don't cause flicker
      if (measureChanged) {
        console.log(
          `🔵 [UNIFIED-STATE] MEASURE CHANGE: ` +
            `measure: ${prevState.measure}→${currState.measure} | ` +
            `noteIdx: ${prevState.noteIndex}→${currState.noteIndex} | ` +
            `time: ${prevState.exerciseTime}→${currState.exerciseTime}ms`,
        );
      }
    }
    prevUnifiedStateRef.current = currState;
  }

  // DIAGNOSTIC: Log measure transitions to debug flicker
  // PERF FIX: Gated behind debug flag
  useEffect(() => {
    const debugMeasureTransition = (window as any).__DEBUG_MEASURE_TRANSITION__ === true;
    if (!debugMeasureTransition) return;

    if (
      syncProps.isPlaying &&
      prevMeasureRef.current !== currentMeasureFromNote
    ) {
      console.log(
        `🔴 [MEASURE-TRANSITION] measure: ${prevMeasureRef.current} → ${currentMeasureFromNote} | ` +
          `exerciseTime=${exerciseTime.toFixed(0)}ms | rawCurrentTime=${rawCurrentTime.toFixed(0)}ms`,
      );
      prevMeasureRef.current = currentMeasureFromNote;
    }
  }, [
    syncProps.isPlaying,
    currentMeasureFromNote,
    exerciseTime,
    rawCurrentTime,
  ]);

  // Measure-based opacity for playback animation
  // Shows current measure at 100%, next measure at 30%, others hidden
  // SINGLE SOURCE OF TRUTH: currentMeasureFromNote is the authoritative measure
  const measureOpacity = useMeasureOpacity({
    exerciseNotes: exerciseData.exerciseNotes,
    currentTime: exerciseTime, // Used for beat calculation only
    isPlaying: syncProps.isPlaying || false,
    tempo: exerciseTempo,
    timeSignature: exerciseTimeSignature,
    stringCount,
    currentMeasure: currentMeasureFromNote,
  });

  // Check if a position matches an exercise note
  const isExerciseNote = useCallback(
    (stringIndex: number, fret: Fret): boolean => {
      if (!exerciseData.hasExercise) return false;

      return exerciseData.exerciseNotes.some((note: ExerciseNote) => {
        // Use the same mapping logic as convertExerciseNotesToSelectedDots
        // Determine the string count of the exercise by finding the max string number
        const maxString = Math.max(
          ...exerciseData.exerciseNotes.map((n: ExerciseNote) => n.string),
        );

        let noteStringIndex: number;

        if (maxString <= 4) {
          // 4-string bass exercise: strings 1-4 map to G(4), D(3), A(2), E(1)
          noteStringIndex = 5 - note.string; // string 1 -> index 4, string 2 -> index 3, string 3 -> index 2, string 4 -> index 1
        } else if (maxString <= 5) {
          // 5-string bass exercise: strings 1-5 map to G(4), D(3), A(2), E(1), B(0)
          noteStringIndex = 5 - note.string; // string 1 -> index 4, string 2 -> index 3, etc.
        } else {
          // 6-string bass exercise: strings 1-6 map to C(5), G(4), D(3), A(2), E(1), B(0)
          noteStringIndex = 6 - note.string; // string 1 -> index 5, string 2 -> index 4, etc.
        }

        const noteFret = note.fret === 0 ? 'open' : note.fret;

        return noteStringIndex === stringIndex && noteFret === fret;
      });
    },
    [exerciseData.exerciseNotes, exerciseData.hasExercise],
  );

  // Check if a position is the current note being played
  const isCurrentNote = useCallback(
    (stringIndex: number, fret: Fret): boolean => {
      // Convert absolute string index to relative index for audio system
      let relativeStringIndex = stringIndex;

      if (stringCount === 4) {
        if (stringIndex >= 1 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      } else if (stringCount >= 5) {
        if (stringIndex >= 0 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      }

      return audioIntegration.isCurrentNote(relativeStringIndex, fret);
    },
    [audioIntegration, stringCount],
  );

  // Get exercise note at specific position
  const getExerciseNoteAt = useCallback(
    (stringIndex: number, fret: Fret): ExerciseNote | null => {
      if (!exerciseData.hasExercise) return null;

      const foundNote = exerciseData.exerciseNotes.find(
        (note: ExerciseNote) => {
          const noteStringIndex = note.string - 1; // Convert 1-based to 0-based
          const noteFret = note.fret === 0 ? 'open' : note.fret;

          return noteStringIndex === stringIndex && noteFret === fret;
        },
      );

      return foundNote || null;
    },
    [exerciseData.exerciseNotes, exerciseData.hasExercise],
  );

  // Create bassline data from selected dots for sync events
  const createBasslineData = useCallback(
    (selectedDots: Map<string, number[]>): BasslineData[] => {
      const basslineData: BasslineData[] = [];

      selectedDots.forEach((orders, positionKey) => {
        // Safe parsing of position key
        if (!positionKey.includes(',')) return;
        const indexOfComma = positionKey.indexOf(',');
        const stringIndexStr = positionKey.substring(0, indexOfComma);
        const fretStr = positionKey.substring(indexOfComma + 1);
        if (!stringIndexStr || !fretStr) return;
        const stringIndex = parseInt(stringIndexStr, 10);
        const fret: Fret = fretStr === 'open' ? 'open' : parseInt(fretStr, 10);

        // Create bassline entry for each order number at this position
        orders.forEach((order) => {
          // Get note name from string configs if available
          const stringConfigs = audioIntegration.stringConfigs;
          const noteBase =
            stringConfigs[4]?.[stringIndex] ||
            stringConfigs[5]?.[stringIndex] ||
            'E';

          basslineData.push({
            stringIndex,
            fret,
            order,
            note: fret === 'open' ? noteBase : `${noteBase}${fret}`, // Simple note naming
          });
        });
      });

      // Sort by order
      return basslineData.sort((a, b) => a.order - b.order);
    },
    [audioIntegration.stringConfigs],
  );

  // Emit bassline sync event
  const emitBasslineEvent = useCallback(
    (selectedDots: Map<string, number[]>) => {
      const basslineData = createBasslineData(selectedDots);

      const customEvent: CustomBasslineEvent = {
        bassline: basslineData,
        source: 'interactive-fretboard',
        timestamp: Date.now(),
      };

      // Emit through sync system
      if (syncProps.sync?.actions?.emitEvent) {
        syncProps.sync.actions.emitEvent('CUSTOM_BASSLINE', customEvent);
      }
    },
    [createBasslineData, syncProps.sync],
  );

  // Audio playback functions
  const triggerNote = useCallback(
    (stringIndex: number, fret: Fret) => {
      // Convert absolute string index to relative index for audio system
      // FretboardCard uses absolute indices: B(0), E(1), A(2), D(3), G(4), C(5)
      // Audio system expects relative indices: 0-based for current string count

      let relativeStringIndex = stringIndex;

      if (stringCount === 4) {
        // 4-string bass: audio expects [0,1,2,3] for [G,D,A,E]
        // FretboardCard passes [4,3,2,1] for [G,D,A,E] (absolute indices)
        if (stringIndex >= 1 && stringIndex <= 4) {
          // Map absolute indices [1,2,3,4] to relative indices [3,2,1,0]
          // E(1) -> index 3, A(2) -> index 2, D(3) -> index 1, G(4) -> index 0
          relativeStringIndex = 4 - stringIndex;
        } else {
          // Invalid string index for 4-string bass - skip audio
          return;
        }
      } else if (stringCount >= 5) {
        // 5+ string bass: audio expects [0,1,2,3,4] for [G,D,A,E,B]
        // FretboardCard passes [0,1,2,3,4] for [B,E,A,D,G] (absolute indices)
        if (stringIndex >= 0 && stringIndex <= 4) {
          // Map absolute indices [0,1,2,3,4] to relative indices [4,3,2,1,0]
          // B(0) -> index 4, E(1) -> index 3, A(2) -> index 2, D(3) -> index 1, G(4) -> index 0
          relativeStringIndex = 4 - stringIndex;
        } else {
          // Invalid string index for 5+ string bass - skip audio
          return;
        }
      }

      audioIntegration.triggerNote(relativeStringIndex, fret);
    },
    [audioIntegration, stringCount],
  );

  const createNoteEvent = useCallback(
    (stringIndex: number, fret: Fret) => {
      // Convert absolute string index to relative index for audio system
      let relativeStringIndex = stringIndex;

      if (stringCount === 4) {
        if (stringIndex >= 1 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      } else if (stringCount >= 5) {
        if (stringIndex >= 0 && stringIndex <= 4) {
          relativeStringIndex = 4 - stringIndex;
        }
      }

      return audioIntegration.createNoteEvent(relativeStringIndex, fret);
    },
    [audioIntegration, stringCount],
  );

  // Convert exercise notes to fretboard selected dots format
  const convertExerciseNotesToSelectedDots = useCallback(
    (exerciseNotes: ExerciseNote[]): Map<string, number[]> => {
      const selectedDots = new Map<string, number[]>();

      exerciseNotes.forEach((note, index) => {
        // Map exercise strings to full 6-string layout indices
        // Full layout: B(0), E(1), A(2), D(3), G(4), C(5)

        // Determine the string count of the exercise by finding the max string number
        const maxString = Math.max(
          ...exerciseNotes.map((n: ExerciseNote) => n.string),
        );

        let stringIndex: number;

        if (maxString <= 4) {
          // 4-string bass exercise: strings 1-4 map to G(4), D(3), A(2), E(1)
          // String 1 = G = index 4, String 2 = D = index 3, String 3 = A = index 2, String 4 = E = index 1
          stringIndex = 5 - note.string; // string 1 -> index 4, string 2 -> index 3, string 3 -> index 2, string 4 -> index 1
        } else if (maxString <= 5) {
          // 5-string bass exercise: strings 1-5 map to G(4), D(3), A(2), E(1), B(0)
          // String 1 = G = index 4, String 2 = D = index 3, String 3 = A = index 2, String 4 = E = index 1, String 5 = B = index 0
          stringIndex = 5 - note.string; // string 1 -> index 4, string 2 -> index 3, etc.
        } else {
          // 6-string bass exercise: strings 1-6 map to C(5), G(4), D(3), A(2), E(1), B(0)
          // String 1 = C = index 5, String 2 = G = index 4, String 3 = D = index 3, String 4 = A = index 2, String 5 = E = index 1, String 6 = B = index 0
          stringIndex = 6 - note.string; // string 1 -> index 5, string 2 -> index 4, etc.
        }

        // Convert fret number (0 means open string)
        const fret: Fret = note.fret === 0 ? 'open' : note.fret;

        // Create position key in the format expected by fretboard
        const positionKey = `${stringIndex},${fret}`;

        // Assign order number (sequential from 1)
        const orderNumber = index + 1;

        // Store in map
        selectedDots.set(positionKey, [orderNumber]);
      });

      return selectedDots;
    },
    [],
  );

  // Auto-populate fretboard when exercise loads or is re-selected
  useEffect(() => {
    const currentExerciseId = exerciseData.selectedExercise?.id || null;
    const currentTimestamp = Date.now();

    logger.info(`🔥 useFretboardExercise: auto-populate useEffect triggered`, {
      currentExerciseId,
      lastExerciseId: lastExerciseIdRef.current,
      hasExercise: exerciseData.hasExercise,
      exerciseNotesLength: exerciseData.exerciseNotes.length,
      autoPopulateEnabled: autoPopulateOnExerciseLoad,
      hasSetSelectedDots: !!setSelectedDots,
      userHasManuallyReset: userHasManuallyResetRef.current,
      currentTimestamp,
      lastPopulationTimestamp: lastPopulationTimestampRef.current,
      timeSinceLastPopulation:
        currentTimestamp - lastPopulationTimestampRef.current,
    });

    // Check if this is a new exercise selection or re-selection
    const isNewExercise = currentExerciseId !== lastExerciseIdRef.current;
    logger.info(`🔥 useFretboardExercise: isNewExercise=${isNewExercise}`);

    // Reset the manual reset flag when a new exercise is selected
    if (isNewExercise && currentExerciseId) {
      logger.info(
        `🔥 useFretboardExercise: resetting manual flags for new exercise`,
      );
      userHasManuallyResetRef.current = false;
      lastExerciseIdRef.current = currentExerciseId;
    }

    // Auto-populate if:
    // 1. Auto-population is enabled
    // 2. We have an exercise with notes
    // 3. It's a new exercise (disable re-selection auto-population as it's handled by FretboardCard)
    // 4. User hasn't manually reset
    const shouldAutoPopulate =
      autoPopulateOnExerciseLoad &&
      setSelectedDots &&
      exerciseData.hasExercise &&
      exerciseData.exerciseNotes.length > 0 &&
      isNewExercise && // Only auto-populate for NEW exercises, not re-selections
      !userHasManuallyResetRef.current;

    logger.info(
      `🔥 useFretboardExercise: shouldAutoPopulate=${shouldAutoPopulate}`,
    );

    if (shouldAutoPopulate) {
      logger.info(
        `🔥 useFretboardExercise: AUTO-POPULATING with exercise notes`,
      );

      // Convert exercise notes to selected dots format
      const exerciseDotsMap = convertExerciseNotesToSelectedDots(
        exerciseData.exerciseNotes,
      );

      logger.info(
        `🔥 useFretboardExercise: converted ${exerciseData.exerciseNotes.length} notes to ${exerciseDotsMap.size} dot positions`,
      );

      // Update the fretboard selected dots
      setSelectedDots(exerciseDotsMap);

      // Update the last population timestamp
      lastPopulationTimestampRef.current = currentTimestamp;

      // Emit bassline event for sync with other widgets
      setTimeout(() => {
        logger.info(`🔥 useFretboardExercise: emitting bassline event`);
        emitBasslineEvent(exerciseDotsMap);
      }, 100); // Small delay to ensure state is updated
    }
  }, [
    exerciseData.hasExercise,
    exerciseData.exerciseNotes,
    exerciseData.selectedExercise?.id, // Track exercise ID changes
    exerciseData.selectedExercise, // Track the entire exercise object (helps detect re-selections)
    autoPopulateOnExerciseLoad,
    setSelectedDots,
    convertExerciseNotesToSelectedDots,
    emitBasslineEvent,
  ]);

  // Function to mark that user has manually reset
  const markManualReset = useCallback(() => {
    userHasManuallyResetRef.current = true;
    onManualReset?.();
  }, [onManualReset]);

  // Function to force re-population (e.g., when user clicks same exercise again)
  const forcePopulateExercise = useCallback(() => {
    if (
      setSelectedDots &&
      exerciseData.hasExercise &&
      exerciseData.exerciseNotes.length > 0
    ) {
      // Force re-populate with exercise notes

      // Reset manual reset flag to allow re-population
      userHasManuallyResetRef.current = false;

      // Convert exercise notes to selected dots format
      const exerciseDotsMap = convertExerciseNotesToSelectedDots(
        exerciseData.exerciseNotes,
      );

      // Update the fretboard selected dots
      setSelectedDots(exerciseDotsMap);

      // Emit bassline event for sync with other widgets
      setTimeout(() => {
        emitBasslineEvent(exerciseDotsMap);
      }, 100);
    }
  }, [
    setSelectedDots,
    exerciseData.hasExercise,
    exerciseData.exerciseNotes,
    exerciseData.selectedExercise?.title,
    convertExerciseNotesToSelectedDots,
    emitBasslineEvent,
  ]);

  // Exercise playback integration
  const playbackIntegration = useMemo(() => {
    return audioIntegration.playbackIntegration;
  }, [audioIntegration.playbackIntegration]);

  // Generate measure-aware connections from exercise notes
  // Each connection knows which measure its endpoints belong to
  // This allows FretboardGrid to show connections only for notes in current/next measure
  const measureAwareConnections = useMemo(() => {
    if (!exerciseData.hasExercise || exerciseData.exerciseNotes.length < 2) {
      return [];
    }

    const connections: Array<{
      pos1: { stringIndex: number; fret: Fret };
      pos2: { stringIndex: number; fret: Fret };
      measure1: number; // 0-based measure index for pos1
      measure2: number; // 0-based measure index for pos2
      sourceNoteIndex: number; // Index of the source note in exercise (for dot-to-dot line hiding)
    }> = [];

    const notes = exerciseData.exerciseNotes;
    const maxString = Math.max(...notes.map((n: ExerciseNote) => n.string));

    // Detect if notes use 0-indexed or 1-indexed measures
    // This matches the logic in organizeNotesIntoMeasures from exerciseToMusicXML.ts
    // If any note has measure: 0, they're 0-indexed; otherwise 1-indexed
    const isZeroIndexed = notes.some((n: ExerciseNote) => n.position?.measure === 0);

    // Create connections between consecutive notes in the exercise
    for (let i = 0; i < notes.length - 1; i++) {
      const note1 = notes[i];
      const note2 = notes[i + 1];

      // Calculate string indices based on exercise type
      let stringIndex1: number;
      let stringIndex2: number;

      if (maxString <= 4) {
        stringIndex1 = 5 - note1.string;
        stringIndex2 = 5 - note2.string;
      } else if (maxString <= 5) {
        stringIndex1 = 5 - note1.string;
        stringIndex2 = 5 - note2.string;
      } else {
        stringIndex1 = 6 - note1.string;
        stringIndex2 = 6 - note2.string;
      }

      const fret1: Fret = note1.fret === 0 ? 'open' : note1.fret;
      const fret2: Fret = note2.fret === 0 ? 'open' : note2.fret;

      // Get measure from note position and normalize to 0-based
      // This matches the logic in organizeNotesIntoMeasures:
      // - For 0-indexed: measure 0 -> index 0
      // - For 1-indexed: measure 1 -> index 0 (subtract 1)
      const rawMeasure1 = note1.position?.measure ?? 0;
      const rawMeasure2 = note2.position?.measure ?? 0;
      const measure1 = isZeroIndexed ? rawMeasure1 : rawMeasure1 - 1;
      const measure2 = isZeroIndexed ? rawMeasure2 : rawMeasure2 - 1;

      connections.push({
        pos1: { stringIndex: stringIndex1, fret: fret1 },
        pos2: { stringIndex: stringIndex2, fret: fret2 },
        measure1,
        measure2,
        sourceNoteIndex: i, // Index of the source note (note1) in the exercise
      });
    }

    return connections;
  }, [exerciseData.exerciseNotes, exerciseData.hasExercise]);

  // Get the current measure (0-based) for connection visibility checking
  // FLICKER FIX v11: measureOpacity.currentMeasure is ALREADY 0-based (same as currentMeasureFromNote)
  // The previous code subtracted 1, causing currentMeasure0Based to be off by 1 from currentMeasureFromNote
  // This caused connection lines to use a different measure than dot highlighting during transitions
  const currentMeasure0Based = useMemo(() => {
    if (!syncProps.isPlaying) return 0;
    return measureOpacity.currentMeasure; // Already 0-based, no conversion needed
  }, [syncProps.isPlaying, measureOpacity.currentMeasure]);

  // NOTE: nextNoteToPlay is now computed in unifiedPlaybackState useMemo above
  // to ensure it's always consistent with currentMeasureFromNote (FLICKER FIX v9)

  return {
    // Exercise data
    exerciseData,

    // Exercise note checking
    isExerciseNote,
    isCurrentNote,
    getExerciseNoteAt,

    // Exercise note conversion
    convertExerciseNotesToSelectedDots,

    // Manual reset tracking
    markManualReset,
    forcePopulateExercise,

    // Bassline creation and sync
    createBasslineData,
    emitBasslineEvent,

    // Audio integration
    triggerNote,
    createNoteEvent,
    playbackIntegration,
    audioIntegration,

    // Measure-based opacity for playback animation
    measureOpacity,

    // Measure-aware connections for accurate line highlighting during playback
    measureAwareConnections,
    currentMeasure0Based,

    // Next note to play indicator (for yellow ring)
    nextNoteToPlay,

    // FLICKER FIX v6: Export note-based measure for direct use by FretboardGrid
    // This is the authoritative source for current measure during playback
    // FretboardGrid should use this instead of deriving from nextNoteToPlay
    currentMeasureFromNote,

    // Tempo from musicalTruth - for direct DOM note sync in useFretboardNoteSync
    tempo: exerciseTempo,
  };
};
