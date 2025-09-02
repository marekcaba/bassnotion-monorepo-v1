/**
 * Instrument Asset Optimizer
 * 
 * Implements instrument-specific asset optimization and caching strategies
 * for bass, drums, chords, and metronome with performance tuning.
 * Extracted from the original InstrumentAssetOptimizer with all features preserved.
 */

import type {
  DeviceCapabilities,
  NetworkCapabilities,
  InstrumentOptimizationConfig,
  BassOptimizationStrategy,
  DrumOptimizationStrategy,
  ChordOptimizationStrategy,
  MetronomeOptimizationStrategy,
  OptimizationMetrics,
  AssetCacheEntry,
  IInstrumentAssetOptimizer,
} from './types';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('InstrumentAssetOptimizer');

export class InstrumentAssetOptimizer implements IInstrumentAssetOptimizer {
  private static instance: InstrumentAssetOptimizer | null = null;
  
  private optimizationConfigs = new Map<string, InstrumentOptimizationConfig>();
  private assetCache = new Map<string, AssetCacheEntry>();
  private deviceCapabilities: DeviceCapabilities | null = null;
  private networkCapabilities: NetworkCapabilities | null = null;
  private performanceMetrics = new Map<string, OptimizationMetrics>();
  
  // Optimization strategies for each instrument
  private bassStrategy: BassOptimizationStrategy;
  private drumStrategy: DrumOptimizationStrategy;
  private chordStrategy: ChordOptimizationStrategy;
  private metronomeStrategy: MetronomeOptimizationStrategy;
  
