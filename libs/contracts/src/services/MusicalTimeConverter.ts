/**
 * MusicalTimeConverter Service
 *
 * Professional musical time conversion service that handles timing like Logic Pro X and Ableton Live.
 * Converts between musical time (bars, beats, ticks) and real time (milliseconds).
 *
 * Story 3.15: Professional Musical Time System
 * Uses industry-standard 480 ticks per quarter note for maximum precision.
 */

import type { TimeSignature } from '../types/musical-timing.js';

import type { MusicalPosition } from '../types/musical-timing.js';

export interface MusicalTimeConfig {
  tempo: number; // BPM (beats per minute)
  timeSignature: TimeSignature; // Time signature
  resolution?: number; // Ticks per quarter note (default: 480)
}

export interface TickPosition {
  tick: number; // Absolute tick position from start
  tempo: number; // Current tempo
  resolution: number; // Ticks per quarter note
}

export class MusicalTimeConverter {
  /**
   * Industry standard resolution: 480 ticks per quarter note
   * This matches Logic Pro X, Ableton Live, and MIDI standard
   */
  public static readonly TICKS_PER_QUARTER = 480;

  /**
   * Convert ticks to milliseconds
   * @param tick - Tick position (0-based)
   * @param tempo - Tempo in BPM
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Milliseconds from start
   */
  public static tickToMilliseconds(
    tick: number,
    tempo: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    if (tempo <= 0) throw new Error('Invalid tempo: must be greater than 0');
    if (resolution <= 0) throw new Error('Resolution must be positive');

    const ticksPerSecond = (tempo / 60) * resolution;
    return (tick / ticksPerSecond) * 1000;
  }

  /**
   * Convert milliseconds to ticks
   * @param milliseconds - Time in milliseconds
   * @param tempo - Tempo in BPM
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Tick position
   */
  public static millisecondsToTick(
    milliseconds: number,
    tempo: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    if (tempo <= 0) throw new Error('Invalid tempo: must be greater than 0');
    if (resolution <= 0) throw new Error('Resolution must be positive');

    const ticksPerSecond = (tempo / 60) * resolution;
    return (milliseconds / 1000) * ticksPerSecond;
  }

  /**
   * FAANG FIX: Convert ticks to seconds using live BPM
   * This should be called at PLAYBACK TIME with live BPM from Tone.Transport.bpm.value,
   * not at registration time when BPM might be stale.
   *
   * @param ticks - Tick position (480 PPQ resolution)
   * @param bpm - Current tempo in BPM (use live value from Tone.Transport)
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Duration in seconds
   *
   * @example
   * // At playback time, use live BPM:
   * const liveBpm = Tone.Transport.bpm.value;
   * const durationSeconds = MusicalTimeConverter.ticksToSeconds(960, liveBpm);
   * // At 120 BPM: 960 ticks = 2 beats = 1.0 seconds
   * // At 69 BPM: 960 ticks = 2 beats = 1.739 seconds
   */
  public static ticksToSeconds(
    ticks: number,
    bpm: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    if (bpm <= 0) throw new Error('Invalid BPM: must be greater than 0');
    if (resolution <= 0) throw new Error('Resolution must be positive');

    // Convert ticks to milliseconds, then to seconds
    const milliseconds = this.tickToMilliseconds(ticks, bpm, resolution);
    return milliseconds / 1000;
  }

  /**
   * Convert seconds to ticks using BPM
   * @param seconds - Duration in seconds
   * @param bpm - Tempo in BPM
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Tick count
   */
  public static secondsToTicks(
    seconds: number,
    bpm: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    if (bpm <= 0) throw new Error('Invalid BPM: must be greater than 0');
    if (resolution <= 0) throw new Error('Resolution must be positive');

    return this.millisecondsToTick(seconds * 1000, bpm, resolution);
  }

  /**
   * Convert musical position (bar, beat, subdivision) to tick position
   * @param position - Musical position
   * @param timeSignature - Time signature
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Tick position
   */
  public static musicalPositionToTick(
    position: MusicalPosition,
    timeSignature: TimeSignature,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const { measure, beat, subdivision } = position;

    // Validate inputs
    if (measure < 1) throw new Error('Measure must be 1 or greater');
    if (beat < 1) throw new Error('Beat must be 1 or greater');
    if (beat > timeSignature.numerator)
      throw new Error(
        `Invalid time signature: beat ${beat} exceeds ${timeSignature.numerator}`,
      );
    if (subdivision < 0) throw new Error('Subdivision must be 0 or greater');

    const ticksPerBeat = resolution;
    const beatsPerBar = timeSignature.numerator;

    // Calculate total ticks
    const barTicks = (measure - 1) * beatsPerBar * ticksPerBeat;
    const beatTicks = (beat - 1) * ticksPerBeat;
    const subdivisionTicks = subdivision * (ticksPerBeat / 4); // 16th note subdivisions

    return barTicks + beatTicks + subdivisionTicks;
  }

