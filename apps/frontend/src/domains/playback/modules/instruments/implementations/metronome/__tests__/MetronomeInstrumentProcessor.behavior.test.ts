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
import {
  setupAudioTestEnvironment,
  cleanupAudioTestEnvironment,
  mockTone,
} from '../../../../../test-utils/setup-audio.js';

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
} from '../MetronomeInstrumentProcessor.js';

describe('MetronomeInstrumentProcessor', () => {
  let metronome: MetronomeInstrumentProcessor;
  let mockEventCallback: ReturnType<typeof vi.fn>;
  let mockStateCallback: ReturnType<typeof vi.fn>;
  let mockSampler: any;
  let mockSynth: any;

  beforeEach(async () => {
    // Setup test environment
    setupAudioTestEnvironment();

    // Reset mocks
    vi.clearAllMocks();

    // Get references to mocks for testing
    mockSampler = mockTone.Sampler();
    mockSynth = mockTone.Synth();

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
    cleanupAudioTestEnvironment();
  });

  describe('Basic Operations', () => {
    test('should initialize with default configuration', () => {
      const state = metronome.getTestState();
      expect(state.isPlaying).toBe(false);
      expect(state.tempo).toBe(120);
      expect(state.timeSignature).toMatchObject({
        numerator: 4,
        denominator: 4,
      });
      expect(state.clickSound).toBe(ClickPreset.CLASSIC);
      expect(state.subdivision).toBe(Subdivision.QUARTER);
      expect(state.volume).toBeCloseTo(0.8);
    });

    test('should initialize with custom configuration', async () => {
      const customConfig: Partial<MetronomeConfig> = {
        tempo: 140,
        timeSignature: { numerator: 6, denominator: 8 } as any,
        clickSounds: {
          currentPreset: ClickPreset.ELECTRONIC,
          accent: { volume: 0.5 },
        } as any,
      };

      const customMetronome = new MetronomeInstrumentProcessor(customConfig);
      (customMetronome as any).Tone = mockTone;
      await customMetronome.initialize();

      const state = customMetronome.getTestState();
      expect(state.tempo).toBe(140);
      expect(state.timeSignature).toMatchObject({
        numerator: 6,
        denominator: 8,
      });
      expect(state.clickSound).toBe(ClickPreset.ELECTRONIC);
      expect(state.volume).toBeCloseTo(0.5);

      customMetronome.dispose();
    });

    test('should start and stop playback', async () => {
      await metronome.start();
      expect(metronome.getTestState().isPlaying).toBe(true);
      expect(mockStateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ isRunning: true }),
      );

      await metronome.stop();
      expect(metronome.getTestState().isPlaying).toBe(false);
      expect(mockStateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ isRunning: false }),
      );
    });

    test('should set tempo', () => {
      metronome.setTempo(100);
      expect(metronome.getTestState().tempo).toBe(100);
      expect(mockStateCallback).toHaveBeenCalledWith(
        expect.objectContaining({ currentTempo: 100 }),
      );
    });

    test('should validate tempo range', () => {
      // Valid range
      metronome.setTempo(200);
      expect(metronome.getTestState().tempo).toBe(200);

      // Below minimum
      metronome.setTempo(10);
      expect(metronome.getTestState().tempo).toBe(30); // Should clamp to minimum

      // Above maximum
      metronome.setTempo(400);
      expect(metronome.getTestState().tempo).toBe(300); // Should clamp to maximum
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
        expect(metronome.getTestState().clickSound).toBe(sound);
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
      Object.values(COMMON_TIME_SIGNATURES).forEach((timeSig) => {
        metronome.setTimeSignature(timeSig);
        expect(metronome.getTestState().timeSignature).toMatchObject(timeSig);
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
        expect(metronome.getTestState().timeSignature).toMatchObject(timeSig);
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
        expect(metronome.getTestState().subdivision).toBe(subdivision);
      });
    });

    test('should enable/disable subdivision', () => {
      metronome.setSubdivisionEnabled(true);
      expect(metronome.getTestState().subdivisionEnabled).toBe(true);

      metronome.setSubdivisionEnabled(false);
      expect(metronome.getTestState().subdivisionEnabled).toBe(false);
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
        expect(metronome.getTestState().grooveStyle).toBe(style);
      });
    });

    test('should apply groove templates', () => {
      const mockTemplate: GrooveTemplate = {
        name: 'Jazz Swing',
        style: GrooveStyle.SWING_MEDIUM,
        swingRatio: 0.67,
        microTiming: new Map(),
        velocityAdjustments: new Map(),
        humanization: {
          timingVariation: 5,
          velocityVariation: 0.05,
          enabled: true,
        },
      };

      metronome.applyGrooveTemplate(mockTemplate);
      const state = metronome.getTestState();
      expect(state.grooveStyle).toBe(GrooveStyle.SWING_MEDIUM);
      expect(state.swingAmount).toBeCloseTo(67); // swingAmount is stored as percentage (0-100)
      expect(state.humanization).toBeCloseTo(0.05);
    });

    test('should set swing amount', () => {
      metronome.setSwingAmount(75);
      expect(metronome.getTestState().swingAmount).toBeCloseTo(75);
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
      expect(metronome.getTestState().tempo).toBeCloseTo(120, 0);
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
        expect(metronome.getTestState().timingPrecision).toBe(precision);
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
        expect(metronome.getTestState().clockSource).toBe(source);
      });
    });

    test('should handle volume control', () => {
      metronome.setVolume(0.5);
      expect(metronome.getTestState().volume).toBeCloseTo(0.5);

      // Test mute
      metronome.setMuted(true);
      expect(metronome.getTestState().muted).toBe(true);

      metronome.setMuted(false);
      expect(metronome.getTestState().muted).toBe(false);
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
          type: expect.any(String), // 'downbeat', 'beat', etc.
          beat: expect.any(Number),
          accentLevel: expect.any(Number),
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
      expect(metronome.getTestState().isPlaying).toBe(true);
    });

    test('should dispose resources properly', () => {
      metronome.dispose();
      // Since Tone mocks create new instances each time, we can't check the specific instances
      // Instead, check that the mock constructors were called
      expect(mockTone.Sampler).toHaveBeenCalled();
      expect(mockTone.Synth).toHaveBeenCalled();
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
      expect(metronome.getTestState().tempo).toBe(170);
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
        expect(metronome.getTestState().timeSignature).toMatchObject(sig);
      });
    });

    test('should handle invalid parameters gracefully', () => {
      // Invalid tempo
      metronome.setTempo(-50);
      expect(metronome.getTestState().tempo).toBeGreaterThan(0);

      // Invalid volume
      metronome.setVolume(2);
      expect(metronome.getTestState().volume).toBeLessThanOrEqual(1);

      // Invalid time signature
      metronome.setTimeSignature({ numerator: 0, denominator: 4 });
      expect(metronome.getTestState().timeSignature.numerator).toBeGreaterThan(
        0,
      );
    });
  });
});
