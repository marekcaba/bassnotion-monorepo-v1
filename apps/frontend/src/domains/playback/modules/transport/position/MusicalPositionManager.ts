/**
 * MusicalPositionManager - Handles musical time representation and countdown display
 *
 * ## Responsibilities
 * - Converts between musical time (bars:beats:sixteenths) and seconds
 * - Manages loop points and tracks position state
 * - **SINGLE SOURCE OF TRUTH** for countdown display logic
 *
 * ## Countdown Architecture
 *
 * This class is the **ONLY** place where countdown offset is applied for display purposes.
 * The separation of concerns is:
 *
 * ```
 * ┌─────────────────────────────────────────────────────────────┐
 * │ MusicalPositionManager (THIS CLASS)                         │
 * │ - Stores countdownBeats (e.g., 4 beats = 1 measure)        │
 * │ - getDisplayPosition() applies offset for UI display        │
 * │ - Raw position 0:0:0 → Display -1:4:0 (countdown visible)   │
 * │ - Raw position 1:0:0 → Display 1:1:0 (exercise starts)      │
 * │ ✅ SINGLE SOURCE OF TRUTH for display logic                 │
 * └─────────────────────────────────────────────────────────────┘
 *                              ▲
 *                              │ gets countdown duration
 *                              │
 * ┌─────────────────────────────────────────────────────────────┐
 * │ TransportController (COORDINATOR)                           │
 * │ - Reads countdownBeats from MusicalPositionManager          │
 * │ - Converts beats to seconds: (beats / BPM) * 60            │
 * │ - Calls Transport.setCountdownOffset(seconds)               │
 * │ ✅ COORDINATION LAYER - no display logic                    │
 * └─────────────────────────────────────────────────────────────┘
 *                              │
 *                              ▼ sets offset in seconds
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Transport (TIMING)                                           │
 * │ - Stores countdownOffsetSeconds (for elapsed time tracking) │
 * │ - Used to calculate: elapsedTime = currentTime - startTime  │
 * │ - Ensures position updates start from 0s (not 32ms)         │
 * │ ✅ TIMING REFERENCE - no display logic                      │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * ## Key Insight: NOT Duplicate Logic
 *
 * Although countdown appears in multiple files, each has a DISTINCT responsibility:
 * - **MusicalPositionManager**: Display transformation (raw → display position)
 * - **TransportController**: Coordination (beats → seconds conversion)
 * - **Transport**: Timing reference (elapsed time calculation)
 *
 * This is proper separation of concerns, NOT code duplication.
 *
 * ## Musical Time Format
 * - bars: 1-based bar number in display (0-based internal)
 * - beats: 1-based beat within bar (1 to timeSignature)
 * - sixteenths: 0-based sixteenth within beat (0-3)
 *
 * @example
 * ```typescript
 * const manager = new MusicalPositionManager();
 * manager.setCountdownBeats(4); // One measure of 4/4 time
 *
 * // During countdown:
 * manager.updatePosition(0); // seconds = 0
 * manager.getDisplayPosition(); // Returns: { bars: -1, beats: 4, sixteenths: 0 }
 *
 * // After countdown (at exercise start):
 * manager.updatePosition(2); // seconds = 2 (after 4-beat countdown @ 120 BPM)
 * manager.getDisplayPosition(); // Returns: { bars: 1, beats: 1, sixteenths: 0 }
 * ```
 */

import { EventEmitter } from '../shared/EventEmitter.js';
import { createStructuredLogger } from '../../shared/index.js';
import type { MusicalPosition, TimeSignature } from '../../types/index.js';

