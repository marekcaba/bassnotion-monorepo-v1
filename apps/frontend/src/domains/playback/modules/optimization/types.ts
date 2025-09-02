/**
 * Performance Optimization Types
 * 
 * Type definitions for comprehensive performance optimization system
 * including device capabilities, quality settings, and metrics.
 */

// Device capability detection
export interface DeviceCapabilities {
  cpu: {
    cores: number;
    architecture: string;
    performance: 'low' | 'medium' | 'high' | 'ultra';
  };
  memory: {
    total: number; // MB
    available: number; // MB
    usage: number; // percentage
  };
  audio: {
    sampleRate: number;
    bufferSize: number;
    latency: number; // ms
    channels: number;
  };
  network: {
    type: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
    speed: 'slow' | 'medium' | 'fast' | 'ultra';
    latency: number; // ms
    bandwidth: number; // Mbps
  };
  battery: {
    level: number; // percentage
    charging: boolean;
    temperature: number; // celsius
  };
  platform: 'desktop' | 'mobile' | 'tablet' | 'embedded';
}

export interface NetworkCapabilities {
  connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  downlink: number; // Mbps
  rtt: number; // ms
  effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | '5g';
}

// Quality and optimization configuration
export interface QualitySettings {
  audio: {
    sampleRate: number;
    bitDepth: number;
    bufferSize: number;
    compression: 'none' | 'low' | 'medium' | 'high';
  };
  instruments: {
    polyphony: number;
    velocityLayers: number;
    roundRobinSamples: number;
    reverbQuality: 'off' | 'low' | 'medium' | 'high';
  };
  processing: {
    humanization: boolean;
    microTiming: boolean;
    advancedArticulation: boolean;
    contextAnalysis: boolean;
  };
  visual: {
    frameRate: number;
    animations: boolean;
    effects: 'minimal' | 'standard' | 'enhanced';
  };
}

export interface InstrumentOptimizationConfig {
  instrument: 'bass' | 'drums' | 'chords' | 'metronome';
  quality: 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
  cacheStrategy: 'memory' | 'hybrid' | 'progressive' | 'intelligent';
  compressionLevel: 'none' | 'light' | 'medium' | 'aggressive';
  priorityScheme: 'frequency' | 'musical_context' | 'user_preference' | 'adaptive';
}

// Instrument-specific optimization strategies
export interface BassOptimizationStrategy {
  noteRange: { low: string; high: string };
  velocityLayers: number;
  roundRobinSamples: number;
  sustainSamples: boolean;
  palmMuteSamples: boolean;
  harmonics: boolean;
  fretNoiseReduction: boolean;
  stringOptimization: boolean;
}

export interface DrumOptimizationStrategy {
  kitPieces: string[];
  velocityLayers: number;
  roomSamples: boolean;
  closeMics: boolean;
  overheads: boolean;
  ambientTails: boolean;
  bleedReduction: boolean;
  fillOptimization: boolean;
}

export interface ChordOptimizationStrategy {
  voicingTypes: string[];
  inversionHandling: boolean;
  voiceLeading: boolean;
  dynamicVoicing: boolean;
  polyphonyLimit: number;
  sustainPedal: boolean;
  harmonicContent: boolean;
  layerBlending: boolean;
}

export interface MetronomeOptimizationStrategy {
  clickTypes: string[];
  accentHandling: boolean;
  subdivisionClicks: boolean;
  visualSync: boolean;
  latencyCompensation: boolean;
  tempoAdaptation: boolean;
  userCustomization: boolean;
  minimalMode: boolean;
}

// Performance metrics and monitoring
export interface PerformanceMetrics {
  audio: {
    latency: number; // ms
    dropouts: number;
    cpuUsage: number; // percentage
    memoryUsage: number; // MB
  };
  system: {
    frameRate: number;
    batteryDrain: number; // mAh/hour
    temperature: number; // celsius
    networkUsage: number; // MB/hour
  };
  quality: {
    score: number; // 0-100
    stability: number; // 0-100
    efficiency: number; // 0-100
  };
  benchmarks: {
    initializationTime: number; // ms
    processingTime: number; // ms
    memoryFootprint: number; // MB
    throughput: number; // events/second
  };
}

export interface OptimizationMetrics {
  loadTime: number;
  memoryUsage: number;
  cacheHitRate: number;
  qualityScore: number;
  userSatisfaction: number;
  performanceImpact: number;
  networkUsage: number;
  batteryImpact: number;
}

// Asset cache management
export interface AssetCacheEntry {
  asset: any; // AssetLoadResult from original
  priority: number;
  frequency: number;
  lastUsed: number;
  quality: string;
  compressionRatio: number;
  optimizedVersions: Map<string, any>;
  preloadReady: boolean;
}

// Results and validation
export interface OptimizationResult {
  success: boolean;
  optimizationTime: number;
  performanceGain: number;
  qualityImpact: number;
  recommendations: string[];
  appliedOptimizations: string[];
}

export interface BenchmarkResult {
  testName: string;
  duration: number;
  score: number;
  metrics: PerformanceMetrics;
  passed: boolean;
  details: string;
}

export interface ValidationResult {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  score: number;
  issues: string[];
  recommendations: string[];
}

// Mobile optimization
export interface MobileOptimizationResult {
  performanceGain: number;
  qualityImpact: number;
  recommendations: string[];
  appliedOptimizations: string[];
}

// Interfaces for optimization components
export interface IInstrumentAssetOptimizer {
  configureInstrumentOptimization(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    config: InstrumentOptimizationConfig
  ): void;
  setDeviceCapabilities(capabilities: DeviceCapabilities): void;
  setNetworkCapabilities(capabilities: NetworkCapabilities): void;
  optimizeAssetLoading(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    assets: string[]
  ): Promise<any[]>;
  getOptimizationMetrics(instrument: string): OptimizationMetrics | null;
  getOptimizationStatus(): {
    totalCachedAssets: number;
    cacheMemoryUsage: number;
    averageCacheHitRate: number;
    optimizedInstruments: string[];
  };
  clearCache(): void;
}

export interface IPerformanceOptimizer {
  initialize(): Promise<void>;
  adaptQualityToDevice(): Promise<OptimizationResult>;
  optimizeForMobile(): Promise<OptimizationResult>;
  runBenchmarks(): Promise<BenchmarkResult[]>;
  startRealTimeMonitoring(): void;
  stopRealTimeMonitoring(): void;
  validateProductionReadiness(): Promise<ValidationResult[]>;
  runRegressionTests(): Promise<BenchmarkResult[]>;
  getCurrentMetrics(): PerformanceMetrics;
  getOptimizationHistory(): OptimizationResult[];
  getDeviceCapabilities(): DeviceCapabilities;
  getCurrentQualitySettings(): QualitySettings;
  getQualityRecommendations(): string[];
  isInitialized(): boolean;
  dispose(): Promise<void>;
}

export interface IAdaptiveQualityScaler {
  calculateOptimalSettings(capabilities: DeviceCapabilities): Promise<QualitySettings>;
  getRecommendations(): string[];
  dispose(): Promise<void>;
}

export interface IMobileOptimizer {
  optimize(
    capabilities: DeviceCapabilities,
    settings: QualitySettings
  ): Promise<MobileOptimizationResult>;
  dispose(): Promise<void>;
}

export interface IQualityMonitor {
  start(capabilities: DeviceCapabilities, settings: QualitySettings): void;
  stop(): void;
  dispose(): Promise<void>;
}