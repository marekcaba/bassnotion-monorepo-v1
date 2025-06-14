/**
 * DrumInstrumentProcessor Behavior Tests
 * Story 2.2 - Task 3: Advanced Drum Instrument Infrastructure Tests
 *
 * Tests cover Logic Pro X Drummer-inspired features:
 * - MIDI drum patterns with velocity, ghost notes, accents, humanization
 * - Pre-recorded audio drum loops with time-stretching
 * - Adjustable swing/groove (Logic Pro A/B/C styles)
 * - Interactive fills with user triggering and scheduling
 * - Pattern/loop management with quantized switching
 * - Hybrid mode: layer MIDI hits over audio loops
 * - General MIDI compliance with extended percussion mapping
 * - Individual drum piece volume control and velocity-sensitive dynamics
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  DrumInstrumentProcessor,
  DrumInstrumentConfig,
  DrumEvent,
  DrumPiece,
  DrumHitType,
  DrumMode,
  GrooveStyle,
  LoopLength,
  DrumStyle,
  GM_DRUM_MAP,
} from '../plugins/DrumInstrumentProcessor.js';

// Mock Tone.js with comprehensive audio loop support
vi.mock('tone', () => ({
  Sampler: vi.fn().mockImplementation(() => ({
    triggerAttack: vi.fn(),
    triggerRelease: vi.fn(),
    connect: vi.fn(),
    dispose: vi.fn(),
    volume: { value: 0 },
    toDestination: vi.fn().mockReturnThis(),
  })),
  Player: vi.fn().mockImplementation(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    connect: vi.fn(),
    dispose: vi.fn(),
    loop: true,
    volume: { value: -6 },
    autostart: false,
    toDestination: vi.fn().mockReturnThis(),
    loaded: true,
  })),
  Transport: {
    scheduleRepeat: vi.fn().mockReturnValue(1),
    scheduleOnce: vi.fn(),
    clear: vi.fn(),
    bpm: { value: 120 },
  },
  Time: vi.fn().mockImplementation((time) => ({
    toSeconds: () => parseFloat(time.replace('m', '')) * 2, // Mock: 1 measure = 2 seconds
  })),
  loaded: vi.fn().mockResolvedValue(undefined),
  getDestination: vi.fn().mockReturnValue({}),
  gainToDb: vi.fn().mockImplementation((gain) => Math.log10(gain) * 20),
}));

describe('DrumInstrumentProcessor', () => {
  let drumProcessor: DrumInstrumentProcessor;
  let mockDrumSamples: Record<DrumPiece, string[]>;
  let mockAudioLoops: Record<string, string>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock drum samples
    mockDrumSamples = {
      [DrumPiece.KICK]: ['kick-sample1.wav', 'kick-sample2.wav'],
      [DrumPiece.SNARE]: ['snare-sample1.wav', 'snare-sample2.wav'],
      [DrumPiece.HIHAT_CLOSED]: ['hihat-closed-sample1.wav'],
      [DrumPiece.HIHAT_OPEN]: ['hihat-open-sample1.wav'],
      [DrumPiece.HIHAT_PEDAL]: ['hihat-pedal-sample1.wav'],
      [DrumPiece.CRASH_1]: ['crash1-sample1.wav'],
      [DrumPiece.CRASH_2]: ['crash2-sample1.wav'],
      [DrumPiece.RIDE]: ['ride-sample1.wav'],
      [DrumPiece.RIDE_BELL]: ['ride-bell-sample1.wav'],
      [DrumPiece.TOM_1]: ['tom1-sample1.wav'],
      [DrumPiece.TOM_2]: ['tom2-sample1.wav'],
      [DrumPiece.TOM_3]: ['tom3-sample1.wav'],
      [DrumPiece.CLAP]: ['clap-sample1.wav'],
      [DrumPiece.COWBELL]: ['cowbell-sample1.wav'],
      [DrumPiece.TAMBOURINE]: ['tambourine-sample1.wav'],
      [DrumPiece.SHAKER]: ['shaker-sample1.wav'],
      [DrumPiece.SIDE_STICK]: ['side-stick-sample1.wav'],
    };

    // Setup mock audio loops
    mockAudioLoops = {
      rock_loop_120: 'rock-loop-120bpm.wav',
      jazz_loop_140: 'jazz-loop-140bpm.wav',
      funk_loop_110: 'funk-loop-110bpm.wav',
    };

    drumProcessor = new DrumInstrumentProcessor();
  });

  afterEach(() => {
    drumProcessor.dispose();
  });

  describe('Initialization and Configuration', () => {
    it('should create drum processor with default configuration', () => {
      const status = drumProcessor.getStatus();

      expect(status.isInitialized).toBe(false);
      expect(status.mode).toBe(DrumMode.MIDI_ONLY);
      expect(status.grooveStyle).toBe(GrooveStyle.STRAIGHT);
      expect(status.swingAmount).toBe(0);
      expect(status.loopLength).toBe(LoopLength.FOUR_BARS);
      expect(status.loadedSamples).toBe(0);
    });

    it('should create drum processor with custom configuration', () => {
      const customConfig: Partial<DrumInstrumentConfig> = {
        mode: DrumMode.HYBRID,
        grooveStyle: GrooveStyle.SWING_A,
        swingAmount: 60,
        loopLength: LoopLength.EIGHT_BARS,
        humanizationAmount: 0.2,
      };

      const customDrumProcessor = new DrumInstrumentProcessor(customConfig);
      const status = customDrumProcessor.getStatus();

      expect(status.mode).toBe(DrumMode.HYBRID);
      expect(status.grooveStyle).toBe(GrooveStyle.SWING_A);
      expect(status.swingAmount).toBe(60);
      expect(status.loopLength).toBe(LoopLength.EIGHT_BARS);

      customDrumProcessor.dispose();
    });

    it('should initialize successfully with drum samples', async () => {
      await drumProcessor.initialize(mockDrumSamples);

      const status = drumProcessor.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.loadedSamples).toBe(Object.keys(mockDrumSamples).length);
    });

    it('should initialize with both samples and audio loops', async () => {
      await drumProcessor.initialize(mockDrumSamples, mockAudioLoops);

      const status = drumProcessor.getStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.loadedSamples).toBe(Object.keys(mockDrumSamples).length);
    });
  });

  describe('General MIDI Compliance', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should have comprehensive GM drum mapping', () => {
      // Test standard GM drum notes
      expect(GM_DRUM_MAP[36]).toBe(DrumPiece.KICK); // Bass Drum 1
      expect(GM_DRUM_MAP[38]).toBe(DrumPiece.SNARE); // Acoustic Snare
      expect(GM_DRUM_MAP[42]).toBe(DrumPiece.HIHAT_CLOSED); // Closed Hi Hat
      expect(GM_DRUM_MAP[46]).toBe(DrumPiece.HIHAT_OPEN); // Open Hi-Hat
      expect(GM_DRUM_MAP[49]).toBe(DrumPiece.CRASH_1); // Crash Cymbal 1
      expect(GM_DRUM_MAP[51]).toBe(DrumPiece.RIDE); // Ride Cymbal 1

      // Test extended percussion
      expect(GM_DRUM_MAP[39]).toBe(DrumPiece.CLAP); // Hand Clap
      expect(GM_DRUM_MAP[56]).toBe(DrumPiece.COWBELL); // Cowbell
      expect(GM_DRUM_MAP[54]).toBe(DrumPiece.TAMBOURINE); // Tambourine
    });

    it('should play MIDI events using GM mapping', () => {
      const midiEvents = [
        { note: 36, velocity: 100 }, // Kick
        { note: 38, velocity: 90 }, // Snare
        { note: 42, velocity: 70 }, // Closed Hi-Hat
        { note: 49, velocity: 110 }, // Crash
      ];

      midiEvents.forEach(({ note, velocity }) => {
        expect(() => drumProcessor.playMidiEvent(note, velocity)).not.toThrow();
      });
    });

    it('should handle unknown MIDI notes gracefully', () => {
      const unknownMidiNote = 127; // Not in GM drum map

      expect(() =>
        drumProcessor.playMidiEvent(unknownMidiNote, 100),
      ).not.toThrow();
    });
  });

  describe('Drum Hit Processing', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should play individual drum hits', () => {
      const drumEvent: DrumEvent = {
        time: 0,
        drumPiece: DrumPiece.KICK,
        velocity: 100,
        type: DrumHitType.NORMAL,
      };

      expect(() => drumProcessor.playDrumHit(drumEvent)).not.toThrow();
    });

    it('should handle different hit types', () => {
      const hitTypes = [
        DrumHitType.NORMAL,
        DrumHitType.GHOST,
        DrumHitType.ACCENT,
        DrumHitType.FLAM,
        DrumHitType.ROLL,
      ];

      hitTypes.forEach((type) => {
        const drumEvent: DrumEvent = {
          time: 0,
          drumPiece: DrumPiece.SNARE,
          velocity: 80,
          type,
        };

        expect(() => drumProcessor.playDrumHit(drumEvent)).not.toThrow();
      });
    });

    it('should process velocity-sensitive dynamics', () => {
      const velocities = [10, 30, 50, 80, 100, 127];

      velocities.forEach((velocity) => {
        const drumEvent: DrumEvent = {
          time: 0,
          drumPiece: DrumPiece.SNARE,
          velocity,
          type: DrumHitType.NORMAL,
        };

        expect(() => drumProcessor.playDrumHit(drumEvent)).not.toThrow();
      });
    });

    it('should handle all drum pieces', () => {
      const allDrumPieces = Object.values(DrumPiece);

      allDrumPieces.forEach((drumPiece) => {
        const drumEvent: DrumEvent = {
          time: 0,
          drumPiece,
          velocity: 80,
          type: DrumHitType.NORMAL,
        };

        expect(() => drumProcessor.playDrumHit(drumEvent)).not.toThrow();
      });
    });
  });

  describe('Pattern Management', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should start drum patterns', () => {
      expect(() => drumProcessor.startPattern('basic_rock')).not.toThrow();

      const status = drumProcessor.getStatus();
      expect(status.currentPattern).toBe('basic_rock');
      expect(status.isPlaying).toBe(true);
    });

    it('should handle pattern switching', () => {
      drumProcessor.startPattern('basic_rock');
      expect(() =>
        drumProcessor.switchPattern('basic_jazz', true),
      ).not.toThrow();
    });

    it('should handle unknown patterns gracefully', () => {
      expect(() => drumProcessor.startPattern('unknown_pattern')).not.toThrow();

      const status = drumProcessor.getStatus();
      expect(status.currentPattern).toBeNull();
    });

    it('should support quantized pattern switching', () => {
      drumProcessor.startPattern('basic_rock');
      expect(() =>
        drumProcessor.switchPattern('basic_funk', true),
      ).not.toThrow();
    });

    it('should support immediate pattern switching', () => {
      drumProcessor.startPattern('basic_rock');
      expect(() =>
        drumProcessor.switchPattern('basic_jazz', false),
      ).not.toThrow();
    });
  });

  describe('Audio Loop Support', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples, mockAudioLoops);
    });

    it('should start audio loops with tempo adjustment', () => {
      expect(() => drumProcessor.startLoop('rock_loop_120', 140)).not.toThrow();

      const status = drumProcessor.getStatus();
      expect(status.currentLoop).toBe('rock_loop_120');
      expect(status.isPlaying).toBe(true);
    });

    it('should handle unknown loops gracefully', () => {
      expect(() => drumProcessor.startLoop('unknown_loop', 120)).not.toThrow();

      const status = drumProcessor.getStatus();
      expect(status.currentLoop).toBeNull();
    });

    it('should support different loop lengths', () => {
      const loopLengths = [
        LoopLength.TWO_BARS,
        LoopLength.FOUR_BARS,
        LoopLength.EIGHT_BARS,
      ];

      loopLengths.forEach((length) => {
        drumProcessor.setLoopLength(length);
        const status = drumProcessor.getStatus();
        expect(status.loopLength).toBe(length);
      });
    });
  });

  describe('Groove and Swing Engine', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should support different groove styles', () => {
      const grooveStyles = [
        GrooveStyle.STRAIGHT,
        GrooveStyle.SWING_A,
        GrooveStyle.SWING_B,
        GrooveStyle.SWING_C,
        GrooveStyle.SHUFFLE,
        GrooveStyle.LATIN,
        GrooveStyle.FUNK,
      ];

      grooveStyles.forEach((style) => {
        drumProcessor.updateGroove(style, 50);
        const status = drumProcessor.getStatus();
        expect(status.grooveStyle).toBe(style);
      });
    });

    it('should adjust swing amount', () => {
      const swingAmounts = [0, 25, 50, 75, 100];

      swingAmounts.forEach((amount) => {
        drumProcessor.updateGroove(GrooveStyle.SWING_A, amount);
        const status = drumProcessor.getStatus();
        expect(status.swingAmount).toBe(amount);
      });
    });

    it('should apply groove to drum events', () => {
      drumProcessor.updateGroove(GrooveStyle.SWING_A, 60);

      const drumEvent: DrumEvent = {
        time: 0.5, // Off-beat
        drumPiece: DrumPiece.HIHAT_CLOSED,
        velocity: 70,
        type: DrumHitType.NORMAL,
      };

      expect(() => drumProcessor.playDrumHit(drumEvent)).not.toThrow();
    });
  });

  describe('Fill System', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
      drumProcessor.startPattern('basic_rock');
    });

    it('should trigger fills manually', () => {
      expect(() => drumProcessor.triggerFill()).not.toThrow();
    });

    it('should trigger specific fills by ID', () => {
      expect(() => drumProcessor.triggerFill('tom_roll_fill')).not.toThrow();
    });

    it('should handle fill triggering when not playing', () => {
      drumProcessor.stop();
      expect(() => drumProcessor.triggerFill()).not.toThrow();
    });

    it('should schedule fills for appropriate timing', () => {
      // Start playing and trigger a fill
      drumProcessor.startPattern('basic_rock');
      expect(() => drumProcessor.triggerFill('crash_ending')).not.toThrow();
    });
  });

  describe('Individual Volume Control', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should update individual drum piece volumes', () => {
      const drumPieces = [
        DrumPiece.KICK,
        DrumPiece.SNARE,
        DrumPiece.HIHAT_CLOSED,
        DrumPiece.CRASH_1,
        DrumPiece.RIDE,
      ];

      drumPieces.forEach((piece) => {
        expect(() =>
          drumProcessor.updateIndividualVolume(piece, 0.5),
        ).not.toThrow();
      });
    });

    it('should handle volume range limits', () => {
      const volumes = [0, 0.25, 0.5, 0.75, 1.0, 1.5]; // Including out-of-range

      volumes.forEach((volume) => {
        expect(() =>
          drumProcessor.updateIndividualVolume(DrumPiece.KICK, volume),
        ).not.toThrow();
      });
    });
  });

  describe('Drum Modes', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples, mockAudioLoops);
    });

    it('should support MIDI-only mode', () => {
      drumProcessor.setMode(DrumMode.MIDI_ONLY);
      const status = drumProcessor.getStatus();
      expect(status.mode).toBe(DrumMode.MIDI_ONLY);
    });

    it('should support audio-only mode', () => {
      drumProcessor.setMode(DrumMode.AUDIO_ONLY);
      const status = drumProcessor.getStatus();
      expect(status.mode).toBe(DrumMode.AUDIO_ONLY);
    });

    it('should support hybrid mode', () => {
      drumProcessor.setMode(DrumMode.HYBRID);
      const status = drumProcessor.getStatus();
      expect(status.mode).toBe(DrumMode.HYBRID);
    });

    it('should play MIDI over audio loops in hybrid mode', () => {
      drumProcessor.setMode(DrumMode.HYBRID);
      drumProcessor.startLoop('rock_loop_120', 120);

      const drumEvent: DrumEvent = {
        time: 0,
        drumPiece: DrumPiece.SNARE,
        velocity: 100,
        type: DrumHitType.ACCENT,
      };

      expect(() => drumProcessor.playDrumHit(drumEvent)).not.toThrow();
    });
  });

  describe('Humanization', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should apply humanization to drum events', async () => {
      const humanizedConfig: Partial<DrumInstrumentConfig> = {
        humanizationAmount: 0.3,
      };

      const humanizedProcessor = new DrumInstrumentProcessor(humanizedConfig);

      await expect(
        humanizedProcessor.initialize(mockDrumSamples),
      ).resolves.not.toThrow();

      const drumEvent: DrumEvent = {
        time: 0,
        drumPiece: DrumPiece.KICK,
        velocity: 100,
        type: DrumHitType.NORMAL,
      };

      expect(() => humanizedProcessor.playDrumHit(drumEvent)).not.toThrow();

      humanizedProcessor.dispose();
    });

    it('should handle zero humanization', async () => {
      const noHumanizationConfig: Partial<DrumInstrumentConfig> = {
        humanizationAmount: 0,
      };

      const processor = new DrumInstrumentProcessor(noHumanizationConfig);

      await expect(
        processor.initialize(mockDrumSamples),
      ).resolves.not.toThrow();

      processor.dispose();
    });
  });

  describe('Performance and Edge Cases', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples);
    });

    it('should handle rapid drum hits', () => {
      const rapidEvents: DrumEvent[] = Array.from({ length: 20 }, (_, i) => ({
        time: i * 0.1,
        drumPiece: DrumPiece.HIHAT_CLOSED,
        velocity: 60 + i,
        type: DrumHitType.NORMAL,
      }));

      rapidEvents.forEach((event) => {
        expect(() => drumProcessor.playDrumHit(event)).not.toThrow();
      });
    });

    it('should handle concurrent drum hits', () => {
      const concurrentEvents: DrumEvent[] = [
        {
          time: 0,
          drumPiece: DrumPiece.KICK,
          velocity: 100,
          type: DrumHitType.NORMAL,
        },
        {
          time: 0,
          drumPiece: DrumPiece.HIHAT_CLOSED,
          velocity: 70,
          type: DrumHitType.NORMAL,
        },
        {
          time: 0,
          drumPiece: DrumPiece.RIDE,
          velocity: 80,
          type: DrumHitType.NORMAL,
        },
      ];

      concurrentEvents.forEach((event) => {
        expect(() => drumProcessor.playDrumHit(event)).not.toThrow();
      });
    });

    it('should handle extreme velocity values', () => {
      const extremeVelocities = [0, 1, 126, 127, 200]; // Including out-of-range

      extremeVelocities.forEach((velocity) => {
        const event: DrumEvent = {
          time: 0,
          drumPiece: DrumPiece.SNARE,
          velocity,
          type: DrumHitType.NORMAL,
        };

        expect(() => drumProcessor.playDrumHit(event)).not.toThrow();
      });
    });

    it('should maintain performance with complex patterns', () => {
      drumProcessor.startPattern('basic_funk');
      drumProcessor.updateGroove(GrooveStyle.FUNK, 75);

      // Simulate complex pattern with fills
      for (let i = 0; i < 10; i++) {
        if (i % 4 === 3) {
          drumProcessor.triggerFill();
        }
      }

      expect(drumProcessor.getStatus().isPlaying).toBe(true);
    });
  });

  describe('Resource Management', () => {
    it('should handle uninitialized state gracefully', () => {
      const uninitializedProcessor = new DrumInstrumentProcessor();

      const drumEvent: DrumEvent = {
        time: 0,
        drumPiece: DrumPiece.KICK,
        velocity: 100,
        type: DrumHitType.NORMAL,
      };

      expect(() => uninitializedProcessor.playDrumHit(drumEvent)).not.toThrow();
      expect(() =>
        uninitializedProcessor.startPattern('basic_rock'),
      ).not.toThrow();

      uninitializedProcessor.dispose();
    });

    it('should dispose resources properly', () => {
      drumProcessor.dispose();

      const status = drumProcessor.getStatus();
      expect(status.isInitialized).toBe(false);
      expect(status.isPlaying).toBe(false);
    });

    it('should handle multiple dispose calls', () => {
      drumProcessor.dispose();
      expect(() => drumProcessor.dispose()).not.toThrow();
    });

    it('should stop playback on dispose', async () => {
      await drumProcessor.initialize(mockDrumSamples);
      drumProcessor.startPattern('basic_rock');
      expect(drumProcessor.getStatus().isPlaying).toBe(true);

      drumProcessor.dispose();
      expect(drumProcessor.getStatus().isPlaying).toBe(false);
    });
  });

  describe('Integration Features', () => {
    beforeEach(async () => {
      await drumProcessor.initialize(mockDrumSamples, mockAudioLoops);
    });

    it('should support comprehensive drum styles', () => {
      const drumStyles = [
        DrumStyle.ROCK,
        DrumStyle.JAZZ,
        DrumStyle.FUNK,
        DrumStyle.LATIN,
        DrumStyle.ELECTRONIC,
        DrumStyle.ACOUSTIC,
        DrumStyle.VINTAGE,
      ];

      // Test that all styles are supported (patterns would use these)
      drumStyles.forEach((style) => {
        expect(Object.values(DrumStyle)).toContain(style);
      });
    });

    it('should handle complex workflow scenarios', () => {
      // Start with a pattern
      drumProcessor.startPattern('basic_rock');
      expect(drumProcessor.getStatus().isPlaying).toBe(true);

      // Change groove
      drumProcessor.updateGroove(GrooveStyle.SWING_A, 60);

      // Trigger a fill
      drumProcessor.triggerFill();

      // Switch to hybrid mode and add audio loop
      drumProcessor.setMode(DrumMode.HYBRID);
      drumProcessor.startLoop('rock_loop_120', 130);

      // Add individual hits
      const drumEvent: DrumEvent = {
        time: 0,
        drumPiece: DrumPiece.CRASH_1,
        velocity: 110,
        type: DrumHitType.ACCENT,
      };
      drumProcessor.playDrumHit(drumEvent);

      // Change loop length
      drumProcessor.setLoopLength(LoopLength.EIGHT_BARS);

      expect(drumProcessor.getStatus().isPlaying).toBe(true);
    });

    it('should support real-time parameter changes', () => {
      drumProcessor.startPattern('basic_rock');

      // Real-time groove changes
      drumProcessor.updateGroove(GrooveStyle.FUNK, 80);
      drumProcessor.updateGroove(GrooveStyle.LATIN, 40);

      // Real-time volume changes
      drumProcessor.updateIndividualVolume(DrumPiece.KICK, 0.9);
      drumProcessor.updateIndividualVolume(DrumPiece.SNARE, 0.7);

      // Real-time mode changes
      drumProcessor.setMode(DrumMode.HYBRID);
      drumProcessor.setMode(DrumMode.AUDIO_ONLY);

      expect(drumProcessor.getStatus().isPlaying).toBe(true);
    });
  });
});
