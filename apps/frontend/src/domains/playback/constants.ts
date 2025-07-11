/**
 * Playback Domain Constants
 *
 * Centralized configuration defaults, enums, and constants
 * for the playback domain.
 *
 * Part of Story 2.1: Task 1, Subtask 1.5
 */

import type {
  CoreAudioEngineConfig,
  MobileAudioConfig,
} from './types/audio.js';
import { PluginCategory, PluginPriority } from './types/plugin.js';

// ============================================================================
// AUDIO ENGINE DEFAULTS
// ============================================================================

export const DEFAULT_AUDIO_CONFIG: CoreAudioEngineConfig = {
  masterVolume: 0.8,
  tempo: 120,
  pitch: 0,
  swingFactor: 0,
} as const;

export const DEFAULT_MOBILE_CONFIG: MobileAudioConfig = {
  optimizeForBattery: true,
  reducedLatencyMode: false,
  autoSuspendOnBackground: true,
  gestureActivationRequired: true,
  adaptiveQualityScaling: true,
  thermalManagement: true,
  batteryAwareProcessing: true,
  backgroundAudioOptimization: true,
} as const;

export const DEFAULT_BUFFER_SIZES = [128, 256, 512, 1024] as const;

export const DEFAULT_SAMPLE_RATES = [44100, 48000] as const;

// ============================================================================
// PERFORMANCE THRESHOLDS
// ============================================================================

export const PERFORMANCE_THRESHOLDS = {
  latency: {
    excellent: 50, // < 50ms is excellent
    good: 100, // 50-100ms is good
    acceptable: 200, // 100-200ms is acceptable
    poor: 500, // > 200ms is poor performance
  },
  cpu: {
    low: 0.3, // < 30% CPU usage
    medium: 0.6, // 30-60% CPU usage
    high: 0.8, // 60-80% CPU usage
    critical: 0.9, // > 80% CPU usage
  },
  memory: {
    low: 50, // < 50MB memory usage
    medium: 100, // 50-100MB memory usage
    high: 200, // 100-200MB memory usage
    critical: 500, // > 200MB memory usage
  },
  dropouts: {
    none: 0, // No dropouts
    few: 3, // 1-3 dropouts per minute
    many: 10, // 3-10 dropouts per minute
    excessive: Infinity, // > 10 dropouts per minute
  },
} as const;

export const LATENCY_TARGETS = {
  interactive: 50, // For real-time interaction
  balanced: 100, // Balance of quality and latency
  quality: 200, // Prioritize quality over latency
  mobile: 150, // Mobile-optimized target
} as const;

// ============================================================================
// PLUGIN SYSTEM CONSTANTS
// ============================================================================

export const PLUGIN_CATEGORIES: Record<string, PluginCategory> = {
  INSTRUMENT: PluginCategory.INSTRUMENT,
  EFFECT: PluginCategory.EFFECT,
  ANALYZER: PluginCategory.ANALYZER,
  UTILITY: PluginCategory.UTILITY,
  GENERATOR: PluginCategory.GENERATOR,
  PROCESSOR: PluginCategory.PROCESSOR,
} as const;

