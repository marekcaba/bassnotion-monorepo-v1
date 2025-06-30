/**
 * Playback State Management Store (Zustand)
 *
 * Enhanced with Epic 2 Asset Loading State Management
 * Manages playback controls state, audio configuration, and comprehensive
 * asset loading state for widget consumption and synchronization.
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 * Enhanced for Task 13: Resource & Asset Management (Subtask 13.5)
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
  // Epic 2 Asset Loading Types
  N8nPayloadConfig,
  AssetLoadingState,
  AssetManifest,
  ProcessedAssetManifest,
} from '../types/audio.js';

// ============================================================================
// EPIC 2 ASSET LOADING INTERFACES
// ============================================================================

/**
 * Comprehensive asset loading progress for Epic 2 integration
 */
export interface AssetLoadingProgress {
  // N8n Payload Processing
  n8nPayload: N8nPayloadConfig | null;
  payloadProcessingStage:
    | 'idle'
    | 'extracting'
    | 'validating'
    | 'processing'
    | 'complete'
    | 'error';
  payloadValidationErrors: string[];

  // Asset Manifest Processing
  assetManifest: AssetManifest | null;
  processedManifest: ProcessedAssetManifest | null;
  manifestProcessingStage:
    | 'idle'
    | 'analyzing'
    | 'optimizing'
    | 'validating'
    | 'complete'
    | 'error';
  manifestValidationErrors: string[];

  // Asset Loading State
  assetLoadingState: AssetLoadingState;
  loadingStage:
    | 'idle'
    | 'preparing'
    | 'loading'
    | 'processing'
    | 'complete'
    | 'error';
  loadingErrors: AssetLoadingError[];

  // Individual Asset Progress
  assetProgress: Map<string, AssetLoadingItemProgress>;
  failedAssets: Map<string, AssetLoadingError>;
  retryingAssets: Set<string>;

  // Loading Performance Metrics
  loadingMetrics: AssetLoadingMetrics;

  // Critical Path Analysis
  criticalAssets: string[];
  minimumViableAssetsLoaded: boolean;
  canStartPlayback: boolean;

  // User Experience
  loadingMessage: string;
  progressPercentage: number;
  estimatedTimeRemaining: number; // in seconds

  // Background Processing
  backgroundLoadingActive: boolean;
  backgroundLoadingQueue: string[]; // Asset IDs
}

/**
 * Individual asset loading progress tracking
 */
export interface AssetLoadingItemProgress {
  assetId: string;
  assetType: 'midi' | 'audio';
  assetCategory: string;
  stage:
    | 'queued'
    | 'downloading'
    | 'processing'
    | 'complete'
    | 'error'
    | 'retrying';
  bytesLoaded: number;
  bytesTotal: number;
  progressPercentage: number;
  loadStartTime: number;
  loadEndTime?: number;
  source: 'cdn' | 'supabase' | 'cache';
  compressionApplied: boolean;
  qualityLevel?: 'low' | 'medium' | 'high' | 'ultra';
  retryCount: number;
  lastError?: string;
}

/**
 * Asset loading error with recovery information
 */
export interface AssetLoadingError {
  assetId: string;
  errorType:
    | 'network'
    | 'parsing'
    | 'format'
    | 'timeout'
    | 'storage'
    | 'validation';
  errorMessage: string;
  errorCode?: string;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  canRetry: boolean;
  fallbackAvailable: boolean;
  criticalAsset: boolean;
}

/**
 * Loading performance metrics for optimization
 */
export interface AssetLoadingMetrics {
  totalLoadTime: number;
  averageAssetLoadTime: number;
  cdnHitRate: number;
  cacheHitRate: number;
  compressionSavings: number; // bytes saved
  networkBandwidthUsed: number; // bytes
  backgroundLoadingEfficiency: number; // percentage
  parallelLoadingEfficiency: number; // percentage
  errorRate: number;
  retrySuccessRate: number;
  timeToMinimumViableAssets: number; // critical path time
  timeToFullLoad: number;
}

