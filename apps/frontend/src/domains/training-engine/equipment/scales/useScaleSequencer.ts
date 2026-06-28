'use client';

/**
 * useScaleSequencer — the Scales tool's audio brain. Replaces the borrowed groove-card
 * stem backing with a purpose-built scale player:
 *
 *   • SCALE NOTES — each note of the path triggers a Tone.Sampler (real bass samples,
 *     pitch-interpolated from sparse anchors), scheduled on audioContext time. We use a
 *     plain Tone.Sampler because the BassSampleLoader path is broken standalone (its
 *     GlobalSampleCache call hits a method that doesn't exist → zero buffers).
 *   • DRONE — the scale's auto-derived chord (A7, Cmaj7 …) loaded as a pre-rendered .ogg
 *     stem and looped, the same way groove stems loop. Silent + harmless if the file
 *     isn't uploaded yet (graceful 404 → no drone, scale still plays).
 *   • METRONOME — WamMetronome click on every beat.
 *   • COUNT-IN — one bar of clicks before the scale starts.
 *
 * TIMEBASE: everything is scheduled against audioContext.currentTime (seconds), the same
 * convention the whole engine uses. A rolling requestAnimationFrame lookahead schedules
 * notes ~150ms ahead so timing is sample-accurate without flooding the scheduler. The
 * loop length is the SCALE PATH's length (not a stem's) — the scale owns the clock.
 *
 * The fretboard still lights via the AtomicPlaybackClock; this hook also drives that
 * clock so the lit dot and the heard note share one timebase. (Clock wiring lands when
 * we connect the visual sync; for now the audio is self-contained + correct.)
 */

import React from 'react';
import { getTone } from '@/domains/playback/utils/tone';
import { getLogger } from '@/utils/logger.js';
import { WamMetronome } from '@/domains/playback/modules/instruments/adapters/wam/WamMetronome';
import { loadDroneStem } from './droneStem';
import { buildBassSamplerUrls, midiToToneNote } from './bassSampleMap';
import type { PlayableNote } from './scalePath';

const logger = getLogger('useScaleSequencer');

/** How far ahead (seconds) the rolling scheduler arms events. */
const LOOKAHEAD = 0.15;
/** Beats per bar (4/4). The metronome accents the first beat of each of these. */
const BEATS_PER_BAR = 4;
/** Count-in length in beats (one 4/4 bar). */
const COUNT_IN_BEATS = BEATS_PER_BAR;
/** Metronome click GAIN (0..1) — the WamMetronome.trigger() scales this by 127, so these
 *  are deliberately LOW so the click sits under the bass instead of clipping the mix. */
const CLICK_GAIN = 0.18;
const CLICK_GAIN_ACCENT = 0.3;

export interface UseScaleSequencerOptions {
  /** The ordered, timed scale notes to play (from buildScalePath). */
  path: PlayableNote[];
  /** Total loop length in beats (from scalePathBeats). */
  loopBeats: number;
  /** Tempo in BPM. */
  bpm: number;
  /** The drone chord symbol (A7, Cmaj7 …) — its .ogg loops under the scale. */
  droneSymbol: string;
  /** Resume a prewarmed context inside the play gesture (Safari). */
  onBeforePlay?: () => Promise<void> | void;
}

export interface UseScaleSequencerReturn {
  isPlaying: boolean;
  isReady: boolean;
  /** 0 when not counting in; 1..COUNT_IN_BEATS during the count-in. */
  countInBeat: number;
  play: () => Promise<void>;
  stop: () => void;
  audioContext: AudioContext | null;
  /** Current elapsed playback position in BEATS from the scale loop's beat 0, looped to
   *  [0, loopBeats). Negative during the count-in (before beat 0). null when not playing.
   *  Drives the fretboard playhead (the gym doesn't run the AtomicPlaybackClock). */
  getPlaybackBeat: () => number | null;
}

