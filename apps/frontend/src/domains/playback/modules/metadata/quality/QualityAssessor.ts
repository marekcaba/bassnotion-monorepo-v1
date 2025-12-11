/**
 * QualityAssessor - Audio quality assessment
 *
 * Evaluates audio quality metrics including SNR, THD,
 * clipping detection, and dynamic range.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { QualityAssessmentResult } from '@bassnotion/contracts';
import type { AudioProcessingContext } from '../types.js';
import type {
  QualityAssessmentConfig,
  ClippingSample,
  DynamicRangeMetrics,
  QualityMetrics,
} from './types.js';

const logger = createStructuredLogger('QualityAssessor');

export class QualityAssessor {
  private config: QualityAssessmentConfig;

  constructor(config: Partial<QualityAssessmentConfig> = {}) {
    this.config = {
      clippingThreshold: 0.99,
      silenceThreshold: 0.001,
      targetLUFS: -14,
      ...config,
    };
  }

  /**
   * Assess audio quality metrics
   */
  async assessQuality(
    audioBuffer: AudioBuffer,
    context: AudioProcessingContext,
  ): Promise<QualityAssessmentResult> {
    // Simple mode for testing - return mock data
    if ((context as any).simpleMode) {
      return this.getMockQualityResult();
    }

    const channelData = audioBuffer.getChannelData(0);

    // Calculate quality metrics
    const metrics = this.calculateQualityMetrics(channelData, context);
    const dynamicRange = this.calculateDynamicRangeMetrics(channelData);

    // Detect clipping
    const clipping = this.detectClipping(channelData);

    // Calculate overall quality score
    const qualityScore = this.calculateQualityScore({
      ...metrics,
      clipping: clipping.percentage,
      crestFactor: dynamicRange.crestFactor,
    });

    // Generate recommendations
    const recommendations = this.generateQualityRecommendations(
      qualityScore,
      metrics,
      dynamicRange,
      clipping,
    );

    return {
      snr: metrics.snr,
      thd: metrics.thd,
      peakLevel: dynamicRange.peak,
      rmsLevel: dynamicRange.rms,
      crestFactor: dynamicRange.crestFactor,
      clipping,
      qualityScore,
      recommendations,
    };
  }

  /**
   * Calculate quality metrics (SNR, THD, clarity)
   */
  private calculateQualityMetrics(
    channelData: Float32Array,
    context: AudioProcessingContext,
  ): QualityMetrics {
    // Calculate SNR (simplified)
    const snr = this.calculateSNR(channelData);

    // Calculate THD (simplified)
    const thd = this.calculateTHD(channelData, context);

    // Calculate clarity index
    const clarity = this.calculateClarity(channelData);

    return { snr, thd, clarity };
  }

  /**
   * Calculate Signal-to-Noise Ratio
   */
  private calculateSNR(channelData: Float32Array): number {
    // Find quiet sections (potential noise floor)
    const frameSize = 1024;
    const frames: number[] = [];

    for (let i = 0; i < channelData.length - frameSize; i += frameSize) {
      const frame = channelData.slice(i, i + frameSize);
      const energy =
        frame.reduce((sum, sample) => sum + sample * sample, 0) / frameSize;
      frames.push(energy);
    }

    frames.sort((a, b) => a - b);

    // Estimate noise floor from quietest 10% of frames
    const noiseFrames = frames.slice(0, Math.floor(frames.length * 0.1));
    const noiseFloor =
      noiseFrames.reduce((sum, e) => sum + e, 0) / noiseFrames.length;

    // Calculate signal power
    const signalPower =
      channelData.reduce((sum, sample) => sum + sample * sample, 0) /
      channelData.length;

    // SNR in dB
    return noiseFloor > 0 ? 10 * Math.log10(signalPower / noiseFloor) : 60;
  }

  /**
   * Calculate Total Harmonic Distortion
   */
  private calculateTHD(
    channelData: Float32Array,
    context: AudioProcessingContext,
  ): number {
    // Simplified THD calculation
    // In production, would perform FFT and analyze harmonic content

    // Count samples near clipping
    let distortedSamples = 0;
    const threshold = 0.95;

    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) > threshold) {
        distortedSamples++;
      }
    }

    // Estimate THD based on distortion
    const distortionRatio = distortedSamples / channelData.length;
    return Math.min(distortionRatio * 10, 1.0); // Scale to 0-1 range
  }

  /**
   * Calculate clarity index
   */
  private calculateClarity(channelData: Float32Array): number {
    // Calculate zero crossing rate as a proxy for clarity
    let crossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      if (channelData[i] >= 0 !== channelData[i - 1] >= 0) {
        crossings++;
      }
    }

    const zcr = crossings / (channelData.length - 1);

    // Map ZCR to clarity score (higher ZCR often means clearer signal)
    return Math.min(zcr * 10, 1.0);
  }

  /**
   * Calculate dynamic range metrics
   */
  private calculateDynamicRangeMetrics(
    channelData: Float32Array,
  ): DynamicRangeMetrics {
    // Calculate peak level
    const peak = Math.max(...channelData.map(Math.abs));
    const peakDB = peak > 0 ? 20 * Math.log10(peak) : -100;

    // Calculate RMS
    const sumSquares = channelData.reduce(
      (sum, sample) => sum + sample * sample,
      0,
    );
    const rms = Math.sqrt(sumSquares / channelData.length);
    const rmsDB = rms > 0 ? 20 * Math.log10(rms) : -100;

    // Calculate crest factor
    const crestFactor = peak > 0 && rms > 0 ? 20 * Math.log10(peak / rms) : 0;

    // Estimate LUFS (simplified)
    const lufs = rmsDB - 0.691; // Rough approximation

    return {
      peak: peakDB,
      rms: rmsDB,
      crestFactor,
      lufs,
    };
  }

  /**
   * Detect clipping in audio
   */
  private detectClipping(
    channelData: Float32Array,
  ): QualityAssessmentResult['clipping'] {
    const threshold = this.config.clippingThreshold;
    const clippingSamples: ClippingSample[] = [];

    for (let i = 0; i < channelData.length; i++) {
      const absSample = Math.abs(channelData[i]);
      if (absSample >= threshold) {
        clippingSamples.push({
          position: i,
          value: channelData[i],
        });
      }
    }

    const detected = clippingSamples.length > 0;
    const percentage = (clippingSamples.length / channelData.length) * 100;

    return {
      detected,
      percentage,
      samples: clippingSamples.slice(0, 100), // Limit to first 100 samples
    };
  }

  /**
   * Calculate overall quality score
   */
  private calculateQualityScore(metrics: {
    snr: number;
    thd: number;
    clipping: number;
    crestFactor: number;
  }): number {
    let score = 100;

    // Penalize poor SNR
    if (metrics.snr < 40) {
      score -= (40 - metrics.snr) * 0.5;
    }

    // Penalize high THD
    score -= metrics.thd * 20;

    // Heavily penalize clipping
    score -= metrics.clipping * 5;

    // Penalize poor crest factor
    if (metrics.crestFactor < 3) {
      score -= (3 - metrics.crestFactor) * 5;
    } else if (metrics.crestFactor > 20) {
      score -= (metrics.crestFactor - 20) * 2;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate quality recommendations
   */
  private generateQualityRecommendations(
    qualityScore: number,
    metrics: QualityMetrics,
    dynamicRange: DynamicRangeMetrics,
    clipping: QualityAssessmentResult['clipping'],
  ): string[] {
    const recommendations: string[] = [];

    if (clipping.detected) {
      recommendations.push(
        `Clipping detected (${clipping.percentage.toFixed(2)}%). Reduce input gain.`,
      );
    }

    if (metrics.snr < 40) {
      recommendations.push(
        'Low SNR detected. Check for noise sources or increase signal level.',
      );
    }

    if (metrics.thd > 0.05) {
      recommendations.push(
        'High distortion detected. Check signal chain for overload.',
      );
    }

    if (dynamicRange.crestFactor < 3) {
      recommendations.push('Low dynamic range. Consider reducing compression.');
    }

    if (dynamicRange.peak > -3) {
      recommendations.push(
        'Peak level too high. Leave headroom for processing.',
      );
    }

    if (qualityScore < 70) {
      recommendations.push(
        'Overall quality needs improvement. Review signal chain.',
      );
    }

    return recommendations;
  }

  /**
   * Get mock quality result for testing
   */
  private getMockQualityResult(): QualityAssessmentResult {
    return {
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
    };
  }
}
