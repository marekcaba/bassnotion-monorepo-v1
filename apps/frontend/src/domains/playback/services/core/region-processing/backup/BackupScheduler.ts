/**
 * BackupScheduler - Backup event scheduling system
 *
 * Defense-in-depth system that catches events the main scheduler might miss.
 * Runs on an interval and schedules events within a lookahead window.
 */

import * as Tone from 'tone';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('RegionProcessor');

interface Track {
  regions: Array<{
    id: string;
    startTime: number;
    duration: number; // In beats
    skipCountdownOffset?: boolean;
    pattern?: {
      events: Array<{
        position: string;
        [key: string]: any;
      }>;
    };
  }>;
}

export class BackupScheduler {
  private instanceId: string;
  private lookAheadTime: number = 0.1; // 100ms lookahead

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Process current transport position (backup method)
   * Schedules events that fall within the lookahead window
   */
  processPosition(
    isRunning: boolean,
    tracks: Track[],
    scheduledEvents: Map<number, Set<string>>,
    scheduledIds: Set<number>,
    countdownEnabled: boolean,
    countdownOffsetBeats: number,
    parsePosition: (position: string) => number,
    getInstrumentType: (track: Track) => string,
    emitEvent: (instrumentType: string, event: any, absoluteTime: number) => void,
  ): void {
    // CRITICAL: Defense in depth - don't schedule if stopping
    if (!isRunning) {
      logger.debug('⏰ Interval fired but isRunning=false, skipping');
      return;
    }

    const currentTime = Tone.Transport.seconds;

    // Process events within lookahead window
    const lookAheadEnd = currentTime + this.lookAheadTime;

    tracks.forEach((track, trackId) => {
      const instrumentType = getInstrumentType(track);

      track.regions.forEach((region) => {
        if (!region.pattern?.events) return;

        // Check if we're within this region's time range
        // FAANG FIX: region.duration is in BEATS, must convert to seconds using current BPM!
        const currentBpm = Tone.Transport.bpm.value;
        const secondsPerBeat = 60 / currentBpm;
        const regionDurationInSeconds = region.duration * secondsPerBeat;

        if (
          currentTime < region.startTime ||
          currentTime > region.startTime + regionDurationInSeconds
        ) {
          return;
        }

        region.pattern.events.forEach((event, eventIndex) => {
          const eventTime = parsePosition(event.position);
          // COUNTDOWN SOLUTION: Same offset logic as main scheduler - convert beats to seconds
          // FAANG FIX: Use parsePosition() which respects current BPM (Tone.Time() doesn't!)
          const offsetTime =
            countdownEnabled && !region.skipCountdownOffset
              ? parsePosition(`0:${countdownOffsetBeats}:0`)
              : 0;
          const absoluteTime = region.startTime + eventTime + offsetTime;

          // Check if this event should be triggered soon
          if (absoluteTime >= currentTime && absoluteTime <= lookAheadEnd) {
            // CRITICAL FIX: Check the MAIN event key to avoid double-scheduling
            // The backup scheduler should NOT reschedule events that are already scheduled
            const mainEventKey = `${region.id}_${eventIndex}`;
            const backupEventKey = `backup_${region.id}_${event.position}_${Math.floor(absoluteTime)}`;

            // Skip if already scheduled by main scheduler OR backup scheduler
            const trackEvents = scheduledEvents.get(trackId);
            const hasMainKey = trackEvents && trackEvents.has(mainEventKey);
            const hasBackupKey = trackEvents && trackEvents.has(backupEventKey);

            if (!hasMainKey && !hasBackupKey) {
              // Schedule it immediately - absoluteTime is in seconds
              const toneId = Tone.Transport.schedule((time) => {
                if (!isRunning) return;
                // CRITICAL FIX: Use absoluteTime (intended time in seconds) not time (Tone's lookahead time)
                // Must match the main scheduling method to avoid timing drift
                emitEvent(instrumentType, event, absoluteTime);
              }, absoluteTime);

              // Mark BOTH keys as scheduled to prevent duplicate scheduling
              if (!scheduledEvents.has(trackId)) {
                scheduledEvents.set(trackId, new Set());
              }
              scheduledEvents.get(trackId)!.add(mainEventKey);
              scheduledEvents.get(trackId)!.add(backupEventKey);
              scheduledIds.add(toneId);
            }
          }
        });
      });
    });
  }
}
