/**
 * Tests for SignalsmithAdapter BUFFER-STREAMING mode (time-stretch).
 *
 * Buffer-streaming is how we get true pitch-independent time-stretch: the
 * worklet plays its OWN buffer (loaded via addBuffers) and honors `rate`
 * (tempo) + `semitones` (pitch) independently. The load-bearing invariants:
 *
 *   1. NOTHING is connected to the worklet's INPUT — a connected input
 *      silently flips the WASM back to live-input mode and `rate` is ignored.
 *      So sg.connect(...) is the worklet's OUTPUT → relay only; no
 *      relay.connect(sg) / input.connect(sg) may ever happen.
 *   2. addBuffers is called with the stem PCM.
 *   3. rate (tempo) and semitones (pitch) are independent schedule() fields.
 *   4. start is deferred to a transport-aligned time, not called at creation.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const created: FakeWorklet[] = [];

interface FakeWorklet {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  schedule: ReturnType<typeof vi.fn>;
  configure: ReturnType<typeof vi.fn>;
  latency: ReturnType<typeof vi.fn>;
  addBuffers: ReturnType<typeof vi.fn>;
  dropBuffers: ReturnType<typeof vi.fn>;
}

function makeWorklet(): FakeWorklet {
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    stop: vi.fn(),
    start: vi.fn(),
    schedule: vi.fn(),
    configure: vi.fn(),
    latency: vi.fn(() => 0.12),
    addBuffers: vi.fn(async () => 2),
    dropBuffers: vi.fn(),
  };
}

vi.mock('signalsmith-stretch', () => ({
  default: vi.fn(async () => {
    const w = makeWorklet();
    created.push(w);
    return w;
  }),
}));

import { createPitchShiftAdapter } from '../PitchShiftAdapter.js';

const log = { info: vi.fn(), warn: vi.fn(), debug: vi.fn() };

function makeGain(): AudioNode {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as AudioNode;
}

function makeCtx(currentTime = 0): AudioContext {
  return {
    currentTime,
    createGain: () => makeGain(),
  } as unknown as AudioContext;
}

/** A stereo 2-second stem (values don't matter, only shape/length). */
function makePcm(): Float32Array[] {
  return [new Float32Array(88200), new Float32Array(88200)];
}

