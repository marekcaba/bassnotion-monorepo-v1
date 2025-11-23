/**
 * ConfigurationManager - Manages countdown configuration and module synchronization
 *
 * Phase 2.4: Merged CountdownManager + ConfigurationCoordinator
 *
 * Responsibilities:
 * - Enable/disable countdown with time signature
 * - Calculate countdown offset (one measure)
 * - Generate metronome countdown regions (accent + clicks)
 * - Generate voice cue countdown regions ("one", "two", "three", "four")
 * - Inject countdown regions at beginning of tracks
 * - Synchronize countdown state across all modules (ScheduleCache, SustainPedalManager)
 * - Coordinate configuration changes consistently
 */

import { getLogger } from '@/utils/logger.js';
import type { Region, PatternEvent } from '../types/region.types.js';
import type { ScheduleCache } from '../cache/ScheduleCache.js';
import type { SustainPedalManager } from '../sustain/SustainPedalManager.js';

const logger = getLogger('ConfigurationManager');

export class ConfigurationManager {
  private countdownEnabled = true;
  private countdownOffsetBeats = 0;
  private instanceId: string;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  // ============================================================================
  // COUNTDOWN CONFIGURATION (from CountdownManager + ConfigurationCoordinator sync)
  // ============================================================================

  /**
   * Enable countdown pre-roll with time signature and sync to all modules
   * All events will be offset by one measure (numerator beats)
   */
  enableCountdown(
    timeSignature: { numerator: number; denominator: number },
    scheduleCache: ScheduleCache,
    sustainPedalManager: SustainPedalManager,
  ): number {
    this.countdownEnabled = true;
    this.countdownOffsetBeats = timeSignature.numerator;

    // Sync countdown offset to ScheduleCache for cache key generation
    scheduleCache.setCountdownOffsetBeats(this.countdownOffsetBeats);

    // Sync countdown configuration to SustainPedalManager
    sustainPedalManager.setCountdownConfig(this.countdownOffsetBeats, true);

    logger.info('✅ Countdown enabled and synced across modules', {
      instanceId: this.instanceId,
      timeSignature,
      offsetBeats: this.countdownOffsetBeats,
      offsetMeasures: 1,
    });

    return this.countdownOffsetBeats;
  }

  /**
   * Disable countdown pre-roll and sync to all modules (all events start at beat 0)
   */
  disableCountdown(
    scheduleCache: ScheduleCache,
    sustainPedalManager: SustainPedalManager,
  ): void {
    this.countdownEnabled = false;
    this.countdownOffsetBeats = 0;

    // Sync countdown offset to ScheduleCache
    scheduleCache.setCountdownOffsetBeats(0);

    // Sync countdown configuration to SustainPedalManager
    sustainPedalManager.setCountdownConfig(0, false);

    logger.info('✅ Countdown disabled and synced across modules', {
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

  // ============================================================================
  // COUNTDOWN REGION GENERATION (from CountdownManager)
  // ============================================================================

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
