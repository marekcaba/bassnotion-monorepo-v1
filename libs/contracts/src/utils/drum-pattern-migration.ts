/**
 * Drum Pattern Migration Utility
 *
 * Converts legacy drum patterns to professional tick-based format.
 * Handles migration from simple grids to complex musical events.
 *
 * Story 3.15: Professional Musical Time System - Task 3
 */

import { ProfessionalDrumProcessor } from '../services/ProfessionalDrumProcessor.js';
import type {
  DrumPattern,
  DrumEvent,
  DrumTrackData,
} from '../types/musical-time.js';

export interface LegacyDrumPattern {
  enabled: boolean;
  pattern: {
    kick?: number[];
    snare?: number[];
    hihat?: number[];
    crash?: number[];
    ride?: number[];
    tom?: number[];
  };
}

export interface LegacyDrumGrid {
  kick: Array<{ beat: number; isActive: boolean; intensity: string }>;
  snare: Array<{ beat: number; isActive: boolean; intensity: string }>;
  hihat: Array<{ beat: number; isActive: boolean; intensity: string }>;
}

export class DrumPatternMigration {
  /**
   * Migrate legacy drum pattern to professional format
   * @param legacyPattern - Legacy pattern with simple arrays
   * @param tempo - Current tempo for context
   * @returns Professional drum track data
   */
  public static migrateLegacyPattern(
    legacyPattern: LegacyDrumPattern,
    tempo = 120,
  ): DrumTrackData {
    const professionalData: DrumTrackData = {
      enabled: legacyPattern.enabled,
      resolution: 480,
      patterns: [],
      arrangement: [],
    };

    if (!legacyPattern.pattern) {
      return professionalData;
    }

    const events: DrumEvent[] = [];

    // Convert each drum type
    Object.entries(legacyPattern.pattern).forEach(([drumType, grid]) => {
      if (grid && Array.isArray(grid)) {
        const drumEvents = ProfessionalDrumProcessor.convertGridToEvents(
          grid,
          drumType as any,
          1, // 1 bar
          this.getVelocityForDrum(drumType),
        );
        events.push(...drumEvents);
      }
    });

    // Create main pattern
    const mainPattern: DrumPattern = {
      name: 'main_groove',
      bars: 1,
      events,
    };

    professionalData.patterns.push(mainPattern);
    professionalData.arrangement.push('main_groove');

    return professionalData;
  }

  /**
   * Migrate legacy drum grid to professional format
   * @param legacyGrid - Legacy grid with beat objects
   * @returns Professional drum track data
   */
  public static migrateLegacyGrid(legacyGrid: LegacyDrumGrid): DrumTrackData {
    const professionalData: DrumTrackData = {
      enabled: true,
      resolution: 480,
      patterns: [],
      arrangement: [],
    };

    const events: DrumEvent[] = [];

    // Convert each drum type from grid
    Object.entries(legacyGrid).forEach(([drumType, beats]) => {
      if (beats && Array.isArray(beats)) {
        const gridArray = beats.map((beat) =>
          beat.isActive ? this.intensityToVelocity(beat.intensity) : 0,
        );

        const drumEvents = ProfessionalDrumProcessor.convertGridToEvents(
          gridArray,
          drumType as any,
          1,
          100, // Base velocity
        );
        events.push(...drumEvents);
      }
    });

    // Create main pattern
    const mainPattern: DrumPattern = {
      name: 'main_groove',
      bars: 1,
      events,
    };

    professionalData.patterns.push(mainPattern);
    professionalData.arrangement.push('main_groove');

    return professionalData;
  }

  /**
   * Migrate timestamp-based drum events to tick-based events
   * @param timestampEvents - Events with timestamp in milliseconds
   * @param tempo - Current tempo
   * @returns Tick-based drum events
   */
  public static migrateTimestampEvents(
    timestampEvents: Array<{
      timestamp: number;
      type: 'kick' | 'snare' | 'hihat' | 'crash' | 'ride' | 'tom';
      velocity: number;
    }>,
    tempo = 120,
  ): DrumEvent[] {
    const events: DrumEvent[] = [];

    timestampEvents.forEach((event) => {
      // Convert milliseconds to ticks
      const tick = Math.round((event.timestamp / 1000) * (tempo / 60) * 480);

      events.push({
        tick,
        drum: event.type,
        velocity: event.velocity,
      });
    });

    // Sort by tick position
    return events.sort((a, b) => a.tick - b.tick);
  }

