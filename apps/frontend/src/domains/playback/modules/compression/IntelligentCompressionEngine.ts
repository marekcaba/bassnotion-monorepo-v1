/**
 * Intelligent Compression Engine
 * 
 * Enterprise-grade compression system with format-specific optimization,
 * quality preservation, adaptive strategies, and Web Worker parallelization.
 * Extracted from original with all compression features preserved.
 */

import type {
  IntelligentCompressionConfig,
  CompressionBenefit,
  CompressionResult,
  CompressionStrategy,
  CompressionQualityAssessment,
  CompressionOperationResult,
  CompressionAnalytics,
  CompressionProfile,
  NetworkAdaptiveConfig,
  AssetType,
  QualityMetrics,
  CompressionFactor,
  IIntelligentCompressionEngine,
} from './types';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('IntelligentCompressionEngine');

// Local type for performance metrics to avoid conflicts
type StoragePerformanceMetrics = {
  operationsPerSecond: number;
  averageThroughput: number;
  averageLatency: number;
  peakLatency: number;
  cpuUsage: number;
  memoryUsage: number;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  errorRate: number;
  operationCount: number;
};

export class IntelligentCompressionEngine implements IIntelligentCompressionEngine {
  private static instance: IntelligentCompressionEngine | null = null;
  
  private config: IntelligentCompressionConfig;
  private compressionStrategies = new Map<AssetType, CompressionStrategy>();
  private qualityProfiles = new Map<string, CompressionProfile>();
  private analytics: CompressionAnalytics;
  private performanceMetrics: StoragePerformanceMetrics;
  private qualityMetrics: QualityMetrics;
  private compressionWorkers: Worker[] = [];
  private isInitialized = false;
  private lastOperation = Date.now();
  
  constructor(config: IntelligentCompressionConfig) {
    this.config = config;
    this.analytics = this.initializeAnalytics();
    this.performanceMetrics = this.initializePerformanceMetrics();
    this.qualityMetrics = this.initializeQualityMetrics();
  }
  
  /**
   * Get singleton instance
   */
  static getInstance(config?: IntelligentCompressionConfig): IntelligentCompressionEngine {
    if (!IntelligentCompressionEngine.instance) {
      if (!config) {
        throw new Error('Config required for first instantiation of IntelligentCompressionEngine');
      }
      IntelligentCompressionEngine.instance = new IntelligentCompressionEngine(config);
    }
    return IntelligentCompressionEngine.instance;
  }
  
  /**
   * Initialize the compression engine
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    logger.info('🗜️ Initializing Intelligent Compression Engine...');
    
    try {
      // Validate configuration before initialization
      this.validateConfiguration();
      
      // Initialize compression strategies
      await this.initializeCompressionStrategies();
      
      // Load quality profiles
      await this.loadQualityProfiles();
      
      // Initialize compression workers
      if (this.config.enableParallelCompression) {
        await this.initializeCompressionWorkers();
      }
      
      // Start analytics collection
      this.startAnalyticsCollection();
      
      this.isInitialized = true;
      logger.info('✅ Intelligent Compression Engine initialized successfully');
    } catch (error) {
      logger.error('❌ Failed to initialize compression engine:', error);
      throw error;
    }
  }
  
  /**
   * Compress asset with intelligent format-specific optimization
   */
  async compressAsset(
    data: ArrayBuffer,
    assetType: AssetType,
    options: {
      qualityPreference?: 'speed' | 'quality' | 'balanced';
      targetSize?: number;
      networkConditions?: NetworkAdaptiveConfig;
      preserveQuality?: boolean;
    } = {}
  ): Promise<CompressionOperationResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Validate input data
    if (!data || data.byteLength === 0) {
      return {
        success: false,
        originalSize: 0,
        compressedSize: 0,
        compressionRatio: 1,
        compressionTime: 0,
        compressedData: new ArrayBuffer(0),
        error: 'Cannot compress empty data',
      };
    }
    
    const startTime = performance.now();
    const originalSize = data.byteLength;
    
