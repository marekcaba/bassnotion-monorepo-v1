/**
 * DroneDeck — a two-deck, equal-power crossfading player for the scale DRONE.
 *
 * The single-source drone (one looping AudioBufferSourceNode) is correct for "play one
 * drone forever", but it can't TRANSITION: changing key/chord meant stop()→start(), an
 * instantaneous cut with an audible click/gap. To blend one tonal centre into the next,
 * the drone needs TWO decks (A/B), each a source+gain pair: the incoming drone starts on
 * the idle deck while the outgoing one is still ringing, and we crossfade their gains.
 *
 * EQUAL-POWER crossfade (not linear): the outgoing gain follows cos(t·π/2), the incoming
 * sin(t·π/2). Their squares sum to 1 at every instant, so the perceived loudness stays
 * constant across the blend — a linear fade dips ~3dB in the middle and you hear the hole.
 *
 * Stems are loaded via the existing loadDroneStem (fetch → decodeAudioData → cache). A
 * missing .ogg (404) yields a null buffer: starting a null deck is a silent no-op and a
 * crossfade TO null just fades the current deck out — playback proceeds dry, never throws.
 *
 * TIMEBASE: all scheduling is on the shared AudioContext.currentTime (seconds), the same
 * clock the scale notes + metronome use. Callers pass absolute audio times so a transition
 * can be ALIGNED to a musical boundary (e.g. the next bar) by the sequencer.
 *
 * SEAMLESS LOOPING: the exported drone bounces are NOT seamless loops — each starts at
 * digital silence (a fade-in) and ends mid-sustain, so a bare `source.loop = true` would
 * click + re-swell at every wrap (~21s). Instead each deck uses a SelfLooper that crossfades
 * the buffer into ITSELF: copy N+1 starts SELF_OVERLAP_SEC before copy N ends, each fading
 * in/out (equal-power) over that overlap, so the sustain is continuous and the seam is never
 * heard. Works for any non-seamless source — no re-export needed.
 */

import { loadDroneStem } from './droneStem';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('DroneDeck');

/** Steps in the equal-power gain ramp. setValueCurveAtTime interpolates between them; 32
 *  is smooth to the ear for fades up to a couple of seconds and cheap to build. */
const RAMP_STEPS = 32;
/** A fast fade-to-silence on stop(), so ending a take doesn't click. */
const STOP_FADE_SEC = 0.06;
/** Extra silence held AFTER the stop fade reaches 0, before the buffer source is actually
 *  stopped. A buffer source stopped at the *instant* a linear ramp hits 0 still clicks: the
 *  ramp is only exactly 0 at its end sample, the buffer sits at an arbitrary (per-channel,
 *  per-run) sample value, and src.stop() cutting a not-quite-silent signal pops — which is
 *  why the spike wandered L/R and varied in level. Holding gain flat at 0 for this margin
 *  before stopping means there's genuinely nothing to cut. */
const STOP_HOLD_SEC = 0.04;

/** Self-loop overlap (seconds) — how long consecutive buffer copies crossfade into each other
 *  at the wrap. ~0.6s is long enough to hide the mid-sustain seam of the drone bounces without
 *  audibly doubling the chord. */
const SELF_OVERLAP_SEC = 0.6;
/** How far ahead (seconds) the self-looper schedules the next copy — comfortably more than a
 *  timer tick so a copy is always queued before the current one's crossfade-out begins. */
const SELF_SCHEDULE_AHEAD_SEC = 1.5;

/**
 * SelfLooper — loops a buffer SEAMLESSLY by crossfading it into itself. Rather than one node
 * with `loop = true` (which hard-cuts at the buffer's end), it schedules a chain of one-shot
 * copies: each copy fades IN over the first SELF_OVERLAP_SEC and fades OUT over the last
 * SELF_OVERLAP_SEC (equal-power), and the next copy starts (bufferDur − overlap) after the
 * previous — so while one copy is fading out the next is fading in, holding the sustain. All
 * copies feed one shared `gain` (the deck's gain), so the chord-crossfade + master volume
 * ride on top unchanged. A short poll keeps the chain scheduled ahead of the clock.
 */
class SelfLooper {
  private readonly ctx: AudioContext;
  private readonly buffer: AudioBuffer;
  private readonly out: GainNode;
  private readonly period: number; // seconds between consecutive copy starts
  private nextStart: number; // audio time the next copy should start
  private sources = new Set<AudioBufferSourceNode>();
  private timer: number | null = null;
  private stopped = false;

