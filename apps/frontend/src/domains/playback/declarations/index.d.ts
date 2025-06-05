/**
 * @fileoverview BassNotion Playback Engine - TypeScript Declaration File
 *
 * This declaration file provides TypeScript definitions for external consumption
 * of the BassNotion playback engine. It includes all public APIs, types, and
 * interfaces needed for integration with other applications.
 *
 * @version 2.1.0
 * @author BassNotion Team
 * @since 2025-01
 */

declare module '@bassnotion/playback' {
  // ============================================================================
  // CORE ENGINE - Main audio engine components
  // ============================================================================

  /**
   * Core audio engine providing enterprise-grade audio processing
   */
  export class CoreAudioEngine {
    constructor(config?: Partial<CoreAudioEngineConfig>);

    // Lifecycle methods
    initialize(): Promise<void>;
    start(): Promise<void>;
    stop(): Promise<void>;
    dispose(): Promise<void>;

    // Audio control
    play(): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;

    // State management
    getState(): PlaybackState;
    updateConfig(config: Partial<CoreAudioEngineConfig>): void;

    // Performance monitoring
    getPerformanceMetrics(): AudioPerformanceMetrics;

    // Event handling
    on<K extends keyof AudioEngineEvents>(
      event: K,
      handler: AudioEngineEvents[K],
    ): () => void;

    // Plugin system
    registerPlugin(plugin: AudioPlugin): Promise<void>;
    unregisterPlugin(pluginId: string): Promise<void>;
  }

  /**
   * Audio context management with browser compatibility
   */
  export class AudioContextManager {
    initialize(): Promise<void>;
    getContext(): AudioContext | null;
    suspend(): Promise<void>;
    resume(): Promise<void>;
    close(): Promise<void>;
    getState(): AudioContextState;
  }

  /**
   * Real-time performance monitoring and metrics collection
   */
  export class PerformanceMonitor {
    constructor(config?: Partial<PerformanceMonitorConfig>);
    startMonitoring(): void;
    stopMonitoring(): void;
    getMetrics(): AudioPerformanceMetrics;
    generateReport(): PerformanceReport;
    on(event: 'alert', handler: (alert: PerformanceAlert) => void): () => void;
  }

  // ============================================================================
  // MOBILE OPTIMIZATION - Battery efficient processing
  // ============================================================================

  /**
   * Mobile-specific optimizations for iOS and Android
   */
  export class MobileOptimizer {
    optimizeForDevice(deviceInfo: DeviceInfo): OptimizationConfig;
    enableBatteryOptimizations(): void;
    getDevicePerformanceTier(): DeviceClass;
  }

  /**
   * Battery usage monitoring and optimization
   */
  export class BatteryManager {
    constructor(config?: Partial<BatteryConfig>);
    startMonitoring(): Promise<void>;
    stopMonitoring(): void;
    getUsageMetrics(): BatteryUsageMetrics;
    getOptimizationSuggestions(): BatteryOptimizationSuggestion[];
  }

  /**
   * Background audio processing with CPU management
   */
  export class BackgroundProcessor {
    constructor(config?: Partial<BackgroundProcessingConfig>);
    addJob(job: ProcessingJob): Promise<void>;
    optimizeProcessingStrategy(): Promise<void>;
    getStats(): BackgroundProcessingStats;
  }

  /**
   * iOS-specific audio optimizations
   */
  export class IOSOptimizer {
    initialize(): Promise<void>;
    configureAudioSession(config: IOSAudioSessionConfig): Promise<void>;
    enableBackgroundAudio(config: IOSBackgroundAudioConfig): Promise<void>;
    handleInterruption(interruption: IOSAudioInterruption): Promise<void>;
  }

  /**
   * Android-specific audio optimizations
   */
  export class AndroidOptimizer {
    initialize(): Promise<void>;
    configureAudioManager(config: AndroidAudioManagerConfig): Promise<void>;
    configurePowerManager(config: AndroidPowerManagerConfig): Promise<void>;
    handleInterruption(interruption: AndroidAudioInterruption): Promise<void>;
  }

  // ============================================================================
  // RESOURCE MANAGEMENT - Memory and lifecycle management
  // ============================================================================

  /**
   * Comprehensive resource lifecycle management
   */
  export class ResourceManager {
    static getInstance(
      config?: Partial<ResourceManagerConfig>,
    ): ResourceManager;

    register<T>(
      resource: T,
      type: ResourceType,
      options?: Partial<ResourceMetadata>,
    ): string;

    dispose(resourceId: string, force?: boolean): Promise<boolean>;
    access<T>(resourceId: string): T | null;
    addRef(resourceId: string): boolean;
    removeRef(resourceId: string): boolean;

    getFromPool<T>(type: ResourceType): Promise<T>;
    returnToPool<T>(type: ResourceType, resource: T): Promise<void>;

    cleanupResources(options?: CleanupOptions): Promise<CleanupReport>;
    generateUsageReport(): ResourceUsageReport;
    detectMemoryLeaks(): Promise<MemoryLeakReport>;
  }

  /**
   * Memory leak detection and prevention
   */
  export class MemoryLeakDetector {
    static getInstance(
      config?: Partial<LeakDetectorConfig>,
    ): MemoryLeakDetector;

    initialize(
      deviceCapabilities?: DeviceCapabilities,
      batteryStatus?: BatteryStatus,
      thermalStatus?: ThermalStatus,
    ): Promise<void>;

    registerResource(resource: ManagedResource): void;
    unregisterResource(resourceId: string): void;
    performScan(deep?: boolean): Promise<LeakDetectionReport>;
    remediateLeak(leakId: string, force?: boolean): Promise<boolean>;
    getStatistics(): LeakStatistics;
  }

  /**
   * Intelligent garbage collection optimization
   */
  export class GarbageCollectionOptimizer {
    static getInstance(config?: Partial<GCConfig>): GarbageCollectionOptimizer;

    optimizedGarbageCollection(
      trigger: GCTrigger,
      deviceConstraints?: DeviceConstraints,
    ): Promise<void>;

    updateAudioActivity(): void;
    performManualCollection(): Promise<void>;
    getMetrics(): GCMetrics;
    updateConfig(newConfig: Partial<GCConfig>): void;
  }

  /**
   * Professional audio resource disposal with fade-out
   */
  export class AudioResourceDisposer {
    static getInstance(config?: Partial<DisposalConfig>): AudioResourceDisposer;

    registerResource(resource: AudioResource): void;

    disposeResource(
      resourceId: string,
      strategy?: DisposalStrategy,
      fadeConfig?: FadeConfig,
    ): Promise<DisposalResult>;

