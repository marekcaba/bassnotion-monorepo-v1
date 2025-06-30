/**
 * InstrumentAssetOptimizer - Task 7.3
 *
 * Implements instrument-specific asset optimization and caching strategies
 * for bass samples, drum hits, and MIDI files with performance tuning.
 *
 * Part of Story 2.2: Task 7, Subtask 7.3
 */

import { AssetManager } from '../AssetManager.js';
import type {
  AssetLoadResult,
  DeviceCapabilities,
  NetworkCapabilities,
} from '../../types/audio.js';

export interface InstrumentOptimizationConfig {
  instrument: 'bass' | 'drums' | 'chords' | 'metronome';
  quality: 'minimal' | 'low' | 'medium' | 'high' | 'ultra';
  cacheStrategy: 'memory' | 'hybrid' | 'progressive' | 'intelligent';
  compressionLevel: 'none' | 'light' | 'medium' | 'aggressive';
  priorityScheme:
    | 'frequency'
    | 'musical_context'
    | 'user_preference'
    | 'adaptive';
}

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

export interface AssetCacheEntry {
  asset: AssetLoadResult;
  priority: number;
  frequency: number;
  lastUsed: number;
  quality: string;
  compressionRatio: number;
  optimizedVersions: Map<string, AssetLoadResult>;
  preloadReady: boolean;
}

export class InstrumentAssetOptimizer {
  private assetManager: AssetManager;
  private optimizationConfigs: Map<string, InstrumentOptimizationConfig> =
    new Map();
  private assetCache: Map<string, AssetCacheEntry> = new Map();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private networkCapabilities: NetworkCapabilities | null = null;
  private performanceMetrics: Map<string, OptimizationMetrics> = new Map();

  // Optimization strategies for each instrument
  // TODO: Review non-null assertion - consider null safety
  private bassStrategy!: BassOptimizationStrategy;
  // TODO: Review non-null assertion - consider null safety
  private drumStrategy!: DrumOptimizationStrategy;
  // TODO: Review non-null assertion - consider null safety
  private chordStrategy!: ChordOptimizationStrategy;
  // TODO: Review non-null assertion - consider null safety
  private metronomeStrategy!: MetronomeOptimizationStrategy;

  constructor() {
    this.assetManager = AssetManager.getInstance();
    this.initializeOptimizationStrategies();
  }

  /**
   * Initialize default optimization strategies for each instrument
   */
  private initializeOptimizationStrategies(): void {
    this.bassStrategy = {
      noteRange: { low: 'B0', high: 'G4' },
      velocityLayers: 6,
      roundRobinSamples: 3,
      sustainSamples: true,
      palmMuteSamples: true,
      harmonics: false, // Disabled by default for performance
      fretNoiseReduction: true,
      stringOptimization: true,
    };

    this.drumStrategy = {
      kitPieces: [
        'kick',
        'snare',
        'hihat_closed',
        'hihat_open',
        'crash',
        'ride',
      ],
      velocityLayers: 4,
      roomSamples: false, // Disabled by default for performance
      closeMics: true,
      overheads: false,
      ambientTails: true,
      bleedReduction: true,
      fillOptimization: true,
    };

    this.chordStrategy = {
      voicingTypes: ['close', 'open', 'spread'],
      inversionHandling: true,
      voiceLeading: true,
      dynamicVoicing: false, // Disabled by default for performance
      polyphonyLimit: 8,
      sustainPedal: true,
      harmonicContent: true,
      layerBlending: false,
    };

    this.metronomeStrategy = {
      clickTypes: ['wood', 'electronic', 'accent'],
      accentHandling: true,
      subdivisionClicks: false,
      visualSync: true,
      latencyCompensation: true,
      tempoAdaptation: true,
      userCustomization: false,
      minimalMode: true,
    };
  }

  /**
   * Configure optimization for a specific instrument
   */
  public configureInstrumentOptimization(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    config: InstrumentOptimizationConfig,
  ): void {
    console.log(`🎯 Configuring optimization for ${instrument}:`, config);

    this.optimizationConfigs.set(instrument, config);

    // Apply device-specific optimizations
    if (this.deviceCapabilities) {
      this.applyDeviceOptimizations(instrument, config);
    }

    // Apply network-specific optimizations
    if (this.networkCapabilities) {
      this.applyNetworkOptimizations(instrument, config);
    }
  }