  constructor(ctx: AudioContext, buffer: AudioBuffer, out: GainNode, startAt: number) {
    this.ctx = ctx;
    this.buffer = buffer;
    this.out = out;
    // If the buffer is too short to overlap meaningfully, fall back to back-to-back (no
    // overlap) — still gapless because copies are scheduled contiguously.
    const overlap = Math.min(SELF_OVERLAP_SEC, buffer.duration / 3);
    this.period = Math.max(0.05, buffer.duration - overlap);
    this.nextStart = Math.max(startAt, ctx.currentTime);
    // ALWAYS schedule the FIRST copy now — the caller chose its start time (e.g. loopStart a
    // few seconds out, after the count-in), so it must be queued even if it's past the
    // horizon. Subsequent copies are scheduled just-in-time by scheduleAhead via the poll.
    this.scheduleCopy(this.nextStart, overlap);
    this.nextStart += this.period;
    this.scheduleAhead(overlap);
    // Poll to keep copies queued ahead of the clock (period can be many seconds; a 0.5s tick
    // is plenty of margin against SELF_SCHEDULE_AHEAD_SEC).
    this.timer = window.setInterval(() => this.scheduleAhead(overlap), 500);
  }

  private scheduleAhead(overlap: number): void {
    if (this.stopped) return;
    const horizon = this.ctx.currentTime + SELF_SCHEDULE_AHEAD_SEC;
    while (this.nextStart <= horizon) {
      this.scheduleCopy(this.nextStart, overlap);
      this.nextStart += this.period;
    }
  }

  private scheduleCopy(startAt: number, overlap: number): void {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffer;
    const g = this.ctx.createGain();
    src.connect(g);
    g.connect(this.out);
    const dur = this.buffer.duration;
    // Equal-power fade IN over [start, start+overlap] and OUT over [end−overlap, end].
    // NOTE: a setValueAtTime() landing ON a setValueCurveAtTime()'s time span throws
    // NotSupportedError ("overlaps setValueCurveAtTime"), which aborts the REST of this
    // method — leaving the fade-OUT curve unscheduled and the copy stuck at full gain, so
    // stop() cuts it at amplitude 1 → a click/spike (this was the end-of-fade spike). The
    // two setValueAtTime(1, …) "pins" were redundant anyway: the fade-in curve already ends
    // at 1 and setValueCurveAtTime HOLDS its last value until the next automation event. So
    // we just schedule the two curves; the sustain between them holds at 1 on its own.
    g.gain.setValueCurveAtTime(equalPowerCurve(true), startAt, overlap);
    g.gain.setValueCurveAtTime(
      equalPowerCurve(false),
      startAt + dur - overlap,
      overlap,
    );
    src.start(startAt);
    src.stop(startAt + dur + 0.01);
    this.sources.add(src);
    src.onended = () => {
      g.disconnect();
      this.sources.delete(src);
    };
  }

  /**
   * Schedule every sounding source to stop at the ABSOLUTE audio time `at` (must be ≥ now). New
   * copies stop being scheduled immediately. The caller is responsible for having the gain reach
   * (and HOLD at) 0 before `at`, so when the source actually stops there's no signal to cut —
   * see DroneDeck.stop()'s fade+hold. The onended handlers disconnect each source as it ends.
   */
  stopAt(at: number): void {
    this.stopped = true;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const stopAt = Math.max(at, this.ctx.currentTime);
    for (const src of this.sources) {
      try {
        // stop() throws if the source never started or already stopped — ignore.
        src.stop(stopAt);
      } catch {
        try {
          src.disconnect();
        } catch {
          /* already torn down */
        }
        this.sources.delete(src);
      }
    }
  }

  /** Immediate hard stop — for tearing down a deck that's already silent (no fade needed). */
  stop(): void {
    this.stopAt(this.ctx.currentTime);
  }
}

interface Deck {
  /** The self-overlap looper that holds this deck's sounding copies (replaces a single
   *  loop=true source so the non-seamless bounces loop without a click). */
  looper: SelfLooper;
  gain: GainNode;
  /** The chord symbol this deck is currently playing (for de-dup / debugging). */
  symbol: string;
}

