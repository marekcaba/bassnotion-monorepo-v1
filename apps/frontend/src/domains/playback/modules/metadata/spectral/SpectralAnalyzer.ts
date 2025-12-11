/**
 * SpectralAnalyzer - Frequency spectrum analysis
 *
 * Analyzes spectral characteristics of audio including
 * frequency distribution, centroid, and harmonic content.
 */

import { createStructuredLogger } from '@bassnotion/contracts';
import type {
  SpectralAnalysisResult,
  FrequencyBinData,
  HarmonicContent,
} from '@bassnotion/contracts';
import type { AudioProcessingContext } from '../types.js';
import type { SpectralAnalysisConfig, SpectralFrame } from './types.js';
import { FREQUENCY_RANGES } from './types.js';

const logger = createStructuredLogger('SpectralAnalyzer');

export class SpectralAnalyzer {
  private config: SpectralAnalysisConfig;

  constructor(config: Partial<SpectralAnalysisConfig> = {}) {
    this.config = {
      fftSize: 2048,
      windowFunction: 'hanning',
      smoothingTimeConstant: 0.8,
      ...config,
    };
  }

  /**
   * Perform comprehensive spectral analysis
   */
  async analyzeSpectrum(
    audioBuffer: AudioBuffer,
    context: AudioProcessingContext,
  ): Promise<SpectralAnalysisResult> {
    // Simple mode for testing - return mock data
    if ((context as any).simpleMode) {
      return this.getMockSpectralResult();
    }

    const channelData = audioBuffer.getChannelData(0);

    // Calculate average spectrum
    const spectrum = this.calculateAverageSpectrum(channelData, context);

    // Calculate spectral features
    const spectralCentroid = this.calculateSpectralCentroid(
      spectrum,
      context.sampleRate,
    );
    const spectralRolloff = this.calculateSpectralRolloff(spectrum);
    const spectralFlux = this.calculateSpectralFlux(channelData, context);
    const zeroCrossingRate = this.calculateZeroCrossingRate(channelData);

    // Analyze frequency distribution
    const frequencyBins = this.analyzeFrequencyBins(
      spectrum,
      context.sampleRate,
    );

    // Calculate dynamic range
    const dynamicRange = this.calculateDynamicRange(channelData);

    // Analyze harmonic content
    const harmonicContent = this.analyzeHarmonicContent(
      spectrum,
      context.sampleRate,
    );

    return {
      spectralCentroid,
      spectralRolloff,
      spectralFlux,
      zeroCrossingRate,
      frequencyBins,
      dynamicRange,
      harmonicContent,
    };
  }

  /**
   * Calculate average spectrum across the audio
   */
  private calculateAverageSpectrum(
    channelData: Float32Array,
    context: AudioProcessingContext,
  ): Float32Array {
    const { fftSize } = this.config;
    const hopSize = fftSize / 2;
    const averageSpectrum = new Float32Array(fftSize / 2);
    let frameCount = 0;

    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const frame = channelData.slice(i, i + fftSize);
      const windowedFrame = this.applyWindow(frame);
      const spectrum = this.computeFFT(windowedFrame);

      for (let j = 0; j < spectrum.length; j++) {
        averageSpectrum[j] += spectrum[j];
      }
      frameCount++;
    }

    // Average the accumulated spectrum
    for (let i = 0; i < averageSpectrum.length; i++) {
      averageSpectrum[i] /= frameCount;
    }

