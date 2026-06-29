/**
 * takePlaybackSchedule — the scheduling for an in-context take replay, split out from the hook so
 * it's pure + testable. Works on any BaseAudioContext (a live AudioContext, or an
 * OfflineAudioContext for a deterministic render).
 *
 * Model: reproduce the experience the student had — a full count-in, then the exercise on the
 * downbeat. The clip is trimmed to its GRID beat 0 (preRollSec, the grader's anchor) and placed at
 * the rebuilt count-in's downbeat, so the clip's grid lines up with the replay's grid — in sync
 * with the backing, exactly as the take was graded.
 */

import type { BackingLayer } from '@bassnotion/contracts';

/** The platform's real metronome samples (same files WamMetronome loads). Low = regular beat,
 *  high = accented downbeat. */
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const CLICK_LOW_URL = `${SUPABASE_URL}/storage/v1/object/public/audio-samples/metronome/Click_Low2.mp3`;
export const CLICK_HIGH_URL = `${SUPABASE_URL}/storage/v1/object/public/audio-samples/metronome/Click_High2.mp3`;

/** Click gains — match the live sequencer's mix (the click sits UNDER the bass). */
export const CLICK_GAIN = 0.18;
export const CLICK_GAIN_ACCENT = 0.3;

/** Fetch + decode an audio URL into a buffer on `ctx`, or null on any failure (404 / decode). */
export async function loadBuffer(
  ctx: BaseAudioContext,
  url: string,
): Promise<AudioBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const arr = await res.arrayBuffer();
    return await ctx.decodeAudioData(arr);
  } catch {
    return null;
  }
}

/** Play a decoded one-shot buffer at `at` with a gain (collects the source for teardown). */
function playOneShot(
  ctx: BaseAudioContext,
  buffer: AudioBuffer,
  at: number,
  gain: number,
  sinks: AudioBufferSourceNode[],
) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g);
  g.connect(ctx.destination);
  src.start(at);
  sinks.push(src);
}

/** Everything the schedule needs — the decoded buffers + the recipe. */
export interface TakePlaybackInput {
  clipBuffer: AudioBuffer;
  stemBuffers: { layer: Extract<BackingLayer, { kind: 'stem' }>; buffer: AudioBuffer | null }[];
  clickLayer: Extract<BackingLayer, { kind: 'click' }> | undefined;
  clickLow: AudioBuffer | null;
  clickHigh: AudioBuffer | null;
  preRollSec: number | null | undefined;
}

export interface TakePlaybackTiming {
  /** ctx time of the exercise's beat 0 (= end of the rebuilt count-in). */
  beat0: number;
  /** ctx time of the count-in's first click. */
  countInStart: number;
  /** length of the exercise audio (clip minus its trimmed head), seconds. */
  exerciseDur: number;
  beatSec: number;
  countInBeats: number;
  /** every click's scheduled ctx time + whether it's the bar accent. */
  clickTimes: { at: number; accent: boolean }[];
  /** where the bass clip is trimmed to (its beat-0 offset), seconds. */
  clipBeat0Offset: number;
}

/**
 * Schedule the full in-context playback on `ctx`, starting at `start` (ctx time). Returns the
 * source nodes (for teardown) + the timing landmarks. This is the SINGLE source of
 * truth for replay timing — see the module header.
 *
 * Model: reproduce the experience exactly — a FULL count-in, then the exercise on the downbeat.
 * The clip's ragged head (the mic armed late) is trimmed via preRollSec so the bass lands on beat0.
 */
export function scheduleTakePlayback(
  ctx: BaseAudioContext,
  start: number,
  input: TakePlaybackInput,
): { sources: AudioBufferSourceNode[]; timing: TakePlaybackTiming } {
  const { clipBuffer, stemBuffers, clickLayer, clickLow, clickHigh, preRollSec } = input;
  const sources: AudioBufferSourceNode[] = [];
  const clipDuration = clipBuffer.duration;

  const beatSec = clickLayer ? 60 / clickLayer.tempoBpm : 0;
  const countInBeats = clickLayer?.countInBeats ?? 4;
  const beatsPerBar = clickLayer?.beatsPerBar ?? 4;
  const countInDur = beatSec * countInBeats;

  const beat0 = start + countInDur;
  const clipBeat0Offset = Math.min(
    Math.max(0, preRollSec ?? 0),
    Math.max(0, clipDuration - 0.05),
  );
  const exerciseDur = clipDuration - clipBeat0Offset;

  // The bass clip — start at beat0, playing from its own beat-0 point (offset).
  const clipSrc = ctx.createBufferSource();
  clipSrc.buffer = clipBuffer;
  clipSrc.connect(ctx.destination);
  clipSrc.start(beat0, clipBeat0Offset);
  sources.push(clipSrc);

  // Each STEM — started at beat0 with the bass, looped under the exercise, stopped at its end.
  for (const { layer, buffer } of stemBuffers) {
    if (!buffer) continue;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = layer.loop !== false;
    const g = ctx.createGain();
    g.gain.value = layer.gain ?? 1;
    src.connect(g);
    g.connect(ctx.destination);
    src.start(beat0);
    src.stop(beat0 + exerciseDur);
    sources.push(src);
  }

  // The CLICK — a FULL count-in then a steady grid through the exercise.
  const clickTimes: { at: number; accent: boolean }[] = [];
  if (clickLayer && (clickLow || clickHigh)) {
    const accentGain = (clickLayer.gain ?? CLICK_GAIN_ACCENT) * 1.6;
    const regularGain = clickLayer.gain ?? CLICK_GAIN;
    const lastBeat = Math.floor(exerciseDur / beatSec);
    for (let b = -countInBeats; b <= lastBeat; b++) {
      const at = beat0 + b * beatSec;
      if (at < start - 0.001 || at > beat0 + exerciseDur) continue;
      const isAccent = (((b % beatsPerBar) + beatsPerBar) % beatsPerBar) === 0;
      const buf = isAccent ? (clickHigh ?? clickLow) : (clickLow ?? clickHigh);
      if (buf) {
        playOneShot(ctx, buf, at, isAccent ? accentGain : regularGain, sources);
        clickTimes.push({ at, accent: isAccent });
      }
    }
  }

  return {
    sources,
    timing: {
      beat0,
      countInStart: beat0 - countInDur,
      exerciseDur,
      beatSec,
      countInBeats,
      clickTimes,
      clipBeat0Offset,
    },
  };
}
