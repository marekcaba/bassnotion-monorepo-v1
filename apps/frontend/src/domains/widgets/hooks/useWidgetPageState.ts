'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('useWidgetPageState');

// Global State Interface as specified in the story
export interface WidgetPageState {
  // Playback Control
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  volume: {
    master: number;
    metronome: number;
    drums: number;
    bass: number;
  };

  // Exercise Data
  // REFACTORED: selectedExercise removed - use single source of truth from exercises array
  // Exercise is now derived in YouTubeWidgetPage and passed down as prop
  playbackMode: 'practice' | 'performance';
  harmonyInstrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad';

  // Widget States
  widgets: {
    metronome: { bpm: number; isVisible: boolean };
    drummer: { pattern: string; isVisible: boolean };
    bassLine: { pattern: string; isVisible: boolean };
    harmony: {
      progression: string[];
      currentChord: number;
      isVisible: boolean;
    };
  };

  // Synchronization
  syncEnabled: boolean;
  fretboardAnimation: boolean;

  // Loop Control
  loopRegion: LoopRegion | null;
  isLoopEnabled: boolean;
}

// Import Exercise type from contracts
import type { Exercise } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
// Epic 3.18: ExerciseTimelineIntegrator removed
// import { exerciseTimelineIntegrator } from '@/domains/playback/services/ExerciseTimelineIntegrator';

// Stub for exerciseTimelineIntegrator
const exerciseTimelineIntegrator = {
  async clearExercise() {
    // Stub implementation
  },
  async loadExercise(_exercise: any, _options: any) {
    // Stub implementation
  },
  getCurrentSection() {
    return null;
  },
  getProgress() {
    return 0;
  },
};

// Loop region interface
export interface LoopRegion {
  startMeasure: number;
  endMeasure: number;
}

// Initial state with MVP defaults
const initialState: WidgetPageState = {
  // Playback Control
  isPlaying: false,
  currentTime: 0,
  tempo: 100, // Default BPM
  volume: {
    master: 80,
    metronome: 70,
    drums: 60,
    bass: 75,
  },

  // Exercise Data
  // REFACTORED: selectedExercise removed from initial state
  playbackMode: 'practice',

  // Widget States - MVP requirements
  widgets: {
    metronome: {
      bpm: 100,
      isVisible: true,
    },
    drummer: {
      pattern: 'Jazz Swing',
      isVisible: true,
    },
    bassLine: {
      pattern: 'Modal Walking',
      isVisible: true,
    },
    harmony: {
      progression: ['Dm7', 'G7', 'CMaj7'],
      currentChord: 0,
      isVisible: true,
    },
  },

  // Synchronization
  syncEnabled: true,
  fretboardAnimation: true,

  // Loop Control
  loopRegion: null,
  isLoopEnabled: false,
};

// Render counter for debugging infinite re-renders (only in development with debug enabled)
let renderCount = 0;
let prevStateRef: WidgetPageState | null = null;