    return averageSpectrum;
  }

  /**
   * Apply window function to frame
   */
  private applyWindow(frame: Float32Array): Float32Array {
    const windowed = new Float32Array(frame.length);
    const N = frame.length;

    switch (this.config.windowFunction) {
      case 'hanning':
        for (let i = 0; i < N; i++) {
          const window = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
          windowed[i] = frame[i] * window;
        }
        break;
      case 'hamming':
        for (let i = 0; i < N; i++) {
          const window = 0.54 - 0.46 * Math.cos((2 * Math.PI * i) / (N - 1));
          windowed[i] = frame[i] * window;
        }
        break;
      case 'blackman':
        for (let i = 0; i < N; i++) {
          const window =
            0.42 -
            0.5 * Math.cos((2 * Math.PI * i) / (N - 1)) +
            0.08 * Math.cos((4 * Math.PI * i) / (N - 1));
          windowed[i] = frame[i] * window;
        }
        break;
    }

    return windowed;
  }

  /**
   * Compute FFT magnitude spectrum
   */
  private computeFFT(frame: Float32Array): Float32Array {
    const N = frame.length;
    const spectrum = new Float32Array(N / 2);

    // Simplified DFT for demonstration - use Web Audio API in production
    for (let k = 0; k < N / 2; k++) {
      let real = 0;
      let imag = 0;

      for (let n = 0; n < N; n++) {
        const angle = (-2 * Math.PI * k * n) / N;
        real += frame[n] * Math.cos(angle);
        imag += frame[n] * Math.sin(angle);
      }

      spectrum[k] = Math.sqrt(real * real + imag * imag) / N;
    }

    return spectrum;
  }

  /**
   * Calculate spectral centroid
   */
  private calculateSpectralCentroid(
    spectrum: Float32Array,
    sampleRate: number,
  ): number {
    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let i = 0; i < spectrum.length; i++) {
      const frequency = (i * sampleRate) / (2 * spectrum.length);
      weightedSum += frequency * spectrum[i];
      magnitudeSum += spectrum[i];
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }

  /**
   * Calculate spectral rolloff
   */
  private calculateSpectralRolloff(spectrum: Float32Array): number {
    const threshold = 0.85;
    const totalEnergy = spectrum.reduce((sum, bin) => sum + bin * bin, 0);
    const targetEnergy = totalEnergy * threshold;

    let cumulativeEnergy = 0;
    for (let i = 0; i < spectrum.length; i++) {
      cumulativeEnergy += spectrum[i] * spectrum[i];
      if (cumulativeEnergy >= targetEnergy) {
        return i / spectrum.length;
      }
    }

    return 1.0;
  }

  /**
   * Calculate spectral flux
   */
  private calculateSpectralFlux(
    channelData: Float32Array,
    context: AudioProcessingContext,
  ): number {
    const { fftSize } = this.config;
    const hopSize = fftSize / 2;
    let totalFlux = 0;
    let frameCount = 0;

    let previousSpectrum = new Float32Array(fftSize / 2);

    for (let i = 0; i < channelData.length - fftSize; i += hopSize) {
      const frame = channelData.slice(i, i + fftSize);
      const windowedFrame = this.applyWindow(frame);
      const spectrum = this.computeFFT(windowedFrame);

      // Calculate flux between consecutive frames
      let flux = 0;
      for (let j = 0; j < spectrum.length; j++) {
        const diff = spectrum[j] - previousSpectrum[j];
        flux += Math.max(0, diff) ** 2;
      }

      totalFlux += Math.sqrt(flux);
      frameCount++;
      previousSpectrum = spectrum;
    }

    return frameCount > 0 ? totalFlux / frameCount : 0;
  }

  /**
   * Calculate zero crossing rate
   */
  private calculateZeroCrossingRate(channelData: Float32Array): number {
    let crossings = 0;

    for (let i = 1; i < channelData.length; i++) {
      if (channelData[i] >= 0 !== channelData[i - 1] >= 0) {
        crossings++;
      }
    }

    return crossings / (channelData.length - 1);
  }

  /**
   * Analyze frequency bin distribution
   */
  private analyzeFrequencyBins(
    spectrum: Float32Array,
    sampleRate: number,
  ): FrequencyBinData {
    const binData: FrequencyBinData = {
      subBass: 0,
      bass: 0,
      lowMids: 0,
      mids: 0,
      highMids: 0,
      highs: 0,
      airFreqs: 0,
    };

    const binFreq = sampleRate / (2 * spectrum.length);

    for (let i = 0; i < spectrum.length; i++) {
      const frequency = i * binFreq;
      const magnitude = spectrum[i];

      for (const [key, range] of Object.entries(FREQUENCY_RANGES)) {
        if (frequency >= range.minFreq && frequency < range.maxFreq) {
          binData[key as keyof FrequencyBinData] += magnitude;
        }
      }
    }

    // Normalize
    const total = Object.values(binData).reduce((sum, val) => sum + val, 0);
    if (total > 0) {
      for (const key of Object.keys(binData)) {
        binData[key as keyof FrequencyBinData] /= total;
      }
    }

    return binData;
  }

  /**
   * Calculate dynamic range in dB
   */
  private calculateDynamicRange(channelData: Float32Array): number {
    // Calculate RMS
    let sumSquares = 0;
    for (let i = 0; i < channelData.length; i++) {
      sumSquares += channelData[i] * channelData[i];
    }
    const rms = Math.sqrt(sumSquares / channelData.length);

    // Find peak
    const peak = Math.max(...channelData.map(Math.abs));

    // Calculate dynamic range in dB
    return peak > 0 && rms > 0 ? 20 * Math.log10(peak / rms) : 0;
  }

  /**
   * Analyze harmonic content
   */
  private analyzeHarmonicContent(
    spectrum: Float32Array,
    sampleRate: number,
  ): HarmonicContent {
    // Find fundamental frequency
    const fundamentalBin = this.findFundamentalFrequency(spectrum);
    const fundamentalFreq =
      (fundamentalBin * sampleRate) / (2 * spectrum.length);

    // Analyze harmonics
    const harmonicStrengths: number[] = [];
    for (let h = 1; h <= 4; h++) {
      const harmonicBin = Math.round(fundamentalBin * h);
      if (harmonicBin < spectrum.length) {
        harmonicStrengths.push(spectrum[harmonicBin]);
      }
    }

    // Calculate harmonic ratio
    const fundamentalStrength = spectrum[fundamentalBin] || 0;
    const totalHarmonic = harmonicStrengths.reduce((sum, h) => sum + h, 0);
    const harmonicRatio =
      fundamentalStrength > 0
        ? totalHarmonic / (fundamentalStrength + totalHarmonic)
        : 0;

    return {
      harmonicRatio,
      fundamentalStrength: fundamentalStrength / Math.max(...spectrum),
      harmonicDistribution: harmonicStrengths.map(
        (h) => h / Math.max(...harmonicStrengths),
      ),
    };
  }

  /**
   * Find fundamental frequency bin
   */
  private findFundamentalFrequency(spectrum: Float32Array): number {
    // Simple peak detection for fundamental
    let maxBin = 0;
    let maxValue = 0;

    // Start from bin 1 to avoid DC
    for (let i = 1; i < spectrum.length / 4; i++) {
      // Look in lower quarter
      if (spectrum[i] > maxValue) {
        maxValue = spectrum[i];
        maxBin = i;
      }
    }

    return maxBin;
  }

  /**
   * Get mock spectral result for testing
   */
  private getMockSpectralResult(): SpectralAnalysisResult {
    return {
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
    };
  }
}
