/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import MetadataAnalyzer from '../MetadataAnalyzer.js';

// Mock Web Audio API
const mockAudioContext = {
  state: 'suspended',
  sampleRate: 44100,
  resume: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
  decodeAudioData: vi.fn(),
};

const mockAudioBuffer = {
  duration: 2.5,
  sampleRate: 44100,
  numberOfChannels: 2,
  getChannelData: vi.fn(),
};

// Mock audio data for testing
const createMockAudioData = (length = 1024): Float32Array => {
  const data = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    // Create a simple sine wave with some harmonics
    data[i] =
      Math.sin((2 * Math.PI * 440 * i) / 44100) * 0.5 +
      Math.sin((2 * Math.PI * 880 * i) / 44100) * 0.25;
  }
  return data;
};

// Mock AudioContext globally
(global as any).AudioContext = vi.fn(() => mockAudioContext);

describe('MetadataAnalyzer', () => {
  let analyzer: MetadataAnalyzer;
  let mockAudioData: Float32Array;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset resume mock to succeed by default
    mockAudioContext.resume.mockResolvedValue(undefined);

    // Setup mock audio data
    mockAudioData = createMockAudioData(44100); // 1 second of audio
    mockAudioBuffer.getChannelData.mockReturnValue(mockAudioData);
    mockAudioContext.decodeAudioData.mockResolvedValue(mockAudioBuffer);

    analyzer = new MetadataAnalyzer({
      sampleRate: 44100,
      fftSize: 1024,
      highPrecision: false,
      simpleMode: true,
    });
  });

  afterEach(async () => {
    if (analyzer) {
      await analyzer.dispose();
    }
  });

  describe('Initialization', () => {
    it('should initialize successfully with default config', async () => {
      await analyzer.initialize();
      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('should initialize with custom configuration', () => {
      const customAnalyzer = new MetadataAnalyzer({
        sampleRate: 48000,
        fftSize: 2048,
        windowFunction: 'hamming',
        tempoRange: { min: 80, max: 180 },
        highPrecision: true,
        maxAnalysisDuration: 60,
        simpleMode: true,
      });

      expect(customAnalyzer).toBeDefined();
    });

    it('should handle AudioContext resume failure', async () => {
      mockAudioContext.resume.mockRejectedValue(new Error('Resume failed'));

      await expect(analyzer.initialize()).rejects.toThrow(
        'Failed to initialize MetadataAnalyzer',
      );
    });
  });

  describe('Audio Analysis', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should analyze audio file successfully', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const filename = 'test-sample.wav';

      const result = await analyzer.analyzeAudio(audioBuffer, filename);

      expect(result).toBeDefined();
      expect(result.filename).toBe(filename);
      expect(result.duration).toBe(2.5);
      expect(result.sampleRate).toBe(44100);
      expect(result.channels).toBe(2);
      expect(result.tempo).toBeDefined();
      expect(result.key).toBeDefined();
      expect(result.spectral).toBeDefined();
      expect(result.quality).toBeDefined();
      expect(result.musical).toBeDefined();
      expect(result.analyzedAt).toBeDefined();
      expect(result.version).toBe('2.4.0');
    });

    it('should cache analysis results', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const filename = 'cached-sample.wav';

      // First analysis
      const result1 = await analyzer.analyzeAudio(audioBuffer, filename);

      // Second analysis should return cached result
      const result2 = await analyzer.analyzeAudio(audioBuffer, filename);

      expect(result1).toBe(result2); // Should be same object reference
      expect(mockAudioContext.decodeAudioData).toHaveBeenCalledTimes(1);
    });

    it('should handle audio decoding failure', async () => {
      mockAudioContext.decodeAudioData.mockRejectedValue(
        new Error('Invalid audio data'),
      );

      const audioBuffer = new ArrayBuffer(1024);
      const filename = 'invalid-sample.wav';

      await expect(
        analyzer.analyzeAudio(audioBuffer, filename),
      ).rejects.toThrow('Audio analysis failed for invalid-sample.wav');
    });
  });

  describe('Tempo Detection', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should detect tempo with confidence scoring', async () => {
      // Create audio data with clear tempo pattern
      const tempoData = new Float32Array(44100 * 2); // 2 seconds
      const bpm = 120;
      const beatInterval = 60 / bpm; // seconds per beat
      const samplesPerBeat = beatInterval * 44100;

      // Add beats at regular intervals
      for (let beat = 0; beat < 4; beat++) {
        const startSample = Math.floor(beat * samplesPerBeat);
        for (let i = 0; i < 1000; i++) {
          if (startSample + i < tempoData.length) {
            tempoData[startSample + i] = 0.8; // Strong beat
          }
        }
      }

      mockAudioBuffer.getChannelData.mockReturnValue(tempoData);
      mockAudioBuffer.duration = 2.0;

      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(audioBuffer, 'tempo-test.wav');

      expect(result.tempo.bpm).toBeGreaterThan(0);
      expect(result.tempo.confidence).toBeGreaterThan(0);
      expect(result.tempo.confidence).toBeLessThanOrEqual(1);
      expect(result.tempo.candidates).toBeDefined();
      expect(result.tempo.method).toBe('autocorrelation');
    });

    it('should handle audio with no clear tempo', async () => {
      // Create random noise
      const noiseData = new Float32Array(44100);
      for (let i = 0; i < noiseData.length; i++) {
        noiseData[i] = (Math.random() - 0.5) * 0.1;
      }

      mockAudioBuffer.getChannelData.mockReturnValue(noiseData);

      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(audioBuffer, 'noise-test.wav');

      expect(result.tempo.bpm).toBeGreaterThan(0); // Should return fallback
      expect(result.tempo.confidence).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Key Detection', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should detect musical key', async () => {
      // Create audio data with clear harmonic content in C major
      const keyData = new Float32Array(44100);
      const frequencies = [261.63, 329.63, 392.0]; // C, E, G (C major triad)

      for (let i = 0; i < keyData.length; i++) {
        let sample = 0;
        frequencies.forEach((freq) => {
          sample +=
            Math.sin((2 * Math.PI * freq * i) / 44100) / frequencies.length;
        });
        keyData[i] = sample * 0.5;
      }

      mockAudioBuffer.getChannelData.mockReturnValue(keyData);

      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(audioBuffer, 'key-test.wav');

      expect(result.key.key).toBeDefined();
      expect([
        'C',
        'C#',
        'D',
        'D#',
        'E',
        'F',
        'F#',
        'G',
        'G#',
        'A',
        'A#',
        'B',
      ]).toContain(result.key.key);
      expect(['major', 'minor']).toContain(result.key.mode);
      expect(result.key.confidence).toBeGreaterThan(0);
      expect(result.key.alternatives).toBeDefined();
      expect(Array.isArray(result.key.alternatives)).toBe(true);
    });

    it('should provide alternative key suggestions', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'alternatives-test.wav',
      );

      expect(result.key.alternatives.length).toBeGreaterThan(0);
      result.key.alternatives.forEach((alt) => {
        expect(alt.key).toBeDefined();
        expect(alt.mode).toBeDefined();
        expect(alt.confidence).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Spectral Analysis', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should perform comprehensive spectral analysis', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'spectral-test.wav',
      );

      expect(result.spectral.spectralCentroid).toBeGreaterThanOrEqual(0);
      expect(result.spectral.spectralRolloff).toBeGreaterThanOrEqual(0);
      expect(result.spectral.spectralRolloff).toBeLessThanOrEqual(1);
      expect(result.spectral.spectralFlux).toBeGreaterThanOrEqual(0);
      expect(result.spectral.zeroCrossingRate).toBeGreaterThanOrEqual(0);
      expect(result.spectral.dynamicRange).toBeDefined();
      expect(result.spectral.harmonicContent).toBeDefined();
    });

    it('should analyze frequency bins correctly', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'frequency-test.wav',
      );

      const bins = result.spectral.frequencyBins;
      expect(bins.subBass).toBeGreaterThanOrEqual(0);
      expect(bins.bass).toBeGreaterThanOrEqual(0);
      expect(bins.lowMids).toBeGreaterThanOrEqual(0);
      expect(bins.mids).toBeGreaterThanOrEqual(0);
      expect(bins.highMids).toBeGreaterThanOrEqual(0);
      expect(bins.highs).toBeGreaterThanOrEqual(0);
      expect(bins.airFreqs).toBeGreaterThanOrEqual(0);

      // All frequency bins should sum to approximately 1 (normalized)
      const total =
        bins.subBass +
        bins.bass +
        bins.lowMids +
        bins.mids +
        bins.highMids +
        bins.highs +
        bins.airFreqs;
      expect(total).toBeCloseTo(1, 1);
    });

    it('should analyze harmonic content', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'harmonic-test.wav',
      );

      const harmonic = result.spectral.harmonicContent;
      expect(harmonic.harmonicRatio).toBeGreaterThanOrEqual(0);
      expect(harmonic.harmonicRatio).toBeLessThanOrEqual(1);
      expect(harmonic.fundamentalStrength).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(harmonic.harmonicDistribution)).toBe(true);
    });
  });

  describe('Quality Assessment', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should assess audio quality metrics', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'quality-test.wav',
      );

      expect(result.quality.snr).toBeDefined();
      expect(result.quality.thd).toBeDefined();
      expect(result.quality.peakLevel).toBeDefined();
      expect(result.quality.rmsLevel).toBeDefined();
      expect(result.quality.crestFactor).toBeDefined();
      expect(result.quality.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.quality.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should detect clipping', async () => {
      // Create audio data with clipping
      const clippedData = new Float32Array(1000);
      for (let i = 0; i < clippedData.length; i++) {
        clippedData[i] = i < 100 ? 1.0 : 0.5; // First 100 samples are clipped
      }

      mockAudioBuffer.getChannelData.mockReturnValue(clippedData);

      const audioBuffer = new ArrayBuffer(1024);

      // Create analyzer without simple mode for this specific test
      const testAnalyzer = new MetadataAnalyzer({
        sampleRate: 44100,
        fftSize: 1024,
        simpleMode: false, // Disable simple mode to test actual clipping detection
      });
      await testAnalyzer.initialize();

      const result = await testAnalyzer.analyzeAudio(
        audioBuffer,
        'clipped-test.wav',
      );

      expect(result.quality.clipping.detected).toBe(true);
      expect(result.quality.clipping.percentage).toBeGreaterThan(0);
      expect(Array.isArray(result.quality.clipping.samples)).toBe(true);

      await testAnalyzer.dispose();
    });

    it('should provide quality recommendations', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'recommendations-test.wav',
      );

      expect(Array.isArray(result.quality.recommendations)).toBe(true);
    });
  });

  describe('Musical Features', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should extract musical features', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'musical-test.wav',
      );

      expect(result.musical.onsetDensity).toBeGreaterThanOrEqual(0);
      expect(result.musical.rhythmComplexity).toBeGreaterThanOrEqual(0);
      expect(result.musical.harmonicRatio).toBeGreaterThanOrEqual(0);
      expect(result.musical.harmonicRatio).toBeLessThanOrEqual(1);
      expect(result.musical.energyDistribution).toBeDefined();
      expect(result.musical.musicalGenre).toBeDefined();
      expect(result.musical.instrumentClassification).toBeDefined();
    });

    it('should analyze energy distribution', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'energy-test.wav',
      );

      const energy = result.musical.energyDistribution;
      expect(energy.attack).toBeGreaterThanOrEqual(0);
      expect(energy.attack).toBeLessThanOrEqual(1);
      expect(energy.sustain).toBeGreaterThanOrEqual(0);
      expect(energy.decay).toBeGreaterThanOrEqual(0);
      expect(['percussive', 'sustained', 'mixed']).toContain(energy.overall);
    });

    it('should classify musical genre', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(audioBuffer, 'genre-test.wav');

      expect(typeof result.musical.musicalGenre).toBe('string');
      expect(result.musical.musicalGenre.length).toBeGreaterThan(0);
    });

    it('should classify instrument type', async () => {
      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(
        audioBuffer,
        'instrument-test.wav',
      );

      expect(typeof result.musical.instrumentClassification).toBe('string');
      expect(result.musical.instrumentClassification.length).toBeGreaterThan(0);
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should provide cache statistics', () => {
      const stats = analyzer.getCacheStats();

      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.maxSize).toBeGreaterThan(0);
    });

    it('should clear cache successfully', async () => {
      // Add something to cache
      const audioBuffer = new ArrayBuffer(1024);
      await analyzer.analyzeAudio(audioBuffer, 'cache-test.wav');

      let stats = analyzer.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);

      // Clear cache
      analyzer.clearCache();

      stats = analyzer.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle initialization without AudioContext', async () => {
      // Temporarily remove AudioContext
      const originalAudioContext = (global as any).AudioContext;
      delete (global as any).AudioContext;

      expect(() => new MetadataAnalyzer()).toThrow();

      // Restore AudioContext
      (global as any).AudioContext = originalAudioContext;
    });

    it('should handle analysis before initialization', async () => {
      const uninitializedAnalyzer = new MetadataAnalyzer({
        simpleMode: true, // Enable simple mode for testing
      });
      const audioBuffer = new ArrayBuffer(1024);

      // Should auto-initialize
      const result = await uninitializedAnalyzer.analyzeAudio(
        audioBuffer,
        'auto-init-test.wav',
      );

      expect(result).toBeDefined();
      await uninitializedAnalyzer.dispose();
    });

    it('should handle empty audio data', async () => {
      await analyzer.initialize();

      mockAudioBuffer.getChannelData.mockReturnValue(new Float32Array(0));
      mockAudioBuffer.duration = 0;

      const audioBuffer = new ArrayBuffer(1024);
      const result = await analyzer.analyzeAudio(audioBuffer, 'empty-test.wav');

      expect(result).toBeDefined();
      expect(result.duration).toBe(0);
    });
  });

  describe('Lifecycle Management', () => {
    it('should dispose resources properly', async () => {
      await analyzer.initialize();
      await analyzer.dispose();

      expect(mockAudioContext.close).toHaveBeenCalled();
    });

    it('should handle double disposal gracefully', async () => {
      await analyzer.initialize();
      await analyzer.dispose();

      // Second disposal should not throw
      await expect(analyzer.dispose()).resolves.not.toThrow();
    });

    it('should handle disposal without initialization', async () => {
      const newAnalyzer = new MetadataAnalyzer();

      // Should not throw even if not initialized
      await expect(newAnalyzer.dispose()).resolves.not.toThrow();
    });
  });

  describe('Configuration Validation', () => {
    it('should use default configuration for invalid values', () => {
      const analyzer = new MetadataAnalyzer({
        sampleRate: -1, // Invalid
        fftSize: 0, // Invalid
      });

      expect(analyzer).toBeDefined();
    });

    it('should handle various window functions', () => {
      const hanningAnalyzer = new MetadataAnalyzer({
        windowFunction: 'hanning',
      });
      const hammingAnalyzer = new MetadataAnalyzer({
        windowFunction: 'hamming',
      });
      const blackmanAnalyzer = new MetadataAnalyzer({
        windowFunction: 'blackman',
      });

      expect(hanningAnalyzer).toBeDefined();
      expect(hammingAnalyzer).toBeDefined();
      expect(blackmanAnalyzer).toBeDefined();
    });
  });

  describe('Performance', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should complete analysis within reasonable time', async () => {
      const startTime = performance.now();

      const audioBuffer = new ArrayBuffer(1024);
      await analyzer.analyzeAudio(audioBuffer, 'performance-test.wav');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 1 second for test data
      expect(duration).toBeLessThan(1000);
    });

    it('should handle multiple concurrent analyses', async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        const audioBuffer = new ArrayBuffer(1024);
        promises.push(
          analyzer.analyzeAudio(audioBuffer, `concurrent-test-${i}.wav`),
        );
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toBeDefined();
        expect(result.filename).toMatch(/concurrent-test-\d\.wav/);
      });
    });
  });

  describe('Integration', () => {
    beforeEach(async () => {
      await analyzer.initialize();
    });

    it('should produce consistent results for identical input', async () => {
      const audioBuffer = new ArrayBuffer(1024);

      const result1 = await analyzer.analyzeAudio(
        audioBuffer,
        'consistency-test.wav',
      );

      // Clear cache to force re-analysis
      analyzer.clearCache();

      const result2 = await analyzer.analyzeAudio(
        audioBuffer,
        'consistency-test.wav',
      );

      // Results should be structurally similar (allowing for small numerical differences)
      expect(result1.filename).toBe(result2.filename);
      expect(result1.duration).toBe(result2.duration);
      expect(result1.sampleRate).toBe(result2.sampleRate);
      expect(result1.channels).toBe(result2.channels);
    });

    it('should handle different audio formats gracefully', async () => {
      const formats = ['test.wav', 'test.mp3', 'test.flac', 'test.ogg'];

      for (const filename of formats) {
        const audioBuffer = new ArrayBuffer(1024);
        const result = await analyzer.analyzeAudio(audioBuffer, filename);

        expect(result).toBeDefined();
        expect(result.filename).toBe(filename);
      }
    });
  });
});