async function settle() {
  // Two microtask turns: factory.then + the inner await sg.addBuffers.
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('SignalsmithAdapter.createBufferStreamingNode', () => {
  beforeEach(() => {
    created.length = 0;
    vi.clearAllMocks();
  });

  it('loads PCM and arms a full-buffer loop WITHOUT connecting the worklet input', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx);

    const gain = makeGain();
    const relay = adapter.createBufferStreamingNode(
      ctx,
      gain,
      makePcm(),
      2,
      'bass',
    )!;
    expect(relay).toBeTruthy();

    await settle();
    expect(created.length).toBe(1);
    const sg = created[0];

    // (2) PCM loaded.
    expect(sg.addBuffers).toHaveBeenCalledTimes(1);

    // (1) THE MODE GUARD: the worklet's output connects to the relay, and
    // nothing is ever connected INTO the worklet. The relay must never
    // connect to sg (that would feed the input and kill buffer-streaming).
    expect(sg.connect).toHaveBeenCalledWith(relay);
    expect((gain as any).connect).not.toHaveBeenCalledWith(sg);
    // The relay (the node the engine holds) connects only downstream → gain.
    // It must NOT connect to the worklet.
    const relayConnect = (relay as any).connect as ReturnType<typeof vi.fn>;
    for (const call of relayConnect.mock.calls) {
      expect(call[0]).not.toBe(sg);
    }

    // Armed as a full-buffer loop but INACTIVE (silent) until
    // startBufferStreaming() flips it active at the transport-aligned T0 —
    // arming active here would play the stem immediately on creation, before
    // the count-in.
    const armCall = sg.schedule.mock.calls.find(
      (c) => c[0]?.active === false,
    )?.[0];
    expect(armCall).toBeTruthy();
    expect(armCall.loopStart).toBe(0);
    expect(armCall.loopEnd).toBe(2);
    expect(sg.start).not.toHaveBeenCalled();
  });

  it('startBufferStreaming starts the worklet at the scheduled time + offset', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx(10);
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      makePcm(),
      2,
      'harmony',
    )!;
    await settle();

    adapter.startBufferStreaming(relay, 12.5, 0);
    expect(created[0].start).toHaveBeenCalledWith(12.5, 0);
  });

  it('queues a start requested BEFORE the worklet resolves and fires it on arrival', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      makePcm(),
      2,
      'bass',
    )!;

    // Start requested synchronously, before the async splice has resolved:
    // it must be stashed as a pending start (not lost).
    adapter.startBufferStreaming(relay, 5, 0);
    expect((relay as any).__pendingStart).toEqual({ when: 5, offset: 0 });

    // On resolution the pending start fires and is cleared.
    await settle();
    expect(created[0].start).toHaveBeenCalledWith(5, 0);
    expect((relay as any).__pendingStart).toBeUndefined();
  });

  it('setRate changes tempo independently of pitch (rate field, no semitones)', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx(0);
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      makePcm(),
      2,
      'bass',
    )!;
    await settle();
    const sg = created[0];
    sg.schedule.mockClear();

    // Future boundary → scheduled at output.
    adapter.setRate(relay, 0.8, ctx, 3.0);
    expect(sg.schedule).toHaveBeenCalledWith(
      expect.objectContaining({ rate: 0.8, output: 3.0 }),
    );
    // A rate change carries the CURRENTLY-AUDIBLE semitones (0 here, since no
    // key was set) so the tempo change doesn't disturb pitch — signalsmith
    // models pitch+rate on one segment timeline, so a bare {rate} would pop a
    // pending key change and fold it in. The pitch field tracks the audible
    // value, it does NOT introduce a new transposition.
    const rateCall = sg.schedule.mock.calls.at(-1)?.[0];
    expect(rateCall.semitones).toBe(0);
  });

  it('a PENDING key anchors to the keyBoundaryOverride (drum downbeat), NOT a re-derived seam', async () => {
    // The engine passes the DRUM loop "one" (a stable, state-anchored downbeat)
    // as keyBoundaryOverride. The pending key must re-issue at EXACTLY that —
    // identical across many tempo clicks — so it lands where the drums land,
    // instead of re-deriving its own read-head seam (which drifts per click).
    const adapter = createPitchShiftAdapter(log) as any;
    const ctx = makeCtx(0);
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx, makeGain(), makePcm(), 2, 'bass',
    )!;
    await settle();
    const sg = created[0];
    (relay as any).__bufferDuration = 2;
    (relay as any).__signalsmith = { ...sg, inputTime: 0.5 };
    (relay as any).__deferredSemitones = 4; // a key is pending
    sg.schedule.mockClear();

    // Three "tempo clicks", each with a DIFFERENT read-head but the SAME drum
    // downbeat override (the drum grid is stable). The re-issued key must use the
    // override every time, regardless of the wandering read-head.
    const DRUM_DOWNBEAT = 7.5;
    for (const inputTime of [0.5, 0.9, 1.3]) {
      (relay as any).__signalsmith.inputTime = inputTime;
      adapter.setRate(relay, 1.05, ctx, 0.02, 0, DRUM_DOWNBEAT);
      // the deferred key segment was re-issued at the override, exactly
      const keyCall = sg.schedule.mock.calls
        .map((c: any[]) => c[0])
        .reverse()
        .find((o: any) => o && o.semitones === 4 && typeof o.output === 'number');
      expect(keyCall.output).toBe(DRUM_DOWNBEAT);
      expect((relay as any).__deferredSemitonesOutput).toBe(DRUM_DOWNBEAT);
    }
  });

  it('setSemitones changes pitch without sending a rate field (tempo independent)', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx(0);
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      makePcm(),
      2,
      'bass',
    )!;
    await settle();
    const sg = created[0];
    sg.schedule.mockClear();

    adapter.setSemitones(relay, 3, ctx, 4.0);
    const call = sg.schedule.mock.calls.at(-1)?.[0];
    expect(call.semitones).toBe(3);
    expect(call.output).toBe(4.0);
    // No rate field → the prior segment's rate persists (signalsmith inherits
    // omitted fields), so a key change doesn't reset tempo.
    expect('rate' in call).toBe(false);
  });

  it('a PENDING key stays locked to its musical seam across MANY incremental tempo clicks', async () => {
    // REGRESSION GUARD for the measured "key drifts by the tempo-click pattern"
    // bug. A key is deferred to the next loop seam. Then the user clicks tempo
    // one BPM at a time (many setRate calls) while the key is pending. Each click
    // re-derives the key's output seam. The seam is a FIXED INPUT position (the
    // read-head wrap); its OUTPUT time must scale ONLY with the rate — it must
    // NOT drift from re-sampling a noisy raw read-head or mis-charging the
    // applyAhead window. We advance a controllable read-head + clock and assert
    // every re-derived output maps the SAME input-until-seam at the live rate.
    const adapter = createPitchShiftAdapter(log) as any;
    let t = 0;
    const ctx = {
      get currentTime() { return t; },
      createGain: () => makeGain(),
    } as unknown as AudioContext;
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx, makeGain(), makePcm(), 2, 'bass',
    )!;
    await settle();
    const sg = created[0];
    const BUF = 2; // 2s loop
    (relay as any).__bufferDuration = BUF;
    (relay as any).__signalsmith = { ...sg, inputTime: 0 };
    const SG = (relay as any).__signalsmith;

    // Defer a key (+5) to the next seam at the current (rate 1) read-head.
    SG.inputTime = 0.4; t = 0;
    (relay as any).__phaseStamp = { inputTime: 0.4, atTime: 0, rate: 1 };
    (relay as any).__currentRate = 1;
    (relay as any).__deferredSemitones = 5;

    // Simulate a series of +1-BPM tempo clicks (rate 1.00 → 1.08), advancing the
    // read-head + clock between clicks. After each, compute the implied input-
    // until-seam from the stored output: a correct (drift-free) implementation
    // keeps the input position the key lands at CONSTANT across all clicks.
    const ratesAndTimes = [
      { rate: 1.02, dt: 0.2 },
      { rate: 1.04, dt: 0.2 },
      { rate: 1.06, dt: 0.2 },
      { rate: 1.08, dt: 0.2 },
    ];
    const seamInputs: number[] = [];
    let prevRate = 1;
    for (const step of ratesAndTimes) {
      // advance the continuous read-head at the PREVIOUS rate
      t += step.dt;
      SG.inputTime = 0.4 + (t * prevRate); // monotonic, unwrapped-ish for short span
      // keep the stamp consistent with the advancing head (as the engine would)
      (relay as any).__phaseStamp = { inputTime: SG.inputTime, atTime: t, rate: prevRate };
      adapter.setRate(relay, step.rate, ctx, t + 0.02 /* applyAhead */);
      const out = (relay as any).__deferredSemitonesOutput as number;
      // Back out the input position the key lands at from the stored output. The
      // worklet runs [t, rateOutput) at prevRate then `rate`; invert the blend:
      const rateOutput = t + 0.02;
      // strip the audible offset (0 in this test path: no outputLatency on mock ctx)
      const inputUntilSeam =
        (out - rateOutput) * step.rate + 0.02 * prevRate;
      const seamInputAbs = SG.inputTime + inputUntilSeam;
      seamInputs.push(seamInputAbs);
      prevRate = step.rate;
    }
    // The ABSOLUTE input position of the seam the key lands at must be the SAME
    // across every click (the next wrap of a fixed buffer) — drift-free.
    const spread = Math.max(...seamInputs) - Math.min(...seamInputs);
    expect(spread).toBeLessThan(0.01); // < 10ms of INPUT — no per-click drift
  });

  it('folds a pre-resolution rate into the initial arm schedule', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx(0);
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      makePcm(),
      2,
      'bass',
    )!;

    // Rate set before resolution → stashed, then folded into the (inactive)
    // arm schedule so the node starts at the right tempo when activated.
    adapter.setRate(relay, 1.25, ctx);
    await settle();

    const armCall = created[0].schedule.mock.calls.find(
      (c) => c[0]?.active === false,
    )?.[0];
    expect(armCall).toBeTruthy();
    expect(armCall.rate).toBe(1.25);
  });

  it('returns null and stays silent for an empty buffer', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx);
    const node = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      [],
      0,
      'bass',
    );
    expect(node).toBeNull();
  });

  it('disposeNode tears down a buffer-streaming worklet too', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx);
    const relay = adapter.createBufferStreamingNode(
      ctx,
      makeGain(),
      makePcm(),
      2,
      'bass',
    )!;
    await settle();
    adapter.disposeNode(relay);
    expect(created[0].stop).toHaveBeenCalled();
    expect(created[0].disconnect).toHaveBeenCalled();
    expect((relay as any).__signalsmith).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// nextSeamOutputTime — the loop-seam computation for KEY-change quantization.
