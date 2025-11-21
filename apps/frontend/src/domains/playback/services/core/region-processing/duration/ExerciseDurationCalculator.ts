/**
 * ExerciseDurationCalculator - Exercise duration and last beat calculation
 *
 * Calculates:
 * - Total exercise duration across all tracks/regions
 * - Last beat threshold for ring-out detection
 * - Countdown offset integration
 */

import * as Tone from 'tone';

export interface Track {
  regions: Array<{
    startTime: number;
    duration: number; // In beats
  }>;
}

export class ExerciseDurationCalculator {
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Calculate total exercise duration and identify the last beat
   * Used to detect which notes should have extended ring-out
   *
   * @returns Object with exerciseEndTime and lastBeatThreshold (both in seconds)
   */
  calculateDuration(
    tracks: Track[],
    countdownEnabled: boolean,
    countdownOffsetBeats: number,
  ): { exerciseEndTime: number; lastBeatThreshold: number } {
    const currentBpm = Tone.Transport.bpm.value;
    const secondsPerBeat = 60 / currentBpm;
    let maxEndTime = 0;

    // Find the latest end time across all regions
    tracks.forEach((track) => {
      track.regions.forEach((region) => {
        const regionDurationInSeconds = region.duration * secondsPerBeat;
        const regionEndTime = region.startTime + regionDurationInSeconds;
        maxEndTime = Math.max(maxEndTime, regionEndTime);
      });
    });

    // CRITICAL: Add countdown offset to exercise end time (audio time includes offset)
    const countdownOffsetSeconds = countdownEnabled
      ? countdownOffsetBeats * secondsPerBeat
      : 0;

    const exerciseEndTime = maxEndTime + countdownOffsetSeconds;

    // Define "last beat" as the final 1 beat before exercise end (time-signature aware)
    const lastBeatDuration = secondsPerBeat; // 1 beat
    const lastBeatThreshold = Math.max(0, exerciseEndTime - lastBeatDuration);

    // eslint-disable-next-line no-console
    console.log(
      `[EXERCISE DURATION] Transport: ${maxEndTime.toFixed(3)}s, Countdown offset: ${countdownOffsetSeconds.toFixed(3)}s, Total (audio time): ${exerciseEndTime.toFixed(3)}s, Last beat starts: ${lastBeatThreshold.toFixed(3)}s (1 beat = ${lastBeatDuration.toFixed(3)}s @ ${currentBpm} BPM)`,
    );

    return { exerciseEndTime, lastBeatThreshold };
  }
}
