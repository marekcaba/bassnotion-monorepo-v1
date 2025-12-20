/**
 * SustainPedalHandler - CC64 Sustain Pedal Logic for Harmony Notes
 *
 * Extracted from legacy HarmonyScheduler.ts (lines 833-973)
 * FAANG Compliance: ~380 lines < 600 line limit
 *
 * Responsibilities:
 * - Analyze CC64 pedal timeline for note sustain
 * - Enable sample looping for sustained notes
 * - Calculate actual note duration (MIDI + pedal extension)
 * - Handle syncopated pedaling (pedal DOWN after note starts)
 * - Handle legato pedaling (pedal UP while note held)
 * - Support last-note ring-out with exercise end capping
 *
 * Key Features:
 * - Real piano pedal behavior (can EXTEND but not TRUNCATE held notes)
 * - Sample looping for long sustained notes (loop last 20% of buffer)
 * - Exercise end capping for last beat notes (prevent 8+ second ring)
 * - Syncopated pedaling detection (pedal DOWN during note)
 * - Legato pedaling support (overlapping chords with brief pedal release)
 *
 * Usage:
 * ```typescript
 * const handler = new SustainPedalHandler();
 * handler.setCC64Timeline(timeline);
 * handler.setExerciseTiming(exerciseEndTime, lastBeatThreshold);
 *
 * const result = handler.analyzeSustain(audioTime, duration, noteName, buffer);
 * if (result.shouldEnableLooping) {
 *   source.loop = true;
 *   source.loopStart = result.loopStart;
 *   source.loopEnd = result.loopEnd;
 * }
 * const actualDuration = result.sustainedDuration;
 * ```
 */

import { createStructuredLogger } from '../../../modules/shared/index.js';

const logger = createStructuredLogger('SustainPedalHandler');

/**
 * Result of sustain analysis for a single note
 */
export interface SustainAnalysisResult {
  /** Whether to enable sample looping (for long sustained notes) */
  shouldEnableLooping: boolean;

  /** Loop start time in seconds (relative to buffer start) */
  loopStart: number;

  /** Loop end time in seconds (relative to buffer start) */
  loopEnd: number;

  /** Actual note duration including CC64 sustain extension (seconds) */
  sustainedDuration: number;

  /** Whether pedal extended this note beyond MIDI note-off */
  wasPedalExtended: boolean;

  /** Debug info for logging */
  debugInfo: {
    pedalDownTime: number | null;
    pedalUpTime: number | null;
    midiDuration: number;
    sustainExtension: number;
    reason: string;
  };
}

/**
 * SustainPedalHandler - Handles CC64 sustain pedal logic for harmony notes
 *
 * Implements real piano pedal behavior:
 * - Pedal can EXTEND notes beyond MIDI note-off (traditional sustain)
 * - Pedal CANNOT TRUNCATE notes still being held (legato pedaling)
 * - Supports syncopated pedaling (pedal DOWN after note starts)
 * - Enables sample looping for sustained notes longer than buffer
 */
export class SustainPedalHandler {
  private cc64Timeline: Map<number, boolean> = new Map();
  private exerciseEndTime = 0;
  private lastBeatThreshold = 0;

  // 🎯 PERFORMANCE FIX: Cache sorted timeline keys to avoid repeated Array.from().sort()
  // This dramatically improves performance for chords (5+ notes scheduled at same time)
  // Without caching: ~25ms delay for 5-note chords (5 notes × 2 sorts × ~2.5ms each)
  // With caching: <1ms for entire chord (single sort on timeline set, O(1) access)
  private sortedTimelineKeys: number[] = [];

  /**
   * Set the CC64 timeline for sustain analysis
   *
   * Timeline maps audioTime → pedal state (true = DOWN, false = UP)
   * Built by SustainPedalManager.buildTimeline()
   */
  public setCC64Timeline(timeline: Map<number, boolean>): void {
    this.cc64Timeline = timeline;

    // 🎯 PERFORMANCE FIX: Pre-sort timeline keys once (not per-note)
    this.sortedTimelineKeys = Array.from(timeline.keys()).sort((a, b) => a - b);

    // Only log summary, not every event (reduces console spam)
    logger.info('CC64 timeline set', {
      eventCount: timeline.size,
      firstEvent: this.sortedTimelineKeys[0]?.toFixed(3) || 'none',
      lastEvent: this.sortedTimelineKeys[this.sortedTimelineKeys.length - 1]?.toFixed(3) || 'none',
    });
  }

