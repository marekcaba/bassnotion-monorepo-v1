/**
 * MusicalFeatureExtractor - Extract musical characteristics
 * 
 * Analyzes audio for musical features including onset detection,
 * rhythm complexity, harmonic content, and instrument classification.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { MusicalFeatures } from '@bassnotion/contracts';
import type { AudioProcessingContext } from '../types.js';
import type { 
  MusicalFeatureConfig,
  Onset,
  RhythmPattern,
  GenreFeatures,
  InstrumentFeatures
} from './types.js';

const logger = createStructuredLogger('MusicalFeatureExtractor');

export class MusicalFeatureExtractor {
  private config: MusicalFeatureConfig;

  constructor(config: Partial<MusicalFeatureConfig> = {}) {
    this.config = {
      onsetSensitivity: 0.3,
      genreModelVersion: '1.0.0',
      instrumentModelVersion: '1.0.0',
      ...config,
    };
  }

  /**
   * Extract musical features from audio
   */
  async extractFeatures(
    audioBuffer: AudioBuffer,
    context: AudioProcessingContext
  ): Promise<MusicalFeatures> {
    // Simple mode for testing - return mock data
    if ((context as any).simpleMode) {
      return this.getMockMusicalFeatures();
    }

    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Detect onsets
    const onsets = this.detectOnsets(channelData, sampleRate);
    const onsetDensity = onsets.length / audioBuffer.duration;

    // Calculate rhythm complexity
    const rhythmComplexity = this.calculateRhythmComplexity(onsets, audioBuffer.duration);

    // Calculate harmonic ratio
    const harmonicRatio = this.calculateHarmonicRatio(channelData, context);

    // Analyze energy distribution
    const energyDistribution = this.analyzeEnergyDistribution(channelData);

    // Classify genre and instrument
    const genreFeatures = this.extractGenreFeatures(channelData, onsets, harmonicRatio);
    const musicalGenre = this.classifyGenre(genreFeatures);
    
    const instrumentFeatures = this.extractInstrumentFeatures(channelData, context);
    const instrumentClassification = this.classifyInstrument(instrumentFeatures);

    return {
      onsetDensity,
      rhythmComplexity,
      harmonicRatio,
      energyDistribution,
      musicalGenre,
      instrumentClassification,
    };
  }

  /**
   * Detect onsets in audio signal
   */
  private detectOnsets(channelData: Float32Array, sampleRate: number): Onset[] {
    const onsets: Onset[] = [];
    const frameSize = 2048;
    const hopSize = 512;
    
    // Calculate spectral flux for onset detection
    let previousSpectrum = new Float32Array(frameSize / 2);
    
    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      const frame = channelData.slice(i, i + frameSize);
      const spectrum = this.calculateFrameSpectrum(frame);
      
      const flux = this.calculateSpectralFlux(previousSpectrum, spectrum);
      
      if (flux > this.config.onsetSensitivity) {
        const onsetType = this.classifyOnsetType(frame, spectrum);
        onsets.push({
          time: i / sampleRate,
          strength: flux,
          type: onsetType,
        });
      }
      
      previousSpectrum = spectrum;
    }
    
    return this.filterOnsets(onsets);
  }

  /**
   * Calculate frame spectrum using simple DFT
   */
  private calculateFrameSpectrum(frame: Float32Array): Float32Array {
    const N = frame.length;
    const spectrum = new Float32Array(N / 2);
    
    // Apply Hanning window
    const windowed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      windowed[i] = frame[i] * window;
    }
    
    // Simple DFT
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < N; n++) {
        const angle = -2 * Math.PI * k * n / N;
        real += windowed[n] * Math.cos(angle);
        imag += windowed[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Calculate spectral flux between frames
   */
  private calculateSpectralFlux(prev: Float32Array, current: Float32Array): number {
    let flux = 0;
    for (let i = 0; i < prev.length; i++) {
      const diff = current[i] - prev[i];
      flux += Math.max(0, diff); // Half-wave rectification
    }
    return flux / prev.length;
  }

  /**
   * Classify onset type based on spectral characteristics
   */
  private classifyOnsetType(frame: Float32Array, spectrum: Float32Array): Onset['type'] {
    // Calculate spectral centroid
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < spectrum.length; i++) {
      weightedSum += i * spectrum[i];
      magnitudeSum += spectrum[i];
    }
    
    const centroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    const normalizedCentroid = centroid / spectrum.length;
    
    // Calculate zero crossing rate
    let crossings = 0;
    for (let i = 1; i < frame.length; i++) {
      if ((frame[i] >= 0) !== (frame[i - 1] >= 0)) {
        crossings++;
      }
    }
    const zcr = crossings / frame.length;
    
    // Classify based on features
    if (zcr > 0.1 && normalizedCentroid > 0.6) {
      return 'percussive';
    } else if (normalizedCentroid < 0.3) {
      return 'harmonic';
    } else {
      return 'mixed';
    }
  }

  /**
   * Filter onsets to remove duplicates
   */
  private filterOnsets(onsets: Onset[]): Onset[] {
    if (onsets.length === 0) return [];
    
    const filtered: Onset[] = [];
    const minInterval = 0.05; // 50ms minimum between onsets
    
    for (const onset of onsets) {
      const lastOnset = filtered[filtered.length - 1];
      if (!lastOnset || onset.time - lastOnset.time >= minInterval) {
        filtered.push(onset);
      }
    }
    
    return filtered;
  }

  /**
   * Calculate rhythm complexity
   */
  private calculateRhythmComplexity(onsets: Onset[], duration: number): number {
    if (onsets.length < 2) return 0;
    
    // Calculate inter-onset intervals
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i].time - onsets[i - 1].time);
    }
    
    // Calculate variance of intervals
    const mean = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const variance = intervals.reduce((sum, interval) => {
      const diff = interval - mean;
      return sum + diff * diff;
    }, 0) / intervals.length;
    
    // Normalize complexity score
    const complexity = Math.sqrt(variance) / mean;
    return Math.min(complexity, 1.0);
  }

  /**
   * Calculate harmonic ratio
   */
  private calculateHarmonicRatio(
    channelData: Float32Array,
    context: AudioProcessingContext
  ): number {
    // Simplified harmonic ratio calculation
    // In production, would use autocorrelation or comb filtering
    
    const frameSize = 4096;
    let harmonicFrames = 0;
    let totalFrames = 0;
    
    for (let i = 0; i < channelData.length - frameSize; i += frameSize / 2) {
      const frame = channelData.slice(i, i + frameSize);
      const isHarmonic = this.isFrameHarmonic(frame);
      
      if (isHarmonic) harmonicFrames++;
      totalFrames++;
    }
    
    return totalFrames > 0 ? harmonicFrames / totalFrames : 0;
  }

  /**
   * Check if frame contains harmonic content
   */
  private isFrameHarmonic(frame: Float32Array): boolean {
    // Calculate autocorrelation at musical intervals
    const autocorr = this.calculateAutocorrelation(frame);
    
    // Look for peaks at harmonic intervals
    let peakCount = 0;
    for (let lag = 20; lag < 200; lag++) {
      if (this.isPeak(autocorr, lag)) {
        peakCount++;
      }
    }
    
    return peakCount > 3;
  }

  /**
   * Calculate autocorrelation
   */
  private calculateAutocorrelation(frame: Float32Array): Float32Array {
    const result = new Float32Array(frame.length);
    
    for (let lag = 0; lag < frame.length; lag++) {
      let sum = 0;
      for (let i = 0; i < frame.length - lag; i++) {
        sum += frame[i] * frame[i + lag];
      }
      result[lag] = sum / (frame.length - lag);
    }
    
    return result;
  }

  /**
   * Check if index is a peak
   */
  private isPeak(data: Float32Array, index: number, window = 5): boolean {
    if (index < window || index >= data.length - window) return false;
    
    const value = data[index];
    for (let i = index - window; i <= index + window; i++) {
      if (i !== index && data[i] >= value) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Analyze energy distribution
   */
  private analyzeEnergyDistribution(channelData: Float32Array): MusicalFeatures['energyDistribution'] {
    const frameSize = Math.floor(channelData.length / 100);
    const energyFrames: number[] = [];
    
    // Calculate energy for each frame
    for (let i = 0; i < channelData.length - frameSize; i += frameSize) {
      const frame = channelData.slice(i, i + frameSize);
      const energy = frame.reduce((sum, sample) => sum + sample * sample, 0) / frameSize;
      energyFrames.push(energy);
    }
    
    const maxEnergy = Math.max(...energyFrames);
    if (maxEnergy === 0) {
      return { attack: 0, sustain: 0, decay: 0, overall: 'sustained' };
    }
    
    // Analyze envelope
    const attackFrames = energyFrames.slice(0, Math.floor(energyFrames.length * 0.2));
    const sustainFrames = energyFrames.slice(
      Math.floor(energyFrames.length * 0.2),
      Math.floor(energyFrames.length * 0.8)
    );
    const decayFrames = energyFrames.slice(Math.floor(energyFrames.length * 0.8));
    
    const attack = attackFrames.length > 0
      ? attackFrames[attackFrames.length - 1] / maxEnergy
      : 0;
      
    const sustain = sustainFrames.length > 0
      ? sustainFrames.reduce((sum, e) => sum + e, 0) / (sustainFrames.length * maxEnergy)
      : 0;
      
    const decay = decayFrames.length > 0
      ? 1 - decayFrames.reduce((sum, e) => sum + e, 0) / (decayFrames.length * maxEnergy)
      : 0;
    
    // Classify overall envelope
    let overall: 'percussive' | 'sustained' | 'mixed';
    if (attack > 0.8 && decay > 0.7) {
      overall = 'percussive';
    } else if (sustain > 0.6) {
      overall = 'sustained';
    } else {
      overall = 'mixed';
    }
    
    return { attack, sustain, decay, overall };
  }

  /**
   * Extract genre-relevant features
   */
  private extractGenreFeatures(
    channelData: Float32Array,
    onsets: Onset[],
    harmonicRatio: number
  ): GenreFeatures {
    // Estimate tempo from onset intervals
    let tempo = 120;
    if (onsets.length > 2) {
      const intervals: number[] = [];
      for (let i = 1; i < onsets.length; i++) {
        intervals.push(onsets[i].time - onsets[i - 1].time);
      }
      const avgInterval = intervals.reduce((sum, i) => sum + i, 0) / intervals.length;
      tempo = Math.round(60 / avgInterval);
    }
    
    // Calculate rhythm complexity
    const rhythmComplexity = this.calculateRhythmComplexity(
      onsets, 
      channelData.length / 44100 // Assume 44.1kHz
    );
    
    // Calculate spectral variance
    const spectralVariance = this.calculateSpectralVariance(channelData);
    
    return {
      tempo,
      rhythmComplexity,
      harmonicContent: harmonicRatio,
      spectralVariance,
    };
  }

  /**
   * Calculate spectral variance
   */
  private calculateSpectralVariance(channelData: Float32Array): number {
    const frameSize = 2048;
    const hopSize = 1024;
    const centroids: number[] = [];
    
    for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
      const frame = channelData.slice(i, i + frameSize);
      const spectrum = this.calculateFrameSpectrum(frame);
      
      // Calculate spectral centroid
      let weightedSum = 0;
      let magnitudeSum = 0;
      for (let j = 0; j < spectrum.length; j++) {
        weightedSum += j * spectrum[j];
        magnitudeSum += spectrum[j];
      }
      
      if (magnitudeSum > 0) {
        centroids.push(weightedSum / magnitudeSum);
      }
    }
    
    // Calculate variance
    if (centroids.length === 0) return 0;
    
    const mean = centroids.reduce((sum, c) => sum + c, 0) / centroids.length;
    const variance = centroids.reduce((sum, c) => {
      const diff = c - mean;
      return sum + diff * diff;
    }, 0) / centroids.length;
    
    return Math.sqrt(variance) / mean;
  }

  /**
   * Classify genre based on features
   */
  private classifyGenre(features: GenreFeatures): string {
    // Simple rule-based classification
    if (features.tempo > 140 && features.rhythmComplexity > 0.5) {
      return 'electronic';
    } else if (features.harmonicContent > 0.7 && features.rhythmComplexity < 0.3) {
      return 'acoustic';
    } else if (features.tempo > 120 && features.spectralVariance > 0.4) {
      return 'rock';
    } else if (features.harmonicContent > 0.6 && features.tempo < 100) {
      return 'classical';
    } else {
      return 'unknown';
    }
  }

  /**
   * Extract instrument-relevant features
   */
  private extractInstrumentFeatures(
    channelData: Float32Array,
    context: AudioProcessingContext
  ): InstrumentFeatures {
    // Calculate attack time
    const attackTime = this.calculateAttackTime(channelData);
    
    // Calculate average spectral centroid
    const spectralCentroid = this.calculateAverageSpectralCentroid(channelData);
    
    // Calculate harmonic ratio (reuse existing method)
    const harmonicRatio = this.calculateHarmonicRatio(channelData, context);
    
    // Calculate noisiness
    const noisiness = this.calculateNoisiness(channelData);
    
    return {
      attackTime,
      spectralCentroid,
      harmonicRatio,
      noisiness,
    };
  }

  /**
   * Calculate attack time
   */
  private calculateAttackTime(channelData: Float32Array): number {
    // Find peak amplitude
    const peak = Math.max(...channelData.map(Math.abs));
    const threshold = peak * 0.9;
    
    // Find first sample that reaches threshold
    for (let i = 0; i < channelData.length; i++) {
      if (Math.abs(channelData[i]) >= threshold) {
        return i / 44100; // Assume 44.1kHz
      }
    }
    
    return 0;
  }

  /**
   * Calculate average spectral centroid
   */
  private calculateAverageSpectralCentroid(channelData: Float32Array): number {
    const frameSize = 2048;
    let totalCentroid = 0;
    let frameCount = 0;
    
    for (let i = 0; i < channelData.length - frameSize; i += frameSize) {
      const frame = channelData.slice(i, i + frameSize);
      const spectrum = this.calculateFrameSpectrum(frame);
      
      let weightedSum = 0;
      let magnitudeSum = 0;
      for (let j = 0; j < spectrum.length; j++) {
        weightedSum += j * spectrum[j];
        magnitudeSum += spectrum[j];
      }
      
      if (magnitudeSum > 0) {
        totalCentroid += weightedSum / magnitudeSum / spectrum.length;
        frameCount++;
      }
    }
    
    return frameCount > 0 ? totalCentroid / frameCount : 0;
  }

  /**
   * Calculate noisiness
   */
  private calculateNoisiness(channelData: Float32Array): number {
    // Use zero crossing rate as proxy for noisiness
    let crossings = 0;
    for (let i = 1; i < channelData.length; i++) {
      if ((channelData[i] >= 0) !== (channelData[i - 1] >= 0)) {
        crossings++;
      }
    }
    
    const zcr = crossings / channelData.length;
    return Math.min(zcr * 2, 1.0); // Scale to 0-1
  }

  /**
   * Classify instrument based on features
   */
  private classifyInstrument(features: InstrumentFeatures): string {
    // Simple rule-based classification
    if (features.attackTime < 0.01 && features.noisiness > 0.5) {
      return 'percussion';
    } else if (features.harmonicRatio > 0.8 && features.spectralCentroid < 0.3) {
      return 'bass';
    } else if (features.harmonicRatio > 0.7 && features.spectralCentroid < 0.5) {
      return 'melodic';
    } else if (features.harmonicRatio > 0.6) {
      return 'harmonic';
    } else if (features.attackTime < 0.05 && features.spectralCentroid > 0.6) {
      return 'synthesizer';
    } else {
      return 'unknown';
    }
  }

  /**
   * Get mock musical features for testing
   */
  private getMockMusicalFeatures(): MusicalFeatures {
    return {
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
    };
  }
}