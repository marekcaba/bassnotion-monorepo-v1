/**
 * Playback State Management Store (Zustand)
 *
 * Manages playback controls state and audio configuration
 * for widget consumption and synchronization.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  PlaybackState,
  AudioContextState,
  CoreAudioEngineConfig,
  AudioPerformanceMetrics,
  AudioSourceConfig,
  PerformanceAlert,
  MobileAudioConfig,
} from '../types/audio.js';

export interface PlaybackControlsState {
  // Engine state
  playbackState: PlaybackState;
  audioContextState: AudioContextState;
  isInitialized: boolean;
  isLoading: boolean;
  error: string | null;

  // Configuration
  config: CoreAudioEngineConfig;
  mobileConfig: MobileAudioConfig;

  // Audio sources
  audioSources: Map<string, AudioSourceConfig>;

  // Performance monitoring
  performanceMetrics: AudioPerformanceMetrics | null;
  performanceAlerts: PerformanceAlert[];

  // Visualization sync
  syncEvents: {
    beatCount: number;
    barCount: number;
    currentPosition: number; // In seconds
    timeSignature: { numerator: number; denominator: number };
  };
}

export interface PlaybackControlsActions {
  // Engine lifecycle
  setInitialized: (initialized: boolean) => void;
  setPlaybackState: (state: PlaybackState) => void;
  setAudioContextState: (state: AudioContextState) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;

  // Configuration
  updateConfig: (partial: Partial<CoreAudioEngineConfig>) => void;
  updateMobileConfig: (partial: Partial<MobileAudioConfig>) => void;
  setMasterVolume: (volume: number) => void;
  setTempo: (bpm: number) => void;
  setPitch: (semitones: number) => void;
  setSwingFactor: (factor: number) => void;

  // Audio source management
  addAudioSource: (config: AudioSourceConfig) => void;
  removeAudioSource: (sourceId: string) => void;
  updateAudioSource: (
    sourceId: string,
    partial: Partial<AudioSourceConfig>,
  ) => void;
  setSourceVolume: (sourceId: string, volume: number) => void;
  setSourceMute: (sourceId: string, muted: boolean) => void;
  setSourceSolo: (sourceId: string, solo: boolean) => void;

  // Performance monitoring
  updatePerformanceMetrics: (metrics: AudioPerformanceMetrics) => void;
  addPerformanceAlert: (alert: PerformanceAlert) => void;
  clearPerformanceAlerts: () => void;

  // Visualization synchronization
  updateSyncPosition: (position: number) => void;
  updateBeatCount: (beats: number) => void;
  updateBarCount: (bars: number) => void;
  setTimeSignature: (numerator: number, denominator: number) => void;

  // Reset
  reset: () => void;
}

export type PlaybackStore = PlaybackControlsState & PlaybackControlsActions;

const initialState: PlaybackControlsState = {
  // Engine state
  playbackState: 'stopped',
  audioContextState: 'suspended',
  isInitialized: false,
  isLoading: false,
  error: null,

  // Configuration
  config: {
    masterVolume: 0.8,
    tempo: 120,
    pitch: 0,
    swingFactor: 0,
  },
  mobileConfig: {
    optimizeForBattery: true,
    reducedLatencyMode: false,
    autoSuspendOnBackground: true,
    gestureActivationRequired: true,
    // Enhanced mobile optimization features
    adaptiveQualityScaling: true,
    thermalManagement: true,
    batteryAwareProcessing: true,
    backgroundAudioOptimization: true,
  },

  // Audio sources
  audioSources: new Map(),

  // Performance monitoring
  performanceMetrics: null,
  performanceAlerts: [],

  // Visualization sync
  syncEvents: {
    beatCount: 0,
    barCount: 0,
    currentPosition: 0,
    timeSignature: { numerator: 4, denominator: 4 },
  },
};

export const usePlaybackStore = create<PlaybackStore>()(
  subscribeWithSelector((set, _get) => ({
    ...initialState,

    // Engine lifecycle
    setInitialized: (initialized) => set({ isInitialized: initialized }),

    setPlaybackState: (state) => set({ playbackState: state }),

    setAudioContextState: (state) => set({ audioContextState: state }),

    setLoading: (loading) => set({ isLoading: loading }),

    setError: (error) => set({ error }),

    // Configuration
    updateConfig: (partial) =>
      set((state) => ({
        config: { ...state.config, ...partial },
      })),

    updateMobileConfig: (partial) =>
      set((state) => ({
        mobileConfig: { ...state.mobileConfig, ...partial },
      })),

    setMasterVolume: (volume) =>
      set((state) => ({
        config: {
          ...state.config,
          masterVolume: Math.max(0, Math.min(1, volume)),
        },
      })),

    setTempo: (bpm) =>
      set((state) => ({
        config: { ...state.config, tempo: Math.max(60, Math.min(200, bpm)) },
      })),

    setPitch: (semitones) =>
      set((state) => ({
        config: {
          ...state.config,
          pitch: Math.max(-12, Math.min(12, semitones)),
        },
      })),

    setSwingFactor: (factor) =>
      set((state) => ({
        config: {
          ...state.config,
          swingFactor: Math.max(0, Math.min(1, factor)),
        },
      })),

    // Audio source management
    addAudioSource: (config) =>
      set((state) => {
        const newSources = new Map(state.audioSources);
        newSources.set(config.id, config);
        return { audioSources: newSources };
      }),

    removeAudioSource: (sourceId) =>
      set((state) => {
        const newSources = new Map(state.audioSources);
        newSources.delete(sourceId);
        return { audioSources: newSources };
      }),

    updateAudioSource: (sourceId, partial) =>
      set((state) => {
        const newSources = new Map(state.audioSources);
        const existing = newSources.get(sourceId);
        if (existing) {
          newSources.set(sourceId, { ...existing, ...partial });
        }
        return { audioSources: newSources };
      }),

    setSourceVolume: (sourceId, volume) =>
      set((state) => {
        const newSources = new Map(state.audioSources);
        const existing = newSources.get(sourceId);
        if (existing) {
          newSources.set(sourceId, {
            ...existing,
            volume: Math.max(0, Math.min(1, volume)),
          });
        }
        return { audioSources: newSources };
      }),

    setSourceMute: (sourceId, muted) =>
      set((state) => {
        const newSources = new Map(state.audioSources);
        const existing = newSources.get(sourceId);
        if (existing) {
          newSources.set(sourceId, { ...existing, muted });
        }
        return { audioSources: newSources };
      }),

    setSourceSolo: (sourceId, solo) =>
      set((state) => {
        const newSources = new Map(state.audioSources);
        const existing = newSources.get(sourceId);
        if (existing) {
          newSources.set(sourceId, { ...existing, solo });
        }
        return { audioSources: newSources };
      }),

    // Performance monitoring
    updatePerformanceMetrics: (metrics) => set({ performanceMetrics: metrics }),

    addPerformanceAlert: (alert) =>
      set((state) => ({
        performanceAlerts: [...state.performanceAlerts, alert].slice(-10), // Keep last 10 alerts
      })),

    clearPerformanceAlerts: () => set({ performanceAlerts: [] }),

    // Visualization synchronization
    updateSyncPosition: (position) =>
      set((state) => ({
        syncEvents: { ...state.syncEvents, currentPosition: position },
      })),

    updateBeatCount: (beats) =>
      set((state) => ({
        syncEvents: { ...state.syncEvents, beatCount: beats },
      })),

    updateBarCount: (bars) =>
      set((state) => ({
        syncEvents: { ...state.syncEvents, barCount: bars },
      })),

    setTimeSignature: (numerator, denominator) =>
      set((state) => ({
        syncEvents: {
          ...state.syncEvents,
          timeSignature: { numerator, denominator },
        },
      })),

    // Reset
    reset: () => set(initialState),
  })),
);

// Selectors for common use cases
export const playbackSelectors = {
  isPlaying: (state: PlaybackStore) => state.playbackState === 'playing',
  canPlay: (state: PlaybackStore) =>
    state.isInitialized &&
    !state.isLoading &&
    state.audioContextState === 'running' &&
    state.playbackState !== 'loading',
  hasError: (state: PlaybackStore) => state.error !== null,
  criticalAlerts: (state: PlaybackStore) =>
    state.performanceAlerts.filter((alert) => alert.severity === 'critical'),
  soloSources: (state: PlaybackStore) =>
    Array.from(state.audioSources.values()).filter((source) => source.solo),
  mutedSources: (state: PlaybackStore) =>
    Array.from(state.audioSources.values()).filter((source) => source.muted),
};
