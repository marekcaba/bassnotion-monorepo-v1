'use client';

import { useState, useCallback, useMemo, useRef } from 'react';

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
  selectedExercise?: Exercise;
  playbackMode: 'practice' | 'performance';

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
  selectedExercise: undefined,
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

// Render counter for debugging infinite re-renders
let renderCount = 0;
let prevStateRef: WidgetPageState | null = null;

export function useWidgetPageState() {
  renderCount++;
  // Only log every 10th render to reduce noise
  if (renderCount % 10 === 0) {
    logger.info(`🔄 useWidgetPageState RENDER #${renderCount}`, {
      timestamp: Date.now(),
      stack: new Error().stack?.split('\n').slice(1, 4).join(' <- '),
    });
  }

  const [state, setState] = useState<WidgetPageState>(initialState);

  // Track what changed in state
  if (renderCount % 10 === 0 && prevStateRef) {
    const changes: string[] = [];
    if (prevStateRef.isPlaying !== state.isPlaying)
      changes.push(
        `isPlaying: ${prevStateRef.isPlaying} -> ${state.isPlaying}`,
      );
    if (prevStateRef.currentTime !== state.currentTime)
      changes.push(
        `currentTime: ${prevStateRef.currentTime} -> ${state.currentTime}`,
      );
    if (prevStateRef.tempo !== state.tempo)
      changes.push(`tempo: ${prevStateRef.tempo} -> ${state.tempo}`);
    if (prevStateRef.selectedExercise?.id !== state.selectedExercise?.id)
      changes.push(
        `selectedExercise: ${prevStateRef.selectedExercise?.id} -> ${state.selectedExercise?.id}`,
      );
    if (JSON.stringify(prevStateRef.volume) !== JSON.stringify(state.volume))
      changes.push('volume changed');
    if (JSON.stringify(prevStateRef.widgets) !== JSON.stringify(state.widgets))
      changes.push('widgets changed');

    if (changes.length > 0) {
      logger.info('🔄 State changes detected:', changes);
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
        setState((prev) => ({ ...prev, selectedExercise: undefined }));
        return;
      }

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

      setState((prev) => {
        const newState = {
          ...prev,
          selectedExercise: exercise,
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

          // Debug log (disabled to reduce console noise)
          // logger.info(
          //   '🎯 useWidgetPageState: Exercise selected, updating widgets:',
          //   {
          //     exerciseId: exercise.id,
          //     title: exercise.title,
          //     bpm: exercise.bpm,
          //     key: exercise.key,
          //     chords: exercise.chord_progression,
          //   },
          // );
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

  // CRITICAL FIX: Create a stable return object that doesn't change unless necessary
  // Use refs to maintain stability while still providing access to current values
  const stateRef = useRef(state);
  stateRef.current = state;

  // Create getters that access current state through ref
  const stableReturn = useMemo(
    () => {
      if (renderCount % 10 === 0) {
        logger.info('🔄 useWidgetPageState: Creating new return object');
      }

      return {
        // State - expose through getter to maintain reference stability
        get state() {
          return stateRef.current;
        },

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

        // Computed values - use getters to always return current values
        get isPlaying() {
          return stateRef.current.isPlaying;
        },
        get currentTime() {
          return stateRef.current.currentTime;
        },
        get tempo() {
          return stateRef.current.tempo;
        },
        get selectedExercise() {
          return stateRef.current.selectedExercise;
        },
        get widgets() {
          return stateRef.current.widgets;
        },
        get syncEnabled() {
          return stateRef.current.syncEnabled;
        },
        get fretboardAnimation() {
          return stateRef.current.fretboardAnimation;
        },
        get loopRegion() {
          return stateRef.current.loopRegion;
        },
        get isLoopEnabled() {
          return stateRef.current.isLoopEnabled;
        },
      };
    },
    // Only depend on the stable callback functions
    // State changes won't trigger object recreation
    [
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
    ],
  );

  return stableReturn;
}

export type UseWidgetPageStateReturn = ReturnType<typeof useWidgetPageState>;
