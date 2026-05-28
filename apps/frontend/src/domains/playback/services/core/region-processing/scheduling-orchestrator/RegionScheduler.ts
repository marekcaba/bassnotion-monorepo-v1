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

import { getLogger } from '@/utils/logger.js';
import { applyClickFreeStop } from '../utils/applyClickFreeStop.js';

const logger = getLogger('RegionProcessor');

// Helper to get Tone from window (must be initialized before RegionScheduler is used)
function getTone(): NonNullable<typeof window.Tone> {
  if (typeof window !== 'undefined') {
    // Check both locations where Tone.js may be stored
    const tone = window.Tone || window.__globalTone;
    if (tone) {
      return tone;
    }
  }
  throw new Error(
    'RegionScheduler: Tone.js not loaded. Ensure AudioEngine is initialized first.',
  );
}

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

interface MusicalPosition {
  bars?: number;
  beats?: number;
  sixteenths?: number;
  ticks?: number;
}

/**
 * Convert a duration (either number of beats or MusicalPosition) to total beats
 * @param duration - Either a number (already in beats) or a MusicalPosition object
 * @param beatsPerBar - Number of beats per bar (default 4 for 4/4 time)
 * @returns Total number of beats
 */
function durationToBeats(
  duration: number | MusicalPosition,
  beatsPerBar = 4,
): number {
  // If it's already a number, return it
  if (typeof duration === 'number') {
    return duration;
  }

  // Convert MusicalPosition to total beats
  // Each bar has beatsPerBar beats, each beat has 4 sixteenths, 480 ticks per beat
  const bars = duration.bars ?? 0;
  const beats = duration.beats ?? 0;
  const sixteenths = duration.sixteenths ?? 0;
  const ticks = duration.ticks ?? 0;

  const totalBeats = bars * beatsPerBar + beats + sixteenths / 4 + ticks / 480;

  return totalBeats;
}

interface Region {
  id: string;
  startTime: number;
  duration: number | MusicalPosition; // Can be beats (number) or MusicalPosition object
  loopCount?: number; // Number of times to repeat the pattern (default 1, 0 = infinite)
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

// LAUNCH-02.5b: infinite-loop state per active audio-stem region.
// A sliding window of pre-armed iterations lives in the map per region —
// each entry is an AudioBufferSourceNode whose start(when) was scheduled
// up-front against the Web Audio clock. We don't track Tone.Transport
// schedule IDs anymore: stop = `source.stop(stopAt)` on each entry, which
// cancels both already-playing and pending-start sources per Web Audio spec.
interface InfiniteAudioEntry {
  source: AudioBufferSourceNode;
  gain: GainNode;
  iter: number;
  /** Absolute audio-context time at which this iteration's source.start
   *  was scheduled. Used to anchor the next refill so a BPM bump only
   *  affects iterations strictly past the current window. */
  startAt: number;
}

// Hook closure passed in by LAUNCH-02.5c so the card can swap key-set
// buffers between iterations. If absent, the scheduler reuses whichever
// buffer is currently registered with AudioPlayerScheduler.
export type ResolvePendingBuffer = (
  regionId: string,
  iter: number,
) => AudioBuffer | null;

// Number of upcoming iterations pre-armed at any moment. 3 means iter N
// is playing, N+1 and N+2 are queued via source.start(when); when N ends
// we arm N+3. Plenty of buffer for onended-jitter and live BPM changes
// while keeping the active source count tiny per region.
const INFINITE_AUDIO_WINDOW = 3;

// Narrow contract RegionScheduler needs from AudioPlayerScheduler to spawn
// its own AudioBufferSources for the infinite-loop. Avoids a hard import
// dependency on the full AudioPlayerScheduler class.
export interface InfiniteAudioStemAccess {
  getStem(stemKey: string): { buffer: AudioBuffer; gain: GainNode } | null;
  trackExternalSource(stemKey: string, source: AudioBufferSourceNode): void;
}

export class RegionScheduler {
  private instanceId: string;
  private lookAheadTime = 0.1; // 100ms lookahead (from BackupScheduler)