// ============================================================================
// ENHANCED STORE INTERFACES
// ============================================================================

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

  // ============================================================================
  // EPIC 2 ASSET LOADING STATE - NEW for Task 13.5
  // ============================================================================
  assetLoadingProgress: AssetLoadingProgress;
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

  // ============================================================================
  // EPIC 2 ASSET LOADING ACTIONS - NEW for Task 13.5
  // ============================================================================

  // N8n Payload Processing
  setN8nPayload: (payload: N8nPayloadConfig | null) => void;
  setPayloadProcessingStage: (
    stage: AssetLoadingProgress['payloadProcessingStage'],
  ) => void;
  addPayloadValidationError: (error: string) => void;
  clearPayloadValidationErrors: () => void;

  // Asset Manifest Processing
  setAssetManifest: (manifest: AssetManifest | null) => void;
  setProcessedManifest: (manifest: ProcessedAssetManifest | null) => void;
  setManifestProcessingStage: (
    stage: AssetLoadingProgress['manifestProcessingStage'],
  ) => void;
  addManifestValidationError: (error: string) => void;
  clearManifestValidationErrors: () => void;

  // Asset Loading State Management
  setAssetLoadingState: (state: AssetLoadingState) => void;
  setLoadingStage: (stage: AssetLoadingProgress['loadingStage']) => void;
  addLoadingError: (error: AssetLoadingError) => void;
  clearLoadingErrors: () => void;

  // Individual Asset Progress
  updateAssetProgress: (
    assetId: string,
    progress: Partial<AssetLoadingItemProgress>,
  ) => void;
  setAssetError: (assetId: string, error: AssetLoadingError) => void;
  clearAssetError: (assetId: string) => void;
  addRetryingAsset: (assetId: string) => void;
  removeRetryingAsset: (assetId: string) => void;

  // Loading Metrics
  updateLoadingMetrics: (metrics: Partial<AssetLoadingMetrics>) => void;
  resetLoadingMetrics: () => void;

  // Critical Path Management
  setCriticalAssets: (assetIds: string[]) => void;
  setMinimumViableAssetsLoaded: (loaded: boolean) => void;
  setCanStartPlayback: (canStart: boolean) => void;

  // User Experience
  setLoadingMessage: (message: string) => void;
  setProgressPercentage: (percentage: number) => void;
  setEstimatedTimeRemaining: (seconds: number) => void;

  // Background Loading
  setBackgroundLoadingActive: (active: boolean) => void;
  setBackgroundLoadingQueue: (queue: string[]) => void;
  addToBackgroundQueue: (assetId: string) => void;
  removeFromBackgroundQueue: (assetId: string) => void;

  // Comprehensive Reset for Asset Loading
  resetAssetLoadingState: () => void;
}

export type PlaybackStore = PlaybackControlsState & PlaybackControlsActions;

// ============================================================================
// INITIAL STATE WITH EPIC 2 ASSET LOADING
// ============================================================================

