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
 */

import { loadDroneStem } from './droneStem';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('DroneDeck');

/** Steps in the equal-power gain ramp. setValueCurveAtTime interpolates between them; 32
 *  is smooth to the ear for fades up to a couple of seconds and cheap to build. */
const RAMP_STEPS = 32;
/** A fast fade-to-silence on stop(), so ending a take doesn't click. */
const STOP_FADE_SEC = 0.06;

interface Deck {
  source: AudioBufferSourceNode;
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

  constructor(ctx: AudioContext) {
    this.ctx = ctx;
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
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(initialGain, Math.max(startAt, this.ctx.currentTime));
    source.connect(gain);
    gain.connect(this.getMaster());
    source.start(startAt);
    return { source, gain, symbol };
  }

  /** Stop + disconnect a deck immediately. Safe to call on an already-stopped deck. */
  private teardown(deck: Deck | null): void {
    if (!deck) return;
    try {
      deck.source.stop();
    } catch {
      /* already stopped */
    }
    deck.source.disconnect();
    deck.gain.disconnect();
  }

  /**
   * Start the FIRST drone of a take at `startAt` (no fade — there's nothing to blend
   * from). Used in the sequencer's play() at loopStart, after the count-in.
   */
  async start(symbol: string, startAt: number): Promise<void> {
    // Clear anything left over (e.g. a re-play without an explicit stop).
    this.teardown(this.incoming);
    this.teardown(this.active);
    this.incoming = null;
    this.active = null;
    this.target = symbol;
    this.getMaster(); // ensure the master exists (at the current enabled/volume) up front

    const buffer = await loadDroneStem(symbol, this.ctx);
    this.active = this.makeDeck(buffer, symbol, startAt, 1); // null deck = play dry
  }

  /**
   * Crossfade from the active drone to `symbol`, beginning at `at` and lasting `fadeSec`.
   * The incoming deck starts at `at` from gain 0 and rises (sin); the outgoing falls (cos)
   * over the same span, then is torn down. Aligning `at` to a musical boundary (next bar)
   * is the caller's job. No count-in — this is a seamless mid-play transition.
   */
  async crossfadeTo(symbol: string, at: number, fadeSec: number): Promise<void> {
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

    const buffer = await loadDroneStem(symbol, this.ctx);

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

      // After the fade completes, the incoming deck IS the active drone and the old one
      // can be released. setTimeout on wall-clock; (end−now) is the fade's remaining time.
      const delayMs = Math.max(0, (end - this.ctx.currentTime) * 1000);
      window.setTimeout(() => {
        // Guard: only promote if THIS deck is still the pending incoming (a newer
        // crossfade may have superseded it and already promoted/torn it down).
        if (this.incoming === incoming) {
          this.teardown(outgoing);
          this.active = incoming;
          this.incoming = null;
        }
      }, delayMs);
    } else {
      // Crossfading TO a missing stem: just let the outgoing fade out to silence and drop
      // it. The drone goes quiet until a symbol with an uploaded .ogg is selected.
      const delayMs = Math.max(0, (end - this.ctx.currentTime) * 1000);
      window.setTimeout(() => {
        if (this.active === outgoing) {
          this.teardown(outgoing);
          this.active = null;
        }
      }, delayMs);
      logger.info(`Crossfade to "${symbol}" has no stem; fading drone out.`);
    }
  }

  /** Stop ALL drone audio with a short fade so ending a take doesn't click, then tear down. */
  stop(): void {
    const now = this.ctx.currentTime;
    for (const deck of [this.active, this.incoming]) {
      if (!deck) continue;
      try {
        deck.gain.gain.cancelScheduledValues(now);
        deck.gain.gain.setValueAtTime(deck.gain.gain.value, now);
        deck.gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_SEC);
        deck.source.stop(now + STOP_FADE_SEC + 0.01);
      } catch {
        this.teardown(deck);
      }
    }
    // Disconnect after the fade so we don't cut it short.
    const captured = [this.active, this.incoming];
    const capturedMaster = this.master;
    window.setTimeout(() => {
      captured.forEach((d) => this.teardown(d));
      capturedMaster?.disconnect();
    }, (STOP_FADE_SEC + 0.05) * 1000);
    this.active = null;
    this.incoming = null;
    this.target = null;
    // Drop the master so the next take rebuilds it fresh (re-applying enabled/volume).
    this.master = null;
  }
}
