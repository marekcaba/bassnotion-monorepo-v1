/**
 * CountdownManager - Manages countdown pre-roll functionality
 *
 * Handles countdown configuration and region generation:
 * - Enables/disables countdown with time signature
 * - Calculates countdown offset (one measure)
 * - Generates metronome countdown regions (accent + clicks)
 * - Generates voice cue countdown regions ("one", "two", "three", "four")
 * - Injects countdown regions at beginning of tracks
 */

import { getLogger } from '@/utils/logger.js';
import type { Region, PatternEvent } from '../types/region.types.js';

const logger = getLogger('CountdownManager');

export class CountdownManager {
  private countdownEnabled = true;
  private countdownOffsetBeats = 0;
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Enable countdown pre-roll with time signature
   * All events will be offset by one measure (numerator beats)
   */
  enableCountdown(timeSignature: {
    numerator: number;
    denominator: number;
  }): void {
    this.countdownEnabled = true;
    this.countdownOffsetBeats = timeSignature.numerator;
    logger.info('🎵 Countdown enabled', {
      timeSignature,
      offsetBeats: this.countdownOffsetBeats,
      offsetMeasures: 1,
      instanceId: this.instanceId,
    });
  }

  /**
   * Disable countdown pre-roll (all events start at beat 0)
   */
  disableCountdown(): void {
    this.countdownEnabled = false;
    this.countdownOffsetBeats = 0;
    logger.info('🎵 Countdown disabled', {
      instanceId: this.instanceId,
    });
  }

  /**
   * Get current countdown offset in beats
   */
  getCountdownOffsetBeats(): number {
    return this.countdownOffsetBeats;
  }

  /**
   * Check if countdown is enabled
   */
  isCountdownEnabled(): boolean {
    return this.countdownEnabled;
  }

  /**
   * Add countdown click events at beats 0, 1, 2, 3 (before offset)
   * This creates a synthetic metronome region with countdown clicks
   *
   * @param tracks - Track registry to inject countdown region into
   * @param timeSignature - Time signature for countdown (e.g., 4/4)
   */
  addCountdownRegion(
    tracks: Map<string, any>,
    timeSignature: { numerator: number; denominator: number },
  ): void {
    if (!this.countdownEnabled) return;

    const countdownEvents: PatternEvent[] = [];
    for (let beat = 0; beat < timeSignature.numerator; beat++) {
      countdownEvents.push({
        position: `0:${beat}:0`, // Beat within first measure
        type: beat === 0 ? 'accent' : 'click', // First beat is accented
        velocity: beat === 0 ? 0.9 : 0.7,
      });
    }

    const countdownRegion: Region = {
      id: 'countdown-region',
      trackId: 'metronome',
      startTime: 0, // Starts at beat 0 (before the offset)
      duration: timeSignature.numerator,
      skipCountdownOffset: true, // CRITICAL: Don't offset countdown events!
      pattern: {
        id: 'countdown-pattern',
        name: 'Countdown',
        type: 'metronome',
        events: countdownEvents,
      },
    };

    // Get or create metronome track
    let metronomeTrack = tracks.get('metronome');
    if (!metronomeTrack) {
      metronomeTrack = {
        id: 'metronome',
        name: 'Metronome',
        regions: [],
        instrumentType: 'metronome',
      };
      tracks.set('metronome', metronomeTrack);
    }

    // CRITICAL: Add countdown region to BEGINNING of regions array
    // Don't replace existing metronome - countdown plays BEFORE exercise metronome
    const existingRegionCount = metronomeTrack.regions.length;

    // Insert countdown at the beginning (it plays first at beat 0)
    // Exercise metronome regions (startTime: 4) will play after
    metronomeTrack.regions.unshift(countdownRegion);

    logger.info('🎵 Countdown region added at beginning', {
      beats: timeSignature.numerator,
      events: countdownEvents.length,
      regionId: countdownRegion.id,
      totalRegions: metronomeTrack.regions.length,
      existingRegions: existingRegionCount,
      instanceId: this.instanceId,
    });
  }

  /**
   * Add voice cue events ("one", "two", "three", "four") during countdown
   * This creates a synthetic voice-cue region that plays alongside metronome countdown
   *
   * @param tracks - Track registry to inject countdown region into
   * @param timeSignature - Time signature for countdown (e.g., 4/4)
   */
  addVoiceCountdownRegion(
    tracks: Map<string, any>,
    timeSignature: { numerator: number; denominator: number },
  ): void {
    if (!this.countdownEnabled) return;

    // Voice cue names for each beat
    const cueNames = [
      'one',
      'two',
      'three',
      'four',
      'five',
      'six',
      'seven',
      'eight',
    ];

    const voiceCueEvents: PatternEvent[] = [];
    for (let beat = 0; beat < timeSignature.numerator; beat++) {
      // Only add voice cue if we have a name for it (up to 8 beats supported)
      if (beat < cueNames.length) {
        voiceCueEvents.push({
          position: `0:${beat}:0`, // Beat within first measure
          type: 'voice-cue',
          velocity: 0.9,
          data: { cue: cueNames[beat] }, // "one", "two", "three", "four"
        });
      }
    }

    const voiceCueRegion: Region = {
      id: 'voice-cue-countdown-region',
      trackId: 'voice-cue',
      startTime: 0, // Starts at beat 0 (before the offset)
      duration: timeSignature.numerator,
      skipCountdownOffset: true, // CRITICAL: Don't offset countdown events!
      pattern: {
        id: 'voice-cue-countdown-pattern',
        name: 'Voice Countdown',
        type: 'voice-cue',
        events: voiceCueEvents,
      },
    };

    // Get or create voice-cue track
    let voiceCueTrack = tracks.get('voice-cue');
    if (!voiceCueTrack) {
      voiceCueTrack = {
        id: 'voice-cue',
        name: 'Voice Cues',
        regions: [],
        instrumentType: 'voice-cue',
      };
      tracks.set('voice-cue', voiceCueTrack);
    }

    // CRITICAL: Add countdown region to BEGINNING of regions array
    // Plays at the same time as metronome countdown (beats 0-3)
    const existingRegionCount = voiceCueTrack.regions.length;
    voiceCueTrack.regions.unshift(voiceCueRegion);

    logger.info('🗣️ Voice cue countdown region added at beginning', {
      beats: timeSignature.numerator,
      events: voiceCueEvents.length,
      cues: voiceCueEvents.map((e) => e.data?.cue),
      regionId: voiceCueRegion.id,
      totalRegions: voiceCueTrack.regions.length,
      existingRegions: existingRegionCount,
      instanceId: this.instanceId,
    });
  }
}