  private constructor() {
    this.initializeOptimizationStrategies();
    logger.info('🎯 InstrumentAssetOptimizer initialized');
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(): InstrumentAssetOptimizer {
    if (!InstrumentAssetOptimizer.instance) {
      InstrumentAssetOptimizer.instance = new InstrumentAssetOptimizer();
    }
    return InstrumentAssetOptimizer.instance;
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
      kitPieces: ['kick', 'snare', 'hihat_closed', 'hihat_open', 'crash', 'ride'],
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
  configureInstrumentOptimization(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    config: InstrumentOptimizationConfig
  ): void {
    logger.info(`🎯 Configuring optimization for ${instrument}:`, config);
    
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
  setDeviceCapabilities(capabilities: DeviceCapabilities): void {
    this.deviceCapabilities = capabilities;
    logger.info('📱 Device capabilities updated:', {
      platform: capabilities.platform,
      cpuPerformance: capabilities.cpu.performance,
      memoryGB: Math.round(capabilities.memory.total / 1024),
      batteryLevel: capabilities.battery.level,
    });
    
    // Reconfigure all instruments based on device capabilities
    this.optimizationConfigs.forEach((config, instrument) => {
      this.applyDeviceOptimizations(instrument as any, config);
    });
  }
  
  /**
   * Set network capabilities for optimization decisions
   */
  setNetworkCapabilities(capabilities: NetworkCapabilities): void {
    this.networkCapabilities = capabilities;
    logger.info('🌐 Network capabilities updated:', {
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
   * Optimize asset loading for specific instrument
   */
  async optimizeAssetLoading(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    assets: string[]
  ): Promise<any[]> {
    const config = this.optimizationConfigs.get(instrument);
    if (!config) {
      throw new Error(`No optimization configuration found for ${instrument}`);
    }
    
    const strategy = this.getInstrumentStrategy(instrument);
    logger.info(`🎯 Optimizing asset loading for ${instrument}:`, {
      assetCount: assets.length,
      quality: config.quality,
      cacheStrategy: config.cacheStrategy,
    });
    
    const startTime = performance.now();
    const optimizedAssets: any[] = [];
    
    // Load and optimize each asset
    for (const assetUrl of assets) {
      try {
        const optimizedAsset = await this.loadOptimizedAsset(assetUrl, instrument, config);
        optimizedAssets.push(optimizedAsset);
        
        // Cache the optimized asset
        this.cacheOptimizedAsset(assetUrl, optimizedAsset, instrument);
      } catch (error) {
        logger.error(`Failed to optimize asset ${assetUrl}:`, error);
        // Continue with other assets on failure
      }
    }
    
    const totalLoadTime = performance.now() - startTime;
    
    // Calculate and update performance metrics
    const metrics: OptimizationMetrics = {
      loadTime: totalLoadTime,
      memoryUsage: this.calculateMemoryUsage(optimizedAssets),
      cacheHitRate: this.calculateCacheHitRate(instrument),
      qualityScore: this.calculateQualityScore(optimizedAssets),
      userSatisfaction: 0.8, // Placeholder - would be based on user feedback
      performanceImpact: totalLoadTime / 1000, // Convert to seconds
      networkUsage: this.calculateNetworkUsage(optimizedAssets),
      batteryImpact: this.estimateBatteryImpact(optimizedAssets),
    };
    
    this.performanceMetrics.set(instrument, metrics);
    
    logger.info(`✅ Asset optimization complete for ${instrument}:`, {
      loadedAssets: optimizedAssets.length,
      totalLoadTime: `${totalLoadTime.toFixed(2)}ms`,
      averageLoadTime: `${(totalLoadTime / optimizedAssets.length).toFixed(2)}ms`,
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(1)}%`,
    });
    
    return optimizedAssets;
  }
  
  /**
   * Apply device-specific optimizations
   */
  private applyDeviceOptimizations(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    config: InstrumentOptimizationConfig
  ): void {
    if (!this.deviceCapabilities) return;
    
    const { platform, cpu, memory, battery } = this.deviceCapabilities;
    
    // Determine device class for optimization
    let deviceClass: 'low-end' | 'mid-range' | 'high-end' | 'premium';
    
    if (platform === 'mobile') {
      if (cpu.performance === 'low' || memory.total < 2048) {
        deviceClass = 'low-end';
      } else if (cpu.performance === 'medium' || memory.total < 4096) {
        deviceClass = 'mid-range';
      } else {
        deviceClass = 'high-end';
      }
    } else {
      if (cpu.performance === 'low') {
        deviceClass = 'low-end';
      } else if (cpu.performance === 'medium') {
        deviceClass = 'mid-range';
      } else if (cpu.performance === 'high') {
        deviceClass = 'high-end';
      } else {
        deviceClass = 'premium';
      }
    }
    
    // Apply battery-specific optimizations
    if (platform === 'mobile' && battery.level < 20) {
      deviceClass = 'low-end'; // Force low-end optimizations for low battery
    }
    
    switch (instrument) {
      case 'bass':
        this.optimizeBassForDevice(deviceClass, memory.total);
        break;
      case 'drums':
        this.optimizeDrumsForDevice(deviceClass, memory.total);
        break;
      case 'chords':
        this.optimizeChordsForDevice(deviceClass, this.calculateMaxPolyphony());
        break;
      case 'metronome':
        this.optimizeMetronomeForDevice(deviceClass);
        break;
    }
    
    logger.info(`🔧 Applied ${deviceClass} optimizations for ${instrument}`);
  }
  
  /**
   * Apply network-specific optimizations
   */
  private applyNetworkOptimizations(
    instrument: 'bass' | 'drums' | 'chords' | 'metronome',
    config: InstrumentOptimizationConfig
  ): void {
    if (!this.networkCapabilities) return;
    
    const { connectionType, downlink } = this.networkCapabilities;
    
    // Adjust compression based on network speed
    if (downlink < 1) {
      config.compressionLevel = 'aggressive';
      config.quality = 'minimal';
    } else if (downlink < 5) {
      config.compressionLevel = 'medium';
      config.quality = 'low';
    } else if (downlink < 25) {
      config.compressionLevel = 'light';
      config.quality = 'medium';
    } else {
      config.compressionLevel = 'none';
      config.quality = 'high';
    }
    
    // Adjust caching strategy based on connection type
    if (connectionType === 'wifi' || connectionType === 'ethernet') {
      config.cacheStrategy = 'progressive';
    } else if (connectionType === 'cellular') {
      config.cacheStrategy = 'intelligent';
    } else {
      config.cacheStrategy = 'memory';
    }
    
    logger.info(`🌐 Network optimization applied for ${instrument}:`, {
      quality: config.quality,
      compression: config.compressionLevel,
      cacheStrategy: config.cacheStrategy,
    });
  }
  
  /**
   * Load optimized asset with compression and quality adjustments
   */
  private async loadOptimizedAsset(
    assetUrl: string,
    instrument: string,
    config: InstrumentOptimizationConfig
  ): Promise<any> {
    // Check cache first
    const cached = this.assetCache.get(assetUrl);
    if (cached && this.isOptimalQuality(cached, config.quality)) {
      // Cache hit - update usage statistics
      cached.lastUsed = Date.now();
      cached.frequency++;
      logger.debug(`🎯 Cache hit for ${assetUrl}, frequency: ${cached.frequency}`);
      return cached.asset;
    }
    
    // Cache miss - simulate asset loading
    logger.info(`📥 Loading asset ${assetUrl} for ${instrument}`);
    
    // Simulate asset loading with optimization
    const asset = await this.simulateAssetLoad(assetUrl, config);
    
    // Apply instrument-specific optimizations
    const optimizedAsset = await this.applyInstrumentSpecificOptimizations(
      asset,
      instrument,
      config
    );
    
    return optimizedAsset;
  }
  
  /**
   * Simulate asset loading (placeholder for actual asset loading)
   */
  private async simulateAssetLoad(assetUrl: string, config: InstrumentOptimizationConfig): Promise<any> {
    // Simulate loading time based on quality and compression
    const baseLoadTime = 100; // Base 100ms
    const qualityMultiplier = config.quality === 'minimal' ? 0.5 : 
                             config.quality === 'low' ? 0.7 :
                             config.quality === 'medium' ? 1.0 :
                             config.quality === 'high' ? 1.5 : 2.0;
    
    const loadTime = baseLoadTime * qualityMultiplier;
    await new Promise(resolve => setTimeout(resolve, loadTime));
    
    return {
      url: assetUrl,
      data: null, // Would be AudioBuffer in real implementation
      size: Math.floor(Math.random() * 1000000 + 100000), // 100KB-1MB
      quality: config.quality,
      compressionUsed: config.compressionLevel !== 'none',
      success: true,
    };
  }
  
  /**
   * Cache optimized asset with proper metadata
   */
  private cacheOptimizedAsset(assetUrl: string, asset: any, instrument: string): void {
    const existing = this.assetCache.get(assetUrl);
    if (existing) {
      return; // Already cached
    }
    
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
   * Get optimization metrics for instrument
   */
  getOptimizationMetrics(instrument: string): OptimizationMetrics | null {
    return this.performanceMetrics.get(instrument) || null;
  }
  
  /**
   * Get overall optimization status
   */
  getOptimizationStatus(): {
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
  
  /**
   * Clear all cached assets and reset metrics
   */
  clearCache(): void {
    this.assetCache.clear();
    this.performanceMetrics.clear();
    logger.info('🧹 Asset optimization cache cleared');
  }
  
  // Device-specific optimization methods
  private optimizeBassForDevice(deviceClass: string, memoryMB: number): void {
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
        this.bassStrategy.palmMuteSamples = memoryMB > 4096;
        break;
      case 'high-end':
      case 'premium':
        this.bassStrategy.velocityLayers = 6;
        this.bassStrategy.roundRobinSamples = 3;
        this.bassStrategy.palmMuteSamples = true;
        this.bassStrategy.harmonics = memoryMB > 6144;
        break;
    }
  }
  
  private optimizeDrumsForDevice(deviceClass: string, memoryMB: number): void {
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
        this.drumStrategy.overheads = memoryMB > 4096;
        break;
      case 'high-end':
      case 'premium':
        this.drumStrategy.velocityLayers = 4;
        this.drumStrategy.roomSamples = memoryMB > 6144;
        this.drumStrategy.overheads = true;
        break;
    }
  }
  
  private optimizeChordsForDevice(deviceClass: string, maxPolyphony: number): void {
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
  
  // Utility methods
  private async applyInstrumentSpecificOptimizations(
    asset: any,
    instrument: string,
    config: InstrumentOptimizationConfig
  ): Promise<any> {
    // Apply processing based on instrument type and config
    let optimizedAsset = { ...asset };
    
    switch (instrument) {
      case 'bass':
        if (this.bassStrategy.fretNoiseReduction) {
          optimizedAsset = await this.applyNoiseReduction(optimizedAsset);
        }
        if (this.bassStrategy.stringOptimization) {
          optimizedAsset = await this.optimizeForStringInstrument(optimizedAsset);
        }
        break;
      case 'drums':
        if (this.drumStrategy.bleedReduction) {
          optimizedAsset = await this.applyBleedReduction(optimizedAsset);
        }
        optimizedAsset = await this.optimizeTransients(optimizedAsset);
        break;
      case 'chords':
        if (this.chordStrategy.harmonicContent) {
          optimizedAsset = await this.optimizeHarmonicContent(optimizedAsset);
        }
        break;
      case 'metronome':
        if (this.metronomeStrategy.latencyCompensation) {
          optimizedAsset = await this.applyLatencyCompensation(optimizedAsset);
        }
        break;
    }
    
    return optimizedAsset;
  }
  
  private getInstrumentStrategy(instrument: string): any {
    switch (instrument) {
      case 'bass': return this.bassStrategy;
      case 'drums': return this.drumStrategy;
      case 'chords': return this.chordStrategy;
      case 'metronome': return this.metronomeStrategy;
      default: return {};
    }
  }
  
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
  
  private isOptimalQuality(cached: AssetCacheEntry, requiredQuality: string): boolean {
    const qualityLevels = ['minimal', 'low', 'medium', 'high', 'ultra'];
    const cachedIndex = qualityLevels.indexOf(cached.quality);
    const requiredIndex = qualityLevels.indexOf(requiredQuality);
    
    return cachedIndex >= requiredIndex;
  }
  
  private calculateCacheHitRate(instrument: string): number {
    const instrumentAssets = Array.from(this.assetCache.values()).filter(
      entry => this.getAssetInstrument(entry.asset.url) === instrument
    );
    
    if (instrumentAssets.length === 0) return 0;
    
    const totalAccesses = instrumentAssets.reduce((sum, entry) => sum + entry.frequency, 0);
    const cacheHits = instrumentAssets.reduce((sum, entry) => sum + Math.max(0, entry.frequency - 1), 0);
    
    return totalAccesses > 0 ? cacheHits / totalAccesses : 0;
  }
  
  private calculateOverallCacheHitRate(): number {
    const allEntries = Array.from(this.assetCache.values());
    if (allEntries.length === 0) return 0;
    
    const hits = allEntries.filter(entry => entry.frequency > 1).length;
    return hits / allEntries.length;
  }
  
  private calculateTotalCacheMemoryUsage(): number {
    return Array.from(this.assetCache.values()).reduce((total, entry) => {
      return total + (entry.asset.size || 0);
    }, 0);
  }
  
  private getAssetInstrument(assetUrl: string): string {
    if (assetUrl.includes('bass')) return 'bass';
    if (assetUrl.includes('drum') || assetUrl.includes('kick') || 
        assetUrl.includes('snare') || assetUrl.includes('hihat')) return 'drums';
    if (assetUrl.includes('chord') || assetUrl.includes('piano')) return 'chords';
    if (assetUrl.includes('click') || assetUrl.includes('metronome')) return 'metronome';
    return 'unknown';
  }
  
  private maintainCacheSize(): void {
    const maxCacheEntries = 1000;
    
    if (this.assetCache.size > maxCacheEntries) {
      // Remove least recently used entries
      const entries = Array.from(this.assetCache.entries()).sort(
        ([, a], [, b]) => a.lastUsed - b.lastUsed
      );
      
      const entriesToRemove = entries.slice(0, this.assetCache.size - maxCacheEntries);
      entriesToRemove.forEach(([url]) => this.assetCache.delete(url));
      
      logger.info(`🧹 Cache cleanup: removed ${entriesToRemove.length} old entries`);
    }
  }
  
  private calculateMaxPolyphony(): number {
    if (!this.deviceCapabilities) return 8;
    
    const { cpu, memory } = this.deviceCapabilities;
    let polyphony = 8;
    
    if (cpu.performance === 'ultra') polyphony = 24;
    else if (cpu.performance === 'high') polyphony = 16;
    else if (cpu.performance === 'medium') polyphony = 12;
    else polyphony = 8;
    
    // Memory-based adjustment
    if (memory.total < 2048) polyphony = Math.min(polyphony, 8);
    else if (memory.total < 4096) polyphony = Math.min(polyphony, 12);
    
    return polyphony;
  }
  
  // Audio processing utility methods (simplified implementations)
  private async applyNoiseReduction(asset: any): Promise<any> {
    // Simplified noise reduction for bass
    return { ...asset, noiseReduced: true };
  }
  
  private async optimizeForStringInstrument(asset: any): Promise<any> {
    // String instrument specific optimization
    return { ...asset, stringOptimized: true };
  }
  
  private async applyBleedReduction(asset: any): Promise<any> {
    // Drum bleed reduction
    return { ...asset, bleedReduced: true };
  }
  
  private async optimizeTransients(asset: any): Promise<any> {
    // Transient optimization for drums
    return { ...asset, transientsOptimized: true };
  }
  
  private async optimizeHarmonicContent(asset: any): Promise<any> {
    // Harmonic content optimization for chords
    return { ...asset, harmonicsOptimized: true };
  }
  
  private async applyLatencyCompensation(asset: any): Promise<any> {
    // Latency compensation for metronome
    return { ...asset, latencyCompensated: true };
  }
  
  // Metrics calculation methods
  private calculateMemoryUsage(assets: any[]): number {
    return assets.reduce((total, asset) => total + (asset.size || 0), 0);
  }
  
  private calculateQualityScore(assets: any[]): number {
    const successfulAssets = assets.filter(asset => asset.success !== false);
    return successfulAssets.length / assets.length;
  }
  
  private calculateNetworkUsage(assets: any[]): number {
    return assets.reduce((total, asset) => total + (asset.size || 0), 0);
  }
  
  private estimateBatteryImpact(assets: any[]): number {
    // Estimate battery impact based on processing time
    const totalProcessingTime = assets.length * 10; // 10ms per asset
    return totalProcessingTime / 1000; // Convert to seconds
  }
  
  private calculateCompressionRatio(asset: any): number {
    return asset.compressionUsed ? 0.6 : 1.0;
  }
  
  /**
   * Export current optimization settings
   */
  exportOptimizationSettings(): {
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
  
  /**
   * Dispose of the optimizer
   */
  async dispose(): Promise<void> {
    this.assetCache.clear();
    this.optimizationConfigs.clear();
    this.performanceMetrics.clear();
    this.deviceCapabilities = null;
    this.networkCapabilities = null;
    
    // Clear singleton
    InstrumentAssetOptimizer.instance = null;
    
    logger.info('🧹 InstrumentAssetOptimizer disposed');
  }
}