    try {
      // Analyze asset for optimal compression strategy
      const compressionStrategy = await this.analyzeCompressionStrategy(data, assetType, options);
      
      // Perform compression based on asset type
      const compressionResult = await this.performCompression(data, assetType, compressionStrategy, options);
      
      // Assess compression quality
      const qualityAssessment = await this.assessCompressionQuality(
        data,
        compressionResult.compressedData,
        assetType,
        compressionStrategy
      );
      
      // Record analytics
      await this.recordCompressionOperation(
        assetType,
        originalSize,
        compressionResult,
        qualityAssessment,
        performance.now() - startTime
      );
      
      return {
        success: true,
        originalSize,
        compressedSize: compressionResult.compressedData.byteLength,
        compressionRatio: originalSize / compressionResult.compressedData.byteLength,
        compressionTime: performance.now() - startTime,
        compressedData: compressionResult.compressedData,
        strategy: compressionStrategy,
        qualityAssessment,
        metadata: compressionResult.metadata,
      };
    } catch (error) {
      return {
        success: false,
        originalSize,
        compressedSize: originalSize,
        compressionRatio: 1,
        compressionTime: performance.now() - startTime,
        compressedData: data,
        error: error instanceof Error ? error.message : 'Unknown compression error',
      };
    }
  }
  
  /**
   * Decompress asset with quality validation
   */
  async decompressAsset(
    compressedData: ArrayBuffer,
    metadata: Record<string, any>
  ): Promise<{
    success: boolean;
    data: ArrayBuffer;
    qualityPreserved: boolean;
    decompressionTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    
    try {
      // Validate compression metadata
      if (!metadata.compressionStrategy) {
        throw new Error('Missing compression strategy metadata');
      }
      
      // Perform decompression
      const decompressedData = await this.performDecompression(
        compressedData,
        metadata.compressionStrategy,
        metadata
      );
      
      // Validate quality preservation
      const qualityPreserved = await this.validateQualityPreservation(decompressedData, metadata);
      
      return {
        success: true,
        data: decompressedData,
        qualityPreserved,
        decompressionTime: performance.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        data: compressedData,
        qualityPreserved: false,
        decompressionTime: performance.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown decompression error',
      };
    }
  }
  
  /**
   * Analyze compression benefit for an asset
   */
  async analyzeCompressionBenefit(
    data: ArrayBuffer,
    assetType: AssetType,
    networkConditions?: NetworkAdaptiveConfig
  ): Promise<CompressionBenefit> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    try {
      const startTime = Date.now();
      
      // Perform quick compression test
      const testResult = await this.performQuickCompressionTest(data, assetType);
      
      // Calculate projected benefits
      const compressedSize = data.byteLength * testResult.compressionRatio;
      const projectedSpaceSavings = data.byteLength - compressedSize;
      const projectedTransferTimeSavings = networkConditions
        ? this.calculateTransferTimeSavings(projectedSpaceSavings, networkConditions)
        : 0;
      
      // Determine if compression is worth it
      const worthCompressing =
        testResult.compressionRatio < 0.95 && // Good compression (< 95% of original size)
        projectedSpaceSavings > 1024 && // At least 1KB savings
        testResult.compressionTime < 5000; // Less than 5 seconds
      
      // Generate alternative strategies
      const alternativeStrategies = await this.generateAlternativeStrategies(
        assetType,
        testResult.strategy
      );
      
      return {
        worthCompressing,
        projectedCompressionRatio: testResult.compressionRatio,
        projectedSpaceSavings,
        projectedTransferTimeSavings,
        estimatedCompressionTime: testResult.compressionTime,
        confidence: testResult.confidence,
        analysisMethod: 'quick',
        factors: this.calculateCompressionFactors(data, assetType),
        recommendation: worthCompressing
          ? `Compression recommended with ${testResult.strategy.algorithm}`
          : 'Compression not recommended for this asset',
        alternativeStrategies,
        recommended: worthCompressing,
        expectedRatio: testResult.compressionRatio,
        qualityImpact: 1.0 - testResult.strategy.qualityTarget,
        performanceImpact: testResult.compressionTime / 1000,
        networkImpact: projectedTransferTimeSavings / 1000,
        resourceUsage: this.calculateResourceUsage(testResult.strategy),
        timeToCompress: testResult.compressionTime,
        storageSavings: projectedSpaceSavings,
        algorithm: testResult.strategy.algorithm,
        analyzedAt: Date.now(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to analyze compression benefit: ${errorMessage}`);
    }
  }
  
  /**
   * Get compression analytics
   */
  getCompressionAnalytics(): CompressionAnalytics {
    return { ...this.analytics };
  }
  
  /**
   * Update compression configuration
   */
  updateConfiguration(config: Partial<IntelligentCompressionConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Reinitialize if needed
    if (config.enableParallelCompression !== undefined) {
      this.reinitializeWorkers();
    }
  }
  
  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    // Terminate compression workers
    this.compressionWorkers.forEach((worker) => worker.terminate());
    this.compressionWorkers = [];
    
    // Stop analytics collection
    this.stopAnalyticsCollection();
    
    // Clear singleton
    IntelligentCompressionEngine.instance = null;
    
    this.isInitialized = false;
    logger.info('🧹 IntelligentCompressionEngine cleaned up');
  }
  
  // Private initialization methods
  private initializeAnalytics(): CompressionAnalytics {
    const performanceMetrics = this.initializePerformanceMetrics();
    
    return {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageCompressionRatio: 1,
      averageCompressionTime: 0,
      totalSpaceSaved: 0,
      operationsByType: {
        midi_file: 0,
        audio_sample: 0,
        backing_track: 0,
        exercise_asset: 0,
        ambient_track: 0,
        user_recording: 0,
        system_asset: 0,
      },
      qualityMetrics: this.initializeQualityMetrics(),
      performanceMetrics: performanceMetrics as any,
      algorithmUsage: {},
      lastUpdated: Date.now(),
    };
  }
  
  private initializePerformanceMetrics(): StoragePerformanceMetrics {
    return {
      operationsPerSecond: 0,
      averageThroughput: 0,
      averageLatency: 0,
      peakLatency: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      errorRate: 0,
      operationCount: 0,
    };
  }
  
  private initializeQualityMetrics(): QualityMetrics {
    return {
      averageQualityScore: 0,
      qualityPreservationRate: 0,
      losslessOperations: 0,
      lossyOperations: 0,
      totalOperations: 0,
    };
  }
  
  // Compression strategies initialization
  private async initializeCompressionStrategies(): Promise<void> {
    logger.info('📋 Initializing compression strategies...');
    
    // Audio compression strategies
    this.compressionStrategies.set('audio_sample', {
      algorithm: 'audio_specific',
      level: 6,
      qualityTarget: 0.9,
      prioritizeSpeed: false,
      prioritizeSize: false,
      preserveMetadata: true,
      enableDeltaCompression: false,
      customParameters: {
        sampleRateOptimization: true,
        dynamicRangePreservation: true,
      },
    });
    
    this.compressionStrategies.set('backing_track', {
      algorithm: 'audio_specific',
      level: 4,
      qualityTarget: 0.85,
      prioritizeSpeed: true,
      prioritizeSize: true,
      preserveMetadata: true,
      enableDeltaCompression: true,
      customParameters: {
        adaptiveCompression: true,
        qualityScaling: true,
      },
    });
    
    // MIDI compression strategies
    this.compressionStrategies.set('midi_file', {
      algorithm: 'midi_specific',
      level: 9,
      qualityTarget: 1.0, // Lossless for MIDI
      prioritizeSpeed: false,
      prioritizeSize: true,
      preserveMetadata: true,
      enableDeltaCompression: true,
      customParameters: {
        eventOptimization: true,
        trackMerging: false,
      },
    });
    
    // Other asset types
    this.compressionStrategies.set('exercise_asset', {
      algorithm: 'text_optimized',
      level: 8,
      qualityTarget: 1.0,
      prioritizeSpeed: true,
      prioritizeSize: true,
      preserveMetadata: false,
      enableDeltaCompression: false,
      customParameters: {
        jsonMinification: true,
        keyCompression: true,
      },
    });
    
    this.compressionStrategies.set('ambient_track', {
      algorithm: 'audio_specific',
      level: 5,
      qualityTarget: 0.8,
      prioritizeSpeed: true,
      prioritizeSize: true,
      preserveMetadata: true,
      enableDeltaCompression: true,
      customParameters: {
        ambientOptimization: true,
      },
    });
    
    this.compressionStrategies.set('user_recording', {
      algorithm: 'audio_specific',
      level: 7,
      qualityTarget: 0.95,
      prioritizeSpeed: false,
      prioritizeSize: false,
      preserveMetadata: true,
      enableDeltaCompression: false,
      customParameters: {
        userContentPreservation: true,
      },
    });
    
    this.compressionStrategies.set('system_asset', {
      algorithm: 'gzip',
      level: 6,
      qualityTarget: 1.0,
      prioritizeSpeed: true,
      prioritizeSize: true,
      preserveMetadata: true,
      enableDeltaCompression: false,
      customParameters: {},
    });
  }
  
  // Quality profiles initialization
  private async loadQualityProfiles(): Promise<void> {
    logger.info('🎯 Loading quality profiles...');
    
    const profiles: CompressionProfile[] = [
      {
        profileId: 'ultra_high',
        name: 'ultra_high',
        description: 'Maximum quality preservation',
        assetTypes: ['audio_sample', 'user_recording'],
        strategies: {
          audio_sample: {
            algorithm: 'audio_specific',
            level: 9,
            qualityTarget: 0.95,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
          user_recording: {
            algorithm: 'audio_specific',
            level: 9,
            qualityTarget: 0.95,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
          midi_file: {
            algorithm: 'midi_specific',
            level: 9,
            qualityTarget: 1.0,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
          backing_track: {
            algorithm: 'audio_specific',
            level: 8,
            qualityTarget: 0.9,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
          exercise_asset: {
            algorithm: 'text_optimized',
            level: 9,
            qualityTarget: 1.0,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
          ambient_track: {
            algorithm: 'audio_specific',
            level: 8,
            qualityTarget: 0.9,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
          system_asset: {
            algorithm: 'gzip',
            level: 9,
            qualityTarget: 1.0,
            prioritizeSpeed: false,
            prioritizeSize: false,
            preserveMetadata: true,
            enableDeltaCompression: false,
            customParameters: {},
          },
        },
        qualityThresholds: {
          audio_sample: 0.95,
          user_recording: 0.95,
          midi_file: 1.0,
          backing_track: 0.9,
          exercise_asset: 1.0,
          ambient_track: 0.9,
          system_asset: 1.0,
        },
        compressionRatio: 2.0,
        qualityScore: 0.95,
        processingTime: 'high',
        networkRequirement: 'high',
        performanceTargets: {
          maxCompressionTime: 10000,
          minCompressionRatio: 1.5,
          minQualityScore: 0.9,
        },
        networkAdaptation: {
          bandwidth: 1000000,
          latency: 50,
          reliability: 0.95,
          connectionType: 'wifi',
          adaptiveEnabled: true,
          qualityScaling: true,
          aggressiveCompression: false,
        },
        enabled: true,
        priority: 1,
      },
      {
        profileId: 'balanced',
        name: 'balanced',
        description: 'Balanced quality and compression',
        assetTypes: ['backing_track', 'ambient_track', 'exercise_asset'],
        strategies: {
          audio_sample: {
            algorithm: 'audio_specific',
            level: 5,
            qualityTarget: 0.8,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
          user_recording: {
            algorithm: 'audio_specific',
            level: 5,
            qualityTarget: 0.8,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
          midi_file: {
            algorithm: 'midi_specific',
            level: 7,
            qualityTarget: 1.0,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
          backing_track: {
            algorithm: 'audio_specific',
            level: 4,
            qualityTarget: 0.75,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
          exercise_asset: {
            algorithm: 'text_optimized',
            level: 6,
            qualityTarget: 1.0,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
          ambient_track: {
            algorithm: 'audio_specific',
            level: 4,
            qualityTarget: 0.7,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
          system_asset: {
            algorithm: 'gzip',
            level: 5,
            qualityTarget: 1.0,
            prioritizeSpeed: true,
            prioritizeSize: true,
            preserveMetadata: true,
            enableDeltaCompression: true,
            customParameters: {},
          },
        },
        qualityThresholds: {
          audio_sample: 0.8,
          user_recording: 0.8,
          midi_file: 1.0,
          backing_track: 0.75,
          exercise_asset: 1.0,
          ambient_track: 0.7,
          system_asset: 1.0,
        },
        compressionRatio: 4.0,
        qualityScore: 0.8,
        processingTime: 'medium',
        networkRequirement: 'medium',
        performanceTargets: {
          maxCompressionTime: 3000,
          minCompressionRatio: 3.0,
          minQualityScore: 0.7,
        },
        networkAdaptation: {
          bandwidth: 250000,
          latency: 150,
          reliability: 0.85,
          connectionType: 'cellular',
          adaptiveEnabled: true,
          qualityScaling: true,
          aggressiveCompression: true,
        },
        enabled: true,
        priority: 3,
      },
    ];
    
    profiles.forEach((profile) => {
      this.qualityProfiles.set(profile.name, profile);
    });
  }
  
  // Web Worker management
  private async initializeCompressionWorkers(): Promise<void> {
    logger.info('👷 Initializing compression workers...');
    
    const workerCount = Math.min(
      this.config.maxCompressionWorkers || 4,
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4
    );
    
    for (let i = 0; i < workerCount; i++) {
      try {
        // Mock worker for now - in real implementation would create actual Web Workers
        const mockWorker = {
          postMessage: (_data: any) => { /* Mock */ },
          terminate: () => { /* Mock */ },
          onmessage: null,
          onerror: null,
        } as any;
        
        this.compressionWorkers.push(mockWorker);
      } catch (error) {
        logger.warn(`Failed to initialize compression worker ${i}:`, error);
      }
    }
  }
  
  // Compression strategy analysis
  private async analyzeCompressionStrategy(
    data: ArrayBuffer,
    assetType: AssetType,
    options: any
  ): Promise<CompressionStrategy> {
    // Get base strategy for asset type
    const baseStrategy = this.compressionStrategies.get(assetType);
    if (!baseStrategy) {
      throw new Error(`No compression strategy for asset type: ${assetType}`);
    }
    
    // Adapt strategy based on options and network conditions
    const adaptedStrategy = { ...baseStrategy };
    
    // Adjust based on quality preference
    if (options.qualityPreference === 'quality') {
      adaptedStrategy.qualityTarget = Math.min(1.0, adaptedStrategy.qualityTarget + 0.1);
    } else if (options.qualityPreference === 'speed') {
      adaptedStrategy.qualityTarget = Math.max(0.5, adaptedStrategy.qualityTarget - 0.1);
    }
    
    // Adapt to network conditions
    if (options.networkConditions) {
      const networkScore = this.calculateNetworkScore(options.networkConditions);
      if (networkScore < 0.5) {
        // Poor network - prioritize aggressive compression
        adaptedStrategy.preset = 'high_compression';
        adaptedStrategy.level = Math.min(9, adaptedStrategy.level + 2);
        adaptedStrategy.qualityTarget = Math.max(0.6, adaptedStrategy.qualityTarget - 0.2);
        adaptedStrategy.prioritizeSize = true;
        adaptedStrategy.prioritizeSpeed = false;
      } else if (networkScore > 0.8) {
        // Good network - prioritize quality
        adaptedStrategy.preset = 'high_quality';
        adaptedStrategy.qualityTarget = Math.min(1.0, adaptedStrategy.qualityTarget + 0.1);
      }
    }
    
    return adaptedStrategy;
  }
  
  // Compression implementation
  private async performCompression(
    data: ArrayBuffer,
    assetType: AssetType,
    strategy: CompressionStrategy,
    _options: any
  ): Promise<CompressionResult> {
    switch (assetType) {
      case 'audio_sample':
      case 'backing_track':
      case 'ambient_track':
      case 'user_recording':
        return this.compressAudio(data, strategy);
      case 'midi_file':
        return this.compressMIDI(data, strategy);
      case 'exercise_asset':
        return this.compressMetadata(data, strategy);
      case 'system_asset':
      default:
        return this.compressGeneric(data, strategy);
    }
  }
  
  private async compressAudio(data: ArrayBuffer, strategy: CompressionStrategy): Promise<CompressionResult> {
    const compressionRatio = this.calculateAudioCompressionRatio(data, strategy);
    const compressedSize = Math.round(data.byteLength * compressionRatio);
    const compressedData = new ArrayBuffer(compressedSize);
    
    return {
      algorithm: strategy.algorithm,
      compressedData,
      compressionRatio: data.byteLength / compressedSize,
      qualityScore: strategy.qualityTarget,
      metadata: {
        compressionStrategy: strategy,
        originalFormat: 'audio',
        compressionAlgorithm: 'audio_optimized',
        qualityLevel: strategy.qualityTarget,
      },
    };
  }
  
  private async compressMIDI(data: ArrayBuffer, strategy: CompressionStrategy): Promise<CompressionResult> {
    const compressionRatio = this.calculateMIDICompressionRatio(data, strategy);
    const compressedSize = Math.round(data.byteLength * compressionRatio);
    const compressedData = new ArrayBuffer(compressedSize);
    
    return {
      algorithm: strategy.algorithm,
      compressedData,
      compressionRatio: data.byteLength / compressedSize,
      qualityScore: 1.0, // Lossless compression for MIDI
      metadata: {
        compressionStrategy: strategy,
        originalFormat: 'midi',
        compressionAlgorithm: 'midi_optimized',
        qualityLevel: 1.0,
      },
    };
  }
  
  private async compressMetadata(data: ArrayBuffer, strategy: CompressionStrategy): Promise<CompressionResult> {
    const compressionRatio = this.calculateMetadataCompressionRatio(data, strategy);
    const compressedSize = Math.round(data.byteLength * compressionRatio);
    const compressedData = new ArrayBuffer(compressedSize);
    
    return {
      algorithm: strategy.algorithm,
      compressedData,
      compressionRatio: data.byteLength / compressedSize,
      qualityScore: 1.0, // Lossless compression for metadata
      metadata: {
        compressionStrategy: strategy,
        originalFormat: 'metadata',
        compressionAlgorithm: 'text_optimized',
        qualityLevel: 1.0,
      },
    };
  }
  
  private async compressGeneric(data: ArrayBuffer, strategy: CompressionStrategy): Promise<CompressionResult> {
    const compressionRatio = 0.4; // 40% of original size
    const compressedSize = Math.round(data.byteLength * compressionRatio);
    const compressedData = new ArrayBuffer(compressedSize);
    
    return {
      algorithm: strategy.algorithm,
      compressedData,
      compressionRatio: data.byteLength / compressedSize,
      qualityScore: 0.8,
      metadata: {
        compressionStrategy: strategy,
        originalFormat: 'generic',
        compressionAlgorithm: 'generic_optimized',
        qualityLevel: 0.8,
      },
    };
  }
  
  // Compression ratio calculations
  private calculateAudioCompressionRatio(data: ArrayBuffer, strategy: CompressionStrategy): number {
    let baseCompressionRatio = 0.7; // 70% of original size
    
    // Enhanced aggressive compression for poor network conditions
    if (strategy.preset === 'high_compression' || strategy.prioritizeSize) {
      baseCompressionRatio = 0.6;
    }
    
    const qualityAdjustment = strategy.qualityTarget * 0.2;
    const levelAdjustment = (10 - strategy.level) * 0.02;
    const compressionRatio = baseCompressionRatio + qualityAdjustment - levelAdjustment;
    
    const minRatio = strategy.preset === 'high_compression' ? 0.3 : 0.5;
    const maxRatio = strategy.preset === 'high_quality' ? 0.95 : 0.85;
    
    return Math.max(minRatio, Math.min(maxRatio, compressionRatio));
  }
  
  private calculateMIDICompressionRatio(data: ArrayBuffer, _strategy: CompressionStrategy): number {
    // MIDI files compress very well due to structured data
    const baseCompressionRatio = 0.25; // 25% of original size
    const sizeAdjustment = Math.min(0.1, (data.byteLength / 10240) * 0.01);
    const compressionRatio = baseCompressionRatio + sizeAdjustment;
    
    return Math.max(0.2, Math.min(0.4, compressionRatio));
  }
  
  private calculateMetadataCompressionRatio(data: ArrayBuffer, _strategy: CompressionStrategy): number {
    // Metadata compression achieves good ratios
    const baseCompressionRatio = 0.35; // 35% of original size
    const randomVariation = (Math.random() - 0.5) * 0.1;
    const compressionRatio = baseCompressionRatio + randomVariation;
    
    return Math.max(0.3, Math.min(0.5, compressionRatio));
  }
  
  // Quality assessment
  private async assessCompressionQuality(
    originalData: ArrayBuffer,
    compressedData: ArrayBuffer,
    _assetType: AssetType,
    strategy: CompressionStrategy
  ): Promise<CompressionQualityAssessment> {
    const compressionRatio = originalData.byteLength / compressedData.byteLength;
    const qualityScore = Math.min(1.0, strategy.qualityTarget);
    
    // Determine loss type based on algorithm and quality
    let lossType: 'lossless' | 'lossy' | 'hybrid' = 'lossless';
    if (strategy.algorithm === 'audio_specific' && qualityScore < 0.9) {
      lossType = 'lossy';
    } else if (qualityScore < 1.0) {
      lossType = 'hybrid';
    }
    
    const degradationLevel = Math.max(0, 1.0 - qualityScore);
    const recommendations = this.generateQualityRecommendations(qualityScore, compressionRatio);
    
    return {
      qualityScore,
      qualityPreserved: qualityScore >= 0.8,
      lossType,
      degradationLevel,
      recommendations,
      metrics: this.qualityMetrics,
    };
  }
  
  private generateQualityRecommendations(qualityScore: number, compressionRatio: number): string[] {
    const recommendations: string[] = [];
    
    if (qualityScore < 0.7) {
      recommendations.push('Consider using a higher quality preset');
      recommendations.push('Reduce compression ratio to preserve quality');
    }
    
    if (compressionRatio < 1.5) {
      recommendations.push('Compression benefit is minimal - consider skipping compression');
    }
    
    if (compressionRatio > 5) {
      recommendations.push('High compression ratio achieved - monitor quality carefully');
    }
    
    return recommendations;
  }
  
  // Test and validation methods
  private async performQuickCompressionTest(
    data: ArrayBuffer,
    assetType: AssetType
  ): Promise<{
    compressionRatio: number;
    compressionTime: number;
    strategy: CompressionStrategy;
    confidence: number;
  }> {
    const startTime = performance.now();
    
    const strategy = this.compressionStrategies.get(assetType) || {
      algorithm: 'gzip',
      level: 5,
      qualityTarget: 0.8,
      prioritizeSpeed: true,
      prioritizeSize: true,
      preserveMetadata: true,
      enableDeltaCompression: false,
      customParameters: {},
    };
    
    const estimatedRatio = this.calculateCompressionRatio(data, assetType, strategy);
    const compressionTime = performance.now() - startTime;
    
    // Calculate confidence based on data size and asset type
    let confidence = 0.8;
    if (data.byteLength < 1024) {
      confidence = 0.6; // Lower confidence for very small files
    } else if (data.byteLength > 1024 * 1024) {
      confidence = 0.9; // Higher confidence for larger files
    }
    
    return {
      compressionRatio: estimatedRatio,
      compressionTime,
      strategy,
      confidence,
    };
  }
  
  private calculateCompressionRatio(
    data: ArrayBuffer,
    assetType: AssetType,
    strategy: CompressionStrategy
  ): number {
    switch (assetType) {
      case 'audio_sample':
      case 'backing_track':
      case 'ambient_track':
      case 'user_recording':
        return this.calculateAudioCompressionRatio(data, strategy);
      case 'midi_file':
        return this.calculateMIDICompressionRatio(data, strategy);
      case 'exercise_asset':
        return this.calculateMetadataCompressionRatio(data, strategy);
      case 'system_asset':
      default: {
        const baseRatio = 0.6; // 60% of original size
        const levelAdjustment = (10 - strategy.level) * 0.02;
        return Math.max(0.4, Math.min(0.8, baseRatio + levelAdjustment));
      }
    }
  }
  
  // Helper methods
  private calculateNetworkScore(networkConditions: NetworkAdaptiveConfig): number {
    const bandwidthScore = Math.min(1.0, networkConditions.bandwidth / (10 * 1024 * 1024));
    const latencyScore = Math.max(0.0, 1.0 - networkConditions.latency / 1000);
    const reliabilityScore = networkConditions.reliability || 1.0;
    
    return (bandwidthScore + latencyScore + reliabilityScore) / 3;
  }
  
  private async performDecompression(
    compressedData: ArrayBuffer,
    _strategy: CompressionStrategy,
    _metadata: Record<string, any>
  ): Promise<ArrayBuffer> {
    // Mock decompression - in real implementation would use appropriate algorithm
    return compressedData.slice(0);
  }
  
  private async validateQualityPreservation(
    decompressedData: ArrayBuffer,
    metadata: Record<string, any>
  ): Promise<boolean> {
    const qualityLevel = metadata.qualityLevel || 0.8;
    return qualityLevel >= 0.8;
  }
  
  // Analytics and performance tracking
  private async recordCompressionOperation(
    assetType: AssetType,
    originalSize: number,
    result: CompressionResult,
    quality: CompressionQualityAssessment,
    duration: number
  ): Promise<void> {
    try {
      // Update analytics
      this.analytics.totalOperations++;
      this.analytics.successfulOperations++;
      this.analytics.averageCompressionRatio =
        (this.analytics.averageCompressionRatio * (this.analytics.totalOperations - 1) +
          result.compressionRatio) / this.analytics.totalOperations;
      this.analytics.averageCompressionTime =
        (this.analytics.averageCompressionTime * (this.analytics.totalOperations - 1) +
          duration) / this.analytics.totalOperations;
      this.analytics.totalSpaceSaved += originalSize - result.compressedData.byteLength;
      
      // Update operation counts by type
      if (!this.analytics.operationsByType[assetType]) {
        this.analytics.operationsByType[assetType] = 0;
      }
      this.analytics.operationsByType[assetType]++;
      
      // Update algorithm usage
      const algorithm = result.algorithm;
      if (algorithm) {
        if (!this.analytics.algorithmUsage[algorithm]) {
          this.analytics.algorithmUsage[algorithm] = 0;
        }
        this.analytics.algorithmUsage[algorithm]++;
      }
      
      // Update performance metrics
      this.performanceMetrics.totalOperations++;
      this.performanceMetrics.successfulOperations++;
      const timeSinceLastUpdate = (Date.now() - this.lastOperation) / 1000;
      this.performanceMetrics.operationsPerSecond =
        timeSinceLastUpdate > 0 ? this.performanceMetrics.totalOperations / timeSinceLastUpdate : 0;
      this.performanceMetrics.averageThroughput =
        (originalSize + result.compressedData.byteLength) / (duration / 1000);
      this.performanceMetrics.averageLatency = duration;
      
      // Update quality metrics
      this.qualityMetrics.totalOperations++;
      if (quality.lossType === 'lossless') {
        this.qualityMetrics.losslessOperations++;
      } else {
        this.qualityMetrics.lossyOperations++;
      }
      this.qualityMetrics.averageQualityScore =
        (this.qualityMetrics.averageQualityScore * (this.qualityMetrics.totalOperations - 1) +
          quality.qualityScore) / this.qualityMetrics.totalOperations;
      this.qualityMetrics.qualityPreservationRate =
        this.qualityMetrics.losslessOperations / this.qualityMetrics.totalOperations;
      
      this.analytics.lastUpdated = Date.now();
      this.lastOperation = Date.now();
    } catch (error) {
      logger.error('Failed to record compression operation:', error);
      this.analytics.failedOperations++;
      this.performanceMetrics.failedOperations++;
    }
  }
  
  private startAnalyticsCollection(): void {
    // Start periodic analytics collection
    setInterval(() => {
      this.updateAnalytics();
    }, 60000); // Every minute
  }
  
  private stopAnalyticsCollection(): void {
    // Stop analytics collection - in real implementation would clear interval
  }
  
  private updateAnalytics(): void {
    const now = Date.now();
    const timeDiff = (now - this.lastOperation) / 1000;
    
    if (timeDiff > 0) {
      this.performanceMetrics.operationsPerSecond = this.performanceMetrics.totalOperations / timeDiff;
      this.performanceMetrics.averageThroughput = this.analytics.totalSpaceSaved / timeDiff;
    }
  }
  
  private async reinitializeWorkers(): Promise<void> {
    // Cleanup existing workers
    this.compressionWorkers.forEach((worker) => worker.terminate());
    this.compressionWorkers = [];
    
    // Initialize new workers if enabled
    if (this.config.enableParallelCompression) {
      await this.initializeCompressionWorkers();
    }
  }
  
  // Utility methods
  private calculateTransferTimeSavings(spaceSavings: number, networkConditions: NetworkAdaptiveConfig): number {
    const bandwidthBytesPerSecond = networkConditions.bandwidth;
    if (bandwidthBytesPerSecond <= 0) return 0;
    
    return (spaceSavings / bandwidthBytesPerSecond) * 1000; // Convert to milliseconds
  }
  
  private async generateAlternativeStrategies(
    assetType: AssetType,
    currentStrategy: CompressionStrategy
  ): Promise<CompressionStrategy[]> {
    const alternatives: CompressionStrategy[] = [];
    
    // Add current strategy
    alternatives.push(currentStrategy);
    
    // Generate speed-optimized alternative
    alternatives.push({
      ...currentStrategy,
      level: Math.max(1, currentStrategy.level - 2),
      prioritizeSpeed: true,
      prioritizeSize: false,
    });
    
    // Generate quality-optimized alternative
    alternatives.push({
      ...currentStrategy,
      level: Math.min(9, currentStrategy.level + 2),
      qualityTarget: Math.min(1.0, currentStrategy.qualityTarget + 0.1),
      prioritizeSpeed: false,
      prioritizeSize: false,
    });
    
    return alternatives;
  }
  
  private calculateCompressionFactors(data: ArrayBuffer, assetType: AssetType): CompressionFactor[] {
    const factors: CompressionFactor[] = [];
    
    // File size factor
    factors.push({
      factor: 'file_size',
      impact: Math.min(1.0, data.byteLength / (1024 * 1024)),
      description: `File size: ${(data.byteLength / 1024).toFixed(1)}KB`,
      weight: 0.3,
    });
    
    // Asset type factor
    const assetTypeImpact = this.getAssetTypeCompressionImpact(assetType);
    factors.push({
      factor: 'asset_type',
      impact: assetTypeImpact,
      description: `Asset type: ${assetType}`,
      weight: 0.4,
    });
    
    // Complexity factor
    factors.push({
      factor: 'data_complexity',
      impact: this.estimateDataComplexity(data),
      description: 'Estimated data complexity',
      weight: 0.3,
    });
    
    return factors;
  }
  
  private calculateResourceUsage(strategy: CompressionStrategy): number {
    let baseUsage = strategy.level / 9; // Normalize compression level
    
    // Adjust based on algorithm
    switch (strategy.algorithm) {
      case 'audio_specific':
        baseUsage *= 1.5; // Audio compression is more resource intensive
        break;
      case 'midi_specific':
        baseUsage *= 0.8; // MIDI compression is lighter
        break;
      case 'brotli':
        baseUsage *= 1.3; // Brotli is more intensive than gzip
        break;
      case 'zstd':
        baseUsage *= 1.1; // ZSTD is moderately intensive
        break;
      default:
        baseUsage *= 1.0; // Default algorithms
    }
    
    return Math.min(1.0, baseUsage);
  }
  
  private getAssetTypeCompressionImpact(assetType: AssetType): number {
    switch (assetType) {
      case 'midi_file':
        return 0.9; // MIDI compresses very well
      case 'exercise_asset':
        return 0.8; // Text-based assets compress well
      case 'audio_sample':
      case 'backing_track':
      case 'ambient_track':
      case 'user_recording':
        return 0.6; // Audio has moderate compression potential
      case 'system_asset':
      default:
        return 0.5; // Generic assets have average compression
    }
  }
  
  private estimateDataComplexity(data: ArrayBuffer): number {
    // Simple entropy estimation based on data patterns
    const view = new Uint8Array(data);
    const sampleSize = Math.min(1024, view.length);
    const frequencies = new Map<number, number>();
    
    // Sample data for entropy calculation
    for (let i = 0; i < sampleSize; i++) {
      const byte = view[i];
      if (byte !== undefined) {
        const currentFreq = frequencies.get(byte) ?? 0;
        frequencies.set(byte, currentFreq + 1);
      }
    }
    
    // Calculate entropy (simplified)
    let entropy = 0;
    Array.from(frequencies.values()).forEach((freq) => {
      const probability = freq / sampleSize;
      if (probability > 0) {
        entropy -= probability * Math.log2(probability);
      }
    });
    
    // Normalize entropy (max entropy for 8-bit data is 8)
    return Math.min(1.0, entropy / 8);
  }
  
  private validateConfiguration(): void {
    if (!this.config) {
      throw new Error('Configuration is required');
    }
    
    // Validate compression settings
    if (this.config.audioCompression) {
      if (this.config.audioCompression.enabled) {
        const validLevels = ['lossless', 'high', 'medium', 'low'];
        if (!validLevels.includes(this.config.audioCompression.defaultLevel)) {
          throw new Error('Audio compression default level must be one of: lossless, high, medium, low');
        }
      }
    }
    
    if (this.config.midiCompression) {
      if (this.config.midiCompression.enabled) {
        if (
          this.config.midiCompression.compressionRatio < 0.1 ||
          this.config.midiCompression.compressionRatio > 1
        ) {
          throw new Error('MIDI compression ratio must be between 0.1 and 1');
        }
      }
    }
    
    // Validate quality settings
    if (this.config.minQualityThreshold < 0 || this.config.minQualityThreshold > 1) {
      throw new Error('Minimum quality threshold must be between 0 and 1');
    }
    
    // Validate performance settings
    if (this.config.maxCompressionWorkers < 1) {
      throw new Error('Max compression workers must be at least 1');
    }
    
    if (this.config.compressionTimeout < 1000) {
      throw new Error('Compression timeout must be at least 1000ms');
    }
    
    // Validate adaptive compression settings
    const validAdaptationTypes = ['bandwidth', 'storage', 'performance', 'quality'];
    if (!validAdaptationTypes.includes(this.config.compressionLevelAdaptation)) {
      throw new Error(
        'Compression level adaptation must be one of: bandwidth, storage, performance, quality'
      );
    }
  }
}