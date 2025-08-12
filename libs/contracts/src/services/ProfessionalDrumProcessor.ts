/**
 * Professional Drum Pattern Processor
 *
 * Replaces simple grid arrays with tick-based event system for professional drum patterns.
 * Uses industry-standard 480 ticks per quarter note resolution for maximum precision.
 *
 * Story 3.15: Professional Musical Time System - Task 3
 */

import { MusicalTimeConverter } from './MusicalTimeConverter.js';
import type {
  DrumPattern,
  DrumEvent,
  DrumArrangement,
  DrumType,
  TimeSignature,
  MusicalTimeConfig,
  DrumTrackData,
  TimingFeatures,
  SwingConfig,
} from '../types/musical-time.js';

export interface PatternGenerationOptions {
  style:
    | 'rock'
    | 'jazz'
    | 'funk'
    | 'latin'
    | 'shuffle'
    | 'reggae'
    | 'punk'
    | 'metal';
  complexity: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
  fills: boolean;
  ghost_notes: boolean;
  accents: boolean;
  swing?: SwingConfig;
  humanize?: number;
}

export interface DrumPatternPlaybackEvent {
  tick: number;
  drum: DrumType;
  velocity: number;
  timestamp: number;
  isGhost?: boolean;
  isAccent?: boolean;
}

export class ProfessionalDrumProcessor {
  private static readonly TICKS_PER_QUARTER = 480;

  /**
   * Convert simple grid arrays to professional tick-based events
   * @param gridPattern - Legacy grid pattern (e.g., [1,0,0,0,1,0,0,0])
   * @param drum - Drum type
   * @param bars - Number of bars the pattern spans
   * @param baseVelocity - Base velocity for hits
   * @returns Array of drum events
   */
  public static convertGridToEvents(
    gridPattern: number[],
    drum: DrumType,
    bars = 1,
    baseVelocity = 100,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];
    const ticksPerBeat = this.TICKS_PER_QUARTER;
    const beatsPerBar = 4; // Assuming 4/4 time
    const totalBeats = bars * beatsPerBar;

    // Calculate subdivision based on grid length
    const subdivisionsPerBeat = gridPattern.length / totalBeats;
    const ticksPerSubdivision = ticksPerBeat / subdivisionsPerBeat;

    gridPattern.forEach((hit, index) => {
      if (hit > 0) {
        const tick = Math.round(index * ticksPerSubdivision);
        const velocity = Math.round(baseVelocity * hit); // Grid value affects velocity

        events.push({
          tick,
          drum,
          velocity: Math.min(Math.max(velocity, 1), 127),
        });
      }
    });

