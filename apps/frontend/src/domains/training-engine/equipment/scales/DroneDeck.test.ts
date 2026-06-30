import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// loadDroneStem is mocked per-test so we control which symbols "have a stem". A truthy
// buffer = an uploaded .ogg; null = a missing one (404). Hoisted so the vi.mock factory sees it.
const { loadDroneStem } = vi.hoisted(() => ({ loadDroneStem: vi.fn() }));
vi.mock('./droneStem', () => ({ loadDroneStem }));
vi.mock('@/utils/logger.js', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { DroneDeck, nextBarBoundary } from './DroneDeck';

// ── Minimal Web Audio mock ────────────────────────────────────────────────────
// Records the gain-curve scheduling so we can assert the equal-power crossfade. Each
// GainNode logs its setValueCurveAtTime calls; each source logs start/stop.

interface CurveCall {
  curve: Float32Array;
  startTime: number;
  duration: number;
}

class MockParam {
  value = 1;
  curves: CurveCall[] = [];
  setValueAtTime = vi.fn((v: number) => {
    this.value = v;
    return this;
  });
  setValueCurveAtTime = vi.fn(
    (curve: Float32Array, startTime: number, duration: number) => {
      this.curves.push({ curve, startTime, duration });
      return this;
    },
  );
  cancelScheduledValues = vi.fn(() => this);
  linearRampToValueAtTime = vi.fn(() => this);
}

// The audio graph per deck is now:  copySource → copyGain → DECK gain → MASTER gain → dest.
// (The SelfLooper schedules one or more buffer COPIES, each with its own copyGain, into the
// single deck gain so the buffer loops by crossfading into itself.) We tag each gain by what
// connects INTO it so tests can pick the deck gains + master without counting copies.
class MockGain {
  gain = new MockParam();
  /** True once a SOURCE connected into this gain → it's a per-copy gain (inside a looper). */
  fedBySource = false;
  /** True once this gain CONNECTS INTO another gain → it's a deck gain (decks connect into the
   *  master). Set on the SOURCE gain at connect time, so it's true the moment makeDeck wires
   *  the deck gain → master, even before the looper has scheduled any copy. */
  connectsToGain = false;
  connect = vi.fn((dest: unknown) => {
    if (dest instanceof MockGain) this.connectsToGain = true;
  });
  disconnect = vi.fn();
}

class MockSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  started: number | null = null;
  stopped = false;
  onended: (() => void) | null = null;
  connect = vi.fn((dest: unknown) => {
    if (dest instanceof MockGain) dest.fedBySource = true;
  });
  disconnect = vi.fn();
  start = vi.fn((t: number) => {
    this.started = t;
  });
  stop = vi.fn(() => {
    this.stopped = true;
  });
}

class MockCtx {
  currentTime = 0;
  destination = {} as AudioNode;
  sources: MockSource[] = [];
  gains: MockGain[] = [];
  createBufferSource = vi.fn(() => {
    const s = new MockSource();
    this.sources.push(s);
    return s as unknown as AudioBufferSourceNode;
  });
  createGain = vi.fn(() => {
    const g = new MockGain();
    this.gains.push(g);
    return g as unknown as GainNode;
  });

  /** The master gain: the deck builds it FIRST (getMaster() before any deck/copy gain), so
   *  it's gains[0]. It connects to the destination, not into another gain. */
  get master(): MockGain | undefined {
    return this.gains[0];
  }
  /** DECK gains — gains that connect INTO another gain (the master) but are NOT themselves fed
   *  by a source. (Copy gains also connect into a gain, but they ARE source-fed → excluded.)
   *  Tagged at wire time, so a deck counts even before its looper schedules a copy. */
  get deckGains(): MockGain[] {
    return this.gains.filter(
      (g) => g !== this.master && g.connectsToGain && !g.fedBySource,
    );
  }
  /** COPY gains — the per-copy looper gains (fed directly by a source). */
  get copyGains(): MockGain[] {
    return this.gains.filter((g) => g.fedBySource);
  }
  /** DECK gains still WIRED IN (disconnect() never called) — i.e. decks that can still sound.
   *  The leak detector: more than ~2 of these mid-fade, or >1 after fades settle, = stacking. */
  get connectedDeckGains(): MockGain[] {
    return this.deckGains.filter((g) => g.disconnect.mock.calls.length === 0);
  }
}

const fakeBuffer = (label: string, duration = 4) =>
  ({ label, duration }) as unknown as AudioBuffer;

