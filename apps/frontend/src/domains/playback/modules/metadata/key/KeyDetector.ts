/**
 * KeyDetector - Musical key and mode detection
 * 
 * Analyzes audio to determine musical key using chromagram
 * and key profile correlation techniques.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type { KeyDetectionResult } from '@bassnotion/contracts';
import type { AudioProcessingContext } from '../types.js';
import type { KeyDetectionConfig, ChromaVector, KeyProfile } from './types.js';
import { KEY_PROFILES, NOTE_NAMES } from './types.js';

const logger = createStructuredLogger('KeyDetector');

export class KeyDetector {
  private config: KeyDetectionConfig;

  constructor(config: Partial<KeyDetectionConfig> = {}) {
    this.config = {
      windowSize: 4096,
      hopSize: 2048,
      chromaNormalization: 'max',
      ...config,
    };
  }

  /**
   * Detect musical key from audio buffer
   */
  async detectKey(
    audioBuffer: AudioBuffer,
    context: AudioProcessingContext
  ): Promise<KeyDetectionResult> {
    // Simple mode for testing - return mock data
    if ((context as any).simpleMode) {
      return {
        key: 'C',
        mode: 'major',
        confidence: 0.75,
        alternatives: [
          { key: 'A', mode: 'minor', confidence: 0.65 },
          { key: 'G', mode: 'major', confidence: 0.55 },
        ],
      };
    }

    const channelData = audioBuffer.getChannelData(0);
    
    // Calculate chromagram
    const chromagram = this.calculateChromagram(channelData, context);
    
    // Average chroma vectors
    const averageChroma = this.averageChromaVectors(chromagram);
    
    // Normalize chroma vector
    const normalizedChroma = this.normalizeChroma(averageChroma);
    
    // Correlate with key profiles
    const keyProfiles = this.generateKeyProfiles();
    const correlations = this.correlateWithProfiles(normalizedChroma, keyProfiles);
    
    // Find best match
    const bestMatch = this.selectBestKey(correlations);
    
    return bestMatch;
  }

  /**
   * Calculate chromagram from audio data
   */
  private calculateChromagram(
    channelData: Float32Array,
    context: AudioProcessingContext
  ): ChromaVector[] {
    const chromaVectors: ChromaVector[] = [];
    const { windowSize, hopSize } = this.config;
    const sampleRate = context.sampleRate;
    
    for (let i = 0; i < channelData.length - windowSize; i += hopSize) {
      const frame = channelData.slice(i, i + windowSize);
      const chroma = this.calculateChromaVector(frame, sampleRate, context.fftSize);
      
      chromaVectors.push({
        values: chroma,
        timestamp: i / sampleRate,
      });
    }
    
    return chromaVectors;
  }

  /**
   * Calculate chroma vector for a single frame
   */
  private calculateChromaVector(
    frame: Float32Array,
    sampleRate: number,
    fftSize: number
  ): Float32Array {
    const chroma = new Float32Array(12);
    
    // Apply window function
    const windowedFrame = this.applyWindow(frame);
    
    // Perform FFT (simplified - in production would use proper FFT)
    const spectrum = this.calculateFFT(windowedFrame, fftSize);
    
    // Map frequencies to chroma bins
    for (let bin = 0; bin < spectrum.length / 2; bin++) {
      const frequency = (bin * sampleRate) / fftSize;
      if (frequency > 80 && frequency < 5000) { // Focus on musical range
        const chromaBin = this.frequencyToChromaBin(frequency);
        chroma[chromaBin] += spectrum[bin];
      }
    }
    
    return chroma;
  }

  /**
   * Apply window function to frame
   */
  private applyWindow(frame: Float32Array): Float32Array {
    const windowed = new Float32Array(frame.length);
    const N = frame.length;
    
    // Hanning window
    for (let i = 0; i < N; i++) {
      const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
      windowed[i] = frame[i] * window;
    }
    
    return windowed;
  }

  /**
   * Simplified FFT calculation
   */
  private calculateFFT(frame: Float32Array, fftSize: number): Float32Array {
    // In production, use Web Audio API or proper FFT library
    const spectrum = new Float32Array(fftSize);
    
    // Simplified spectral estimation
    for (let k = 0; k < fftSize / 2; k++) {
      let real = 0;
      let imag = 0;
      
      for (let n = 0; n < frame.length; n++) {
        const angle = -2 * Math.PI * k * n / frame.length;
        real += frame[n] * Math.cos(angle);
        imag += frame[n] * Math.sin(angle);
      }
      
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    return spectrum;
  }

  /**
   * Convert frequency to chroma bin
   */
  private frequencyToChromaBin(frequency: number): number {
    const A4 = 440;
    const C0 = A4 * Math.pow(2, -4.75);
    
    if (frequency <= 0) return 0;
    
    const halfStepsFromC0 = 12 * Math.log2(frequency / C0);
    return Math.round(halfStepsFromC0) % 12;
  }

  /**
   * Average multiple chroma vectors
   */
  private averageChromaVectors(chromaVectors: ChromaVector[]): Float32Array {
    const avgChroma = new Float32Array(12);
    
    if (chromaVectors.length === 0) return avgChroma;
    
    for (const vector of chromaVectors) {
      for (let i = 0; i < 12; i++) {
        avgChroma[i] += vector.values[i];
      }
    }
    
    for (let i = 0; i < 12; i++) {
      avgChroma[i] /= chromaVectors.length;
    }
    
    return avgChroma;
  }

  /**
   * Normalize chroma vector
   */
  private normalizeChroma(chroma: Float32Array): Float32Array {
    const normalized = new Float32Array(12);
    
    if (this.config.chromaNormalization === 'none') {
      return chroma;
    }
    
    if (this.config.chromaNormalization === 'max') {
      const max = Math.max(...chroma);
      if (max > 0) {
        for (let i = 0; i < 12; i++) {
          normalized[i] = chroma[i] / max;
        }
      }
    } else if (this.config.chromaNormalization === 'sum') {
      const sum = chroma.reduce((a, b) => a + b, 0);
      if (sum > 0) {
        for (let i = 0; i < 12; i++) {
          normalized[i] = chroma[i] / sum;
        }
      }
    }
    
    return normalized;
  }

  /**
   * Generate key profiles for all keys
   */
  private generateKeyProfiles(): KeyProfile[] {
    const profiles: KeyProfile[] = [];
    
    // Generate profiles for all 12 keys, major and minor
    for (let i = 0; i < 12; i++) {
      // Major key profile
      profiles.push({
        note: NOTE_NAMES[i],
        mode: 'major',
        correlation: 0,
      });
      
      // Minor key profile
      profiles.push({
        note: NOTE_NAMES[i],
        mode: 'minor',
        correlation: 0,
      });
    }
    
    return profiles;
  }

  /**
   * Correlate chroma with key profiles
   */
  private correlateWithProfiles(
    chroma: Float32Array,
    profiles: KeyProfile[]
  ): KeyProfile[] {
    for (const profile of profiles) {
      const rootNote = NOTE_NAMES.indexOf(profile.note);
      const template = profile.mode === 'major' ? KEY_PROFILES.major : KEY_PROFILES.minor;
      
      let correlation = 0;
      for (let i = 0; i < 12; i++) {
        const shiftedIndex = (i + rootNote) % 12;
        correlation += chroma[shiftedIndex] * template[i];
      }
      
      profile.correlation = correlation;
    }
    
    return profiles.sort((a, b) => b.correlation - a.correlation);
  }

  /**
   * Select best key from correlations
   */
  private selectBestKey(correlations: KeyProfile[]): KeyDetectionResult {
    const best = correlations[0];
    const alternatives = correlations
      .slice(1, 4)
      .map(p => ({
        key: p.note,
        mode: p.mode,
        confidence: p.correlation / best.correlation,
      }));
    
    return {
      key: best.note,
      mode: best.mode,
      confidence: Math.min(best.correlation, 1.0),
      alternatives,
    };
  }
}