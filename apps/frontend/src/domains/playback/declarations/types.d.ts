/**
 * @fileoverview BassNotion Playback Engine - Extended Type Definitions
 *
 * This file provides extended TypeScript type definitions that complement
 * the main declaration file. It includes internal types that may be useful
 * for advanced integrations and library extensions.
 *
 * @version 2.1.0
 * @since 2025-01
 */

declare module '@bassnotion/playback/types' {
  // ============================================================================
  // ADVANCED AUDIO TYPES - Extended audio processing interfaces
  // ============================================================================

  export interface AudioProcessingChain {
    input: AudioNode;
    output: AudioNode;
    nodes: AudioNode[];
    effects: AudioEffect[];
    bypass: boolean;
    wetDryMix: number;
  }

  export interface AudioEffect {
    id: string;
    name: string;
    type: EffectType;
    node: AudioNode;
    parameters: EffectParameter[];
    enabled: boolean;
    bypass: boolean;
  }

  export interface EffectParameter {
    name: string;
    value: number;
    min: number;
    max: number;
    unit: string;
    automatable: boolean;
    audioParam?: AudioParam;
  }

  export interface AudioVisualizationConfig {
    enabled: boolean;
    type: VisualizationType;
    fftSize: number;
    smoothingTimeConstant: number;
    updateInterval: number;
    canvas?: HTMLCanvasElement;
  }

  export interface FrequencyAnalysisData {
    frequencyData: Uint8Array;
    timeData: Uint8Array;
    fundamentalFrequency: number;
    spectralCentroid: number;
    spectralRolloff: number;
    zeroCrossingRate: number;
    mfcc: number[];
    chroma: number[];
  }

  export interface AudioStreamMetrics {
    bitrate: number;
    sampleRate: number;
    channels: number;
    codec: string;
    quality: number;
    latency: number;
    jitter: number;
    packetLoss: number;
  }

  // ============================================================================
  // MOBILE PLATFORM TYPES - Platform-specific interfaces
  // ============================================================================

  export interface IOSAudioCapabilities {
    supportedCategories: IOSAudioSessionCategory[];
    supportedModes: IOSAudioSessionMode[];
    hardwareSampleRate: number;
    hardwareInputChannels: number;
    hardwareOutputChannels: number;
    supportsBackgroundAudio: boolean;
    supportsAirPlay: boolean;
    supportsBluetoothA2DP: boolean;
  }

  export interface AndroidAudioCapabilities {
    supportedStreamTypes: AndroidAudioStreamType[];
    supportedUsages: AndroidAudioUsage[];
    supportedContentTypes: AndroidAudioContentType[];
    lowLatencySupported: boolean;
    proAudioSupported: boolean;
    midiSupported: boolean;
    usbAudioSupported: boolean;
  }

  export interface DeviceHardwareInfo {
    cpu: {
      architecture: string;
      cores: number;
      frequency: number;
      model: string;
    };
    memory: {
      total: number;
      available: number;
      dedicated: number;
    };
    audio: {
      inputDevices: AudioDeviceInfo[];
      outputDevices: AudioDeviceInfo[];
      preferredSampleRate: number;
      preferredBufferSize: number;
    };
  }

  export interface AudioDeviceInfo {
    id: string;
    name: string;
    type: AudioDeviceType;
    channels: number;
    sampleRates: number[];
    bufferSizes: number[];
    latency: number;
    isDefault: boolean;
  }

  export interface ThermalMonitoringConfig {
    enabled: boolean;
    samplingInterval: number;
    thresholds: {
      normal: number;
      fair: number;
      serious: number;
      critical: number;
    };
    adaptiveActions: ThermalAdaptiveAction[];
  }

  export interface ThermalAdaptiveAction {
    threshold: ThermalState;
    action: ThermalAction;
    priority: number;
    reversible: boolean;
  }

  // ============================================================================
  // PERFORMANCE ANALYSIS TYPES - Advanced metrics and profiling
  // ============================================================================

