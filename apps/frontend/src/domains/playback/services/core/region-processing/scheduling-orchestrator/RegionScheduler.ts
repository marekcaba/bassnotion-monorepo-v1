/**
 * RegionScheduler - Orchestrates scheduling of all track regions
 *
 * Phase 4.1: Merged ExerciseDurationCalculator + BackupScheduler
 *
 * Responsibilities:
 * - Batch event collection across all tracks/regions
 * - Event sorting (control changes before notes)
 * - Time calculation (absolute time with countdown offset)
 * - CC64 timeline integration
 * - Performance optimization (caching, skip past events)
 * - Upfront audio scheduling (prevents doubling)
 * - Exercise duration calculation (from ExerciseDurationCalculator)
 * - Backup event scheduling with lookahead (from BackupScheduler)
 *
 * This is the main scheduling orchestrator that coordinates:
 * - Event collection from all regions
 * - Time-based batching
 * - Direct audio scheduling via EventRouter
 * - Exercise duration/last beat detection
 * - Defense-in-depth backup scheduling
 */

import * as Tone from 'tone';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('RegionProcessor');

// Types
interface PatternEvent {
  position:
    | string
    | { measure: number; beat: number; subdivision?: number; tick?: number };
  type: string;
  velocity?: number;
  duration?: string | number;
  data?: any;
}

interface Region {
  id: string;
  startTime: number;
  duration: number;
  skipCountdownOffset?: boolean;
  pattern?: {
    events: PatternEvent[];
  };
}

interface Track {
  id?: string; // Track ID (e.g., "metronome", "voice-cue", "harmony-widget-track")
  regions: Region[];
  instrumentType?: string;
  name?: string;
  exerciseId?: string;
}

interface CachedSchedule {
  cc64Timeline: Map<number, boolean>;
  calculatedEvents: any[];
  cachedAt: number;
  bpm: number;
  countdownBeats: number;
}

