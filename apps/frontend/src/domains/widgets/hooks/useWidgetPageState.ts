'use client';

import { useState, useCallback } from 'react';

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
}

// Import Exercise type from contracts
import type { DatabaseExercise as Exercise } from '@bassnotion/contracts';

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
};

export function useWidgetPageState() {
  const [state, setState] = useState<WidgetPageState>(initialState);

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
  const setSelectedExercise = useCallback((exercise: Exercise | undefined) => {
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

        console.log(
          '🎯 useWidgetPageState: Exercise selected, updating widgets:',
          {
            exerciseId: exercise.id,
            title: exercise.title,
            bpm: exercise.bpm,
            key: exercise.key,
            chords: exercise.chord_progression,
          },
        );
      }

      return newState;
    });
  }, []);

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

  // Reset to initial state
  const resetState = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    // State
    state,

    // Actions
    togglePlayback,
    setCurrentTime,
    setTempo,
    setVolume,
    setSelectedExercise,
    toggleWidgetVisibility,
    nextChord,
    toggleSync,
    toggleFretboardAnimation,
    resetState,

    // Computed values
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    tempo: state.tempo,
    selectedExercise: state.selectedExercise,
    widgets: state.widgets,
    syncEnabled: state.syncEnabled,
    fretboardAnimation: state.fretboardAnimation,
  };
}

export type UseWidgetPageStateReturn = ReturnType<typeof useWidgetPageState>;
