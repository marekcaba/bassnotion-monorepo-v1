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

export interface CoreAudioEngineConfig {
  masterVolume: number;
  tempo: number; // BPM
  pitch: number; // Semitones offset
  swingFactor: number; // 0-1 (0 = straight, 0.5 = triplet swing)
}

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
