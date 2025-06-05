/**
 * Audio-specific TypeScript interfaces for the Playback Domain
 *
 * Part of Story 2.1: Core Audio Engine Foundation
 */

export type AudioContextState =
  | 'suspended'
  | 'running'
  | 'closed'
  | 'interrupted';
export type PlaybackState = 'stopped' | 'playing' | 'paused' | 'loading';
export type AudioSourceType =
  | 'drums'
  | 'bass'
  | 'harmony'
  | 'metronome'
  | 'ambient';

export interface AudioContextError {
  type: 'unsupported' | 'hardware' | 'permission' | 'unknown';
  message: string;
  originalError?: Error;
}

export interface AudioPerformanceMetrics {
  latency: number; // Current audio latency in ms
  averageLatency: number; // Average latency over time
  maxLatency: number; // Maximum recorded latency
  dropoutCount: number; // Number of audio dropouts detected
  bufferUnderruns: number; // Buffer underrun events
  cpuUsage: number; // Estimated CPU usage percentage
  memoryUsage: number; // Memory usage in MB
  sampleRate: number; // Current sample rate
  bufferSize: number; // Current buffer size
  timestamp: number; // Last measurement timestamp
  networkLatency?: number; // Network latency for asset loading (ms) - NEW for Epic 2
  cacheHitRate?: number; // Cache hit rate (0-1) - NEW for Epic 2
}

export interface PerformanceAlert {
  type: 'latency' | 'dropout' | 'cpu' | 'memory';
  severity: 'warning' | 'critical';
  message: string;
  metrics: Partial<AudioPerformanceMetrics>;
  timestamp: number;
}

export interface AudioSourceConfig {
  id: string;
  type: AudioSourceType;
  volume: number; // 0-1
  pan: number; // -1 to 1
  muted: boolean;
  solo: boolean;
}

export interface CorePlaybackEngineConfig {
  masterVolume: number;
  tempo: number; // BPM
  pitch: number; // Semitones offset
  swingFactor: number; // 0-1 (0 = straight, 0.5 = triplet swing)
}

// Backward compatibility alias
export type CoreAudioEngineConfig = CorePlaybackEngineConfig;

// Enhanced Mobile Audio Configuration (extending existing MobileAudioConfig)
export interface MobileAudioConfig {
  optimizeForBattery: boolean;
  reducedLatencyMode: boolean;
  autoSuspendOnBackground: boolean;
  gestureActivationRequired: boolean;
  // NEW: Enhanced mobile optimization features
  adaptiveQualityScaling: boolean;
  thermalManagement: boolean;
  batteryAwareProcessing: boolean;
  backgroundAudioOptimization: boolean;
}

// Mobile Optimization - Device and Quality Management
export type DeviceClass = 'low-end' | 'mid-range' | 'high-end' | 'premium';
export type QualityLevel = 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
export type PowerMode =
  | 'high-performance'
  | 'balanced'
  | 'battery-saver'
  | 'ultra-low-power';
export type ThermalState = 'nominal' | 'fair' | 'serious' | 'critical';

export interface DeviceCapabilities {
  // Hardware specifications
  cpuCores: number;
  memoryGB: number;
  architecture: string;
  gpuSupport: boolean;

  // Audio-specific capabilities
  maxSampleRate: number;
  minBufferSize: number;
  maxPolyphony: number;
  audioWorkletSupport: boolean;
  sharedArrayBufferSupport: boolean;

  // Device classification
  deviceClass: DeviceClass;
  platformVersion: string;
  isTablet: boolean;
  screenSize: { width: number; height: number };

  // Performance characteristics
  performanceScore: number;
  thermalThrottlingThreshold: number;
  batteryCapacity?: number;
}

export interface BatteryStatus {
  level: number; // 0-1 (percentage as decimal)
  charging: boolean;
  chargingTime?: number; // minutes until full
  dischargingTime?: number; // minutes until empty
  powerMode: PowerMode;
  lowPowerModeEnabled: boolean;
}

export interface ThermalStatus {
  state: ThermalState;
  cpuTemperature?: number;
  throttlingActive: boolean;
  performanceReduction: number; // 0-1 percentage
}

export interface AdaptiveQualityConfig {
  // Audio quality settings
  sampleRate: number;
  bufferSize: number;
  bitDepth: number;
  compressionRatio: number;

  // Processing settings
  maxPolyphony: number;
  enableEffects: boolean;
  enableVisualization: boolean;
  backgroundProcessing: boolean;

  // Performance settings
  cpuThrottling: number; // 0-1 target CPU usage
  memoryLimit: number; // MB
  thermalManagement: boolean;

  // Battery optimization
  aggressiveBatteryMode: boolean;
  backgroundAudioReduction: boolean;
  displayOptimization: boolean;

  // Quality metadata
  qualityLevel: QualityLevel;
  estimatedBatteryImpact: number; // 0-1 battery drain rate
  estimatedCpuUsage: number; // 0-1 CPU usage percentage
}

export interface UserOptimizationPreferences {
  prioritizeBatteryLife: boolean;
  prioritizeQuality: boolean;
  prioritizeStability: boolean;
  allowBackgroundOptimization: boolean;
  thermalManagementEnabled: boolean;
  automaticQualityScaling: boolean;
  customQualityOverrides?: Partial<AdaptiveQualityConfig>;
}

export interface OptimizationDecision {
  qualityConfig: AdaptiveQualityConfig;
  reasoning: OptimizationReasoning;
  estimatedImprovement: OptimizationImpact;
  confidence: number; // 0-1
  nextReEvaluationTime: number; // timestamp
}

export interface OptimizationReasoning {
  primaryFactors: string[];
  batteryInfluence: number; // 0-1
  thermalInfluence: number; // 0-1
  performanceInfluence: number; // 0-1
  userPreferenceInfluence: number; // 0-1
  explanation: string;
}

