/**
 * Musical Time Converter Utility
 *
 * Converts between musical time (beats, measures) and absolute time (milliseconds)
 * for accurate playback and synchronization.
 */

import {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
  DURATION_BEAT_VALUES,
  SwingConfig,
} from '../types/musical-timing.js';

export class MusicalTimeConverter {
  /**
   * Convert beats to milliseconds based on tempo
   */
  static beatsToMs(beats: number, bpm: number): number {
    if (bpm <= 0) {
      throw new Error('BPM must be greater than 0');
    }
    return (beats * 60000) / bpm;
  }

  /**
   * Convert milliseconds to beats based on tempo
   */
  static msToBeats(ms: number, bpm: number): number {
    if (bpm <= 0) {
      throw new Error('BPM must be greater than 0');
    }
    return (ms * bpm) / 60000;
  }

  /**
   * Get beat value for a note duration
   */
  static durationToBeats(duration: NoteDuration): number {
    const beats = DURATION_BEAT_VALUES[duration];
    if (beats === undefined) {
      throw new Error(`Unknown duration: ${duration}`);
    }
    return beats;
  }

  /**
   * Convert note duration to milliseconds
   */
  static durationToMs(duration: NoteDuration, bpm: number): number {
    const beats = this.durationToBeats(duration);
    return this.beatsToMs(beats, bpm);
  }

  /**
   * Convert musical position to absolute time in milliseconds
   */
  static positionToMs(
    position: MusicalPosition,
    timeSignature: TimeSignature,
    bpm: number,
  ): number {
    // Calculate total beats from start
    const beatsPerMeasure = timeSignature.numerator;
    const beatValue = 4 / timeSignature.denominator; // Adjust for different denominators

    const measuresCompleted = position.measure - 1;
    const beatsCompleted = position.beat - 1;
    const subdivisionFraction = position.subdivision / 4; // Assuming 16th note subdivisions

    const totalBeats =
      (measuresCompleted * beatsPerMeasure +
        beatsCompleted +
        subdivisionFraction) *
      beatValue;

    return this.beatsToMs(totalBeats, bpm);
  }

  /**
   * Convert milliseconds to musical position
   */
  static msToPosition(
    ms: number,
    timeSignature: TimeSignature,
    bpm: number,
  ): MusicalPosition {
    const totalBeats = this.msToBeats(ms, bpm);
    const beatValue = 4 / timeSignature.denominator;
    const adjustedBeats = totalBeats / beatValue;

    const beatsPerMeasure = timeSignature.numerator;
    const measure = Math.floor(adjustedBeats / beatsPerMeasure) + 1;
    const beatInMeasure = adjustedBeats % beatsPerMeasure;
    const beat = Math.floor(beatInMeasure) + 1;
    const subdivision = Math.round((beatInMeasure % 1) * 4);

    return {
      measure,
      beat: beat > beatsPerMeasure ? beatsPerMeasure : beat,
      subdivision: subdivision >= 4 ? 3 : subdivision,
    };
  }

  /**
   * Apply swing feel to a position
   * Delays every other eighth note to create swing rhythm
   */
  static applySwing(
    position: MusicalPosition,
    duration: NoteDuration,
    swingConfig: SwingConfig | undefined,
    timeSignature: TimeSignature,
    bpm: number,
  ): number {
    if (!swingConfig?.enabled || swingConfig.ratio === 0.5) {
      // No swing or straight feel
      return this.positionToMs(position, timeSignature, bpm);
    }

    // Check if this is an off-beat eighth note
    const isEighthNote = duration === 'eighth' || duration === 'dotted-eighth';
    const isOffBeat = position.subdivision === 2; // Second sixteenth of the beat

    if (isEighthNote && isOffBeat) {
      // Apply swing delay
      const straightMs = this.positionToMs(position, timeSignature, bpm);
      const beatMs = this.beatsToMs(1, bpm);
      const swingDelay = beatMs * (swingConfig.ratio - 0.5);
      return straightMs + swingDelay;
    }

    return this.positionToMs(position, timeSignature, bpm);
  }

  /**
   * Calculate the end position of a note
   */
  static getEndPosition(
    startPosition: MusicalPosition,
    duration: NoteDuration,
    timeSignature: TimeSignature,
  ): MusicalPosition {
    const durationBeats = this.durationToBeats(duration);
    const beatValue = 4 / timeSignature.denominator;
    const adjustedDuration = durationBeats / beatValue;

    // Convert position to total beats
    const startTotalBeats =
      (startPosition.measure - 1) * timeSignature.numerator +
      (startPosition.beat - 1) +
      startPosition.subdivision / 4;

    const endTotalBeats = startTotalBeats + adjustedDuration;

    // Convert back to position
    const endMeasure = Math.floor(endTotalBeats / timeSignature.numerator) + 1;
    const beatsInLastMeasure = endTotalBeats % timeSignature.numerator;
    const endBeat = Math.floor(beatsInLastMeasure) + 1;
    const endSubdivision = Math.round((beatsInLastMeasure % 1) * 4);

    return {
      measure: endMeasure,
      beat: endBeat,
      subdivision: endSubdivision >= 4 ? 3 : endSubdivision,
    };
  }

  /**
   * Check if two positions are equal
   */
  static positionsEqual(a: MusicalPosition, b: MusicalPosition): boolean {
    return (
      a.measure === b.measure &&
      a.beat === b.beat &&
      a.subdivision === b.subdivision
    );
  }

  /**
   * Compare two positions
   * Returns: -1 if a < b, 0 if equal, 1 if a > b
   */
  static comparePositions(a: MusicalPosition, b: MusicalPosition): number {
    if (a.measure !== b.measure) {
      return a.measure < b.measure ? -1 : 1;
    }
    if (a.beat !== b.beat) {
      return a.beat < b.beat ? -1 : 1;
    }
    if (a.subdivision !== b.subdivision) {
      return a.subdivision < b.subdivision ? -1 : 1;
    }
    return 0;
  }

  /**
   * Format position as string (e.g., "1.2.0" for measure 1, beat 2, subdivision 0)
   */
  static formatPosition(position: MusicalPosition): string {
    return `${position.measure}.${position.beat}.${position.subdivision}`;
  }

  /**
   * Parse position from string
   */
  static parsePosition(positionStr: string): MusicalPosition {
    const parts = positionStr.split('.').map((p) => parseInt(p, 10));
    if (parts.length !== 3 || parts.some((p) => isNaN(p))) {
      throw new Error(`Invalid position string: ${positionStr}`);
    }
    return {
      measure: parts[0],
      beat: parts[1],
      subdivision: parts[2],
    };
  }

  /**
   * Quantize a position to the nearest grid value
   */
  static quantizePosition(
    position: MusicalPosition,
    gridSubdivision = 4, // Default to 16th notes
  ): MusicalPosition {
    const quantum = 4 / gridSubdivision;
    const quantizedSubdivision =
      Math.round(position.subdivision / quantum) * quantum;

    if (quantizedSubdivision >= 4) {
      // Rolled over to next beat
      return {
        measure: position.beat >= 4 ? position.measure + 1 : position.measure,
        beat: position.beat >= 4 ? 1 : position.beat + 1,
        subdivision: 0,
      };
    }

    return {
      ...position,
      subdivision: quantizedSubdivision,
    };
  }
}