  /**
   * Set exercise timing boundaries for last-note capping
   *
   * @param endTime - Exercise end time in seconds
   * @param lastBeatThreshold - Time when last beat starts (for ring-out detection)
   */
  public setExerciseTiming(endTime: number, lastBeatThreshold: number): void {
    this.exerciseEndTime = endTime;
    this.lastBeatThreshold = lastBeatThreshold;
    logger.info('Exercise timing set', {
      endTime,
      lastBeatThreshold,
    });
  }

  /**
   * Analyze sustain for a single note
   *
   * Determines:
   * 1. Whether to enable sample looping
   * 2. Actual note duration (MIDI + pedal extension)
   * 3. Debug info for logging
   *
   * @param audioTime - Note start time (Web Audio time)
   * @param midiDuration - Original MIDI note duration (seconds)
   * @param noteName - Note name (for logging, e.g., 'C4')
   * @param buffer - AudioBuffer for the note (to check duration)
   * @returns SustainAnalysisResult with looping and duration info
   */
  public analyzeSustain(
    audioTime: number,
    midiDuration: number,
    noteName: string,
    buffer: AudioBuffer,
  ): SustainAnalysisResult {
    // 🎯 PERFORMANCE FIX: Removed expensive console.log calls
    // Console logging is synchronous and can add 2-5ms per call
    // For a 5-note chord, that's 10-25ms of unnecessary delay

    // Initialize result with defaults (no sustain)
    const result: SustainAnalysisResult = {
      shouldEnableLooping: false,
      loopStart: 0,
      loopEnd: 0,
      sustainedDuration: midiDuration,
      wasPedalExtended: false,
      debugInfo: {
        pedalDownTime: null,
        pedalUpTime: null,
        midiDuration,
        sustainExtension: 0,
        reason: 'no-timeline',
      },
    };

    // No CC64 timeline - return MIDI duration
    if (this.sortedTimelineKeys.length === 0) {
      return result;
    }

    // Debug logging removed for performance - called for every note

    // STEP 1: Check if pedal affects this note
    const midiNoteEndTime = audioTime + midiDuration;
    const pedalDownTime = this.findCC64DownDuringNote(
      audioTime,
      midiNoteEndTime,
    );

    if (pedalDownTime === null) {
      // Pedal never affects this note - use MIDI duration
      result.debugInfo.reason = 'pedal-never-down';
      return result;
    }

    // STEP 2: Find when pedal goes UP
    const pedalUpTime = this.findNextCC64Up(pedalDownTime);

    result.debugInfo.pedalDownTime = pedalDownTime;
    result.debugInfo.pedalUpTime = pedalUpTime;

    // STEP 3: Calculate sustained duration
    if (pedalUpTime !== null) {
      // Pedal goes UP at some point
      const sustainDuration = pedalUpTime - audioTime;

      // Safety check: ensure pedal UP is in the future
      if (sustainDuration <= 0) {
        result.debugInfo.reason = 'pedal-up-in-past';
        logger.warn('Pedal UP in past, using MIDI duration', {
          noteName,
          audioTime: audioTime.toFixed(3),
          pedalUpTime: pedalUpTime.toFixed(3),
        });
        return result;
      }

      // CRITICAL: Pedal can only EXTEND notes, never TRUNCATE notes still being held
      if (pedalUpTime > midiNoteEndTime) {
        // Pedal extends the note beyond MIDI note-off
        result.sustainedDuration = sustainDuration;
        result.wasPedalExtended = true;
        result.debugInfo.sustainExtension = sustainDuration - midiDuration;

        if (pedalDownTime > audioTime) {
          result.debugInfo.reason = 'syncopated-pedaling';
        } else {
          result.debugInfo.reason = 'pedal-extends';
        }
        // Debug logging removed for performance
      } else {
        // Pedal UP happens while note is still held - ignore pedal, use MIDI duration
        // This is legato pedaling: play new chord, then release pedal
        result.sustainedDuration = midiDuration;
        result.debugInfo.reason = 'legato-pedaling';
        // Debug logging removed for performance
      }
    } else {
      // No pedal UP found - calculate duration based on exercise timing
      const noteStartsInLastBeat = audioTime >= this.lastBeatThreshold;

      if (noteStartsInLastBeat && this.exerciseEndTime > 0) {
        // Cap at exercise end + 3s to prevent 8+ second samples ringing forever
        const maxEndTime = this.exerciseEndTime + 3.0;
        const cappedDuration = maxEndTime - audioTime;
        result.sustainedDuration = Math.max(
          midiDuration,
          Math.min(cappedDuration, buffer.duration),
        );
        result.wasPedalExtended = result.sustainedDuration > midiDuration;
        result.debugInfo.sustainExtension =
          result.sustainedDuration - midiDuration;
        result.debugInfo.reason = 'capped-at-exercise-end';
        // Debug logging removed for performance
      } else {
        // Use full buffer duration for notes not in last beat
        result.sustainedDuration = Math.max(midiDuration, buffer.duration);
        result.wasPedalExtended = result.sustainedDuration > midiDuration;
        result.debugInfo.sustainExtension =
          result.sustainedDuration - midiDuration;
        result.debugInfo.reason = 'no-pedal-up-using-buffer';
        // Debug logging removed for performance
      }
    }

    // STEP 4: Determine if looping should be enabled
    // Enable looping if sustained duration exceeds buffer duration
    if (result.sustainedDuration > buffer.duration) {
      result.shouldEnableLooping = true;
      // Loop the last 20% of the sample for natural sustain
      result.loopStart = buffer.duration * 0.8;
      result.loopEnd = buffer.duration;

      logger.info('Sample looping enabled for sustained note', {
        noteName,
        loopStart: result.loopStart.toFixed(3),
        loopEnd: result.loopEnd.toFixed(3),
        sustainedDuration: result.sustainedDuration.toFixed(3),
      });
    }

    return result;
  }

