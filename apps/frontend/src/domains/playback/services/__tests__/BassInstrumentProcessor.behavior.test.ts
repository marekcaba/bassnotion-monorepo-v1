/**
 * BassInstrumentProcessor Behavior Tests
 * Story 2.2 - Task 2: Professional Bass Instrument Infrastructure Tests
 *
 * Tests cover:
 * - Bass instrument initialization and configuration
 * - Multi-layered sample support and velocity layers
 * - Advanced articulation detection and processing
 * - Pitch bend support for realistic bass slides
 * - Bass-specific audio processing with amp simulation
 * - Expression capabilities and dynamic range control
 * - Comprehensive bass note mapping (B0-G4)
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  BassInstrumentProcessor,
  BassInstrumentConfig,
  BassPlaybackEvent,
  BassExpressionState,
} from '../plugins/BassInstrumentProcessor.js';
import { ArticulationType } from '../plugins/MidiParserProcessor.js';

// Mock Tone.js completely
vi.mock('tone', () => ({
  Sampler: vi.fn().mockImplementation(() => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    connect: vi.fn(),
    dispose: vi.fn(),
  })),
  Gain: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    dispose: vi.fn(),
    gain: { value: 0 },
  })),
  EQ3: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    dispose: vi.fn(),
  })),
  Compressor: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    dispose: vi.fn(),
  })),
  loaded: vi.fn().mockResolvedValue(undefined),
  now: vi.fn().mockReturnValue(0),
  getDestination: vi.fn().mockReturnValue({}),
}));

describe('BassInstrumentProcessor', () => {
  let bassProcessor: BassInstrumentProcessor;
  let mockBassSamples: Record<string, string[]>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockBassSamples = {
      B0: ['bass-b0-sample1.wav'],
      C1: ['bass-c1-sample1.wav'],
      D1: ['bass-d1-sample1.wav'],
      E1: ['bass-e1-sample1.wav'],
      G4: ['bass-g4-sample1.wav'],
    };

    bassProcessor = new BassInstrumentProcessor();
  });

  afterEach(() => {
    bassProcessor.dispose();
  });

  describe('Initialization and Configuration', () => {
    it('should create bass processor with default configuration', () => {
      const status = bassProcessor.getStatus();

      expect(status.isInitialized).toBe(false);
      expect(status.noteRange.lowest).toBe('B0');
      expect(status.noteRange.highest).toBe('G4');
      expect(status.loadedSamples).toBe(0);
    });

    it('should create bass processor with custom configuration', () => {
      const customConfig: Partial<BassInstrumentConfig> = {
        velocityLayers: 8,
        pitchBendRange: 4,
      };

      const customBassProcessor = new BassInstrumentProcessor(customConfig);
      const status = customBassProcessor.getStatus();

      expect(status.isInitialized).toBe(false);

      customBassProcessor.dispose();
    });

    it('should initialize successfully with bass samples', async () => {
      await bassProcessor.initialize(mockBassSamples);

      const status = bassProcessor.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.loadedSamples).toBe(45); // B0 to G4 = 45 notes
    });
  });

  describe('Bass Note Range and Mapping', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should handle bass note range correctly', () => {
      const status = bassProcessor.getStatus();
      const noteRange = status.noteRange;

      expect(noteRange.lowest).toBe('B0');
      expect(noteRange.highest).toBe('G4');
      expect(noteRange.totalNotes).toBe(41); // Configuration value
    });

    it('should generate complete bass note mapping', () => {
      const status = bassProcessor.getStatus();
      expect(status.loadedSamples).toBe(45); // Actual mapped notes B0-G4
    });
  });

  describe('Bass Note Playback', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should play bass note with basic parameters', () => {
      const playbackEvent: BassPlaybackEvent = {
        note: 'E',
        octave: 1,
        velocity: 80,
        articulation: ArticulationType.LEGATO,
      };

      expect(() => bassProcessor.playNote(playbackEvent)).not.toThrow();
    });

    it('should handle different velocity levels', () => {
      const velocities = [20, 40, 60, 80, 100, 120];

      velocities.forEach((velocity) => {
        const playbackEvent: BassPlaybackEvent = {
          note: 'A',
          octave: 1,
          velocity,
          articulation: ArticulationType.LEGATO,
        };

        expect(() => bassProcessor.playNote(playbackEvent)).not.toThrow();
      });
    });

    it('should stop bass note correctly', () => {
      expect(() => bassProcessor.stopNote('E', 1)).not.toThrow();
    });

    it('should handle invalid notes gracefully', () => {
      const invalidEvent: BassPlaybackEvent = {
        note: 'X', // Invalid note
        octave: 1,
        velocity: 80,
        articulation: ArticulationType.LEGATO,
      };

      expect(() => bassProcessor.playNote(invalidEvent)).not.toThrow();
    });
  });

  describe('Articulation Processing', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should process all supported articulation types', () => {
      const supportedArticulations = [
        ArticulationType.LEGATO,
        ArticulationType.STACCATO,
        ArticulationType.SLIDE,
        ArticulationType.HAMMER_ON,
        ArticulationType.PULL_OFF,
        ArticulationType.GHOST,
        ArticulationType.ACCENT,
      ];

      supportedArticulations.forEach((articulation) => {
        const event: BassPlaybackEvent = {
          note: 'G',
          octave: 1,
          velocity: 80,
          articulation,
        };

        expect(() => bassProcessor.playNote(event)).not.toThrow();
      });
    });

    it('should handle articulation-specific processing', () => {
      const ghostEvent: BassPlaybackEvent = {
        note: 'A',
        octave: 1,
        velocity: 60,
        articulation: ArticulationType.GHOST,
      };

      const accentEvent: BassPlaybackEvent = {
        note: 'F',
        octave: 1,
        velocity: 70,
        articulation: ArticulationType.ACCENT,
      };

      expect(() => bassProcessor.playNote(ghostEvent)).not.toThrow();
      expect(() => bassProcessor.playNote(accentEvent)).not.toThrow();
    });
  });

  describe('Pitch Bend Support', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should apply pitch bend to bass notes', () => {
      const pitchBendEvent: BassPlaybackEvent = {
        note: 'G',
        octave: 2,
        velocity: 80,
        articulation: ArticulationType.LEGATO,
        pitchBend: 10000, // Bend up
      };

      expect(() => bassProcessor.playNote(pitchBendEvent)).not.toThrow();
    });

    it('should update pitch bend in real-time', () => {
      bassProcessor.updatePitchBend(12000);

      const status = bassProcessor.getStatus();
      expect(status.currentExpression.pitchBend).toBe(12000);
    });

    it('should handle extreme pitch bend values', () => {
      const extremeBendEvent: BassPlaybackEvent = {
        note: 'D',
        octave: 1,
        velocity: 70,
        articulation: ArticulationType.LEGATO,
        pitchBend: 16383, // Maximum bend
      };

      expect(() => bassProcessor.playNote(extremeBendEvent)).not.toThrow();
    });
  });

  describe('Expression and Dynamics', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should update expression state', () => {
      const newExpression: Partial<BassExpressionState> = {
        modulation: 64,
        expression: 100,
        aftertouch: 30,
        sustainPedal: true,
      };

      bassProcessor.updateExpression(newExpression);

      const status = bassProcessor.getStatus();
      expect(status.currentExpression.modulation).toBe(64);
      expect(status.currentExpression.expression).toBe(100);
      expect(status.currentExpression.aftertouch).toBe(30);
      expect(status.currentExpression.sustainPedal).toBe(true);
    });

    it('should process expression with velocity curves', () => {
      const expressionEvent: BassPlaybackEvent = {
        note: 'F',
        octave: 2,
        velocity: 90,
        articulation: ArticulationType.LEGATO,
        expression: 80,
      };

      expect(() => bassProcessor.playNote(expressionEvent)).not.toThrow();
    });

    it('should handle dynamic range control', () => {
      const lowVelocityEvent: BassPlaybackEvent = {
        note: 'C',
        octave: 1,
        velocity: 20,
        articulation: ArticulationType.LEGATO,
      };

      const highVelocityEvent: BassPlaybackEvent = {
        note: 'C',
        octave: 1,
        velocity: 120,
        articulation: ArticulationType.LEGATO,
      };

      expect(() => bassProcessor.playNote(lowVelocityEvent)).not.toThrow();
      expect(() => bassProcessor.playNote(highVelocityEvent)).not.toThrow();
    });
  });

  describe('Resource Management', () => {
    it('should handle uninitialized state gracefully', () => {
      const uninitializedProcessor = new BassInstrumentProcessor();

      const playbackEvent: BassPlaybackEvent = {
        note: 'E',
        octave: 1,
        velocity: 80,
        articulation: ArticulationType.LEGATO,
      };

      expect(() =>
        uninitializedProcessor.playNote(playbackEvent),
      ).not.toThrow();
      expect(() => uninitializedProcessor.stopNote('E', 1)).not.toThrow();

      uninitializedProcessor.dispose();
    });

    it('should dispose resources properly', () => {
      bassProcessor.dispose();

      const status = bassProcessor.getStatus();
      expect(status.isInitialized).toBe(false);
    });

    it('should handle multiple dispose calls', () => {
      bassProcessor.dispose();
      expect(() => bassProcessor.dispose()).not.toThrow();
    });
  });

  describe('Performance and Edge Cases', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should handle rapid note triggering', () => {
      const rapidEvents: BassPlaybackEvent[] = Array.from(
        { length: 10 },
        (_, i) => ({
          note: 'E',
          octave: 1,
          velocity: 80 + i,
          articulation: ArticulationType.LEGATO,
          time: i * 0.1,
        }),
      );

      rapidEvents.forEach((event) => {
        expect(() => bassProcessor.playNote(event)).not.toThrow();
      });
    });

    it('should handle extreme velocity values', () => {
      const extremeVelocities = [0, 1, 126, 127, 200]; // Including out-of-range

      extremeVelocities.forEach((velocity) => {
        const event: BassPlaybackEvent = {
          note: 'A',
          octave: 1,
          velocity,
          articulation: ArticulationType.LEGATO,
        };

        expect(() => bassProcessor.playNote(event)).not.toThrow();
      });
    });

    it('should handle concurrent note playback', () => {
      const concurrentEvents: BassPlaybackEvent[] = [
        {
          note: 'E',
          octave: 1,
          velocity: 80,
          articulation: ArticulationType.LEGATO,
        },
        {
          note: 'A',
          octave: 1,
          velocity: 75,
          articulation: ArticulationType.STACCATO,
        },
        {
          note: 'D',
          octave: 2,
          velocity: 85,
          articulation: ArticulationType.ACCENT,
        },
      ];

      concurrentEvents.forEach((event) => {
        expect(() => bassProcessor.playNote(event)).not.toThrow();
      });
    });

    it('should maintain performance with complex expression changes', () => {
      const complexExpressionChanges = Array.from({ length: 20 }, (_, i) => ({
        pitchBend: i * 100,
        modulation: (i * 6) % 128,
        expression: 127 - i * 5,
        aftertouch: (i * 3) % 128,
        sustainPedal: i % 2 === 0,
      }));

      complexExpressionChanges.forEach((expression) => {
        expect(() => bassProcessor.updateExpression(expression)).not.toThrow();
      });

      const status = bassProcessor.getStatus();
      expect(status.currentExpression).toBeDefined();
    });
  });

  describe('Integration with MIDI Parser', () => {
    beforeEach(async () => {
      await bassProcessor.initialize(mockBassSamples);
    });

    it('should process MIDI-like timing information', () => {
      const timedEvent: BassPlaybackEvent = {
        note: 'B',
        octave: 1,
        velocity: 90,
        articulation: ArticulationType.LEGATO,
        time: 1.5, // Specific timing
        duration: 2.0,
      };

      expect(() => bassProcessor.playNote(timedEvent)).not.toThrow();
    });

    it('should handle comprehensive bass features', () => {
      const comprehensiveEvent: BassPlaybackEvent = {
        note: 'F',
        octave: 2,
        velocity: 95,
        articulation: ArticulationType.SLIDE,
        pitchBend: 8500,
        expression: 110,
        duration: 1.5,
        time: 0.5,
      };

      expect(() => bassProcessor.playNote(comprehensiveEvent)).not.toThrow();
    });
  });
});