export class RegionScheduler {
  private instanceId: string;
  private lookAheadTime: number = 0.1; // 100ms lookahead (from BackupScheduler)

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Schedule all regions across all tracks
   * Main orchestration method
   */
  scheduleAll(
    tracks: Map<string, Track>,
    scheduledEvents: Map<string, Set<string>>,
    countdownEnabled: boolean,
    countdownOffsetBeats: number,
    transportStartTime: number,
    audioContext: AudioContext | null,

    // Dependencies
    getInstrumentType: (track: Track) => string,
    parsePositionToObject: (position: any) => {
      measure: number;
      beat: number;
      subdivision: number;
      tick: number;
    },
    parsePosition: (position: string) => number,
    buildCC64Timeline: (
      events: PatternEvent[],
      region: Region,
    ) => Map<number, boolean>,
    logCC64DiagnosticTable: (events: PatternEvent[], region: Region) => void,
    getCachedSchedule: (exerciseId: string) => CachedSchedule | null,
    setCachedSchedule: (exerciseId: string, schedule: CachedSchedule) => void,
    emitEvent: (
      instrumentType: string,
      event: PatternEvent,
      time: number,
    ) => void,
    setCurrentCC64Timeline: (timeline: Map<number, boolean>) => void,
    calculateExerciseDuration: () => void,
  ): {
    totalEvents: number;
    batchCount: number;
    currentCC64Timeline: Map<number, boolean>;
  } {
    // LAST NOTE RING-OUT: Calculate exercise duration to identify last beat
    calculateExerciseDuration();

    // Log track processing order
    const trackOrder = Array.from(tracks.keys());
    logger.info(`🔄 Track processing order: ${trackOrder.join(' → ')}`);

    // PERFORMANCE OPTIMIZATION: Check for cached schedule
    const harmonyTrack = Array.from(tracks.values()).find(
      (t) => t.instrumentType === 'harmony',
    );
    const exerciseId = harmonyTrack?.exerciseId;
    const cachedSchedule = exerciseId ? getCachedSchedule(exerciseId) : null;

    // CRITICAL FIX: Batch events by time to prevent sequential callback delays
    const eventsByTime = new Map<
      number,
      Array<{
        instrumentType: string;
        event: PatternEvent;
        eventKey: string;
        regionId: string;
      }>
    >();

    // Track CC64 timeline (will be set during region processing)
    let currentCC64Timeline = new Map<number, boolean>();

    // Track newly scheduled events for return value
    let newlyScheduledCount = 0;

    // First pass: collect all events organized by time
    tracks.forEach((track, trackId) => {
      const instrumentType = getInstrumentType(track);
      logger.info(`🎵 Processing track: ${trackId} (${instrumentType})`);

      track.regions.forEach((region) => {
        if (!region.pattern?.events) {
          return;
        }

        // CRITICAL: Sort events so control changes (sustain pedal) are processed BEFORE notes
        const sortedEvents = [...region.pattern.events].sort((a, b) => {
          const aPos = parsePositionToObject(a.position);
          const bPos = parsePositionToObject(b.position);

          // Compare positions
          if (aPos.measure !== bPos.measure) return aPos.measure - bPos.measure;
          if (aPos.beat !== bPos.beat) return aPos.beat - bPos.beat;
          if (aPos.subdivision !== bPos.subdivision) {
            return aPos.subdivision - bPos.subdivision;
          }
          if (aPos.tick !== bPos.tick) {
            return aPos.tick - bPos.tick;
          }

          // At same time: control changes BEFORE notes
          const aIsCC = a.type === 'harmony-control-change';
          const bIsCC = b.type === 'harmony-control-change';
          if (aIsCC && !bIsCC) return -1;
          if (!aIsCC && bIsCC) return 1;

          return 0;
        });

        // DIAGNOSTIC: Log first few notes
        const firstThreeNotes = sortedEvents
          .filter((e) => e.type === 'harmony-note')
          .slice(0, 3);
        // eslint-disable-next-line no-console
        console.log(
          '[REGIONPROCESSOR] First 3 harmony notes after sort:',
          firstThreeNotes.map((e, i) => ({
            index: i + 1,
            type: e.type,
            noteName: (e as any).data?.noteName,
            ticks: (e as any).data?.ticks,
            position: e.position,
          })),
        );

        // [CC64 DIAGNOSTIC] Log first 10 events
        // eslint-disable-next-line no-console
        console.log(
          `[CC64 DIAGNOSTIC] First 10 events after sorting (region: ${region.id}):`,
        );
        sortedEvents.slice(0, 10).forEach((event, i) => {
          const parsedPos = parsePositionToObject(event.position);
          const isCC64 =
            event.type === 'harmony-control-change' &&
            (event as any).data?.cc === 64;

          // Extract tick from original position if available (not in ParsedPosition interface)
          let tick = 0;
          if (
            typeof event.position === 'object' &&
            (event.position as any).tick !== undefined
          ) {
            tick = (event.position as any).tick;
          } else if (typeof event.position === 'string') {
            const parts = event.position.split(':');
            tick = parseInt(parts[3] || '0', 10);
          }

          // eslint-disable-next-line no-console
          console.log(
            `  ${i}: ${event.type}${isCC64 ? ' (CC64)' : ''} @ ${parsedPos.bars}:${parsedPos.beats}:${parsedPos.sixteenths}:${tick}`,
            isCC64 ? `value=${(event as any).data?.value}` : '',
          );
        });

        // CC64: Build timeline ONLY for harmony regions
        // Other regions (countdown, metronome, voice-cue) don't have CC64 data
        // and should NOT overwrite the harmony timeline
        if (instrumentType === 'harmony') {
          if (cachedSchedule) {
            currentCC64Timeline = cachedSchedule.cc64Timeline;
            // eslint-disable-next-line no-console
            console.log(
              `[CC64] ♻️ Using CACHED timeline with ${currentCC64Timeline.size} pedal events`,
            );
          } else {
            currentCC64Timeline = buildCC64Timeline(sortedEvents, region);
            // eslint-disable-next-line no-console
            console.log(
              `[CC64] 🔨 Built NEW timeline with ${currentCC64Timeline.size} pedal events`,
            );
          }

          // Sync CC64 timeline to HarmonyScheduler ONLY for harmony regions
          setCurrentCC64Timeline(currentCC64Timeline);
        }

        if (currentCC64Timeline.size > 0) {
          const timeline = Array.from(currentCC64Timeline.entries())
            .sort((a, b) => a[0] - b[0])
            .map(
              ([time, down]) => `${time.toFixed(3)}s=${down ? 'DOWN' : 'UP'}`,
            )
            .join(', ');
          // eslint-disable-next-line no-console
          console.log(`[CC64] Timeline: ${timeline}`);

          logCC64DiagnosticTable(sortedEvents, region);
        }

        // Track harmony notes for diagnostic
        let harmonyNoteCount = 0;

        sortedEvents.forEach((event, eventIndex) => {
          const eventKey = `${region.id}_${eventIndex}`;

          // Skip if already scheduled
          const trackEvents = scheduledEvents.get(trackId);
          if (trackEvents && trackEvents.has(eventKey)) return;

          // Calculate absolute time
          const eventData = (event as any).data;
          // FIX: Always use live BPM from Tone.Transport (source of truth)
          // The eventData.originalBpm is stale - cached at event creation time
          // When user changes tempo via UI, Tone.Transport.bpm.value is updated
          // by musicalTruth.setBPM() and we must use that live value
          const currentBpm = Tone.Transport.bpm.value;
          let eventTime: number;

          if (eventData?.ticks !== undefined) {
            // Use absolute ticks with LIVE BPM (not stale originalBpm)
            const secondsPerBeat = 60 / currentBpm;
            const ticksPerBeat = 480;
            const absoluteTicks = eventData.ticks;
            eventTime = (absoluteTicks / ticksPerBeat) * secondsPerBeat;

            if (
              event.type === 'harmony-note' &&
              (harmonyNoteCount < 3 || harmonyNoteCount === 8)
            ) {
              // eslint-disable-next-line no-console
              console.log(
                `[ABSOLUTE TICK SCHEDULING] Harmony Note ${harmonyNoteCount + 1}:`,
                {
                  absoluteTicks,
                  currentBpm,
                  eventTime: eventTime.toFixed(6),
                  position: event.position,
                  noteName: eventData?.noteName,
                },
              );
            }
            if (event.type === 'harmony-note') harmonyNoteCount++;
          } else {
            // Fallback to position parsing
            eventTime = parsePosition(
              typeof event.position === 'string' ? event.position : '0:0:0',
            );

            if (
              event.type === 'harmony-note' &&
              (harmonyNoteCount < 3 || harmonyNoteCount === 8)
            ) {
              // eslint-disable-next-line no-console
              console.log(
                `[RELATIVE TICK SCHEDULING] Harmony Note ${harmonyNoteCount + 1}:`,
                {
                  position: event.position,
                  calculatedTime: eventTime.toFixed(6),
                  WARNING: 'ticks undefined - using relative position',
                },
              );
            }
            if (event.type === 'harmony-note') harmonyNoteCount++;
          }

          // Apply countdown offset
          const offsetTime =
            countdownEnabled && !region.skipCountdownOffset
              ? parsePosition(`0:${countdownOffsetBeats}:0`)
              : 0;

          const absoluteTime = region.startTime + eventTime + offsetTime;

          if (eventIndex < 3) {
            logger.info(`🎯 Absolute time calculation`, {
              'region.startTime': region.startTime,
              eventTime,
              offsetTime,
              absoluteTime,
            });
          }

          // Round to 3 decimals to group events at same time
          const timeKey = Math.round(absoluteTime * 1000) / 1000;

          if (!eventsByTime.has(timeKey)) {
            eventsByTime.set(timeKey, []);
          }

          eventsByTime.get(timeKey)!.push({
            instrumentType,
            event,
            eventKey,
            regionId: region.id,
          });

          // Mark as scheduled
          if (!scheduledEvents.has(trackId)) {
            scheduledEvents.set(trackId, new Set());
          }
          scheduledEvents.get(trackId)!.add(eventKey);
          newlyScheduledCount++; // Track newly scheduled events

          logger.info(
            `📅 Collected ${instrumentType} event at ${absoluteTime}s: ${event.type}`,
          );
        });
      });
    });

    // Log batching stats
    const batchedEventCount = Array.from(scheduledEvents.values()).reduce(
      (sum, set) => sum + set.size,
      0,
    );
    logger.info(
      `📦 Batched ${eventsByTime.size} unique time points with ${batchedEventCount} total events`,
    );

    // Second pass: schedule audio for all events
    eventsByTime.forEach((events, timeKey) => {
      // Skip past events
      const currentAudioTime = audioContext?.currentTime || 0;
      const absoluteAudioTime = transportStartTime + timeKey;

      if (absoluteAudioTime < currentAudioTime) {
        logger.debug(`⏭️  Skipping past event batch at ${timeKey}s`, {
          absoluteAudioTime: absoluteAudioTime.toFixed(6),
          currentAudioTime: currentAudioTime.toFixed(6),
          eventCount: events.length,
        });
        return;
      }

      try {
        const batchStartTime = performance.now();

        events.forEach(({ instrumentType, event }, index) => {
          const eventStartTime = performance.now();

          // Schedule audio directly with absolute audio time (transportStartTime + relative time)
          emitEvent(instrumentType, event, absoluteAudioTime);

          const eventEndTime = performance.now();

          logger.info(
            `⏱️ Event ${index + 1}/${events.length} in batch: ${instrumentType}`,
            {
              eventProcessingTime: `${(eventEndTime - eventStartTime).toFixed(3)}ms`,
              timeSinceBatchStart: `${(eventStartTime - batchStartTime).toFixed(3)}ms`,
            },
          );
        });

        const batchTotalTime = performance.now() - batchStartTime;
        logger.info(
          `✅ Batch completed: ${events.length} events in ${batchTotalTime.toFixed(3)}ms`,
        );
      } catch (error) {
        logger.error(`Failed to schedule events at time ${timeKey}: ${error}`);
      }
    });

    logger.info(
      `✅ Scheduled ${newlyScheduledCount} audio events total in ${eventsByTime.size} batches`,
    );

    // Cache timeline for future use
    if (exerciseId && !cachedSchedule && currentCC64Timeline.size > 0) {
      const schedule: CachedSchedule = {
        cc64Timeline: new Map(currentCC64Timeline),
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: Tone.Transport.bpm.value,
        countdownBeats: countdownOffsetBeats,
      };

      setCachedSchedule(exerciseId, schedule);
    }

    return {
      totalEvents: newlyScheduledCount,
      batchCount: eventsByTime.size,
      currentCC64Timeline,
    };
  }

