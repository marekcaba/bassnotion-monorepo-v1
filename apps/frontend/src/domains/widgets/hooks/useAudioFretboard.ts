'use client';

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
  MusicalTimeConverter,
  ExerciseMigration,
  type DatabaseExercise,
  type ExerciseNote,
} from '@bassnotion/contracts';
// TODO: Re-enable when playback domain build issues are resolved
// import { usePlaybackIntegration } from './usePlaybackIntegration';
// import type { UsePlaybackIntegrationReturn, NoteEvent } from './usePlaybackIntegration';

/**
 * Audio Fretboard Hook - Unified Audio Logic for Bass Fretboard Components
 *
 * Provides consistent audio functionality for both 2D and 3D fretboard modes.
 * Handles note mapping, audio triggering, and playback integration.
 *
 * Part of Story 3.12: Interactive Fretboard Integration
 */

// ============================================================================
// INTERFACES
// ============================================================================

/**
 * Bass-specific note event extending the generic NoteEvent interface
 * Supports both legacy millisecond timing and new musical timing
 */
export interface BassNoteEvent {
  id: string;
  string: number;
  fret: number;
  note: string;
  octave: number;
  velocity: number;

  // New musical timing system (preferred)
  duration?: NoteDuration;
  position?: MusicalPosition;

  // Legacy timing (for backwards compatibility)
  timestamp?: number;
  duration_ms?: number;
}

/**
 * String configuration for different bass setups
 */
export interface StringConfig {
  4: string[];
  5: string[];
  6: string[];
}

/**
 * Octave mapping for bass strings
 */
export interface OctaveMapping {
  4: number[];
  5: number[];
  6: number[];
}

/**
 * Playback position information
 */
export interface PlaybackPosition {
  currentNoteIndex: number;
  currentNote: BassNoteEvent | null;
  isPlaying: boolean;
  currentTime: number;
  progress: number; // 0-1 representing playback progress

  // New musical timing information
  musicalPosition?: MusicalPosition;
  isMusicalTiming?: boolean;
}

/**
 * Hook configuration options
 */
export interface UseAudioFretboardConfig {
  stringCount: 4 | 5 | 6;
  autoPlayOnClick?: boolean;
  defaultDuration?: number; // Legacy - milliseconds
  defaultVelocity?: number;
  defaultNoteDuration?: NoteDuration; // New - musical duration
  exercise?: DatabaseExercise | any; // Support both new and legacy exercise formats
  syncProps?: any; // Sync props for playback tracking
}

/**
 * Playback integration shape for audio fretboard
 * Narrowly typed for the specific properties accessed
 */
interface PlaybackIntegrationShape {
  engine?: {
    processNoteEvent?: (event: BassNoteEvent) => void;
  };
  state?: {
    isInitialized?: boolean;
    error?: Error | null;
  };
}

/**
 * Hook return interface
 */
export interface UseAudioFretboardReturn {
  // Core audio functions
  createNoteEvent: (
    stringIndex: number,
    fret: number | 'open',
  ) => BassNoteEvent | null;
  triggerNote: (stringIndex: number, fret: number | 'open') => void;

  // Playback integration (temporarily null due to build issues)
  playbackIntegration: PlaybackIntegrationShape | null;

  // Audio state
  isAudioEnabled: boolean;
  audioError: Error | null;

  // Playback position tracking
  playbackPosition: PlaybackPosition;
  isCurrentNote: (stringIndex: number, fret: number | 'open') => boolean;