  export interface PerformanceProfile {
    id: string;
    name: string;
    timestamp: number;
    duration: number;
    samples: PerformanceSample[];
    statistics: PerformanceStatistics;
    hotspots: PerformanceHotspot[];
    recommendations: PerformanceRecommendation[];
  }

  export interface PerformanceSample {
    timestamp: number;
    cpuUsage: number;
    memoryUsage: number;
    audioLatency: number;
    frameDrops: number;
    activeConnections: number;
    threadLoad: ThreadLoadInfo[];
  }

  export interface ThreadLoadInfo {
    threadId: string;
    threadType: WorkerThreadType;
    cpuUsage: number;
    memoryUsage: number;
    queueSize: number;
    activeJobs: number;
  }

  export interface PerformanceHotspot {
    component: string;
    operation: string;
    totalTime: number;
    averageTime: number;
    callCount: number;
    percentage: number;
    suggestions: string[];
  }

  export interface PerformanceRecommendation {
    type: RecommendationType;
    priority: Priority;
    description: string;
    impact: PerformanceImpact;
    implementation: RecommendationImplementation;
  }

  export interface AudioLatencyBreakdown {
    inputBuffer: number;
    processing: number;
    outputBuffer: number;
    systemOverhead: number;
    networkDelay?: number;
    total: number;
  }

  // ============================================================================
  // MEMORY MANAGEMENT TYPES - Advanced memory analysis
  // ============================================================================

  export interface MemorySnapshot {
    timestamp: number;
    totalHeapSize: number;
    usedHeapSize: number;
    heapSizeLimit: number;
    audioBuffers: MemoryCategory;
    toneInstruments: MemoryCategory;
    workers: MemoryCategory;
    plugins: MemoryCategory;
    other: MemoryCategory;
  }

  export interface MemoryCategory {
    count: number;
    totalSize: number;
    averageSize: number;
    largestObject: number;
    oldestObject: number;
  }

  export interface MemoryLeakPattern {
    id: string;
    name: string;
    description: string;
    category: LeakCategory;
    confidence: number;
    heuristics: LeakHeuristic[];
    remediationStrategy: RemediationStrategy;
  }

  export interface LeakHeuristic {
    name: string;
    weight: number;
    threshold: number;
    measurementFunction: string;
  }

  export interface SuspectedLeak {
    id: string;
    pattern: MemoryLeakPattern;
    confidence: number;
    estimatedSize: number;
    ageInMs: number;
    resources: string[];
    stackTrace?: string;
    remediationActions: RemediationAction[];
  }

  export interface RemediationAction {
    type: RemediationType;
    description: string;
    automatic: boolean;
    safetyLevel: SafetyLevel;
    implementation: () => Promise<boolean>;
  }

  export interface MemoryPressureEvent {
    timestamp: number;
    level: MemoryPressureLevel;
    availableMemory: number;
    recommendedActions: string[];
    automaticActionsTriggered: string[];
  }

  // ============================================================================
  // PLUGIN ECOSYSTEM TYPES - Advanced plugin architecture
  // ============================================================================

  export interface PluginRegistry {
    plugins: Map<string, PluginRegistryEntry>;
    categories: Map<PluginCategory, string[]>;
    dependencies: Map<string, string[]>;
    loadOrder: string[];
  }

  export interface PluginDependency {
    pluginId: string;
    version: string;
    optional: boolean;
    loadBefore?: string[];
    loadAfter?: string[];
  }

  export interface PluginLoadContext {
    audioContext: AudioContext;
    pluginManager: PluginManager;
    resourceManager: ResourceManager;
    config: PluginLoadConfig;
    dependencies: PluginDependency[];
  }

  export interface PluginLoadConfig {
    lazy: boolean;
    preload: boolean;
    timeout: number;
    retries: number;
    fallbacks: string[];
  }

  export interface PluginSandbox {
    pluginId: string;
    context: PluginExecutionContext;
    permissions: PluginPermissions;
    resourceLimits: PluginResourceLimits;
    communicationChannel: MessagePort;
  }

  export interface PluginExecutionContext {
    audioContext: AudioContext;
    sampleRate: number;
    blockSize: number;
    channelCount: number;
    timeContext: AudioTimeContext;
  }