export function useScaleSequencer({
  path,
  loopBeats,
  bpm,
  droneSymbol,
  onBeforePlay,
}: UseScaleSequencerOptions): UseScaleSequencerReturn {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [countInBeat, setCountInBeat] = React.useState(0);
  // The tool is ready to start whenever there's a scale to play — samples load lazily on
  // the first click (inside the play gesture), so we DON'T gate the button on a post-load
  // flag (that deadlocks: the button would stay disabled because play() can't run to set
  // it). Disabled only when the path is genuinely empty.
  const isReady = path.length > 0;

  // Audio singletons for this tool, created lazily on first play.
  const ctxRef = React.useRef<AudioContext | null>(null);
  // A plain Tone.Sampler (the proven path): note→url map, internal fetch/decode +
  // pitch-interpolation. Typed loose because we resolve Tone at runtime via getTone().
  const samplerRef = React.useRef<any>(null);
  const loadedSignatureRef = React.useRef<string>(''); // current sampler's url signature
  const metronomeRef = React.useRef<WamMetronome | null>(null);

  // Live scheduling state (refs so the RAF loop reads fresh values without re-subscribing).
  const droneNodeRef = React.useRef<AudioBufferSourceNode | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const loopStartRef = React.useRef(0); // audioContext time when the scale loop (beat 0) begins
  const nextNoteIdxRef = React.useRef(0); // index of the next un-armed note in the path
  const loopIterRef = React.useRef(0); // how many full loops have been armed
  const nextBeatRef = React.useRef(0); // next un-clicked metronome beat (steady grid)
  // Single-flight guard: a ref (not state) so a rapid second click / strict-mode double
  // invoke can't spin up a SECOND scheduler + metronome stream (that stacked the audio).
  const isActiveRef = React.useRef(false);

  // Keep the latest props in refs so the persistent RAF loop sees live edits (roller moves).
  const pathRef = React.useRef(path);
  const loopBeatsRef = React.useRef(loopBeats);
  const bpmRef = React.useRef(bpm);
  React.useEffect(() => {
    pathRef.current = path;
  }, [path]);
  React.useEffect(() => {
    loopBeatsRef.current = loopBeats;
  }, [loopBeats]);
  React.useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  const beatDuration = React.useCallback(() => 60 / bpmRef.current, []);

  // ── Lazy one-time audio init ─────────────────────────────────────────────
  // CRITICAL: the bass sampler + drone + metronome must share ONE clock. The sampler is
  // a Tone.js instrument (schedules on Tone.now()); the metronome + drone schedule on
  // AudioContext.currentTime. Those agree ONLY if we use Tone's OWN raw context for
  // everything — so we never create a separate AudioContext.
  const ensureAudio = React.useCallback(async (): Promise<AudioContext> => {
    if (ctxRef.current) return ctxRef.current;

    const Tone = await getTone(); // runtime instance (never static-import 'tone')
    await Tone.start(); // unlock + ready Tone's context (idempotent)
    const ctx = Tone.getContext().rawContext as AudioContext;
    ctxRef.current = ctx;

    // Metronome — give it Tone's raw context so its clicks land on the same clock.
    const metronome = new WamMetronome(ctx);
    await metronome.createAudioNode();
    const metDest = metronome.getDestination?.();
    if (metDest) metDest.connect(ctx.destination);
    metronomeRef.current = metronome;

    return ctx;
  }, []);

  // Build a Tone.Sampler covering the current path's notes. Rebuilt only when the set of
  // notes changes (signature compare), so re-pressing play on the same scale is instant.
  // Tone fetches + decodes the .ogg samples itself and pitch-shifts to fill any gaps.
  const loadSamplesForPath = React.useCallback(async () => {
    const curPath = pathRef.current;
    if (curPath.length === 0) return;

    // Resolve each note on its OWN string (timbre matches the fingering), de-duped by
    // string+fret so we don't request the same sample twice.
    const seen = new Set<string>();
    const refs = curPath
      .filter((n) => {
        const k = `${n.string}:${n.fret}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .map((n) => ({ midi: n.midi, string: n.string, fret: n.fret }));

    const urls = buildBassSamplerUrls(refs);
    // Signature includes the URLs (which encode string+fret), so changing the FINGERING
    // — not just the pitch set — rebuilds the sampler with the right-string samples.
    const signature = Object.values(urls).sort().join('|');
    if (samplerRef.current && signature === loadedSignatureRef.current) {
      return;
    }

    const Tone = await getTone();
    // Dispose the old sampler before swapping (avoid leaking voices).
    samplerRef.current?.dispose?.();

    // Match the app's working bass sampler envelope: a tiny attack (keeps the pluck
    // transient), a SHORT exponential release (a long release smears the note into a
    // muffled tail and buries the attack). 'exponential' release sounds natural on bass.
    const sampler = new Tone.Sampler({
      urls,
      attack: 0.005,
      release: 0.12,
      curve: 'exponential',
      volume: -3,
    }).toDestination();
    await Tone.loaded(); // wait for every buffer to fetch + decode
    samplerRef.current = sampler;
    loadedSignatureRef.current = signature;
    logger.info('Bass sampler ready', {
      anchorNotes: Object.keys(urls).length,
    });
  }, []);

  // Start (or restart) the looping drone stem under the scale.
  const startDrone = React.useCallback(
    async (ctx: AudioContext, startAt: number) => {
      // Tear down any prior drone.
      stopDrone();
      const buffer = await loadDroneStem(droneSymbol, ctx);
      if (!buffer) return; // graceful: no stem yet → play dry
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.loop = true;
      node.connect(ctx.destination);
      node.start(startAt);
      droneNodeRef.current = node;
    },
    [droneSymbol],
  );

  function stopDrone() {
    if (droneNodeRef.current) {
      try {
        droneNodeRef.current.stop();
      } catch {
        /* already stopped */
      }
      droneNodeRef.current.disconnect();
      droneNodeRef.current = null;
    }
  }

  // ── The rolling-lookahead scheduler ──────────────────────────────────────
  // Two INDEPENDENT streams, each event armed EXACTLY ONCE within the lookahead window:
  //   • scale NOTES — advance a note pointer loop-by-loop.
  //   • metronome BEATS — a steady quarter-note grid (one click per beat, NOT one per
  //     note — that double-clicked on the descending pass and stacked the audio).
  // The whole-number beat counter (nextBeatRef) only ever increments, so no beat fires
  // twice no matter how many frames see it.
  const tick = React.useCallback(() => {
    const ctx = ctxRef.current;
    const sampler = samplerRef.current;
    const metronome = metronomeRef.current;
    if (!ctx || !sampler) return;

    const now = ctx.currentTime;
    const horizon = now + LOOKAHEAD;
    const bd = beatDuration();
    const curPath = pathRef.current;
    const curLoopBeats = loopBeatsRef.current || 1;
    const loopStart = loopStartRef.current;

    // 1) NOTES — arm every note whose absolute start time is within the horizon.
    while (curPath.length > 0) {
      const idx = nextNoteIdxRef.current;
      const note = curPath[idx]!;
      const noteTime =
        loopStart +
        loopIterRef.current * curLoopBeats * bd +
        note.startBeat * bd;

      if (noteTime > horizon) break; // nothing more to arm this frame
      if (noteTime >= now - 0.01) {
        // Tone.Sampler: note name + duration + absolute time + velocity (0..1). It
        // pitch-shifts from the nearest loaded anchor sample if this exact note wasn't
        // one of the anchors. Let the note ring MOST of its slot (0.85×) so the sample's
        // body sounds — choking it cut the note before its attack rang out (muffled). A
        // small gap remains so consecutive notes still articulate. The slot tracks the
        // rhythm: quarter=1 beat, eighth=½, triplet=⅓, sixteenth=¼.
        const beatFraction =
          note.duration === '4n'
            ? 1
            : note.duration === '8t'
              ? 1 / 3
              : note.duration === '16n'
                ? 0.25
                : 0.5; // '8n'
        const dur = beatDuration() * beatFraction * 0.85;
        sampler.triggerAttackRelease(
          midiToToneNote(note.midi),
          dur,
          noteTime,
          note.isRoot ? 0.95 : 0.82,
        );
      }

      if (idx + 1 >= curPath.length) {
        nextNoteIdxRef.current = 0;
        loopIterRef.current += 1;
      } else {
        nextNoteIdxRef.current = idx + 1;
      }
    }

    // 2) METRONOME — one click per quarter-note beat, on a steady grid from loopStart.
    // The accent (high) click lands on the FIRST beat of every BAR — a fixed 4/4 bar
    // (BEATS_PER_BAR), NOT the scale-loop length (a long scale would otherwise accent only
    // once every few bars). beat 0 = loopStart = the bar-1 downbeat, in phase with count-in.
    if (metronome) {
      let beatTime = loopStart + nextBeatRef.current * bd;
      while (beatTime <= horizon) {
        if (beatTime >= now - 0.01) {
          const isDownbeat = nextBeatRef.current % BEATS_PER_BAR === 0;
          metronome.trigger({
            // velocity is a 0..1 GAIN (the metronome multiplies it by 127 internally);
            // keep it low so the click sits UNDER the bass instead of clipping the mix.
            audioTime: beatTime,
            velocity: isDownbeat ? CLICK_GAIN_ACCENT : CLICK_GAIN,
            data: { isDownbeat },
          });
        }
        nextBeatRef.current += 1;
        beatTime = loopStart + nextBeatRef.current * bd;
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [beatDuration]);

  // ── PLAY ─────────────────────────────────────────────────────────────────
  const play = React.useCallback(async () => {
    // Single-flight: bail if already running OR a play() is mid-flight. Ref-based so it
    // can't be defeated by a stale `isPlaying` closure or a strict-mode double invoke.
    if (isActiveRef.current) return;
    isActiveRef.current = true;

    await onBeforePlay?.();
    const ctx = await ensureAudio();
    if (ctx.state === 'suspended') await ctx.resume();
    await loadSamplesForPath();

    const bd = beatDuration();
    const startNow = ctx.currentTime + 0.1; // small offset to schedule cleanly
    const met = metronomeRef.current;

    // 1-bar count-in: a click on each of COUNT_IN_BEATS beats, the scale starts after.
    setIsPlaying(true);
    for (let b = 0; b < COUNT_IN_BEATS; b++) {
      const clickTime = startNow + b * bd;
      if (met)
        met.trigger({
          audioTime: clickTime,
          velocity: b === 0 ? CLICK_GAIN_ACCENT : CLICK_GAIN,
          data: { isDownbeat: b === 0 },
        });
      // Visual count-in number, fired at wall-clock time matching the click.
      const delayMs = (clickTime - ctx.currentTime) * 1000;
      window.setTimeout(() => setCountInBeat(b + 1), Math.max(0, delayMs));
    }

    // The scale loop begins one full bar after the count-in's first click. The metronome
    // GRID also starts here (beat 0), so the count-in clicks and the grid never overlap.
    const loopStart = startNow + COUNT_IN_BEATS * bd;
    loopStartRef.current = loopStart;
    nextNoteIdxRef.current = 0;
    loopIterRef.current = 0;
    nextBeatRef.current = 0;

    // Clear the count-in display when the scale starts.
    const clearDelayMs = (loopStart - ctx.currentTime) * 1000;
    window.setTimeout(() => setCountInBeat(0), Math.max(0, clearDelayMs));

    await startDrone(ctx, loopStart);

    // Kick the rolling scheduler — cancel any prior loop first so only ONE ever runs.
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);
  }, [
    onBeforePlay,
    ensureAudio,
    loadSamplesForPath,
    beatDuration,
    startDrone,
    tick,
  ]);

  // ── STOP ─────────────────────────────────────────────────────────────────
  const stop = React.useCallback(() => {
    isActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    stopDrone();
    setIsPlaying(false);
    setCountInBeat(0);
  }, []);

  // Cleanup on unmount. We use Tone's SHARED context, so we must NOT close it (that
  // would kill audio app-wide). Just stop our scheduler + drone and dispose our sampler.
  React.useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stopDrone();
      samplerRef.current?.dispose?.();
      samplerRef.current = null;
    };
  }, []);

  // Current playback position in BEATS from the scale loop's beat 0, looped to [0, loopBeats).
  // Computed live from the shared audio clock: (now − loopStart) / beatDuration. Negative
  // before beat 0 (count-in). null when not playing. Drives the fretboard playhead.
  const getPlaybackBeat = React.useCallback((): number | null => {
    const ctx = ctxRef.current;
    if (!ctx || !isPlaying) return null;
    const elapsed = ctx.currentTime - loopStartRef.current;
    const beat = elapsed / beatDuration();
    if (beat < 0) return beat; // count-in
    const loop = loopBeatsRef.current || 1;
    return beat % loop;
  }, [isPlaying, beatDuration]);

  return {
    isPlaying,
    isReady,
    countInBeat,
    play,
    stop,
    audioContext: ctxRef.current,
    getPlaybackBeat,
  };
}