export interface OptimizationImpact {
  batteryLifeExtension: number; // estimated minutes
  performanceImprovement: number; // 0-1 percentage
  qualityReduction: number; // 0-1 percentage
  stabilityImprovement: number; // 0-1 percentage
}

export interface OptimizationRules {
  batteryThresholds: {
    highPerformance: number; // Battery % above which high performance is allowed
    balanced: number; // Battery % for balanced mode
    batterySaver: number; // Battery % for battery saver mode
    ultraLowPower: number; // Battery % for emergency mode
  };

  thermalThresholds: {
    qualityReduction: number; // Temperature for quality reduction
    effectsDisable: number; // Temperature to disable effects
    emergencyThrottle: number; // Temperature for emergency throttling
  };

  performanceThresholds: {
    cpuUsageLimit: number; // Max CPU usage before quality reduction
    memoryUsageLimit: number; // Max memory usage before optimization
    latencyThreshold: number; // Max latency before buffer optimization
  };

  deviceClassRules: {
    lowEnd: AdaptiveQualityConfig;
    midRange: AdaptiveQualityConfig;
    highEnd: AdaptiveQualityConfig;
    premium: AdaptiveQualityConfig;
  };
}

// Audio visualization data
export interface AudioVisualizationData {
  waveform: Float32Array;
  spectrum: Float32Array;
  volume: number;
  peak: number;
  timestamp: number;
}

// Event system interfaces
export interface AudioEngineEvents {
  stateChange: (state: PlaybackState) => void;
  audioContextChange: (contextState: AudioContextState) => void;
  performanceAlert: (alert: PerformanceAlert) => void;
  tempoChange: (tempo: number) => void;
  masterVolumeChange: (volume: number) => void;
  sourceVolumeChange: (sourceId: string, volume: number) => void;
  sourceStateChange: (
    sourceId: string,
    state: { muted: boolean; solo: boolean },
  ) => void;
}

// Worker Thread System for Background Audio Processing
export type WorkerThreadType =
  | 'sequencer' // MIDI sequencing and timing
  | 'audio' // Audio buffer processing
  | 'effect' // Audio effects processing
  | 'analysis' // Real-time audio analysis
  | 'compression'; // Audio compression/decompression

export interface WorkerThreadConfig {
  type: WorkerThreadType;
  name: string;
  priority: 'high' | 'medium' | 'low';
  maxConcurrency: number;
  workerScript: string;
  transferableObjects?: boolean;
  sharedArrayBuffer?: boolean;
}

export interface AudioWorkerMessage {
  id: string;
  type: WorkerMessageType;
  payload: any;
  timestamp: number;
  priority?: 'high' | 'medium' | 'low';
  transferables?: Transferable[];
}

export type WorkerMessageType =
  // Initialization
  | 'init'
  | 'configure'
  | 'destroy'
  // Audio processing
  | 'process_audio'
  | 'process_midi'
  | 'process_effects'
  // State synchronization
  | 'state_update'
  | 'metrics_update'
  | 'error_report'
  // Response types
  | 'init_complete'
  | 'processing_complete'
  | 'error';

export interface WorkerInitPayload {
  audioContextState: {
    sampleRate: number;
    bufferSize: number;
    channelCount: number;
  };
  config: CoreAudioEngineConfig;
  workerConfig: WorkerThreadConfig;
}

export interface AudioProcessingPayload {
  audioData: Float32Array[];
  bufferSize: number;
  sampleRate: number;
  timestamp: number;
  processingType:
    | 'sequencer'
    | 'effects'
    | 'analysis'
    | 'normalization'
    | 'filtering';
  parameters?: Record<string, any>;
}

export interface MidiProcessingPayload {
  midiData: Uint8Array;
  timestamp: number;
  scheduleTime: number;
  velocity: number;
  channel: number;
}

export interface WorkerMetrics {
  workerId: string;
  workerType: WorkerThreadType;
  processingTime: number;
  queueLength: number;
  memoryUsage: number;
  cpuUsage: number;
  errorCount: number;
  lastActivity: number;
}

export interface WorkerPool {
  workers: Map<string, WorkerInstance>;
  availableWorkers: Set<string>;
  busyWorkers: Set<string>;
  messageQueue: WorkerJobQueue;
  metrics: WorkerPoolMetrics;
}

export interface WorkerInstance {
  id: string;
  worker: Worker;
  config: WorkerThreadConfig;
  state: WorkerState;
  metrics: WorkerMetrics;
  capabilities: WorkerCapabilities;
  lastPing: number;
}

export type WorkerState =
  | 'initializing'
  | 'idle'
  | 'processing'
  | 'error'
  | 'terminating';

export interface WorkerCapabilities {
  supportedMessageTypes: WorkerMessageType[];
  maxConcurrentJobs: number;
  transferableObjectSupport: boolean;
  sharedArrayBufferSupport: boolean;
  audioWorkletSupport: boolean;
}

export interface WorkerJob {
  id: string;
  type: WorkerMessageType;
  payload: any;
  priority: 'high' | 'medium' | 'low';
  timeout: number;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  transferables?: Transferable[];
  resolve: (result: any) => void;
  reject: (error: Error) => void;
}

export interface WorkerJobQueue {
  high: WorkerJob[];
  medium: WorkerJob[];
  low: WorkerJob[];
  processing: Map<string, WorkerJob>;
  completed: WorkerJob[];
  failed: WorkerJob[];
}