    disposeAllResources(strategy?: DisposalStrategy): Promise<DisposalResult[]>;
    getActiveResources(): AudioResource[];
    getMetrics(): DisposalMetrics;
  }

  /**
   * Real-time resource usage monitoring
   */
  export class ResourceUsageMonitor {
    constructor(config?: Partial<ResourceMonitorConfig>);

    startMonitoring(): void;
    stopMonitoring(): void;
    collectMetrics(): Promise<ResourceMetricsSnapshot>;
    getRecommendations(): OptimizationRecommendation[];
  }

  // ============================================================================
  // PLUGIN ARCHITECTURE - Extensible audio processing
  // ============================================================================

  /**
   * Base class for creating audio plugins
   */
  export abstract class BaseAudioPlugin implements AudioPlugin {
    public metadata: PluginMetadata;
    protected config: PluginConfig;
    protected state: PluginState;

    constructor(metadata: PluginMetadata, config?: Partial<PluginConfig>);

    abstract initialize(context: PluginAudioContext): Promise<void>;
    abstract process(
      inputBuffer: Float32Array[],
      outputBuffer: Float32Array[],
      parameters: Record<string, number>,
    ): Promise<PluginProcessingResult>;
    abstract dispose(): Promise<void>;

    // Lifecycle methods
    load(): Promise<void>;
    unload(): Promise<void>;
    activate(): Promise<void>;
    deactivate(): Promise<void>;

    // Parameter management
    getParameter(name: string): number;
    setParameter(name: string, value: number): void;
    getParameters(): Record<string, number>;
    setParameters(parameters: Record<string, number>): void;

    // State management
    getState(): PluginState;
    getMetadata(): PluginMetadata;
    updateConfig(config: Partial<PluginConfig>): void;

    // Event handling
    on<K extends keyof PluginEvents>(
      event: K,
      handler: PluginEvents[K],
    ): () => void;
  }

  /**
   * Plugin management and lifecycle coordination
   */
  export class PluginManager {
    constructor(config?: Partial<PluginManagerConfig>);

    initialize(): Promise<void>;
    registerPlugin(plugin: AudioPlugin): Promise<void>;
    unregisterPlugin(pluginId: string): Promise<void>;
    activatePlugin(pluginId: string): Promise<void>;
    deactivatePlugin(pluginId: string): Promise<void>;

    processAudio(
      inputBuffer: Float32Array[],
      outputBuffer: Float32Array[],
    ): Promise<void>;

    getActivePlugins(): AudioPlugin[];
    getPluginById(pluginId: string): AudioPlugin | null;

    on<K extends keyof PluginManagerEvents>(
      event: K,
      handler: PluginManagerEvents[K],
    ): () => void;
  }

  // ============================================================================
  // WORKER POOL - Background processing
  // ============================================================================

  /**
   * Worker pool management for background audio processing
   */
  export class WorkerPoolManager {
    constructor(config?: Partial<WorkerPoolConfig>);

    initialize(): Promise<void>;
    addJob<T>(
      type: WorkerThreadType,
      payload: T,
      priority?: JobPriority,
    ): Promise<WorkerJobResult>;

    getWorkerStats(): WorkerPoolMetrics;
    dispose(): Promise<void>;
  }

  // ============================================================================
  // STATE PERSISTENCE - Session recovery
  // ============================================================================

  /**
   * State persistence and session recovery
   */
  export class StatePersistenceManager {
    constructor(config?: Partial<PersistenceConfig>);

    initialize(): Promise<void>;
    saveState<T>(
      key: string,
      state: T,
      metadata?: StateMetadata,
    ): Promise<void>;
    loadState<T>(key: string): Promise<T | null>;
    clearState(key: string): Promise<void>;
    getStorageInfo(): Promise<StorageQuota>;
  }

  // ============================================================================
  // A/B TESTING - Performance optimization
  // ============================================================================

  /**
   * A/B testing framework for performance optimization
   */
  export class ABTestFramework {
    static getInstance(): ABTestFramework;

    createExperiment(config: ExperimentConfig): Promise<string>;
    startExperiment(experimentId: string): Promise<void>;
    assignUserToVariant(
      experimentId: string,
      userId: string,
    ): Promise<ExperimentVariant>;

    recordMetrics(
      experimentId: string,
      userId: string,
      metrics: Record<string, number>,
    ): Promise<void>;

    analyzeExperiment(experimentId: string): Promise<ExperimentAnalysis>;
    endExperiment(experimentId: string): Promise<ExperimentResult>;
    rollbackExperiment(experimentId: string): Promise<void>;
  }

  // ============================================================================
  // ERROR HANDLING - Comprehensive error management
  // ============================================================================

  /**
   * Base playback error class
   */
  export class PlaybackError extends Error {
    readonly code: string;
    readonly severity: ErrorSeverity;
    readonly category: ErrorCategory;
    readonly context: ErrorContext;
    readonly timestamp: number;

    constructor(
      message: string,
      code: string,
      severity: ErrorSeverity,
      category: ErrorCategory,
      context?: ErrorContext,
    );
  }

  /**
   * Audio context specific errors
   */
  export class AudioContextError extends PlaybackError {
    readonly audioContextErrorCode: AudioContextErrorCode;

    constructor(
      message: string,
      code: AudioContextErrorCode,
      context?: ErrorContext,
    );
  }

  /**
   * Performance related errors
   */
  export class PerformanceError extends PlaybackError {
    readonly performanceErrorCode: PerformanceErrorCode;

    constructor(
      message: string,
      code: PerformanceErrorCode,
      context?: ErrorContext,
    );
  }

  /**
   * Resource management errors
   */
  export class ResourceError extends PlaybackError {
    readonly resourceErrorCode: ResourceErrorCode;

    constructor(
      message: string,
      code: ResourceErrorCode,
      context?: ErrorContext,
    );
  }

  /**
   * Network and connectivity errors
   */
  export class NetworkError extends PlaybackError {
    readonly networkErrorCode: NetworkErrorCode;

    constructor(
      message: string,
      code: NetworkErrorCode,
      context?: ErrorContext,
    );
  }

  /**
   * Mobile platform specific errors
   */
  export class MobileError extends PlaybackError {
    readonly mobileErrorCode: MobileErrorCode;

    constructor(message: string, code: MobileErrorCode, context?: ErrorContext);
  }

  /**
   * Validation and configuration errors
   */
  export class ValidationError extends PlaybackError {
    readonly validationErrorCode: ValidationErrorCode;

    constructor(
      message: string,
      code: ValidationErrorCode,
      context?: ErrorContext,
    );
  }