  /**
   * Set device capabilities for optimization decisions
   */
  public setDeviceCapabilities(capabilities: DeviceCapabilities): void {
    this.deviceCapabilities = capabilities;
    console.log('📱 Device capabilities updated:', {
      deviceClass: capabilities.deviceClass,
      memoryGB: capabilities.memoryGB,
      maxPolyphony: capabilities.maxPolyphony,
    });

    // Reconfigure all instruments based on device capabilities
    this.optimizationConfigs.forEach((config, instrument) => {
      this.applyDeviceOptimizations(instrument as any, config);
    });
  }

  /**
   * Set network capabilities for optimization decisions
   */
  public setNetworkCapabilities(capabilities: NetworkCapabilities): void {
    this.networkCapabilities = capabilities;
    console.log('🌐 Network capabilities updated:', {
      connectionType: capabilities.connectionType,
      downlink: capabilities.downlink,
      rtt: capabilities.rtt,
    });

    // Reconfigure all instruments based on network capabilities
    this.optimizationConfigs.forEach((config, instrument) => {
      this.applyNetworkOptimizations(instrument as any, config);
    });
  }

  /**
   * Apply device-specific optimizations
   */
  private applyDeviceOptimizations(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    _config: InstrumentOptimizationConfig,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.deviceCapabilities) return;

    const { deviceClass, memoryGB, maxPolyphony } = this.deviceCapabilities;