export interface WorkerPoolMetrics {
  totalWorkers: number;
  activeWorkers: number;
  idleWorkers: number;
  errorWorkers: number;
  totalJobsProcessed: number;
  totalJobsFailed: number;
  averageProcessingTime: number;
  queueBacklog: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Background processing optimization
export interface BackgroundProcessingConfig {
  enableWorkerThreads: boolean;
  maxWorkerThreads: number;
  workerConfigs: WorkerThreadConfig[];
  priorityScheduling: boolean;
  adaptiveScaling: boolean;
  batteryOptimization: boolean;
  backgroundThrottling: boolean;
}

// Real-time audio streaming between workers
export interface AudioStreamConfig {
  sampleRate: number;
  bufferSize: number;
  channelCount: number;
  lowLatencyMode: boolean;
  sharedBufferSize: number;
  ringBufferSize: number;
}

export interface SharedAudioBuffer {
  buffers: SharedArrayBuffer[];
  readIndex: Int32Array;
  writeIndex: Int32Array;
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
}

// Error handling for workers
export interface WorkerError {
  workerId: string;
  workerType: WorkerThreadType;
  errorType:
    | 'initialization'
    | 'processing'
    | 'communication'
    | 'memory'
    | 'timeout';
  message: string;
  stack?: string;
  timestamp: number;
  recoverable: boolean;
  context?: Record<string, any>;
}

// Background Processing - CPU Management and Scheduling
export interface CPUUsageMetrics {
  currentUsage: number; // 0-1 percentage
  averageUsage: number; // Rolling average over time
  peakUsage: number; // Maximum recorded usage
  targetUsage: number; // Target CPU usage threshold
  throttlingActive: boolean; // Whether CPU throttling is active
  lastMeasurement: number; // Timestamp of last measurement
}

export interface BackgroundProcessingStrategy {
  processQuality: 'minimal' | 'reduced' | 'standard' | 'enhanced';
  workerCount: number; // Number of active workers
  processingInterval: number; // Time between processing cycles (ms)
  batchSize: number; // Number of items to process per batch
  priorityScheduling: boolean; // Whether to use priority-based scheduling
  thermalThrottling: boolean; // Whether thermal throttling is enabled
  backgroundThrottling: boolean; // Whether background throttling is enabled
  cpuBudget: number; // Maximum CPU budget allocation (0-1)
}

export interface ProcessingJob {
  id: string;
  type: 'audio' | 'midi' | 'effects' | 'analysis';
  priority: 'urgent' | 'high' | 'normal' | 'low' | 'background';
  payload: any;
  estimatedCpuCost: number; // Estimated CPU cost (0-1)
  estimatedDuration: number; // Estimated processing time (ms)
  deadline?: number; // Optional deadline timestamp
  onComplete?: (result: any) => void;
  onError?: (error: Error) => void;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

export interface BackgroundProcessingStats {
  totalJobsProcessed: number;
  totalJobsFailed: number;
  averageProcessingTime: number;
  currentCpuUsage: number;
  backgroundJobsQueued: number;
  urgentJobsQueued: number;
  throttlingEvents: number;
  batteryOptimizationActive: boolean;
  thermalThrottlingActive: boolean;
  lastOptimizationTime: number;
}

export interface SmartSchedulingConfig {
  cpuBudget: number; // Maximum CPU allocation (0-1)
  batterySaverMode: boolean; // Enable battery optimization
  thermalManagement: boolean; // Enable thermal management
  adaptiveScheduling: boolean; // Enable adaptive scheduling
  foregroundPriority: boolean; // Prioritize foreground tasks
  backgroundReduction: number; // Background processing reduction factor (0-1)
  urgentJobTimeout: number; // Timeout for urgent jobs (ms)
  normalJobTimeout: number; // Timeout for normal jobs (ms)
  backgroundJobTimeout: number; // Timeout for background jobs (ms)
}

// iOS-Specific Audio Optimization Types
export type IOSAudioSessionCategory =
  | 'ambient'
  | 'soloAmbient'
  | 'playback'
  | 'record'
  | 'playAndRecord'
  | 'multiRoute';

export type IOSAudioSessionMode =
  | 'default'
  | 'voiceChat'
  | 'gameChat'
  | 'videoRecording'
  | 'measurement'
  | 'moviePlayback'
  | 'videoChat'
  | 'spokenAudio';

export type IOSPlaybackState = 'playing' | 'paused' | 'stopped';

export interface IOSAudioSessionConfig {
  category: IOSAudioSessionCategory;
  mode: IOSAudioSessionMode;
  options: {
    mixWithOthers: boolean;
    duckOthers: boolean;
    interruptSpokenAudioAndMixWithOthers: boolean;
    allowBluetooth: boolean;
    allowBluetoothA2DP: boolean;
    allowAirPlay: boolean;
  };
  preferredSampleRate: number;
  preferredBufferDuration: number;
  routeChangeNotifications: boolean;
}

export interface IOSBackgroundAudioConfig {
  enabled: boolean;
  strategy: 'safari' | 'pwa' | 'hybrid';
  keepAliveInterval: number; // milliseconds
  silentAudioInterval: number; // milliseconds
  visibilityChangeHandling: boolean;
  automaticResumption: boolean;
  backgroundQualityReduction: number; // 0-1 percentage
  minimumBackgroundBufferSize: number;
}

export interface SafariOptimizationConfig {
  enabledWorkarounds: Array<
    'legacy_audiocontext' | 'audioworklet_fallback' | 'mandatory_user_gesture'
  >;
  touchActivationRequired: boolean;
  silentModeHandling: boolean;
  autoplayPolicyWorkaround: boolean;
  bufferOptimization: boolean;
  gestureStackingPrevention: boolean;
}

export interface PWAOptimizationConfig {
  enabledOptimizations: Array<
    | 'standalone_audio_session'
    | 'enhanced_background_audio'
    | 'native_audio_controls'
  >;
  serviceWorkerAudioHandling: boolean;
  backgroundSyncEnabled: boolean;
  notificationAudioSupport: boolean;
  offlineAudioCaching: boolean;
  splashScreenAudioPreload: boolean;
}

export interface IOSAudioInterruption {
  type: 'began' | 'ended';
  reason: 'phone_call' | 'alarm' | 'notification' | 'other_app' | 'system';
  timestamp: number;
  wasPlayingBeforeInterruption?: boolean;
  options?: {
    shouldResume?: boolean;
    wasSuspended?: boolean;
  };
}

export interface IOSRouteChangeEvent {
  previousRoute: string;
  newRoute: string;
  reason:
    | 'unknown'
    | 'newDevice'
    | 'oldDevice'
    | 'categoryChange'
    | 'override'
    | 'wakeFromSleep'
    | 'noSuitableRouteForCategory'
    | 'routeConfigurationChange';
  routeQuality: 'high' | 'medium' | 'low';
  timestamp: number;
}

export interface IOSOptimizationDecision {
  baseOptimization: OptimizationDecision;
  iosSpecific: {
    sessionConfig: IOSAudioSessionConfig;
    backgroundAudio: IOSBackgroundAudioConfig;
    safariWorkarounds: SafariOptimizationConfig['enabledWorkarounds'];
    pwaOptimizations: PWAOptimizationConfig['enabledOptimizations'];
    recommendedBufferSize: number;
    recommendedLatencyHint: AudioContextLatencyCategory;
  };
  performanceImpact: number; // -1 to 1
  batteryImpact: number; // -1 to 1
  reasoning: string;
  confidence: number; // 0 to 1
}

// Android-Specific Audio Optimization Types
export type AndroidAudioStreamType =
  | 'music'
  | 'voice_call'
  | 'system'
  | 'ring'
  | 'alarm'
  | 'notification'
  | 'accessibility'
  | 'assistant';

export type AndroidAudioUsage =
  | 'media'
  | 'voice_communication'
  | 'voice_communication_signalling'
  | 'alarm'
  | 'notification'
  | 'notification_ringtone'
  | 'notification_communication_request'
  | 'notification_communication_instant'
  | 'notification_communication_delayed'
  | 'notification_event'
  | 'assistance_accessibility'
  | 'assistance_navigation_guidance'
  | 'assistance_sonification'
  | 'game'
  | 'assistant';

export type AndroidAudioContentType =
  | 'unknown'
  | 'speech'
  | 'music'
  | 'movie'
  | 'sonification';

export type AndroidPlaybackState = 'playing' | 'paused' | 'stopped';

export interface AndroidAudioManagerConfig {
  streamType: AndroidAudioStreamType;
  usage: AndroidAudioUsage;
  contentType: AndroidAudioContentType;
  options: {
    lowLatency: boolean;
    powerSaving: boolean;
    hardwareAccelerated: boolean;
    spatialAudio: boolean;
    adaptivePlayback: boolean;
    requestAudioFocus: boolean;
    abandonAudioFocusOnPause: boolean;
  };
  preferredSampleRate: number;
  preferredBufferSize: number;
  audioFocusGain:
    | 'gain'
    | 'gain_transient'
    | 'gain_transient_may_duck'
    | 'gain_transient_exclusive';
}

export interface AndroidPowerManagerConfig {
  enabled: boolean;
  strategy: 'performance' | 'balanced' | 'battery_saver' | 'adaptive';
  backgroundBehavior: 'continue' | 'reduce_quality' | 'minimal' | 'suspend';
  dozeModeHandling: boolean;
  appStandbyOptimization: boolean;
  backgroundAppLimits: boolean;
  thermalThrottling: boolean;
  backgroundProcessingReduction: number; // 0-1 percentage
}

export interface AndroidBackgroundAudioConfig {
  enabled: boolean;
  strategy: 'foreground_service' | 'media_session' | 'hybrid';
  serviceTimeout: number; // milliseconds
  mediaSessionHandling: boolean;
  notificationRequired: boolean;
  automaticResumption: boolean;
  backgroundQualityReduction: number; // 0-1 percentage
  minimumBackgroundBufferSize: number;
  dozeModeCompatibility: boolean;
}

export interface AndroidChromeOptimizationConfig {
  enabledWorkarounds: Array<
    | 'legacy_webaudio_workaround'
    | 'audioworklet_compatibility'
    | 'gesture_requirement_bypass'
    | 'buffer_size_optimization'
    | 'sample_rate_detection'
  >;
  touchActivationRequired: boolean;
  autoplayPolicyWorkaround: boolean;
  webRtcOptimizations: boolean;
  aaudioSupport: boolean;
  openslSupport: boolean;
  gestureCoalescing: boolean;
}

export interface AndroidWebViewOptimizationConfig {
  enabledOptimizations: Array<
    | 'webview_audio_optimization'
    | 'hybrid_composition'
    | 'gpu_acceleration'
    | 'memory_optimization'
  >;
  webViewVersion: number;
  systemWebViewUpdates: boolean;
  chromiumEngine: boolean;
  nativeAudioSupport: boolean;
  hardwareAcceleration: boolean;
}

export interface AndroidAudioInterruption {
  type: 'began' | 'ended';
  reason:
    | 'phone_call'
    | 'notification'
    | 'other_app'
    | 'system'
    | 'assistant'
    | 'alarm';
  timestamp: number;
  wasPlayingBeforeInterruption?: boolean;
  focusLoss: 'transient' | 'transient_can_duck' | 'permanent';
  options?: {
    shouldResume?: boolean;
    canDuck?: boolean;
    focusRequest?: AndroidAudioManagerConfig['audioFocusGain'];
  };
}

export interface AndroidAudioRouteChangeEvent {
  previousRoute: string;
  newRoute: string;
  reason:
    | 'unknown'
    | 'device_connect'
    | 'device_disconnect'
    | 'profile_change'
    | 'user_switch'
    | 'policy_change'
    | 'codec_change';
  routeQuality: 'high' | 'medium' | 'low';
  latencyChange: number; // Change in latency (ms)
  timestamp: number;
  bluetoothCodec?: 'sbc' | 'aac' | 'aptx' | 'aptx_hd' | 'ldac' | 'lhdc';
}

export interface AndroidOptimizationDecision {
  baseOptimization: OptimizationDecision;
  androidSpecific: {
    audioManagerConfig: AndroidAudioManagerConfig;
    powerManagerConfig: AndroidPowerManagerConfig;
    backgroundAudio: AndroidBackgroundAudioConfig;
    chromeWorkarounds: AndroidChromeOptimizationConfig['enabledWorkarounds'];
    webViewOptimizations: AndroidWebViewOptimizationConfig['enabledOptimizations'];
    recommendedBufferSize: number;
    recommendedLatencyHint: AudioContextLatencyCategory;
    aaudioRecommended: boolean;
    openslFallback: boolean;
  };
  performanceImpact: number; // -1 to 1
  batteryImpact: number; // -1 to 1
  thermalImpact: number; // -1 to 1
  reasoning: string;
  confidence: number; // 0 to 1
}

// ============================================================================
// N8N PAYLOAD PROCESSING - Epic 2 Architecture Types (NEW)
// ============================================================================

/**
 * Configuration structure for n8n AI agent payload processing
 * Defines the complete data flow from n8n workflow to audio engine
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
 * Asset reference extracted from n8n payload
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
 * Complete asset manifest for n8n payload processing
 */
export interface AssetManifest {
  assets: AssetReference[];
  totalCount: number;
  estimatedLoadTime: number;
}

/**
 * Asset loading state for Epic 2 integration
 */
export interface AssetLoadingState {
  midiFiles: Map<string, ArrayBuffer>;
  audioSamples: Map<string, AudioBuffer>;
  totalAssets: number;
  loadedAssets: number;
}

/**
 * N8n payload processor configuration
 */
export interface N8nPayloadProcessorConfig {
  enableCaching: boolean;
  maxCacheSize: number;
  assetTimeout: number;
  retryAttempts: number;
  fallbackEnabled: boolean;
}

/**
 * Asset dependency information for manifest processing
 */
export interface AssetDependency {
  assetUrl: string;
  dependsOn: string[];
  dependencyType: 'required' | 'optional' | 'performance';
}

/**
 * Asset optimization strategy
 */
export interface AssetOptimization {
  compressionLevel: 'none' | 'low' | 'medium' | 'high';
  qualityTarget: 'maximum' | 'balanced' | 'efficient' | 'minimal';
  deviceOptimized: boolean;
  networkOptimized: boolean;
}

/**
 * Enhanced asset manifest with processing information
 */
export interface ProcessedAssetManifest extends AssetManifest {
  dependencies: AssetDependency[];
  loadingGroups: AssetLoadingGroup[];
  optimizations: Map<string, AssetOptimization>;
  totalSize: number;
  criticalPath: string[];
}

/**
 * Asset loading group for optimized parallel/sequential loading
 */
export interface AssetLoadingGroup {
  id: string;
  priority: number;
  assets: AssetReference[];
  parallelLoadable: boolean;
  requiredForPlayback: boolean;
}

/**
 * Asset loading result information
 */
export interface AssetLoadResult {
  url: string;
  data: ArrayBuffer | AudioBuffer;
  source: 'cdn' | 'supabase' | 'cache';
  loadTime: number;
  compressionUsed: boolean;
}

/**
 * Asset loading error information
 */
export interface AssetLoadError {
  url: string;
  error: Error;
  attemptedSources: string[];
  retryCount: number;
}

/**
 * Asset loading progress tracking
 */
export interface AssetLoadProgress {
  totalAssets: number;
  loadedAssets: number;
  failedAssets: number;
  bytesLoaded: number;
  totalBytes: number;
  currentAsset?: string;
  loadingSpeed: number; // bytes per second
}

/**
 * Asset manager configuration
 */
export interface AssetManagerConfig {
  supabaseUrl: string;
  cdnEnabled: boolean;
  cdnBaseUrl?: string;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
  enableCompression: boolean;
  maxConcurrentLoads: number;
}

// ============================================================================
// ENHANCED MOBILE OPTIMIZATION - Device-Specific Configurations
// ============================================================================

/**
 * Specific device model information for precise optimization
 */
export interface DeviceModel {
  manufacturer: string; // Apple, Samsung, Google, etc.
  model: string; // iPhone 14 Pro, Galaxy S23, Pixel 7, etc.
  series: string; // iPhone, Galaxy, Pixel, etc.
  year: number; // Release year
  chipset: string; // A16 Bionic, Snapdragon 8 Gen 2, etc.
  gpuModel?: string; // Specific GPU model if available
}

/**
 * Network connection characteristics for adaptive optimization
 */
export interface NetworkCapabilities {
  connectionType: '2g' | '3g' | '4g' | '5g' | 'wifi' | 'ethernet' | 'unknown';
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g';
  downlink: number; // Mbps
  rtt: number; // Round trip time in ms
  saveData: boolean; // Data saver mode enabled
  isMetered: boolean; // Is connection metered/limited
}

/**
 * Browser-specific capabilities and limitations
 */
export interface BrowserCapabilities {
  name:
    | 'safari'
    | 'chrome'
    | 'firefox'
    | 'edge'
    | 'samsung'
    | 'webview'
    | 'other';
  version: string;
  engine: 'webkit' | 'blink' | 'gecko' | 'other';
  isWebView: boolean;
  supportedFeatures: {
    audioWorklet: boolean;
    sharedArrayBuffer: boolean;
    webGL: boolean;
    webGL2: boolean;
    offscreenCanvas: boolean;
    serviceworker: boolean;
    webAssembly: boolean;
  };
  limitations: {
    requiresUserGesture: boolean;
    audioSuspendOnBackground: boolean;
    maxAudioContexts: number;
    maxOscillators: number;
    maxAudioBufferSize: number;
  };
}

/**
 * Comprehensive device-specific configuration profile
 */
export interface DeviceSpecificConfig {
  deviceModel: DeviceModel;
  networkCapabilities: NetworkCapabilities;
  browserCapabilities: BrowserCapabilities;