export function useWidgetPageState() {
  renderCount++;
  // Only log in development with debug mode enabled
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_LOG_LEVEL === 'DEBUG') {
    if (renderCount % 100 === 0) { // Reduced frequency
      logger.debug(`useWidgetPageState render count: ${renderCount}`);
    }
  }

  const [state, setState] = useState<WidgetPageState>(initialState);

  // Only track state changes in debug mode
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_LOG_LEVEL === 'DEBUG') {
    if (renderCount % 100 === 0 && prevStateRef) {
      const changes: string[] = [];
      if (prevStateRef.isPlaying !== state.isPlaying)
        changes.push(`isPlaying: ${prevStateRef.isPlaying} -> ${state.isPlaying}`);
      if (prevStateRef.tempo !== state.tempo)
        changes.push(`tempo: ${prevStateRef.tempo} -> ${state.tempo}`);
      // REFACTORED: selectedExercise removed from state (now derived in parent)

      if (changes.length > 0) {
        logger.debug('State changes:', changes);
      }
    }
  }
  prevStateRef = state;

  // Master play/pause control
  const togglePlayback = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isPlaying: !prev.isPlaying,
    }));
  }, []);

  // Timeline scrubber control
  const setCurrentTime = useCallback((time: number) => {
    setState((prev) => ({
      ...prev,
      currentTime: time,
    }));
  }, []);

  // Tempo control that syncs all widgets
  const setTempo = useCallback((newTempo: number) => {
    setState((prev) => ({
      ...prev,
      tempo: newTempo,
      widgets: {
        ...prev.widgets,
        metronome: {
          ...prev.widgets.metronome,
          bpm: newTempo,
        },
      },
    }));
  }, []);

  // Volume controls for different audio sources
  const setVolume = useCallback(
    (source: keyof WidgetPageState['volume'], volume: number) => {
      setState((prev) => ({
        ...prev,
        volume: {
          ...prev.volume,
          [source]: volume,
        },
      }));
    },
    [],
  );

  // Exercise selection with data integration
  const setSelectedExercise = useCallback(
    async (exercise: Exercise | undefined) => {
      // Clear exercise if undefined
      if (!exercise) {
        await exerciseTimelineIntegrator.clearExercise();
        setState((prev) => ({
          ...prev,
          // REFACTORED: selectedExercise removed from state
          harmonyInstrument: undefined,
        }));
        return;
      }

      // CRITICAL DEBUG: Log exercise entity to trace harmonyInstrument
      // console.log('🔍 [STATE-FLOW-1] setSelectedExercise called with:', {
      //   exerciseId: exercise.id?.value,
      //   title: exercise.title,
      //   harmonyInstrument: exercise.harmonyInstrument,
      //   hasHarmonyInstrumentGetter: typeof exercise.harmonyInstrument !== 'undefined',
      //   exerciseType: typeof exercise,
      //   exerciseConstructor: exercise.constructor?.name,
      // });

      // Convert Exercise to ExerciseData format for timeline integration
      const exerciseData = {
        id: exercise.id,
        title: exercise.title,
        total_bars: Math.ceil(
          (exercise.duration_beats || 16) /
            (exercise.timeSignature?.numerator || 4),
        ),
        tempo: exercise.bpm || 120,
        key_signature: exercise.key || 'C',
        time_signature: exercise.timeSignature || {
          numerator: 4,
          denominator: 4,
        },
        musical_content: {
          bass: {
            enabled: exercise.notes && exercise.notes.length > 0,
            notes: exercise.notes || [],
          },
          drums: {
            enabled: true, // Enable drums by default
            resolution: 480,
            patterns: [], // Will use default patterns
            arrangement: [], // Will use default arrangement
          },
          harmony: {
            enabled:
              exercise.chord_progression &&
              exercise.chord_progression.length > 0,
            progression: exercise.chord_progression
              ? exercise.chord_progression.map((chord, index) => ({
                  position: {
                    measure: Math.floor(index / 2) + 1,
                    beat: (index % 2) * 2 + 1,
                    subdivision: 0,
                  },
                  chord,
                  duration: 'half' as const,
                }))
              : [],
          },
        },
        mix_settings: {
          levels: {
            bass: 0.8,
            drums: 0.7,
            harmony: 0.6,
          },
          master: 1.0,
        },
      };

      // Load exercise into timeline integrator
      try {
        await exerciseTimelineIntegrator.loadExercise(exerciseData, {
          autoPlay: false,
          userTempo: exercise.bpm,
        });
      } catch (error) {
        logger.error('Failed to load exercise into timeline:', error);
      }

      // CRITICAL DEBUG: Extract harmonyInstrument BEFORE setting state
      // No default instrument - use exercise's harmonyInstrument or undefined
      const extractedHarmonyInstrument = exercise.harmonyInstrument;

      // console.log('🔍 [STATE-FLOW-2] Extracting harmonyInstrument:', {
      //   exerciseId: exercise.id.value,
      //   title: exercise.title,
      //   rawHarmonyInstrument: exercise.harmonyInstrument,
      //   extractedHarmonyInstrument,
      //   typeOf: typeof exercise.harmonyInstrument,
      //   isUndefined: exercise.harmonyInstrument === undefined,
      //   isNull: exercise.harmonyInstrument === null,
      // });

      setState((prev) => {
        const newState = {
          ...prev,
          // REFACTORED: selectedExercise removed from state (now derived in parent)
          harmonyInstrument: extractedHarmonyInstrument,
        };

        // Update widget states based on exercise data
        if (exercise) {
          // Update tempo from exercise BPM
          if (exercise.bpm && exercise.bpm > 0) {
            newState.tempo = exercise.bpm;
            newState.widgets = {
              ...prev.widgets,
              metronome: {
                ...prev.widgets.metronome,
                bpm: exercise.bpm,
              },
            };
          }

          // Update harmony progression from exercise data
          if (
            exercise.chord_progression &&
            Array.isArray(exercise.chord_progression)
          ) {
            // Use exercise's chord progression
            newState.widgets = {
              ...newState.widgets,
              harmony: {
                ...newState.widgets.harmony,
                progression: exercise.chord_progression,
                currentChord: 0, // Reset to first chord
              },
            };
          } else if (exercise.key) {
            // Fallback: Generate chord progression based on key (I-vi-IV-V)
            const baseKey = exercise.key.replace(/[^A-G#b]/g, '');
            const majorProgressions: Record<string, string[]> = {
              C: ['C', 'Am', 'F', 'G'],
              D: ['D', 'Bm', 'G', 'A'],
              E: ['E', 'C#m', 'A', 'B'],
              F: ['F', 'Dm', 'Bb', 'C'],
              G: ['G', 'Em', 'C', 'D'],
              A: ['A', 'F#m', 'D', 'E'],
              B: ['B', 'G#m', 'E', 'F#'],
            };

            const progression = majorProgressions[baseKey] || [
              'Dm7',
              'G7',
              'CMaj7',
            ];
            newState.widgets = {
              ...newState.widgets,
              harmony: {
                ...newState.widgets.harmony,
                progression,
                currentChord: 0, // Reset to first chord
              },
            };
          }

          // Log only significant events
          logger.debug('Exercise selected', { exerciseId: exercise.id });
        }

        return newState;
      });
    },
    [],
  );

  // Widget visibility controls
  const toggleWidgetVisibility = useCallback(
    (widget: keyof WidgetPageState['widgets']) => {
      setState((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          [widget]: {
            ...prev.widgets[widget],
            isVisible: !prev.widgets[widget].isVisible,
          },
        },
      }));
    },
    [],
  );

  // Harmony chord progression
  const nextChord = useCallback(() => {
    setState((prev) => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        harmony: {
          ...prev.widgets.harmony,
          currentChord:
            (prev.widgets.harmony.currentChord + 1) %
            prev.widgets.harmony.progression.length,
        },
      },
    }));
  }, []);

  // Synchronization toggle
  const toggleSync = useCallback(() => {
    setState((prev) => ({
      ...prev,
      syncEnabled: !prev.syncEnabled,
    }));
  }, []);

  // Fretboard animation toggle
  const toggleFretboardAnimation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      fretboardAnimation: !prev.fretboardAnimation,
    }));
  }, []);

  // Loop region control
  const setLoopRegion = useCallback((region: LoopRegion | null) => {
    setState((prev) => ({
      ...prev,
      loopRegion: region,
      isLoopEnabled: region !== null,
    }));
  }, []);

  // Toggle loop enabled state
  const toggleLoopEnabled = useCallback(() => {
    setState((prev) => ({
      ...prev,
      isLoopEnabled: !prev.isLoopEnabled,
    }));
  }, []);

  // Reset to initial state
  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  // CRITICAL FIX: Return state directly with stable callbacks
  // Components need to re-render when state changes, so we can't use the getter pattern
  // that hides state changes from React's reactivity system
  return {
    // State - direct exposure so React can track changes
    state,

    // Actions (these are already stable due to useCallback)
    togglePlayback,
    setCurrentTime,
    setTempo,
    setVolume,
    setSelectedExercise,
    toggleWidgetVisibility,
    nextChord,
    toggleSync,
    toggleFretboardAnimation,
    setLoopRegion,
    toggleLoopEnabled,
    resetState,

    // Computed values - expose directly from state so React can track changes
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    tempo: state.tempo,
    // REFACTORED: selectedExercise removed - now derived in parent component
    widgets: state.widgets,
    syncEnabled: state.syncEnabled,
    fretboardAnimation: state.fretboardAnimation,
    loopRegion: state.loopRegion,
    isLoopEnabled: state.isLoopEnabled,
    harmonyInstrument: state.harmonyInstrument,
  };
}

export type UseWidgetPageStateReturn = ReturnType<typeof useWidgetPageState>;