  // String configurations
  stringConfigs: StringConfig;
  noteMapping: typeof BASS_NOTE_MAPPING;
  octaveMapping: OctaveMapping;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Standard bass guitar string configurations
 */
const BASS_STRING_CONFIGS: StringConfig = {
  4: ['G', 'D', 'A', 'E'], // Standard 4-string bass (string 1=G, 2=D, 3=A, 4=E) - highest to lowest pitch
  5: ['G', 'D', 'A', 'E', 'B'], // 5-string bass (string 1=G, 2=D, 3=A, 4=E, 5=B) - highest to lowest pitch
  6: ['C', 'G', 'D', 'A', 'E', 'B'], // 6-string bass (string 1=C, 2=G, 3=D, 4=A, 5=E, 6=B) - highest to lowest pitch
};

/**
 * Complete note mapping for bass guitar fretboard
 * Maps fret numbers to note names for each string configuration
 */
const BASS_NOTE_MAPPING = {
  4: {
    // Standard 4-string bass tuning (string 1=G, 2=D, 3=A, 4=E) - highest to lowest pitch
    0: ['G', 'D', 'A', 'E'], // Open strings (fret 0)
    1: ['G#', 'D#', 'A#', 'F'],
    2: ['A', 'E', 'B', 'F#'],
    3: ['A#', 'F', 'C', 'G'],
    4: ['B', 'F#', 'C#', 'G#'],
    5: ['C', 'G', 'D', 'A'],
    6: ['C#', 'G#', 'D#', 'A#'],
    7: ['D', 'A', 'E', 'B'],
    8: ['D#', 'A#', 'F', 'C'],
    9: ['E', 'B', 'F#', 'C#'],
    10: ['F', 'C', 'G', 'D'],
    11: ['F#', 'C#', 'G#', 'D#'],
    12: ['G', 'D', 'A', 'E'], // Octave
  },
  5: {
    // 5-string bass tuning (string 1=G, 2=D, 3=A, 4=E, 5=B) - highest to lowest pitch
    0: ['G', 'D', 'A', 'E', 'B'], // Open strings
    1: ['G#', 'D#', 'A#', 'F', 'C'],
    2: ['A', 'E', 'B', 'F#', 'C#'],
    3: ['A#', 'F', 'C', 'G', 'D'],
    4: ['B', 'F#', 'C#', 'G#', 'D#'],
    5: ['C', 'G', 'D', 'A', 'E'],
    6: ['C#', 'G#', 'D#', 'A#', 'F'],
    7: ['D', 'A', 'E', 'B', 'F#'],
    8: ['D#', 'A#', 'F', 'C', 'G'],
    9: ['E', 'B', 'F#', 'C#', 'G#'],
    10: ['F', 'C', 'G', 'D', 'A'],
    11: ['F#', 'C#', 'G#', 'D#', 'A#'],
    12: ['G', 'D', 'A', 'E', 'B'], // Octave
  },
  6: {
    // 6-string bass tuning (string 1=C, 2=G, 3=D, 4=A, 5=E, 6=B) - highest to lowest pitch
    0: ['C', 'G', 'D', 'A', 'E', 'B'], // Open strings
    1: ['C#', 'G#', 'D#', 'A#', 'F', 'C'],
    2: ['D', 'A', 'E', 'B', 'F#', 'C#'],
    3: ['D#', 'A#', 'F', 'C', 'G', 'D'],
    4: ['E', 'B', 'F#', 'C#', 'G#', 'D#'],
    5: ['F', 'C', 'G', 'D', 'A', 'E'],
    6: ['F#', 'C#', 'G#', 'D#', 'A#', 'F'],
    7: ['G', 'D', 'A', 'E', 'B', 'F#'],
    8: ['G#', 'D#', 'A#', 'F', 'C', 'G'],
    9: ['A', 'E', 'B', 'F#', 'C#', 'G#'],
    10: ['A#', 'F', 'C', 'G', 'D', 'A'],
    11: ['B', 'F#', 'C#', 'G#', 'D#', 'A#'],
    12: ['C', 'G', 'D', 'A', 'E', 'B'], // Octave
  },
} as const;

/**
 * Octave mapping for bass strings
 * Defines the base octave for each string (before fret calculations)
 */
const BASS_OCTAVE_MAPPING: OctaveMapping = {
  4: [2, 2, 1, 1], // G2, D2, A1, E1 (string 1=G, 2=D, 3=A, 4=E) - highest to lowest pitch
  5: [2, 2, 1, 1, 0], // G2, D2, A1, E1, B0 (string 1=G, 2=D, 3=A, 4=E, 5=B) - highest to lowest pitch
  6: [3, 2, 2, 1, 1, 0], // C3, G2, D2, A1, E1, B0 (string 1=C, 2=G, 3=D, 4=A, 5=E, 6=B) - highest to lowest pitch
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Legacy exercise note for migration compatibility
 */
interface LegacyExerciseNote {
  id: string;
  timestamp: number;
  duration: number;
  string: number;
  fret: number;
  note: string;
  velocity?: number;
}

/**
 * Detects if an exercise uses the new musical timing system
 */
function isMusicalTimingExercise(exercise: any): exercise is DatabaseExercise {
  return (
    exercise?.timeSignature &&
    exercise?.notes?.some(
      (note: any) =>
        note.duration &&
        note.position &&
        typeof note.duration === 'string' &&
        typeof note.position === 'object',
    )
  );
}

/**
 * Converts legacy exercise notes to current timestamp format for playback
 */
function processExerciseNotes(
  exercise: any,
  defaultDuration: number,
): Array<{
  id: string;
  timestamp: number;
  duration: number;
  string: number;
  fret: number;
  note: string;
  velocity: number;
}> {
  if (!exercise?.notes || !Array.isArray(exercise.notes)) {
    return [];
  }

  // If it's a new musical timing exercise, convert to milliseconds for playback
  if (isMusicalTimingExercise(exercise)) {
    const bpm = exercise.bpm || 120;
    const timeSignature = exercise.timeSignature || {
      numerator: 4,
      denominator: 4,
    };

    return exercise.notes.map((note: ExerciseNote, index: number) => {
      // Convert musical position to milliseconds
      const timestamp = note.position
        ? MusicalTimeConverter.positionToMs(note.position, {
            tempo: bpm,
            timeSignature,
          })
        : note.timestamp || index * 500;

      // Convert musical duration to milliseconds
      const duration = note.duration
        ? MusicalTimeConverter.durationToMs(note.duration, bpm)
        : note.duration_ms || defaultDuration;

      return {
        id: note.id || `note-${index}`,
        timestamp,
        duration,
        string: note.string,
        fret: note.fret,
        note: note.note,
        velocity: 100, // Default velocity for now
      };
    });
  }

  // Legacy format - use as-is
  return exercise.notes.map((note: any, index: number) => ({
    id: note.id || `exercise-note-${index}`,
    timestamp: note.timestamp || index * 500,
    duration: note.duration || defaultDuration,
    string: note.string || 0,
    fret: note.fret || 0,
    note: note.note || 'A',
    velocity: note.velocity || 100,
  }));
}

/**
 * Converts timestamp back to musical position if exercise supports it
 */
function timestampToMusicalPosition(
  timestamp: number,
  exercise: any,
): MusicalPosition | undefined {
  if (!isMusicalTimingExercise(exercise)) {
    return undefined;
  }

  const bpm = exercise.bpm || 120;
  const timeSignature = exercise.timeSignature || {
    numerator: 4,
    denominator: 4,
  };

  return MusicalTimeConverter.msToPosition(timestamp, {
    tempo: bpm,
    timeSignature,
  });
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Custom hook for bass fretboard audio integration
 *
 * Provides unified audio logic for both 2D and 3D fretboard components,
 * including note mapping, audio triggering, and playback integration.
 *
 * @param config - Configuration options for the audio fretboard
 * @returns Audio functions and state for fretboard interaction
 */
export function useAudioFretboard(
  config: UseAudioFretboardConfig,
): UseAudioFretboardReturn {
  const {
    stringCount,
    autoPlayOnClick = true,
    defaultDuration = 500,
    defaultVelocity = 100,
    defaultNoteDuration = 'quarter',
    exercise,
    syncProps,
  } = config;

  // Determine if this is a musical timing exercise
  const isMusicalExercise = useMemo(
    () => isMusicalTimingExercise(exercise),
    [exercise],
  );

  // Playback position state
  const [playbackPosition, setPlaybackPosition] = useState<PlaybackPosition>({
    currentNoteIndex: -1,
    currentNote: null,
    isPlaying: false,
    currentTime: 0,
    progress: 0,
    musicalPosition: undefined,
    isMusicalTiming: false, // Will be updated by useEffect
  });

  // TODO: Re-enable when playback domain build issues are resolved
  // Playback integration for actual audio triggering
  // const playbackIntegration = usePlaybackIntegration({
  //   exercise,
  //   onNoteEvent: useCallback((note) => {
  //     logger.info('🎵 Note event from engine:', note);
  //   }, []),
  //   onBeatEvent: useCallback((beat) => {
  //     logger.info('🥁 Beat event from engine:', beat);
  //   }, []),
  // });
  const playbackIntegration = null; // Temporary placeholder

  // Memoized configurations to prevent unnecessary re-renders
  const stringConfigs = useMemo(() => BASS_STRING_CONFIGS, []);
  const noteMapping = useMemo(() => BASS_NOTE_MAPPING, []);
  const octaveMapping = useMemo(() => BASS_OCTAVE_MAPPING, []);

  // Extract exercise notes for playback tracking
  const exerciseNotes = useMemo(() => {
    const notes = processExerciseNotes(exercise, defaultDuration);

    // Log timing system detection
    if (exercise && notes.length > 0) {
      const isMusical = isMusicalTimingExercise(exercise);
      // Note: Musical timing converted to millisecond timing for compatibility
    }

    return notes;
  }, [exercise, defaultDuration]);

  // Update playback position when exercise changes
  useEffect(() => {
    setPlaybackPosition((prev) => ({
      ...prev,
      isMusicalTiming: isMusicalExercise,
    }));
  }, [isMusicalExercise]);

  // Update playback position based on sync props
  useEffect(() => {
    if (!syncProps) return;

    const isPlaying = syncProps.isPlaying || false;
    const currentTime = syncProps.currentTime || 0;

    setPlaybackPosition((prev): PlaybackPosition => {
      // If not playing, reset position
      if (!isPlaying) {
        return {
          ...prev,
          isPlaying: false,
          currentTime: 0,
          currentNoteIndex: -1,
          currentNote: null,
          progress: 0,
          musicalPosition: undefined,
          isMusicalTiming: isMusicalExercise,
        };
      }

      // Find current note index based on timestamp
      let currentNoteIndex = -1;
      let currentNote = null;

      if (exerciseNotes.length > 0) {
        // Find the note that should be playing at current time
        for (let i = 0; i < exerciseNotes.length; i++) {
          const note = exerciseNotes[i];
          if (!note) continue;

          const noteStart = note.timestamp;
          const noteEnd = noteStart + note.duration;

          if (currentTime >= noteStart && currentTime < noteEnd) {
            currentNoteIndex = i;
            // Create note event inline to avoid circular dependency
            const fretNum = note.fret || 0;
            const notes = noteMapping[stringCount];
            const octaves = octaveMapping[stringCount];

            const visualStringIndex = stringCount - note.string; // Convert exercise string to visual string index
            if (
              notes[fretNum as keyof typeof notes] &&
              octaves[visualStringIndex] !== undefined
            ) {
              const noteName =
                notes[fretNum as keyof typeof notes][visualStringIndex] || 'A';
              const baseOctave = octaves[visualStringIndex];
              const octaveOffset = Math.floor(fretNum / 12);
              const finalOctave = baseOctave + octaveOffset;

              currentNote = {
                id: `exercise-note-${i}`,
                string: visualStringIndex, // Use visual string index for consistent comparison
                fret: fretNum,
                note: noteName,
                octave: finalOctave,
                velocity: note.velocity || defaultVelocity,
                // Legacy timing for backwards compatibility
                timestamp: noteStart,
                duration_ms: note.duration || defaultDuration,
                // New musical timing (optional for now)
                duration: undefined,
                position: undefined,
              };
            }
            break;
          }
        }

        // Calculate progress (0-1)
        const totalDuration =
          exerciseNotes.length > 0
            ? Math.max(
                ...exerciseNotes.map((n: any) => n.timestamp + n.duration),
              )
            : 0;
        const progress =
          totalDuration > 0 ? Math.min(currentTime / totalDuration, 1) : 0;

        // Calculate musical position if using musical timing
        const musicalPosition = isMusicalExercise
          ? timestampToMusicalPosition(currentTime, exercise)
          : undefined;

        return {
          currentNoteIndex,
          currentNote,
          isPlaying,
          currentTime,
          progress,
          musicalPosition,
          isMusicalTiming: isMusicalExercise,
        };
      }

      return {
        ...prev,
        isPlaying,
        currentTime,
        progress: 0,
        musicalPosition: isMusicalExercise
          ? timestampToMusicalPosition(currentTime, exercise)
          : undefined,
        isMusicalTiming: isMusicalExercise,
      };
    });
  }, [
    syncProps?.isPlaying,
    syncProps?.currentTime,
    exerciseNotes,
    noteMapping,
    octaveMapping,
    stringCount,
    defaultDuration,
    defaultVelocity,
    exercise,
    isMusicalExercise,
  ]);

  /**
   * Creates a note event from fretboard position
   *
   * @param stringIndex - Zero-based string index (0 = lowest string)
   * @param fret - Fret number or 'open' for open string
   * @returns Note event object or null if invalid position
   */
  const createNoteEvent = useCallback(
    (stringIndex: number, fret: number | 'open'): BassNoteEvent | null => {
      const fretNum = fret === 'open' ? 0 : fret;
      const notes = noteMapping[stringCount];
      const octaves = octaveMapping[stringCount];

      // Validate inputs
      if (!notes[fretNum as keyof typeof notes] || !octaves[stringIndex]) {
        logger.warn(
          `⚠️ Invalid fretboard position: string ${stringIndex}, fret ${fret}`,
        );
        return null;
      }

      // Calculate note and octave
      const noteName = notes[fretNum as keyof typeof notes][stringIndex] || 'A';
      const baseOctave = octaves[stringIndex];
      const octaveOffset = Math.floor(fretNum / 12);
      const finalOctave = baseOctave + octaveOffset;

      // Create note event with both timing systems
      const noteEvent: BassNoteEvent = {
        id: `note-${Date.now()}-${stringIndex}-${fretNum}`,
        string: stringIndex,
        fret: fretNum,
        note: noteName,
        octave: finalOctave,
        velocity: defaultVelocity,

        // New musical timing system
        duration: defaultNoteDuration,
        // Position will be calculated in real-time based on playback context

        // Legacy timing for backwards compatibility
        timestamp: Date.now(),
        duration_ms: defaultDuration,
      };

      return noteEvent;
    },
    [
      stringCount,
      noteMapping,
      octaveMapping,
      defaultDuration,
      defaultVelocity,
      defaultNoteDuration,
    ],
  );

  /**
   * Triggers audio playback for a fretboard position
   *
   * @param stringIndex - Zero-based string index
   * @param fret - Fret number or 'open' for open string
   */
  const triggerNote = useCallback(
    (stringIndex: number, fret: number | 'open'): void => {
      if (!autoPlayOnClick) return;

      const noteEvent = createNoteEvent(stringIndex, fret);
      if (!noteEvent) return;

      // TODO: Re-enable when playback domain build issues are resolved
      // Attempt to trigger actual audio if playback integration is available
      if (playbackIntegration?.engine) {
        try {
          // Trigger note
          // Note triggered: { note, octave, string, fret }

          // Trigger audio with BassInstrumentProcessor
          playbackIntegration.engine.processNoteEvent?.(noteEvent);
        } catch (error) {
          logger.warn('⚠️ Audio trigger failed:', error);
        }
      } else {
        // Fallback: Note would be triggered
        // Note would be triggered: { note, octave, string, fret, mode: 'fallback' }
      }
    },
    [autoPlayOnClick, createNoteEvent, playbackIntegration],
  );

  // Audio state management
  const isAudioEnabled = useMemo(() => {
    return (
      autoPlayOnClick &&
      playbackIntegration?.state?.isInitialized === true
    );
  }, [autoPlayOnClick, playbackIntegration]);

  const audioError = useMemo(() => {
    return playbackIntegration?.state?.error || null;
  }, [playbackIntegration]);

  /**
   * Checks if a specific fretboard position is the currently playing note
   *
   * @param stringIndex - Zero-based string index
   * @param fret - Fret number or 'open' for open string
   * @returns True if this position matches the current note
   */
  const isCurrentNote = useCallback(
    (stringIndex: number, fret: number | 'open'): boolean => {
      if (
        !playbackPosition.currentNote ||
        playbackPosition.currentNoteIndex === -1
      ) {
        return false;
      }

      const currentNote = playbackPosition.currentNote;
      const fretNum = fret === 'open' ? 0 : fret;

      return currentNote.string === stringIndex && currentNote.fret === fretNum;
    },
    [playbackPosition.currentNote, playbackPosition.currentNoteIndex],
  );

  return {
    // Core audio functions
    createNoteEvent,
    triggerNote,

    // Playback integration
    playbackIntegration,

    // Audio state
    isAudioEnabled,
    audioError,

    // Playback position tracking
    playbackPosition,
    isCurrentNote,

    // Configuration data
    stringConfigs,
    noteMapping,
    octaveMapping,
  };
}

export default useAudioFretboard;
