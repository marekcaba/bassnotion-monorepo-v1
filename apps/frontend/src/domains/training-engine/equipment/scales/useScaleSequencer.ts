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
import { DroneDeck, nextBarBoundary } from './DroneDeck';
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
/** Metronome click scheduling compensation, seconds. An earlier ~42ms value compensated the
 *  LEADING SILENCE baked into the click .mp3 (the file was dead-silent for ~51ms before its
 *  transient). That silence has been TRIMMED out of the asset (Click_Low2/High2.mp3 now onset at
 *  ~0ms), so the click transient lands on the beat with NO compensation — measured bass-vs-click
 *  is within ~7ms (inaudible). Kept as a tunable knob = 0. This is NOT device latency: click + bass
 *  share one AudioContext, so output latency is common-mode and cancels in their relative offset
 *  (portable across all devices). Only re-tune if the click ASSET changes again. */
const CLICK_LATENCY_COMP = 0;
/** Drone crossfade duration (seconds) for a mid-play key/chord transition. Medium blend:
 *  long enough that the two tonal centres audibly wash into each other, short enough that
 *  distant key changes don't sit dissonant for long. The transition is aligned to the next
 *  bar by the caller; no count-in fires (count-in is a once-per-take preamble). */
const DRONE_CROSSFADE_SEC = 0.7;

export interface UseScaleSequencerOptions {
  /** The ordered, timed scale notes to play (from buildScalePath). */
  path: PlayableNote[];
  /** Total loop length in beats (from scalePathBeats). */
  loopBeats: number;
  /** Tempo in BPM. */
  bpm: number;
  /** The drone chord symbol (A7, Cmaj7 …) — its .ogg loops under the scale. */
  droneSymbol: string;
  /** Whether the sustained drone plays under the scale. Default true. Toggling mid-play
   *  fades it in/out (no click); the scale notes + metronome keep going either way. */
  droneEnabled?: boolean;
  /** Drone level 0..1 (the volume knob). Default 1. */
  droneVolume?: number;
  /** Bass-sampler (the scale notes) level 0..1. Default 1. Applied to a gain node between the
   *  sampler and the output, so it's a live, linear control independent of the drone + click. */
  bassVolume?: number;
  /** Metronome click level 0..1. Default 1. Scales the metronome's own output gain. */
  metronomeVolume?: number;
  /** FREESTYLE: when true, drone key changes crossfade IMMEDIATELY (no bar-alignment — there's
   *  no grid in time-free mode) and over `droneCrossfadeSec`. Default false (exercise mode:
   *  bar-aligned, short). */
  freestyle?: boolean;
  /** Drone crossfade duration (seconds) for a mid-play key change. Default 0.7 (snappy, for
   *  exercise key changes); freestyle passes a long value (3–5s) for slow drifts. */
  droneCrossfadeSec?: number;
  /** Resume a prewarmed context inside the play gesture (Safari). */
  onBeforePlay?: () => Promise<void> | void;
  /** RECORD MODE: when true, the scale-note SAMPLER is muted (drone + click still play), so the
   *  student plays the scale THEMSELVES and the mic doesn't capture our own bass into the grade. */
  silentBass?: boolean;
  /** Auto-stop after this many full loops (in addition to the count-in). 0/undefined = play
   *  forever (the default). Used by record mode so a take is exactly N loops then stops. */
  maxLoops?: number;
}

export interface UseScaleSequencerReturn {
  isPlaying: boolean;
  isReady: boolean;
  /** 0 when not counting in; 1..COUNT_IN_BEATS during the count-in. */
  countInBeat: number;
  play: () => Promise<void>;
  /** FREESTYLE: start only the held drone immediately (no count-in / metronome / bass). */
  startFreestyle: () => Promise<void>;
  stop: () => void;
  audioContext: AudioContext | null;
  /** Current elapsed playback position in BEATS from the scale loop's beat 0, looped to
   *  [0, loopBeats). Negative during the count-in (before beat 0). null when not playing.
   *  Drives the fretboard playhead (the gym doesn't run the AtomicPlaybackClock). */
  getPlaybackBeat: () => number | null;
  /** Absolute audioContext time (seconds) of the scale loop's beat 0 — the grid anchor the
   *  listening engine needs to align the player's recorded onsets. null before the first play. */
  getLoopStartAudioTime: () => number | null;
  /** Wall-clock audio time of the NEXT loop seam (loopStart + k×loopSeconds). Feeds the
   *  Dynamic Loop counter; null during count-in or when stopped. */
  getNextSeamTime: () => number | null;
}

