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

  // COUNTDOWN OFFSET: Track countdown duration for display adjustment
  // When countdownBeats > 0, the first N beats are pre-roll (measure -1 or 0)
  private countdownBeats = 0; // Number of beats in countdown (e.g., 4 for one measure of 4/4)
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
   * Set countdown offset (number of beats in pre-roll)
   * This adjusts position display so countdown shows as measure -1 or 0
   */
  setCountdownBeats(beats: number): void {
    this.countdownBeats = beats;
    logger.info('Countdown offset set', { countdownBeats: beats });
  }

  /**
   * Get countdown offset
   */
  getCountdownBeats(): number {
    return this.countdownBeats;
  }

  // Exercise duration tracking for auto-stop functionality
  private exerciseDurationBeats = 0;

  /**
   * Set exercise duration (in beats) for auto-stop functionality
   * This includes countdown beats + actual exercise beats
   * @param totalBars - Total number of bars (including countdown)
   * @param beatsPerBar - Beats per bar from time signature
   */
  setExerciseDuration(totalBars: number, beatsPerBar: number): void {
    this.exerciseDurationBeats = totalBars * beatsPerBar;
    logger.info('Exercise duration set', {
      totalBars,
      beatsPerBar,
      totalBeats: this.exerciseDurationBeats,
    });
  }

  /**
   * Get exercise duration in beats
   * Returns 0 if no duration has been set (infinite playback)
   */
  getExerciseDurationBeats(): number {
    return this.exerciseDurationBeats;
  }

  /**
   * Get exercise duration in seconds based on current tempo
   * Returns 0 if no duration has been set (infinite playback)
   */
  getExerciseDurationSeconds(): number {
    if (this.exerciseDurationBeats === 0) {
      return 0;
    }
    return (this.exerciseDurationBeats / this.tempo) * 60;
  }

  /**
   * Get the current musical position (raw, without countdown adjustment)
   */
  getPosition(): MusicalPosition {
    // Defensive: Ensure all position values are valid numbers
    const pos = this.musicalPosition;
    return {
      bars: typeof pos.bars === 'number' && !isNaN(pos.bars) ? pos.bars : 0,
      beats: typeof pos.beats === 'number' && !isNaN(pos.beats) ? pos.beats : 0,
      sixteenths: typeof pos.sixteenths === 'number' && !isNaN(pos.sixteenths) ? pos.sixteenths : 0,
      ticks: typeof pos.ticks === 'number' && !isNaN(pos.ticks) ? pos.ticks : 0,
    };
  }

  /**
   * Get the display position (adjusted for countdown offset)
   * This is what should be shown in the UI to match DAW conventions
   *
   * Example with 4-beat countdown (one measure of 4/4):
   * - Raw position 0:0:0 → Display -1:0:0 (or 0:0:0 if using 0-based countdown)
   * - Raw position 0:3:0 → Display -1:3:0 (last beat of countdown)
   * - Raw position 0:4:0 → Display 1:0:0 (first beat of exercise)
   * - Raw position 1:0:0 → Display 2:0:0 (second measure of exercise)
   */
  getDisplayPosition(): MusicalPosition {
    const pos = this.getPosition();

    if (this.countdownBeats === 0) {
      // No countdown - return as-is
      return pos;
    }

    // Convert position to total beats
    const beatsPerBar = this.timeSignature.numerator;
    const totalBeats = pos.bars * beatsPerBar + pos.beats + pos.sixteenths / 4;

    // Subtract countdown offset
    const adjustedBeats = totalBeats - this.countdownBeats;

    // Convert back to bars:beats:sixteenths
    const adjustedBars = Math.floor(adjustedBeats / beatsPerBar);
    const beatsInBar = adjustedBeats % beatsPerBar;
    const adjustedBeatsInt = Math.floor(beatsInBar);
    const fractionalBeat = beatsInBar % 1;
    const adjustedSixteenths = Math.floor(fractionalBeat * 4);

    return {
      bars: adjustedBars,
      beats: adjustedBeatsInt,
      sixteenths: adjustedSixteenths,
      ticks: Math.floor(adjustedSixteenths * 240), // 240 ticks per sixteenth
    };
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

    // DIAGNOSTIC: Log if we're about to create NaN values
    if (isNaN(beatsPerBar) || beatsPerBar === 0) {
      logger.warn('🔍 DIAGNOSTIC: beatsPerBar is NaN or 0!', {
        timeSignature: this.timeSignature,
        numerator: this.timeSignature.numerator,
        denominator: this.timeSignature.denominator,
        bpm,
        seconds,
      });
    }

    const bars = Math.floor(totalBeats / beatsPerBar);
    const beatsInBar = totalBeats % beatsPerBar;
    const beats = Math.floor(beatsInBar);
    const fractionalBeat = beatsInBar % 1;
    const sixteenthsInBeat = fractionalBeat * 4;
    const sixteenths = Math.floor(sixteenthsInBeat);

    // Calculate ticks with sub-sixteenth precision
    // 480 ticks per quarter note (MIDI standard), so 120 ticks per sixteenth
    const ticksPerSixteenth = 120;
    const ticks = Math.floor(sixteenthsInBeat * ticksPerSixteenth);

    // DIAGNOSTIC: Log if we created NaN values
    if (isNaN(bars) || isNaN(beats)) {
      logger.warn('🔍 DIAGNOSTIC: Calculated NaN position!', {
        bars,
        beats,
        sixteenths,
        ticks,
        totalBeats,
        beatsPerBar,
        beatsInBar,
        bpm,
        seconds,
      });
    }

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
    // Defensive: Ensure all position values are valid numbers (same as getPosition())
    const pos = this.musicalPosition;
    return {
      bars: typeof pos.bars === 'number' && !isNaN(pos.bars) ? pos.bars : 0,
      beats: typeof pos.beats === 'number' && !isNaN(pos.beats) ? pos.beats : 0,
      sixteenths: typeof pos.sixteenths === 'number' && !isNaN(pos.sixteenths) ? pos.sixteenths : 0,
      ticks: typeof pos.ticks === 'number' && !isNaN(pos.ticks) ? pos.ticks : 0,
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
