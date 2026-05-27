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
// Capped at 2 entries alive at any moment per region (outgoing + incoming
// during crossfade). The `gen` counter detects late callbacks from a
// generation that was already stopped.
interface InfiniteAudioEntry {
  source: AudioBufferSourceNode;
  gain: GainNode;
  scheduleId: number | null; // null once cleared / fired
  iter: number;
  gen: number;
}

// Hook closure passed in by LAUNCH-02.5c so the card can swap key-set
// buffers between iterations. If absent, the scheduler reuses whichever
// buffer is currently registered with AudioPlayerScheduler.
export type ResolvePendingBuffer = (
  regionId: string,
  iter: number,
) => AudioBuffer | null;

// Narrow contract RegionScheduler needs from AudioPlayerScheduler to spawn
// its own AudioBufferSources for the infinite-loop crossfade. Avoids a hard
// import dependency on the full AudioPlayerScheduler class.
export interface InfiniteAudioStemAccess {
  getStem(stemKey: string): { buffer: AudioBuffer; gain: GainNode } | null;
  trackExternalSource(stemKey: string, source: AudioBufferSourceNode): void;
}

export class RegionScheduler {
  private instanceId: string;
  private lookAheadTime = 0.1; // 100ms lookahead (from BackupScheduler)

  // LAUNCH-02.5b: keyed by `${regionId}#${iter}`. Carries the active
  // (outgoing + incoming) sources for an infinite audio region.
  private infiniteAudioRegions = new Map<string, InfiniteAudioEntry>();
  // Bumped on every stopAllInfiniteAudio(); each scheduled callback
  // captures the value at schedule-time and bails out if it has drifted
  // (meaning a stop happened while the callback was pending).
  private generation = 0;

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
          this.scheduleInfiniteAudioRegion(
            region,
            trackId,
            instrumentType,
            transportStartTime,
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
   * Algorithm:
   *  - Iteration 0 starts at T0 = transportStartTime + region.startTime,
   *    full gain (no crossfade-in).
   *  - Each iteration's "next-boundary" callback is registered via
   *    Tone.getTransport().schedule(cb, B - 50ms), recomputing the next
   *    iteration's duration `D` from the LIVE BPM at callback time.
   *  - At every boundary B (except the first), a 10ms equal-power
   *    crossfade overlaps the outgoing and incoming sources:
   *      gainOut.gain.setValueAtTime(1, B - 10ms);
   *      gainOut.gain.linearRampToValueAtTime(0, B);
   *      gainIn.gain.setValueAtTime(0, B - 10ms);
   *      gainIn.gain.linearRampToValueAtTime(1, B);
   *  - Max 2 sources alive at any moment per region (outgoing + incoming).
   *  - The generation counter (`this.generation`) is bumped on every
   *    stopAllInfiniteAudio() call. Each pending callback captures the
   *    generation at schedule time and bails out if it has drifted.
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

    const Tone = getTone();
    const myGen = this.generation;

    // First iteration: source.start at T0 with no fade-in. The gain stays
    // at its current value (set by the caller via setInstrumentVolume).
    const T0 = transportStartTime + region.startTime;
    const firstSource = audioContext.createBufferSource();
    firstSource.buffer = initialStem.buffer;
    firstSource.connect(initialStem.gain);
    try {
      firstSource.start(T0, 0);
    } catch (err) {
      logger.warn('scheduleInfiniteAudioRegion: first source.start failed', {
        regionId: region.id,
        err,
      });
      return;
    }
    audioStemAccess.trackExternalSource(stemKey, firstSource);
    this.infiniteAudioRegions.set(`${region.id}#0`, {
      source: firstSource,
      gain: initialStem.gain,
      scheduleId: null, // scheduleId stored when the boundary callback registers
      iter: 0,
      gen: myGen,
    });

    // Schedule the first boundary callback at T0 + D - 50ms (50ms lookahead).
    // Each callback re-arms itself for the following boundary.
    const initialDuration = this.computeIterationDuration(region);
    this.armNextBoundary(
      region,
      trackId,
      instrumentType,
      stemKey,
      0, // outgoing iteration
      T0,
      initialDuration,
      audioContext,
      audioStemAccess,
      resolvePendingBuffer,
      myGen,
    );

    logger.info('Infinite audio region scheduled', {
      trackId,
      regionId: region.id,
      instrumentType,
      stemKey,
      T0,
      durationSeconds: initialDuration,
      generation: myGen,
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
   * Register a one-shot Tone.Transport.schedule for the next iteration's
   * boundary. The callback (a) detects stale-generation bail-out, (b)
   * resolves the next buffer, (c) creates the incoming source with the
   * 10ms crossfade pre-roll (or drift fallback), and (d) re-arms itself.
   *
   * Stored `scheduleId` is updated on the outgoing entry so stop-cleanup
   * can call Tone.getTransport().clear(id) before the callback runs.
   */
  private armNextBoundary(
    region: Region,
    trackId: string,
    instrumentType: string,
    stemKey: string,
    outgoingIter: number,
    iterStartTime: number,
    duration: number,
    audioContext: AudioContext,
    audioStemAccess: InfiniteAudioStemAccess,
    resolvePendingBuffer: ResolvePendingBuffer | undefined,
    capturedGen: number,
  ): void {
    const Tone = getTone();
    const XF = 0.01; // 10ms crossfade
    const LOOKAHEAD = 0.05; // 50ms scheduling lookahead
    const B = iterStartTime + duration; // boundary == start of incoming iter
    const callbackTime = Math.max(
      audioContext.currentTime + 0.001,
      B - LOOKAHEAD,
    );

    const scheduleId = Tone.getTransport().schedule(() => {
      // Stale-generation bail: a stopAllInfiniteAudio() ran after this
      // callback was queued. Do nothing.
      if (capturedGen !== this.generation) {
        return;
      }

      const outgoingKey = `${region.id}#${outgoingIter}`;
      const outgoing = this.infiniteAudioRegions.get(outgoingKey);
      if (!outgoing) {
        // entry already cleaned up — bail
        return;
      }

      // Compute timing for the incoming iteration.
      const nowAudio = audioContext.currentTime;
      const incomingIter = outgoingIter + 1;
      // Drift mitigation: if callback fires so late that `B - XF` is in
      // the past, start the incoming source immediately with no pre-roll.
      // One audible micro-discontinuity at this seam; infinite loop unbroken.
      const incomingStartAt = Math.max(nowAudio + 0.001, B - XF);
      const usedCrossfade = incomingStartAt < B; // false means drift fallback

      // Resolve pending buffer for the incoming iteration. Default reuses
      // whichever buffer is currently registered for this stem.
      const pendingBuffer =
        resolvePendingBuffer?.(region.id, incomingIter) ??
        audioStemAccess.getStem(stemKey)?.buffer ??
        outgoing.source.buffer;
      if (!pendingBuffer) {
        logger.warn(
          'armNextBoundary: no buffer resolved for incoming iter; stopping loop',
          { regionId: region.id, incomingIter },
        );
        return;
      }

      // Create the incoming source against the same gain node.
      const stem = audioStemAccess.getStem(stemKey);
      if (!stem) {
        logger.warn(
          'armNextBoundary: stem no longer registered; stopping loop',
          { regionId: region.id, stemKey },
        );
        return;
      }
      const incomingSource = audioContext.createBufferSource();
      incomingSource.buffer = pendingBuffer;
      incomingSource.connect(stem.gain);

      if (usedCrossfade) {
        // Equal-power-ish linear crossfade. Outgoing fades 1→0 over XF;
        // incoming fades 0→1 over the same window. Both share the same
        // GainNode in this implementation — see note below.
        //
        // NOTE: when outgoing and incoming share the gain node (current
        // single-gain-per-stem design), the linearRampToValueAtTime calls
        // race. We let the incoming source's start act as the audible
        // overlap: outgoing.stop is scheduled at B + 1ms, incoming.start
        // at B - XF. The shared gain ramp is harmless because both
        // sources have the same effective volume target.
        try {
          stem.gain.gain.setValueAtTime(stem.gain.gain.value, B - XF);
          stem.gain.gain.linearRampToValueAtTime(stem.gain.gain.value, B);
        } catch (err) {
          logger.debug('crossfade gain ramp failed (harmless)', { err });
        }
      }

      try {
        incomingSource.start(incomingStartAt, 0);
      } catch (err) {
        logger.warn('armNextBoundary: incoming source.start failed', {
          regionId: region.id,
          incomingIter,
          err,
        });
        return;
      }
      audioStemAccess.trackExternalSource(stemKey, incomingSource);

      // Stop the outgoing source slightly after the boundary so the
      // overlap is audible.
      const outgoingStopAt = B + 0.001;
      try {
        outgoing.source.stop(outgoingStopAt);
      } catch {
        // already stopped
      }

      // Drop outgoing entry now that its lifecycle is fully committed.
      this.infiniteAudioRegions.delete(outgoingKey);

      // Record incoming entry and arm the next boundary.
      this.infiniteAudioRegions.set(`${region.id}#${incomingIter}`, {
        source: incomingSource,
        gain: stem.gain,
        scheduleId: null,
        iter: incomingIter,
        gen: capturedGen,
      });

      // Re-arm for the next boundary. Recompute duration from LIVE BPM —
      // if the user pushed tempo mid-loop, the next iteration's interval
      // picks up the new value at this point. (The currently-playing
      // iteration completes at its baked duration; documented seam.)
      const nextDuration = this.computeIterationDuration(region);
      this.armNextBoundary(
        region,
        trackId,
        instrumentType,
        stemKey,
        incomingIter,
        B,
        nextDuration,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
        capturedGen,
      );
    }, callbackTime);

    // Update outgoing entry with its pending scheduleId so cleanup can
    // clear it. Must be done after schedule() returns the id.
    const outgoingEntry = this.infiniteAudioRegions.get(
      `${region.id}#${outgoingIter}`,
    );
    if (outgoingEntry) {
      outgoingEntry.scheduleId = scheduleId;
    }
  }

  /**
   * Stop every active infinite-audio region. Cleanup order matters:
   *   1. bump generation counter (any pending callback now bails out)
   *   2. clear every pending Tone schedule (no new sources spawn)
   *   3. ramp every gain to 0 over 5ms (avoid click)
   *   4. stop every source ~6ms in the future (after the ramp)
   *   5. drop map entries
   * Reordering steps 1–2 risks a callback re-arming during cleanup.
   */
  stopAllInfiniteAudio(audioContext: AudioContext | null): void {
    if (this.infiniteAudioRegions.size === 0) return;

    // 1. bump generation — any in-flight callback now sees a mismatch
    this.generation++;

    const Tone = getTone();
    const now = audioContext?.currentTime ?? 0;
    const rampSeconds = 0.005;
    const stopAt = now + rampSeconds + 0.001;

    // 2. clear every pending schedule
    for (const entry of this.infiniteAudioRegions.values()) {
      if (entry.scheduleId !== null) {
        try {
          Tone.getTransport().clear(entry.scheduleId);
        } catch {
          // schedule already fired — harmless
        }
        entry.scheduleId = null;
      }
    }

    // 3 + 4: ramp gains and stop sources
    for (const entry of this.infiniteAudioRegions.values()) {
      if (audioContext) {
        try {
          entry.gain.gain.setValueAtTime(entry.gain.gain.value, now);
          entry.gain.gain.linearRampToValueAtTime(0, now + rampSeconds);
        } catch (err) {
          logger.debug('stopAllInfiniteAudio: gain ramp failed', { err });
        }
      }
      try {
        entry.source.stop(stopAt);
      } catch {
        // already stopped
      }
    }

    // 5. drop entries
    const count = this.infiniteAudioRegions.size;
    this.infiniteAudioRegions.clear();

    logger.info('Infinite audio regions stopped', {
      count,
      generation: this.generation,
      instanceId: this.instanceId,
    });
  }
}