// Helper to get Tone from window (must be initialized before MusicalPositionManager is used)
function getTone(): any {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'MusicalPositionManager: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

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

  // COUNTDOWN OFFSET: Track countdown duration for display adjustment
  // When countdownBeats > 0, the first N beats are pre-roll (measure -1 or 0)
  private countdownBeats = 0; // Number of beats in countdown (e.g., 4 for one measure of 4/4)

  // MONOTONICITY GUARD: Prevent backwards position jumps from race conditions
  // When multiple update sources (Transport.onPositionUpdate + Clock.onTick) emit
  // position updates, they can arrive out-of-order causing UI jitter
  private lastUpdateSeconds = 0;

  constructor(config: PositionConfig = {}) {
    super();

    this.timeSignature = config.timeSignature || {
      numerator: 4,
      denominator: 4,
    };
    this.tempo = config.tempo || 120;
    this.ppq = config.ppq || 480; // Standard MIDI resolution (480 PPQ)

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
   * FAANG FIX: Use Tone.Transport.bpm.value as single source of truth
   */
  secondsToPosition(seconds: number): MusicalPosition {
    // FAANG FIX: Always use current Tone.Transport BPM (single source of truth)
    const Tone = getTone();
    const currentBpm = Tone.getTransport().bpm.value;
    const beatsPerSecond = currentBpm / 60;
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
   * FAANG FIX: Use Tone.Transport.bpm.value as single source of truth
   * this.tempo can become stale when tempo changes via transport
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

    // FAANG FIX: Always use current Tone.Transport BPM (single source of truth)
    // this.tempo might be stale if tempo changed via transport without calling setTempo()
    const Tone = getTone();
    const currentBpm = Tone.getTransport().bpm.value;
    const beatsPerSecond = currentBpm / 60;
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
    // MONOTONICITY GUARD: Ignore backwards time jumps from race conditions
    // Multiple position update sources (Transport.onPositionUpdate + Clock.onTick)
    // can emit out-of-order updates causing UI jitter in sheet music scroll
    if (seconds < this.lastUpdateSeconds) {
      // Small threshold (50ms) to allow for minor timing jitter
      const delta = this.lastUpdateSeconds - seconds;
      // DEBUG: Log all backwards jumps to understand the pattern
      console.log('[POSITION DEBUG] ⚠️ Backwards time detected', {
        incoming: seconds.toFixed(3),
        previous: this.lastUpdateSeconds.toFixed(3),
        delta: delta.toFixed(3),
        willIgnore: delta < 0.05,
        currentPosition: `${this.currentPosition.bars}:${this.currentPosition.beats}:${this.currentPosition.sixteenths}`,
      });
      if (delta < 0.05) {
        // Minor jitter - ignore and return cached position
        console.log(
          '[POSITION DEBUG] Ignoring minor jitter (<50ms), returning cached position',
        );
        return this.currentPosition;
      }
      // Significant backwards jump - likely a seek or restart, allow it
      console.log(
        '[POSITION DEBUG] Allowing significant backwards jump (>50ms) - probable seek/restart',
      );
    }
    this.lastUpdateSeconds = seconds;

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
   * Get current position (raw, without countdown adjustment)
   */
  getPosition(): MusicalPosition {
    return { ...this.currentPosition };
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

    // 🔧 REMOVED EARLY RETURN: Always use unified countdown logic below
    // Previous early return when countdownBeats === 0 caused race condition:
    // - Position updates could fire before countdown offset was set
    // - Would return 1-based position (1:1:0) instead of applying countdown offset
    // - Countdown would never display because code never reached countdown logic
    // Now: Always proceed to unified logic that handles both countdown and normal positions

    // Convert position to total beats
    const beatsPerBar = this.timeSignature.numerator;
    const totalBeats = pos.bars * beatsPerBar + pos.beats + pos.sixteenths / 4;

    // Subtract countdown offset (0 if no countdown set)
    const adjustedBeats = totalBeats - this.countdownBeats;

    // Convert back to bars:beats:sixteenths
    // Handle negative beats properly for countdown display
    let adjustedBars: number;
    let adjustedBeatsInt: number;
    let adjustedSixteenths: number;

    if (adjustedBeats < 0) {
      // During countdown: We want beats to COUNT DOWN from 4 to 1 (in 4/4 time)
      // Desired timeline:
      // adjustedBeats = -4.0 → display -1:4:00 (beat 3, sixteenths 0)
      // adjustedBeats = -3.75 → display -1:4:01 (beat 3, sixteenths 1)
      // adjustedBeats = -3.0 → display -1:3:00 (beat 2, sixteenths 0)
      // adjustedBeats = -2.0 → display -1:2:00 (beat 1, sixteenths 0)
      // adjustedBeats = -1.0 → display -1:1:00 (beat 0, sixteenths 0)
      // adjustedBeats = -0.25 → display -1:1:03 (beat 0, sixteenths 3)
      // adjustedBeats = 0.0 → display 1:1:00 (beat 0, sixteenths 0)

      // So the mapping is: adjustedBeats + countdownBeats gives us the beat position
      // -4 + 4 = 0 (but we started at beat 3, so we need to reverse within the bar)

      // Calculate bar: keep it as -1 for the ENTIRE countdown period
      // Even when adjustedBeats = -0.1, we want to stay at bar -1
      // Only when adjustedBeats >= 0 do we switch to bar 0 (which displays as bar 1)
      adjustedBars = -1;

      // 🔧 OFF-BY-ONE FIX: Calculate position for countdown (beats count DOWN from 4 to 1)
      // Timeline mapping for 1-BASED display (UI expects beats 1,2,3,4):
      // absBeats 4.0-3.01 → beat 4 (1-based: displays as 4)
      // absBeats 3.0-2.01 → beat 3 (1-based: displays as 3)
      // absBeats 2.0-1.01 → beat 2 (1-based: displays as 2)
      // absBeats 1.0-0.01 → beat 1 (1-based: displays as 1)
      const absBeats = Math.abs(adjustedBeats);

      // Determine which beat we're in by using ceil
      // For 1-based display, we DON'T subtract 1:
      // absBeats=4.0: ceil=4, beat should be 4 (not 3) ✅
      // absBeats=3.9: ceil=4, beat should be 4 ✅
      // absBeats=3.0: ceil=3, beat should be 3 (not 2) ✅
      // absBeats=1.1: ceil=2, beat should be 2 (not 1) ✅
      // absBeats=0.5: ceil=1, beat should be 1 (not 0) ✅
      adjustedBeatsInt = Math.ceil(absBeats); // 1-based beats!

      // Sixteenths within the beat
      const fractionalPart = absBeats - Math.floor(absBeats);
      adjustedSixteenths = Math.floor(fractionalPart * 4);
    } else {
      // 🔧 OFF-BY-ONE FIX: Normal (non-countdown) position - 1-based display
      // adjustedBeats=0.0: bars=1, beats=1 (was 0:0, now 1:1) ✅
      // adjustedBeats=1.0: bars=1, beats=2 (was 0:1, now 1:2) ✅
      // adjustedBeats=4.0: bars=2, beats=1 (was 1:0, now 2:1) ✅
      adjustedBars = Math.floor(adjustedBeats / beatsPerBar) + 1; // +1 for 1-based bars
      const beatsInBar = adjustedBeats % beatsPerBar;
      adjustedBeatsInt = Math.floor(beatsInBar) + 1; // +1 for 1-based beats
      const fractionalBeat = beatsInBar % 1;
      adjustedSixteenths = Math.floor(fractionalBeat * 4);
    }

    const displayPos = {
      bars: adjustedBars,
      beats: adjustedBeatsInt,
      sixteenths: adjustedSixteenths,
      ticks: Math.floor(adjustedSixteenths * 240), // 240 ticks per sixteenth
    };

    // Log occasionally (every 10th call)
    if (Math.random() < 0.1) {
      logger.info('🎵 getDisplayPosition', {
        rawPos: pos,
        totalBeats,
        countdownBeats: this.countdownBeats,
        adjustedBeats,
        displayPos,
      });
    }

    return displayPos;
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
   * FAANG FIX: When countdown is enabled, reset to exercise start (after countdown)
   * instead of absolute zero, so the clock shows 1:0:00 instead of -1:4:00
   * This is used when STOPPING playback.
   */
  reset(): void {
    if (this.countdownBeats > 0) {
      // ✅ DOUBLE COUNTDOWN FIX: Properly calculate bars and beats from countdown offset
      // BEFORE: beats: countdownBeats (e.g., 4) - WRONG! beats should be 0-3 in 4/4
      // AFTER: Use proper modulo to wrap beats correctly
      const beatsPerBar = this.timeSignature.numerator;
      const bars = Math.floor(this.countdownBeats / beatsPerBar);
      const beats = this.countdownBeats % beatsPerBar;

      // Reset to exercise start position (after countdown)
      // e.g., for 4/4 time with 4-beat countdown: bars=1, beats=0 (displays as 1:1:0)
      this.currentPosition = {
        bars: bars,
        beats: beats,
        sixteenths: 0,
        ticks: 0,
      };
      logger.info('Reset to exercise start position (stop)', {
        countdownBeats: this.countdownBeats,
        calculatedBars: bars,
        calculatedBeats: beats,
        position: this.currentPosition,
      });
    } else {
      // No countdown - reset to absolute zero
      this.currentPosition = {
        bars: 0,
        beats: 0,
        sixteenths: 0,
        ticks: 0,
      };
    }

    // Reset monotonicity guard on stop
    this.lastUpdateSeconds = 0;

    this.emit('reset');
  }

  /**
   * Reset to timeline start (countdown start or absolute zero)
   * This is used when STARTING playback to ensure we start from the beginning.
   */
  resetToStart(): void {
    // Reset monotonicity guard on start
    this.lastUpdateSeconds = 0;

    // Always reset to absolute zero (countdown start or timeline start if no countdown)
    this.currentPosition = {
      bars: 0,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    };
    logger.info('Reset to timeline start (play)', {
      countdownBeats: this.countdownBeats,
      position: this.currentPosition,
    });

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
