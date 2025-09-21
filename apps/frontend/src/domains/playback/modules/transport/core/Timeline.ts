/**
 * Timeline - Musical position tracking and conversion
 *
 * Responsibilities:
 * - Musical position state management
 * - Bar:Beat:Sixteenth calculations
 * - Position conversion utilities
 * - Looping support
 */

import {
  MusicalPosition,
  TimeSignature,
  TransportPosition,
} from '../types/index.js';
import { TimelineError } from '../types/errors.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('TransportTimeline');

export class Timeline {
  private musicalPosition: MusicalPosition = {
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  };

  private timeSignature: TimeSignature = {
    numerator: 4,
    denominator: 4,
  };

  private tempo = 120; // BPM
  private loopEnabled = false;
  private loopStart: MusicalPosition = {
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  };
  private loopEnd: MusicalPosition = {
    bars: 4,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  };

  constructor() {
    logger.debug('Timeline instance created');
  }

  /**
   * Set the current tempo
   */
  setTempo(bpm: number): void {
    if (bpm <= 0 || bpm > 999) {
      throw new TimelineError(
        `Invalid tempo: ${bpm}. Must be between 1 and 999.`,
      );
    }
    this.tempo = bpm;
    logger.info('Tempo updated', { bpm });
  }

  /**
   * Get the current tempo
   */
  getTempo(): number {
    return this.tempo;
  }

  /**
   * Set the time signature
   */
  setTimeSignature(timeSignature: TimeSignature): void {
    if (timeSignature.numerator <= 0 || timeSignature.denominator <= 0) {
      throw new TimelineError('Invalid time signature');
    }
    this.timeSignature = { ...timeSignature };
    logger.info('Time signature updated', { timeSignature });
  }

  /**
   * Get the current time signature
   */
  getTimeSignature(): TimeSignature {
    return { ...this.timeSignature };
  }

  /**
   * Get the current musical position
   */
  getPosition(): MusicalPosition {
    return { ...this.musicalPosition };
  }

  /**
   * Set the musical position
   */
  setPosition(position: MusicalPosition): void {
    this.musicalPosition = { ...position };
    logger.debug('Position updated', { position });
  }

  /**
   * Update position from seconds
   */
  updatePositionFromSeconds(seconds: number, _sampleRate?: number): void {
    const bpm = this.tempo;
    const beatsPerSecond = bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    const beatsPerBar = this.timeSignature.numerator;

    const bars = Math.floor(totalBeats / beatsPerBar);
    const beatsInBar = totalBeats % beatsPerBar;
    const beats = Math.floor(beatsInBar);
    const fractionalBeat = beatsInBar % 1;
    const sixteenthsInBeat = fractionalBeat * 4;
    const sixteenths = Math.floor(sixteenthsInBeat);

    // Calculate ticks with sub-sixteenth precision
    // 960 ticks per quarter note (MIDI standard), so 240 ticks per sixteenth
    const ticksPerSixteenth = 240;
    const ticks = Math.floor(sixteenthsInBeat * ticksPerSixteenth);

    this.musicalPosition = {
      bars,
      beats,
      sixteenths,
      ticks,
    };

    // Handle looping if enabled
    if (this.loopEnabled) {
      this.handleLooping();
    }
  }

  /**
   * Update position from Tone.js position string
   */
  updatePositionFromTone(tonePosition: string): void {
    // Parse "bars:beats:sixteenths" format
    const parts = tonePosition.split(':');
    const bars = parseInt(parts[0] || '0', 10);
    const beats = parseInt(parts[1] || '0', 10);
    const sixteenths = parseInt(parts[2] || '0', 10);

    this.musicalPosition = {
      bars,
      beats,
      sixteenths,
      ticks: Math.floor(sixteenths * 240), // 240 ticks per sixteenth
    };

    // Handle looping if enabled
    if (this.loopEnabled) {
      this.handleLooping();
    }
  }

  /**
   * Convert musical position to seconds
   */
  positionToSeconds(position?: MusicalPosition): number {
    const pos = position || this.musicalPosition;
    const beatsPerBar = this.timeSignature.numerator;
    const totalBeats = pos.bars * beatsPerBar + pos.beats + pos.sixteenths / 4;
    const beatsPerSecond = this.tempo / 60;
    return totalBeats / beatsPerSecond;
  }