  /**
   * Error classification and analysis
   */
  export class ErrorClassifier {
    static classifyError(error: Error, context?: ErrorContext): ClassifiedError;
    static determineSeverity(
      error: Error,
      context?: ErrorContext,
    ): ErrorSeverity;
    static categorizeError(error: Error): ErrorCategory;
  }

  /**
   * Automatic error recovery system
   */
  export class ErrorRecovery {
    constructor(config?: Partial<ErrorRecoveryConfig>);

    canRecover(error: PlaybackError): boolean;
    recover(error: PlaybackError): Promise<RecoveryResult>;
    getRecoveryStrategies(error: PlaybackError): RecoveryStrategy[];
  }

  /**
   * Error reporting and logging
   */
  export class ErrorReporter {
    static reportError(error: PlaybackError, context?: ErrorContext): void;
    static getErrorLogs(): ErrorLog[];
    static clearErrorLogs(): void;
  }

  // Error creation helpers
  export function createAudioContextError(
    message: string,
    code: AudioContextErrorCode,
    context?: ErrorContext,
  ): AudioContextError;

  export function createPerformanceError(
    message: string,
    code: PerformanceErrorCode,
    context?: ErrorContext,
  ): PerformanceError;

  export function createResourceError(
    message: string,
    code: ResourceErrorCode,
    context?: ErrorContext,
  ): ResourceError;

  export function createNetworkError(
    message: string,
    code: NetworkErrorCode,
    context?: ErrorContext,
  ): NetworkError;

  export function createMobileError(
    message: string,
    code: MobileErrorCode,
    context?: ErrorContext,
  ): MobileError;

  export function createValidationError(
    message: string,
    code: ValidationErrorCode,
    context?: ErrorContext,
  ): ValidationError;

  // Type guards
  export function isPlaybackError(error: any): error is PlaybackError;
  export function isAudioContextError(error: any): error is AudioContextError;
  export function isPerformanceError(error: any): error is PerformanceError;
  export function isResourceError(error: any): error is ResourceError;
  export function isNetworkError(error: any): error is NetworkError;
  export function isMobileError(error: any): error is MobileError;
  export function isValidationError(error: any): error is ValidationError;

  // ============================================================================
  // REACT INTEGRATION - Hooks and state management
  // ============================================================================

  /**
   * React hook for core playback engine integration
   */
  export function useCorePlaybackEngine(
    config?: Partial<CoreAudioEngineConfig>,
  ): {
    engine: CoreAudioEngine | null;
    state: PlaybackState;
    isInitialized: boolean;
    error: PlaybackError | null;
    initialize: () => Promise<void>;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    stop: () => Promise<void>;
  };

  /**
   * Zustand store for playback state management
   */
  export const usePlaybackStore: {
    getState: () => PlaybackStore;
    setState: (state: Partial<PlaybackStore>) => void;
    subscribe: (listener: (state: PlaybackStore) => void) => () => void;
  };

  /**
   * Playback store selectors
   */
  export const playbackSelectors: {
    getEngine: (state: PlaybackStore) => CoreAudioEngine | null;
    getState: (state: PlaybackStore) => PlaybackState;
    getPerformanceMetrics: (state: PlaybackStore) => AudioPerformanceMetrics;
    getErrors: (state: PlaybackStore) => PlaybackError[];
    isInitialized: (state: PlaybackStore) => boolean;
    isPlaying: (state: PlaybackStore) => boolean;
  };

  // ============================================================================
  // UTILITIES - Helper functions and device detection
  // ============================================================================

  /**
   * Device capability detection
   */
  export function detectDeviceCapabilities(): DeviceCapabilities;
  export function getMobileAudioConstraints(): MobileAudioConstraints;
  export function supportsLowLatencyAudio(): boolean;
  export function getRecommendedAudioContextConfig(): AudioContextOptions;
  export function requiresUserGesture(): boolean;
  export function getDevicePerformanceTier(): DeviceClass;
  export function getBatteryOptimizationRecommendations(): BatteryOptimizationSuggestion[];

  /**
   * Feature detection
   */
  export function isFeatureSupported(feature: SupportedFeature): boolean;

  // ============================================================================
  // TYPE DEFINITIONS - Core interfaces and types
  // ============================================================================

  // Core Audio Types
  export interface CoreAudioEngineConfig {
    audioContext: AudioContextOptions;
    performance: PerformanceConfig;
    mobile: MobileAudioConfig;
    plugins: PluginConfig[];
    errorHandling: ErrorHandlingConfig;
    resourceManagement: ResourceManagementConfig;
  }

  export interface PerformanceConfig {
    enableMonitoring: boolean;
    sampleInterval: number;
    alertThresholds: {
      maxLatency: number;
      maxCpuUsage: number;
      maxMemoryUsage: number;
      maxAudioDropouts: number;
      maxBatteryImpact: number;
    };
    historySize: number;
    enableTrending: boolean;
  }

  export interface MobileAudioConfig {
    enableOptimizations: boolean;
    batteryAware: boolean;
    adaptiveQuality: boolean;
    backgroundProcessing: boolean;
    thermalManagement: boolean;
    networkOptimizations: boolean;
  }

  export interface ErrorHandlingConfig {
    enableAutoRecovery: boolean;
    retryAttempts: number;
    circuitBreakerThreshold: number;
    gracefulDegradation: boolean;
    errorReporting: boolean;
  }

  export interface ResourceManagementConfig {
    enableAutomaticCleanup: boolean;
    memoryThreshold: number;
    maxIdleTime: number;
    pooling: boolean;
    leakDetection: boolean;
  }

  export interface AudioEngineEvents {
    initialized: () => void;
    started: () => void;
    stopped: () => void;
    error: (error: PlaybackError) => void;
    performanceAlert: (alert: PerformanceAlert) => void;
    stateChanged: (state: PlaybackState) => void;
  }

  export interface PerformanceMonitorConfig {
    enabled: boolean;
    sampleInterval: number;
    historySize: number;
    enableTrending: boolean;
    alertThresholds: {
      latency: number;
      cpuUsage: number;
      memoryUsage: number;
      audioDropouts: number;
      batteryImpact: number;
    };
  }

  export interface PerformanceReport {
    summary: AudioPerformanceMetrics;
    trends: PerformanceTrend[];
    recommendations: PerformanceRecommendation[];
    alerts: PerformanceAlert[];
    timestamp: number;
  }

  export interface PerformanceTrend {
    metric: string;
    direction: 'increasing' | 'decreasing' | 'stable';
    rate: number;
    confidence: number;
  }