/**
 * The next BAR boundary at or after `now` (+ a lookahead guard), on the grid anchored at
 * `loopStart` with bars of `barSeconds`. This is where a mid-play drone transition is
 * scheduled so the blend lands on a downbeat rather than wherever the dial happened to move.
 * Pure (computed from the audio clock + tempo, never the visual read-head) so it's testable.
 */
export function nextBarBoundary(
  now: number,
  loopStart: number,
  barSeconds: number,
  lookahead: number,
): number {
  if (barSeconds <= 0) return Math.max(now, loopStart);
  const barsElapsed = Math.floor((now + lookahead - loopStart) / barSeconds);
  return loopStart + (barsElapsed + 1) * barSeconds;
}

/** Build the equal-power gain curve for a deck. `fadeIn=true` → 0→1 (sin), else 1→0 (cos). */
function equalPowerCurve(fadeIn: boolean): Float32Array {
  const curve = new Float32Array(RAMP_STEPS + 1);
  for (let i = 0; i <= RAMP_STEPS; i++) {
    const t = i / RAMP_STEPS; // 0..1
    curve[i] = fadeIn ? Math.sin((t * Math.PI) / 2) : Math.cos((t * Math.PI) / 2);
  }
  return curve;
}

/** A short fade (seconds) when the drone is muted/unmuted or its level is dialed, so the
 *  on/off toggle doesn't click and the volume knob glides. */
const LEVEL_RAMP_SEC = 0.08;