  // Audio-specific optimizations for this device
  audioOptimizations: {
    preferredSampleRate: number;
    optimalBufferSize: number;
    maxPolyphony: number;
    enabledEffects: string[];
    disabledEffects: string[];
    compressionLevel: 'none' | 'light' | 'medium' | 'aggressive';
    latencyOptimization: 'minimal' | 'balanced' | 'quality';
  };

  // Performance characteristics
  performanceProfile: {
    cpuEfficiency: number; // 0-1 how efficiently this device uses CPU
    thermalCharacteristics: 'excellent' | 'good' | 'fair' | 'poor';
    batteryEfficiency: number; // 0-1 how battery efficient audio processing is
    memoryConstraints: 'none' | 'light' | 'moderate' | 'severe';
    backgroundProcessingCapability: 'full' | 'reduced' | 'minimal' | 'none';
  };

  // Platform-specific settings
  platformSettings: {
    ios?: {
      audioSessionCategory: IOSAudioSessionCategory;
      audioSessionMode: IOSAudioSessionMode;
      backgroundAudioStrategy: 'native' | 'workaround' | 'disabled';
      safariWorkarounds: string[];
    };
    android?: {
      audioStreamType: AndroidAudioStreamType;
      audioUsage: AndroidAudioUsage;
      powerOptimization: 'none' | 'standard' | 'aggressive';
      chromeWorkarounds: string[];
    };
  };
}

/**
 * Network-adaptive configuration that changes based on connection
 */
export interface NetworkAdaptiveConfig {
  connectionType: NetworkCapabilities['connectionType'];
  adaptations: {
    // Quality adjustments
    qualityReduction: number; // 0-1 percentage to reduce quality
    compressionIncrease: number; // 0-1 how much more compression to use

    // Loading behavior
    maxConcurrentLoads: number;
    assetCaching: 'aggressive' | 'moderate' | 'minimal' | 'disabled';
    prefetchingEnabled: boolean;

    // Processing adjustments
    backgroundProcessingReduction: number; // 0-1 percentage
    effectsReduction: string[]; // Effects to disable on slow connections
    visualizationDisabled: boolean;

    // Timeout and retry settings
    loadTimeout: number; // milliseconds
    retryAttempts: number;
    retryDelay: number; // milliseconds
  };
}

/**
 * Progressive enhancement configuration for unsupported features
 */
export interface ProgressiveEnhancementConfig {
  featureDetection: {
    audioWorklet: {
      available: boolean;
      fallback: 'scriptprocessor' | 'webaudio' | 'htmlaudio';
    };
    sharedArrayBuffer: {
      available: boolean;
      fallback: 'arraybuffer' | 'postmessage';
    };
    offlineAudioContext: {
      available: boolean;
      fallback: 'realtime' | 'disabled';
    };
    webGL: {
      available: boolean;
      fallback: 'canvas2d' | 'disabled';
    };
  };