  export interface PerformanceRecommendation {
    type: 'configuration' | 'hardware' | 'software' | 'usage';
    priority: 'high' | 'medium' | 'low';
    description: string;
    impact: 'high' | 'medium' | 'low';
  }

  export interface AlertType {
    latency: 'latency';
    cpu: 'cpu';
    memory: 'memory';
    dropouts: 'dropouts';
    battery: 'battery';
  }

  export interface AlertSeverity {
    info: 'info';
    warning: 'warning';
    error: 'error';
    critical: 'critical';
  }

  // Mobile Optimization Types
  export interface BatteryConfig {
    enabled: boolean;
    monitoringInterval: number;
    lowBatteryThreshold: number;
    criticalBatteryThreshold: number;
    optimizationStrategies: string[];
    adaptiveQuality: boolean;
  }

  export interface BackgroundProcessingConfig {
    enabled: boolean;
    maxWorkers: number;
    priorityQueues: boolean;
    cpuThrottling: boolean;
    memoryLimit: number;
    thermalManagement: boolean;
  }

  export interface ProcessingJob {
    id: string;
    type: string;
    priority: JobPriority;
    payload: any;
    timeout: number;
    retries: number;
  }

  export interface BackgroundProcessingStats {
    activeJobs: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
    cpuUsage: number;
    memoryUsage: number;
  }

  export interface IOSAudioSessionConfig {
    category: IOSAudioSessionCategory;
    mode: IOSAudioSessionMode;
    options: string[];
    preferredSampleRate: number;
    preferredIOBufferDuration: number;
  }

  export interface IOSBackgroundAudioConfig {
    enabled: boolean;
    category: IOSAudioSessionCategory;
    mixWithOthers: boolean;
    duckOthers: boolean;
    interruptSpokenAudioAndMixWithOthers: boolean;
  }

  export interface IOSAudioInterruption {
    type: 'began' | 'ended';
    reason?: 'default' | 'app_wasSuspended' | 'built_in_mic_muted';
    options?: string[];
  }

  export interface AndroidAudioManagerConfig {
    streamType: AndroidAudioStreamType;
    usage: AndroidAudioUsage;
    contentType: AndroidAudioContentType;
    flags: string[];
  }

  export interface AndroidPowerManagerConfig {
    wakeLockType: string;
    wakeLockFlags: string[];
    thermalStatusThreshold: ThermalState;
    batteryOptimizations: boolean;
  }

  export interface AndroidAudioInterruption {
    type: 'focus_loss' | 'focus_gain';
    duration: 'transient' | 'transient_can_duck' | 'permanent';
    reason: string;
  }

  export interface BatteryStatus {
    level: number;
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
  }

  export interface ThermalStatus {
    state: ThermalState;
    temperature?: number;
    throttling: boolean;
  }

  export interface DevicePlatform {
    name: string;
    version: string;
    isMobile: boolean;
    isIOS: boolean;
    isAndroid: boolean;
  }

  export interface OperatingSystem {
    name: string;
    version: string;
    architecture: string;
  }

  export interface BrowserInfo {
    name: string;
    version: string;
    engine: string;
    engineVersion: string;
  }

  export interface HardwareInfo {
    cpuCores: number;
    memory: number;
    gpu?: string;
    audioDevices: number;
  }

  export interface BackgroundBehavior {
    full: 'full';
    reduced: 'reduced';
    minimal: 'minimal';
  }

  export interface BatteryOptimization {
    type: string;
    description: string;
    savings: number;
    impact: string;
  }

  export interface AudioContextState {
    state: AudioContextState;
    sampleRate: number;
    currentTime: number;
    baseLatency: number;
    outputLatency: number;
  }

  export interface PlaybackState {
    status: PlaybackStatus;
    isInitialized: boolean;
    isPlaying: boolean;
    isPaused: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    muted: boolean;
    performance: AudioPerformanceMetrics;
    errors: PlaybackError[];
  }

  export interface AudioPerformanceMetrics {
    latency: number;
    cpuUsage: number;
    memoryUsage: number;
    audioDropouts: number;
    batteryImpact: number;
    networkLatency?: number;
    cacheHitRate?: number;
    frameRate: number;
    glitches: number;
    bufferHealth: number;
  }

  export interface PerformanceAlert {
    type: AlertType;
    severity: AlertSeverity;
    message: string;
    timestamp: number;
    context: Record<string, any>;
  }

  // Mobile Optimization Types
  export interface DeviceCapabilities {
    webAudioSupport: boolean;
    lowLatencySupport: boolean;
    backgroundAudioSupport: boolean;
    maxPolyphony: number;
    sampleRates: number[];
    bufferSizes: number[];
    batteryAPI: boolean;
    performanceAPI: boolean;
  }

  export interface MobileAudioConstraints {
    maxBufferSize: number;
    maxPolyphony: number;
    recommendedSampleRate: number;
    batteryOptimizations: boolean;
    backgroundProcessing: boolean;
  }

  export interface DeviceInfo {
    platform: DevicePlatform;
    os: OperatingSystem;
    browser: BrowserInfo;
    hardware: HardwareInfo;
    capabilities: DeviceCapabilities;
  }

  export interface OptimizationConfig {
    bufferSize: number;
    polyphonyLimit: number;
    qualityLevel: QualityLevel;
    backgroundBehavior: BackgroundBehavior;
    batteryOptimizations: BatteryOptimization[];
  }

  // Resource Management Types
  export interface ResourceManagerConfig {
    enableAutomaticCleanup: boolean;
    memoryThreshold: number;
    maxIdleTime: number;
    pooling: boolean;
    leakDetection: boolean;
    gcOptimization: boolean;
  }

  export interface CleanupOptions {
    force: boolean;
    includeActive: boolean;
    strategy: CleanupStrategy;
    timeout: number;
  }

  export interface LeakDetectorConfig {
    enabled: boolean;
    scanInterval: number;
    patterns: string[];
    thresholds: {
      memoryGrowth: number;
      objectCount: number;
      age: number;
    };
    autoRemediation: boolean;
  }

  export interface LeakDetectionReport {
    suspectedLeaks: SuspectedLeak[];
    memoryGrowthRate: number;
    totalSuspectedLeakage: number;
    confidence: number;
    recommendations: string[];
    timestamp: number;
  }

  export interface LeakStatistics {
    totalScans: number;
    leaksDetected: number;
    leaksRemediated: number;
    falsePositives: number;
    averageScanTime: number;
  }

  export interface GCConfig {
    strategy: GCStrategy;
    idleThreshold: number;
    memoryThreshold: number;
    thermalThreshold: ThermalState;
    batteryThreshold: number;
    aggressiveness: number;
  }

