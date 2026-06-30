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

class MockGain {
  gain = new MockParam();
  /** True once a SOURCE has connected into this gain — i.e. it's a per-deck gain, not the
   *  master (the master only ever has gains connected to it). */
  fedBySource = false;
  connect = vi.fn();
  disconnect = vi.fn();
}

class MockSource {
  buffer: AudioBuffer | null = null;
  loop = false;
  started: number | null = null;
  stopped = false;
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

  /** Per-deck gains (fed by a source), in creation order. */
  get deckGains(): MockGain[] {
    return this.gains.filter((g) => g.fedBySource);
  }
  /** The master gain (the one NOT fed by a source — decks connect INTO it). */
  get master(): MockGain | undefined {
    return this.gains.find((g) => !g.fedBySource);
  }
}

const fakeBuffer = (label: string) => ({ label }) as unknown as AudioBuffer;

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
  it('plays the loaded buffer at the given time, looping, at full gain', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 5);

    expect(ctx.sources).toHaveLength(1);
    const src = ctx.sources[0]!;
    expect(src.loop).toBe(true);
    expect(src.started).toBe(5);
    expect(ctx.deckGains[0]!.gain.value).toBe(1);
    expect(deck.targetSymbol).toBe('Cmaj7');
  });

  it('a missing stem (null) plays dry — no source, no throw, but target still records intent', async () => {
    loadDroneStem.mockResolvedValueOnce(null);
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('F#7', 0);
    expect(ctx.sources).toHaveLength(0); // dry — no audio node built
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

    // The incoming source starts AT the fade start (so it's audible as it rises).
    expect(ctx.sources[1]!.started).toBe(6);
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
    const sourcesBefore = ctx.sources.length;
    await deck.crossfadeTo('Cmaj7', 4, 0.7);
    expect(ctx.sources.length).toBe(sourcesBefore); // no new deck built
  });

  it('crossfading TO a missing stem fades the current drone out (goes quiet, no throw)', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);
    const oldGain = ctx.deckGains[0]!;

    loadDroneStem.mockResolvedValueOnce(null); // the target symbol has no .ogg yet
    ctx.currentTime = 0;
    await deck.crossfadeTo('F#7', 1, 0.7);

    // Outgoing still gets a fade-OUT curve; no incoming source was created.
    expect(oldGain.gain.curves).toHaveLength(1);
    expect(oldGain.gain.curves[0]!.curve[oldGain.gain.curves[0]!.curve.length - 1]).toBeCloseTo(0);
    expect(ctx.sources).toHaveLength(1); // only the original
    expect(deck.targetSymbol).toBe('F#7');
  });

  it('rapid back-to-back crossfades only ever blend between TWO decks', async () => {
    const ctx = new MockCtx();
    const deck = new DroneDeck(ctx as unknown as AudioContext);
    await deck.start('Cmaj7', 0);

    ctx.currentTime = 0;
    await deck.crossfadeTo('Dmaj7', 1, 0.7); // Cmaj7 → Dmaj7
    await deck.crossfadeTo('Emaj7', 1, 0.7); // immediately Dmaj7 → Emaj7

    // The last target wins; we never leak more than the decks we built (3 sources total:
    // the original + the two incoming), and the earliest is torn down on promotion.
    expect(deck.targetSymbol).toBe('Emaj7');
    expect(ctx.sources.length).toBeLessThanOrEqual(3);
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

    ctx.currentTime = 0;
    await deck.crossfadeTo('Dmaj7', 1, 0.7);
    // No NEW master is created — the incoming deck connects to the same muted master, so the
    // crossfade is inaudible until the user re-enables.
    expect(ctx.gains.filter((g) => !g.fedBySource)).toHaveLength(1);
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
