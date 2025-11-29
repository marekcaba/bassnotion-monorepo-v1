/**
 * FadeoutManager - Musical fadeout logic for harmony notes
 *
 * Extracted from legacy HarmonyScheduler.ts (lines 1081-1140)
 * FAANG Compliance: ~150 lines < 600 line limit
 *
 * Responsibilities:
 * - Normal note fadeouts (30ms exponential fade)
 * - Last note fadeouts (3-stage: hold → quick drop → smooth fade)
 * - Gain automation timeline management
 * - Musical fadeout curves (mimics piano damper behavior)
 *
 * Fadeout Types:
 * 1. **Normal Note** (non-last notes):
 *    - Hold gain until note end
 *    - 30ms exponential fade to silence (mimics piano damper)
 *    - Total: MIDI duration + 30ms
 *
 * 2. **Last Note** (final chord ring-out):
 *    - 1s hold at full volume (let chord breathe)
 *    - 1s quick linear drop to 50% (initial decay)
 *    - 2s smooth exponential fade to silence (natural ring-out)
 *    - Total: note duration + 4s (1s hold + 3s fade)
 *
 * Usage:
 * ```typescript
 * const fadeout = FadeoutManager.scheduleFadeout(
 *   gain,
 *   targetGain,
 *   noteEndTime,
 *   isLastNote
 * );
 * source.stop(fadeout.stopTime);
 * ```
 */

import { createStructuredLogger } from '../../../modules/shared/index.js';

const logger = createStructuredLogger('FadeoutManager');

/**
 * Fadeout schedule result
 */
export interface FadeoutSchedule {
  /** Time when source.stop() should be called */
  stopTime: number;

  /** Fadeout duration in seconds */
  duration: number;

  /** Fadeout type applied */
  type: 'normal' | 'last-note';

  /** Debug info for logging */
  debugInfo: {
    fadeStartTime: number;
    fadeEndTime: number;
    stages?: string[]; // For last-note fadeout
  };
}

/**
 * FadeoutManager - Handles musical fadeout automation for harmony notes
 *
 * Uses Web Audio API gain automation timeline for sample-accurate fadeouts
 */
export class FadeoutManager {
  /**
   * Schedule fadeout for a harmony note
   *
   * @param gainNode - GainNode to automate
   * @param targetGain - Target gain value (before fade)
   * @param noteEndTime - Time when note should end (from MIDI or CC64)
   * @param isLastNote - Whether this is the last note of the exercise
   * @returns Fadeout schedule with stop time and debug info
   */
  public static scheduleFadeout(
    gainNode: GainNode,
    targetGain: number,
    noteEndTime: number,
    isLastNote: boolean,
  ): FadeoutSchedule {
    if (isLastNote) {
      return this.scheduleLastNoteFadeout(gainNode, targetGain, noteEndTime);
    } else {
      return this.scheduleNormalFadeout(gainNode, targetGain, noteEndTime);
    }
  }

  /**
   * Schedule normal note fadeout (30ms exponential)
   *
   * Mimics piano damper behavior:
   * - Hold gain constant until note end
   * - Quick exponential fade to silence (30ms)
   *
   * @private
   */
  private static scheduleNormalFadeout(
    gainNode: GainNode,
    targetGain: number,
    noteEndTime: number,
  ): FadeoutSchedule {
    const FADEOUT_DURATION = 0.03; // 30ms exponential fade
    const fadeStartTime = noteEndTime;
    const fadeEndTime = noteEndTime + FADEOUT_DURATION;

    // Point 1: Hold gain constant until note end
    gainNode.gain.linearRampToValueAtTime(targetGain, fadeStartTime);

    // Point 2: Exponential fade to silence over 30ms
    gainNode.gain.exponentialRampToValueAtTime(0.001, fadeEndTime);

    const stopTime = fadeEndTime + 0.01; // Small buffer after fade completes

    logger.debug('Scheduled normal fadeout', {
      fadeStartTime,
      fadeEndTime,
      duration: FADEOUT_DURATION,
      stopTime,
    });

    return {
      stopTime,
      duration: FADEOUT_DURATION,
      type: 'normal',
      debugInfo: {
        fadeStartTime,
        fadeEndTime,
      },
    };
  }

  /**
   * Schedule last note fadeout (3-stage: hold → quick drop → smooth fade)
   *
   * Musical ring-out for final chord:
   * - Stage 1 (0-1s): Hold at full volume (let chord breathe)
   * - Stage 2 (1-2s): Quick linear drop to 50% (initial decay)
   * - Stage 3 (2-4s): Smooth exponential fade to silence (natural ring-out)
   *
   * @private
   */
  private static scheduleLastNoteFadeout(
    gainNode: GainNode,
    targetGain: number,
    noteEndTime: number,
  ): FadeoutSchedule {
    // Calculate key time points for 3-stage fade
    const ringOutStart = noteEndTime - 3.0; // Start of 3-second ring-out extension
    const fadeStartTime = ringOutStart + 1.0; // Stage 2 starts: 1s into ring-out
    const midFadeTime = fadeStartTime + 1.0; // Stage 3 starts: 2s into ring-out
    const fadeEndTime = noteEndTime; // End of fade: 4s after MIDI note-off

    // Stage 1: Hold gain constant for 1 second (let chord breathe)
    gainNode.gain.linearRampToValueAtTime(targetGain, fadeStartTime);

    // Stage 2: Quick linear drop to 50% over 1 second (initial decay)
    gainNode.gain.linearRampToValueAtTime(targetGain * 0.5, midFadeTime);

    // Stage 3: Smooth exponential fade to silence over final 2 seconds
    gainNode.gain.exponentialRampToValueAtTime(0.001, fadeEndTime);

    const stopTime = fadeEndTime + 0.01; // Small buffer after fade completes

    logger.info('Scheduled last-note fadeout', {
      ringOutStart,
      fadeStartTime,
      midFadeTime,
      fadeEndTime,
      stages: [
        `Stage 1 (hold): ${ringOutStart.toFixed(3)}s → ${fadeStartTime.toFixed(3)}s (1s @ 100%)`,
        `Stage 2 (quick drop): ${fadeStartTime.toFixed(3)}s → ${midFadeTime.toFixed(3)}s (1s to 50%)`,
        `Stage 3 (smooth fade): ${midFadeTime.toFixed(3)}s → ${fadeEndTime.toFixed(3)}s (2s to silence)`,
      ],
      stopTime,
    });

    return {
      stopTime,
      duration: 4.0, // 1s hold + 1s quick drop + 2s smooth fade
      type: 'last-note',
      debugInfo: {
        fadeStartTime,
        fadeEndTime,
        stages: ['hold', 'quick-drop', 'smooth-fade'],
      },
    };
  }

  /**
   * Calculate if a note is the last note of an exercise
   *
   * Helper method for determining fadeout type
   *
   * @param noteEndTime - MIDI note-off time (before CC64 extension)
   * @param exerciseEndTime - Exercise end time
   * @param threshold - Threshold in seconds (default: 0.25s)
   * @returns true if note is held until exercise end
   */
  public static isLastNote(
    noteEndTime: number,
    exerciseEndTime: number,
    threshold = 0.25,
  ): boolean {
    if (exerciseEndTime === 0) {
      return false; // Exercise end time not set
    }

    const timeDifference = exerciseEndTime - noteEndTime;
    const isLast = timeDifference >= 0 && timeDifference <= threshold;

    logger.debug('Last note check', {
      noteEndTime,
      exerciseEndTime,
      timeDifference,
      threshold,
      isLast,
    });

    return isLast;
  }
}
