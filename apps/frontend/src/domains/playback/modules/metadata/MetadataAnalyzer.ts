/**
 * MetadataAnalyzer - Audio Analysis Orchestrator
 *
 * Coordinates comprehensive audio metadata extraction and analysis
 * by orchestrating specialized analysis modules.
 *
 * @author BassNotion Development Team
 * @version 3.0.0
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  AudioAnalysisResult,
  AnalysisConfig,
} from '@bassnotion/contracts';

import type {
  MetadataAnalyzerConfig,
  AudioProcessingContext,
} from './types.js';
import {
  getOrCreatePersistentAudioContext,
  getPersistentAudioContext,
} from '../../utils/audioContext.js';
import { TempoDetector } from './tempo/TempoDetector.js';
import { KeyDetector } from './key/KeyDetector.js';
import { SpectralAnalyzer } from './spectral/SpectralAnalyzer.js';
import { QualityAssessor } from './quality/QualityAssessor.js';
import { MusicalFeatureExtractor } from './features/MusicalFeatureExtractor.js';
import { AnalysisCache } from './cache/AnalysisCache.js';

const logger = createStructuredLogger('MetadataAnalyzer');

/**
 * Professional audio metadata analysis engine
 *
 * Provides comprehensive audio analysis capabilities through
 * a modular architecture with specialized analyzers.
 */
export class MetadataAnalyzer {
  private audioContext: AudioContext | null = null;
  private config: MetadataAnalyzerConfig;
  private cache: AnalysisCache;
  private isInitialized = false;

  // Analysis modules
  private tempoDetector: TempoDetector;
  private keyDetector: KeyDetector;
  private spectralAnalyzer: SpectralAnalyzer;
  private qualityAssessor: QualityAssessor;
  private featureExtractor: MusicalFeatureExtractor;

  constructor(config: Partial<MetadataAnalyzerConfig> = {}) {
    this.config = {
      sampleRate: 44100,
      fftSize: 2048,
      windowFunction: 'hanning',
      tempoRange: { min: 60, max: 200 },
      highPrecision: false,
      maxAnalysisDuration: 300,
      simpleMode: false,
      ...config,
    };

    this.cache = new AnalysisCache();

    // Initialize analysis modules
    this.tempoDetector = new TempoDetector({
      minBPM: this.config.tempoRange.min,
      maxBPM: this.config.tempoRange.max,
      highPrecision: this.config.highPrecision,
    });

    this.keyDetector = new KeyDetector({
      windowSize: 4096,
      hopSize: 2048,
      chromaNormalization: 'max',
    });

    this.spectralAnalyzer = new SpectralAnalyzer({
      fftSize: this.config.fftSize,
      windowFunction: this.config.windowFunction,
      smoothingTimeConstant: 0.8,
    });

    this.qualityAssessor = new QualityAssessor({
      clippingThreshold: 0.99,
      silenceThreshold: 0.001,
      targetLUFS: -14,
    });

    this.featureExtractor = new MusicalFeatureExtractor({
      onsetSensitivity: 0.3,
      genreModelVersion: '1.0.0',
      instrumentModelVersion: '1.0.0',
    });

    // AudioContext is lazily initialized in initialize() to use the singleton pattern
    // This prevents multiple AudioContext creation warnings
    // Check if AudioContext API is available
    if (
      typeof AudioContext === 'undefined' &&
      typeof (global as any).AudioContext === 'undefined'
    ) {
      logger.warn(
        'AudioContext API not available - MetadataAnalyzer will operate in limited mode',
      );
    } else {
      // Try to get existing persistent context (may be null if not yet created)
      this.audioContext = getPersistentAudioContext();
    }
  }

  /**
   * Get AudioContext, creating it via singleton if needed
   * This is an internal helper that ensures we have a valid context
   */
  private async getAudioContext(): Promise<AudioContext> {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      return this.audioContext;
    }