export function useScaleSequencer({
  path,
  loopBeats,
  bpm,
  droneSymbol,
  droneEnabled = true,
  droneVolume = 1,
  bassVolume = 1,
  metronomeVolume = 1,
  freestyle = false,
  droneCrossfadeSec = 0.7,
  onBeforePlay,
  silentBass = false,
  maxLoops = 0,
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
  // A gain node the bass sampler routes THROUGH (sampler → bassGain → destination), so the
  // scale-note level is a live, linear 0..1 control independent of the drone + metronome.
  const bassGainRef = React.useRef<GainNode | null>(null);
  const metronomeRef = React.useRef<WamMetronome | null>(null);

  // Live scheduling state (refs so the RAF loop reads fresh values without re-subscribing).
  // The drone is a two-deck crossfading player (see DroneDeck): start() lays the first drone
  // at loopStart; crossfadeTo() blends one tonal centre into the next mid-play, bar-aligned.
  const droneDeckRef = React.useRef<DroneDeck | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const loopStartRef = React.useRef(0); // audioContext time when the scale loop (beat 0) begins
  const nextNoteIdxRef = React.useRef(0); // index of the next un-armed note in the path
  const loopIterRef = React.useRef(0); // how many full loops have been armed
  const nextBeatRef = React.useRef(0); // next un-clicked metronome beat (steady grid)
  // Single-flight guard: a ref (not state) so a rapid second click / strict-mode double
  // invoke can't spin up a SECOND scheduler + metronome stream (that stacked the audio).
  const isActiveRef = React.useRef(false);
  // Auto-stop timer (record mode): fires after the count-in + maxLoops loops to end the take.
  const autoStopRef = React.useRef<number | null>(null);
  const maxLoopsRef = React.useRef(maxLoops);
  React.useEffect(() => {
    maxLoopsRef.current = maxLoops;
  }, [maxLoops]);

  // Keep the latest props in refs so the persistent RAF loop sees live edits (roller moves).
  const pathRef = React.useRef(path);
  const loopBeatsRef = React.useRef(loopBeats);
  const bpmRef = React.useRef(bpm);
  const silentBassRef = React.useRef(silentBass);
  const droneSymbolRef = React.useRef(droneSymbol);
  const droneEnabledRef = React.useRef(droneEnabled);
  const droneVolumeRef = React.useRef(droneVolume);
  const bassVolumeRef = React.useRef(bassVolume);
  const metronomeVolumeRef = React.useRef(metronomeVolume);
  const freestyleRef = React.useRef(freestyle);
  freestyleRef.current = freestyle;
  const droneCrossfadeSecRef = React.useRef(droneCrossfadeSec);
  droneCrossfadeSecRef.current = droneCrossfadeSec;
  React.useEffect(() => {
    pathRef.current = path;
  }, [path]);
  React.useEffect(() => {
    loopBeatsRef.current = loopBeats;
  }, [loopBeats]);
  React.useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);
  React.useEffect(() => {
    silentBassRef.current = silentBass;
  }, [silentBass]);

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

    // Bass-sampler output gain — the sampler connects to this (not straight to destination) so
    // its level is a live 0..1 control. Created once, seeded at the current bassVolume.
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(bassVolumeRef.current, ctx.currentTime);
    bassGain.connect(ctx.destination);
    bassGainRef.current = bassGain;

    // Metronome — give it Tone's raw context so its clicks land on the same clock.
    const metronome = new WamMetronome(ctx);
    await metronome.createAudioNode();
    const metDest = metronome.getDestination?.();
    if (metDest) metDest.connect(ctx.destination);
    metronomeRef.current = metronome;
    // Apply the current metronome level to its own output gain.
    applyMetronomeVolume(metronomeVolumeRef.current);

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
    });
    // Route through the bass GAIN node (sampler → bassGain → destination) so the scale-note
    // level is a live, linear control. Fall back to the destination if the gain isn't up yet
    // (shouldn't happen — ensureAudio runs first — but keeps it safe).
    if (bassGainRef.current) sampler.connect(bassGainRef.current);
    else sampler.toDestination();
    await Tone.loaded(); // wait for every buffer to fetch + decode
    samplerRef.current = sampler;
    loadedSignatureRef.current = signature;

    logger.info('Bass sampler ready', {
      anchorNotes: Object.keys(urls).length,
    });
  }, []);

  // Lay the FIRST drone of a take at the loop's beat 0 (after the count-in). No fade —
  // there's nothing to blend from. Mid-play transitions go through the watch effect below.
  const startDrone = React.useCallback(
    async (ctx: AudioContext, startAt: number) => {
      let deck = droneDeckRef.current;
      if (!deck) {
        deck = new DroneDeck(ctx);
        droneDeckRef.current = deck;
      }
      // Apply the current on/off + level BEFORE start so the deck is built at the right
      // master gain (stop() drops the master, so a fresh take must re-assert these).
      deck.setVolume(droneVolumeRef.current);
      deck.setEnabled(droneEnabledRef.current);
      await deck.start(droneSymbolRef.current, startAt);
    },
    [],
  );

  // Live drone on/off + volume — push changes straight to the deck (fades, no click). The
  // refs are read by startDrone too, so toggling before play just sets the next take's state.
  React.useEffect(() => {
    droneEnabledRef.current = droneEnabled;
    droneDeckRef.current?.setEnabled(droneEnabled);
  }, [droneEnabled]);
  React.useEffect(() => {
    droneVolumeRef.current = droneVolume;
    droneDeckRef.current?.setVolume(droneVolume);
  }, [droneVolume]);

  // ── BASS-SAMPLER + METRONOME volume — live, independent of the drone. Each ramps its own
  //    gain node so a slider move glides (no zipper) and only affects that source. ──
  const VOL_RAMP_SEC = 0.06;
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

  const applyBassVolume = React.useCallback((v: number) => {
    const g = bassGainRef.current;
    const ctx = ctxRef.current;
    if (!g || !ctx) return;
    const now = ctx.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(g.gain.value, now);
    g.gain.linearRampToValueAtTime(clamp01(v), now + VOL_RAMP_SEC);
  }, []);

  const applyMetronomeVolume = React.useCallback((v: number) => {
    // WamMetronomeNode exposes its output gain via `.gain` (an AudioParam). Scaling it scales
    // ALL clicks (the per-click velocity multiplies through it).
    const param = metronomeRef.current?.audioNode?.gain as
      | AudioParam
      | undefined;
    const ctx = ctxRef.current;
    if (!param || !ctx) return;
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(clamp01(v), now + VOL_RAMP_SEC);
  }, []);

  React.useEffect(() => {
    bassVolumeRef.current = bassVolume;
    applyBassVolume(bassVolume);
  }, [bassVolume, applyBassVolume]);
  React.useEffect(() => {
    metronomeVolumeRef.current = metronomeVolume;
    applyMetronomeVolume(metronomeVolume);
  }, [metronomeVolume, applyMetronomeVolume]);

  function stopDrone() {
    droneDeckRef.current?.stop();
  }

  // ── MID-PLAY DRONE TRANSITION (key / chord-type change) ──────────────────────
  // When droneSymbol changes WHILE PLAYING, blend the new tonal centre in — bar-aligned,
  // crossfaded, NO count-in (the count-in is a once-per-take preamble; a mid-play change
  // transitions seamlessly, the same contract the groove card uses for key changes).
  // Before the first play (or after stop) we just stash the latest symbol in the ref so the
  // next play() starts on it.
  React.useEffect(() => {
    droneSymbolRef.current = droneSymbol;
    const deck = droneDeckRef.current;
    const ctx = ctxRef.current;
    if (!deck || !ctx || !isActiveRef.current) return; // not playing → next play() picks it up
    if (deck.targetSymbol === droneSymbol) return; // already there / heading there

    if (freestyleRef.current) {
      // FREESTYLE: time-free, no grid to align to — start the (long) crossfade right away.
      const at = ctx.currentTime + LOOKAHEAD;
      void deck.crossfadeTo(droneSymbol, at, droneCrossfadeSecRef.current);
      return;
    }
    // EXERCISE mode: align the crossfade to the NEXT BAR boundary, computed from the grid
    // (loopStart + k×barSeconds) — the tempo math, NOT the visual read-head. The lookahead
    // guard pushes a fade that would land too soon to the following bar (clean scheduling).
    const barSec = BEATS_PER_BAR * beatDuration();
    const nextBar = nextBarBoundary(
      ctx.currentTime,
      loopStartRef.current,
      barSec,
      LOOKAHEAD,
    );
    void deck.crossfadeTo(droneSymbol, nextBar, DRONE_CROSSFADE_SEC);
  }, [droneSymbol, beatDuration]);

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
      // RECORD MODE (silentBass): skip the audible note but KEEP advancing the note pointer
      // below, so the grid + visual playhead stay in lockstep — the student plays the scale.
      if (noteTime >= now - 0.01 && !silentBassRef.current) {
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
        // The click is fired CLICK_LATENCY_COMP earlier than the beat to cancel the WAM path's
        // measured latency, so it SOUNDS on the beat in phase with the bass. Guard on the
        // compensated time so we never arm one that's already slipped into the past.
        const clickTime = beatTime - CLICK_LATENCY_COMP;
        if (clickTime >= now - 0.01) {
          const isDownbeat = nextBeatRef.current % BEATS_PER_BAR === 0;
          metronome.trigger({
            // velocity is a 0..1 GAIN (the metronome multiplies it by 127 internally);
            // keep it low so the click sits UNDER the bass instead of clipping the mix.
            audioTime: clickTime,
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
      const beatTime = startNow + b * bd;
      if (met)
        met.trigger({
          // Same latency comp as the grid clicks so the count-in pulse is in phase too.
          audioTime: beatTime - CLICK_LATENCY_COMP,
          velocity: b === 0 ? CLICK_GAIN_ACCENT : CLICK_GAIN,
          data: { isDownbeat: b === 0 },
        });
      // Visual count-in number lands ON the beat (uncompensated), matching the felt pulse.
      const delayMs = (beatTime - ctx.currentTime) * 1000;
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

    // AUTO-STOP after N loops (record mode): the take runs the count-in + maxLoops full loops,
    // then stops itself. A wall-clock timeout fires right as the Nth loop completes (loopStart is
    // already past the count-in). 0 = play forever.
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    const loops = maxLoopsRef.current;
    if (loops > 0) {
      const curLoopBeats = loopBeatsRef.current || 1;
      const takeEnd = loopStart + loops * curLoopBeats * bd;
      const stopInMs = (takeEnd - ctx.currentTime) * 1000;
      autoStopRef.current = window.setTimeout(
        () => stopRef.current?.(),
        Math.max(0, stopInMs),
      );
    }
  }, [
    onBeforePlay,
    ensureAudio,
    loadSamplesForPath,
    beatDuration,
    startDrone,
    tick,
  ]);

  // ── FREESTYLE — start ONLY the drone, immediately (no count-in, no scheduler). The rolling
  //    `tick` is what fires the bass sampler + metronome, so by simply NOT starting it, the
  //    click + scale notes are silent — exactly the "freeze a chord and jam" mode. The drone
  //    holds at the current key; the time-based transposer (in the view) drives key changes.
  //    stop() tears the drone down the same as for play(), so no separate teardown is needed. ──
  const startFreestyle = React.useCallback(async () => {
    if (isActiveRef.current) return;
    isActiveRef.current = true;
    await onBeforePlay?.();
    const ctx = await ensureAudio();
    if (ctx.state === 'suspended') await ctx.resume();

    setIsPlaying(true);
    setCountInBeat(0);
    // The drone is the ONLY thing playing. Use loopStart = now so getLoopStartAudioTime /
    // getNextSeamTime have a sane anchor (the time-transposer uses its own timer, not seams,
    // but other readers shouldn't see a stale zero).
    const start = ctx.currentTime + 0.05;
    loopStartRef.current = start;
    nextNoteIdxRef.current = 0;
    loopIterRef.current = 0;
    nextBeatRef.current = 0;
    await startDrone(ctx, start);
    // NO `tick` scheduler, NO count-in, NO auto-stop — just the held drone.
  }, [onBeforePlay, ensureAudio, startDrone]);

  // Stable pointer to stop() for the auto-stop timer (stop is defined below; avoids a TDZ/dep cycle).
  const stopRef = React.useRef<(() => void) | null>(null);

  // ── STOP ─────────────────────────────────────────────────────────────────
  const stop = React.useCallback(() => {
    isActiveRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (autoStopRef.current !== null) {
      window.clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    stopDrone();
    setIsPlaying(false);
    setCountInBeat(0);
  }, []);
  // Keep the auto-stop timer's pointer fresh so it calls the real stop().
  stopRef.current = stop;

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

  // Absolute audioContext time of beat 0 — the grid anchor the listening engine aligns the
  // player's recorded onsets to. null until the first play() has set loopStart.
  const getLoopStartAudioTime = React.useCallback((): number | null => {
    if (!ctxRef.current || !isPlaying) return null;
    return loopStartRef.current || null;
  }, [isPlaying]);

  // Wall-clock audio time of the NEXT loop seam — the same authoritative grid the rest of
  // the tool quantises to (loopStart + k×loopSeconds), NOT a read-head/phase. The groove-
  // card Dynamic Loop counter reads this: as `now` climbs toward a fixed seam the value
  // holds, then JUMPS FORWARD by one loop when we cross it — exactly the wrap signal
  // useLoopCounter detects. null during the count-in (no loop has started) or when stopped.
  const getNextSeamTime = React.useCallback((): number | null => {
    const ctx = ctxRef.current;
    if (!ctx || !isPlaying) return null;
    const loopStart = loopStartRef.current;
    const loopSec = (loopBeatsRef.current || 1) * beatDuration();
    if (loopSec <= 0) return null;
    const elapsed = ctx.currentTime - loopStart;
    if (elapsed < 0) return null; // still counting in — no seam yet
    const seamsPassed = Math.floor(elapsed / loopSec);
    return loopStart + (seamsPassed + 1) * loopSec;
  }, [isPlaying, beatDuration]);

  return {
    isPlaying,
    isReady,
    countInBeat,
    play,
    startFreestyle,
    stop,
    audioContext: ctxRef.current,
    getPlaybackBeat,
    getLoopStartAudioTime,
    getNextSeamTime,
  };
}
