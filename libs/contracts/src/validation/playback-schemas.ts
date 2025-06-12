/**
 * Playback Domain Validation Schemas
 *
 * Provides shared validation logic for playback functionality between
 * frontend widgets and backend services. Ensures type safety and
 * consistent validation across the platform.
 *
 * Part of Story 2.1, Task 15: Enhanced Export Structure & Integration
 */

import { z } from 'zod';

// ============================================================================
// CORE PLAYBACK VALIDATION SCHEMAS
// ============================================================================

/**
 * Metronome settings validation
 */
export const MetronomeSettingsSchema = z.object({
  bpm: z.number().min(40).max(220),
  timeSignature: z.object({
    numerator: z.number().min(1).max(32),
    denominator: z.number().min(1).max(32),
  }),
  accentPattern: z.array(z.boolean()).optional(),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  clickSound: z.enum(['beep', 'click', 'woodblock', 'cowbell']).optional(),
});

/**
 * Basic playback state validation
 */
export const PlaybackStateSchema = z.object({
  isPlaying: z.boolean(),
  currentTime: z.number().min(0),
  duration: z.number().min(0),
  tempo: z.number().min(40).max(220),
  pitch: z.number().min(-12).max(12), // Semitones
  volume: z.number().min(0).max(1),
  metronomeSettings: MetronomeSettingsSchema,
});

/**
 * Audio track validation for widgets
 */
export const AudioTrackSchema = z.object({
  id: z.string().min(1),
  url: z.string().url(),
  type: z.enum(['reference', 'drummer', 'metronome', 'bassline', 'backing']),
  volume: z.number().min(0).max(1),
  muted: z.boolean(),
  solo: z.boolean().optional(),
  pan: z.number().min(-1).max(1).optional(),
});

/**
 * Audio context configuration validation
 */
export const AudioContextConfigSchema = z.object({
  sampleRate: z.number().positive().optional(),
  latencyHint: z.enum(['interactive', 'balanced', 'playback']).optional(),
  bufferSize: z.number().positive().optional(),
});

/**
 * Performance metrics validation
 */
export const PerformanceMetricsSchema = z.object({
  latency: z.number().min(0),
  cpuUsage: z.number().min(0).max(100),
  memoryUsage: z.number().min(0),
  audioDropouts: z.number().min(0),
  batteryImpact: z.number().min(0).max(100),
  networkLatency: z.number().min(0).optional(),
  cacheHitRate: z.number().min(0).max(1).optional(),
});

// ============================================================================
// EPIC 2 VALIDATION SCHEMAS
// ============================================================================

/**
 * N8n payload configuration validation
 */
export const N8nPayloadConfigSchema = z.object({
  tutorialSpecificMidi: z.object({
    basslineUrl: z.string().url(),
    chordsUrl: z.string().url(),
  }),
  libraryMidi: z.object({
    drumPatternId: z.string().min(1),
    metronomeStyleId: z.string().min(1),
  }),
  audioSamples: z.object({
    bassNotes: z.array(z.string().url()),
    drumHits: z.array(z.string().url()),
    ambienceTrack: z.string().url().optional(),
  }),
  synchronization: z.object({
    bpm: z.number().min(40).max(220),
    timeSignature: z.string().regex(/^\d+\/\d+$/), // e.g., "4/4", "3/4"
    keySignature: z.string().min(1), // e.g., "C", "Am", "F#"
  }),
});

/**
 * Asset reference validation
 */
export const AssetReferenceSchema = z.object({
  type: z.enum(['midi', 'audio']),
  category: z.enum([
    'bassline',
    'chords',
    'drums',
    'bass-sample',
    'drum-sample',
    'ambience',
  ]),
  url: z.string().url(),
  priority: z.enum(['high', 'medium', 'low']),
  noteIndex: z.number().optional(),
  drumPiece: z.string().optional(),
});

/**
 * Asset manifest validation
 */
export const AssetManifestSchema = z.object({
  assets: z.array(AssetReferenceSchema),
  totalCount: z.number().min(0),
  estimatedLoadTime: z.number().min(0),
});

/**
 * Asset loading progress validation
 */
export const AssetLoadingProgressSchema = z.object({
  assetId: z.string().min(1),
  assetType: z.enum(['midi', 'audio']),
  assetCategory: z.string(),
  stage: z.enum([
    'queued',
    'downloading',
    'processing',
    'complete',
    'error',
    'retrying',
  ]),
  bytesLoaded: z.number().min(0),
  bytesTotal: z.number().min(0),
  progressPercentage: z.number().min(0).max(100),
  loadStartTime: z.number().positive(),
  loadEndTime: z.number().positive().optional(),
  source: z.enum(['cdn', 'supabase', 'cache']),
  compressionApplied: z.boolean(),
  qualityLevel: z.enum(['low', 'medium', 'high', 'ultra']).optional(),
  retryCount: z.number().min(0),
  lastError: z.string().optional(),
});

// ============================================================================
// WIDGET CONFIGURATION SCHEMAS
// ============================================================================

/**
 * Widget audio configuration
 */
