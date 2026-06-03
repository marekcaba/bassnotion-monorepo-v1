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
