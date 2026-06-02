/**
 * Tests for SignalsmithAdapter teardown (the "spike after N plays" fix).
 *
 * The bug: the engine holds a relay GainNode, but the real Signalsmith
 * worklet splices in ASYNC behind it. A blind relay.disconnect() left the
 * live worklet connected to the shared instrument gain, leaking one per
 * play. disposeNode() must fully stop+disconnect the worklet, and a splice
 * that resolves AFTER disposal must not connect a dead node into the gain.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mock signalsmith-stretch: factory returns a fake worklet we can spy on.
const created: FakeWorklet[] = [];

interface FakeWorklet {
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  schedule: ReturnType<typeof vi.fn>;
  configure: ReturnType<typeof vi.fn>;
  latency: ReturnType<typeof vi.fn>;
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

/** Minimal GainNode stand-in that records connect/disconnect. */
function makeGain(): AudioNode {
  return {
    gain: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as AudioNode;
}

/** AudioContext stub whose createGain returns spy-able relay nodes. */
function makeCtx(): AudioContext {
  return {
    currentTime: 0,
    createGain: () => makeGain(),
  } as unknown as AudioContext;
}

describe('SignalsmithAdapter.disposeNode', () => {
  beforeEach(() => {
    created.length = 0;
    vi.clearAllMocks();
  });

  it('stops and disconnects the real worklet behind the relay', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx as AudioContext);

    const gain = makeGain();
    const relay = adapter.createNode(ctx as AudioContext, gain, 'bass')!;
    expect(relay).toBeTruthy();

    // Let the async splice resolve so the worklet is live behind the relay.
    await Promise.resolve();
    await Promise.resolve();
    expect(created.length).toBe(1);
    const sg = created[0];
    expect(sg.connect).toHaveBeenCalled(); // sg → gain happened

    adapter.disposeNode(relay);

    // The worklet must be halted + detached, not left running on gain.
    expect(sg.stop).toHaveBeenCalled();
    expect(sg.disconnect).toHaveBeenCalled();
    // Relay marked disposed + expandos cleared.
    expect((relay as any).__disposed).toBe(true);
    expect((relay as any).__signalsmith).toBeUndefined();
  });

  it('does not splice a worklet that resolves AFTER disposal (no leak into gain)', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx as AudioContext);

    const gain = makeGain();
    const relay = adapter.createNode(ctx as AudioContext, gain, 'harmony')!;

    // Dispose BEFORE the factory promise resolves (simulates stop during
    // the async gap, e.g. rapid play→stop).
    adapter.disposeNode(relay);

    // Now let the splice resolve.
    await Promise.resolve();
    await Promise.resolve();

    expect(created.length).toBe(1);
    const sg = created[0];
    // The late worklet must be stopped/disconnected and NEVER connected to
    // the gain (that connection is the leak we're preventing).
    expect(sg.stop).toHaveBeenCalled();
    expect(sg.disconnect).toHaveBeenCalled();
    expect(sg.connect).not.toHaveBeenCalled();
    expect((relay as any).__signalsmith).toBeUndefined();
  });

  it('disposeNode is idempotent and never throws', async () => {
    const adapter = createPitchShiftAdapter(log);
    const ctx = makeCtx();
    await adapter.register(ctx as AudioContext);
    const relay = adapter.createNode(ctx as AudioContext, makeGain(), 'bass')!;
    await Promise.resolve();
    await Promise.resolve();

    expect(() => {
      adapter.disposeNode(relay);
      adapter.disposeNode(relay);
    }).not.toThrow();
  });
});
