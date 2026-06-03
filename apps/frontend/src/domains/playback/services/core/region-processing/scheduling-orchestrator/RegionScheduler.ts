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
import type { InfiniteAudioSource } from './InfiniteAudioSource.js';

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
  /** Optional bar-range loop (LAUNCH polish). When present, the infinite-
   *  audio path uses AudioBufferSourceNode.loop = true + native loopStart /
   *  loopEnd so the chosen buffer slice loops sample-accurately. Times are
   *  in seconds within the buffer. Only honored when `loopCount === 0` (the
   *  infinite-audio branch). */
  loopSlice?: {
    startSeconds: number;
    endSeconds: number;
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
  /** Region definition for this iteration. Kept so rearmFutureIterations
   *  can re-invoke armInfiniteAudioIteration without the caller having to
   *  re-resolve the region from tracks. Same reference for every iter of
   *  the same region. */
  region: Region;
  /** Stem key (e.g. 'bass') derived from instrumentType minus the
   *  'audio-' prefix. Stored at arm time so rearm doesn't have to parse
   *  it back out of the region id. */
  stemKey: string;
  /** Per-iter crossfade GainNode if one was inserted at arm time, or
   *  null when the source was connected directly to stem.input (no
   *  crossfade in effect when this iter was armed). Stored so a
   *  later routing change can retroactively add or modify the fade
   *  envelope on the currently-playing iter — preventing the
   *  asymmetric-crossfade spike on the first default→pitched
   *  transition. */
  perIterGain: GainNode | null;
  /** The node the source was connected to at arm time. Either
   *  `perIterGain` (when crossfade was active at arm time) or
   *  `stem.input` (when direct routing was active). Used by the
   *  retroactive fade-out wrap to know what to disconnect from. */
  connectedTarget: AudioNode;
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
//
// `input` is the upstream connect target — equals `gain` for stems with no
// pre-gain processing, or the input of a Tone.PitchShift node for the
// bass + harmony stems (LAUNCH-02.5c). Click-free stops still ramp `gain`
// (the real GainNode) downstream of any pre-processing.
export interface InfiniteAudioStemAccess {
  getStem(
    stemKey: string,
  ): { buffer: AudioBuffer; input: AudioNode; gain: GainNode } | null;
  trackExternalSource(stemKey: string, source: AudioBufferSourceNode): void;
}

export class RegionScheduler {
  private instanceId: string;
  private lookAheadTime = 0.1; // 100ms lookahead (from BackupScheduler)

  // LAUNCH-02.5b: keyed by `${regionId}#${iter}`. Carries the pre-armed
  // sources for an infinite audio region's sliding window (typically 2-3
  // upcoming iterations). source.onended on iter N refills iter N+WINDOW.
  private infiniteAudioRegions = new Map<string, InfiniteAudioEntry>();

  // LAUNCH-02.5c key-shift: crossfade duration between adjacent
  // iterations. When > 0, each iteration's source feeds the stem
  // through its own per-iter GainNode that fades in over the first N
  // seconds and out over the last N seconds. Combined with the
  // pre-roll on rearmed iterations (which makes iter N+1 start N
  // seconds before iter N ends), this turns the additive sum of two
  // sources into a true equal-power crossfade — eliminating the
  // pitch-engine seam spike that would otherwise be audible at every seam.
  //
  // Value 0 (default) keeps the historical raw-additive behaviour for
  // any code path that hasn't opted in.
  private interIterCrossfadeSeconds = 0;

  // Time-stretch (LAUNCH-06): self-looping buffer-streaming sources for
  // bass/harmony (signalsmith). Unlike the windowed ABSN map above, ONE
  // source per stem plays for the whole play→stop lifetime — it loops
  // internally, so there's no window, no onended refill, no rearm. The
  // engine registers the resolved source (keyed by stemKey, e.g. 'bass')
  // BEFORE scheduling; scheduleInfiniteAudioRegion arms it (one start) and
  // stopAllInfiniteAudio stops it. Tempo/key changes are live schedule()
  // calls on the source (applyRate/applySemitones), not re-arms.
  private selfLoopingSources = new Map<string, InfiniteAudioSource>();

  // The current stretch ratio R (currentBpm / originalBpm). Applied to
  // drum ABSN sources at arm time (their playbackRate) and forwarded to the
  // SoundTouch insert; bass/harmony get it via applyRate on their source.
  private tempoRatio = 1;

  // Time-stretch (LAUNCH-06): the MUSICAL loop length (buffer seconds, at
  // originalBpm) the groove-card stems loop on. When > 0, the DRUM stem loops
  // as ONE native-loop source clamped to [0, this] (instead of the windowed
  // multi-iteration path) so it stays beat-locked to bass/harmony — which
  // loop internally on the same length. 0 = no card active → drums use the
  // windowed path as before. Set by PlaybackEngine.setStemLoopDuration.
  private stemLoopDurationSeconds = 0;

  // Time-stretch (LAUNCH-06): signalsmith's audible latency (s). bass/harmony
  // self-looping sources are STARTED this much earlier so their latency-
  // delayed output lands on the (near-zero-latency) drum grid. 0 = unknown.
  private stretchLatencySeconds = 0;

  // Time-stretch (LAUNCH-06): the per-call context captured when the drum
  // single-loop source is armed, so a tempo change can stop + re-arm that ONE
  // source at the shared boundary with the new playbackRate (an ABSN can't
  // change rate in place). Null until the drum loop is armed.
  private drumLoopContext: {
    region: Region;
    stemKey: string;
    audioContext: AudioContext;
    audioStemAccess: InfiniteAudioStemAccess;
    resolvePendingBuffer: ResolvePendingBuffer | undefined;
    entryKey: string;
  } | null = null;

  constructor(instanceId: string) {
    this.instanceId = instanceId;
  }

  /**
   * Register (or clear, when `source` is null) the self-looping
   * buffer-streaming source for a stem. Called by PlaybackEngine once the
   * stem's signalsmith node is created. The scheduler arms it on the next
   * scheduleInfiniteAudioRegion for that stem and stops it on stopAll.
   */
  setSelfLoopingSource(
    stemKey: string,
    source: InfiniteAudioSource | null,
  ): void {
    if (source) this.selfLoopingSources.set(stemKey, source);
    else this.selfLoopingSources.delete(stemKey);
  }

  /**
   * Set the current time-stretch ratio. Bass/harmony are driven via their
   * source's applyRate (boundary-deferred) by the engine; the scheduler
   * stores R so drum iterations arm at the new playbackRate.
   */
  setTempoRatio(ratio: number): void {
    this.tempoRatio = ratio > 0 ? ratio : 1;
  }

  /** Time-stretch (LAUNCH-06): musical loop length (buffer seconds) drums
   *  loop on as a single native-loop source. See the field doc. */
  setStemLoopDuration(seconds: number): void {
    this.stemLoopDurationSeconds = seconds > 0 ? seconds : 0;
  }

  /** Time-stretch (LAUNCH-06): signalsmith's audible latency (s). bass/harmony
   *  play THROUGH signalsmith so their audio emerges this much AFTER their
   *  scheduled start; we pull their START earlier by this so the audible
   *  output lands on the drum grid. Set by PlaybackEngine once measured. */
  setStretchLatency(seconds: number): void {
    this.stretchLatencySeconds = seconds > 0 ? seconds : 0;
  }

  /**
   * [LAUNCH-06 DEBUG] Empirical drum-loop phase: where in the buffer the drum
   * source actually is right now, in BUFFER seconds (i.e. accounting for
   * playbackRate). Returns null if the drum single-loop isn't armed. Used by
   * the engine's drift sampler to compare against bass/harmony inputTime.
   */
  debugDrumLoopPhase(now: number): {
    phase: number;
    startAt: number;
    playbackRate: number;
    loopLen: number;
  } | null {
    const ctx = this.drumLoopContext;
    if (!ctx) return null;
    const entry = this.infiniteAudioRegions.get(ctx.entryKey);
    if (!entry) return null;
    const rate = entry.source?.playbackRate?.value ?? 1;
    const loopLen = this.stemLoopDurationSeconds;
    if (loopLen <= 0) return null;
    // Buffer position advances at `rate` buffer-seconds per real second,
    // wrapping every loopLen buffer-seconds.
    const elapsed = Math.max(0, now - entry.startAt);
    const phase = (elapsed * rate) % loopLen;
    return { phase, startAt: entry.startAt, playbackRate: rate, loopLen };
  }

  /**
   * Time-stretch (LAUNCH-06): re-arm the single drum-loop source at `boundary`
   * with the CURRENT tempoRatio (set via setTempoRatio just before this). The
   * playing drum source can't change playbackRate in place, so we stop it at
   * the boundary and start a fresh one there — at the SAME instant bass/harmony
   * apply their rate change, keeping all three locked. No-op if the drum loop
   * isn't armed (e.g. windowed-path drums, or not playing). Returns true if it
   * re-armed.
   */
  rearmDrumLoopAtBoundary(boundary: number): boolean {
    const ctx = this.drumLoopContext;
    if (!ctx) return false;
    const entry = this.infiniteAudioRegions.get(ctx.entryKey);
    if (!entry) return false;

    // Stop the current drum source AT the boundary (it keeps playing the old
    // tempo until then, finishing the current loop cleanly), and drop it from
    // the map FIRST so nothing else touches it.
    this.infiniteAudioRegions.delete(ctx.entryKey);
    try {
      entry.source.stop(boundary);
    } catch {
      // already stopped — fine
    }

    // Arm a fresh single-loop drum source starting exactly at the boundary;
    // armInfiniteAudioIteration reads the (already-updated) tempoRatio and
    // sets the new playbackRate on it.
    this.armInfiniteAudioIteration(
      ctx.region,
      ctx.stemKey,
      0,
      boundary,
      ctx.audioContext,
      ctx.audioStemAccess,
      ctx.resolvePendingBuffer,
    );
    logger.info('Drum single-loop re-armed at boundary', {
      boundary,
      tempoRatio: this.tempoRatio,
      instanceId: this.instanceId,
    });
    return true;
  }

  /**
   * Time-stretch (LAUNCH-06, Model C): change the playing drum loop's tempo
   * LIVE, mid-loop, WITHOUT recreating the source. `AudioBufferSourceNode.
   * playbackRate` is a fully automatable AudioParam — set it at `atTime` and
   * the native loop keeps running at the new speed from there. The SoundTouch
   * insert's `playbackRate` param (driven by the engine) cancels the pitch.
   * Updates the stored `tempoRatio` so the scheduler's seam projection
   * (nextIterationBoundary) uses the new period. No-op if the drum loop isn't
   * armed. Returns true if applied.
   */
  /** The currently-playing drum single-loop AudioBufferSourceNode, or null.
   *  Used by the engine to reconnect it live when splicing the WSOLA insert. */
  getDrumLoopSource(): AudioBufferSourceNode | null {
    const ctx = this.drumLoopContext;
    if (!ctx) return null;
    const entry = this.infiniteAudioRegions.get(ctx.entryKey);
    return entry?.source ?? null;
  }

  setDrumLoopRateLive(ratio: number, atTime: number): boolean {
    this.tempoRatio = ratio > 0 ? ratio : 1;
    const ctx = this.drumLoopContext;
    if (!ctx) return false;
    const entry = this.infiniteAudioRegions.get(ctx.entryKey);
    if (!entry) return false;
    try {
      const pr = entry.source.playbackRate;
      pr.cancelScheduledValues?.(atTime);
      pr.setValueAtTime(this.tempoRatio, atTime);
    } catch {
      // best-effort — if the param write fails the drum keeps its old rate
      return false;
    }
    return true;
  }

  /**
   * Time-stretch (LAUNCH-06): the authoritative next loop-seam audio time for
   * a region — the soonest pre-armed iteration `startAt` strictly after `now`.
   * This is the scheduler's GROUND TRUTH for where the current loop ends, used
   * to apply a tempo change to ALL stems at the SAME instant (drums re-arm at
   * this seam; bass/harmony schedule their rate change at the same seam) so
   * they never drift apart. Returns null if the region has no future-armed
   * iteration (e.g. a self-looping-only region, or not playing).
   *
   * `regionId` matches the windowed entries (drums); we read the drum region's
   * seam because it's the ABSN clock we can observe. bass/harmony loop the
   * same musical length from the same T0, so this seam is theirs too.
   */
  nextIterationBoundary(regionId: string, now: number): number | null {
    const matchPrefix = `${regionId}#`;

    // Single-loop drum (LAUNCH-06): ONE native-loop entry whose startAt is the
    // original T0 (now in the past). Its seams recur every musical loop, so
    // project the next one: T0 + ceil((now - T0)/loopLen) * loopLen. The loop
    // length must account for the current stretch (a slowed loop's real period
    // is loopLen/R).
    if (this.stemLoopDurationSeconds > 0) {
      for (const [entryKey, entry] of this.infiniteAudioRegions.entries()) {
        if (!entryKey.startsWith(matchPrefix)) continue;
        if (!entry.region.loopSlice) continue; // only the synthetic single-loop
        const realLoop = this.stemLoopDurationSeconds / (this.tempoRatio || 1);
        if (realLoop <= 0) break;
        const elapsed = now - entry.startAt;
        const loopsDone = elapsed <= 0 ? 0 : Math.ceil(elapsed / realLoop);
        return entry.startAt + loopsDone * realLoop;
      }
    }

    // Windowed path: the soonest pre-armed iteration startAt strictly > now.
    let soonest = Infinity;
    for (const [entryKey, entry] of this.infiniteAudioRegions.entries()) {
      if (!entryKey.startsWith(matchPrefix)) continue;
      if (entry.startAt > now && entry.startAt < soonest) {
        soonest = entry.startAt;
      }
    }
    return Number.isFinite(soonest) ? soonest : null;
  }

  /**
   * Update the per-iteration crossfade duration. Should be called
   * whenever the rearm pre-roll changes so the crossfade matches the
   * overlap window. PlaybackEngine drives this in lockstep with its
   * `currentRearmPreRollSeconds` tracking.
   */
  setInterIterCrossfadeSeconds(seconds: number): void {
    this.interIterCrossfadeSeconds = Math.max(0, seconds);
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

    const requestedT0 = transportStartTime + region.startTime;
    const initialDuration = this.computeIterationDuration(region);

    // Shift T0 to the future BEFORE spreading WINDOW iterations. When the
    // engine re-schedules mid-playback (Groove Card loop-selection swap),
    // its stored transportStartTime is from the original play() and is now
    // in the past. Without this shift, the per-iteration clamp downstream
    // collapses iter 0/1/2 onto the same time, producing a 14s gap until
    // onended refills. Shifting once here preserves the WINDOW spread.
    const T0 = Math.max(requestedT0, audioContext.currentTime);
    // eslint-disable-next-line no-console
    console.log('[TS-T0]', {
      stemKey,
      transportStartTime: Number(transportStartTime.toFixed(3)),
      regionStartTime: Number(region.startTime.toFixed(3)),
      requestedT0: Number(requestedT0.toFixed(3)),
      now: Number(audioContext.currentTime.toFixed(3)),
      T0: Number(T0.toFixed(3)),
      clampedToNow: T0 > requestedT0,
    });

    // Time-stretch (LAUNCH-06): self-looping buffer-streaming source branch.
    // bass/harmony run as ONE signalsmith node that plays its own buffer and
    // loops internally — so it needs neither the windowed pre-arm nor the
    // loopSlice native-loop ABSN. Arm it once (single start at T0, reading
    // from the slice offset if a loop-selection is active) and return; the
    // worklet handles looping, and tempo/key are live schedule() calls.
    const selfLooping = this.selfLoopingSources.get(stemKey);
    if (selfLooping) {
      const offset = region.loopSlice ? region.loopSlice.startSeconds : 0;
      // LATENCY ALIGNMENT: bass/harmony play THROUGH the signalsmith worklet,
      // which buffers ~one processing window before it emits — so a source told
      // to start at T0 doesn't make sound until T0 + stretchLatencySeconds,
      // dragging behind the (zero-latency) drum grid. Because the stems are
      // fully-loaded buffers on a known timeline, we compensate at schedule time
      // by STARTING THEM EARLIER by exactly that latency, so their first sample
      // emerges ON T0 with the drums. Clamp to now+ε so the very first play
      // (T0 ≈ now + lookahead) can't ask for a past start.
      const pulled = T0 - this.stretchLatencySeconds;
      const startAt = Math.max(audioContext.currentTime + 0.005, pulled);
      try {
        selfLooping.start(startAt, offset);
      } catch (err) {
        logger.warn('scheduleInfiniteAudioRegion: self-looping start failed', {
          trackId,
          regionId: region.id,
          stemKey,
          err,
        });
      }
      logger.info('Infinite audio region scheduled (self-looping stretch)', {
        trackId,
        regionId: region.id,
        instrumentType,
        stemKey,
        T0,
        startAt,
        latencyPulled: this.stretchLatencySeconds,
        offset,
        loopSlice: region.loopSlice ?? null,
      });
      return;
    }

    // Time-stretch (LAUNCH-06): drum single-loop branch. When a groove card is
    // active (stemLoopDurationSeconds > 0) and there's no explicit bar-range
    // selection, the DRUM stem loops as ONE native-loop source clamped to the
    // musical length [0, stemLoopDurationSeconds] — exactly the length
    // bass/harmony loop on internally — so all three stay beat-locked. This
    // replaces the WINDOW=3 path for drums (whose per-iteration startAt
    // spacing didn't re-time on tempo change, causing drift). We synthesize a
    // full-loop `loopSlice` so it flows through the same stable single-source
    // arm as a bar selection (native loop=true, skipped by windowed rearm).
    if (
      stemKey === 'drums' &&
      this.stemLoopDurationSeconds > 0 &&
      !region.loopSlice
    ) {
      const drumRegion: Region = {
        ...region,
        loopSlice: {
          startSeconds: 0,
          endSeconds: this.stemLoopDurationSeconds,
        },
      };
      // Capture the context so a tempo change can re-arm THIS one source at a
      // boundary (ABSN playbackRate can't change in place).
      this.drumLoopContext = {
        region: drumRegion,
        stemKey,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
        entryKey: `${drumRegion.id}#0`,
      };
      this.armInfiniteAudioIteration(
        drumRegion,
        stemKey,
        0,
        T0,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
      );
      logger.info(
        'Infinite audio region scheduled (drum single-loop stretch)',
        {
          trackId,
          regionId: region.id,
          instrumentType,
          stemKey,
          T0,
          loopEnd: this.stemLoopDurationSeconds,
        },
      );
      return;
    }

    // Bar-range loop branch: ONE source with AudioBufferSourceNode.loop =
    // true + native loopStart/loopEnd. No window, no onended refill —
    // native loop runs forever until source.stop() in stopAllInfiniteAudio.
    if (region.loopSlice) {
      this.armInfiniteAudioIteration(
        region,
        stemKey,
        0,
        T0,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
      );
      logger.info('Infinite audio region scheduled (loop slice)', {
        trackId,
        regionId: region.id,
        instrumentType,
        stemKey,
        T0,
        loopSlice: region.loopSlice,
      });
      return;
    }

    // Full-buffer infinite loop: arm the initial window. WINDOW=3 means
    // iter 0 is playing, iter 1 queued, iter 2 queued; when iter 0 ends,
    // we arm iter 3, and so on. 3 is enough to mask any onended jitter
    // (well under one buffer length).
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
    const entryKey = `${region.id}#${iter}`;
    const slice = region.loopSlice;

    // Configure loop properties BEFORE assigning the buffer + connecting +
    // calling start(). Chrome/Safari have historical bugs where setting
    // loop/loopStart/loopEnd after buffer assignment is ignored. Order:
    //   1. loop flags
    //   2. buffer assignment
    //   3. connect
    //   4. start
    if (slice) {
      source.loop = true;
      source.loopStart = slice.startSeconds;
      source.loopEnd = slice.endSeconds;
    }

    source.buffer = buffer;

    // Time-stretch (LAUNCH-06): drive the DRUM source's playbackRate to the
    // current stretch ratio. The drum stem streams through a SoundTouch
    // (WSOLA) insert that cancels the resulting pitch shift, so drums change
    // tempo with pitch preserved. Only the drum stem stretches — click stays
    // at native rate. Bass/harmony never reach here (self-looping branch).
    if (stemKey === 'drums' && this.tempoRatio !== 1) {
      try {
        source.playbackRate.value = this.tempoRatio;
      } catch {
        /* best-effort — falls back to native rate */
      }
    }

    // LAUNCH-02.5c key-shift: per-iteration crossfade GainNode.
    //
    // Only applied when (a) the stem routes through a pitch-shift node
    // (detected via stem.input !== stem.gain — drums and click connect
    // direct, bass and harmony go through the pitch-shift engine), (b)
    // we're not in a loopSlice (slice mode uses ONE source so there's
    // nothing to crossfade), and (c) the crossfade window is > 0 (which
    // the engine sets when pitch shift is active so there IS an overlap
    // window between iters to crossfade across).
    //
    // Why not for drums/click: they connect direct to gain, so two
    // overlapping iters sum the same way at the gain stage but the
    // gain is downstream of the pitch-engine pipeline that produces
    // the pitch-shift artifact — drums don't go through that pipeline at
    // all, so they don't spike. Applying the crossfade to drums would just
    // dip the kick drum at every loop seam without fixing any problem.
    const routesThroughProcessor = stem.input !== stem.gain;
    const xfade =
      !slice && routesThroughProcessor ? this.interIterCrossfadeSeconds : 0;
    let perIterGain: GainNode | null = null;
    if (xfade > 0) {
      perIterGain = audioContext.createGain();
      perIterGain.connect(stem.input);
      source.connect(perIterGain);

      // Equal-power crossfade approximated with linear ramps. The
      // fade-in is suppressed on iter 0 (no previous iter to crossfade
      // from); for iter >= 1 it ramps 0 → 1 over the first `xfade`
      // seconds. The fade-out always runs over the last `xfade`
      // seconds before the seam to the next iter (startAt + iterDur).
      const iterDur = this.computeIterationDuration(region);
      const seamAt = startAt + iterDur;
      const param = perIterGain.gain;
      try {
        if (iter === 0) {
          // Iter 0: jump to full gain at start.
          param.setValueAtTime(1, startAt);
        } else {
          // Iter >= 1: fade in over the overlap window with the prior
          // iter (which is already fading out).
          param.setValueAtTime(0, startAt);
          param.linearRampToValueAtTime(1, startAt + xfade);
        }
        // Fade out over the last `xfade` seconds before the seam.
        // setValueAtTime anchors the param at 1 so the ramp starts
        // from a known value (otherwise it would interpolate from
        // whatever value was scheduled previously — which is fine in
        // theory but explicit is safer with overlapping schedules).
        param.setValueAtTime(1, Math.max(startAt, seamAt - xfade));
        param.linearRampToValueAtTime(0, seamAt);
      } catch (err) {
        // AudioParam scheduling can throw if the times are in the
        // past or violate ordering rules. Best-effort; fall through
        // to playing at unit gain (the raw additive behaviour).
        logger.debug('armInfiniteAudioIteration: crossfade schedule failed', {
          regionId: region.id,
          iter,
          err,
        });
      }
    } else {
      source.connect(stem.input);
    }

    if (!slice) {
      // Full-buffer window branch: one buffer = one iteration. onended
      // refills iter + WINDOW from the live BPM. See refill rationale in
      // the LOOP-GAP fix commit.
      source.onended = () => {
        const tracked = this.infiniteAudioRegions.get(entryKey);
        if (!tracked || tracked.source !== source) {
          return; // stopped or replaced — do not refill
        }
        this.infiniteAudioRegions.delete(entryKey);

        const nextIter = iter + INFINITE_AUDIO_WINDOW;
        const anchorKey = `${region.id}#${nextIter - 1}`;
        const anchor = this.infiniteAudioRegions.get(anchorKey);
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
    }

    try {
      // No per-iteration clamp: scheduleInfiniteAudioRegion shifts T0 to
      // the future BEFORE spreading WINDOW iterations, so every startAt
      // passed here is already >= audioContext.currentTime. Clamping per-
      // iteration would collapse the WINDOW spread on mid-play re-schedules
      // and produce a multi-second silent gap (regression in the toggle-off
      // path; covered by the "toggle OFF mid-play" test).
      source.start(startAt, slice ? slice.startSeconds : 0);
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
      region,
      stemKey,
      perIterGain,
      connectedTarget: perIterGain ?? stem.input,
    });
  }

  /**
   * LAUNCH-02.5c key-shift — partial tear-down + re-arm for pre-armed
   * iterations whose `startAt` is strictly in the future. Used when the
   * resolver's output is about to change (e.g. user taps the key stepper):
   * the currently-playing iteration must keep going (you can't rewrite an
   * in-flight buffer), but iterations N+1 .. N+WINDOW-1 still hold the
   * OLD buffer — without this re-arm, the soonest moment the new buffer
   * plays is iter N+WINDOW (up to ~22s at 130 BPM × 4 bars). With this
   * re-arm: only the playing iter remains stale; the next iter honors
   * the new resolver.
   *
   * Mechanism mirrors stopAllInfiniteAudio's discipline:
   *   1. Snapshot the entries to rearm and DELETE them from the map FIRST
   *      so any racing `onended` sees a missing entry and skips its
   *      refill (the same guard as stopAllInfiniteAudio).
   *   2. source.stop(now) on each — no click-free ramp; these sources
   *      haven't started yet (their startAt is in the future), so they
   *      simply never produce audio.
   *   3. Call armInfiniteAudioIteration with the SAME startAt and iter
   *      so timing is preserved; the new closure captures the latest
   *      resolver via the audioStemAccess + resolvePendingBuffer args.
   *
   * Scope: full-buffer iterations only. The loopSlice branch (native
   * `source.loop = true`) is NOT handled here — slices arm exactly one
   * source whose startAt is in the past once playback begins, so every
   * entry would fall into the "currently playing, do not touch" branch.
   * Slice-mode key swaps need a different mechanism (tear-down at the
   * next bar boundary) that lives in the hook layer, not here.
   *
   * Returns the number of iterations re-armed (0 if the region isn't
   * active, or if all entries are currently playing).
   */
  rearmFutureIterations(
    regionId: string,
    audioContext: AudioContext,
    audioStemAccess: InfiniteAudioStemAccess | undefined,
    resolvePendingBuffer: ResolvePendingBuffer | undefined,
    options?: { preRollSeconds?: number },
  ): number {
    if (!audioStemAccess) return 0;
    if (this.infiniteAudioRegions.size === 0) return 0;

    const now = audioContext.currentTime;
    const matchPrefix = `${regionId}#`;
    // LAUNCH-02.5c key-shift: shift the rearmed source.start time by
    // this DELTA (positive = earlier, negative = later) relative to
    // each existing entry's `startAt`. The caller is responsible for
    // computing the right delta:
    //   - default → pitched: +0.12 (route through the pitch-shift engine
    //     with ~120ms processing delay → start 120ms earlier so output
    //     emerges at the natural seam)
    //   - pitched → pitched: 0 (existing pre-roll already correct;
    //     don't compound it)
    //   - pitched → default: -0.12 (existing pre-roll no longer
    //     needed → push start 120ms later to land on natural seam)
    // The clamp `now + 0.001` only blocks scheduling a source.start
    // in the past — the delta itself is allowed to be negative.
    const preRollDeltaSeconds = options?.preRollSeconds ?? 0;

    // Snapshot entries that (a) match this region and (b) haven't started
    // yet. We deliberately exclude entries whose startAt has already
    // passed — that's the currently-audible iter (or one mid-buffer)
    // which cannot be rewritten without an audible glitch.
    type SnapshotEntry = {
      entryKey: string;
      iter: number;
      startAt: number;
      region: Region;
      stemKey: string;
      source: AudioBufferSourceNode;
    };
    const toRearm: SnapshotEntry[] = [];
    let currentlyPlayingEntry: InfiniteAudioEntry | null = null;
    let currentlyPlayingEndAt = 0;
    for (const [entryKey, entry] of this.infiniteAudioRegions.entries()) {
      if (!entryKey.startsWith(matchPrefix)) continue;
      // Skip loopSlice entries — they arm exactly one source whose
      // startAt is set at play start and may now be in the past. Even
      // when it's in the future, native loop=true semantics mean a
      // re-arm wouldn't behave correctly without bar-boundary
      // coordination from the hook.
      if (entry.region.loopSlice) continue;
      if (entry.startAt <= now) {
        // Currently playing — capture it so we can retroactively wrap
        // it with a fade-out gain (see below).
        const endAt =
          entry.startAt + this.computeIterationDuration(entry.region);
        if (endAt > now) {
          currentlyPlayingEntry = entry;
          currentlyPlayingEndAt = endAt;
        }
        continue;
      }
      toRearm.push({
        entryKey,
        iter: entry.iter,
        startAt: entry.startAt,
        region: entry.region,
        stemKey: entry.stemKey,
        source: entry.source,
      });
    }

    if (toRearm.length === 0 && !currentlyPlayingEntry) return 0;

    // LAUNCH-02.5c key-shift — retroactive fade-out wrap on the
    // currently-playing iter. When the rearm transitions to a state
    // where future iters will have a per-iter fade-in gain (xfade > 0
    // after this call), the CURRENT iter typically has NO per-iter
    // gain wrapper because it was armed in a different routing state.
    // Without this, the seam between current iter N and rearmed iter
    // N+1 is asymmetric: iter N ends abruptly at full volume, iter
    // N+1 fades in from 0 → audible step discontinuity at the seam
    // that the user hears as a "spike" on the first default→pitched
    // transition.
    //
    // Fix: if the current iter has no perIterGain AND the new
    // crossfade window will be > 0, splice a GainNode between its
    // source and the destination it's currently connected to,
    // schedule a fade-out over the last `interIterCrossfadeSeconds`
    // before its natural end.
    if (
      currentlyPlayingEntry &&
      currentlyPlayingEntry.perIterGain === null &&
      this.interIterCrossfadeSeconds > 0
    ) {
      try {
        const xfade = this.interIterCrossfadeSeconds;
        const fadeOutStart = Math.max(now, currentlyPlayingEndAt - xfade);
        const newGain = audioContext.createGain();
        newGain.gain.setValueAtTime(1, now);
        newGain.gain.setValueAtTime(1, fadeOutStart);
        newGain.gain.linearRampToValueAtTime(0, currentlyPlayingEndAt);
        // Reroute: source → newGain → connectedTarget. Web Audio
        // allows mid-flight topology changes on running sources.
        const oldTarget = currentlyPlayingEntry.connectedTarget;
        try {
          currentlyPlayingEntry.source.disconnect(oldTarget);
        } catch {
          // disconnect can throw if not connected to oldTarget for some
          // reason; fall back to a blanket disconnect.
          try {
            currentlyPlayingEntry.source.disconnect();
          } catch {
            // give up — best effort
          }
        }
        currentlyPlayingEntry.source.connect(newGain);
        newGain.connect(oldTarget);
        // Update the entry so future code (e.g. another rearm before
        // this iter ends) knows it now has a per-iter gain.
        currentlyPlayingEntry.perIterGain = newGain;
        currentlyPlayingEntry.connectedTarget = newGain;
        logger.info('Retroactive fade-out wrap applied to current iter', {
          regionId,
          iter: currentlyPlayingEntry.iter,
          fadeOutStart,
          endAt: currentlyPlayingEndAt,
        });
      } catch (err) {
        logger.warn('Retroactive fade-out wrap failed', {
          regionId,
          err,
        });
      }
    }

    if (toRearm.length === 0) return 0;

    // Step 1: drop all entries from the map BEFORE stopping the sources,
    // so any onended that fires between the stop and the rearm finds no
    // tracked entry and bails (the existing guard at armInfiniteAudio-
    // Iteration's onended).
    for (const item of toRearm) {
      this.infiniteAudioRegions.delete(item.entryKey);
    }

    // Step 2: stop the stale sources. No click-free ramp needed —
    // startAt is strictly > now, so these never produced audio.
    for (const item of toRearm) {
      try {
        item.source.stop(now);
      } catch {
        // already stopped — ignore
      }
    }

    // Step 3: re-arm each iteration. The new closure captures the
    // current resolver. Future onended refills (iter + WINDOW, etc.)
    // close over the same fresh resolver.
    //
    // Shift startAt by `preRollDeltaSeconds`. Positive delta moves
    // the source.start EARLIER (downstream processor sees input
    // sooner); negative delta moves it LATER (removing prior pre-roll
    // when going back to direct routing). Clamp to `now + 0.001` so
    // source.start is never in the past, but otherwise allow either
    // sign.
    for (const item of toRearm) {
      const shiftedStartAt =
        preRollDeltaSeconds !== 0
          ? Math.max(now + 0.001, item.startAt - preRollDeltaSeconds)
          : item.startAt;
      this.armInfiniteAudioIteration(
        item.region,
        item.stemKey,
        item.iter,
        shiftedStartAt,
        audioContext,
        audioStemAccess,
        resolvePendingBuffer,
      );
    }

    logger.info('Future iterations re-armed', {
      regionId,
      count: toRearm.length,
      preRollDeltaSeconds,
      instanceId: this.instanceId,
    });
    return toRearm.length;
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
  /**
   * @param rampSeconds gain fade-out length. Default 0.03 (full stop). Pass a
   *   tiny value (or 0) for a SEAMLESS SWAP — a tempo rebuild stops the old
   *   loop at its seam and immediately re-arms the new one into the SAME
   *   shared gain; a 30ms fade-to-zero would catch the new loop's downbeat
   *   (the kick) and silence it. A ~0 ramp keeps the gain at resting so the
   *   new audio plays at full volume; the old source stops at the loop seam
   *   where the audio wraps anyway, so the hard stop is click-safe.
   */
  stopAllInfiniteAudio(
    audioContext: AudioContext | null,
    rampSeconds = 0.03,
  ): void {
    // Time-stretch (LAUNCH-06): the drum single-loop context is stale once we
    // stop — clear it so a re-arm after a fresh play can't target a dead entry.
    this.drumLoopContext = null;

    // Time-stretch (LAUNCH-06): stop the self-looping sources (bass/harmony +
    // the drum slice player) at `now + rampSeconds` for a full stop, so they
    // keep producing audio THROUGH the PlaybackEngine's master-bus fade (which
    // ramps the whole mix to 0 over the same window) and only halt once the
    // master is silent — click-free regardless of each source's teardown
    // mechanics. For a seamless seam swap (rampSeconds ~0) they stop at `now`
    // (the loop wraps there, so it's click-safe) and the new loop re-arms.
    if (this.selfLoopingSources.size > 0) {
      const stopAt =
        (audioContext?.currentTime ?? 0) + Math.max(0, rampSeconds);
      for (const source of this.selfLoopingSources.values()) {
        try {
          source.stop(stopAt);
        } catch {
          // already stopped / pending-start cancelled — fine
        }
      }
      this.selfLoopingSources.clear();
    }

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
    // Seamless-swap path: rampSeconds ~0 means DON'T fade the shared gain (it
    // would silence the new loop's downbeat re-armed into the same gain). Stop
    // the old sources at `now` — at the loop seam the audio wraps, so the hard
    // stop is click-safe — and leave the gain at resting for the new audio.
    const skipGainFade = rampSeconds <= 0.0005;
    for (const entry of entries) {
      if (audioContext && !skipGainFade && !seenGains.has(entry.gain)) {
        seenGains.add(entry.gain);
        const result = applyClickFreeStop(entry.gain, audioContext, {
          rampSeconds,
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
