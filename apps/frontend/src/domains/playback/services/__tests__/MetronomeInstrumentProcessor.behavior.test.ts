/**
 * MetronomeInstrumentProcessor Behavior Tests
 * Story 2.2 - Task 5: Professional Metronome System Tests
 *
 * Tests all advanced metronome features including:
 * - Multiple click sounds and presets
 * - Complex time signatures with accent patterns
 * - Subdivision support with visual indicators
 * - Groove templates and swing quantization
 * - Advanced timing precision and MIDI sync
 * - Real-time tempo changes and tap tempo
 * - Visual/audio synchronization
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';

// Create mock Tone.js module
const mockSampler = {
  dispose: vi.fn(),
  toDestination: vi.fn().mockReturnThis(),
  triggerAttackRelease: vi.fn(),
};

const mockSynth = {
  dispose: vi.fn(),
  toDestination: vi.fn().mockReturnThis(),
  triggerAttackRelease: vi.fn(),
};

const mockTransport = {
  start: vi.fn(),
  stop: vi.fn(),
  cancel: vi.fn(),
  scheduleOnce: vi.fn(),
  state: 'stopped',
  seconds: 0,
  bpm: {
    value: 120,
    rampTo: vi.fn(),
  },
};

const mockTone = {
  Sampler: vi.fn(() => mockSampler),
  Synth: vi.fn(() => mockSynth),
  Transport: mockTransport,
};

// Mock Tone.js dynamic import
vi.mock('tone', () => mockTone);

// Import after mocks are set up
import {
  MetronomeInstrumentProcessor,
  ClickSoundType,
  ClickPreset,
  Subdivision,
  AccentLevel,
  GrooveStyle,
  TimingPrecision,
  ClockSource,
  COMMON_TIME_SIGNATURES,
  type MetronomeConfig,
  type AccentPattern,
  type GrooveTemplate,
} from '../plugins/MetronomeInstrumentProcessor';

describe('MetronomeInstrumentProcessor', () => {
  let metronome: MetronomeInstrumentProcessor;
  let mockEventCallback: ReturnType<typeof vi.fn>;
  let mockStateCallback: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock callbacks
    mockEventCallback = vi.fn();
    mockStateCallback = vi.fn();

    // Create metronome with default config
    metronome = new MetronomeInstrumentProcessor();
    // Manually inject the mocked Tone to bypass dynamic loading
    (metronome as any).Tone = mockTone;

    // Register callbacks
    metronome.onEvent(mockEventCallback);
    metronome.onStateChange(mockStateCallback);

    // Initialize
    await metronome.initialize();
  });

  afterEach(() => {
    if (metronome) {
      metronome.dispose();
    }
  });

  describe('Basic Operations', () => {
    test('should initialize with default configuration', () => {
      const state = metronome.getState();
      expect(state.isPlaying).toBe(false);
      expect(state.tempo).toBe(120);
      expect(state.timeSignature).toEqual({ numerator: 4, denominator: 4 });
      expect(state.clickSound).toBe(ClickSoundType.STANDARD);
      expect(state.subdivision).toBe(Subdivision.QUARTER);
      expect(state.volume).toBeCloseTo(0.7);
    });

    test('should initialize with custom configuration', async () => {
      const customConfig: Partial<MetronomeConfig> = {
        tempo: 140,
        timeSignature: { numerator: 6, denominator: 8 },
        clickSound: ClickSoundType.ELECTRONIC,
        volume: 0.5,
      };

      const customMetronome = new MetronomeInstrumentProcessor(customConfig);
      (customMetronome as any).Tone = mockTone;
      await customMetronome.initialize();

      const state = customMetronome.getState();
      expect(state.tempo).toBe(140);
      expect(state.timeSignature).toEqual({ numerator: 6, denominator: 8 });
      expect(state.clickSound).toBe(ClickSoundType.ELECTRONIC);
      expect(state.volume).toBeCloseTo(0.5);

      customMetronome.dispose();
    });

    test('should start and stop playback', async () => {
      await metronome.start();
      expect(metronome.getState().isPlaying).toBe(true);
      expect(mockStateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ isPlaying: true }),
      );

      await metronome.stop();
      expect(metronome.getState().isPlaying).toBe(false);
      expect(mockStateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ isPlaying: false }),
      );
    });

    test('should set tempo', () => {
      metronome.setTempo(100);
      expect(metronome.getState().tempo).toBe(100);
      expect(mockStateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ tempo: 100 }),
      );
    });

    test('should validate tempo range', () => {
      // Valid range
      metronome.setTempo(200);
      expect(metronome.getState().tempo).toBe(200);

      // Below minimum
      metronome.setTempo(10);
      expect(metronome.getState().tempo).toBe(30); // Should clamp to minimum

      // Above maximum
      metronome.setTempo(400);
      expect(metronome.getState().tempo).toBe(300); // Should clamp to maximum
    });
  });

  describe('Click Sounds and Presets', () => {
    test('should change click sound type', () => {
      const clickSounds = [
        ClickSoundType.STANDARD,
        ClickSoundType.ELECTRONIC,
        ClickSoundType.WOODBLOCK,
        ClickSoundType.COWBELL,
        ClickSoundType.HIHAT,
        ClickSoundType.RIMSHOT,
        ClickSoundType.CLAVES,
        ClickSoundType.TAMBOURINE,
      ];

      clickSounds.forEach((sound) => {
        metronome.setClickSound(sound);
        expect(metronome.getState().clickSound).toBe(sound);
      });
    });

    test('should apply click presets', () => {
      const presets = [
        ClickPreset.ACOUSTIC,
        ClickPreset.ELECTRONIC,
        ClickPreset.VINTAGE,
        ClickPreset.MODERN,
        ClickPreset.LATIN,
        ClickPreset.JAZZ,
        ClickPreset.ROCK,
        ClickPreset.ORCHESTRAL,
      ];

      presets.forEach((preset) => {
        metronome.applyClickPreset(preset);
        // Preset should update multiple parameters
        expect(mockStateCallback).toHaveBeenCalled();
      });
    });
  });

  describe('Time Signatures', () => {
    test('should support common time signatures', () => {
      COMMON_TIME_SIGNATURES.forEach((timeSig) => {
        metronome.setTimeSignature(timeSig);
        expect(metronome.getState().timeSignature).toEqual(timeSig);
      });
    });

    test('should handle complex time signatures', () => {
      const complexSignatures = [
        { numerator: 7, denominator: 8 },
        { numerator: 5, denominator: 4 },
        { numerator: 9, denominator: 8 },
        { numerator: 12, denominator: 8 },
      ];

      complexSignatures.forEach((timeSig) => {
        metronome.setTimeSignature(timeSig);
        expect(metronome.getState().timeSignature).toEqual(timeSig);
      });
    });

    test('should update accent pattern when time signature changes', () => {
      metronome.setTimeSignature({ numerator: 6, denominator: 8 });
      const pattern = metronome.getAccentPattern();
      expect(pattern.length).toBe(6);
      expect(pattern[0]).toBe(AccentLevel.STRONG);
      expect(pattern[3]).toBe(AccentLevel.MEDIUM);
    });
  });

  describe('Accent Patterns', () => {
    test('should set custom accent patterns', () => {
      const customPattern: AccentPattern = [
        AccentLevel.STRONG,
        AccentLevel.WEAK,
        AccentLevel.MEDIUM,
        AccentLevel.WEAK,
      ];

      metronome.setAccentPattern(customPattern);
      expect(metronome.getAccentPattern()).toEqual(customPattern);
    });

    test('should update pattern correctly when switching time signatures', () => {
      // 4/4 time
      metronome.setTimeSignature({ numerator: 4, denominator: 4 });
      let pattern = metronome.getAccentPattern();
      expect(pattern.length).toBe(4);

      // 3/4 time
      metronome.setTimeSignature({ numerator: 3, denominator: 4 });
      pattern = metronome.getAccentPattern();
      expect(pattern.length).toBe(3);
    });
  });

  describe('Subdivisions', () => {
    test('should support all subdivision types', () => {
      const subdivisions = [
        Subdivision.QUARTER,
        Subdivision.EIGHTH,
        Subdivision.TRIPLET,
        Subdivision.SIXTEENTH,
        Subdivision.QUINTUPLET,
        Subdivision.SEXTUPLET,
        Subdivision.SEPTUPLET,
      ];

      subdivisions.forEach((subdivision) => {
        metronome.setSubdivision(subdivision);
        expect(metronome.getState().subdivision).toBe(subdivision);
      });
    });

    test('should enable/disable subdivision', () => {
      metronome.setSubdivisionEnabled(true);
      expect(metronome.getState().subdivisionEnabled).toBe(true);

      metronome.setSubdivisionEnabled(false);
      expect(metronome.getState().subdivisionEnabled).toBe(false);
    });
  });

  describe('Groove and Swing', () => {
    test('should apply groove styles', () => {
      const grooveStyles = [
        GrooveStyle.STRAIGHT,
        GrooveStyle.SWING_LIGHT,
        GrooveStyle.SWING_MEDIUM,
        GrooveStyle.SWING_HEAVY,
        GrooveStyle.SHUFFLE,
        GrooveStyle.LATIN,
        GrooveStyle.BRAZILIAN,
      ];

      grooveStyles.forEach((style) => {
        metronome.setGrooveStyle(style);
        expect(metronome.getState().grooveStyle).toBe(style);
      });
    });

    test('should apply groove templates', () => {
      const mockTemplate: GrooveTemplate = {
        name: 'Jazz Swing',
        style: GrooveStyle.SWING_MEDIUM,
        timeSignature: { numerator: 4, denominator: 4 },
        swingRatio: 0.67,
        humanization: 0.05,
      };

      metronome.applyGrooveTemplate(mockTemplate);
      const state = metronome.getState();
      expect(state.grooveStyle).toBe(GrooveStyle.SWING_MEDIUM);
      expect(state.swingAmount).toBeCloseTo(0.67);
      expect(state.humanization).toBeCloseTo(0.05);
    });

    test('should set swing amount', () => {
      metronome.setSwingAmount(0.75);
      expect(metronome.getState().swingAmount).toBeCloseTo(0.75);
    });
  });

  describe('Advanced Features', () => {
    test('should implement tap tempo', () => {
      const taps = [0, 500, 1000, 1500]; // 120 BPM
      taps.forEach((time) => {
        vi.setSystemTime(time);
        metronome.tapTempo();
      });

      // Should calculate tempo from tap intervals
      expect(metronome.getState().tempo).toBeCloseTo(120, 0);
    });

    test('should handle tempo ramp', async () => {
      await metronome.start();
      await metronome.tempoRamp(120, 160, 4000); // Ramp from 120 to 160 over 4 seconds

      // Verify ramp was initiated
      expect(mockTone.Transport.bpm.rampTo).toHaveBeenCalledWith(160, 4);
    });

    test('should set timing precision', () => {
      const precisionLevels = [
        TimingPrecision.RELAXED,
        TimingPrecision.MEDIUM,
        TimingPrecision.TIGHT,
        TimingPrecision.SAMPLE_ACCURATE,
      ];

      precisionLevels.forEach((precision) => {
        metronome.setTimingPrecision(precision);
        expect(metronome.getState().timingPrecision).toBe(precision);
      });
    });

    test('should set clock source', () => {
      const clockSources = [
        ClockSource.INTERNAL,
        ClockSource.MIDI,
        ClockSource.EXTERNAL,
      ];

      clockSources.forEach((source) => {
        metronome.setClockSource(source);
        expect(metronome.getState().clockSource).toBe(source);
      });
    });

    test('should handle volume control', () => {
      metronome.setVolume(0.5);
      expect(metronome.getState().volume).toBeCloseTo(0.5);

      // Test mute
      metronome.setMuted(true);
      expect(metronome.getState().muted).toBe(true);

      metronome.setMuted(false);
      expect(metronome.getState().muted).toBe(false);
    });
  });

  describe('Visual Sync', () => {
    test('should emit events for visual synchronization', async () => {
      await metronome.start();

      // Simulate a beat
      const beatCallback = mockTone.Transport.scheduleOnce.mock.calls[0]?.[0];
      if (beatCallback) {
        beatCallback(0);
      }

      expect(mockEventCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'click',
          beat: expect.any(Number),
          accent: expect.any(String),
        }),
      );
    });

    test('should provide beat position info', () => {
      metronome.setTimeSignature({ numerator: 4, denominator: 4 });
      const position = metronome.getBeatPosition();
      expect(position).toHaveProperty('currentBeat');
      expect(position).toHaveProperty('totalBeats');
      expect(position).toHaveProperty('measureNumber');
    });
  });

  describe('Resource Management', () => {
    test('should handle multiple starts without issues', async () => {
      await metronome.start();
      await metronome.start(); // Should handle gracefully
      expect(metronome.getState().isPlaying).toBe(true);
    });

    test('should dispose resources properly', () => {
      metronome.dispose();
      expect(mockSampler.dispose).toHaveBeenCalled();
      expect(mockSynth.dispose).toHaveBeenCalled();
    });

    test('should handle operations after disposal', () => {
      metronome.dispose();
      expect(() => metronome.setTempo(140)).not.toThrow();
      expect(() => metronome.start()).not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    test('should handle rapid tempo changes', () => {
      for (let i = 0; i < 10; i++) {
        metronome.setTempo(80 + i * 10);
      }
      expect(metronome.getState().tempo).toBe(170);
    });

    test('should handle complex time signature changes during playback', async () => {
      await metronome.start();

      const signatures = [
        { numerator: 4, denominator: 4 },
        { numerator: 7, denominator: 8 },
        { numerator: 5, denominator: 4 },
        { numerator: 3, denominator: 4 },
      ];

      signatures.forEach((sig) => {
        metronome.setTimeSignature(sig);
        expect(metronome.getState().timeSignature).toEqual(sig);
      });
    });

    test('should handle invalid parameters gracefully', () => {
      // Invalid tempo
      metronome.setTempo(-50);
      expect(metronome.getState().tempo).toBeGreaterThan(0);

      // Invalid volume
      metronome.setVolume(2);
      expect(metronome.getState().volume).toBeLessThanOrEqual(1);

      // Invalid time signature
      metronome.setTimeSignature({ numerator: 0, denominator: 4 });
      expect(metronome.getState().timeSignature.numerator).toBeGreaterThan(0);
    });
  });
});