  /**
   * Convert tick position to musical position (bar, beat, subdivision)
   * @param tick - Tick position
   * @param timeSignature - Time signature
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Musical position
   */
  public static tickToMusicalPosition(
    tick: number,
    timeSignature: TimeSignature,
    resolution: number = this.TICKS_PER_QUARTER,
  ): MusicalPosition {
    // Handle negative ticks by clamping to zero
    const safeTick = Math.max(0, tick);

    const ticksPerBeat = resolution;
    const beatsPerBar = timeSignature.numerator;
    const ticksPerBar = beatsPerBar * ticksPerBeat;

    // Calculate measure (1-based)
    const measure = Math.floor(safeTick / ticksPerBar) + 1;

    // Calculate beat within measure (1-based)
    const ticksInBar = safeTick % ticksPerBar;
    const beat = Math.floor(ticksInBar / ticksPerBeat) + 1;

    // Calculate subdivision within beat (0-based, 16th note resolution)
    const ticksInBeat = ticksInBar % ticksPerBeat;
    const subdivision = Math.floor(ticksInBeat / (ticksPerBeat / 4));

    return { measure, beat, subdivision };
  }

  /**
   * Convert musical position directly to milliseconds
   * @param position - Musical position
   * @param config - Musical time configuration
   * @returns Milliseconds from start
   */
  public static musicalPositionToMilliseconds(
    position: MusicalPosition,
    config: MusicalTimeConfig,
  ): number {
    const resolution = config.resolution || this.TICKS_PER_QUARTER;
    const tick = this.musicalPositionToTick(
      position,
      config.timeSignature,
      resolution,
    );
    return this.tickToMilliseconds(tick, config.tempo, resolution);
  }

  /**
   * Convert milliseconds to musical position
   * @param milliseconds - Time in milliseconds
   * @param config - Musical time configuration
   * @returns Musical position
   */
  public static millisecondsToMusicalPosition(
    milliseconds: number,
    config: MusicalTimeConfig,
  ): MusicalPosition {
    const resolution = config.resolution || this.TICKS_PER_QUARTER;
    const tick = this.millisecondsToTick(
      milliseconds,
      config.tempo,
      resolution,
    );
    return this.tickToMusicalPosition(tick, config.timeSignature, resolution);
  }

  /**
   * Calculate the total duration of an exercise in milliseconds
   * @param totalBars - Total number of bars
   * @param timeSignature - Time signature
   * @param tempo - Tempo in BPM
   * @returns Duration in milliseconds
   */
  public static calculateExerciseDuration(
    totalBars: number,
    timeSignature: TimeSignature,
    tempo: number,
  ): number {
    if (totalBars <= 0) throw new Error('Total bars must be positive');
    if (tempo <= 0) throw new Error('Invalid tempo: must be greater than 0');

    const totalBeats = totalBars * timeSignature.numerator;
    const totalTicks = totalBeats * this.TICKS_PER_QUARTER;
    return this.tickToMilliseconds(totalTicks, tempo);
  }

  /**
   * Calculate the duration of a musical note in ticks
   * @param noteDuration - Note duration (quarter, eighth, etc.)
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Duration in ticks
   */
  public static getNoteDurationInTicks(
    noteDuration: string,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const durationMap: Record<string, number> = {
      whole: resolution * 4,
      half: resolution * 2,
      quarter: resolution,
      eighth: resolution / 2,
      sixteenth: resolution / 4,
      'thirty-second': resolution / 8,
      'sixty-fourth': resolution / 16,
      // Triplet durations
      'quarter-triplet': (resolution * 2) / 3,
      'eighth-triplet': resolution / 3,
      'sixteenth-triplet': resolution / 6,
    };

    const ticks = durationMap[noteDuration];
    if (ticks === undefined) {
      throw new Error(`Unknown note duration: ${noteDuration}`);
    }

    return ticks;
  }

  /**
   * Convert tempo to different time unit
   * @param tempo - Original tempo in BPM
   * @param fromUnit - Source unit ('quarter', 'eighth', etc.)
   * @param toUnit - Target unit ('quarter', 'eighth', etc.)
   * @returns Converted tempo
   */
  public static convertTempo(
    tempo: number,
    fromUnit = 'quarter',
    toUnit = 'quarter',
  ): number {
    if (tempo <= 0) throw new Error('Invalid tempo: must be greater than 0');

    const unitMultipliers: Record<string, number> = {
      whole: 4,
      half: 2,
      quarter: 1,
      eighth: 0.5,
      sixteenth: 0.25,
    };

    const fromMultiplier = unitMultipliers[fromUnit];
    const toMultiplier = unitMultipliers[toUnit];

    if (fromMultiplier === undefined || toMultiplier === undefined) {
      throw new Error(`Unknown tempo unit: ${fromUnit} or ${toUnit}`);
    }

    return tempo * (fromMultiplier / toMultiplier);
  }

