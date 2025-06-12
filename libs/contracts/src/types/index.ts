// Re-export all types from their respective modules
export type { MetronomeSettings, TokenInfo, TokenStatus } from './common.js';
export type {
  User,
  AuthUser,
  UserProfile,
  UserPreferences,
  AuthCredentials,
} from './user.js';
export type { Content, Exercise, ExerciseMetadata } from './content.js';
export type {
  Widget,
  WidgetConfiguration,
  YouTubeExercise,
} from './widgets.js';

// Enhanced playback types for comprehensive widget integration
export type {
  // Core playback types
  PlaybackState,
  AudioTrack,
  AudioContextConfig,
  PerformanceMetrics,

  // Epic 2 integration types
  N8nPayloadConfig,
  AssetReference,
  AssetManifest,
  AssetLoadingProgress,

  // Widget configuration types
  WidgetAudioConfig,
  MobileAudioConfig,
  WidgetPlaybackPreferences,
  WidgetPlaybackState,

  // Widget communication types
  WidgetPlaybackEvent,
  WidgetSyncConfig,

  // Error handling types
  PlaybackError,

  // Form and validation types
  WidgetConfigForm,

  // API types
  PlaybackControlRequest,
  PlaybackStateResponse,
  AudioTrackRequest,
  WidgetStateUpdate,

  // Real-time event types
  PlaybackEvent,
  WidgetEvent,
  SystemEvent,
} from './playback.js';

export type { LearningProgress } from './learning.js';
export type { AnalysisResult, AudioAnalysis, AudioNote } from './analysis.js';