  /**
   * Create professional pattern from style description
   * @param style - Musical style name
   * @param complexity - Complexity level (1-10)
   * @param bars - Number of bars
   * @returns Professional drum pattern
   */
  public static createPatternFromStyle(
    style: string,
    complexity = 5,
    bars = 1,
  ): DrumPattern {
    const styleMap: Record<string, any> = {
      rock: 'rock',
      jazz: 'jazz',
      funk: 'funk',
      latin: 'latin',
      reggae: 'reggae',
      shuffle: 'shuffle',
      'rock steady': 'rock',
      'jazz swing': 'jazz',
      'funk groove': 'funk',
      'bossa nova': 'latin',
    };

    const mappedStyle = styleMap[style.toLowerCase()] || 'rock';

    return ProfessionalDrumProcessor.generatePattern(
      {
        style: mappedStyle,
        complexity: Math.min(Math.max(complexity, 1), 10) as any,
        fills: complexity >= 7,
        ghost_notes: complexity >= 5,
        accents: complexity >= 3,
        swing:
          mappedStyle === 'jazz'
            ? { enabled: true, amount: 0.6, note_value: 'eighth' }
            : undefined,
      },
      { numerator: 4, denominator: 4 },
      bars,
    );
  }

  /**
   * Upgrade simple 8-beat pattern to 16-beat professional pattern
   * @param simple8Pattern - Simple 8-beat pattern
   * @param drumType - Drum type
   * @returns Professional 16-beat pattern
   */
  public static upgrade8To16Pattern(
    simple8Pattern: number[],
    drumType: string,
  ): DrumEvent[] {
    // Create 16-beat pattern by interpolating
    const expanded16Pattern: number[] = [];

    simple8Pattern.forEach((beat, index) => {
      expanded16Pattern.push(beat);

      // Add subdivision based on drum type and complexity
      if (drumType === 'hihat' && beat > 0) {
        // Add ghost hihat between main hits
        expanded16Pattern.push(beat * 0.6);
      } else if (drumType === 'snare' && beat > 0 && Math.random() < 0.3) {
        // Add occasional ghost snare
        expanded16Pattern.push(beat * 0.4);
      } else {
        // No subdivision
        expanded16Pattern.push(0);
      }
    });

    return ProfessionalDrumProcessor.convertGridToEvents(
      expanded16Pattern,
      drumType as any,
      1,
      this.getVelocityForDrum(drumType),
    );
  }

  /**
   * Add swing feel to existing pattern
   * @param events - Drum events
   * @param swingAmount - Swing amount (0-1)
   * @returns Events with swing timing
   */
  public static addSwingFeel(
    events: DrumEvent[],
    swingAmount = 0.6,
  ): DrumEvent[] {
    const swingTicks = 480 / 2; // 8th note swing

    return events.map((event) => {
      const beatPosition = event.tick % 480;
      const isOffBeat = beatPosition === swingTicks;

      if (isOffBeat) {
        // Apply swing to off-beat notes
        const swingOffset = swingTicks * swingAmount * 0.1;
        return {
          ...event,
          tick: event.tick + Math.round(swingOffset),
        };
      }

      return event;
    });
  }

  /**
   * Create fill pattern for transitions
   * @param basePattern - Base pattern to create fill from
   * @param fillType - Type of fill ('simple', 'tom', 'crash')
   * @returns Fill pattern
   */
  public static createFillPattern(
    basePattern: DrumPattern,
    fillType: 'simple' | 'tom' | 'crash' = 'simple',
  ): DrumPattern {
    const fillEvents: DrumEvent[] = [];
    const ticksPerBeat = 480;

    switch (fillType) {
      case 'simple':
        // Simple snare fill
        for (let i = 0; i < 8; i++) {
          fillEvents.push({
            tick: i * (ticksPerBeat / 2), // 8th notes
            drum: 'snare',
            velocity: 90 + i * 2,
          });
        }
        break;

      case 'tom':
        // Tom fill
        const toms = ['tom1', 'tom2', 'tom3'];
        for (let i = 0; i < 12; i++) {
          fillEvents.push({
            tick: i * (ticksPerBeat / 3), // Triplets
            drum: toms[i % 3] as any,
            velocity: 85 + i * 3,
          });
        }
        break;

      case 'crash':
        // Crash with snare buildup
        for (let i = 0; i < 6; i++) {
          fillEvents.push({
            tick: i * (ticksPerBeat / 2),
            drum: 'snare',
            velocity: 70 + i * 8,
          });
        }
        fillEvents.push({
          tick: 4 * ticksPerBeat,
          drum: 'crash',
          velocity: 127,
        });
        break;
    }

    return {
      name: `${basePattern.name}_fill_${fillType}`,
      bars: 1,
      events: fillEvents,
    };
  }

  // Private helper methods

  private static getVelocityForDrum(drumType: string): number {
    const velocityMap: Record<string, number> = {
      kick: 110,
      snare: 100,
      hihat: 80,
      crash: 120,
      ride: 90,
      tom: 95,
      tom1: 95,
      tom2: 90,
      tom3: 85,
    };

    return velocityMap[drumType] || 100;
  }

  private static intensityToVelocity(intensity: string): number {
    const intensityMap: Record<string, number> = {
      light: 60,
      medium: 90,
      high: 120,
      max: 127,
    };

    return intensityMap[intensity] || 90;
  }
}