  degradationStrategy: {
    gracefulDegradation: boolean;
    fallbackLevels: Array<{
      condition: string;
      disabledFeatures: string[];
      qualityReduction: number;
      reasoning: string;
    }>;
  };
}

/**
 * Real-time optimization adjustment based on current conditions
 */
export interface DynamicOptimizationState {
  currentConditions: {
    batteryLevel: number;
    thermalState: ThermalState;
    cpuUsage: number;
    memoryPressure: number;
    networkLatency: number;
    audioDropouts: number;
    userActivity: 'active' | 'idle' | 'background';
  };

  activeAdjustments: {
    qualityLevel: QualityLevel;
    enabledOptimizations: string[];
    disabledFeatures: string[];
    performanceMode: 'maximum' | 'balanced' | 'efficient' | 'minimal';
    reasoning: string[];
  };

  nextEvaluationTime: number;
  lastNetworkChange: number; // NEW: Timestamp of last network condition change
  adjustmentHistory: Array<{
    timestamp: number;
    adjustment: string;
    trigger: string;
    impact: string;
  }>;
}

/**
 * Enhanced mobile optimization rules with device-specific configurations
 */
export interface EnhancedOptimizationRules {
  // Device model specific rules
  deviceModelRules: Map<string, DeviceSpecificConfig>; // key: "manufacturer-model-year"