beforeEach(() => {
  vi.clearAllMocks();
  // Toggle setTimeout/setInterval to fake without faking the timer globals jsdom's window
  // teardown needs (clearInterval/clearTimeout) — faking ALL of them makes jsdom's close()
  // throw "clearInterval is not defined" on teardown.
  vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval'] });
  // Default: every symbol has a stem.
  loadDroneStem.mockImplementation(async (symbol: string) => fakeBuffer(symbol));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('nextBarBoundary — bar-aligned transition scheduling', () => {
  it('returns the first bar edge strictly after now (+lookahead)', () => {
    // loopStart 10, 2s bars, now 11 (mid-bar-0), lookahead 0.15 → next edge is bar 1 = 12.
    expect(nextBarBoundary(11, 10, 2, 0.15)).toBe(12);
  });

  it('a now sitting just before a bar edge pushes to the NEXT bar (lookahead guard)', () => {
    // now 11.9 + 0.15 lookahead = 12.05 → already past bar-1 edge (12) → schedule bar 2 = 14.
    expect(nextBarBoundary(11.9, 10, 2, 0.15)).toBe(14);
  });

  it('exactly on a bar edge schedules the following bar (never "now")', () => {
    expect(nextBarBoundary(12, 10, 2, 0.15)).toBe(14);
  });

  it('degenerate bar length is floored to max(now, loopStart)', () => {
    expect(nextBarBoundary(11, 10, 0, 0.15)).toBe(11);
  });
});

describe('DroneDeck.start — the first drone of a take', () => {
  it('starts the self-loop at the given time, with the deck gain at full level', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 5);

    // The self-looper scheduled at least one buffer copy; the FIRST copy starts at 5.
    expect(ctx.sources.length).toBeGreaterThan(0);
    expect(ctx.sources[0]!.started).toBe(5);
    // The deck gain (fed by the copy gains) sits at full level — chord crossfade rides on it.
    expect(ctx.deckGains).toHaveLength(1);
    expect(ctx.deckGains[0]!.gain.value).toBe(1);
    expect(deck.targetSymbol).toBe('Cmaj7');
  });

  it('a missing stem (null) plays dry — no source, no throw, but target still records intent', async () => {
    loadDroneStem.mockResolvedValueOnce(null);
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('F#7', 0);
    expect(ctx.sources).toHaveLength(0); // dry — no audio node built
    expect(ctx.deckGains).toHaveLength(0);
    // target tracks INTENT (the drone is "set to F#7", it just has no .ogg) so a later dial
    // to a different key still triggers a transition and isn't swallowed by the no-op guard.
    expect(deck.targetSymbol).toBe('F#7');
  });
});