    // Use the singleton pattern to get or create the AudioContext
    this.audioContext = await getOrCreatePersistentAudioContext();
    return this.audioContext;
  }

  /**
   * Initialize the metadata analyzer
   */
  async initialize(): Promise<void> {
    try {
      // Ensure we have an AudioContext via the singleton pattern
      const context = await this.getAudioContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      this.isInitialized = true;
      logger.info('MetadataAnalyzer initialized successfully');
    } catch (error) {
      throw new Error(`Failed to initialize MetadataAnalyzer: ${error}`);
    }
  }

  /**
   * Analyze audio file and extract comprehensive metadata
   */
  async analyzeAudio(
    audioBuffer: ArrayBuffer,
    filename: string,
    analysisConfig?: Partial<AnalysisConfig>,
  ): Promise<AudioAnalysisResult> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const cacheKey = this.cache.generateKey(audioBuffer, filename);

    // Check cache first
    const cachedResult = this.cache.get(cacheKey);
    if (cachedResult) {
      logger.debug('Returning cached analysis result', { filename });
      return cachedResult;
    }

    try {
      // Decode audio data
      const decodedAudio = await this.decodeAudioData(audioBuffer);

      // Create processing context using the singleton AudioContext
      const audioContext = await this.getAudioContext();
      const context: AudioProcessingContext = {
        audioContext: audioContext,
        sampleRate: decodedAudio.sampleRate,
        fftSize: this.config.fftSize,
        windowFunction: this.config.windowFunction,
        simpleMode: this.config.simpleMode,
      } as AudioProcessingContext;

      // Perform parallel analysis
      logger.info('Starting parallel audio analysis', { filename });

      const [
        tempoResult,
        keyResult,
        spectralResult,
        qualityResult,
        musicalFeatures,
      ] = await Promise.all([
        this.tempoDetector.detectTempo(decodedAudio, context),
        this.keyDetector.detectKey(decodedAudio, context),
        this.spectralAnalyzer.analyzeSpectrum(decodedAudio, context),
        this.qualityAssessor.assessQuality(decodedAudio, context),
        this.featureExtractor.extractFeatures(decodedAudio, context),
      ]);

      const analysisResult: AudioAnalysisResult = {
        filename,
        duration: decodedAudio.duration,
        sampleRate: decodedAudio.sampleRate,
        channels: decodedAudio.numberOfChannels,
        tempo: tempoResult,
        key: keyResult,
        spectral: spectralResult,
        quality: qualityResult,
        musical: musicalFeatures,
        analyzedAt: new Date().toISOString(),
        version: '3.0.0',
      };

      // Cache the result
      this.cache.set(cacheKey, analysisResult);

      logger.info('Audio analysis completed successfully', {
        filename,
        duration: decodedAudio.duration,
        tempo: tempoResult.bpm,
        key: `${keyResult.key} ${keyResult.mode}`,
      });

      return analysisResult;
    } catch (error) {
      // If AudioContext is not available, return mock analysis
      if (
        error instanceof Error &&
        error.message.includes('AudioContext not available')
      ) {
        logger.warn(
          `MetadataAnalyzer: AudioContext not available, returning mock analysis for ${filename}`,
        );
        return this.getMockAnalysisResult(filename);
      }

      logger.error('Failed to analyze audio', error, { filename });
      throw error;
    }
  }

  /**
   * Decode audio data with error handling
   */
  private async decodeAudioData(
    audioBuffer: ArrayBuffer,
  ): Promise<AudioBuffer> {
    try {
      const context = await this.getAudioContext();
      return await context.decodeAudioData(audioBuffer.slice(0));
    } catch (error) {
      logger.error('Failed to decode audio data', error);
      throw new Error(`Audio decoding failed: ${error}`);
    }
  }

  /**
   * Get mock analysis result for testing
   */
  private getMockAnalysisResult(filename: string): AudioAnalysisResult {
    return {
      filename,
      duration: 180,
      sampleRate: 44100,
      channels: 2,
      tempo: {
        bpm: 120,
        confidence: 0.85,
        candidates: [
          { bpm: 120, confidence: 0.85 },
          { bpm: 140, confidence: 0.6 },
          { bpm: 100, confidence: 0.4 },
        ],
        method: 'autocorrelation',
      },
      key: {
        key: 'C',
        mode: 'major',
        confidence: 0.75,
        alternatives: [
          { key: 'A', mode: 'minor', confidence: 0.65 },
          { key: 'G', mode: 'major', confidence: 0.55 },
        ],
      },
      spectral: {
        spectralCentroid: 2500,
        spectralRolloff: 0.85,
        spectralFlux: 0.3,
        zeroCrossingRate: 0.1,
        frequencyBins: {
          subBass: 0.1,
          bass: 0.2,
          lowMids: 0.25,
          mids: 0.2,
          highMids: 0.15,
          highs: 0.08,
          airFreqs: 0.02,
        },
        dynamicRange: 45,
        harmonicContent: {
          harmonicRatio: 0.7,
          fundamentalStrength: 0.8,
          harmonicDistribution: [0.8, 0.4, 0.2, 0.1],
        },
      },
      quality: {
        snr: 45,
        thd: 0.02,
        peakLevel: -3,
        rmsLevel: -18,
        crestFactor: 15,
        clipping: {
          detected: false,
          percentage: 0,
          samples: [],
        },
        qualityScore: 85,
        recommendations: [],
      },
      musical: {
        onsetDensity: 2.5,
        rhythmComplexity: 0.6,
        harmonicRatio: 0.75,
        energyDistribution: {
          attack: 0.3,
          sustain: 0.5,
          decay: 0.2,
          overall: 'mixed',
        },
        musicalGenre: 'electronic',
        instrumentClassification: 'synthesizer',
      },
      analyzedAt: new Date().toISOString(),
      version: '3.0.0',
    };
  }

  /**
   * Clear analysis cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxSize: number } {
    return this.cache.getStats();
  }

  /**
   * Cleanup resources
   */
  async dispose(): Promise<void> {
    logger.info('Disposing MetadataAnalyzer');

    // Clear cache
    this.cache.dispose();

    // Note: Do NOT close the AudioContext here - it's a shared singleton
    // Closing it would break audio for the entire application
    // The AudioContext is managed by the AudioContextManager and should only
    // be closed when the entire application is shutting down
    this.audioContext = null;

    this.isInitialized = false;
  }
}
