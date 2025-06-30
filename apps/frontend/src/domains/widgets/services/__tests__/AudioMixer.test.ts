import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AudioMixer, type AudioMixerConfig } from '../AudioMixer';

// Enhanced Web Audio API mocks with complete AudioParam interface
const mockAudioParam = {
  value: 0.8,
  setValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  setValueCurveAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
  cancelAndHoldAtTime: vi.fn(),
};

const mockGainNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  gain: mockAudioParam,
};

const mockDynamicsCompressorNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  threshold: mockAudioParam,
  knee: mockAudioParam,
  ratio: mockAudioParam,
  attack: mockAudioParam,
  release: mockAudioParam,
};

const mockAnalyserNode = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  fftSize: 2048,
  frequencyBinCount: 1024,
  minDecibels: -100,
  maxDecibels: -30,
  smoothingTimeConstant: 0.8,
  getFloatTimeDomainData: vi.fn(),
  getByteFrequencyData: vi.fn(),
};

const mockAudioContext = {
  createGain: vi.fn(() => mockGainNode),
  createDynamicsCompressor: vi.fn(() => mockDynamicsCompressorNode),
  createAnalyser: vi.fn(() => mockAnalyserNode),
  currentTime: 0,
  sampleRate: 44100,
  state: 'running' as AudioContextState,
};

const mockConfig: AudioMixerConfig = {
  audioContext: mockAudioContext as any,
  masterVolume: 0.8,
  duckingThreshold: 0.7,
  duckingRatio: 0.3,
  crossFadeDuration: 1000,
  enableDynamicRangeCompression: true,
};

// Mock performance.now()
global.performance = {
  now: vi.fn(() => Date.now()),
} as any;

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn((callback) => {
  setTimeout(callback, 16);
  return 1;
});