  // Browser specific rules
  browserRules: Map<string, Partial<DeviceSpecificConfig>>; // key: "browser-version"

  // Network adaptive rules
  networkRules: Map<
    NetworkCapabilities['connectionType'],
    NetworkAdaptiveConfig
  >;

  // Progressive enhancement rules
  progressiveEnhancement: ProgressiveEnhancementConfig;

  // Dynamic optimization thresholds
  dynamicThresholds: {
    batteryLowThreshold: number;
    thermalWarningThreshold: number;
    cpuUsageThreshold: number;
    memoryPressureThreshold: number;
    dropoutRateThreshold: number;
    latencyThreshold: number;
  };

  // Emergency fallback configurations
  emergencyFallbacks: {
    minimalConfig: AdaptiveQualityConfig;
    safeConfig: AdaptiveQualityConfig;
    compatibilityConfig: AdaptiveQualityConfig;
  };
}

/**
 * Device-specific optimization metrics and analytics
 */
export interface DeviceOptimizationMetrics {
  deviceIdentifier: string;
  sessionDuration: number;

  // Performance metrics
  averageLatency: number;
  dropoutRate: number;
  cpuEfficiency: number;
  batteryUsage: number;
  thermalEvents: number;

  // Optimization effectiveness
  qualityAdjustments: number;
  optimizationTriggers: Map<string, number>;
  fallbackActivations: number;
  networkAdaptations: number;