  /**
   * Convert musical position to total sixteenths
   */
  positionToSixteenths(position?: MusicalPosition): number {
    const pos = position || this.musicalPosition;
    const beatsPerBar = this.timeSignature.numerator;
    const sixteenthsPerBeat = 4;

    return (
      pos.bars * beatsPerBar * sixteenthsPerBeat +
      pos.beats * sixteenthsPerBeat +
      pos.sixteenths
    );
  }

  /**
   * Convert total sixteenths to musical position
   */
  sixteenthsToPosition(totalSixteenths: number): MusicalPosition {
    const beatsPerBar = this.timeSignature.numerator;
    const sixteenthsPerBeat = 4;
    const sixteenthsPerBar = beatsPerBar * sixteenthsPerBeat;

    const bars = Math.floor(totalSixteenths / sixteenthsPerBar);
    const remainingSixteenths = totalSixteenths % sixteenthsPerBar;
    const beats = Math.floor(remainingSixteenths / sixteenthsPerBeat);
    const sixteenths = remainingSixteenths % sixteenthsPerBeat;

    return {
      bars,
      beats,
      sixteenths,
      ticks: sixteenths * 240, // 240 ticks per sixteenth
    };
  }

  /**
   * Convert position to Tone.js format string
   */
  positionToToneFormat(position?: MusicalPosition): string {
    const pos = position || this.musicalPosition;
    return `${pos.bars}:${pos.beats}:${pos.sixteenths}`;
  }

  /**
   * Get extended transport position with time info
   */
  getTransportPosition(): TransportPosition {
    return {
      ...this.musicalPosition,
      seconds: this.positionToSeconds(),
    };
  }

  /**
   * Enable/disable looping
   */
  setLoopEnabled(enabled: boolean): void {
    this.loopEnabled = enabled;
    logger.info('Loop enabled changed', { enabled });
  }

  /**
   * Set loop points
   */
  setLoopPoints(start: MusicalPosition, end: MusicalPosition): void {
    const startSixteenths = this.positionToSixteenths(start);
    const endSixteenths = this.positionToSixteenths(end);

    if (startSixteenths >= endSixteenths) {
      throw new TimelineError('Loop start must be before loop end');
    }

    this.loopStart = { ...start };
    this.loopEnd = { ...end };
    logger.info('Loop points updated', { start, end });
  }

  /**
   * Check if current position is past loop end and wrap if needed
   */
  private handleLooping(): boolean {
    if (!this.loopEnabled) return false;

    const currentSixteenths = this.positionToSixteenths();
    const loopEndSixteenths = this.positionToSixteenths(this.loopEnd);

    if (currentSixteenths >= loopEndSixteenths) {
      // Jump back to loop start
      this.musicalPosition = { ...this.loopStart };
      logger.debug('Looped back to start', { loopStart: this.loopStart });
      return true;
    }

    return false;
  }

  /**
   * Reset timeline to initial state
   */
  reset(): void {
    this.musicalPosition = {
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    };
    this.tempo = 120;
    this.timeSignature = { numerator: 4, denominator: 4 };
    this.loopEnabled = false;
    logger.info('Timeline reset');
  }

  /**
   * Calculate the duration of one bar in seconds
   */
  getBarDuration(): number {
    const beatsPerBar = this.timeSignature.numerator;
    const beatsPerSecond = this.tempo / 60;
    return beatsPerBar / beatsPerSecond;
  }

  /**
   * Calculate the duration of one beat in seconds
   */
  getBeatDuration(): number {
    return 60 / this.tempo;
  }

  /**
   * Quantize a position to the nearest subdivision
   */
  quantizePosition(
    position: MusicalPosition,
    subdivision: string,
  ): MusicalPosition {
    // Parse subdivision (e.g., '16n' = 16th note, '8n' = 8th note)
    const match = subdivision.match(/^(\d+)n$/);
    if (!match) {
      throw new TimelineError(`Invalid subdivision: ${subdivision}`);
    }

    const matchValue = match[1];
    if (!matchValue) {
      throw new TimelineError(`Invalid subdivision: ${subdivision}`);
    }
    const divisor = parseInt(matchValue, 10);
    const sixteenthsPerSubdivision = 16 / divisor;

    const totalSixteenths = this.positionToSixteenths(position);
    const quantizedSixteenths =
      Math.round(totalSixteenths / sixteenthsPerSubdivision) *
      sixteenthsPerSubdivision;

    return this.sixteenthsToPosition(quantizedSixteenths);
  }
}
