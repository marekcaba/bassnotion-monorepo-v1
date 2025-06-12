/**
 * Playback Domain Types for BassNotion Platform
 *
 * Enhanced for Task 15: Complete playback types integration
 * Provides comprehensive type definitions for widget consumption
 * while maintaining backward compatibility with existing interfaces.
 */

import { MetronomeSettings } from './common.js';

// ============================================================================
// CORE PLAYBACK TYPES (Enhanced from validation schemas)
// ============================================================================

/**
 * Enhanced playback state interface
 */
export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tempo: number;
  pitch: number;
  volume: number;
  metronomeSettings: MetronomeSettings;
  // Enhanced properties for Epic 2
  swingFactor?: number;
  loopEnabled?: boolean;
  countInBeats?: number;
}

/**
 * Enhanced audio track interface for widgets
 */
export interface AudioTrack {
  id: string;
  url: string;
  type: 'reference' | 'drummer' | 'metronome' | 'bassline' | 'backing';
  volume: number;
  muted: boolean;
  solo?: boolean;
  pan?: number;
}

/**
 * Audio context configuration for widgets
 */
export interface AudioContextConfig {
  sampleRate?: number;
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  bufferSize?: number;
}

/**
 * Performance metrics for monitoring
 */
export interface PerformanceMetrics {
  latency: number;
  cpuUsage: number;
  memoryUsage: number;
  audioDropouts: number;
  batteryImpact: number;
  networkLatency?: number;
  cacheHitRate?: number;
}

// ============================================================================
// EPIC 2 INTEGRATION TYPES
// ============================================================================

/**
 * N8n AI agent payload configuration
 */
export interface N8nPayloadConfig {
  tutorialSpecificMidi: {
    basslineUrl: string;
    chordsUrl: string;
  };
  libraryMidi: {
    drumPatternId: string;
    metronomeStyleId: string;
  };
  audioSamples: {
    bassNotes: string[];
    drumHits: string[];
    ambienceTrack?: string;
  };
  synchronization: {
    bpm: number;
    timeSignature: string;
    keySignature: string;
  };
}

/**
 * Asset reference for Epic 2 asset loading
 */
export interface AssetReference {
  type: 'midi' | 'audio';
  category:
    | 'bassline'
    | 'chords'
    | 'drums'
    | 'bass-sample'
    | 'drum-sample'
    | 'ambience';
  url: string;
  priority: 'high' | 'medium' | 'low';
  noteIndex?: number;
  drumPiece?: string;
}

/**
 * Asset manifest for dependency management
 */
export interface AssetManifest {
  assets: AssetReference[];
  totalCount: number;
  estimatedLoadTime: number;
}

/**
 * Asset loading progress tracking
 */
export interface AssetLoadingProgress {
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

// ============================================================================
// WIDGET CONFIGURATION TYPES
// ============================================================================

/**
 * Widget audio configuration
 */
export interface WidgetAudioConfig {
  masterVolume: number;
  tempo: number;
  pitch: number;
  swingFactor: number;
  metronome: {
    enabled: boolean;
    volume: number;
    accentBeats?: number[];
  };
  audioSources: AudioTrack[];
}

/**
 * Mobile audio optimization configuration
 */
export interface MobileAudioConfig {
  batteryOptimizationsEnabled: boolean;
  backgroundAudioEnabled: boolean;
  adaptiveQualityEnabled: boolean;
  lowLatencyMode: boolean;
  bufferSize?: number;
  maxPolyphony?: number;
}

/**
 * Widget playback preferences
 */
export interface WidgetPlaybackPreferences {
  autoStartPlayback?: boolean;
  loopEnabled?: boolean;
  countInBeats?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
  crossfadeEnabled?: boolean;
}

/**
 * Complete widget playback state
 */
export interface WidgetPlaybackState {
  widgetId: string;
  isActive: boolean;
  playbackState: PlaybackState;
  audioConfig: WidgetAudioConfig;
  preferences: WidgetPlaybackPreferences;
  lastSyncTime: number;
}

// ============================================================================
// WIDGET COMMUNICATION TYPES
// ============================================================================

/**
 * Widget playback events for real-time communication
 */
export interface WidgetPlaybackEvent {
  type:
    | 'beat'
    | 'measure'
    | 'tempo-change'
    | 'play'
    | 'pause'
    | 'stop'
    | 'seek';
  widgetId: string;
  timestamp: number;
  data?: Record<string, any>;
}

/**
 * Cross-widget synchronization configuration
 */
export interface WidgetSyncConfig {
  enabledWidgets: string[];
  syncTempo: boolean;
  syncPlayback: boolean;
  syncTransport: boolean;
  masterWidgetId?: string;
}

// ============================================================================
// ERROR HANDLING TYPES
// ============================================================================

/**
 * Playback error information
 */
export interface PlaybackError {
  code: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'audio' | 'network' | 'performance' | 'validation' | 'resource';
  timestamp: number;
  context?: Record<string, any>;
  recoverable: boolean;
}

// ============================================================================
// FORM AND VALIDATION TYPES
// ============================================================================

/**
 * Widget configuration form data
 */
export interface WidgetConfigForm {
  tempo: string;
  volume: string;
  timeSignature: string;
  audioQuality: 'low' | 'medium' | 'high' | 'auto';
  enableMetronome?: boolean;
  backgroundAudio?: boolean;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Playback control request
 */
export interface PlaybackControlRequest {
  action: 'play' | 'pause' | 'stop' | 'seek';
  tempo?: number;
  pitch?: number;
  position?: number;
  widgetId?: string;
}

/**
 * Playback state response
 */
export interface PlaybackStateResponse {
  success: boolean;
  playbackState: PlaybackState;
  performanceMetrics?: PerformanceMetrics;
  errors?: PlaybackError[];
}

/**
 * Audio track management request
 */
export interface AudioTrackRequest {
  trackId: string;
  action: 'add' | 'remove' | 'update';
  configuration?: Partial<AudioTrack>;
}

/**
 * Widget state synchronization update
 */
export interface WidgetStateUpdate {
  widgetId: string;
  state: Partial<WidgetPlaybackState>;
  timestamp: number;
}

// ============================================================================
// REAL-TIME EVENT TYPES
// ============================================================================

/**
 * Real-time playback events
 */
export interface PlaybackEvent {
  type: 'beat' | 'measure' | 'tempo-change' | 'track-change';
  data: any;
  timestamp: number;
}

/**
 * Widget events for cross-widget communication
 */
export interface WidgetEvent {
  widgetId: string;
  type: 'state-change' | 'config-update' | 'sync-request';
  data: any;
  timestamp: number;
}

/**
 * System events for monitoring and debugging
 */
export interface SystemEvent {
  type: 'error' | 'warning' | 'info' | 'performance-alert';
  message: string;
  source?: string;
  timestamp: number;
}
