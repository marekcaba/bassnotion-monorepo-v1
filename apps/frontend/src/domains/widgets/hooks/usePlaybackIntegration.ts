'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCorePlaybackEngine } from '@/domains/playback';

// Simple exercise interface for playback integration
interface PlaybackExercise {
  id: string;
  title: string;
  bpm?: number;
  notes?: Array<{
    id: string;
    timestamp: number;
    string: number;
    fret: number;
    note: string;
    duration: number;
  }>;
  chord_progression?: string[];
}

interface PlaybackIntegrationConfig {
  exercise?: PlaybackExercise;
  onNoteEvent?: (note: NoteEvent) => void;
  onBeatEvent?: (beat: BeatEvent) => void;
  onChordChange?: (chord: ChordEvent) => void;
}

interface NoteEvent {
  id: string;
  timestamp: number;
  string: number;
  fret: number;
  note: string;
  duration: number;
}

interface BeatEvent {
  timestamp: number;
  beat: number;
  measure: number;
  tempo: number;
}

interface ChordEvent {
  timestamp: number;
  chord: string;
  progression: string[];
  currentIndex: number;
}

interface PlaybackIntegrationState {
  isInitialized: boolean;
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  latency: number;
  error: Error | null;
}

interface PlaybackIntegrationControls {
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  setTempo: (bpm: number) => void;
  setVolume: (source: string, volume: number) => void;
  reset: () => Promise<void>;
}

export interface UsePlaybackIntegrationReturn {
  state: PlaybackIntegrationState;
  controls: PlaybackIntegrationControls;
  engine: any; // CorePlaybackEngine instance
}

export function usePlaybackIntegration(
  config: PlaybackIntegrationConfig = {},
): UsePlaybackIntegrationReturn {
  const { exercise, onNoteEvent, onBeatEvent, onChordChange } = config;

  // Core Playback Engine hook
  const {
    engine,
    state: engineState,
    controls: engineControls,
  } = useCorePlaybackEngine({
    autoInitialize: true,
    enablePerformanceMonitoring: true,
    mobileOptimized: true,
  });

  // Integration state
  const [integrationState, setIntegrationState] =
    useState<PlaybackIntegrationState>({
      isInitialized: false,
      isPlaying: false,
      currentTime: 0,
      tempo: 120,
      latency: 0,
      error: null,
    });

  // Refs for event handling
  const noteEventRef = useRef(onNoteEvent);
  const beatEventRef = useRef(onBeatEvent);
  const chordEventRef = useRef(onChordChange);
  const exerciseNotesRef = useRef<NoteEvent[]>([]);
  const exerciseProgressionRef = useRef<string[]>([]);

  // Update refs when callbacks change
  useEffect(() => {
    noteEventRef.current = onNoteEvent;
    beatEventRef.current = onBeatEvent;
    chordEventRef.current = onChordChange;
  }, [onNoteEvent, onBeatEvent, onChordChange]);

  // Process exercise data
  const processExerciseData = useCallback((exercise: PlaybackExercise) => {
    try {
      const notes: NoteEvent[] = [];
      const progression: string[] = [];

      // Process exercise notes
      if (exercise.notes && Array.isArray(exercise.notes)) {
        exercise.notes.forEach((note, index) => {
          notes.push({
            id: note.id || `note-${index}`,
            timestamp: note.timestamp || index * 500,
            string: note.string || 1,
            fret: note.fret || 0,
            note: note.note || 'E',
            duration: note.duration || 500,
          });
        });
      }

      // Process chord progression
      if (
        exercise.chord_progression &&
        Array.isArray(exercise.chord_progression)
      ) {
        progression.push(...exercise.chord_progression);
      } else {
        // Default progression
        progression.push('C', 'Am', 'F', 'G');
      }

      exerciseNotesRef.current = notes;
      exerciseProgressionRef.current = progression;

      console.log('🎵 Exercise data processed:', {
        exerciseId: exercise.id,
        notesCount: notes.length,
        chords: progression,
        bpm: exercise.bpm,
      });

      return { notes, progression };
    } catch (error) {
      console.error('❌ Error processing exercise data:', error);
      return { notes: [], progression: [] };
    }
  }, []);

  // Initialize integration when engine is ready
  useEffect(() => {
    if (!engine) {
      setIntegrationState((prev) => ({
        ...prev,
        isInitialized: false,
        error: new Error('Playback engine not available'),
      }));
      return;
    }

    if (!engineState.isInitialized) {
      setIntegrationState((prev) => ({
        ...prev,
        isInitialized: false,
        error: null,
      }));
      return;
    }

    setIntegrationState((prev) => ({
      ...prev,
      isInitialized: true,
      latency: engineState.performanceMetrics?.latency || 0,
      error: null,
    }));
  }, [engineState.isInitialized, engine]);

  // Sync with engine state
  useEffect(() => {
    if (!engine) {
      return;
    }

    setIntegrationState((prev) => ({
      ...prev,
      isPlaying: engineState.isPlaying,
      tempo: engineState.config.tempo,
      latency: engineState.performanceMetrics?.latency || prev.latency,
    }));
  }, [
    engine,
    engineState.isPlaying,
    engineState.config.tempo,
    engineState.performanceMetrics?.latency,
  ]);

  // Load exercise data when exercise changes
  useEffect(() => {
    if (!exercise || !engine) return;

    try {
      processExerciseData(exercise);

      // Update engine with exercise data
      if (exercise.bpm && exercise.bpm > 0) {
        engineControls.setTempo(exercise.bpm);
      }
    } catch (error) {
      setIntegrationState((prev) => ({
        ...prev,
        error: error as Error,
      }));
    }
  }, [exercise, engine, processExerciseData, engineControls]);

  // Integration controls
  const controls: PlaybackIntegrationControls = {
    play: async () => {
      if (!engine || !integrationState.isInitialized) {
        throw new Error('Playback engine not initialized');
      }

      try {
        await engineControls.play();
      } catch (error) {
        setIntegrationState((prev) => ({
          ...prev,
          error: error as Error,
        }));
        throw error;
      }
    },

    pause: () => {
      if (!engine) return;

      engineControls.pause();
    },

    stop: () => {
      if (!engine) return;

      engineControls.stop();
    },

    setTempo: (bpm: number) => {
      if (!engine) return;

      engineControls.setTempo(bpm);
    },

    setVolume: (source: string, volume: number) => {
      if (!engine) return;

      if (source === 'master') {
        engineControls.setMasterVolume(volume / 100);
      } else {
        engineControls.setSourceVolume(source, volume / 100);
      }
    },

    reset: async () => {
      if (!engine) return;

      try {
        await engineControls.stop();
        setIntegrationState((prev) => ({
          ...prev,
          currentTime: 0,
          isPlaying: false,
          error: null,
        }));
        console.log('🔄 Playback reset');
      } catch (error) {
        console.error('❌ Error resetting playback:', error);
        setIntegrationState((prev) => ({
          ...prev,
          error: error as Error,
        }));
      }
    },
  };

  return {
    state: integrationState,
    controls,
    engine,
  };
}