  // LAUNCH-02.5b: keyed by `${regionId}#${iter}`. Carries the pre-armed
  // sources for an infinite audio region's sliding window (typically 2-3
  // upcoming iterations). source.onended on iter N refills iter N+WINDOW.
  private infiniteAudioRegions = new Map<string, InfiniteAudioEntry>();

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
    // LAUNCH-02.5b: optional closure injected by the Groove Card hook
    // (02.5c) so the next iteration's buffer can come from a key-set swap.
    // Returning null means "reuse whichever buffer is currently registered
    // with AudioPlayerScheduler" — fine for the simple single-key case.
    resolvePendingBuffer?: ResolvePendingBuffer,
    // LAUNCH-02.5b: handle to the audio-stem scheduler's registered
    // buffer + gain per stem. Needed when an audio-stem region declares
    // loopCount: 0 (infinite) so this scheduler can spawn iteration
    // sources for the crossfade. Optional — without it, infinite audio
    // regions silently no-op.
    audioStemAccess?: InfiniteAudioStemAccess,
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
        // LAUNCH-02.5b: infinite-loop audio stems are pre-rendered buffers,
        // not per-event MIDI patterns — they have no `pattern.events`.
        // Detect them BEFORE the events early-return so they get scheduled.
        if (
          instrumentType.startsWith('audio-') &&
          (region.loopCount ?? 1) === 0 &&
          audioContext
        ) {
          // Apply the same countdown offset the MIDI path uses (line ~369)
          // so infinite audio stems start AFTER the count-in bar instead of
          // on top of it. Converted beats→seconds via parsePosition, matching
          // the MIDI branch exactly.
          const countdownOffsetSeconds =
            countdownEnabled && !region.skipCountdownOffset
              ? parsePosition(`0:${countdownOffsetBeats}:0`)
              : 0;
          this.scheduleInfiniteAudioRegion(
            region,
            trackId,
            instrumentType,
            transportStartTime + countdownOffsetSeconds,
            audioContext,
            audioStemAccess,
            resolvePendingBuffer,
          );
          return; // skip the finite-loop / eventsByTime path for this region
        }

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

        // CC64 diagnostic logs removed for performance

        // CC64: Build timeline ONLY for harmony regions
        // Other regions (countdown, metronome, voice-cue) don't have CC64 data
        // and should NOT overwrite the harmony timeline
        if (instrumentType === 'harmony') {
          if (cachedSchedule) {
            currentCC64Timeline = cachedSchedule.cc64Timeline;
          } else {
            currentCC64Timeline = buildCC64Timeline(sortedEvents, region);
          }

          // Sync CC64 timeline to HarmonyScheduler ONLY for harmony regions
          setCurrentCC64Timeline(currentCC64Timeline);
        }

        // CC64 timeline logging removed for performance

        // Track harmony notes for diagnostic
        let harmonyNoteCount = 0;

        // Get BPM for duration calculations (used for looping)
        const Tone = getTone();
        const currentBpm = Tone.getTransport().bpm.value;
        const secondsPerBeat = 60 / currentBpm;

        // SCHEDULING-TIME LOOPING: Calculate loop count and region duration
        // loopCount: 1 = play once (default), 2+ = repeat, 0 = infinite (not supported yet)
        const effectiveLoopCount = Math.max(1, region.loopCount ?? 1);

        // Convert duration to beats (handles both number and MusicalPosition formats)
        const regionDurationInBeats = durationToBeats(region.duration);
        const regionDurationInSeconds = regionDurationInBeats * secondsPerBeat;

        // Loop logging removed for performance