const initialAssetLoadingProgress: AssetLoadingProgress = {
  // N8n Payload Processing
  n8nPayload: null,
  payloadProcessingStage: 'idle',
  payloadValidationErrors: [],

  // Asset Manifest Processing
  assetManifest: null,
  processedManifest: null,
  manifestProcessingStage: 'idle',
  manifestValidationErrors: [],

  // Asset Loading State
  assetLoadingState: {
    midiFiles: new Map(),
    audioSamples: new Map(),
    totalAssets: 0,
    loadedAssets: 0,
  },
  loadingStage: 'idle',
  loadingErrors: [],

  // Individual Asset Progress
  assetProgress: new Map(),
  failedAssets: new Map(),
  retryingAssets: new Set(),

  // Loading Performance Metrics
  loadingMetrics: {
    totalLoadTime: 0,
    averageAssetLoadTime: 0,
    cdnHitRate: 0,
    cacheHitRate: 0,
    compressionSavings: 0,
    networkBandwidthUsed: 0,
    backgroundLoadingEfficiency: 0,
    parallelLoadingEfficiency: 0,
    errorRate: 0,
    retrySuccessRate: 0,
    timeToMinimumViableAssets: 0,
    timeToFullLoad: 0,
  },

  // Critical Path Analysis
  criticalAssets: [],
  minimumViableAssetsLoaded: false,
  canStartPlayback: false,

  // User Experience
  loadingMessage: '',
  progressPercentage: 0,
  estimatedTimeRemaining: 0,

  // Background Processing
  backgroundLoadingActive: false,
  backgroundLoadingQueue: [],
};

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

  // Epic 2 Asset Loading State
  assetLoadingProgress: initialAssetLoadingProgress,
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

    // ============================================================================
    // EPIC 2 ASSET LOADING ACTIONS IMPLEMENTATION
    // ============================================================================

    // N8n Payload Processing
    setN8nPayload: (payload) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          n8nPayload: payload,
        },
      })),

    setPayloadProcessingStage: (stage) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          payloadProcessingStage: stage,
        },
      })),

    addPayloadValidationError: (error) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          payloadValidationErrors: [
            ...state.assetLoadingProgress.payloadValidationErrors,
            error,
          ],
        },
      })),

    clearPayloadValidationErrors: () =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          payloadValidationErrors: [],
        },
      })),

    // Asset Manifest Processing
    setAssetManifest: (manifest) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          assetManifest: manifest,
        },
      })),

    setProcessedManifest: (manifest) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          processedManifest: manifest,
        },
      })),

    setManifestProcessingStage: (stage) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          manifestProcessingStage: stage,
        },
      })),

    addManifestValidationError: (error) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          manifestValidationErrors: [
            ...state.assetLoadingProgress.manifestValidationErrors,
            error,
          ],
        },
      })),

    clearManifestValidationErrors: () =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          manifestValidationErrors: [],
        },
      })),

    // Asset Loading State Management
    setAssetLoadingState: (assetLoadingState) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          assetLoadingState,
        },
      })),

    setLoadingStage: (stage) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          loadingStage: stage,
        },
      })),

    addLoadingError: (error) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          loadingErrors: [...state.assetLoadingProgress.loadingErrors, error],
        },
      })),

    clearLoadingErrors: () =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          loadingErrors: [],
        },
      })),

    // Individual Asset Progress
    updateAssetProgress: (assetId, progress) =>
      set((state) => {
        const newProgress = new Map(state.assetLoadingProgress.assetProgress);
        const existing = newProgress.get(assetId) || {
          assetId,
          assetType: 'audio',
          assetCategory: 'unknown',
          stage: 'queued',
          bytesLoaded: 0,
          bytesTotal: 0,
          progressPercentage: 0,
          loadStartTime: Date.now(),
          source: 'cdn',
          compressionApplied: false,
          retryCount: 0,
        };
        newProgress.set(assetId, { ...existing, ...progress });

        return {
          assetLoadingProgress: {
            ...state.assetLoadingProgress,
            assetProgress: newProgress,
          },
        };
      }),

    setAssetError: (assetId, error) =>
      set((state) => {
        const newFailedAssets = new Map(
          state.assetLoadingProgress.failedAssets,
        );
        newFailedAssets.set(assetId, error);

        return {
          assetLoadingProgress: {
            ...state.assetLoadingProgress,
            failedAssets: newFailedAssets,
          },
        };
      }),

    clearAssetError: (assetId) =>
      set((state) => {
        const newFailedAssets = new Map(
          state.assetLoadingProgress.failedAssets,
        );
        newFailedAssets.delete(assetId);

        return {
          assetLoadingProgress: {
            ...state.assetLoadingProgress,
            failedAssets: newFailedAssets,
          },
        };
      }),

    addRetryingAsset: (assetId) =>
      set((state) => {
        const newRetryingAssets = new Set(
          state.assetLoadingProgress.retryingAssets,
        );
        newRetryingAssets.add(assetId);

        return {
          assetLoadingProgress: {
            ...state.assetLoadingProgress,
            retryingAssets: newRetryingAssets,
          },
        };
      }),

    removeRetryingAsset: (assetId) =>
      set((state) => {
        const newRetryingAssets = new Set(
          state.assetLoadingProgress.retryingAssets,
        );
        newRetryingAssets.delete(assetId);

        return {
          assetLoadingProgress: {
            ...state.assetLoadingProgress,
            retryingAssets: newRetryingAssets,
          },
        };
      }),

    // Loading Metrics
    updateLoadingMetrics: (metrics) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          loadingMetrics: {
            ...state.assetLoadingProgress.loadingMetrics,
            ...metrics,
          },
        },
      })),

    resetLoadingMetrics: () =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          loadingMetrics: initialAssetLoadingProgress.loadingMetrics,
        },
      })),

    // Critical Path Management
    setCriticalAssets: (assetIds) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          criticalAssets: assetIds,
        },
      })),

    setMinimumViableAssetsLoaded: (loaded) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          minimumViableAssetsLoaded: loaded,
        },
      })),

    setCanStartPlayback: (canStart) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          canStartPlayback: canStart,
        },
      })),

    // User Experience
    setLoadingMessage: (message) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          loadingMessage: message,
        },
      })),

    setProgressPercentage: (percentage) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          progressPercentage: Math.max(0, Math.min(100, percentage)),
        },
      })),

    setEstimatedTimeRemaining: (seconds) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          estimatedTimeRemaining: Math.max(0, seconds),
        },
      })),

    // Background Loading
    setBackgroundLoadingActive: (active) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          backgroundLoadingActive: active,
        },
      })),

    setBackgroundLoadingQueue: (queue) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          backgroundLoadingQueue: queue,
        },
      })),

    addToBackgroundQueue: (assetId) =>
      set((state) => {
        const currentQueue = state.assetLoadingProgress.backgroundLoadingQueue;
        // TODO: Review non-null assertion - consider null safety
        if (!currentQueue.includes(assetId)) {
          return {
            assetLoadingProgress: {
              ...state.assetLoadingProgress,
              backgroundLoadingQueue: [...currentQueue, assetId],
            },
          };
        }
        return state;
      }),

    removeFromBackgroundQueue: (assetId) =>
      set((state) => ({
        assetLoadingProgress: {
          ...state.assetLoadingProgress,
          backgroundLoadingQueue:
            state.assetLoadingProgress.backgroundLoadingQueue.filter(
              (id) => id !== assetId,
            ),
        },
      })),

    // Comprehensive Reset for Asset Loading
    resetAssetLoadingState: () =>
      set((_state) => ({
        assetLoadingProgress: initialAssetLoadingProgress,
      })),
  })),
);

