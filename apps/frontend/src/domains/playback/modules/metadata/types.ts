/**
 * Shared types for metadata analysis modules
 */

import type {
  AudioAnalysisResult,
  TempoDetectionResult,
  KeyDetectionResult,
  SpectralAnalysisResult,
  QualityAssessmentResult,
  MusicalFeatures,
  AnalysisConfig,
} from '@bassnotion/contracts';

// Re-export contract types for convenience
export type {
  AudioAnalysisResult,
  TempoDetectionResult,
  KeyDetectionResult,
  SpectralAnalysisResult,
  QualityAssessmentResult,
  MusicalFeatures,
  AnalysisConfig,
};

/**
 * Configuration for metadata analysis operations
 */
export interface MetadataAnalyzerConfig {
  /** Sample rate for analysis (default: 44100) */
  sampleRate: number;
  /** FFT size for spectral analysis (default: 2048) */
  fftSize: number;
  /** Window function for spectral analysis */
  windowFunction: 'hanning' | 'hamming' | 'blackman';
  /** Tempo detection range in BPM */
  tempoRange: { min: number; max: number };
  /** Enable high-precision analysis (slower but more accurate) */
  highPrecision: boolean;
  /** Maximum analysis duration in seconds */
  maxAnalysisDuration: number;
  /** Enable simple mode for testing (bypasses heavy computations) */
  simpleMode?: boolean;
}

/**
 * Common audio processing context
 */
export interface AudioProcessingContext {
  audioContext: AudioContext;
  sampleRate: number;
  fftSize: number;
  windowFunction: 'hanning' | 'hamming' | 'blackman';
}

/**
 * Cache entry for analysis results
 */
export interface AnalysisCacheEntry {
  result: AudioAnalysisResult;
  timestamp: number;
  key: string;
}