  /**
   * Create a tick position object
   * @param tick - Tick position
   * @param tempo - Tempo in BPM
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Tick position object
   */
  public static createTickPosition(
    tick: number,
    tempo: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): TickPosition {
    return { tick, tempo, resolution };
  }

  /**
   * Check if a tick position represents a triplet subdivision
   * @param tick - Tick position within a beat
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns True if this is a triplet position
   */
  public static isTripletPosition(
    tick: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): boolean {
    const ticksInBeat = tick % resolution;
    const tripletTick = resolution / 3; // 160 ticks for triplet eighth

    // Check if tick aligns with triplet grid
    return ticksInBeat % tripletTick === 0;
  }

  /**
   * Quantize a tick position to the nearest musical grid
   * @param tick - Original tick position
   * @param quantization - Quantization resolution (4 = 16th notes, 3 = triplets, etc.)
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Quantized tick position
   */
  public static quantizeTick(
    tick: number,
    quantization = 4,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const quantizationTicks = resolution / quantization;
    return Math.round(tick / quantizationTicks) * quantizationTicks;
  }

  /**
   * Quantize a tick to the nearest subdivision grid
   * @param tick - Original tick position
   * @param subdivisions - Number of subdivisions per beat (4 = 16th notes)
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Quantized tick position
   */
  public static quantizeToSubdivision(
    tick: number,
    subdivisions = 4,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const subdivisionTicks = resolution / subdivisions;
    return Math.round(tick / subdivisionTicks) * subdivisionTicks;
  }

  /**
   * Quantize a tick to the nearest triplet grid
   * @param tick - Original tick position
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Quantized tick position
   */
  public static quantizeToTriplet(
    tick: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const tripletTicks = resolution / 3; // 160 ticks per triplet eighth
    return Math.round(tick / tripletTicks) * tripletTicks;
  }

  /**
   * Apply swing feel to a tick position
   * @param tick - Original tick position
   * @param swingFactor - Swing factor (0-1, where 0.5 is no swing, 0.67 is heavy swing)
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Swung tick position
   */
  public static applySwingFeel(
    tick: number,
    swingFactor = 0.6,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const eighthNoteTicks = resolution / 2; // 240 ticks per eighth note
    const beatPosition = tick % resolution;

    // Apply swing to off-beats (second eighth note of each beat)
    if (beatPosition >= eighthNoteTicks) {
      const swingDelay = (swingFactor - 0.5) * eighthNoteTicks;
      return tick + swingDelay;
    }

    return tick;
  }

  /**
   * Calculate polyrhythm tick position
   * @param tick - Original tick position
   * @param numerator - Polyrhythm numerator (e.g., 3 in "3 against 2")
   * @param denominator - Polyrhythm denominator (e.g., 2 in "3 against 2")
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Polyrhythm tick position
   */
  public static calculatePolyrhythm(
    tick: number,
    numerator: number,
    denominator: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const ratio = denominator / numerator;
    return Math.round(tick * ratio);
  }

  /**
   * Convert musical position to milliseconds (alias for musicalPositionToMilliseconds)
   * @param position - Musical position
   * @param config - Musical time configuration
   * @returns Milliseconds from start
   */
  public static positionToMs(
    position: MusicalPosition,
    config: MusicalTimeConfig,
  ): number {
    return this.musicalPositionToMilliseconds(position, config);
  }

  /**
   * Convert note duration to milliseconds
   * @param noteDuration - Note duration (quarter, eighth, etc.)
   * @param tempo - Tempo in BPM
   * @param resolution - Ticks per quarter note (default: 480)
   * @returns Duration in milliseconds
   */
  public static durationToMs(
    noteDuration: string,
    tempo: number,
    resolution: number = this.TICKS_PER_QUARTER,
  ): number {
    const ticks = this.getNoteDurationInTicks(noteDuration, resolution);
    return this.tickToMilliseconds(ticks, tempo, resolution);
  }

  /**
   * Convert milliseconds to musical position (alias for millisecondsToMusicalPosition)
   * @param milliseconds - Time in milliseconds
   * @param config - Musical time configuration
   * @returns Musical position
   */
  public static msToPosition(
    milliseconds: number,
    config: MusicalTimeConfig,
  ): MusicalPosition {
    return this.millisecondsToMusicalPosition(milliseconds, config);
  }
}