  // ============================================================================
  // EXERCISE DURATION CALCULATION (from ExerciseDurationCalculator)
  // ============================================================================

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

  // ============================================================================
  // BACKUP SCHEDULING (from BackupScheduler)
  // ============================================================================

  /**
   * Process current transport position (backup method)
   * Schedules events that fall within the lookahead window
   * Defense-in-depth system that catches events the main scheduler might miss
   */
  processPosition(
    isRunning: boolean,
    tracks: Track[],
    scheduledEvents: Map<number | string, Set<string>>,
    scheduledIds: Set<number>,
    countdownEnabled: boolean,
    countdownOffsetBeats: number,
    parsePosition: (position: string) => number,
    getInstrumentType: (track: Track) => string,
    emitEvent: (
      instrumentType: string,
      event: any,
      absoluteTime: number,
    ) => void,
  ): void {
    // CRITICAL: Defense in depth - don't schedule if stopping
    if (!isRunning) {
      logger.debug('⏰ Interval fired but isRunning=false, skipping');
      return;
    }

    const currentTime = Tone.Transport.seconds;

    // Process events within lookahead window
    const lookAheadEnd = currentTime + this.lookAheadTime;

    tracks.forEach((track) => {
      const instrumentType = getInstrumentType(track);
      // CRITICAL FIX: tracks is an Array, but we need the actual track ID string for scheduledEvents Map
      // Extract the track ID from the track object itself, not the array index
      const trackId = (track as any).id || track.name || instrumentType;

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
          const eventTime = parsePosition(
            typeof event.position === 'string' ? event.position : '0:0:0',
          );
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