export const WidgetAudioConfigSchema = z.object({
  masterVolume: z.number().min(0).max(1),
  tempo: z.number().min(40).max(220),
  pitch: z.number().min(-12).max(12),
  swingFactor: z.number().min(0).max(1),
  metronome: z.object({
    enabled: z.boolean(),
    volume: z.number().min(0).max(1),
    accentBeats: z.array(z.number()).optional(),
  }),
  audioSources: z.array(AudioTrackSchema),
});

/**
 * Mobile audio optimization configuration
 */
export const MobileAudioConfigSchema = z.object({
  batteryOptimizationsEnabled: z.boolean(),
  backgroundAudioEnabled: z.boolean(),
  adaptiveQualityEnabled: z.boolean(),
  lowLatencyMode: z.boolean(),
  bufferSize: z.number().positive().optional(),
  maxPolyphony: z.number().positive().optional(),
});

/**
 * Widget playback preferences
 */
export const WidgetPlaybackPreferencesSchema = z.object({
  autoStartPlayback: z.boolean().optional(),
  loopEnabled: z.boolean().optional(),
  countInBeats: z.number().min(0).max(8).optional(),
  fadeInDuration: z.number().min(0).optional(),
  fadeOutDuration: z.number().min(0).optional(),
  crossfadeEnabled: z.boolean().optional(),
});

// ============================================================================
// WIDGET INTEGRATION SCHEMAS
// ============================================================================

/**
 * Widget state validation for playback integration
 */
export const WidgetPlaybackStateSchema = z.object({
  widgetId: z.string().min(1),
  isActive: z.boolean(),
  playbackState: PlaybackStateSchema,
  audioConfig: WidgetAudioConfigSchema,
  preferences: WidgetPlaybackPreferencesSchema,
  lastSyncTime: z.number().positive(),
});

/**
 * Widget event validation for real-time communication
 */
export const WidgetPlaybackEventSchema = z.object({
  type: z.enum([
    'beat',
    'measure',
    'tempo-change',
    'play',
    'pause',
    'stop',
    'seek',
  ]),
  widgetId: z.string().min(1),
  timestamp: z.number().positive(),
  data: z.record(z.any()).optional(),
});

/**
 * Cross-widget synchronization validation
 */
export const WidgetSyncConfigSchema = z.object({
  enabledWidgets: z.array(z.string()),
  syncTempo: z.boolean(),
  syncPlayback: z.boolean(),
  syncTransport: z.boolean(),
  masterWidgetId: z.string().optional(),
});

// ============================================================================
// ERROR VALIDATION SCHEMAS
// ============================================================================

/**
 * Playback error validation
 */
export const PlaybackErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  category: z.enum([
    'audio',
    'network',
    'performance',
    'validation',
    'resource',
  ]),
  timestamp: z.number().positive(),
  context: z.record(z.any()).optional(),
  recoverable: z.boolean(),
});

// ============================================================================
// FORM VALIDATION HELPERS
// ============================================================================

/**
 * Widget configuration form validation
 */
export const WidgetConfigFormSchema = z.object({
  tempo: z.string().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num >= 40 && num <= 220;
  }, 'Tempo must be between 40 and 220 BPM'),

  volume: z.string().refine((val) => {
    const num = Number(val);
    return !isNaN(num) && num >= 0 && num <= 100;
  }, 'Volume must be between 0 and 100'),

  timeSignature: z
    .string()
    .regex(/^\d+\/\d+$/, 'Time signature must be in format like 4/4'),

  audioQuality: z.enum(['low', 'medium', 'high', 'auto']),

  enableMetronome: z.boolean().optional(),

  backgroundAudio: z.boolean().optional(),
});

// ============================================================================
// TYPE INFERENCE EXPORTS
// ============================================================================
// Export validation input types with Input suffix to avoid conflicts with domain types

export type MetronomeSettingsInput = z.infer<typeof MetronomeSettingsSchema>;
export type PlaybackStateInput = z.infer<typeof PlaybackStateSchema>;
export type AudioTrackInput = z.infer<typeof AudioTrackSchema>;
export type AudioContextConfigInput = z.infer<typeof AudioContextConfigSchema>;
export type PerformanceMetricsInput = z.infer<typeof PerformanceMetricsSchema>;
export type N8nPayloadConfigInput = z.infer<typeof N8nPayloadConfigSchema>;
export type AssetReferenceInput = z.infer<typeof AssetReferenceSchema>;
export type AssetManifestInput = z.infer<typeof AssetManifestSchema>;
export type AssetLoadingProgressInput = z.infer<
  typeof AssetLoadingProgressSchema
>;
export type WidgetAudioConfigInput = z.infer<typeof WidgetAudioConfigSchema>;
export type MobileAudioConfigInput = z.infer<typeof MobileAudioConfigSchema>;
export type WidgetPlaybackPreferencesInput = z.infer<
  typeof WidgetPlaybackPreferencesSchema
>;
export type WidgetPlaybackStateInput = z.infer<
  typeof WidgetPlaybackStateSchema
>;
export type WidgetPlaybackEventInput = z.infer<
  typeof WidgetPlaybackEventSchema
>;
export type WidgetSyncConfigInput = z.infer<typeof WidgetSyncConfigSchema>;
export type PlaybackErrorInput = z.infer<typeof PlaybackErrorSchema>;
export type WidgetConfigFormInput = z.infer<typeof WidgetConfigFormSchema>;