  export interface PluginPermissions {
    canAccessNetwork: boolean;
    canAccessStorage: boolean;
    canCreateWorkers: boolean;
    canAccessMicrophone: boolean;
    canAccessMidi: boolean;
    maxCpuUsage: number;
    maxMemoryUsage: number;
  }

  export interface PluginResourceLimits {
    maxMemoryMB: number;
    maxCpuPercent: number;
    maxFileSize: number;
    maxNetworkRequests: number;
    timeoutMs: number;
  }

  // ============================================================================
  // ERROR ANALYSIS TYPES - Advanced error handling and analysis
  // ============================================================================

  export interface ErrorTelemetry {
    errorId: string;
    sessionId: string;
    userId?: string;
    timestamp: number;
    error: SerializedError;
    context: ExtendedErrorContext;
    environment: EnvironmentInfo;
    userActions: UserAction[];
    systemState: SystemState;
  }

  export interface SerializedError {
    name: string;
    message: string;
    stack: string;
    code: string;
    severity: ErrorSeverity;
    category: ErrorCategory;
    recoverable: boolean;
  }

  export interface ExtendedErrorContext {
    component: string;
    operation: string;
    parameters: Record<string, any>;
    audioState: AudioContextState;
    performanceMetrics: AudioPerformanceMetrics;
    resourceState: ResourceState;
    userAgent: string;
    viewport: { width: number; height: number };
    connectionType: string;
    batteryLevel?: number;
    memoryPressure?: MemoryPressureLevel;
  }

  export interface EnvironmentInfo {
    platform: string;
    browser: BrowserInfo;
    os: OperatingSystemInfo;
    hardware: HardwareInfo;
    network: NetworkInfo;
    audio: AudioEnvironmentInfo;
  }

  export interface BrowserInfo {
    name: string;
    version: string;
    engine: string;
    engineVersion: string;
    features: BrowserFeature[];
  }

  export interface OperatingSystemInfo {
    name: string;
    version: string;
    architecture: string;
    language: string;
    timezone: string;
  }

  export interface HardwareInfo {
    cpuCores: number;
    memory: number;
    gpu?: string;
    audio: AudioHardwareInfo;
  }

  export interface AudioHardwareInfo {
    inputDevices: number;
    outputDevices: number;
    maxChannels: number;
    supportedSampleRates: number[];
    driverVersion?: string;
  }

  export interface NetworkInfo {
    type: ConnectionType;
    effectiveType: EffectiveConnectionType;
    downlink: number;
    rtt: number;
    saveData: boolean;
  }

  export interface AudioEnvironmentInfo {
    contextState: AudioContextState;
    supportedFeatures: string[];
    latencyHint: AudioContextLatencyCategory;
    maxChannelCount: number;
    sampleRate: number;
  }

  export interface UserAction {
    timestamp: number;
    type: UserActionType;
    target: string;
    data: Record<string, any>;
  }

  export interface SystemState {
    timestamp: number;
    audioContext: AudioContextState;
    performance: PerformanceSnapshot;
    memory: MemorySnapshot;
    battery?: BatteryState;
    thermal?: ThermalState;
  }

  export interface PerformanceSnapshot {
    cpuUsage: number;
    memoryUsage: number;
    frameRate: number;
    latency: number;
    dropouts: number;
  }

  export interface BatteryState {
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
  }

  // ============================================================================
  // A/B TESTING TYPES - Advanced experimentation framework
  // ============================================================================

  export interface ExperimentParticipant {
    userId: string;
    sessionId: string;
    assignedVariant: string;
    assignmentTimestamp: number;
    deviceInfo: DeviceInfo;
    initialState: ParticipantState;
    metrics: ParticipantMetrics[];
  }

  export interface ParticipantState {
    audioCapabilities: DeviceCapabilities;
    performanceBaseline: AudioPerformanceMetrics;
    userPreferences: UserPreferences;
    networkConditions: NetworkConditions;
  }

  export interface ParticipantMetrics {
    timestamp: number;
    metrics: Record<string, number>;
    events: MetricEvent[];
    satisfaction?: number;
    errors: ErrorSummary[];
  }