  // User experience metrics
  userSatisfactionScore?: number;
  reportedIssues: string[];
  successfulSessions: number;
  failedSessions: number;

  // Comparison with baseline
  performanceImprovement: number; // percentage better than default config
  batteryLifeExtension: number; // minutes of battery life saved
  qualityMaintained: number; // percentage of original quality maintained
}

// ============================================================================
// QUALITY SCALER - Real-time Adaptive Quality Management
// ============================================================================

/**
 * Triggers that can cause quality adjustments
 */
export type QualityAdjustmentTrigger =
  | 'performance_degradation' // CPU/memory pressure detected
  | 'battery_low' // Battery below threshold
  | 'thermal_throttling' // Device overheating
  | 'network_slow' // Network conditions degraded
  | 'user_preference' // User requested change
  | 'predictive_optimization' // Anticipatory adjustment
  | 'emergency_fallback' // System recovery mode
  | 'periodic_optimization'; // Regular optimization cycle

/**
 * Quality adaptation strategies
 */
export type QualityAdaptationStrategy =
  | 'conservative' // Only change when absolutely necessary
  | 'balanced' // Standard adaptation based on clear indicators
  | 'aggressive' // Quick adaptation to optimize performance
  | 'user-defined'; // Custom thresholds set by user

/**
 * Quality transition speeds
 */
export type QualityAdaptationSpeed =
  | 'immediate' // < 50ms transition
  | 'gradual' // 100-300ms transition
  | 'smooth'; // 300-500ms transition with crossfading

/**
 * Configuration for quality adaptation behavior
 */
export interface QualityAdaptationRules {
  // Performance thresholds for quality adjustments
  performanceThresholds: {
    // CPU usage thresholds (0-1 percentage)
    cpuUsageHigh: number; // Trigger quality reduction
    cpuUsageLow: number; // Allow quality increase
    cpuUsageCritical: number; // Emergency quality reduction

    // Latency thresholds (milliseconds)
    latencyHigh: number; // Trigger buffer optimization
    latencyLow: number; // Allow smaller buffers
    latencyCritical: number; // Emergency buffer increase

    // Memory pressure thresholds (0-1 percentage)
    memoryPressureHigh: number;
    memoryPressureLow: number;
    memoryPressureCritical: number;

    // Audio dropout thresholds (per minute)
    dropoutRateHigh: number;
    dropoutRateLow: number;
    dropoutRateCritical: number;

    // Battery thresholds (0-1 percentage)
    batteryLow: number; // Enable battery optimizations
    batteryVeryLow: number; // Aggressive battery mode
    batteryCritical: number; // Emergency power saving
  };

  // Adaptation behavior configuration
  adaptationStrategy: QualityAdaptationStrategy;
  adaptationSpeed: QualityAdaptationSpeed;

  // Quality level constraints
  minQualityLevel: QualityLevel;
  maxQualityLevel: QualityLevel;
  allowTemporaryDegradation: boolean;

  // Timing configuration
  evaluationInterval: number; // How often to check conditions (ms)
  stabilizationPeriod: number; // How long to wait before re-adjusting (ms)
  emergencyResponseTime: number; // Max time for emergency adjustments (ms)

  // Trend analysis configuration
  trendAnalysisWindow: number; // Time window for trend analysis (ms)
  performanceTrendWeight: number; // Weight of performance trends (0-1)
  batteryTrendWeight: number; // Weight of battery trends (0-1)

  // User preference integration
  respectUserPreferences: boolean;
  userPreferenceWeight: number; // How much to weight user prefs (0-1)
  allowUserOverrides: boolean; // Can user override hardware limits
}

/**
 * Record of a quality adjustment event
 */
export interface QualityAdjustmentHistory {
  id: string;
  timestamp: number;

  // Quality transition details
  fromQuality: QualityLevel;
  toQuality: QualityLevel;
  fromConfig: AdaptiveQualityConfig;
  toConfig: AdaptiveQualityConfig;

  // Trigger information
  trigger: QualityAdjustmentTrigger;
  triggerReason: string;
  triggerMetrics: Partial<AudioPerformanceMetrics>;

  // Transition details
  transitionDuration: number; // Actual transition time (ms)
  transitionSuccess: boolean;
  transitionMethod: 'immediate' | 'crossfade' | 'buffer_swap';

  // Effectiveness tracking
  performanceImprovement: number; // Measured improvement (0-1)
  userSatisfaction?: number; // User feedback score (0-1)
  stabilityImprovement: number; // Reduction in dropouts/issues (0-1)
  batteryImpact: number; // Battery life change (positive = better)

  // Metadata
  deviceContext: {
    batteryLevel: number;
    thermalState: ThermalState;
    networkQuality: string;
    userActivity: 'active' | 'idle' | 'background';
  };

  rollbackReason?: string; // If adjustment was rolled back
  rollbackTime?: number; // When rollback occurred
}

/**
 * Real-time quality scaling metrics
 */
export interface QualityScalingMetrics {
  // Adaptation statistics
  totalAdaptations: number;
  successfulAdaptations: number;
  failedAdaptations: number;
  rollbackCount: number;

  // Quality level statistics
  averageQualityLevel: number; // Average over session
  qualityStability: number; // Lower values = more stable (0-1)
  qualityVariance: number; // How much quality varies
  timeInOptimalQuality: number; // Percentage of time in best quality

  // Performance impact
  averageLatencyImprovement: number; // ms improvement
  averageDropoutReduction: number; // Percentage reduction
  averageCpuSavings: number; // CPU usage reduction (0-1)
  averageBatteryExtension: number; // Minutes of battery life saved