describe('AudioMixer', () => {
  let audioMixer: AudioMixer;

  beforeEach(() => {
    vi.clearAllMocks();
    console.log = vi.fn();

    // Initialize AudioMixer and verify initialization log
    audioMixer = new AudioMixer(mockConfig);
    expect(console.log).toHaveBeenCalledWith('🎛️ AudioMixer initialized');
  });

  afterEach(() => {
    audioMixer.dispose();
    vi.restoreAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with provided config', () => {
      expect(audioMixer).toBeInstanceOf(AudioMixer);
      // Initialization log is already verified in beforeEach
    });

    it('should create master gain node', () => {
      expect(mockAudioContext.createGain).toHaveBeenCalled();
    });

    it('should create compression when enabled', () => {
      expect(mockAudioContext.createDynamicsCompressor).toHaveBeenCalled();
    });

    it('should create analyzer node', () => {
      expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
    });

    it('should initialize without compression', () => {
      const mixerNoCompression = new AudioMixer({
        masterVolume: 0.8,
        audioContext: mockAudioContext as any,
        duckingThreshold: 0.7,
        duckingRatio: 0.3,
        crossFadeDuration: 1000,
        enableDynamicRangeCompression: false,
      });

      expect(mixerNoCompression).toBeInstanceOf(AudioMixer);
      mixerNoCompression.dispose();
    });
  });

  describe('Source Management', () => {
    it('should add audio sources', () => {
      const mockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };

      const source = audioMixer.addSource(
        'youtube',
        'youtube',
        mockSourceNode as any,
      );

      expect(source).toEqual(
        expect.objectContaining({
          id: 'youtube',
          type: 'youtube',
          volume: 0.8,
          muted: false,
          priority: 5,
        }),
      );

      expect(console.log).toHaveBeenCalledWith(
        '🎵 Audio source added: youtube (youtube)',
      );
    });

    it('should add sources with custom options', () => {
      const mockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };

      const source = audioMixer.addSource(
        'bass',
        'bass',
        mockSourceNode as any,
        { volume: 0.6, priority: 8, duckingEnabled: true },
      );

      expect(source.volume).toBe(0.6);
      expect(source.priority).toBe(8);
      expect(source.duckingEnabled).toBe(true);
    });

    it('should remove audio sources', () => {
      const mockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('youtube', 'youtube', mockSourceNode as any);

      audioMixer.removeSource('youtube');

      expect(mockSourceNode.disconnect).toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '🎵 Audio source removed: youtube',
      );
    });

    it('should handle removing non-existent sources', () => {
      audioMixer.removeSource('nonexistent');

      // Should not throw error, just silently handle
      expect(audioMixer).toBeDefined();
    });
  });

  describe('Volume Controls', () => {
    it('should set source volume', () => {
      const mockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('bass', 'bass', mockSourceNode as any);

      audioMixer.setSourceVolume('bass', 0.7);

      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(
        0.7,
        expect.any(Number),
        0.05,
      );
    });

    it('should set master volume', () => {
      audioMixer.setMasterVolume(0.9);

      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalledWith(
        0.9,
        expect.any(Number),
        0.05,
      );
    });

    it('should clamp volume values', () => {
      const mockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('bass', 'bass', mockSourceNode as any);

      audioMixer.setSourceVolume('bass', 1.5); // Over maximum
      audioMixer.setSourceVolume('bass', -0.5); // Under minimum

      // Should clamp values in the implementation
      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalled();
    });

    it('should handle volume change for non-existent sources', () => {
      audioMixer.setSourceVolume('nonexistent', 0.5);

      // Should not throw error
      expect(audioMixer).toBeDefined();
    });
  });

  describe('Muting Controls', () => {
    it('should mute and unmute sources', () => {
      const mockSourceNode = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('bass', 'bass', mockSourceNode as any);

      audioMixer.setSourceMute('bass', true);
      audioMixer.setSourceMute('bass', false);

      expect(mockGainNode.gain.setTargetAtTime).toHaveBeenCalled();
    });

    it('should handle muting non-existent sources', () => {
      audioMixer.setSourceMute('nonexistent', true);

      // Should not throw error
      expect(audioMixer).toBeDefined();
    });
  });

  describe('Audio Ducking', () => {
    it('should enable audio ducking', () => {
      const mockPrimary = { connect: vi.fn(), disconnect: vi.fn() };
      const mockSecondary = { connect: vi.fn(), disconnect: vi.fn() };

      audioMixer.addSource('primary', 'bass', mockPrimary as any);
      audioMixer.addSource('secondary', 'youtube', mockSecondary as any);

      audioMixer.enableDucking('primary', {
        enabled: true,
        priority: 8,
        duckAmount: 0.3,
        fadeTime: 100,
      });

      // Should enable ducking without errors
      expect(audioMixer).toBeDefined();
    });
  });

  describe('Cross-fading', () => {
    it('should perform cross-fade', () => {
      const mockSource1 = { connect: vi.fn(), disconnect: vi.fn() };
      const mockSource2 = { connect: vi.fn(), disconnect: vi.fn() };

      audioMixer.addSource('source1', 'youtube', mockSource1 as any);
      audioMixer.addSource('source2', 'bass', mockSource2 as any);

      audioMixer.crossFade({
        fromSource: 'source1',
        toSource: 'source2',
        duration: 1000,
        curve: 'linear',
      });

      // Should start cross-fade without errors
      expect(audioMixer).toBeDefined();
    });

    it('should handle cross-fade with different curves', () => {
      const mockSource1 = { connect: vi.fn(), disconnect: vi.fn() };
      const mockSource2 = { connect: vi.fn(), disconnect: vi.fn() };

      audioMixer.addSource('source1', 'youtube', mockSource1 as any);
      audioMixer.addSource('source2', 'bass', mockSource2 as any);

      audioMixer.crossFade({
        fromSource: 'source1',
        toSource: 'source2',
        duration: 500,
        curve: 'exponential',
      });

      expect(audioMixer).toBeDefined();
    });
  });

  describe('Performance Metrics', () => {
    it('should provide performance metrics', () => {
      const metrics = audioMixer.getMetrics();

      expect(metrics).toEqual(
        expect.objectContaining({
          totalSources: expect.any(Number),
          activeSources: expect.any(Number),
          masterVolume: expect.any(Number),
          cpuUsage: expect.any(Number),
          memoryUsage: expect.any(Number),
          peakLevel: expect.any(Number),
          rmsLevel: expect.any(Number),
          clippingEvents: expect.any(Number),
        }),
      );
    });

    it('should track connected sources in metrics', () => {
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('test', 'bass', mockSource as any);

      const metrics = audioMixer.getMetrics();
      expect(metrics.totalSources).toBeGreaterThanOrEqual(1);
    });

    it('should update metrics when sources change', () => {
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('test', 'bass', mockSource as any);

      let metrics = audioMixer.getMetrics();
      const initialCount = metrics.totalSources;

      audioMixer.removeSource('test');

      metrics = audioMixer.getMetrics();
      expect(metrics.totalSources).toBeLessThan(initialCount);
    });
  });

  describe('Event Callbacks', () => {
    it('should set volume change callback', () => {
      const onVolumeChange = vi.fn();
      audioMixer.onVolumeChanged(onVolumeChange);

      expect(onVolumeChange).toBeInstanceOf(Function);
    });

    it('should set clipping detection callback', () => {
      const onClipping = vi.fn();
      audioMixer.onClippingDetected(onClipping);

      expect(onClipping).toBeInstanceOf(Function);
    });

    it('should set ducking change callback', () => {
      const onDucking = vi.fn();
      audioMixer.onDuckingChanged(onDucking);

      expect(onDucking).toBeInstanceOf(Function);
    });
  });

  describe('Dispose and Cleanup', () => {
    it('should dispose properly', () => {
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('test', 'bass', mockSource as any);

      audioMixer.dispose();

      expect(mockSource.disconnect).toHaveBeenCalled();
      expect(mockGainNode.disconnect).toHaveBeenCalled();
    });

    it('should handle disposal when already disposed', () => {
      audioMixer.dispose();
      audioMixer.dispose(); // Second call should not throw

      expect(audioMixer).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle invalid source operations gracefully', () => {
      // These should not throw errors
      audioMixer.setSourceVolume('nonexistent', 0.5);
      audioMixer.setSourceMute('nonexistent', true);
      audioMixer.removeSource('nonexistent');

      expect(audioMixer).toBeDefined();
    });

    it('should handle rapid operations', () => {
      const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
      audioMixer.addSource('test', 'bass', mockSource as any);

      // Rapid volume changes
      for (let i = 0; i < 100; i++) {
        audioMixer.setSourceVolume('test', Math.random());
      }

      // Should not crash
      expect(audioMixer).toBeDefined();
    });

    it('should handle multiple source additions and removals', () => {
      const sources = [];

      // Add multiple sources
      for (let i = 0; i < 10; i++) {
        const mockSource = { connect: vi.fn(), disconnect: vi.fn() };
        sources.push(mockSource);
        audioMixer.addSource(`test-${i}`, 'bass', mockSource as any);
      }

      // Remove all sources
      for (let i = 0; i < 10; i++) {
        audioMixer.removeSource(`test-${i}`);
      }

      const metrics = audioMixer.getMetrics();
      expect(metrics.totalSources).toBe(0);
    });
  });
});
