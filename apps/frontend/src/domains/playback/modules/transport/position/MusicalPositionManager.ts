/**
 * MusicalPositionManager - Handles musical time representation
 *
 * Converts between musical time (bars:beats:sixteenths) and seconds,
 * manages loop points, and tracks position state.
 *
 * Musical time format: "bars:beats:sixteenths"
 * - bars: 0-based bar number
 * - beats: 0-based beat within bar (0 to timeSignature-1)
 * - sixteenths: 0-based sixteenth within beat (0-3)
 */

import { EventEmitter } from '../shared/EventEmitter.js';
import { createStructuredLogger } from '../../shared/index.js';
import type { MusicalPosition, TimeSignature } from '../../types/index.js';
import * as Tone from 'tone';

const logger = createStructuredLogger('MusicalPositionManager');

export interface PositionConfig {
  timeSignature?: TimeSignature;
  tempo?: number;
  ppq?: number; // Pulses per quarter note
}

export interface LoopRegion {
  start: MusicalPosition;
  end: MusicalPosition;
  enabled: boolean;
}

export class MusicalPositionManager extends EventEmitter {
  private timeSignature: TimeSignature;
  private tempo: number;
  private ppq: number;
  private currentPosition: MusicalPosition;
  private loopRegion: LoopRegion;

  constructor(config: PositionConfig = {}) {
    super();

    this.timeSignature = config.timeSignature || {
      numerator: 4,
      denominator: 4,
    };
    this.tempo = config.tempo || 120;
    this.ppq = config.ppq || 960; // Standard MIDI resolution

    this.currentPosition = {
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    };

    this.loopRegion = {
      start: { bars: 0, beats: 0, sixteenths: 0, ticks: 0 },
      end: { bars: 4, beats: 0, sixteenths: 0, ticks: 0 },
      enabled: false,
    };

    logger.info('MusicalPositionManager initialized', {
      timeSignature: this.timeSignature,
      tempo: this.tempo,
      ppq: this.ppq,
    });
  }

  /**
   * Convert seconds to musical position
   */
  secondsToPosition(seconds: number): MusicalPosition {
    // Calculate total sixteenths
    const beatsPerSecond = this.tempo / 60;
    const sixteenthsPerSecond = beatsPerSecond * 4;
    const totalSixteenths = Math.floor(seconds * sixteenthsPerSecond);

    // Calculate musical components
    const sixteenthsPerBar = this.timeSignature.numerator * 4;
    const bars = Math.floor(totalSixteenths / sixteenthsPerBar);
    const remainingSixteenths = totalSixteenths % sixteenthsPerBar;
    const beats = Math.floor(remainingSixteenths / 4);
    const sixteenths = remainingSixteenths % 4;

    // Calculate ticks (sub-sixteenth resolution)
    const ticksPerSixteenth = this.ppq / 4;
    const fractionalSixteenths = (seconds * sixteenthsPerSecond) % 1;
    const ticks = Math.floor(fractionalSixteenths * ticksPerSixteenth);

    return { bars, beats, sixteenths, ticks };
  }

  /**
   * Convert musical position to seconds
   */
  positionToSeconds(position: MusicalPosition): number {
    // Calculate total sixteenths
    const sixteenthsPerBar = this.timeSignature.numerator * 4;
    const totalSixteenths =
      position.bars * sixteenthsPerBar +
      position.beats * 4 +
      position.sixteenths;

    // Add fractional ticks
    const ticksPerSixteenth = this.ppq / 4;
    const fractionalSixteenths = position.ticks / ticksPerSixteenth;

    // Convert to seconds
    const beatsPerSecond = this.tempo / 60;
    const sixteenthsPerSecond = beatsPerSecond * 4;
    const seconds =
      (totalSixteenths + fractionalSixteenths) / sixteenthsPerSecond;

    return seconds;
  }

  /**
   * Convert musical position to Tone.js BarsBeatsSixteenths format
   */
  positionToToneFormat(position: MusicalPosition): string {
    return `${position.bars}:${position.beats}:${position.sixteenths}`;
  }

  /**
   * Parse Tone.js format to musical position
   */
  parseToneFormat(toneFormat: string): MusicalPosition {
    const parts = toneFormat.split(':');
    return {
      bars: parseInt(parts[0]) || 0,
      beats: parseInt(parts[1]) || 0,
      sixteenths: parseInt(parts[2]) || 0,
      ticks: 0,
    };
  }

  /**
   * Update current position
   */
  updatePosition(seconds: number): MusicalPosition {
    let position = this.secondsToPosition(seconds);

    // Apply loop if enabled
    if (this.loopRegion.enabled) {
      position = this.applyLoop(position);
    }

    // Check if position changed significantly
    if (this.hasPositionChanged(position)) {
      const previousPosition = { ...this.currentPosition };
      this.currentPosition = position;

      this.emit('positionChange', {
        previous: previousPosition,
        current: position,
        seconds,
      });
    }

    return position;
  }

  /**
   * Set position directly
   */
  setPosition(position: MusicalPosition): void {
    const previousPosition = { ...this.currentPosition };
    this.currentPosition = { ...position };

    this.emit('positionSet', {
      previous: previousPosition,
      current: this.currentPosition,
    });
  }

  /**
   * Get current position
   */
  getPosition(): MusicalPosition {
    return { ...this.currentPosition };
  }

  /**
   * Set loop region
   */
  setLoop(start: MusicalPosition, end: MusicalPosition, enabled = true): void {
    this.loopRegion = {
      start: { ...start },
      end: { ...end },
      enabled,
    };

    logger.info('Loop region set', {
      start: this.positionToToneFormat(start),
      end: this.positionToToneFormat(end),
      enabled,
    });

    this.emit('loopChange', this.loopRegion);
  }

