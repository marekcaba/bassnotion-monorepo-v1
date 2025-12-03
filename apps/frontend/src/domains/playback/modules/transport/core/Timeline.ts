/**
 * Timeline - Musical position tracking and conversion
 *
 * Responsibilities:
 * - Musical position state management
 * - Bar:Beat:Sixteenth calculations
 * - Position conversion utilities
 * - Looping support
 *
 * NOTE: Countdown functionality has been removed from Timeline.
 * Use MusicalPositionManager (via TransportController) for countdown features.
 */

import {
  MusicalPosition,
  TimeSignature,
  TransportPosition,
} from '../types/index.js';
import { TimelineError } from '../types/errors.js';
import { createStructuredLogger } from '../../shared/index.js';
import { musicalTruth } from '../../tempo/MusicalTruthAuthority.js';

const logger = createStructuredLogger('TransportTimeline');

export class Timeline {
  private musicalPosition: MusicalPosition = {
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
  };

  // ❌ REMOVED: NO tempo/timeSignature storage
  // ✅ All values now read from musicalTruth singleton

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
   * @deprecated Use musicalTruth.setFromExercise() instead
   */
  setTempo(bpm: number): void {
    // This method is kept for backward compatibility but does nothing
    // The actual tempo is managed by MusicalTruthAuthority
    logger.warn('⚠️ setTempo() called - use musicalTruth.setFromExercise() instead', { bpm });
  }

  /**
   * Get the current tempo
   */
  getTempo(): number {
    return musicalTruth.getBPM();
  }

  /**
   * Set the time signature
   * @deprecated Use musicalTruth.setFromExercise() instead
   */
  setTimeSignature(timeSignature: TimeSignature): void {
    // This method is kept for backward compatibility but does nothing
    // The actual time signature is managed by MusicalTruthAuthority
    logger.warn('⚠️ setTimeSignature() called - use musicalTruth.setFromExercise() instead', { timeSignature });
  }

  /**
   * Get the current time signature
   */
  getTimeSignature(): TimeSignature {
    return musicalTruth.getTimeSignature();
  }

  /**
   * Set exercise duration (in beats) for auto-stop functionality
   * @deprecated Use musicalTruth.setFromExercise() instead - duration is calculated automatically
   */
  setExerciseDuration(totalBars: number, beatsPerBar: number): void {
    // This method is kept for backward compatibility but does nothing
    // Duration is managed by MusicalTruthAuthority
    logger.warn('⚠️ setExerciseDuration() called - use musicalTruth.setFromExercise() instead', {
      totalBars,
      beatsPerBar
    });
  }

  /**
   * Get exercise duration in beats
   */
  getExerciseDurationBeats(): number {
    return musicalTruth.getTotalBeats();
  }

  /**
   * Get exercise duration in seconds based on current tempo
   */
  getExerciseDurationSeconds(): number {
    const totalBeats = musicalTruth.getTotalBeats();
    return musicalTruth.beatsToSeconds(totalBeats);
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
   * Get the display position (same as raw position - no countdown adjustment)
   *
   * NOTE: Countdown display logic has been moved to MusicalPositionManager.
   * This method now returns the raw position without any adjustments.
   * For countdown-aware position display, use:
   *   CoreServices.getTransportController().getDisplayPosition()
   */
  getDisplayPosition(): MusicalPosition {
    return this.getPosition();
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
    const bpm = musicalTruth.getBPM();
    const beatsPerSecond = bpm / 60;
    const totalBeats = seconds * beatsPerSecond;
    const beatsPerBar = musicalTruth.getTimeSignature().numerator;

    // DIAGNOSTIC: Log if we're about to create NaN values
    if (isNaN(beatsPerBar) || beatsPerBar === 0) {
      const timeSignature = musicalTruth.getTimeSignature();
      logger.warn('🔍 DIAGNOSTIC: beatsPerBar is NaN or 0!', {
        timeSignature,
        numerator: timeSignature.numerator,
        denominator: timeSignature.denominator,
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
    const beatsPerBar = musicalTruth.getTimeSignature().numerator;
    const totalBeats = pos.bars * beatsPerBar + pos.beats + pos.sixteenths / 4;
    const bpm = musicalTruth.getBPM();
    const beatsPerSecond = bpm / 60;
    return totalBeats / beatsPerSecond;
  }

  /**
   * Convert musical position to total sixteenths
   */
  positionToSixteenths(position?: MusicalPosition): number {
    const pos = position || this.musicalPosition;
    const beatsPerBar = musicalTruth.getTimeSignature().numerator;
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
    const beatsPerBar = musicalTruth.getTimeSignature().numerator;
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
    this.loopEnabled = false;
    logger.info('Timeline reset');
  }

  /**
   * Calculate the duration of one bar in seconds
   */
  getBarDuration(): number {
    const beatsPerBar = musicalTruth.getTimeSignature().numerator;
    const bpm = musicalTruth.getBPM();
    const beatsPerSecond = bpm / 60;
    return beatsPerBar / beatsPerSecond;
  }

  /**
   * Calculate the duration of one beat in seconds
   */
  getBeatDuration(): number {
    const bpm = musicalTruth.getBPM();
    return 60 / bpm;
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