  export interface DeviceConstraints {
    maxMemory: number;
    maxCpu: number;
    thermalLimit: ThermalState;
    batteryLevel: number;
    performanceMode: PowerMode;
  }

  export interface GCMetrics {
    collectionsPerformed: number;
    memoryReclaimed: number;
    averageCollectionTime: number;
    lastCollectionTime: number;
    nextScheduledCollection: number;
  }

  export interface DisposalConfig {
    defaultStrategy: DisposalStrategy;
    fadePresets: Record<string, FadeConfig>;
    artifactDetection: boolean;
    connectionWaitTime: number;
    retryAttempts: number;
  }

  export interface FadeConfig {
    type: FadeType;
    duration: number;
    curve: number[];
    antiClick: boolean;
  }

  export interface DisposalResult {
    success: boolean;
    resourceId: string;
    strategy: DisposalStrategy;
    fadeTime: number;
    artifactsDetected: boolean;
    error?: Error;
  }

  export interface DisposalMetrics {
    totalDisposals: number;
    averageFadeTime: number;
    artifactsDetected: number;
    failureRate: number;
    strategiesUsed: Record<DisposalStrategy, number>;
  }

  export interface AudioResource {
    id: string;
    type: AudioResourceType;
    resource: any;
    metadata: ResourceMetadata;
    activeConnections: number;
    lastActivity: number;
  }

  export interface ResourceMonitorConfig {
    enabled: boolean;
    samplingInterval: number;
    alertThresholds: {
      memory: number;
      cpu: number;
      resourceCount: number;
    };
    trending: boolean;
  }