describe('DroneDeck.crossfadeTo — the blend between tonal centres', () => {
  it('schedules an equal-power crossfade: old ramps down (cos→0), new ramps up (sin→0→1)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const oldGain = ctx.deckGains[0]!;

    ctx.currentTime = 4;
    await deck.crossfadeTo('Dmaj7', 6, 0.7); // transition at t=6, 0.7s blend
    const newGain = ctx.deckGains[1]!;

    // OUTGOING: one curve, starts at 6, lasts 0.7, begins at 1, ends at 0.
    expect(oldGain.gain.curves).toHaveLength(1);
    const out = oldGain.gain.curves[0]!;
    expect(out.startTime).toBe(6);
    expect(out.duration).toBeCloseTo(0.7);
    expect(out.curve[0]).toBeCloseTo(1);
    expect(out.curve[out.curve.length - 1]).toBeCloseTo(0);

    // INCOMING: one curve, same window, begins at 0, ends at 1.
    expect(newGain.gain.curves).toHaveLength(1);
    const inc = newGain.gain.curves[0]!;
    expect(inc.startTime).toBe(6);
    expect(inc.curve[0]).toBeCloseTo(0);
    expect(inc.curve[inc.curve.length - 1]).toBeCloseTo(1);

    // EQUAL POWER: at every sample, out² + in² ≈ 1 (constant perceived loudness).
    for (let i = 0; i < out.curve.length; i++) {
      const sum = out.curve[i]! ** 2 + inc.curve[i]! ** 2;
      expect(sum).toBeCloseTo(1, 5);
    }

    // The incoming deck's self-loop starts AT the fade start — its FIRST new copy (the first
    // source created after the crossfade began) starts at t=6 so it's audible as the deck
    // gain rises.
    const incomingFirstSrc = ctx.sources.find((s) => s.started === 6);
    expect(incomingFirstSrc).toBeDefined();
  });

  it('promotes the incoming deck to active after the fade completes (old torn down)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const oldSrc = ctx.sources[0]!;

    ctx.currentTime = 0;
    await deck.crossfadeTo('Dmaj7', 1, 0.7);
    expect(deck.targetSymbol).toBe('Dmaj7'); // heading there immediately

    // Advance wall-clock past the fade end (1 + 0.7) and let the promotion timer fire.
    ctx.currentTime = 2;
    vi.advanceTimersByTime(2000);
    expect(oldSrc.stopped).toBe(true); // old deck released
    expect(deck.targetSymbol).toBe('Dmaj7');
  });

  it('is a no-op when already heading to the same symbol (no stacked fade)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const decksBefore = ctx.deckGains.length;
    await deck.crossfadeTo('Cmaj7', 4, 0.7);
    expect(ctx.deckGains.length).toBe(decksBefore); // no new deck built
  });

  it('crossfading TO a missing stem fades the current drone out (goes quiet, no throw)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const oldGain = ctx.deckGains[0]!;

    loadDroneStem.mockResolvedValueOnce(null); // the target symbol has no .ogg yet
    ctx.currentTime = 0;
    await deck.crossfadeTo('F#7', 1, 0.7);

    // Outgoing deck gets a fade-OUT curve; no incoming deck was built (the stem is missing).
    expect(oldGain.gain.curves).toHaveLength(1);
    expect(oldGain.gain.curves[0]!.curve[oldGain.gain.curves[0]!.curve.length - 1]).toBeCloseTo(0);
    expect(ctx.deckGains).toHaveLength(1); // only the original deck
    expect(deck.targetSymbol).toBe('F#7');
  });

  it('rapid back-to-back crossfades only ever blend between TWO decks', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);

    ctx.currentTime = 0;
    await deck.crossfadeTo('Dmaj7', 1, 0.7); // Cmaj7 → Dmaj7
    await deck.crossfadeTo('Emaj7', 1, 0.7); // immediately Dmaj7 → Emaj7

    // The last target wins; only ever the decks we built (≤3 deck gains over the run: the
    // original + the two incoming), the earliest torn down on promotion. (Each deck has many
    // looper copies, so we count DECK gains, not raw sources.)
    expect(deck.targetSymbol).toBe('Emaj7');
    expect(ctx.deckGains.length).toBeLessThanOrEqual(3);
  });

  it('many crossfades over a long run leave exactly ONE deck connected (no stacking)', async () => {
    // Reproduces the reported bug: after travelling for a while, clicking through chords
    // stacked them. Fire a long sequence of crossfades, run all timers, then assert only the
    // FINAL deck is still wired in — every superseded deck was torn down.
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);

    const symbols = ['Dmaj7', 'Emaj7', 'Fmaj7', 'Gmaj7', 'Amaj7', 'Bmaj7', 'Cmaj7'];
    let t = 0;
    for (const sym of symbols) {
      t += 1;
      ctx.currentTime = t;
      await deck.crossfadeTo(sym, t, 0.7);
    }
    // Let every promotion/teardown timer fire. advanceTimersByTime (not runAllTimers — the
    // looper's 500ms poll is an endless interval that would spin forever) past the last fade.
    ctx.currentTime = t + 5;
    await vi.advanceTimersByTimeAsync(2000);

    expect(deck.targetSymbol).toBe('Cmaj7');
    // The whole point: exactly one deck still sounds, not a stack of them.
    expect(ctx.connectedDeckGains).toHaveLength(1);
  });

  it('overlapping crossfades that interleave across the await never orphan a deck', async () => {
    // Two crossfades launched WITHOUT awaiting the first — the time-transposer firing while the
    // user clicks a chord. Serialization must keep the bookkeeping atomic so no deck leaks.
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    ctx.currentTime = 0;

    const p1 = deck.crossfadeTo('Dmaj7', 1, 0.7);
    const p2 = deck.crossfadeTo('Emaj7', 1, 0.7); // fired before p1 resolves
    await Promise.all([p1, p2]);
    ctx.currentTime = 5;
    await vi.advanceTimersByTimeAsync(2000);

    expect(deck.targetSymbol).toBe('Emaj7');
    expect(ctx.connectedDeckGains).toHaveLength(1);
  });
});

describe('DroneDeck on/off + level — the drone UI controls', () => {
  it('decks route through a single MASTER gain (not straight to destination)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    // Exactly one master + one per-deck gain.
    expect(ctx.master).toBeDefined();
    expect(ctx.deckGains).toHaveLength(1);
  });

  it('setEnabled(false) ramps the master toward 0 (mute) and restores on re-enable', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const master = ctx.master!;

    deck.setEnabled(false);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, expect.any(Number));

    deck.setVolume(0.6);
    deck.setEnabled(true);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.6, expect.any(Number));
  });

  it('setVolume glides the master while enabled and is clamped to 0..1', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const master = ctx.master!;

    deck.setVolume(0.5);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0.5, expect.any(Number));

    deck.setVolume(2); // clamped down to 1
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(1, expect.any(Number));
  });

  it('a muted drone stays muted across a key change (crossfade routes through master)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    deck.setEnabled(false);

    const masterBefore = ctx.master;
    ctx.currentTime = 0;
    await deck.crossfadeTo('Dmaj7', 1, 0.7);
    // No NEW master is created — the incoming deck connects to the same muted master, so the
    // crossfade is inaudible until the user re-enables. (gains[0] is still the one master.)
    expect(ctx.master).toBe(masterBefore);
    expect(ctx.deckGains.length).toBeLessThanOrEqual(2); // two decks at most during the blend
  });
});

describe('DroneDeck.stop — ending a take cleanly', () => {
  it('fades to silence then tears down both decks', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const src = ctx.sources[0]!;

    deck.stop();
    expect(deck.targetSymbol).toBe(null);
    // The short fade is scheduled, then teardown fires on the timer.
    vi.advanceTimersByTime(500);
    expect(src.stopped).toBe(true);
  });
});