export const PLUGIN_PRIORITIES: Record<string, PluginPriority> = {
  CRITICAL: PluginPriority.CRITICAL, // 1000 - Highest priority for real-time processing
  HIGH: PluginPriority.HIGH, // 750 - High priority
  NORMAL: PluginPriority.NORMAL, // 500 - Normal priority
  LOW: PluginPriority.LOW, // 250 - Low priority
  BACKGROUND: PluginPriority.BACKGROUND, // 100 - Background processing
} as const;

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // Audio Context Errors
  CONTEXT_CREATION_FAILED: 'CONTEXT_CREATION_FAILED',
  CONTEXT_SUSPENDED: 'CONTEXT_SUSPENDED',
  CONTEXT_INTERRUPTED: 'CONTEXT_INTERRUPTED',

  // Performance Errors
  HIGH_LATENCY: 'HIGH_LATENCY',
  HIGH_CPU_USAGE: 'HIGH_CPU_USAGE',
  MEMORY_LEAK: 'MEMORY_LEAK',
  AUDIO_DROPOUTS: 'AUDIO_DROPOUTS',

  // Resource Errors
  MEMORY_LIMIT_EXCEEDED: 'MEMORY_LIMIT_EXCEEDED',
  BUFFER_OVERFLOW: 'BUFFER_OVERFLOW',
  RESOURCE_UNAVAILABLE: 'RESOURCE_UNAVAILABLE',

  // Network Errors
  ASSET_LOAD_FAILED: 'ASSET_LOAD_FAILED',
  CDN_TIMEOUT: 'CDN_TIMEOUT',
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',

  // Mobile Errors
  BACKGROUND_AUDIO_RESTRICTED: 'BACKGROUND_AUDIO_RESTRICTED',
  GESTURE_REQUIRED: 'GESTURE_REQUIRED',
  BATTERY_LOW: 'BATTERY_LOW',

  // Validation Errors
  INVALID_CONFIG: 'INVALID_CONFIG',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  TYPE_MISMATCH: 'TYPE_MISMATCH',
} as const;

// ============================================================================
// AUDIO FORMAT CONSTANTS
// ============================================================================

export const SUPPORTED_AUDIO_FORMATS = [
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/mp4',
] as const;

export const MIME_TYPE_MAPPINGS = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  webm: 'audio/webm',
  m4a: 'audio/mp4',
} as const;

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

export const TIMING_CONSTANTS = {
  // Performance monitoring intervals (in ms)
  METRICS_UPDATE_INTERVAL: 100,
  PERFORMANCE_CHECK_INTERVAL: 1000,
  MEMORY_CHECK_INTERVAL: 5000,

  // Audio processing timeouts (in ms)
  CONTEXT_RESUME_TIMEOUT: 3000,
  BUFFER_FILL_TIMEOUT: 1000,
  PLUGIN_PROCESSING_TIMEOUT: 100,

  // Recovery timeouts (in ms)
  ERROR_RECOVERY_DELAY: 1000,
  RETRY_INTERVAL: 2000,
  MAX_RETRY_DELAY: 30000,
} as const;

// ============================================================================
// DEVICE-SPECIFIC CONSTANTS
// ============================================================================

export const DEVICE_LIMITS = {
  mobile: {
    maxPolyphony: 8,
    maxBufferSize: 1024,
    minSampleRate: 22050,
    maxMemoryUsage: 50, // MB
  },
  desktop: {
    maxPolyphony: 32,
    maxBufferSize: 4096,
    minSampleRate: 44100,
    maxMemoryUsage: 200, // MB
  },
  lowEnd: {
    maxPolyphony: 4,
    maxBufferSize: 512,
    minSampleRate: 22050,
    maxMemoryUsage: 25, // MB
  },
} as const;

// ============================================================================
// FEATURE FLAGS
// ============================================================================

export const FEATURE_FLAGS = {
  ENABLE_WORKLETS: true,
  ENABLE_PERFORMANCE_MONITORING: true,
  ENABLE_ERROR_REPORTING: true,
  ENABLE_PLUGIN_SYSTEM: true,
  ENABLE_MOBILE_OPTIMIZATIONS: true,
  ENABLE_LAZY_LOADING: true,
  ENABLE_DEBUG_MODE: process.env.NODE_ENV === 'development',
} as const;

// ============================================================================
// VERSION COMPATIBILITY
// ============================================================================

export const MIN_BROWSER_VERSIONS = {
  chrome: 66, // AudioWorklet support
  firefox: 76, // AudioWorklet support
  safari: 14.1, // AudioWorklet support
  edge: 79, // Chromium-based Edge
} as const;

export const WEB_AUDIO_FEATURES = {
  BASIC_WEB_AUDIO: 'webAudio',
  AUDIO_WORKLET: 'audioWorklet',
  OFFLINE_CONTEXT: 'offlineContext',
  MEDIA_STREAMS: 'mediaStreams',
  SPATIAL_AUDIO: 'spatialAudio',
} as const;
