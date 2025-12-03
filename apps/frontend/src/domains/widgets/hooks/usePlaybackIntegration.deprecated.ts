/**
 * DEPRECATED: usePlaybackIntegration Hook
 * 
 * This hook represents an old pattern of tightly coupling playback with widgets.
 * In the modern architecture:
 * - Use useTransport() for global playback control
 * - Use useTrack() for individual instrument control
 * - Use EventBus for communication between components
 * 
 * This file provides a minimal implementation for backward compatibility.
 */

import { useTransport } from '@/domains/playback/contexts/TransportContext';
import { logger } from '@/domains/playback/utils/logger.js';

// Re-export original interfaces for compatibility
export interface PlaybackExercise {
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

export interface PlaybackIntegrationConfig {
  exercise?: PlaybackExercise;
  onNoteEvent?: (note: NoteEvent) => void;
  onBeatEvent?: (beat: BeatEvent) => void;
  onChordChange?: (chord: ChordEvent) => void;
}

export interface NoteEvent {
  id: string;
  timestamp: number;
  string: number;
  fret: number;
  note: string;
  duration: number;
}

export interface BeatEvent {
  timestamp: number;
  beat: number;
  measure: number;
  tempo: number;
}

export interface ChordEvent {
  timestamp: number;
  chord: string;
  progression: string[];
  currentIndex: number;
}

export interface PlaybackIntegrationState {
  isInitialized: boolean;
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  latency: number;
  error: Error | null;
}

export interface PlaybackIntegrationControls {
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
  engine: any; // For compatibility, returns null
}

/**
 * @deprecated Use useTransport() for playback control instead
 */
export function usePlaybackIntegration(
  config: PlaybackIntegrationConfig = {},
): UsePlaybackIntegrationReturn {
  console.warn(
    '⚠️ usePlaybackIntegration is deprecated. Use useTransport() for playback control instead.'
  );

  const transport = useTransport();

  // Map transport state to integration state
  const state: PlaybackIntegrationState = {
    isInitialized: true, // Transport is always ready
    isPlaying: transport.isPlaying,
    currentTime: transport.position.seconds,
    tempo: transport.tempo,
    latency: 0, // Not tracked in new system
    error: null,
  };

  // Map transport controls to integration controls
  const controls: PlaybackIntegrationControls = {
    play: async () => {
      await transport.start();
    },
    pause: () => {
      void transport.pause();
    },
    stop: () => {
      void transport.stop();
    },
    setTempo: (bpm: number) => {
      void transport.setTempo(bpm);
    },
    setVolume: (source: string, volume: number) => {
      // Volume control is now handled by individual tracks
      logger.warn('setVolume is deprecated. Use track.setVolume() instead');
    },
    reset: async () => {
      await transport.stop();
      await transport.seekTo(0);
    },
  };

  // Note: The event callbacks (onNoteEvent, onBeatEvent, onChordChange) are no longer used
  // in the modern architecture. Components should subscribe to EventBus events instead.

  return {
    state,
    controls,
    engine: null, // No engine in modern architecture
  };
}