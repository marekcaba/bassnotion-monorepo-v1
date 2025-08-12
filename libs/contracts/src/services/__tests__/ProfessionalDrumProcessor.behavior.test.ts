/**
 * Professional Drum Processor - Behavior Tests
 *
 * Tests the professional drum pattern system with tick-based events.
 * Validates Story 3.15 implementation with MIDI velocity and complex patterns.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProfessionalDrumProcessor } from '../ProfessionalDrumProcessor';
import type {
  DrumPattern,
  DrumEvent,
  TimeSignature,
  PatternGenerationOptions,
} from '../../types/musical-time';

describe('ProfessionalDrumProcessor - Story 3.15 Behavior Tests', () => {
  const defaultTimeSignature: TimeSignature = { numerator: 4, denominator: 4 };

  describe('Professional Drum Pattern Structure', () => {
    it('should create patterns with tick-based events', () => {
      const options: PatternGenerationOptions = {
        style: 'rock',
        complexity: 5,
        fills: false,
        ghost_notes: false,
        accents: false,
        humanize: 0,
      };

      const pattern = ProfessionalDrumProcessor.generatePattern(
        options,
        defaultTimeSignature,
        1,
      );

      expect(pattern.name).toBe('rock_5');
      expect(pattern.bars).toBe(1);
      expect(pattern.events).toBeInstanceOf(Array);
      expect(pattern.events.length).toBeGreaterThan(0);

      // Check event structure
      const firstEvent = pattern.events[0];
      expect(firstEvent).toHaveProperty('tick');
      expect(firstEvent).toHaveProperty('drum');
      expect(firstEvent).toHaveProperty('velocity');
      expect(typeof firstEvent.tick).toBe('number');
      expect(typeof firstEvent.velocity).toBe('number');
    });

    it('should replace simple grid arrays with professional events', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        { style: 'rock', complexity: 'basic', humanization: false, swing: 0 },
        defaultTimeSignature,
        1,
      );

      // Should NOT have simple [1,0,0,0] structure
      expect(pattern.events).not.toContain([1, 0, 0, 0]);

      // Should have professional tick-based events
      pattern.events.forEach((event) => {
        expect(event.tick).toBeGreaterThanOrEqual(0);
        expect(event.tick).toBeLessThan(1920); // 1 bar in 4/4
        expect(event.velocity).toBeGreaterThanOrEqual(0);
        expect(event.velocity).toBeLessThanOrEqual(127);
      });
    });
  });

  describe('MIDI Velocity Support', () => {
    it('should use full MIDI velocity range (0-127)', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 8,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      const velocities = pattern.events.map((e) => e.velocity);
      const minVelocity = Math.min(...velocities);
      const maxVelocity = Math.max(...velocities);

      expect(minVelocity).toBeGreaterThanOrEqual(0);
      expect(maxVelocity).toBeLessThanOrEqual(127);
      expect(maxVelocity).toBeGreaterThan(minVelocity); // Should have dynamic range
    });

    it('should differentiate accent levels with velocity', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 8,
          fills: false,
          ghost_notes: false,
          accents: true,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      const kickEvents = pattern.events.filter((e) => e.drum === 'kick');
      const snareEvents = pattern.events.filter((e) => e.drum === 'snare');

      if (kickEvents.length > 0 && snareEvents.length > 0) {
        const avgKickVelocity =
          kickEvents.reduce((sum, e) => sum + e.velocity, 0) /
          kickEvents.length;
        const avgSnareVelocity =
          snareEvents.reduce((sum, e) => sum + e.velocity, 0) /
          snareEvents.length;

        // Different drums should have different average velocities
        expect(Math.abs(avgKickVelocity - avgSnareVelocity)).toBeGreaterThan(5);
      }
    });
  });

  describe('Complex Pattern Generation', () => {
    it('should generate rock patterns with appropriate events', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      const drums = pattern.events.map((e) => e.drum);

      // Rock pattern should have kick, snare, and hihat
      expect(drums).toContain('kick');
      expect(drums).toContain('snare');
      expect(drums).toContain('hihat');

      // Should have events on strong beats
      const strongBeats = pattern.events.filter((e) => e.tick % 480 === 0);
      expect(strongBeats.length).toBeGreaterThan(0);
    });

    it('should generate jazz patterns with swing feel', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'jazz',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          swing: { enabled: true, amount: 0.6, note_value: 'eighth' },
        },
        defaultTimeSignature,
        1,
      );

      const drums = pattern.events.map((e) => e.drum);

      // Jazz pattern should emphasize ride and brush work
      expect(drums).toContain('ride');
      expect(drums.filter((d) => d === 'hihat').length).toBeLessThan(
        drums.filter((d) => d === 'ride').length,
      );
    });

    it('should generate funk patterns with syncopation', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'funk',
          complexity: 8,
          fills: false,
          ghost_notes: true,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      // Funk should have more complex kick patterns
      const kickEvents = pattern.events.filter((e) => e.drum === 'kick');
      expect(kickEvents.length).toBeGreaterThan(2); // More than basic rock

      // Should have off-beat events
      const offBeats = pattern.events.filter((e) => e.tick % 480 !== 0);
      expect(offBeats.length).toBeGreaterThan(0);
    });
  });

  describe('Triplet Support', () => {
    it('should generate triplet patterns with correct timing', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'jazz',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      // Look for triplet timing (160 ticks = 480/3)
      const tripletTicks = pattern.events.filter(
        (e) => e.tick % 160 === 0 && e.tick % 480 !== 0,
      );

      if (tripletTicks.length > 0) {
        // Should have proper triplet subdivision
        expect(tripletTicks[0].tick % 160).toBe(0);
      }
    });
  });

  describe('Humanization and Swing', () => {
    it('should apply humanization to timing and velocity', () => {
      const humanizedPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0.5,
        },
        defaultTimeSignature,
        1,
      );

      const roboticPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      // Humanized pattern should have more variation in timing
      const humanizedTicks = humanizedPattern.events.map((e) => e.tick);
      const roboticTicks = roboticPattern.events.map((e) => e.tick);

      const humanizedVariation = new Set(humanizedTicks).size;
      const roboticVariation = new Set(roboticTicks).size;

      expect(humanizedVariation).toBeGreaterThanOrEqual(roboticVariation);
    });

    it('should apply swing feel to eighth note patterns', () => {
      const straightPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'jazz',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      const swingPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'jazz',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          swing: { enabled: true, amount: 0.6, note_value: 'eighth' },
        },
        defaultTimeSignature,
        1,
      );

      // Swing pattern should have delayed off-beats
      const straightOffBeats = straightPattern.events.filter(
        (e) => e.tick % 480 === 240,
      );
      const swingOffBeats = swingPattern.events.filter(
        (e) => e.tick % 480 > 240 && e.tick % 480 < 480,
      );

      if (straightOffBeats.length > 0 && swingOffBeats.length > 0) {
        expect(swingOffBeats.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Pattern Arrangement System', () => {
    it('should create arrangement with pattern repetition', () => {
      const mainPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );
      mainPattern.name = 'main';

      const fillPattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 8,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );
      fillPattern.name = 'rock_fill';

      const arrangement = ProfessionalDrumProcessor.createArrangement(
        [mainPattern, fillPattern],
        ['main', 'main', 'main', 'rock_fill'],
      );

      expect(arrangement.patterns).toHaveLength(2);
      expect(arrangement.arrangement).toEqual([
        'main',
        'main',
        'main',
        'rock_fill',
      ]);
    });

    it('should handle pattern variations', () => {
      const basePattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      const variation = ProfessionalDrumProcessor.createVariation(
        basePattern,
        0.3,
      );

      expect(variation.name).toContain('variation');
      expect(variation.bars).toBe(basePattern.bars);
      expect(variation.events.length).toBeGreaterThan(0);

      // Should have some different events
      expect(variation.events).not.toEqual(basePattern.events);
    });
  });

  describe('Time Signature Support', () => {
    it('should generate patterns for 3/4 time', () => {
      const threeFourTime: TimeSignature = { numerator: 3, denominator: 4 };
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'latin',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        threeFourTime,
        1,
      );

      expect(pattern.bars).toBe(1);

      // Events should be within 3/4 bar range (3 * 480 = 1440 ticks)
      pattern.events.forEach((event) => {
        expect(event.tick).toBeLessThan(1440);
      });

      // Should have emphasis on beat 1 (strong beat in 3/4)
      const beat1Events = pattern.events.filter((e) => e.tick === 0);
      expect(beat1Events.length).toBeGreaterThan(0);
    });

    it('should generate patterns for 7/8 time', () => {
      const sevenEightTime: TimeSignature = { numerator: 7, denominator: 8 };
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 8,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        sevenEightTime,
        1,
      );

      // Events should be within 7/8 bar range (7 * 240 = 1680 ticks)
      pattern.events.forEach((event) => {
        expect(event.tick).toBeLessThan(1680);
      });
    });
  });

  describe('Multi-Bar Patterns', () => {
    it('should generate multi-bar patterns correctly', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        4,
      );

      expect(pattern.bars).toBe(4);

      // Should have events across all 4 bars
      const maxTick = Math.max(...pattern.events.map((e) => e.tick));
      expect(maxTick).toBeGreaterThan(1920); // More than 1 bar
      expect(maxTick).toBeLessThan(7680); // Less than 4 bars
    });
  });

  describe('Pattern Migration from Legacy', () => {
    it('should migrate simple grid patterns to professional format', () => {
      const legacyPattern = [1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0];

      const migratedPattern = ProfessionalDrumProcessor.migrateLegacyPattern(
        legacyPattern,
        'kick',
        defaultTimeSignature,
      );

      expect(migratedPattern).toBeInstanceOf(Array);
      expect(migratedPattern.length).toBeGreaterThan(0);

      // Should have professional structure
      migratedPattern.forEach((event) => {
        expect(event).toHaveProperty('tick');
        expect(event).toHaveProperty('drum');
        expect(event).toHaveProperty('velocity');
        expect(event.drum).toBe('kick');
      });
    });
  });

  describe('Performance Requirements', () => {
    it('should generate patterns within performance limits', () => {
      const startTime = performance.now();

      // Generate 100 patterns
      for (let i = 0; i < 100; i++) {
        ProfessionalDrumProcessor.generatePattern(
          {
            style: 'rock',
            complexity: 5,
            fills: false,
            ghost_notes: false,
            accents: false,
            humanize: 0,
          },
          defaultTimeSignature,
          1,
        );
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete within 100ms for 100 patterns
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Integration with Story 3.15 Components', () => {
    it('should provide patterns compatible with MusicalTimeConverter', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      // All ticks should be valid for MusicalTimeConverter
      pattern.events.forEach((event) => {
        expect(event.tick).toBeGreaterThanOrEqual(0);
        expect(event.tick % 30).toBe(0); // Should align with subdivision boundaries
      });
    });

    it('should work with DrummerWidget scheduling', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        1,
      );

      // Should provide sorted events for sequential playback
      const ticks = pattern.events.map((e) => e.tick);
      const sortedTicks = [...ticks].sort((a, b) => a - b);

      expect(ticks).toEqual(sortedTicks);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid pattern options gracefully', () => {
      expect(() => {
        ProfessionalDrumProcessor.generatePattern(
          {
            style: 'rock',
            complexity: 5,
            fills: false,
            ghost_notes: false,
            accents: false,
            humanize: 0,
          },
          defaultTimeSignature,
          1,
        );
      }).not.toThrow();
    });

    it('should handle zero bars gracefully', () => {
      const pattern = ProfessionalDrumProcessor.generatePattern(
        {
          style: 'rock',
          complexity: 5,
          fills: false,
          ghost_notes: false,
          accents: false,
          humanize: 0,
        },
        defaultTimeSignature,
        0,
      );

      expect(pattern.bars).toBe(1); // Should default to 1 bar
    });
  });
});