  export interface ResourceMetricsSnapshot {
    timestamp: number;
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      usage: number;
      cores: number;
    };
    resources: {
      total: number;
      active: number;
      idle: number;
      leaked: number;
    };
    performance: {
      latency: number;
      dropouts: number;
      frameRate: number;
    };
  }

  export interface OptimizationRecommendation {
    type: string;
    priority: Priority;
    description: string;
    impact: string;
    implementation: string;
  }

  export interface SuspectedLeak {
    id: string;
    type: string;
    age: number;
    size: number;
    confidence: number;
    pattern: string;
    stackTrace?: string;
  }

  export interface ResourceAction {
    type: string;
    target: string;
    description: string;
    priority: Priority;
  }

  export interface ResourceMetadata {
    id: string;
    type: ResourceType;
    priority: ResourcePriority;
    state: ResourceState;
    createdAt: number;
    lastAccessed: number;
    accessCount: number;
    memoryUsage: number;
    dependencies: Set<string>;
    dependents: Set<string>;
    tags: Set<string>;
    cleanupStrategy: CleanupStrategy;
    autoCleanupTimeout?: number;
    maxIdleTime?: number;
    onDispose?: () => Promise<void> | void;
  }

  export interface ManagedResource<T = any> {
    id: string;
    resource: T;
    metadata: ResourceMetadata;
    refs: number;
    weakRefs: Set<WeakRef<object>>;
  }

  export interface CleanupReport {
    cleaned: number;
    memoryReclaimed: number;
    totalChecked: number;
  }

  export interface ResourceUsageReport {
    totalResources: number;
    totalMemoryUsage: number;
    resourcesByType: Map<ResourceType, number>;
    memoryByType: Map<ResourceType, number>;
    idleResources: number;
    leakedResources: number;
    poolUtilization: Map<ResourceType, number>;
    memoryPressure: number;
    recommendedActions: ResourceAction[];
    timestamp: number;
  }

  export interface MemoryLeakReport {
    suspectedLeaks: SuspectedLeak[];
    memoryGrowthRate: number;
    totalSuspectedLeakage: number;
    confidence: number;
    timestamp: number;
  }

  // Plugin System Types
  export interface AudioPlugin {
    metadata: PluginMetadata;
    initialize(context: PluginAudioContext): Promise<void>;
    process(
      inputBuffer: Float32Array[],
      outputBuffer: Float32Array[],
      parameters: Record<string, number>,
    ): Promise<PluginProcessingResult>;
    dispose(): Promise<void>;
  }

  export interface PluginMetadata {
    id: string;
    name: string;
    version: string;
    author: string;
    description: string;
    category: PluginCategory;
    priority: PluginPriority;
    capabilities: PluginCapabilities;
    parameters: PluginParameter[];
  }

  export interface PluginConfig {
    enabled: boolean;
    parameters: Record<string, number>;
    processingOptions: ProcessingOptions;
    audioContext: AudioContextOptions;
  }

  export interface ProcessingOptions {
    bufferSize: number;
    channelCount: number;
    sampleRate: number;
    latencyHint: AudioContextLatencyCategory;
    enableOptimizations: boolean;
  }

  export interface PluginEvents {
    loaded: () => void;
    unloaded: () => void;
    activated: () => void;
    deactivated: () => void;
    error: (error: Error) => void;
    parameterChanged: (name: string, value: number) => void;
  }

  export interface PluginManagerConfig {
    maxPlugins: number;
    enableHotLoading: boolean;
    sandboxed: boolean;
    resourceLimits: {
      maxMemory: number;
      maxCpu: number;
      timeout: number;
    };
    security: {
      allowNetworkAccess: boolean;
      allowFileAccess: boolean;
      allowWorkers: boolean;
    };
  }

  export interface PluginManagerEvents {
    pluginRegistered: (plugin: AudioPlugin) => void;
    pluginUnregistered: (pluginId: string) => void;
    pluginActivated: (pluginId: string) => void;
    pluginDeactivated: (pluginId: string) => void;
    processingCompleted: (results: PluginProcessingResult[]) => void;
    error: (error: Error, pluginId?: string) => void;
  }

  export interface WorkerPoolConfig {
    maxWorkers: number;
    idleTimeout: number;
    jobTimeout: number;
    retryAttempts: number;
    enablePrioritization: boolean;
    healthCheck: boolean;
  }

  export interface StateMetadata {
    version: string;
    timestamp: number;
    size: number;
    compressed: boolean;
    encrypted: boolean;
    checksum: string;
  }

  export interface ParameterType {
    float: 'float';
    integer: 'integer';
    boolean: 'boolean';
    enum: 'enum';
    string: 'string';
  }

  export interface TransportInfo {
    bpm: number;
    timeSignature: [number, number];
    position: number;
    playing: boolean;
    looping: boolean;
  }

  export interface ErrorRecoveryConfig {
    enabled: boolean;
    maxRetryAttempts: number;
    backoffStrategy: 'linear' | 'exponential';
    circuitBreakerThreshold: number;
    fallbackStrategies: string[];
  }

  export interface RecoveryStrategy {
    type: string;
    description: string;
    automatic: boolean;
    priority: number;
    implementation: () => Promise<boolean>;
  }

  export interface ErrorLog {
    timestamp: number;
    error: PlaybackError;
    context: ErrorContext;
    resolved: boolean;
    recoveryAttempts: number;
  }

  // Error Code Types
  export type AudioContextErrorCode =
    | 'context_creation_failed'
    | 'context_suspended'
    | 'context_interrupted'
    | 'unsupported_sample_rate'
    | 'unsupported_buffer_size'
    | 'worklet_load_failed'
    | 'user_gesture_required';

  export type PerformanceErrorCode =
    | 'latency_exceeded'
    | 'cpu_overload'
    | 'memory_exceeded'
    | 'audio_dropouts'
    | 'frame_drops'
    | 'buffer_underrun'
    | 'performance_degraded';

  export type ResourceErrorCode =
    | 'resource_exhausted'
    | 'memory_leak_detected'
    | 'cleanup_failed'
    | 'disposal_timeout'
    | 'pool_overflow'
    | 'reference_error'
    | 'dependency_failure';

  export type NetworkErrorCode =
    | 'connection_failed'
    | 'timeout'
    | 'asset_load_failed'
    | 'cdn_unavailable'
    | 'bandwidth_insufficient'
    | 'cors_error'
    | 'cache_miss';

  export type MobileErrorCode =
    | 'battery_low'
    | 'thermal_throttling'
    | 'background_restricted'
    | 'audio_session_failed'
    | 'permission_denied'
    | 'hardware_unavailable'
    | 'optimization_failed';

  export type ValidationErrorCode =
    | 'invalid_config'
    | 'missing_parameter'
    | 'type_mismatch'
    | 'range_exceeded'
    | 'unsupported_format'
    | 'schema_validation_failed'
    | 'dependency_missing';

  export interface PluginCapabilities {
    supportedSampleRates: number[];
    supportedChannelCounts: number[];
    maxProcessingBlockSize: number;
    supportsAutomation: boolean;
    supportsMIDI: boolean;
    supportsPresets: boolean;
  }

  export interface PluginParameter {
    name: string;
    displayName: string;
    type: ParameterType;
    defaultValue: number;
    minValue: number;
    maxValue: number;
    unit?: string;
    description?: string;
    automatable: boolean;
  }

  export interface PluginAudioContext {
    audioContext: AudioContext;
    sampleRate: number;
    channelCount: number;
    blockSize: number;
    transport: TransportInfo;
  }

  export interface PluginProcessingResult {
    success: boolean;
    processed: boolean;
    latency: number;
    cpuUsage: number;
    error?: Error;
  }

  // Error Types
  export interface ErrorContext {
    component: string;
    operation: string;
    metadata: Record<string, any>;
    timestamp: number;
    stackTrace?: string;
    userAgent?: string;
    audioContextState?: AudioContextState;
    performanceMetrics?: AudioPerformanceMetrics;
  }

  export interface ClassifiedError {
    originalError: Error;
    category: ErrorCategory;
    severity: ErrorSeverity;
    code: string;
    context: ErrorContext;
    recoverable: boolean;
    userFriendlyMessage: string;
    technicalDetails: string;
  }

  export interface RecoveryResult {
    success: boolean;
    strategy: RecoveryStrategy;
    duration: number;
    fallbackApplied: boolean;
    error?: Error;
  }

  // Worker Types
  export interface WorkerJobResult {
    success: boolean;
    result: any;
    error?: Error;
    duration: number;
  }

  export interface WorkerPoolMetrics {
    totalWorkers: number;
    activeWorkers: number;
    idleWorkers: number;
    queuedJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageJobDuration: number;
  }

  // A/B Testing Types
  export interface ExperimentConfig {
    name: string;
    description: string;
    category: OptimizationCategory;
    variants: ExperimentVariant[];
    successCriteria: SuccessCriteria;
    targeting: ExperimentTargeting;
    rollbackConditions: RollbackCondition[];
  }

  export interface ExperimentVariant {
    id: string;
    name: string;
    description: string;
    weight: number;
    config: AudioOptimizationConfig;
  }

  export interface ExperimentAnalysis {
    experimentId: string;
    status: ExperimentStatus;
    participants: number;
    significance: number;
    confidence: number;
    winningVariant?: string;
    metrics: ExperimentMetrics;
    recommendations: ExperimentRecommendation[];
  }

  export interface ExperimentResult {
    experimentId: string;
    winningVariant: string;
    improvement: number;
    significance: number;
    confidence: number;
    duration: number;
    participants: number;
  }

  // State Persistence Types
  export interface PersistenceConfig {
    enabled: boolean;
    autoSave: boolean;
    autoSaveInterval: number;
    compression: boolean;
    encryption: boolean;
    maxStorageSize: number;
    retentionDays: number;
  }

  export interface PersistedState {
    key: string;
    data: any;
    metadata: StateMetadata;
    timestamp: number;
    version: string;
    checksum: string;
  }

  export interface StorageQuota {
    usage: number;
    quota: number;
    available: number;
    percentage: number;
  }

  export interface PersistenceMetrics {
    totalSaves: number;
    totalLoads: number;
    averageSaveTime: number;
    averageLoadTime: number;
    compressionRatio: number;
    errorRate: number;
  }

  // Battery Management Types
  export interface BatteryUsageMetrics {
    currentLevel: number;
    isCharging: boolean;
    chargingTime: number;
    dischargingTime: number;
    usageRate: number;
    estimatedPlaytime: number;
    impactPercentage: number;
  }

  export interface BatteryOptimizationSuggestion {
    type: OptimizationType;
    priority: Priority;
    description: string;
    expectedSaving: number;
    impactOnQuality: QualityImpact;
    autoApply: boolean;
  }

  export interface PowerManagementSettings {
    enablePowerSaver: boolean;
    lowBatteryThreshold: number;
    criticalBatteryThreshold: number;
    adaptiveQuality: boolean;
    backgroundProcessing: boolean;
    wakeLocksEnabled: boolean;
  }

  // ============================================================================
  // ENUMS - Type definitions for external use
  // ============================================================================

  export enum PlaybackStatus {
    Uninitialized = 'uninitialized',
    Initializing = 'initializing',
    Ready = 'ready',
    Playing = 'playing',
    Paused = 'paused',
    Stopped = 'stopped',
    Error = 'error',
    Disposed = 'disposed',
  }

  export enum AudioSourceType {
    MidiFile = 'midi-file',
    AudioFile = 'audio-file',
    ToneInstrument = 'tone-instrument',
    Microphone = 'microphone',
    NetworkStream = 'network-stream',
  }

  export enum ErrorSeverity {
    Low = 'low',
    Medium = 'medium',
    High = 'high',
    Critical = 'critical',
  }

  export enum ErrorCategory {
    AudioContext = 'audio-context',
    Performance = 'performance',
    Resource = 'resource',
    Network = 'network',
    Mobile = 'mobile',
    Validation = 'validation',
    Plugin = 'plugin',
    State = 'state',
  }

  export enum ResourceType {
    AudioBuffer = 'audio_buffer',
    AudioContext = 'audio_context',
    ToneInstrument = 'tone_instrument',
    ToneEffect = 'tone_effect',
    WorkerThread = 'worker_thread',
    AudioWorklet = 'audio_worklet',
    SharedBuffer = 'shared_buffer',
    CanvasContext = 'canvas_context',
    MediaStream = 'media_stream',
    FileHandle = 'file_handle',
    NetworkConnection = 'network_connection',
    EventListener = 'event_listener',
    TimerHandle = 'timer_handle',
    AnimationFrame = 'animation_frame',
    Observer = 'observer',
    Subscription = 'subscription',
    WebGLContext = 'webgl_context',
    WebSocket = 'websocket',
    ServiceWorker = 'service_worker',
  }

  export enum ResourcePriority {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low',
    Disposable = 'disposable',
  }

  export enum ResourceState {
    Initializing = 'initializing',
    Active = 'active',
    Idle = 'idle',
    Disposed = 'disposed',
    Leaked = 'leaked',
  }

  export enum CleanupStrategy {
    Immediate = 'immediate',
    Deferred = 'deferred',
    Batch = 'batch',
    Graceful = 'graceful',
    Forced = 'forced',
  }

  export enum PluginCategory {
    Instrument = 'instrument',
    Effect = 'effect',
    Analyzer = 'analyzer',
    Generator = 'generator',
    Filter = 'filter',
    Utility = 'utility',
  }

  export enum PluginPriority {
    Realtime = 'realtime',
    High = 'high',
    Normal = 'normal',
    Low = 'low',
    Background = 'background',
  }

  export enum PluginState {
    Unloaded = 'unloaded',
    Loading = 'loading',
    Loaded = 'loaded',
    Active = 'active',
    Inactive = 'inactive',
    Error = 'error',
  }

  export enum DeviceClass {
    HighEnd = 'high-end',
    MidRange = 'mid-range',
    LowEnd = 'low-end',
    Unknown = 'unknown',
  }

  export enum QualityLevel {
    High = 'high',
    Medium = 'medium',
    Low = 'low',
  }

  export enum PowerMode {
    Performance = 'performance',
    Balanced = 'balanced',
    PowerSaver = 'power-saver',
  }

  export enum ThermalState {
    Normal = 'normal',
    Fair = 'fair',
    Serious = 'serious',
    Critical = 'critical',
  }

  export enum WorkerThreadType {
    Sequencer = 'sequencer',
    AudioProcessor = 'audio-processor',
    EffectsProcessor = 'effects-processor',
    Analyzer = 'analyzer',
  }

  export enum JobPriority {
    High = 'high',
    Medium = 'medium',
    Low = 'low',
  }

  export enum GCStrategy {
    Aggressive = 'aggressive',
    Balanced = 'balanced',
    Conservative = 'conservative',
    Manual = 'manual',
  }

  export enum GCTrigger {
    IdleDetection = 'idle_detection',
    MemoryPressure = 'memory_pressure',
    Scheduled = 'scheduled',
    Manual = 'manual',
    Critical = 'critical',
  }

  export enum DisposalStrategy {
    Immediate = 'immediate',
    Graceful = 'graceful',
    Batch = 'batch',
    Deferred = 'deferred',
  }

  export enum FadeType {
    Linear = 'linear',
    Exponential = 'exponential',
    Logarithmic = 'logarithmic',
    Sine = 'sine',
    Cosine = 'cosine',
  }

  export enum AudioResourceType {
    ToneInstrument = 'tone_instrument',
    ToneEffect = 'tone_effect',
    AudioBuffer = 'audio_buffer',
    AudioNode = 'audio_node',
    MediaElement = 'media_element',
    Oscillator = 'oscillator',
    GainNode = 'gain_node',
    AnalyzerNode = 'analyzer_node',
    ConvolverNode = 'convolver_node',
    DelayNode = 'delay_node',
    CompressorNode = 'compressor_node',
    FilterNode = 'filter_node',
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

  export enum Priority {
    Critical = 'critical',
    High = 'high',
    Medium = 'medium',
    Low = 'low',
    Optional = 'optional',
  }

  export enum OptimizationType {
    BufferSize = 'buffer-size',
    Quality = 'quality',
    Polyphony = 'polyphony',
    EffectsProcessing = 'effects-processing',
    BackgroundProcessing = 'background-processing',
    NetworkOptimization = 'network-optimization',
  }

  export enum QualityImpact {
    None = 'none',
    Minimal = 'minimal',
    Low = 'low',
    Medium = 'medium',
    High = 'high',
    Significant = 'significant',
  }

  export enum OptimizationCategory {
    Performance = 'performance',
    Battery = 'battery',
    Quality = 'quality',
    Latency = 'latency',
    Memory = 'memory',
    Network = 'network',
  }

  // Additional missing interfaces
  export interface SuccessCriteria {
    primaryMetric: string;
    targetImprovement: number;
    minimumSampleSize: number;
    significanceLevel: number;
    maximumDuration: number;
  }

  export interface ExperimentTargeting {
    deviceTypes: DeviceClass[];
    platforms: string[];
    userSegments: string[];
    geographicRegions: string[];
    trafficPercentage: number;
  }

  export interface RollbackCondition {
    metric: string;
    threshold: number;
    operator: 'greater_than' | 'less_than' | 'equals';
    duration: number;
    severity: 'warning' | 'critical';
  }

  export interface ExperimentMetrics {
    [key: string]: {
      mean: number;
      variance: number;
      sampleSize: number;
      confidence: number;
    };
  }

  export interface ExperimentRecommendation {
    type: 'continue' | 'stop' | 'extend' | 'modify';
    confidence: number;
    reasoning: string;
    suggestedActions: string[];
  }

  export interface AudioOptimizationConfig {
    bufferSize?: number;
    sampleRate?: number;
    polyphonyLimit?: number;
    qualityLevel?: QualityLevel;
    enabledEffects?: string[];
    compressionLevel?: number;
  }

  export interface ExperimentStatus {
    draft: 'draft';
    running: 'running';
    paused: 'paused';
    completed: 'completed';
    cancelled: 'cancelled';
  }

  // ============================================================================
  // CONSTANTS - Configuration defaults and feature flags
  // ============================================================================

  export const DEFAULT_AUDIO_CONFIG: CoreAudioEngineConfig;
  export const DEFAULT_MOBILE_CONFIG: MobileAudioConfig;
  export const DEFAULT_BUFFER_SIZES: readonly number[];
  export const DEFAULT_SAMPLE_RATES: readonly number[];

  export const PERFORMANCE_THRESHOLDS: {
    readonly maxLatency: number;
    readonly maxCpuUsage: number;
    readonly maxMemoryUsage: number;
    readonly maxAudioDropouts: number;
    readonly maxBatteryImpact: number;
  };

  export const LATENCY_TARGETS: {
    readonly interactive: number;
    readonly balanced: number;
    readonly playback: number;
  };

  export const PLUGIN_CATEGORIES: readonly PluginCategory[];
  export const PLUGIN_PRIORITIES: readonly PluginPriority[];

  export const ERROR_CODES: {
    readonly [key: string]: string;
  };

  export const SUPPORTED_AUDIO_FORMATS: readonly string[];
  export const MIME_TYPE_MAPPINGS: Readonly<Record<string, string>>;

  export const TIMING_CONSTANTS: {
    readonly lookAheadTime: number;
    readonly scheduleInterval: number;
    readonly noteLength: number;
  };

  export const DEVICE_LIMITS: {
    readonly [key in DeviceClass]: {
      readonly maxPolyphony: number;
      readonly maxBufferSize: number;
      readonly maxConcurrentWorkers: number;
    };
  };

  export const FEATURE_FLAGS: {
    readonly experimentalFeatures: boolean;
    readonly debugMode: boolean;
    readonly performanceLogging: boolean;
    readonly errorReporting: boolean;
  };

  export const MIN_BROWSER_VERSIONS: {
    readonly chrome: number;
    readonly firefox: number;
    readonly safari: number;
    readonly edge: number;
  };

  export const WEB_AUDIO_FEATURES: readonly string[];

  // ============================================================================
  // VERSION AND COMPATIBILITY
  // ============================================================================

  export const PLAYBACK_DOMAIN_VERSION: '2.1.0';

  export const SUPPORTED_FEATURES: readonly [
    'web-audio-api',
    'tone-js-integration',
    'plugin-architecture',
    'performance-monitoring',
    'error-recovery',
    'mobile-optimization',
    'tree-shaking',
  ];

  export type SupportedFeature = (typeof SUPPORTED_FEATURES)[number];

  // ============================================================================
  // STORE TYPES - Zustand state management
  // ============================================================================

  export interface PlaybackStore {
    // Engine state
    engine: CoreAudioEngine | null;
    state: PlaybackState;
    isInitialized: boolean;

    // Performance monitoring
    performanceMetrics: AudioPerformanceMetrics;
    performanceAlerts: PerformanceAlert[];

    // Error management
    errors: PlaybackError[];
    lastError: PlaybackError | null;

    // Resource management
    resourceUsage: ResourceUsageReport | null;
    memoryLeaks: SuspectedLeak[];

    // Plugin management
    activePlugins: AudioPlugin[];
    availablePlugins: AudioPlugin[];

    // Actions
    initialize: (config?: Partial<CoreAudioEngineConfig>) => Promise<void>;
    play: () => Promise<void>;
    pause: () => Promise<void>;
    stop: () => Promise<void>;
    dispose: () => Promise<void>;

    // Configuration
    updateConfig: (config: Partial<CoreAudioEngineConfig>) => void;

    // Error handling
    clearErrors: () => void;
    reportError: (error: PlaybackError) => void;

    // Performance
    updatePerformanceMetrics: (metrics: AudioPerformanceMetrics) => void;
    addPerformanceAlert: (alert: PerformanceAlert) => void;
    clearPerformanceAlerts: () => void;

    // Resource management
    updateResourceUsage: (usage: ResourceUsageReport) => void;
    updateMemoryLeaks: (leaks: SuspectedLeak[]) => void;

    // Plugin management
    registerPlugin: (plugin: AudioPlugin) => Promise<void>;
    unregisterPlugin: (pluginId: string) => Promise<void>;
    activatePlugin: (pluginId: string) => Promise<void>;
    deactivatePlugin: (pluginId: string) => Promise<void>;
  }

  // ============================================================================
  // BACKWARD COMPATIBILITY - Epic 2 transition
  // ============================================================================

  /**
   * @deprecated Use CoreAudioEngine instead
   * This alias is provided for backward compatibility during Epic 2 transition
   */
  export const CorePlaybackEngine: typeof CoreAudioEngine;

  // ============================================================================
  // LAZY LOADING - Optional features
  // ============================================================================

  export const LazyImports: {
    readonly loadDevTools: () => Promise<null>;
    readonly loadTestUtils: () => Promise<null>;
  };
}