        // Loop through pattern repetitions
        for (let loopNum = 0; loopNum < effectiveLoopCount; loopNum++) {
          // Calculate time offset for this loop iteration
          const loopOffset = loopNum * regionDurationInSeconds;

          sortedEvents.forEach((event, eventIndex) => {
            // Include loop number in event key to prevent duplicate detection across loops
            const eventKey = `${region.id}_${eventIndex}_loop${loopNum}`;

            // Skip if already scheduled
            const trackEvents = scheduledEvents.get(trackId);
            if (trackEvents && trackEvents.has(eventKey)) return;

            // Calculate absolute time
            const eventData = (event as any).data;
            // FIX: Always use live BPM from Tone.Transport (source of truth)
            // The eventData.originalBpm is stale - cached at event creation time
            // When user changes tempo via UI, Tone.Transport.bpm.value is updated
            // by musicalTruth.setBPM() and we must use that live value
            let eventTime: number;

            if (eventData?.ticks !== undefined) {
              // Use absolute ticks with LIVE BPM (not stale originalBpm)
              const ticksPerBeat = 480;
              const absoluteTicks = eventData.ticks;
              eventTime = (absoluteTicks / ticksPerBeat) * secondsPerBeat;

              // Harmony note logging removed for performance
              if (event.type === 'harmony-note') harmonyNoteCount++;
            } else {
              // Fallback to position parsing
              eventTime = parsePosition(
                typeof event.position === 'string' ? event.position : '0:0:0',
              );

              // Harmony note logging removed for performance
              if (event.type === 'harmony-note') harmonyNoteCount++;
            }

            // Apply countdown offset
            const offsetTime =
              countdownEnabled && !region.skipCountdownOffset
                ? parsePosition(`0:${countdownOffsetBeats}:0`)
                : 0;

            // CRITICAL: Add loopOffset for pattern repetition
            const absoluteTime =
              region.startTime + eventTime + offsetTime + loopOffset;

            // RING-TIMING-DEBUG: Log first few bass notes to compare with ring calculation
            if (instrumentType === 'bass' && loopNum === 0 && eventIndex < 3) {
              const eventMeasure =
                event.data?.measure ??
                event.data?.position?.measure ??
                'unknown';
              const eventBeat =
                event.data?.beat ?? event.data?.position?.beat ?? 'unknown';
              console.log(
                `🔧 [REGION-SCHED-TIMING] === BASS NOTE ${eventIndex} ===`,
              );
              console.log(
                `🔧 [REGION-SCHED-TIMING] region.startTime=${region.startTime.toFixed(4)}s`,
              );
              console.log(
                `🔧 [REGION-SCHED-TIMING] eventTime=${eventTime.toFixed(4)}s`,
              );
              console.log(
                `🔧 [REGION-SCHED-TIMING] offsetTime=${offsetTime.toFixed(4)}s (countdownOffsetBeats=${countdownOffsetBeats})`,
              );
              console.log(
                `🔧 [REGION-SCHED-TIMING] absoluteTime=${absoluteTime.toFixed(4)}s = ${(absoluteTime * 1000).toFixed(0)}ms`,
              );
              console.log(
                `🔧 [REGION-SCHED-TIMING] Note: measure=${eventMeasure}, beat=${eventBeat}`,
              );
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
            newlyScheduledCount++;
          });
        } // End loop iteration
      });
    });

    // Batching stats logging removed for performance

    // Second pass: schedule audio for all events
    eventsByTime.forEach((events, timeKey) => {
      // Skip past events
      // NOTE: timeKey is already absolute (includes countdown offset etc.)
      // EventRouter.emitEvent() will add transportStartTime to convert to AudioContext time
      // So we check against (transportStartTime + timeKey) for past event detection
      const currentAudioTime = audioContext?.currentTime || 0;
      const absoluteAudioTime = transportStartTime + timeKey;

      if (absoluteAudioTime < currentAudioTime) {
        // Skip past events silently - debug logging removed for performance
        return;
      }

      try {
        // Schedule all events in this batch
        // CRITICAL FIX: Pass timeKey (relative transport time), NOT absoluteAudioTime
        // EventRouter.emitEvent() will add transportStartTime to convert to AudioContext time
        // Previously we were passing absoluteAudioTime which already includes transportStartTime,
        // causing transportStartTime to be added TWICE (once here, once in EventRouter)
        events.forEach(({ instrumentType, event }) => {
          emitEvent(instrumentType, event, timeKey);
        });
      } catch (error) {
        logger.error(`Failed to schedule events at time ${timeKey}: ${error}`);
      }
    });

    // Cache timeline for future use
    if (exerciseId && !cachedSchedule && currentCC64Timeline.size > 0) {
      const ToneForCache = getTone();
      const cacheTransport = ToneForCache.getTransport
        ? ToneForCache.getTransport()
        : ToneForCache.Transport;
      const schedule: CachedSchedule = {
        cc64Timeline: new Map(currentCC64Timeline),
        calculatedEvents: [],
        cachedAt: Date.now(),
        bpm: cacheTransport.bpm.value,
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
    const Tone = getTone();
    const currentBpm = Tone.getTransport().bpm.value;
    const secondsPerBeat = 60 / currentBpm;
    let maxEndTime = 0;

    // Find the latest end time across all regions
    tracks.forEach((track) => {
      track.regions.forEach((region) => {
        // 🔧 FIX: Handle all duration formats (number in beats OR MusicalPosition object)
        // durationToBeats() safely converts objects like {bars: 8, beats: 0} to total beats
        const durationInBeats = durationToBeats(region.duration);
        const regionDurationInSeconds = durationInBeats * secondsPerBeat;
        const regionEndTime = region.startTime + regionDurationInSeconds;

        // 🔧 FIX: Skip invalid durations that would produce NaN
        if (!isNaN(regionEndTime) && isFinite(regionEndTime)) {
          maxEndTime = Math.max(maxEndTime, regionEndTime);
        }
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

    const Tone = getTone();
    const currentTime = Tone.getTransport().seconds;

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
        const currentBpmForRegion = Tone.getTransport().bpm.value;
        const secondsPerBeat = 60 / currentBpmForRegion;
        // 🔧 FIX: Handle all duration formats (number in beats OR MusicalPosition object)
        const durationInBeats = durationToBeats(region.duration);
        const regionDurationInSeconds = durationInBeats * secondsPerBeat;

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
            // Main scheduler uses keys like: "${region.id}_${eventIndex}_loop${loopNum}"
            // We need to check for all possible loop variations
            const backupEventKey = `backup_${region.id}_${event.position}_${Math.floor(absoluteTime)}`;

            // Skip if already scheduled by main scheduler OR backup scheduler
            const trackEvents = scheduledEvents.get(trackId);

            // Check for main scheduler keys with any loop number (0-9 covers typical use cases)
            let hasMainKey = false;
            if (trackEvents) {
              for (let loopNum = 0; loopNum < 10; loopNum++) {
                if (
                  trackEvents.has(`${region.id}_${eventIndex}_loop${loopNum}`)
                ) {
                  hasMainKey = true;
                  break;
                }
              }
            }
            const hasBackupKey = trackEvents && trackEvents.has(backupEventKey);

            if (!hasMainKey && !hasBackupKey) {
              // Schedule it immediately - absoluteTime is in seconds
              const toneId = Tone.getTransport().schedule(
                (backupTime: number) => {
                  if (!isRunning) return;
                  // CRITICAL FIX: Use absoluteTime (intended time in seconds) not backupTime (Tone's lookahead time)
                  // Must match the main scheduling method to avoid timing drift
                  emitEvent(instrumentType, event, absoluteTime);
                },
                absoluteTime,
              );

              // Mark as scheduled to prevent duplicate scheduling
              // Use loop0 as the main event key (backup scheduler assumes loop 0)
              if (!scheduledEvents.has(trackId)) {
                scheduledEvents.set(trackId, new Set());
              }
              scheduledEvents
                .get(trackId)!
                .add(`${region.id}_${eventIndex}_loop0`);
              scheduledEvents.get(trackId)!.add(backupEventKey);
              scheduledIds.add(toneId);
            }
          }
        });
      });
    });
  }

  // ==========================================================================
  // LAUNCH-02.5b: infinite-loop audio-stem scheduling
  // ==========================================================================

  /**
   * Schedule an audio-stem region with `loopCount: 0` (infinite playback).
   *
   * Algorithm (pre-arm, no JS callback in the audio path):
   *  - Compute D = beats × secondsPerBeat from the LIVE BPM at schedule time.
   *  - Arm a sliding window of `WINDOW` upcoming iterations up front via
   *    `source.start(T0 + i*D, 0)` for i = 0..WINDOW-1. Web Audio handles
   *    the boundary timing sample-accurately — no callback to fire late.
   *  - As each iteration's source ends (`source.onended`), arm one more
   *    iteration at the far edge of the window using the LIVE BPM at that
   *    moment. So a tempo bump locks in one window-edge later — the same
   *    documented seam the MIDI scheduling path has.
   *  - Stop = `source.stop(stopAt)` on every entry; this cancels both
   *    already-playing and pending-start sources per Web Audio spec.
   *
   * Buffers self-loop seamlessly because consecutive `source.start(T0+iD, 0)`
   * calls produce sample-accurate continuity — no LOOKAHEAD, no crossfade,
   * no drift fallback.
   */
  private scheduleInfiniteAudioRegion(
    region: Region,
    trackId: string,
    instrumentType: string,
    transportStartTime: number,
    audioContext: AudioContext,
    audioStemAccess: InfiniteAudioStemAccess | undefined,
    resolvePendingBuffer: ResolvePendingBuffer | undefined,
  ): void {
    if (!audioStemAccess) {
      logger.debug(
        'scheduleInfiniteAudioRegion: audioStemAccess missing; skipping',
        { trackId, regionId: region.id, instrumentType },
      );
      return;
    }

    // `audio-bass` → `bass` etc.; cheap slice since the prefix is fixed.
    const stemKey = instrumentType.slice('audio-'.length);
    const initialStem = audioStemAccess.getStem(stemKey);
    if (!initialStem) {
      logger.debug('scheduleInfiniteAudioRegion: no stem registered yet', {
        trackId,
        regionId: region.id,
        stemKey,
      });
      return;
    }

    const T0 = transportStartTime + region.startTime;
    const initialDuration = this.computeIterationDuration(region);

    // Arm the initial window. WINDOW=3 means iter 0 is playing, iter 1
    // queued, iter 2 queued; when iter 0 ends, we arm iter 3, and so on.
    // 3 is enough to mask any onended jitter (well under one buffer length).
    for (let iter = 0; iter < INFINITE_AUDIO_WINDOW; iter++) {
      this.armInfiniteAudioIteration(
        region,
        stemKey,
        iter,
        T0 + iter * initialDuration,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
      );
    }

    logger.info('Infinite audio region scheduled', {
      trackId,
      regionId: region.id,
      instrumentType,
      stemKey,
      T0,
      durationSeconds: initialDuration,
      windowSize: INFINITE_AUDIO_WINDOW,
    });
  }

  /** Compute iteration duration in seconds from region.duration + live BPM. */
  private computeIterationDuration(region: Region): number {
    const Tone = getTone();
    const bpm = Tone.getTransport().bpm.value;
    const secondsPerBeat = 60 / bpm;
    return durationToBeats(region.duration) * secondsPerBeat;
  }

  /**
   * Arm a single infinite-audio iteration: create the source, schedule it
   * to start at `startAt`, register it in the entry map, and wire its
   * `onended` to refill the window with the next iteration at the live BPM.
   *
   * `startAt` is an absolute audio-context time. The buffer played is the
   * one currently registered for this stem (or whatever resolvePendingBuffer
   * returns for the LAUNCH-02.5d key-swap follow-up).
   */
  private armInfiniteAudioIteration(
    region: Region,
    stemKey: string,
    iter: number,
    startAt: number,
    audioContext: AudioContext,
    audioStemAccess: InfiniteAudioStemAccess,
    resolvePendingBuffer: ResolvePendingBuffer | undefined,
  ): void {
    const stem = audioStemAccess.getStem(stemKey);
    if (!stem) {
      logger.warn(
        'armInfiniteAudioIteration: stem no longer registered; loop will not refill',
        { regionId: region.id, stemKey, iter },
      );
      return;
    }
    const buffer =
      resolvePendingBuffer?.(region.id, iter) ?? stem.buffer ?? null;
    if (!buffer) {
      logger.warn(
        'armInfiniteAudioIteration: no buffer resolved; loop will not refill',
        { regionId: region.id, stemKey, iter },
      );
      return;
    }

    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(stem.gain);

    const entryKey = `${region.id}#${iter}`;
    // onended fires whether the source ended naturally or via stop().
    // Refill the window only if this entry is still tracked (a stop()
    // cleared the map; reading from a stale closure would create a runaway).
    source.onended = () => {
      const tracked = this.infiniteAudioRegions.get(entryKey);
      if (!tracked || tracked.source !== source) {
        return; // stopped or replaced — do not refill
      }
      this.infiniteAudioRegions.delete(entryKey);

      // Refill at iter + WINDOW. Anchor on the FURTHEST already-armed
      // iteration (iter + WINDOW - 1) so the new start time slots in
      // exactly one iteration past it — using the LIVE BPM only for THAT
      // one boundary. This keeps already-scheduled iterations aligned
      // with the old tempo and applies the new tempo from one window-edge
      // forward (same seam the MIDI scheduling path documents).
      const nextIter = iter + INFINITE_AUDIO_WINDOW;
      const anchorKey = `${region.id}#${nextIter - 1}`;
      const anchor = this.infiniteAudioRegions.get(anchorKey);
      // If the anchor is missing (e.g. it failed to arm), fall back to
      // chaining from THIS iteration's known startAt — loop stays alive.
      const anchorStartAt = anchor?.startAt ?? startAt;
      const iterationsFromAnchor = anchor ? 1 : INFINITE_AUDIO_WINDOW;
      const nextStartAt =
        anchorStartAt +
        iterationsFromAnchor * this.computeIterationDuration(region);

      this.armInfiniteAudioIteration(
        region,
        stemKey,
        nextIter,
        nextStartAt,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
      );
    };

    try {
      source.start(startAt, 0);
    } catch (err) {
      logger.warn('armInfiniteAudioIteration: source.start failed', {
        regionId: region.id,
        stemKey,
        iter,
        startAt,
        err,
      });
      return;
    }
    audioStemAccess.trackExternalSource(stemKey, source);
    this.infiniteAudioRegions.set(entryKey, {
      source,
      gain: stem.gain,
      iter,
      startAt,
    });
  }

  /**
   * Stop every active infinite-audio region.
   *
   * Drop entries from the map FIRST so any `onended` that races us sees a
   * missing entry and skips its refill (see armInfiniteAudioIteration).
   * Then ramp shared gain nodes to 0 (click-free) and call `source.stop()`
   * on each — this cancels both already-playing and pending-start sources
   * per Web Audio spec, so no Tone.Transport.clear is needed.
   */
  stopAllInfiniteAudio(audioContext: AudioContext | null): void {
    if (this.infiniteAudioRegions.size === 0) return;

    // Snapshot + clear the map first so racing onended callbacks bail.
    const entries = Array.from(this.infiniteAudioRegions.values());
    const count = entries.length;
    this.infiniteAudioRegions.clear();

    // De-dupe gain nodes — multiple iterations of the same stem share one
    // gain node, and applying the click-free ramp twice would double-write
    // the same AudioParam events.
    const seenGains = new Set<GainNode>();
    let stopAt = audioContext?.currentTime ?? 0;
    for (const entry of entries) {
      if (audioContext && !seenGains.has(entry.gain)) {
        seenGains.add(entry.gain);
        const result = applyClickFreeStop(entry.gain, audioContext, {
          onError: (err) =>
            logger.debug('stopAllInfiniteAudio: gain ramp failed', { err }),
        });
        stopAt = result.stopAt;
      }
      try {
        entry.source.stop(stopAt);
      } catch {
        // already stopped or pending-start cancelled — both fine
      }
    }

    logger.info('Infinite audio regions stopped', {
      count,
      instanceId: this.instanceId,
    });
  }
}
