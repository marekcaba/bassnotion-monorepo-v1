/**
 * Intelligent Compression System Types
 * 
 * Type definitions for enterprise-grade compression with format-specific
 * optimization, quality preservation, and adaptive compression strategies.
 */

// Core compression types
export interface IntelligentCompressionConfig {
  enabled: boolean;
  enableParallelCompression: boolean;
  maxCompressionWorkers: number;
  compressionTimeout: number;
  minQualityThreshold: number;
  compressionLevelAdaptation: 'bandwidth' | 'storage' | 'performance' | 'quality';
  audioCompression: {
    enabled: boolean;
    defaultLevel: 'lossless' | 'high' | 'medium' | 'low';
  };
  midiCompression: {
    enabled: boolean;
    compressionRatio: number;
  };
}

export interface CompressionStrategy {
  algorithm: string;
  level: number;
  qualityTarget: number;
  prioritizeSpeed: boolean;
  prioritizeSize: boolean;
  preserveMetadata: boolean;
  enableDeltaCompression: boolean;
  preset?: string;
  customParameters: Record<string, any>;
}

export interface CompressionResult {
  algorithm: string;
  compressedData: ArrayBuffer;
  compressionRatio: number;
  qualityScore: number;
  metadata: {
    compressionStrategy: CompressionStrategy;
    originalFormat: string;
    compressionAlgorithm: string;
    qualityLevel: number;
  };
}

export interface CompressionOperationResult {
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
  compressedData: ArrayBuffer;
  strategy?: CompressionStrategy;
  qualityAssessment?: CompressionQualityAssessment;
  metadata?: any;
  error?: string;
}

export interface CompressionQualityAssessment {
  qualityScore: number;
  qualityPreserved: boolean;
  lossType: 'lossless' | 'lossy' | 'hybrid';
  degradationLevel: number;
  recommendations: string[];
  metrics: QualityMetrics;
}

export interface CompressionBenefit {
  worthCompressing: boolean;
  projectedCompressionRatio: number;
  projectedSpaceSavings: number;
  projectedTransferTimeSavings: number;
  estimatedCompressionTime: number;
  confidence: number;
  analysisMethod: string;
  factors: CompressionFactor[];
  recommendation: string;
  alternativeStrategies: CompressionStrategy[];
  recommended: boolean;
  expectedRatio: number;
  qualityImpact: number;
  performanceImpact: number;
  networkImpact: number;
  resourceUsage: number;
  timeToCompress: number;
  storageSavings: number;
  algorithm: string;
  analyzedAt: number;
}

export interface CompressionFactor {
  factor: string;
  impact: number;
  description: string;
  weight: number;
}

export interface CompressionProfile {
  profileId: string;
  name: string;
  description: string;
  assetTypes: AssetType[];
  strategies: Record<AssetType, CompressionStrategy>;
  qualityThresholds: Record<AssetType, number>;
  compressionRatio: number;
  qualityScore: number;
  processingTime: 'low' | 'medium' | 'high';
  networkRequirement: 'low' | 'medium' | 'high';
  performanceTargets: {
    maxCompressionTime: number;
    minCompressionRatio: number;
    minQualityScore: number;
  };
  networkAdaptation: NetworkAdaptiveConfig;
  enabled: boolean;
  priority: number;
}

export interface NetworkAdaptiveConfig {
  bandwidth: number;
  latency: number;
  reliability: number;
  connectionType: string;
  adaptiveEnabled: boolean;
  qualityScaling: boolean;
  aggressiveCompression: boolean;
}

export interface CompressionAnalytics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageCompressionRatio: number;
  averageCompressionTime: number;
  totalSpaceSaved: number;
  operationsByType: Record<AssetType, number>;
  qualityMetrics: QualityMetrics;
  performanceMetrics: any;
  algorithmUsage: Record<string, number>;
  lastUpdated: number;
}

export interface QualityMetrics {
  averageQualityScore: number;
  qualityPreservationRate: number;
  losslessOperations: number;
  lossyOperations: number;
  totalOperations: number;
}

// Asset type definitions
export type AssetType = 
  | 'midi_file' 
  | 'audio_sample' 
  | 'backing_track' 
  | 'exercise_asset' 
  | 'ambient_track' 
  | 'user_recording' 
  | 'system_asset';

// Interface definitions
export interface IIntelligentCompressionEngine {
  initialize(): Promise<void>;
  compressAsset(
    data: ArrayBuffer,
    assetType: AssetType,
    options?: {
      qualityPreference?: 'speed' | 'quality' | 'balanced';
      targetSize?: number;
      networkConditions?: NetworkAdaptiveConfig;
      preserveQuality?: boolean;
    }
  ): Promise<CompressionOperationResult>;
  decompressAsset(
    compressedData: ArrayBuffer,
    metadata: Record<string, any>
  ): Promise<{
    success: boolean;
    data: ArrayBuffer;
    qualityPreserved: boolean;
    decompressionTime: number;
    error?: string;
  }>;
  analyzeCompressionBenefit(
    data: ArrayBuffer,
    assetType: AssetType,
    networkConditions?: NetworkAdaptiveConfig
  ): Promise<CompressionBenefit>;
  getCompressionAnalytics(): CompressionAnalytics;
  updateConfiguration(config: Partial<IntelligentCompressionConfig>): void;
  cleanup(): Promise<void>;
}