    switch (instrument) {
      case 'bass':
        this.optimizeBassForDevice(deviceClass, memoryGB);
        break;
      case 'drums':
        this.optimizeDrumsForDevice(deviceClass, memoryGB);
        break;
      case 'chords':
        this.optimizeChordsForDevice(deviceClass, maxPolyphony);
        break;
      case 'metronome':
        this.optimizeMetronomeForDevice(deviceClass);
        break;
    }
  }

  /**
   * Optimize bass settings for device capabilities
   */
  private optimizeBassForDevice(deviceClass: string, memoryGB: number): void {
    switch (deviceClass) {
      case 'low-end':
        this.bassStrategy.velocityLayers = 3;
        this.bassStrategy.roundRobinSamples = 1;
        this.bassStrategy.palmMuteSamples = false;
        this.bassStrategy.harmonics = false;
        break;
      case 'mid-range':
        this.bassStrategy.velocityLayers = 4;
        this.bassStrategy.roundRobinSamples = 2;
        this.bassStrategy.palmMuteSamples = memoryGB > 4;
        break;
      case 'high-end':
      case 'premium':
        this.bassStrategy.velocityLayers = 6;
        this.bassStrategy.roundRobinSamples = 3;
        this.bassStrategy.palmMuteSamples = true;
        this.bassStrategy.harmonics = memoryGB > 6;
        break;
    }
  }

  /**
   * Optimize drum settings for device capabilities
   */
  private optimizeDrumsForDevice(deviceClass: string, memoryGB: number): void {
    switch (deviceClass) {
      case 'low-end':
        this.drumStrategy.velocityLayers = 2;
        this.drumStrategy.roomSamples = false;
        this.drumStrategy.overheads = false;
        this.drumStrategy.ambientTails = false;
        break;
      case 'mid-range':
        this.drumStrategy.velocityLayers = 3;
        this.drumStrategy.roomSamples = false;
        this.drumStrategy.overheads = memoryGB > 4;
        break;
      case 'high-end':
      case 'premium':
        this.drumStrategy.velocityLayers = 4;
        this.drumStrategy.roomSamples = memoryGB > 6;
        this.drumStrategy.overheads = true;
        break;
    }
  }

  /**
   * Optimize chord settings for device capabilities
   */
  private optimizeChordsForDevice(
    deviceClass: string,
    maxPolyphony: number,
  ): void {
    switch (deviceClass) {
      case 'low-end':
        this.chordStrategy.polyphonyLimit = Math.min(4, maxPolyphony);
        this.chordStrategy.dynamicVoicing = false;
        this.chordStrategy.layerBlending = false;
        break;
      case 'mid-range':
        this.chordStrategy.polyphonyLimit = Math.min(6, maxPolyphony);
        this.chordStrategy.dynamicVoicing = false;
        break;
      case 'high-end':
      case 'premium':
        this.chordStrategy.polyphonyLimit = Math.min(8, maxPolyphony);
        this.chordStrategy.dynamicVoicing = true;
        this.chordStrategy.layerBlending = true;
        break;
    }
  }

  /**
   * Optimize metronome settings for device capabilities
   */
  private optimizeMetronomeForDevice(deviceClass: string): void {
    switch (deviceClass) {
      case 'low-end':
        this.metronomeStrategy.subdivisionClicks = false;
        this.metronomeStrategy.userCustomization = false;
        this.metronomeStrategy.minimalMode = true;
        break;
      case 'mid-range':
        this.metronomeStrategy.subdivisionClicks = false;
        this.metronomeStrategy.userCustomization = true;
        break;
      case 'high-end':
      case 'premium':
        this.metronomeStrategy.subdivisionClicks = true;
        this.metronomeStrategy.userCustomization = true;
        this.metronomeStrategy.minimalMode = false;
        break;
    }
  }

  /**
   * Apply network-specific optimizations
   */
  private applyNetworkOptimizations(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    config: InstrumentOptimizationConfig,
  ): void {
    // TODO: Review non-null assertion - consider null safety
    if (!this.networkCapabilities) return;

    const { connectionType, downlink } = this.networkCapabilities;

    // Adjust compression based on network speed
    if (downlink < 1) {
      // < 1 Mbps
      config.compressionLevel = 'aggressive';
      config.quality = 'minimal';
    } else if (downlink < 5) {
      // < 5 Mbps
      config.compressionLevel = 'medium';
      config.quality = 'low';
    } else if (downlink < 25) {
      // < 25 Mbps
      config.compressionLevel = 'light';
      config.quality = 'medium';
    } else {
      config.compressionLevel = 'none';
      config.quality = 'high';
    }

    // Adjust caching strategy based on connection type
    if (connectionType === 'wifi' || connectionType === 'ethernet') {
      config.cacheStrategy = 'progressive';
    } else if (connectionType === '4g' || connectionType === '5g') {
      config.cacheStrategy = 'intelligent';
    } else {
      config.cacheStrategy = 'memory';
    }

    console.log(`🌐 Network optimization applied for ${instrument}:`, {
      quality: config.quality,
      compression: config.compressionLevel,
      cacheStrategy: config.cacheStrategy,
    });
  }

  /**
   * Optimize asset loading for specific instrument
   */
  public async optimizeAssetLoading(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    assets: string[],
  ): Promise<AssetLoadResult[]> {
    const config = this.optimizationConfigs.get(instrument);
    // TODO: Review non-null assertion - consider null safety
    if (!config) {
      throw new Error(`No optimization configuration found for ${instrument}`);
    }

    const strategy = this.getInstrumentStrategy(instrument);
    console.log(`🎯 Optimizing asset loading for ${instrument}:`, {
      assetCount: assets.length,
      strategy,
    });

    const startTime = performance.now();
    const optimizedAssets: AssetLoadResult[] = [];

    // Load and optimize each asset
    for (const assetUrl of assets) {
      try {
        const optimizedAsset = await this.loadOptimizedAsset(
          assetUrl,
          instrument,
          config,
        );
        optimizedAssets.push(optimizedAsset);

        // Cache the optimized asset after loading
        this.cacheOptimizedAsset(assetUrl, optimizedAsset, instrument);
      } catch (error) {
        console.error(`Failed to optimize asset ${assetUrl}:`, error);
        // Continue with other assets on failure
      }
    }

    const totalLoadTime = performance.now() - startTime;

    // Calculate cache hit rate AFTER all cache operations are complete
    const cacheHitRate = this.calculateCacheHitRate(instrument);

    // Calculate and update performance metrics with the correct cache hit rate
    const metrics: OptimizationMetrics = {
      loadTime: totalLoadTime,
      memoryUsage: this.calculateMemoryUsage(optimizedAssets),
      cacheHitRate: cacheHitRate,
      qualityScore: this.calculateQualityScore(optimizedAssets),
      userSatisfaction: 0.8, // Placeholder - would be based on user feedback
      performanceImpact: totalLoadTime / 1000, // Convert to seconds
      networkUsage: this.calculateNetworkUsage(optimizedAssets),
      batteryImpact: this.estimateBatteryImpact(optimizedAssets),
    };

    this.updatePerformanceMetrics(instrument, metrics);

    console.log(`✅ Asset optimization complete for ${instrument}:`, {
      loadedAssets: optimizedAssets.length,
      totalLoadTime: `${totalLoadTime.toFixed(2)}ms`,
      averageLoadTime: `${(totalLoadTime / optimizedAssets.length).toFixed(2)}ms`,
      cacheHitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
    });

    return optimizedAssets;
  }

  /**
   * Load optimized asset with compression and quality adjustments
   */
  private async loadOptimizedAsset(
    assetUrl: string,
    instrument: string,
    config: InstrumentOptimizationConfig,
  ): Promise<AssetLoadResult> {
    // Check cache first
    const cached = this.assetCache.get(assetUrl);
    if (cached && this.isOptimalQuality(cached, config.quality)) {
      // Cache hit - update usage statistics
      cached.lastUsed = Date.now();
      cached.frequency++;
      console.log(
        `🎯 Cache hit for ${assetUrl}, frequency now: ${cached.frequency}`,
      );
      return cached.asset;
    }

    // Cache miss - load asset with optimization parameters
    console.log(`📥 Loading asset ${assetUrl} from source`);
    const asset = await this.assetManager.loadAsset(assetUrl, 'audio');

    // Apply instrument-specific optimizations
    const optimizedAsset = await this.applyInstrumentSpecificOptimizations(
      asset,
      instrument,
      config,
    );

    return optimizedAsset;
  }

  /**
   * Apply instrument-specific optimizations to loaded asset
   */
  private async applyInstrumentSpecificOptimizations(
    asset: AssetLoadResult,
    instrument: string,
    _config: InstrumentOptimizationConfig,
  ): Promise<AssetLoadResult> {
    let optimizedAsset = { ...asset };

    switch (instrument) {
      case 'bass':
        optimizedAsset = await this.optimizeBassAsset(optimizedAsset);
        break;
      case 'drums':
        optimizedAsset = await this.optimizeDrumAsset(optimizedAsset);
        break;
      case 'chords':
        optimizedAsset = await this.optimizeChordAsset(optimizedAsset);
        break;
      case 'metronome':
        optimizedAsset = await this.optimizeMetronomeAsset(optimizedAsset);
        break;
    }

    return optimizedAsset;
  }

  /**
   * Apply bass-specific optimizations
   */
  private async optimizeBassAsset(
    asset: AssetLoadResult,
  ): Promise<AssetLoadResult> {
    // TODO: Review non-null assertion - consider null safety
    if (!(asset.data instanceof AudioBuffer)) return asset;

    let optimizedBuffer = asset.data;

    // Apply fret noise reduction if enabled
    if (this.bassStrategy.fretNoiseReduction) {
      optimizedBuffer = this.applyNoiseReduction(optimizedBuffer);
    }

    // Apply string optimization if enabled
    if (this.bassStrategy.stringOptimization) {
      optimizedBuffer = this.optimizeForStringInstrument(optimizedBuffer);
    }

    return {
      ...asset,
      data: optimizedBuffer,
    };
  }

  /**
   * Apply drum-specific optimizations
   */
  private async optimizeDrumAsset(
    asset: AssetLoadResult,
  ): Promise<AssetLoadResult> {
    // TODO: Review non-null assertion - consider null safety
    if (!(asset.data instanceof AudioBuffer)) return asset;

    let optimizedBuffer = asset.data;

    // Apply bleed reduction if enabled
    if (this.drumStrategy.bleedReduction) {
      optimizedBuffer = this.applyBleedReduction(optimizedBuffer);
    }

    // Optimize transients for drum hits
    optimizedBuffer = this.optimizeTransients(optimizedBuffer);

    return {
      ...asset,
      data: optimizedBuffer,
    };
  }

  /**
   * Apply chord-specific optimizations
   */
  private async optimizeChordAsset(
    asset: AssetLoadResult,
  ): Promise<AssetLoadResult> {
    // TODO: Review non-null assertion - consider null safety
    if (!(asset.data instanceof AudioBuffer)) return asset;

    let optimizedBuffer = asset.data;

    // Apply harmonic content optimization if enabled
    if (this.chordStrategy.harmonicContent) {
      optimizedBuffer = this.optimizeHarmonicContent(optimizedBuffer);
    }

    return {
      ...asset,
      data: optimizedBuffer,
    };
  }

  /**
   * Apply metronome-specific optimizations
   */
  private async optimizeMetronomeAsset(
    asset: AssetLoadResult,
  ): Promise<AssetLoadResult> {
    // TODO: Review non-null assertion - consider null safety
    if (!(asset.data instanceof AudioBuffer)) return asset;

    let optimizedBuffer = asset.data;

    // Apply latency compensation if enabled
    if (this.metronomeStrategy.latencyCompensation) {
      optimizedBuffer = this.applyLatencyCompensation(optimizedBuffer);
    }

    return {
      ...asset,
      data: optimizedBuffer,
    };
  }

  /**
   * Cache an optimized asset with proper metadata
   */
  private cacheOptimizedAsset(
    assetUrl: string,
    asset: AssetLoadResult,
    instrument: string,
  ): void {
    const existing = this.assetCache.get(assetUrl);
    if (existing) {
      // Asset already exists in cache - this was a cache hit, frequency already updated
      return;
    }

    // New asset - add to cache with initial frequency of 1
    const config = this.optimizationConfigs.get(instrument);
    this.assetCache.set(assetUrl, {
      asset,
      priority: this.calculateAssetPriority(assetUrl, instrument),
      frequency: 1,
      lastUsed: Date.now(),
      quality: config?.quality || 'medium',
      compressionRatio: this.calculateCompressionRatio(asset),
      optimizedVersions: new Map(),
      preloadReady: true,
    });

    // Enforce cache size limits
    this.maintainCacheSize();
  }

  /**
   * Get current optimization strategy for instrument
   */
  private getInstrumentStrategy(instrument: string): any {
    switch (instrument) {
      case 'bass':
        return this.bassStrategy;
      case 'drums':
        return this.drumStrategy;
      case 'chords':
        return this.chordStrategy;
      case 'metronome':
        return this.metronomeStrategy;
      default:
        return {};
    }
  }

  /**
   * Calculate asset priority based on instrument and usage patterns
   */
  private calculateAssetPriority(assetUrl: string, instrument: string): number {
    const cached = this.assetCache.get(assetUrl);
    if (cached) {
      return cached.priority + cached.frequency * 0.1;
    }

    // Base priority for different instruments
    const basePriorities = {
      metronome: 0.9, // Highest priority for timing
      bass: 0.8,
      drums: 0.7,
      chords: 0.6,
    };

    return basePriorities[instrument as keyof typeof basePriorities] || 0.5;
  }

  /**
   * Check if cached asset has optimal quality
   */
  private isOptimalQuality(
    cached: AssetCacheEntry,
    requiredQuality: string,
  ): boolean {
    const qualityLevels = ['minimal', 'low', 'medium', 'high', 'ultra'];
    const cachedIndex = qualityLevels.indexOf(cached.quality);
    const requiredIndex = qualityLevels.indexOf(requiredQuality);

    return cachedIndex >= requiredIndex;
  }

  /**
   * Get optimization metrics for instrument
   */
  public getOptimizationMetrics(
    instrument: string,
  ): OptimizationMetrics | null {
    return this.performanceMetrics.get(instrument) || null;
  }

  /**
   * Get overall optimization status
   */
  public getOptimizationStatus(): {
    totalCachedAssets: number;
    cacheMemoryUsage: number;
    averageCacheHitRate: number;
    optimizedInstruments: string[];
  } {
    const optimizedInstruments = Array.from(this.optimizationConfigs.keys());
    const averageCacheHitRate = this.calculateOverallCacheHitRate();

    return {
      totalCachedAssets: this.assetCache.size,
      cacheMemoryUsage: this.calculateTotalCacheMemoryUsage(),
      averageCacheHitRate,
      optimizedInstruments,
    };
  }

  // Utility methods for optimization calculations
  private updatePerformanceMetrics(
    instrument: string,
    metrics: OptimizationMetrics,
  ): void {
    this.performanceMetrics.set(instrument, metrics);
  }

  private calculateMemoryUsage(assets: AssetLoadResult[]): number {
    return assets.reduce((total, asset) => {
      if (asset.data instanceof AudioBuffer) {
        return total + asset.data.length * asset.data.numberOfChannels * 4; // 4 bytes per float32
      }
      return total + (asset.size || 0);
    }, 0);
  }

  private calculateCacheHitRate(instrument: string): number {
    const instrumentAssets = Array.from(this.assetCache.values()).filter(
      (entry) => this.getAssetInstrument(entry.asset.url) === instrument,
    );

    if (instrumentAssets.length === 0) return 0;

    // Calculate hit rate based on frequency of access
    const totalAccesses = instrumentAssets.reduce(
      (sum, entry) => sum + entry.frequency,
      0,
    );
    const cacheHits = instrumentAssets.reduce(
      (sum, entry) => sum + Math.max(0, entry.frequency - 1),
      0,
    );

    return totalAccesses > 0 ? cacheHits / totalAccesses : 0;
  }

  private calculateQualityScore(assets: AssetLoadResult[]): number {
    // Simplified quality scoring based on compression and loading success
    const successfulAssets = assets.filter((asset) => asset.success !== false);
    return successfulAssets.length / assets.length;
  }

  private calculateNetworkUsage(assets: AssetLoadResult[]): number {
    return assets.reduce((total, asset) => total + (asset.size || 0), 0);
  }

  private estimateBatteryImpact(assets: AssetLoadResult[]): number {
    // Simplified battery impact estimation
    const totalProcessingTime = assets.length * 10; // 10ms per asset
    return totalProcessingTime / 1000; // Convert to seconds
  }

  private calculateCompressionRatio(asset: AssetLoadResult): number {
    // Simplified compression ratio calculation
    return asset.compressionUsed ? 0.6 : 1.0;
  }

  private calculateOverallCacheHitRate(): number {
    const allEntries = Array.from(this.assetCache.values());
    if (allEntries.length === 0) return 0;

    const hits = allEntries.filter((entry) => entry.frequency > 1).length;
    return hits / allEntries.length;
  }

  private calculateTotalCacheMemoryUsage(): number {
    return Array.from(this.assetCache.values()).reduce((total, entry) => {
      return total + this.calculateMemoryUsage([entry.asset]);
    }, 0);
  }

  private getAssetInstrument(assetUrl: string): string {
    if (assetUrl.includes('bass')) {
      return 'bass';
    }
    if (
      assetUrl.includes('drum') ||
      assetUrl.includes('kick') ||
      assetUrl.includes('snare') ||
      assetUrl.includes('hihat') ||
      assetUrl.includes('cymbal') ||
      assetUrl.includes('tom')
    ) {
      return 'drums';
    }
    if (assetUrl.includes('chord')) {
      return 'chords';
    }
    if (assetUrl.includes('click') || assetUrl.includes('metronome')) {
      return 'metronome';
    }
    return 'unknown';
  }

  private maintainCacheSize(): void {
    const maxCacheEntries = 1000; // Configurable limit

    if (this.assetCache.size > maxCacheEntries) {
      // Remove least recently used entries
      const entries = Array.from(this.assetCache.entries()).sort(
        ([, a], [, b]) => a.lastUsed - b.lastUsed,
      );

      const entriesToRemove = entries.slice(
        0,
        this.assetCache.size - maxCacheEntries,
      );
      entriesToRemove.forEach(([url]) => this.assetCache.delete(url));
    }
  }

  // Audio processing utility methods (simplified implementations)
  private applyNoiseReduction(buffer: AudioBuffer): AudioBuffer {
    // Simplified noise reduction - in practice would use more sophisticated DSP
    return buffer;
  }

  private optimizeForStringInstrument(buffer: AudioBuffer): AudioBuffer {
    // Simplified string instrument optimization
    return buffer;
  }

  private applyBleedReduction(buffer: AudioBuffer): AudioBuffer {
    // Simplified bleed reduction for drums
    return buffer;
  }

  private optimizeTransients(buffer: AudioBuffer): AudioBuffer {
    // Simplified transient optimization
    return buffer;
  }

  private optimizeHarmonicContent(buffer: AudioBuffer): AudioBuffer {
    // Simplified harmonic content optimization
    return buffer;
  }

  private applyLatencyCompensation(buffer: AudioBuffer): AudioBuffer {
    // Simplified latency compensation
    return buffer;
  }

  /**
   * Clear all cached assets and reset metrics
   */
  public clearCache(): void {
    this.assetCache.clear();
    this.performanceMetrics.clear();
    console.log('🧹 Asset optimization cache cleared');
  }

  /**
   * Export current optimization settings
   */
  public exportOptimizationSettings(): {
    configs: Record<string, InstrumentOptimizationConfig>;
    strategies: {
      bass: BassOptimizationStrategy;
      drums: DrumOptimizationStrategy;
      chords: ChordOptimizationStrategy;
      metronome: MetronomeOptimizationStrategy;
    };
  } {
    return {
      configs: Object.fromEntries(this.optimizationConfigs),
      strategies: {
        bass: this.bassStrategy,
        drums: this.drumStrategy,
        chords: this.chordStrategy,
        metronome: this.metronomeStrategy,
      },
    };
  }
}