  export interface MetricEvent {
    type: string;
    timestamp: number;
    data: Record<string, any>;
    impact: number;
  }

  export interface ErrorSummary {
    category: ErrorCategory;
    count: number;
    severity: ErrorSeverity;
    lastOccurrence: number;
  }

  export interface UserPreferences {
    qualityPreference: QualityLevel;
    batteryOptimization: boolean;
    accessibilityNeeds: string[];
    performanceMode: PowerMode;
  }

  export interface NetworkConditions {
    type: ConnectionType;
    bandwidth: number;
    latency: number;
    stability: number;
  }

  export interface ExperimentStatistics {
    experimentId: string;
    totalParticipants: number;
    variantDistribution: Map<string, number>;
    conversionRates: Map<string, number>;
    statisticalSignificance: number;
    confidenceInterval: ConfidenceInterval;
    effect: EffectSize;
    power: number;
  }

  export interface ConfidenceInterval {
    lower: number;
    upper: number;
    confidence: number;
  }

  export interface EffectSize {
    value: number;
    magnitude: EffectMagnitude;
    interpretation: string;
  }

  // ============================================================================
  // AUDIO WORKLET TYPES - Advanced audio processing
  // ============================================================================

  export interface AudioWorkletConfig {
    name: string;
    url: string;
    options?: AudioWorkletNodeOptions;
    parameters?: AudioWorkletParameter[];
    bufferSize?: number;
    processorClass?: string;
  }

  export interface AudioWorkletParameter {
    name: string;
    defaultValue: number;
    minValue: number;
    maxValue: number;
    automationRate: AutomationRate;
  }

  export interface AudioWorkletMessage {
    type: WorkletMessageType;
    data: any;
    timestamp: number;
    port: number;
  }

  export interface AudioWorkletPerformance {
    processingTime: number;
    cpuUsage: number;
    memoryUsage: number;
    dropouts: number;
    overruns: number;
    underruns: number;
  }

  // ============================================================================
  // ENUM EXTENSIONS - Additional enums for advanced features
  // ============================================================================

  export enum EffectType {
    Filter = 'filter',
    Delay = 'delay',
    Reverb = 'reverb',
    Chorus = 'chorus',
    Distortion = 'distortion',
    Compressor = 'compressor',
    EQ = 'eq',
    Limiter = 'limiter',
    Gate = 'gate',
    Flanger = 'flanger',
    Phaser = 'phaser',
    Tremolo = 'tremolo',
    Vibrato = 'vibrato',
  }

  export enum VisualizationType {
    Waveform = 'waveform',
    Spectrum = 'spectrum',
    Spectrogram = 'spectrogram',
    VuMeter = 'vu-meter',
    PhaseMeter = 'phase-meter',
    Oscilloscope = 'oscilloscope',
  }

  export enum AudioDeviceType {
    Speaker = 'speaker',
    Headphone = 'headphone',
    Microphone = 'microphone',
    LineIn = 'line-in',
    LineOut = 'line-out',
    USB = 'usb',
    Bluetooth = 'bluetooth',
    Internal = 'internal',
  }

  export enum ThermalAction {
    ReducePolyphony = 'reduce-polyphony',
    ReduceQuality = 'reduce-quality',
    DisableEffects = 'disable-effects',
    ReduceFrameRate = 'reduce-frame-rate',
    PauseProcessing = 'pause-processing',
    ThrottleCPU = 'throttle-cpu',
    UnloadPlugins = 'unload-plugins',
  }

  export enum RecommendationType {
    Configuration = 'configuration',
    Hardware = 'hardware',
    Software = 'software',
    Usage = 'usage',
    Environment = 'environment',
  }

  export enum PerformanceImpact {
    Minimal = 'minimal',
    Low = 'low',
    Medium = 'medium',
    High = 'high',
    Significant = 'significant',
  }

  export enum Priority {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low',
    Optional = 'optional',
  }

  export enum LeakCategory {
    Reference = 'reference',
    Closure = 'closure',
    Event = 'event',
    Timer = 'timer',
    DOM = 'dom',
    Worker = 'worker',
    Audio = 'audio',
    Plugin = 'plugin',
  }