  /**
   * Check if CC64 pedal is DOWN when note starts OR goes DOWN during note's MIDI duration
   * This is critical for syncopated pedaling where pedal goes DOWN after note starts
   *
   * Returns the time when pedal went/goes DOWN, or null if pedal stays UP
   *
   * @private
   */
  private findCC64DownDuringNote(
    noteStart: number,
    noteEnd: number,
  ): number | null {
    // 🎯 PERFORMANCE FIX: Use pre-sorted cached array instead of re-sorting per call
    const sortedTimes = this.sortedTimelineKeys;

    // 🚨 CRITICAL FIX: Handle complex pedaling with multiple DOWN/UP cycles
    // For overlapping chords with legato pedaling:
    // - Old chord plays with pedal DOWN
    // - Pedal goes UP briefly to separate chords
    // - New chord starts BEFORE pedal goes back DOWN
    // - Pedal goes DOWN again to sustain new chord
    //
    // Strategy: Always use the LATEST pedal DOWN that affects this note
    // This ensures we find the pedal UP that actually releases THIS chord

    let latestPedalDown: number | null = null;

    // Check if pedal is already DOWN before note starts
    const isPedalDownAtStart = this.isPedalDownAtTime(noteStart);
    if (isPedalDownAtStart) {
      latestPedalDown = noteStart; // Pedal already DOWN when note starts
    }

    // Check if pedal goes DOWN during the note's MIDI duration
    // This overrides the pedal-down-at-start if found
    for (const eventTime of sortedTimes) {
      if (eventTime > noteStart && eventTime < noteEnd) {
        if (this.cc64Timeline.get(eventTime) === true) {
          latestPedalDown = eventTime; // Use this pedal DOWN (overrides earlier one)
        }
      }
      // Early exit optimization: stop searching if past noteEnd
      if (eventTime >= noteEnd) break;
    }

    return latestPedalDown;
  }

  /**
   * Find the next CC64 UP event after a given time
   * Returns the audioTime of the next pedal UP, or null if none found
   *
   * @private
   */
  private findNextCC64Up(startTime: number): number | null {
    // 🎯 PERFORMANCE FIX: Use pre-sorted cached array instead of re-sorting per call
    const sortedTimes = this.sortedTimelineKeys;

    for (const time of sortedTimes) {
      if (time > startTime && this.cc64Timeline.get(time) === false) {
        return time; // Found next pedal UP
      }
    }

    return null; // No pedal UP found
  }

  /**
   * Check if sustain pedal is down at a specific time
   * Returns the most recent pedal state before or at the given time
   *
   * @private
   */
  private isPedalDownAtTime(time: number): boolean {
    // 🎯 PERFORMANCE FIX: Use pre-sorted cached array instead of re-sorting per call
    const sortedTimes = this.sortedTimelineKeys;

    let lastPedalState = false; // Default to UP

    for (const eventTime of sortedTimes) {
      if (eventTime > time) break;
      lastPedalState = this.cc64Timeline.get(eventTime) ?? false;
    }

    return lastPedalState;
  }

  /**
   * Clear timeline (for cleanup)
   */
  public clear(): void {
    this.cc64Timeline.clear();
    this.sortedTimelineKeys = []; // Also clear the cached sorted keys
    this.exerciseEndTime = 0;
    this.lastBeatThreshold = 0;
    logger.info('SustainPedalHandler cleared');
  }

  /**
   * Get current timeline size (for debugging)
   */
  public getTimelineSize(): number {
    return this.cc64Timeline.size;
  }
}