  // User experience metrics
  userSatisfactionScore: number; // Overall satisfaction (0-1)
  userManualOverrides: number; // How often user changed settings
  userComplaintRate: number; // Issues reported per hour

  // System effectiveness
  adaptationResponseTime: number; // Average time to adapt (ms)
  predictionAccuracy: number; // How often predictions were correct (0-1)
  emergencyActivations: number; // How often emergency mode triggered

  // Session context
  sessionDuration: number; // Total session time (ms)
  lastUpdated: number; // Last metrics update timestamp
  deviceClass: DeviceClass; // Device category for comparison
}

/**
 * Quality transition state management
 */
export interface QualityTransitionState {
  inTransition: boolean;
  transitionId: string;
  startTime: number;
  expectedDuration: number;

  // Transition details
  fromConfig: AdaptiveQualityConfig;
  toConfig: AdaptiveQualityConfig;
  transitionMethod: 'immediate' | 'crossfade' | 'buffer_swap';

  // Progress tracking
  progress: number; // 0-1 completion
  currentConfig: AdaptiveQualityConfig; // Interpolated current state

  // Error handling
  rollbackConfig?: AdaptiveQualityConfig;
  canRollback: boolean;
  rollbackDeadline: number; // Latest time rollback is safe

  // Performance monitoring during transition
  transitionMetrics: {
    audioDropouts: number;
    latencySpikes: number;
    cpuPeaks: number;
    userInterruptions: number;
  };
}

/**
 * Predictive quality management state
 */
export interface QualityPredictionState {
  // Performance trend analysis
  performanceTrend: 'improving' | 'degrading' | 'stable' | 'oscillating';
  batteryTrend: 'improving' | 'degrading' | 'stable';
  thermalTrend: 'improving' | 'degrading' | 'stable';

  // Predictions
  predictedQualityNeed: QualityLevel;
  predictionConfidence: number; // 0-1 confidence in prediction
  timeToAction: number; // ms until action should be taken

  // Trend data (rolling windows)
  performanceHistory: number[]; // Recent performance scores
  batteryHistory: number[]; // Recent battery levels
  latencyHistory: number[]; // Recent latency measurements

  // Predictive triggers
  anticipatedEvents: Array<{
    event: QualityAdjustmentTrigger;
    probability: number; // 0-1 likelihood
    expectedTime: number; // ms from now
    recommendedAction:
      | 'reduce_quality'
      | 'increase_quality'
      | 'prepare_fallback';
  }>;
}

/**
 * Quality scaler configuration
 */
export interface QualityScalerConfig {
  enabled: boolean;

  // Integration settings
  monitoringInterval: number; // How often to check conditions (ms)
  performanceMonitoringEnabled: boolean;
  batteryMonitoringEnabled: boolean;
  thermalMonitoringEnabled: boolean;
  networkMonitoringEnabled: boolean;

  // Adaptation behavior
  adaptationRules: QualityAdaptationRules;
  enablePredictiveOptimization: boolean;
  enableEmergencyFallbacks: boolean;
  enableUserFeedbackIntegration: boolean;

  // Transition management
  maxConcurrentTransitions: number;
  transitionTimeoutMs: number;
  enableCrossfading: boolean;
  rollbackTimeoutMs: number;

  // Metrics and logging
  enableMetricsCollection: boolean;
  metricsRetentionPeriod: number; // ms to keep metrics
  enableDetailedLogging: boolean;
  performanceLogLevel: 'minimal' | 'standard' | 'detailed' | 'debug';

  // A/B testing integration
  enableABTesting: boolean;
  abTestingFrameworkEnabled: boolean;
  experimentalFeatures: string[];

  // Emergency settings
  emergencyModeThresholds: {
    batteryLevel: number; // Battery % to trigger emergency mode
    cpuUsage: number; // CPU % to trigger emergency mode
    memoryPressure: number; // Memory pressure to trigger emergency
    thermalState: ThermalState; // Thermal state to trigger emergency
  };
}

/**
 * Events emitted by QualityScaler
 */
export interface QualityScalerEvents {
  // Quality change events
  qualityChanged: (
    oldConfig: AdaptiveQualityConfig,
    newConfig: AdaptiveQualityConfig,
    reason: QualityAdjustmentTrigger,
    metadata: QualityAdjustmentHistory,
  ) => void;

  qualityDegraded: (
    severity: 'minor' | 'moderate' | 'severe',
    expectedDuration: number,
    reason: string,
  ) => void;

  qualityImproved: (
    newCapabilities: string[],
    qualityLevel: QualityLevel,
  ) => void;

  // Transition events
  transitionStarted: (transitionState: QualityTransitionState) => void;

  transitionCompleted: (
    transitionState: QualityTransitionState,
    success: boolean,
  ) => void;

  transitionFailed: (
    error: Error,
    fallbackConfig: AdaptiveQualityConfig,
  ) => void;

  // Predictive events
  qualityPrediction: (prediction: QualityPredictionState) => void;

  performanceTrendAlert: (
    trend: 'improving' | 'degrading',
    confidence: number,
    recommendedAction: string,
  ) => void;

  // Emergency events
  emergencyModeActivated: (
    trigger: QualityAdjustmentTrigger,
    emergencyConfig: AdaptiveQualityConfig,
  ) => void;

  emergencyModeDeactivated: (recoveryConfig: AdaptiveQualityConfig) => void;

  // System events
  adaptationFailed: (
    error: Error,
    attemptedConfig: AdaptiveQualityConfig,
    fallbackConfig: AdaptiveQualityConfig,
  ) => void;

  metricsUpdated: (metrics: QualityScalingMetrics) => void;

  configurationChanged: (newConfig: QualityScalerConfig) => void;
}