  /**
   * Enable/disable loop
   */
  setLoopEnabled(enabled: boolean): void {
    this.loopRegion.enabled = enabled;
    this.emit('loopChange', this.loopRegion);
  }

  /**
   * Get loop region
   */
  getLoop(): LoopRegion {
    return {
      start: { ...this.loopRegion.start },
      end: { ...this.loopRegion.end },
      enabled: this.loopRegion.enabled,
    };
  }

  /**
   * Set tempo
   */
  setTempo(bpm: number): void {
    if (bpm <= 0 || bpm > 999) {
      logger.warn('Invalid tempo', { bpm });
      return;
    }

    const previousTempo = this.tempo;
    this.tempo = bpm;

    logger.info('Tempo changed', { previous: previousTempo, current: bpm });
    this.emit('tempoChange', { previous: previousTempo, current: bpm });
  }

  /**
   * Get tempo
   */
  getTempo(): number {
    return this.tempo;
  }

  /**
   * Set time signature
   */
  setTimeSignature(timeSignature: TimeSignature): void {
    const previous = { ...this.timeSignature };
    this.timeSignature = { ...timeSignature };

    logger.info('Time signature changed', {
      previous: `${previous.numerator}/${previous.denominator}`,
      current: `${timeSignature.numerator}/${timeSignature.denominator}`,
    });

    this.emit('timeSignatureChange', { previous, current: this.timeSignature });
  }

  /**
   * Get time signature
   */
  getTimeSignature(): TimeSignature {
    return { ...this.timeSignature };
  }

  /**
   * Get quantum duration in seconds
   */
  getQuantumDuration(quantum: string): number {
    // Parse quantum string (e.g., "4n", "8n", "1m")
    const match = quantum.match(/^(\d+)([nmbt])$/);
    if (!match) {
      logger.warn('Invalid quantum format', { quantum });
      return 0;
    }

    const [, valueStr, unit] = match;
    const value = parseInt(valueStr);

    // Calculate duration based on unit
    const beatDuration = 60 / this.tempo;
    let duration = 0;

    switch (unit) {
      case 'n': // Note (e.g., "4n" = quarter note)
        duration = (4 / value) * beatDuration;
        break;
      case 'm': // Measure
        duration = value * this.timeSignature.numerator * beatDuration;
        break;
      case 'b': // Beat
        duration = value * beatDuration;
        break;
      case 't': // Triplet
        duration = (4 / value) * beatDuration * (2 / 3);
        break;
    }

    return duration;
  }

  /**
   * Apply loop wrapping to position
   */
  private applyLoop(position: MusicalPosition): MusicalPosition {
    const loopStartSeconds = this.positionToSeconds(this.loopRegion.start);
    const loopEndSeconds = this.positionToSeconds(this.loopRegion.end);
    const positionSeconds = this.positionToSeconds(position);

    // Check if position is past loop end
    if (positionSeconds >= loopEndSeconds) {
      const loopLength = loopEndSeconds - loopStartSeconds;
      const wrappedSeconds =
        loopStartSeconds + ((positionSeconds - loopStartSeconds) % loopLength);
      return this.secondsToPosition(wrappedSeconds);
    }

    return position;
  }

  /**
   * Check if position has changed significantly
   */
  private hasPositionChanged(newPosition: MusicalPosition): boolean {
    return (
      newPosition.bars !== this.currentPosition.bars ||
      newPosition.beats !== this.currentPosition.beats ||
      newPosition.sixteenths !== this.currentPosition.sixteenths
    );
  }

  /**
   * Compare two positions
   */
  comparePositions(a: MusicalPosition, b: MusicalPosition): number {
    const aSeconds = this.positionToSeconds(a);
    const bSeconds = this.positionToSeconds(b);
    return aSeconds - bSeconds;
  }

  /**
   * Check if position is within range
   */
  isPositionInRange(
    position: MusicalPosition,
    start: MusicalPosition,
    end: MusicalPosition,
  ): boolean {
    const posSeconds = this.positionToSeconds(position);
    const startSeconds = this.positionToSeconds(start);
    const endSeconds = this.positionToSeconds(end);

    return posSeconds >= startSeconds && posSeconds <= endSeconds;
  }

  /**
   * Add musical time to position
   */
  addMusicalTime(
    position: MusicalPosition,
    toAdd: MusicalPosition,
  ): MusicalPosition {
    // Convert to total sixteenths
    const sixteenthsPerBar = this.timeSignature.numerator * 4;

    const posSixteenths =
      position.bars * sixteenthsPerBar +
      position.beats * 4 +
      position.sixteenths;

    const addSixteenths =
      toAdd.bars * sixteenthsPerBar + toAdd.beats * 4 + toAdd.sixteenths;

    const totalSixteenths = posSixteenths + addSixteenths;

    // Convert back to position
    const bars = Math.floor(totalSixteenths / sixteenthsPerBar);
    const remainingSixteenths = totalSixteenths % sixteenthsPerBar;
    const beats = Math.floor(remainingSixteenths / 4);
    const sixteenths = remainingSixteenths % 4;

    // Handle ticks
    const totalTicks = position.ticks + toAdd.ticks;
    const ticksPerSixteenth = this.ppq / 4;
    const extraSixteenths = Math.floor(totalTicks / ticksPerSixteenth);
    const ticks = totalTicks % ticksPerSixteenth;

    return {
      bars: bars,
      beats: beats,
      sixteenths: sixteenths + extraSixteenths,
      ticks: ticks,
    };
  }

  /**
   * Reset position
   */
  reset(): void {
    this.currentPosition = {
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    };

    this.emit('reset');
  }

  /**
   * Destroy the manager
   */
  destroy(): void {
    this.removeAllListeners();
    logger.info('MusicalPositionManager destroyed');
  }
}