// ============================================================================
// AMBIENT MODULE DECLARATIONS - Global augmentations
// ============================================================================

declare global {
  interface Window {
    __BASSNOTION_PLAYBACK_DEBUG__?: boolean;
    __BASSNOTION_PLAYBACK_VERSION__?: string;
  }

  interface Performance {
    memory?: {
      usedJSHeapSize: number;
      totalJSHeapSize: number;
      jsHeapSizeLimit: number;
    };
  }

  interface Navigator {
    getBattery?: () => Promise<BatteryManager>;
    deviceMemory?: number;
    hardwareConcurrency?: number;
  }

  interface BatteryManager extends EventTarget {
    charging: boolean;
    chargingTime: number;
    dischargingTime: number;
    level: number;
    onchargingchange: ((this: BatteryManager, ev: Event) => any) | null;
    onchargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
    ondischargingtimechange: ((this: BatteryManager, ev: Event) => any) | null;
    onlevelchange: ((this: BatteryManager, ev: Event) => any) | null;
  }
}

// ============================================================================
// MODULE AUGMENTATION - Tone.js extensions
// ============================================================================

declare module 'tone' {
  interface Transport {
    scheduleRepeat(
      callback: (time: number) => void,
      interval: string | number,
      startTime?: string | number,
    ): number;

    clear(eventId: number): Transport;
  }

  interface Context {
    lookAhead: number;
    latencyHint: AudioContextLatencyCategory;
    updateInterval: number;
  }
}

export {};