export class DroneDeck {
  private readonly ctx: AudioContext;
  /** MASTER gain — every deck routes through this single node, so on/off + volume are one
   *  ramp here (they compose cleanly with the per-deck equal-power crossfade ramps below,
   *  which stay RELATIVE to this master). Created lazily on first use. */
  private master: GainNode | null = null;
  /** Desired master level when ENABLED (the volume knob, 0..1). Muting ramps master to 0
   *  but remembers this so unmuting restores it. */
  private volume = 1;
  /** Whether the drone should currently sound. False ⇒ master rides at 0. */
  private enabled = true;
  /** The deck currently sounding (full per-deck gain), or null when nothing is playing. */
  private active: Deck | null = null;
  /** A deck mid-fade-in that hasn't yet become `active`. Tracked so a second, rapid
   *  crossfade can tear it down instead of leaking an orphaned source. */
  private incoming: Deck | null = null;
  /** The symbol the drone is heading toward — tracked EXPLICITLY (not derived from the
   *  incoming deck) so a crossfade to a MISSING stem still registers its intent. Without
   *  this, fading to a stem-less symbol would leave targetSymbol on the old chord and the
   *  no-op guard would swallow a later change back to that symbol. */
  private target: string | null = null;
  /** EVERY deck that's been created and not yet torn down — the leak backstop. Promotions and
   *  the post-fade timers can race (rapid crossfades from the time-transposer + manual chord
   *  clicks interleaving across crossfadeTo's await), and a deck that stops being `active`/
   *  `incoming` without being torn down would keep SOUNDING → chords stack. After every
   *  transition we sweep this set and tear down anything that isn't the current active/incoming. */
  private liveDecks = new Set<Deck>();
  /** Serializes crossfadeTo so two overlapping calls can't interleave their deck-state mutations
   *  across the loadDroneStem await (which produced orphaned, still-sounding decks). */
  private crossfadeChain: Promise<void> = Promise.resolve();

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
  }

  /** Tear down every live deck that is NOT the current active or incoming. The backstop that
   *  guarantees at most two decks ever sound, no matter how the promotion timers race. */
  private sweepOrphans(): void {
    for (const deck of this.liveDecks) {
      if (deck !== this.active && deck !== this.incoming) {
        this.teardown(deck);
      }
    }
  }

  /** The symbol the drone is currently sounding or heading toward. Lets the caller skip a
   *  crossfade that wouldn't change anything. */
  get targetSymbol(): string | null {
    return this.target;
  }

  /** The master gain node, created on first use, routed to the destination. */
  private getMaster(): GainNode {
    if (!this.master) {
      this.master = this.ctx.createGain();
      this.master.gain.setValueAtTime(
        this.enabled ? this.volume : 0,
        this.ctx.currentTime,
      );
      this.master.connect(this.ctx.destination);
    }
    return this.master;
  }

  /** Turn the drone on/off with a short fade (no click). Persists across key changes — the
   *  next crossfade still routes through the master, so a muted drone stays muted. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    this.rampMaster(on ? this.volume : 0);
  }

  /** Set the drone level (0..1) — the volume knob. Glides to avoid a zipper. Ignored audibly
   *  while muted, but remembered so unmuting restores it. */
  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.enabled) this.rampMaster(this.volume);
  }

  private rampMaster(to: number): void {
    const m = this.getMaster();
    const now = this.ctx.currentTime;
    m.gain.cancelScheduledValues(now);
    m.gain.setValueAtTime(m.gain.value, now);
    m.gain.linearRampToValueAtTime(to, now + LEVEL_RAMP_SEC);
  }

  /** Build a looping source+gain deck for a decoded buffer, started at `startAt` with the
   *  given initial gain. Returns null if the buffer is null (missing stem). Routes through
   *  the MASTER gain so on/off + volume apply to it. */
  private makeDeck(
    buffer: AudioBuffer | null,
    symbol: string,
    startAt: number,
    initialGain: number,
  ): Deck | null {
    if (!buffer) return null;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(initialGain, Math.max(startAt, this.ctx.currentTime));
    gain.connect(this.getMaster());
    // Self-overlap looping instead of source.loop=true — the bounces aren't seamless loops,
    // so we crossfade the buffer into itself behind this deck's gain.
    const looper = new SelfLooper(this.ctx, buffer, gain, startAt);
    const deck = { looper, gain, symbol };
    this.liveDecks.add(deck); // tracked so sweepOrphans() can never let it leak
    return deck;
  }

  /** Stop + disconnect a deck immediately. Safe to call on an already-stopped deck. */
  private teardown(deck: Deck | null): void {
    if (!deck) return;
    this.liveDecks.delete(deck);
    deck.looper.stop();
    deck.gain.disconnect();
  }

  /**
   * Start the FIRST drone of a take at `startAt` (no fade — there's nothing to blend
   * from). Used in the sequencer's play() at loopStart, after the count-in.
   */
  async start(symbol: string, startAt: number): Promise<void> {
    // Clear anything left over (e.g. a re-play without an explicit stop) — including any decks
    // a previous in-flight crossfade left in liveDecks but no longer points at.
    this.incoming = null;
    this.active = null;
    for (const deck of this.liveDecks) this.teardown(deck);
    this.target = symbol;
    this.getMaster(); // ensure the master exists (at the current enabled/volume) up front

    const buffer = await loadDroneStem(symbol, this.ctx);
    // A stop()/newer start() could have intervened during the await; only adopt if still ours.
    if (this.target !== symbol) {
      this.teardown(this.makeDeck(buffer, symbol, startAt, 1));
      return;
    }
    this.active = this.makeDeck(buffer, symbol, startAt, 1); // null deck = play dry
  }

  /**
   * Crossfade from the active drone to `symbol`, beginning at `at` and lasting `fadeSec`.
   * The incoming deck starts at `at` from gain 0 and rises (sin); the outgoing falls (cos)
   * over the same span, then is torn down. Aligning `at` to a musical boundary (next bar)
   * is the caller's job. No count-in — this is a seamless mid-play transition.
   *
   * SERIALIZED: each call waits for the previous crossfade's deck-state mutation to finish
   * before starting. crossfadeToImpl awaits loadDroneStem, and without serialization two
   * overlapping calls (the time-transposer firing WHILE the user clicks chords) would
   * interleave across that await and orphan still-sounding decks → chords stack. Chaining
   * makes the active/incoming bookkeeping atomic per call.
   */
  crossfadeTo(symbol: string, at: number, fadeSec: number): Promise<void> {
    const run = this.crossfadeChain.then(() =>
      this.crossfadeToImpl(symbol, at, fadeSec),
    );
    // Keep the chain alive even if a crossfade rejects (e.g. a stem fails to load).
    this.crossfadeChain = run.catch(() => {});
    return run;
  }

  private async crossfadeToImpl(
    symbol: string,
    at: number,
    fadeSec: number,
  ): Promise<void> {
    // Already heading there? Don't stack a redundant fade.
    if (this.target === symbol) return;
    this.target = symbol;

    // A previous crossfade may still be in flight — promote/tear it down so we only ever
    // blend between TWO decks. The in-flight incoming becomes the new outgoing.
    if (this.incoming) {
      this.teardown(this.active);
      this.active = this.incoming;
      this.incoming = null;
    }
    // Backstop: tear down anything that isn't active/incoming before we add another deck.
    this.sweepOrphans();

    const buffer = await loadDroneStem(symbol, this.ctx);

    // A newer crossfade may have run while we awaited (serialization makes that rare, but a
    // stop()/start() can also intervene). If our intent is stale, drop this fade entirely.
    if (this.target !== symbol) return;

    // loadDroneStem awaited — `at` may now be in the past on a slow network. Floor the
    // fade start to "now" so the ramps are always valid; the blend just starts a hair late.
    const start = Math.max(at, this.ctx.currentTime);
    const end = start + fadeSec;

    const outgoing = this.active;
    const incoming = this.makeDeck(buffer, symbol, start, 0);

    // Ramp the OUTGOING deck down (equal-power). If it's a null/dry deck there's nothing
    // to fade — the incoming simply takes over.
    if (outgoing) {
      outgoing.gain.gain.cancelScheduledValues(start);
      outgoing.gain.gain.setValueCurveAtTime(equalPowerCurve(false), start, fadeSec);
    }

    if (incoming) {
      incoming.gain.gain.cancelScheduledValues(start);
      incoming.gain.gain.setValueCurveAtTime(equalPowerCurve(true), start, fadeSec);
      this.incoming = incoming;

      // After the fade completes, the incoming deck IS the active drone and the old one is
      // released. ALWAYS tear down THIS outgoing (don't gate on this.incoming === incoming —
      // a superseding crossfade could have moved the pointer, which previously leaked the
      // outgoing and stacked chords). The active/incoming pointers only advance if still ours;
      // sweepOrphans() mops up any deck a racing promotion left behind.
      const delayMs = Math.max(0, (end - this.ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.incoming === incoming) {
          this.active = incoming;
          this.incoming = null;
        }
        this.teardown(outgoing);
        this.sweepOrphans();
      }, delayMs);
    } else {
      // Crossfading TO a missing stem: just let the outgoing fade out to silence and drop
      // it. The drone goes quiet until a symbol with an uploaded .ogg is selected.
      const delayMs = Math.max(0, (end - this.ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.active === outgoing) this.active = null;
        this.teardown(outgoing);
        this.sweepOrphans();
      }, delayMs);
      logger.info(`Crossfade to "${symbol}" has no stem; fading drone out.`);
    }
  }

  /** Stop ALL drone audio with a short fade so ending a take doesn't click, then tear down. */
  stop(): void {
    const now = this.ctx.currentTime;
    // Fade EVERY live deck, not just active/incoming — a racing crossfade can leave an orphan
    // in liveDecks that would keep sounding after stop otherwise.
    const captured = [...this.liveDecks];
    for (const deck of captured) {
      try {
        // Fade the deck's gain to 0 over STOP_FADE_SEC, then HOLD it flat at 0 for STOP_HOLD_SEC,
        // and only stop the buffer sources after that hold. Stopping a source the instant a ramp
        // hits 0 still clicks (ramp is exactly 0 only at its end sample; the buffer is at an
        // arbitrary per-channel value; cutting it pops — that was the wandering L/R spike). The
        // flat-zero hold guarantees there's no signal left to cut.
        const rampEnd = now + STOP_FADE_SEC;
        const stopAt = rampEnd + STOP_HOLD_SEC;
        deck.gain.gain.cancelScheduledValues(now);
        deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
        deck.gain.gain.linearRampToValueAtTime(0, rampEnd);
        deck.gain.gain.setValueAtTime(0, stopAt); // hold flat at 0 through the margin
        deck.looper.stopAt(stopAt);
      } catch {
        this.teardown(deck);
      }
    }
    // Disconnect the gain nodes after the fade so we don't cut it short.
    const capturedMaster = this.master;
    window.setTimeout(() => {
      captured.forEach((d) => d.gain.disconnect());
      capturedMaster?.disconnect();
    }, (STOP_FADE_SEC + STOP_HOLD_SEC + 0.05) * 1000);
    this.liveDecks.clear();
    this.active = null;
    this.incoming = null;
    this.target = null;
    // Drop the master so the next take rebuilds it fresh (re-applying enabled/volume).
    this.master = null;
  }
}