// ============================================================================
// ENHANCED SELECTORS WITH EPIC 2 ASSET LOADING
// ============================================================================

export const playbackSelectors = {
  // Existing selectors
  isPlaying: (state: PlaybackStore) => state.playbackState === 'playing',
  canPlay: (state: PlaybackStore) =>
    state.isInitialized &&
    // TODO: Review non-null assertion - consider null safety
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

  // ============================================================================
  // EPIC 2 ASSET LOADING SELECTORS - NEW for Task 13.5
  // ============================================================================

  // N8n Payload Selectors
  hasN8nPayload: (state: PlaybackStore) =>
    state.assetLoadingProgress.n8nPayload !== null,
  isPayloadProcessing: (state: PlaybackStore) =>
    state.assetLoadingProgress.payloadProcessingStage !== 'idle' &&
    state.assetLoadingProgress.payloadProcessingStage !== 'complete' &&
    state.assetLoadingProgress.payloadProcessingStage !== 'error',
  hasPayloadErrors: (state: PlaybackStore) =>
    state.assetLoadingProgress.payloadValidationErrors.length > 0,

  // Asset Manifest Selectors
  hasProcessedManifest: (state: PlaybackStore) =>
    state.assetLoadingProgress.processedManifest !== null,
  isManifestProcessing: (state: PlaybackStore) =>
    state.assetLoadingProgress.manifestProcessingStage !== 'idle' &&
    state.assetLoadingProgress.manifestProcessingStage !== 'complete' &&
    state.assetLoadingProgress.manifestProcessingStage !== 'error',
  hasManifestErrors: (state: PlaybackStore) =>
    state.assetLoadingProgress.manifestValidationErrors.length > 0,

  // Asset Loading Selectors
  isAssetsLoading: (state: PlaybackStore) =>
    state.assetLoadingProgress.loadingStage !== 'idle' &&
    state.assetLoadingProgress.loadingStage !== 'complete' &&
    state.assetLoadingProgress.loadingStage !== 'error',
  hasLoadingErrors: (state: PlaybackStore) =>
    state.assetLoadingProgress.loadingErrors.length > 0,
  loadingProgress: (state: PlaybackStore) =>
    state.assetLoadingProgress.progressPercentage,

  // Critical Asset Selectors
  criticalAssetsLoaded: (state: PlaybackStore) => {
    const { criticalAssets, assetProgress } = state.assetLoadingProgress;
    return criticalAssets.every((assetId) => {
      const progress = assetProgress.get(assetId);
      return progress?.stage === 'complete';
    });
  },

  canStartPlayback: (state: PlaybackStore) =>
    state.assetLoadingProgress.canStartPlayback,
  minimumViableAssetsLoaded: (state: PlaybackStore) =>
    state.assetLoadingProgress.minimumViableAssetsLoaded,

  // Asset Progress Selectors
  totalAssetProgress: (state: PlaybackStore) => {
    const { assetProgress } = state.assetLoadingProgress;
    if (assetProgress.size === 0) return 0;

    const totalProgress = Array.from(assetProgress.values()).reduce(
      (sum, progress) => sum + progress.progressPercentage,
      0,
    );
    return totalProgress / assetProgress.size;
  },

  completedAssets: (state: PlaybackStore) =>
    Array.from(state.assetLoadingProgress.assetProgress.values()).filter(
      (progress) => progress.stage === 'complete',
    ),

  failedAssets: (state: PlaybackStore) =>
    Array.from(state.assetLoadingProgress.failedAssets.values()),

  retryingAssets: (state: PlaybackStore) =>
    Array.from(state.assetLoadingProgress.retryingAssets),

  // Background Loading Selectors
  isBackgroundLoading: (state: PlaybackStore) =>
    state.assetLoadingProgress.backgroundLoadingActive,
  backgroundQueueSize: (state: PlaybackStore) =>
    state.assetLoadingProgress.backgroundLoadingQueue.length,

  // Performance Metrics Selectors
  loadingMetrics: (state: PlaybackStore) =>
    state.assetLoadingProgress.loadingMetrics,
  cdnEfficiency: (state: PlaybackStore) =>
    state.assetLoadingProgress.loadingMetrics.cdnHitRate,
  cacheEfficiency: (state: PlaybackStore) =>
    state.assetLoadingProgress.loadingMetrics.cacheHitRate,

  // User Experience Selectors
  loadingMessage: (state: PlaybackStore) =>
    state.assetLoadingProgress.loadingMessage,
  estimatedTimeRemaining: (state: PlaybackStore) =>
    state.assetLoadingProgress.estimatedTimeRemaining,

  // Epic 2 Integration Status
  epic2Ready: (state: PlaybackStore) =>
    state.assetLoadingProgress.payloadProcessingStage === 'complete' &&
    state.assetLoadingProgress.manifestProcessingStage === 'complete' &&
    state.assetLoadingProgress.minimumViableAssetsLoaded &&
    state.isInitialized &&
    state.audioContextState === 'running',
};