//
// REGRESSION COVERAGE for the intermittent "key lands a full loop late" bug.
// The seam is the read-head wrap (input position == bufferDuration), mapped to
// an OUTPUT time at the live rate. Two properties under test:
//   (1) CONTINUOUS read-head — interpolate from the throttled (~8ms) sg.inputTime
//       snapshot via __phaseStamp so it never lies across the wrap.
//   (2) SEAM-IMMINENT GUARD — an about-to-wrap read-head resolves to the imminent
//       seam (now), never a full loop late.
// ──────────────────────────────────────────────────────────────────────────
describe('SignalsmithAdapter.nextSeamOutputTime', () => {
  beforeEach(() => {
    created.length = 0;
    vi.clearAllMocks();
  });

  // Build a relay with a controllable read-head. bufferDuration = 2s loop.
  function makeStretchRelay(opts: {
    inputTime: number;
    phaseStamp?: { inputTime: number; atTime: number; rate: number };
    currentRate?: number;
    bufferDuration?: number;
  }) {
    const relay: any = {
      __signalsmith: { inputTime: opts.inputTime },
      __bufferDuration: opts.bufferDuration ?? 2,
    };
    if (opts.phaseStamp) relay.__phaseStamp = opts.phaseStamp;
    if (opts.currentRate != null) relay.__currentRate = opts.currentRate;
    return relay;
  }

  it('maps the read-head to the next seam output time at rate 1 (mid-loop)', () => {
    const adapter = createPitchShiftAdapter(log) as any;
    const ctx = makeCtx(100);
    // Read-head at 0.5s into a 2s loop → 1.5s of input until the seam → at rate
    // 1 that's 1.5s of output → seam at now(100) + 1.5 = 101.5.
    const relay = makeStretchRelay({ inputTime: 0.5 });
    expect(adapter.nextSeamOutputTime(relay, ctx, 1)).toBeCloseTo(101.5, 6);
  });

  it('scales the seam output time by rate (slower = farther in wall-clock)', () => {
    const adapter = createPitchShiftAdapter(log) as any;
    const ctx = makeCtx(100);
    const relay = makeStretchRelay({ inputTime: 0.5 });
    // 1.5s of INPUT until seam, played at rate 0.5 → 3.0s of OUTPUT.
    expect(adapter.nextSeamOutputTime(relay, ctx, 0.5)).toBeCloseTo(103.0, 6);
    // At rate 2 → 0.75s of output.
    expect(adapter.nextSeamOutputTime(relay, ctx, 2)).toBeCloseTo(100.75, 6);
  });

  it('INTERPOLATES a stale snapshot forward — does NOT return a stale seam', () => {
    const adapter = createPitchShiftAdapter(log) as any;
    // The worklet last posted inputTime=0.5 at audio-time 100 (rate 1). Now it's
    // 100.3 but the worklet HASN'T posted again (sg.inputTime still 0.5). The
    // continuous read-head must be 0.5 + 0.3 = 0.8, NOT the stale 0.5.
    const ctx = makeCtx(100.3);
    const relay = makeStretchRelay({
      inputTime: 0.5, // stale snapshot, unchanged since the stamp
      phaseStamp: { inputTime: 0.5, atTime: 100, rate: 1 },
      currentRate: 1,
    });
    // Interpolated read-head = 0.8 → 1.2s until seam → seam at 100.3 + 1.2 = 101.5.
    // (A stale read of 0.5 would wrongly give 100.3 + 1.5 = 101.8.)
    expect(adapter.nextSeamOutputTime(relay, ctx, 1)).toBeCloseTo(101.5, 6);
  });

  it('SEAM-IMMINENT GUARD: a read-head about to wrap resolves to NOW, not a full loop late', () => {
    const adapter = createPitchShiftAdapter(log) as any;
    // Read-head at 1.999 of a 2s loop — ~1ms before the wrap. The raw modulo
    // gives inputUntilSeam ≈ 0.001 → fine; the guard snaps it to exactly now so
    // a sub-ms jitter can't flip it to ~2s (a full loop late).
    const ctx = makeCtx(100);
    const relay = makeStretchRelay({
      inputTime: 1.999,
      phaseStamp: { inputTime: 1.999, atTime: 100, rate: 1 },
      currentRate: 1,
    });
    const seam = adapter.nextSeamOutputTime(relay, ctx, 1);
    // Imminent → snapped to now (100), NOT ~102 (a full loop).
    expect(seam).toBeCloseTo(100, 3);
    expect(seam).toBeLessThan(100.05);
  });

  it('a JUST-WRAPPED read-head is correctly a FULL loop away (not snapped to now)', () => {
    const adapter = createPitchShiftAdapter(log) as any;
    // Read-head at 0.02s — just past the wrap. The next seam is genuinely ~a full
    // loop away. The continuous interpolation disambiguates this from "about to
    // wrap", so it must NOT snap to now.
    const ctx = makeCtx(100);
    const relay = makeStretchRelay({
      inputTime: 0.02,
      phaseStamp: { inputTime: 0.02, atTime: 100, rate: 1 },
      currentRate: 1,
    });
    const seam = adapter.nextSeamOutputTime(relay, ctx, 1);
    // ~1.98s until the next seam → ~101.98, a full loop out. NOT 100.
    expect(seam).toBeCloseTo(101.98, 2);
  });

  it('returns undefined when the read-head / buffer is unknown', () => {
    const adapter = createPitchShiftAdapter(log) as any;
    const ctx = makeCtx(100);
    expect(
      adapter.nextSeamOutputTime({ __bufferDuration: 2 }, ctx, 1),
    ).toBeUndefined();
    expect(
      adapter.nextSeamOutputTime(
        { __signalsmith: { inputTime: 0.5 } },
        ctx,
        1,
      ),
    ).toBeUndefined();
  });

  it('does NOT jump by seconds across a rate change (stale-stamp guard)', () => {
    // REGRESSION GUARD for the measured tempo-while-pending bug: the seam jumped
    // ±1.5–3.8s after a tempo change because the read-head was extrapolated with
    // the OLD stamp rate while the output was divided by the NEW rate. With a
    // stamp whose rate disagrees with the requested rate, nextSeamOutputTime must
    // re-stamp (use the raw inputTime, no stale extrapolation), NOT produce a
    // multi-second seam.
    const adapter = createPitchShiftAdapter(log) as any;
    const ctx = makeCtx(100);
    // Read-head at 0.5 of a 2s loop. A stamp from 0.3s ago carries the OLD rate 1.
    const relay = makeStretchRelay({
      inputTime: 0.5,
      phaseStamp: { inputTime: 0.5, atTime: 99.7, rate: 1 },
      currentRate: 1.18, // tempo just changed to a faster rate
    });
    // Asked for the NEW rate. Because stamp.rate (1) !== r (1.18), it re-stamps
    // from the raw inputTime (0.5) → inputUntilSeam = 1.5 → seam = 100 + 1.5/1.18.
    const seam = adapter.nextSeamOutputTime(relay, ctx, 1.18);
    expect(seam).toBeCloseTo(100 + 1.5 / 1.18, 4);
    // It must be ~1.27s out, NOT seconds-scale wrong (the bug gave ~10s × ratio).
    expect(seam - 100).toBeLessThan(2);
    // And the stamp is now re-anchored at the new rate for subsequent reads.
    expect((relay as any).__phaseStamp.rate).toBe(1.18);
  });
});