    return events;
  }

  /**
   * Generate professional drum pattern based on style and complexity
   * @param options - Pattern generation options
   * @param timeSignature - Time signature
   * @param bars - Number of bars
   * @returns Professional drum pattern
   */
  public static generatePattern(
    options: PatternGenerationOptions,
    timeSignature: TimeSignature = { numerator: 4, denominator: 4 },
    bars = 1,
  ): DrumPattern {
    // Ensure bars is at least 1
    const safeBars = Math.max(1, bars);

    const pattern: DrumPattern = {
      name: `${options.style}_${options.complexity}`,
      bars: safeBars,
      events: [],
    };

    const beatsPerBar = timeSignature.numerator;
    // Calculate ticks per beat based on time signature denominator
    const ticksPerBeat =
      this.TICKS_PER_QUARTER * (4 / timeSignature.denominator);
    const totalTicks = safeBars * beatsPerBar * ticksPerBeat;

    // Generate kick pattern
    pattern.events.push(
      ...this.generateKickPattern(options, beatsPerBar, safeBars, ticksPerBeat),
    );

    // Generate snare pattern
    pattern.events.push(
      ...this.generateSnarePattern(
        options,
        beatsPerBar,
        safeBars,
        ticksPerBeat,
      ),
    );

    // Generate hihat pattern
    pattern.events.push(
      ...this.generateHihatPattern(
        options,
        beatsPerBar,
        safeBars,
        ticksPerBeat,
      ),
    );

    // Add fills if requested
    if (options.fills && options.complexity >= 5) {
      pattern.events.push(
        ...this.generateFillEvents(
          options,
          beatsPerBar,
          safeBars,
          ticksPerBeat,
        ),
      );
    }

    // Apply swing if specified
    if (options.swing?.enabled) {
      pattern.events = this.applySwing(pattern.events, options.swing);
    }

    // Apply humanization if specified
    if (options.humanize && options.humanize > 0) {
      pattern.events = this.applyHumanization(pattern.events, options.humanize);
    }

    // Ensure events are within the bar boundaries (after all modifications)
    pattern.events = pattern.events.filter((event) => event.tick < totalTicks);

    // Sort events by tick for sequential playback
    pattern.events.sort((a, b) => a.tick - b.tick);

    return pattern;
  }

  /**
   * Create triplet-based drum pattern
   * @param drum - Drum type
   * @param bars - Number of bars
   * @param tripletPositions - Array of triplet positions (0-2 for each beat)
   * @param velocity - Base velocity
   * @returns Triplet drum events
   */
  public static createTripletPattern(
    drum: DrumType,
    bars: number,
    tripletPositions: number[],
    velocity = 100,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];
    const tripletTicks = this.TICKS_PER_QUARTER / 3; // 160 ticks per triplet

    for (let bar = 0; bar < bars; bar++) {
      for (let beat = 0; beat < 4; beat++) {
        tripletPositions.forEach((tripletPos) => {
          const tick =
            (bar * 4 + beat) * this.TICKS_PER_QUARTER +
            tripletPos * tripletTicks;
          events.push({
            tick: Math.round(tick),
            drum,
            velocity,
          });
        });
      }
    }

    return events;
  }

  /**
   * Calculate playback events for a drum pattern with tempo
   * @param pattern - Drum pattern
   * @param config - Musical time configuration
   * @returns Playback events with timestamps
   */
  public static calculatePlaybackEvents(
    pattern: DrumPattern,
    config: MusicalTimeConfig,
  ): DrumPatternPlaybackEvent[] {
    const events: DrumPatternPlaybackEvent[] = [];

    pattern.events.forEach((event) => {
      const timestamp = MusicalTimeConverter.tickToMilliseconds(
        event.tick,
        config.tempo,
        config.resolution || this.TICKS_PER_QUARTER,
      );

      events.push({
        tick: event.tick,
        drum: event.drum,
        velocity: event.velocity,
        timestamp,
      });
    });

    return events.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Create drum arrangement with pattern variations
   * @param patterns - Array of patterns to include in arrangement
   * @param arrangement - Pattern arrangement (pattern names in order)
   * @returns Complete drum arrangement
   */
  public static createArrangement(
    patterns: DrumPattern[],
    arrangement: string[],
  ): DrumArrangement {
    return {
      patterns,
      arrangement,
    };
  }

  /**
   * Migrate existing drum track data to professional format
   * @param drumTrackData - Current drum track data
   * @param tempo - Current tempo
   * @returns Professional drum track data
   */
  public static migrateDrumTrack(
    drumTrackData: any,
    tempo = 120,
  ): DrumTrackData {
    const professionalData: DrumTrackData = {
      enabled: drumTrackData.enabled || false,
      resolution: this.TICKS_PER_QUARTER,
      patterns: [],
      arrangement: [],
    };

    // Convert old pattern format if exists
    if (drumTrackData.pattern && Array.isArray(drumTrackData.pattern)) {
      const kickEvents = this.convertGridToEvents(
        drumTrackData.pattern.kick || [1, 0, 0, 0, 1, 0, 0, 0],
        'kick',
        1,
        110,
      );
      const snareEvents = this.convertGridToEvents(
        drumTrackData.pattern.snare || [0, 0, 1, 0, 0, 0, 1, 0],
        'snare',
        1,
        100,
      );
      const hihatEvents = this.convertGridToEvents(
        drumTrackData.pattern.hihat || [1, 1, 1, 1, 1, 1, 1, 1],
        'hihat',
        1,
        80,
      );

      const mainPattern: DrumPattern = {
        name: 'main_groove',
        bars: 1,
        events: [...kickEvents, ...snareEvents, ...hihatEvents],
      };

      professionalData.patterns.push(mainPattern);
      professionalData.arrangement.push('main_groove');
    }

    return professionalData;
  }

  // Private helper methods

  private static generateKickPattern(
    options: PatternGenerationOptions,
    beatsPerBar: number,
    bars: number,
    ticksPerBeat: number = this.TICKS_PER_QUARTER,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const barOffset = bar * beatsPerBar * ticksPerBeat;

      switch (options.style) {
        case 'rock':
          // Classic rock: kick on 1 and 3
          const kickVelocity = options.accents ? 127 : 120;
          const kickVelocity2 = options.accents ? 120 : 115;
          events.push(
            { tick: barOffset, drum: 'kick', velocity: kickVelocity },
            {
              tick: barOffset + 2 * ticksPerBeat,
              drum: 'kick',
              velocity: kickVelocity2,
            },
          );
          if (options.complexity >= 6) {
            // Add syncopated kick
            events.push({
              tick: barOffset + 3.5 * ticksPerBeat,
              drum: 'kick',
              velocity: 90,
            });
          }
          break;

        case 'jazz':
          // Jazz: kick on 1 and 3, lighter
          events.push(
            { tick: barOffset, drum: 'kick', velocity: 90 },
            { tick: barOffset + 2 * ticksPerBeat, drum: 'kick', velocity: 85 },
          );
          break;

        case 'funk':
          // Funk: syncopated kick pattern
          events.push(
            { tick: barOffset, drum: 'kick', velocity: 127 },
            {
              tick: barOffset + 1.5 * ticksPerBeat,
              drum: 'kick',
              velocity: 80,
            },
            {
              tick: barOffset + 2.75 * ticksPerBeat,
              drum: 'kick',
              velocity: 100,
            },
          );
          break;

        case 'latin':
          // Latin: kick on 1 and 3.5
          events.push(
            { tick: barOffset, drum: 'kick', velocity: 110 },
            {
              tick: barOffset + 3.5 * ticksPerBeat,
              drum: 'kick',
              velocity: 95,
            },
          );
          break;

        default:
          // Default rock pattern
          events.push(
            { tick: barOffset, drum: 'kick', velocity: 120 },
            { tick: barOffset + 2 * ticksPerBeat, drum: 'kick', velocity: 115 },
          );
      }
    }

    return events;
  }

  private static generateSnarePattern(
    options: PatternGenerationOptions,
    beatsPerBar: number,
    bars: number,
    ticksPerBeat: number = this.TICKS_PER_QUARTER,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const barOffset = bar * beatsPerBar * ticksPerBeat;

      switch (options.style) {
        case 'rock':
          // Classic rock: snare on 2 and 4
          const snareVelocity = options.accents ? 125 : 110;
          const snareVelocity2 = options.accents ? 127 : 115;
          events.push(
            {
              tick: barOffset + ticksPerBeat,
              drum: 'snare',
              velocity: snareVelocity,
            },
            {
              tick: barOffset + 3 * ticksPerBeat,
              drum: 'snare',
              velocity: snareVelocity2,
            },
          );

          // Add ghost notes for higher complexity
          if (options.ghost_notes && options.complexity >= 4) {
            events.push(
              {
                tick: barOffset + 0.5 * ticksPerBeat,
                drum: 'snare',
                velocity: 40,
              },
              {
                tick: barOffset + 2.5 * ticksPerBeat,
                drum: 'snare',
                velocity: 45,
              },
            );
          }
          break;

        case 'jazz':
          // Jazz: snare on 2 and 4, with swing feel
          events.push(
            { tick: barOffset + ticksPerBeat, drum: 'snare', velocity: 85 },
            { tick: barOffset + 3 * ticksPerBeat, drum: 'snare', velocity: 90 },
          );
          break;

        case 'funk':
          // Funk: complex snare pattern with ghost notes
          events.push(
            { tick: barOffset + ticksPerBeat, drum: 'snare', velocity: 120 },
            {
              tick: barOffset + 3 * ticksPerBeat,
              drum: 'snare',
              velocity: 115,
            },
          );
          if (options.ghost_notes) {
            events.push(
              {
                tick: barOffset + 0.25 * ticksPerBeat,
                drum: 'snare',
                velocity: 30,
              },
              {
                tick: barOffset + 1.25 * ticksPerBeat,
                drum: 'snare',
                velocity: 35,
              },
              {
                tick: barOffset + 2.25 * ticksPerBeat,
                drum: 'snare',
                velocity: 40,
              },
            );
          }
          break;

        default:
          // Default backbeat
          events.push(
            { tick: barOffset + ticksPerBeat, drum: 'snare', velocity: 110 },
            {
              tick: barOffset + 3 * ticksPerBeat,
              drum: 'snare',
              velocity: 115,
            },
          );
      }
    }

    return events;
  }

  private static generateHihatPattern(
    options: PatternGenerationOptions,
    beatsPerBar: number,
    bars: number,
    ticksPerBeat: number = this.TICKS_PER_QUARTER,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];

    for (let bar = 0; bar < bars; bar++) {
      const barOffset = bar * beatsPerBar * ticksPerBeat;

      switch (options.style) {
        case 'rock':
          // 8th note hihat pattern
          for (let beat = 0; beat < beatsPerBar; beat++) {
            const beatOffset = barOffset + beat * ticksPerBeat;
            events.push(
              { tick: beatOffset, drum: 'hihat', velocity: 70 },
              {
                tick: beatOffset + ticksPerBeat / 2,
                drum: 'hihat',
                velocity: 60,
              },
            );
          }
          break;

        case 'jazz':
          // Jazz should use ride cymbal primarily, not hihat
          for (let beat = 0; beat < beatsPerBar; beat++) {
            const beatOffset = barOffset + beat * ticksPerBeat;
            events.push(
              { tick: beatOffset, drum: 'ride', velocity: 65 },
              {
                tick: beatOffset + (ticksPerBeat * 2) / 3,
                drum: 'ride',
                velocity: 55,
              },
            );
          }
          // Add some hihat accents
          if (options.complexity >= 4) {
            events.push(
              {
                tick: barOffset + 2 * ticksPerBeat,
                drum: 'hihat',
                velocity: 45,
              },
              {
                tick: barOffset + 4 * ticksPerBeat,
                drum: 'hihat',
                velocity: 45,
              },
            );
          }
          break;

        case 'funk':
          // 16th note hihat pattern
          for (let beat = 0; beat < beatsPerBar; beat++) {
            const beatOffset = barOffset + beat * ticksPerBeat;
            for (let sixteenth = 0; sixteenth < 4; sixteenth++) {
              const velocity = sixteenth % 2 === 0 ? 75 : 50; // Accent on beat and off-beat
              events.push({
                tick: beatOffset + sixteenth * (ticksPerBeat / 4),
                drum: 'hihat',
                velocity,
              });
            }
          }
          break;

        default:
          // Default 8th note pattern
          for (let beat = 0; beat < beatsPerBar; beat++) {
            const beatOffset = barOffset + beat * ticksPerBeat;
            events.push(
              { tick: beatOffset, drum: 'hihat', velocity: 70 },
              {
                tick: beatOffset + ticksPerBeat / 2,
                drum: 'hihat',
                velocity: 60,
              },
            );
          }
      }
    }

    return events;
  }

  private static generateFillEvents(
    options: PatternGenerationOptions,
    beatsPerBar: number,
    bars: number,
    ticksPerBeat: number = this.TICKS_PER_QUARTER,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];

    // Add fill in the last bar
    if (bars > 0) {
      const fillBarOffset = Math.max(
        0,
        (bars - 1) * beatsPerBar * ticksPerBeat,
      );
      const fillComplexity = Math.min(options.complexity, 8);

      // Generate tom fill
      for (let i = 0; i < fillComplexity; i++) {
        const tick =
          fillBarOffset +
          2 * ticksPerBeat +
          (i * ticksPerBeat) / fillComplexity;
        const drum = i % 2 === 0 ? 'tom1' : 'tom2';
        events.push({
          tick: Math.round(tick),
          drum: drum as DrumType,
          velocity: 90 + i * 5,
        });
      }

      // Crash at the end
      events.push({
        tick: fillBarOffset + 4 * ticksPerBeat,
        drum: 'crash',
        velocity: 120,
      });
    }

    return events;
  }

  private static applySwing(
    events: DrumEvent[],
    swingConfig: SwingConfig,
  ): DrumEvent[] {
    const swingAmount = swingConfig.amount;
    const noteValue = swingConfig.note_value;
    const swingTicks =
      noteValue === 'eighth'
        ? this.TICKS_PER_QUARTER / 2
        : this.TICKS_PER_QUARTER / 4;

    return events.map((event) => {
      const beatPosition = event.tick % this.TICKS_PER_QUARTER;
      const isOffBeat = beatPosition === swingTicks;

      if (isOffBeat) {
        // Apply swing to off-beat notes
        const swingOffset = swingTicks * swingAmount * 0.1; // 10% swing per amount unit
        return {
          ...event,
          tick: event.tick + Math.round(swingOffset),
        };
      }

      return event;
    });
  }

  private static applyHumanization(
    events: DrumEvent[],
    humanizeAmount: number,
  ): DrumEvent[] {
    const maxDeviation = 20 * humanizeAmount; // Up to 20 ticks deviation per humanize unit

    return events.map((event) => ({
      ...event,
      tick: event.tick + Math.round((Math.random() - 0.5) * maxDeviation),
      velocity: Math.min(
        127,
        Math.max(
          1,
          event.velocity +
            Math.round((Math.random() - 0.5) * 20 * humanizeAmount),
        ),
      ),
    }));
  }

  private static createPatternVariation(
    basePattern: DrumPattern,
    variationNumber: number,
  ): DrumPattern {
    const variation: DrumPattern = {
      name: `${basePattern.name}_variation${variationNumber}`,
      bars: basePattern.bars,
      events: [...basePattern.events],
    };

    // Add variation logic here (e.g., add ghost notes, change velocities, etc.)
    variation.events = variation.events.map((event) => {
      if (event.drum === 'hihat' && Math.random() < 0.3) {
        // 30% chance to add ghost hihat notes
        return { ...event, velocity: Math.max(20, event.velocity - 30) };
      }
      return event;
    });

    return variation;
  }

  private static createFillPattern(basePattern: DrumPattern): DrumPattern {
    const fillPattern: DrumPattern = {
      name: `${basePattern.name}_fill`,
      bars: basePattern.bars,
      events: [],
    };

    const ticksPerBeat = this.TICKS_PER_QUARTER;

    // Simple tom fill pattern
    for (let beat = 0; beat < 4; beat++) {
      const tick = beat * ticksPerBeat;
      const drum = beat % 2 === 0 ? 'tom1' : 'tom2';
      fillPattern.events.push({
        tick,
        drum: drum as DrumType,
        velocity: 90 + beat * 5,
      });
    }

    // Crash at the end
    fillPattern.events.push({
      tick: 4 * ticksPerBeat,
      drum: 'crash',
      velocity: 120,
    });

    return fillPattern;
  }

  /**
   * Create a pattern variation (public method)
   * @param basePattern - Base pattern to create variation from
   * @param variationNumber - Variation number
   * @returns Pattern variation
   */
  public static createVariation(
    basePattern: DrumPattern,
    variationNumber = 1,
  ): DrumPattern {
    return this.createPatternVariation(basePattern, variationNumber);
  }

  /**
   * Migrate legacy pattern data to professional format
   * @param legacyPattern - Legacy pattern array or object
   * @param drum - Drum type (if migrating single pattern)
   * @param timeSignature - Time signature (if needed)
   * @returns Professional drum events or drum pattern
   */
  public static migrateLegacyPattern(
    legacyPattern: any,
    drum?: DrumType,
    timeSignature?: TimeSignature,
  ): DrumEvent[] | DrumPattern {
    // If it's a simple array with drum type, convert to events
    if (Array.isArray(legacyPattern) && drum) {
      return this.convertGridToEvents(legacyPattern, drum, 1, 100);
    }

    // Otherwise, convert to full pattern
    const pattern: DrumPattern = {
      name: legacyPattern.name || 'migrated_pattern',
      bars: legacyPattern.bars || 1,
      events: [],
    };

    // Convert legacy grid-based patterns
    if (legacyPattern.kick && Array.isArray(legacyPattern.kick)) {
      pattern.events.push(
        ...this.convertGridToEvents(
          legacyPattern.kick,
          'kick',
          pattern.bars,
          110,
        ),
      );
    }
    if (legacyPattern.snare && Array.isArray(legacyPattern.snare)) {
      pattern.events.push(
        ...this.convertGridToEvents(
          legacyPattern.snare,
          'snare',
          pattern.bars,
          100,
        ),
      );
    }
    if (legacyPattern.hihat && Array.isArray(legacyPattern.hihat)) {
      pattern.events.push(
        ...this.convertGridToEvents(
          legacyPattern.hihat,
          'hihat',
          pattern.bars,
          80,
        ),
      );
    }

    return pattern;
  }
}