  export enum RemediationType {
    Manual = 'manual',
    Automatic = 'automatic',
    Suggested = 'suggested',
    Forced = 'forced',
  }

  export enum SafetyLevel {
    Safe = 'safe',
    MostlySafe = 'mostly-safe',
    Risky = 'risky',
    Dangerous = 'dangerous',
  }

  export enum MemoryPressureLevel {
    Normal = 'normal',
    Moderate = 'moderate',
    Critical = 'critical',
  }

  export enum BrowserFeature {
    WebAudio = 'web-audio',
    AudioWorklet = 'audio-worklet',
    SharedArrayBuffer = 'shared-array-buffer',
    OffscreenCanvas = 'offscreen-canvas',
    WebWorkers = 'web-workers',
    ServiceWorkers = 'service-workers',
    WebAssembly = 'web-assembly',
    MIDI = 'midi',
    GamepadAPI = 'gamepad-api',
    BatteryAPI = 'battery-api',
  }

  export enum ConnectionType {
    Bluetooth = 'bluetooth',
    Cellular = 'cellular',
    Ethernet = 'ethernet',
    None = 'none',
    Mixed = 'mixed',
    Other = 'other',
    Unknown = 'unknown',
    Wifi = 'wifi',
    Wimax = 'wimax',
  }

  export enum EffectiveConnectionType {
    Slow2G = 'slow-2g',
    Fast2G = '2g',
    Fast3G = '3g',
    Fast4G = '4g',
  }

  export enum UserActionType {
    Click = 'click',
    KeyPress = 'keypress',
    Touch = 'touch',
    Gesture = 'gesture',
    Navigation = 'navigation',
    AudioControl = 'audio-control',
    ConfigChange = 'config-change',
  }

  export enum EffectMagnitude {
    Negligible = 'negligible',
    Small = 'small',
    Medium = 'medium',
    Large = 'large',
    VeryLarge = 'very-large',
  }

  export enum WorkletMessageType {
    Initialize = 'initialize',
    Process = 'process',
    Parameter = 'parameter',
    Status = 'status',
    Error = 'error',
    Performance = 'performance',
  }

  export enum IOSAudioSessionCategory {
    Ambient = 'ambient',
    SoloAmbient = 'solo-ambient',
    Playback = 'playback',
    Record = 'record',
    PlayAndRecord = 'play-and-record',
    MultiRoute = 'multi-route',
  }

  export enum IOSAudioSessionMode {
    Default = 'default',
    VoiceChat = 'voice-chat',
    GameChat = 'game-chat',
    VideoRecording = 'video-recording',
    Measurement = 'measurement',
    MoviePlayback = 'movie-playback',
    VideoChat = 'video-chat',
    SpokenAudio = 'spoken-audio',
  }

  export enum AndroidAudioStreamType {
    Voice = 'voice',
    System = 'system',
    Ring = 'ring',
    Music = 'music',
    Alarm = 'alarm',
    Notification = 'notification',
    DTMF = 'dtmf',
    Accessibility = 'accessibility',
  }

  export enum AndroidAudioUsage {
    Unknown = 'unknown',
    Media = 'media',
    VoiceCommunication = 'voice-communication',
    VoiceCommunicationSignalling = 'voice-communication-signalling',
    Alarm = 'alarm',
    Notification = 'notification',
    NotificationRingtone = 'notification-ringtone',
    NotificationCommunicationRequest = 'notification-communication-request',
    NotificationCommunicationInstant = 'notification-communication-instant',
    NotificationCommunicationDelayed = 'notification-communication-delayed',
    NotificationEvent = 'notification-event',
    Game = 'game',
    AssistanceAccessibility = 'assistance-accessibility',
    AssistanceNavigationGuidance = 'assistance-navigation-guidance',
    AssistanceSonification = 'assistance-sonification',
  }

  export enum AndroidAudioContentType {
    Unknown = 'unknown',
    Speech = 'speech',
    Music = 'music',
    Movie = 'movie',
    Sonification = 'sonification',
  }
}

export {};
