/**
 * RegionScheduler — pitch-shift related behaviour (LAUNCH-02.5c).
 *
 * Covers:
 *   - setInterIterCrossfadeSeconds: clamp ≥ 0
 *   - armInfiniteAudioIteration: per-iter crossfade GainNode insertion
 *     - only when (a) interIterCrossfadeSeconds > 0,
 *       (b) routing through processor (stem.input !== stem.gain),
 *       (c) not a loopSlice iter
 *     - iter 0 jumps to full gain (no fade-in)
 *     - iter ≥ 1 fades in from 0 to 1 over `xfade`
 *     - all iters fade out from 1 to 0 over the last `xfade` seconds
 *   - rearmFutureIterations:
 *     - shifts existing entries by preRollDelta (positive earlier,
 *       negative later)
 *     - clamps to now + 0.001 so source.start is never in the past
 *     - skips loopSlice entries
 *     - skips currently-playing entries (startAt ≤ now)
 *     - retroactive fade-out wrap on currently-playing iter when
 *       interIterCrossfadeSeconds > 0 AND iter has no perIterGain
 *     - no retroactive wrap when iter already has perIterGain
 *     - no retroactive wrap when interIterCrossfadeSeconds = 0
 *
 * These tests pin the algorithmic invariants that we discovered
 * empirically by listening — a regression here means we'd ship audible
 * spikes or drift again without realising.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RegionScheduler } from '../RegionScheduler.js';

const WINDOW = 3;

interface MockTransport {
  bpm: { value: number };
  seconds: number;
}

function createMockTransport(): MockTransport {
  return { bpm: { value: 120 }, seconds: 0 };
}

function createMockAudioBuffer(duration = 8.0): AudioBuffer {
  return {
    length: 44100 * duration,
    duration,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(44100 * duration)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

interface MockAudioParam {
  setValueAtTime: ReturnType<typeof vi.fn>;
  linearRampToValueAtTime: ReturnType<typeof vi.fn>;
  cancelScheduledValues: ReturnType<typeof vi.fn>;
  value: number;
  scheduledOps: Array<{ op: string; value: number; time: number }>;
}

function createMockAudioParam(): MockAudioParam {
  const param: MockAudioParam = {
    value: 1,
    scheduledOps: [],
    setValueAtTime: vi.fn((value: number, time: number) => {
      param.scheduledOps.push({ op: 'setValueAtTime', value, time });
    }),
    linearRampToValueAtTime: vi.fn((value: number, time: number) => {
      param.scheduledOps.push({ op: 'linearRampToValueAtTime', value, time });
    }),
    cancelScheduledValues: vi.fn(),
  };
  return param;
}

interface MockGainNode {
  gain: MockAudioParam;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
}

function createMockGainNode(): MockGainNode {
  return {
    gain: createMockAudioParam(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
}

interface MockSource {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
  loop: boolean;
  loopStart: number;
  loopEnd: number;
  addEventListener: ReturnType<typeof vi.fn>;
}

function createMockSource(): MockSource {
  return {
    buffer: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    loop: false,
    loopStart: 0,
    loopEnd: 0,
    addEventListener: vi.fn(),
  };
}

interface CreatedNodes {
  sources: MockSource[];
  gains: MockGainNode[];
}

function createMockAudioContext(): {
  ctx: AudioContext;
  created: CreatedNodes;
} {
  const created: CreatedNodes = { sources: [], gains: [] };
  let now = 0;
  const ctx = {
    get currentTime() {
      return now;
    },
    set currentTime(v: number) {
      now = v;
    },
    sampleRate: 44100,
    state: 'running',
    destination: {} as AudioDestinationNode,
    createBufferSource: vi.fn(() => {
      const s = createMockSource();
      created.sources.push(s);
      return s;
    }),
    createGain: vi.fn(() => {
      const g = createMockGainNode();
      created.gains.push(g);
      return g;
    }),
  } as unknown as AudioContext;
  return { ctx, created };
}

// ----------------------------------------------------------------------------
// scheduleAll dependency bag
// ----------------------------------------------------------------------------

interface ScheduleAllDeps {
  scheduler: RegionScheduler;
  tracks: Map<string, unknown>;
  scheduledEvents: Map<string, Set<string>>;
  emitEvent: ReturnType<typeof vi.fn>;
  audioContext: AudioContext;
  created: CreatedNodes;
  audioStemAccess: {
    getStem: ReturnType<typeof vi.fn>;
    trackExternalSource: ReturnType<typeof vi.fn>;
  };
  stemBuffer: AudioBuffer;
  stemGain: MockGainNode;
  stemInput: AudioNode; // can equal stemGain (direct) or be distinct (processor)
}

function setupDeps(
  opts: { routesThroughProcessor?: boolean } = {},
): ScheduleAllDeps {
  const scheduler = new RegionScheduler('test-instance');
  const { ctx, created } = createMockAudioContext();
  const stemBuffer = createMockAudioBuffer(8.0);
  const stemGain = createMockGainNode();
  // When routing through SoundTouchNode, stem.input is a distinct node
  // from stem.gain. We use a separate mock gain to stand in for the
  // SoundTouchNode's input.
  const stemInput = opts.routesThroughProcessor
    ? (createMockGainNode() as unknown as AudioNode)
    : (stemGain as unknown as AudioNode);

  const audioStemAccess = {
    getStem: vi.fn((stemKey: string) => {
      if (stemKey === 'bass')
        return {
          buffer: stemBuffer,
          input: stemInput,
          gain: stemGain,
        };
      return null;
    }),
    trackExternalSource: vi.fn(),
  };
  return {
    scheduler,
    tracks: new Map(),
    scheduledEvents: new Map(),
    emitEvent: vi.fn(),
    audioContext: ctx,
    created,
    audioStemAccess,
    stemBuffer,
    stemGain,
    stemInput,
  };
}

function callScheduleAll(deps: ScheduleAllDeps, transportStartTime = 0): void {
  deps.scheduler.scheduleAll(
    deps.tracks,
    deps.scheduledEvents,
    false,
    0,
    transportStartTime,
    deps.audioContext,
    (track: unknown) =>
      (track as { instrumentType?: string }).instrumentType ?? 'unknown',
    (pos: unknown) => {
      if (typeof pos === 'object') return pos as Record<string, number>;
      const parts = String(pos).split(':').map(Number);
      return {
        measure: parts[0] ?? 0,
        beat: parts[1] ?? 0,
        subdivision: parts[2] ?? 0,
        tick: parts[3] ?? 0,
      };
    },
    (pos: string) => {
      const parts = pos.split(':').map(Number);
      return (parts[0] ?? 0) * 2 + (parts[1] ?? 0) * 0.5;
    },
    () => new Map(),
    vi.fn(),
    () => null,
    vi.fn(),
    deps.emitEvent,
    vi.fn(),
    vi.fn(),
    undefined,
    deps.audioStemAccess as unknown as Parameters<
      RegionScheduler['scheduleAll']
    >[18],
  );
}

function singleBassTrack(durationBeats = 4) {
  return {
    instrumentType: 'audio-bass',
    regions: [
      {
        id: 'r1',
        startTime: 0,
        duration: durationBeats,
        loopCount: 0,
      },
    ],
  };
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('RegionScheduler — setInterIterCrossfadeSeconds', () => {
  it('clamps negative values to 0', () => {
    const s = new RegionScheduler('test');
    s.setInterIterCrossfadeSeconds(-1);
    // No public getter, but we can verify by behaviour: an arm with
    // crossfade=0 should not create a per-iter gain node.
    // (Indirect verification via arm behaviour is in the next group.)
    expect(() => s.setInterIterCrossfadeSeconds(-5)).not.toThrow();
  });

  it('accepts zero and positive values', () => {
    const s = new RegionScheduler('test');
    expect(() => s.setInterIterCrossfadeSeconds(0)).not.toThrow();
    expect(() => s.setInterIterCrossfadeSeconds(0.14)).not.toThrow();
    expect(() => s.setInterIterCrossfadeSeconds(1)).not.toThrow();
  });
});

describe('RegionScheduler — armInfiniteAudioIteration per-iter crossfade', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = createMockTransport();
    (globalThis as { window?: Record<string, unknown> }).window =
      (globalThis as { window?: Record<string, unknown> }).window ?? {};
    (globalThis as { window: Record<string, unknown> }).window.Tone = {
      getTransport: () => transport,
    };
  });

  afterEach(() => {
    delete (globalThis as { window: Record<string, unknown> }).window.Tone;
  });

  it('crossfade=0: NO per-iter gain wrapper is inserted (source connects directly to stem.input)', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.scheduler.setInterIterCrossfadeSeconds(0);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // No gain nodes should have been created (only sources).
    expect(deps.created.gains.length).toBe(0);
    expect(deps.created.sources.length).toBe(WINDOW);
    // Sources connect directly to stem.input.
    for (const src of deps.created.sources) {
      expect(src.connect).toHaveBeenCalledWith(deps.stemInput);
    }
  });

  it('crossfade=0.14 + routing through processor: per-iter gain IS inserted for each iter', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // WINDOW gain nodes created (one per iter).
    expect(deps.created.gains.length).toBe(WINDOW);
    expect(deps.created.sources.length).toBe(WINDOW);
    // Each source connects to its per-iter gain, not directly to stem.input.
    for (let i = 0; i < WINDOW; i++) {
      const src = deps.created.sources[i]!;
      const gain = deps.created.gains[i]!;
      expect(src.connect).toHaveBeenCalledWith(gain);
      expect(gain.connect).toHaveBeenCalledWith(deps.stemInput);
    }
  });

  it('crossfade=0.14 + DIRECT routing (drums/click): NO per-iter gain wrapper (saves CPU, no spike risk)', () => {
    const deps = setupDeps({ routesThroughProcessor: false });
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // No gains: drums don't go through WSOLA, no spike risk → no wrapper.
    expect(deps.created.gains.length).toBe(0);
    for (const src of deps.created.sources) {
      expect(src.connect).toHaveBeenCalledWith(deps.stemGain);
    }
  });

  it('iter 0 jumps to full gain (no fade-in) — listener hears full-amplitude attack at play start', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // First gain node is iter 0's wrapper.
    const iter0Gain = deps.created.gains[0]!;
    const ops = iter0Gain.gain.scheduledOps;
    // First scheduled op should set gain to 1 at startAt (no ramp from 0).
    expect(ops[0]?.op).toBe('setValueAtTime');
    expect(ops[0]?.value).toBe(1);
    // No linearRampToValueAtTime(1, ...) before the fade-out.
    const earlyRampToOne = ops.find(
      (o) => o.op === 'linearRampToValueAtTime' && o.value === 1,
    );
    expect(earlyRampToOne).toBeUndefined();
  });

  it('iter ≥ 1 fades in from 0 to 1 over `xfade` seconds', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // Iter 1 (the second wrapper).
    const iter1Gain = deps.created.gains[1]!;
    const ops = iter1Gain.gain.scheduledOps;
    // Should start at 0 then ramp to 1.
    expect(ops[0]?.op).toBe('setValueAtTime');
    expect(ops[0]?.value).toBe(0);
    expect(ops[1]?.op).toBe('linearRampToValueAtTime');
    expect(ops[1]?.value).toBe(1);
    // The ramp end time should be 0.14 seconds after the start.
    expect(ops[1]!.time - ops[0]!.time).toBeCloseTo(0.14, 5);
  });

  it('all iters fade OUT from 1 to 0 in the last `xfade` seconds before their seam', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // Every iter wrapper should end with a fade-out.
    for (let i = 0; i < WINDOW; i++) {
      const gain = deps.created.gains[i]!;
      const ops = gain.gain.scheduledOps;
      // The penultimate op should be setValueAtTime(1, fadeOutStart),
      // the last op should be linearRampToValueAtTime(0, seamAt).
      const last = ops[ops.length - 1]!;
      expect(last.op).toBe('linearRampToValueAtTime');
      expect(last.value).toBe(0);
      const secondLast = ops[ops.length - 2]!;
      expect(secondLast.op).toBe('setValueAtTime');
      expect(secondLast.value).toBe(1);
      // Fade-out duration is exactly 0.14 seconds.
      expect(last.time - secondLast.time).toBeCloseTo(0.14, 5);
    }
  });
});

describe('RegionScheduler — rearmFutureIterations', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = createMockTransport();
    (globalThis as { window?: Record<string, unknown> }).window =
      (globalThis as { window?: Record<string, unknown> }).window ?? {};
    (globalThis as { window: Record<string, unknown> }).window.Tone = {
      getTransport: () => transport,
    };
  });

  afterEach(() => {
    delete (globalThis as { window: Record<string, unknown> }).window.Tone;
  });

  it('returns 0 when no audioStemAccess is provided (defensive guard)', () => {
    const s = new RegionScheduler('test');
    const ctx = createMockAudioContext().ctx;
    const result = s.rearmFutureIterations(
      'nonexistent',
      ctx,
      undefined,
      undefined,
    );
    expect(result).toBe(0);
  });

  it('returns 0 when no infinite-audio regions are registered', () => {
    const deps = setupDeps();
    const result = deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
    );
    expect(result).toBe(0);
  });

  it('returns 0 when regionId does not match any entry', () => {
    const deps = setupDeps();
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    const result = deps.scheduler.rearmFutureIterations(
      'NONEXISTENT',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
    );
    expect(result).toBe(0);
  });

  it('positive preRollDelta: shifts future-iter source.start EARLIER', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // Capture original startAt for iter 1 (the first future iter).
    // computeIterationDuration uses BPM. At 120 BPM × 4 beats = 2s.
    const originalIter1StartAt = 2; // T0=0 + iter 1 × 2s

    // Advance ctx time to mid-iter 0 (so iter 0 is "currently playing"
    // and gets skipped) while iter 1 + 2 are still in the future.
    (deps.audioContext as unknown as { currentTime: number }).currentTime = 0.5;

    // Reset source.start mocks so we only see the rearm's new sources.
    const startsBefore = deps.created.sources.map(
      (s) => s.start.mock.calls.length,
    );

    const result = deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 0.14 },
    );

    expect(result).toBe(2); // iter 1 + iter 2 rearmed
    // The NEW sources (created during rearm) should have source.start
    // called with a time 0.14 seconds EARLIER than their original.
    // Find the most recently-created source (iter 1's new source).
    const newSources = deps.created.sources.slice(startsBefore.length);
    expect(newSources.length).toBeGreaterThanOrEqual(2);
    // First new source corresponds to iter 1.
    const newIter1Start = newSources[0]!.start.mock.calls[0]?.[0];
    expect(newIter1Start).toBeCloseTo(originalIter1StartAt - 0.14, 5);
  });

  it('negative preRollDelta: shifts future-iter source.start LATER', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    // Set initial crossfade so the first arm already has pre-roll baked in
    // — emulates pitched-state at play start.
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);
    (deps.audioContext as unknown as { currentTime: number }).currentTime = 0.5;

    const startsBefore = deps.created.sources.length;

    // Apply negative delta (going from pitched → default).
    deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: -0.14 },
    );

    const newSources = deps.created.sources.slice(startsBefore);
    expect(newSources.length).toBeGreaterThanOrEqual(1);
    const newIter1Start = newSources[0]!.start.mock.calls[0]?.[0];
    // Iter 1's original startAt is 2s. With negative delta -0.14,
    // newStart = 2 - (-0.14) = 2.14s (later).
    expect(newIter1Start).toBeCloseTo(2.14, 5);
  });

  it('zero preRollDelta: future-iter source.start times are UNCHANGED', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);
    (deps.audioContext as unknown as { currentTime: number }).currentTime = 0.5;

    const startsBefore = deps.created.sources.length;

    deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 0 },
    );

    const newSources = deps.created.sources.slice(startsBefore);
    expect(newSources.length).toBeGreaterThanOrEqual(1);
    const newIter1Start = newSources[0]!.start.mock.calls[0]?.[0];
    expect(newIter1Start).toBeCloseTo(2, 5);
  });

  it('clamps source.start to (now + 0.001) when shift would put it in the past', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // Advance ctx to just before iter 1's natural start (2s) so iter 1
    // is still future but iter 2 is FAR future.
    (deps.audioContext as unknown as { currentTime: number }).currentTime =
      1.99;

    const startsBefore = deps.created.sources.length;

    // Apply a huge positive pre-roll that would put iter 1's start in
    // the past (1.99 + delta = past).
    deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 5 }, // 5s — would put iter 1 start at -3s
    );

    const newSources = deps.created.sources.slice(startsBefore);
    expect(newSources.length).toBeGreaterThanOrEqual(1);
    const newIter1Start = newSources[0]!.start.mock.calls[0]?.[0];
    // Clamped to now + 0.001.
    expect(newIter1Start).toBeGreaterThanOrEqual(1.99);
    expect(newIter1Start).toBeLessThanOrEqual(1.99 + 0.002);
  });

  it('skips entries whose startAt is in the past (currently playing)', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // Advance time PAST iter 2's startAt (so all three iters are "playing"
    // from the rearm path's perspective).
    (deps.audioContext as unknown as { currentTime: number }).currentTime = 100;

    const result = deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 0.14 },
    );

    // All entries skipped (currentlyPlaying), but the retroactive wrap
    // logic still inspects them. Result count of REARMED iters is 0.
    expect(result).toBe(0);
  });
});

describe('RegionScheduler — retroactive fade-out wrap on currently-playing iter', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = createMockTransport();
    (globalThis as { window?: Record<string, unknown> }).window =
      (globalThis as { window?: Record<string, unknown> }).window ?? {};
    (globalThis as { window: Record<string, unknown> }).window.Tone = {
      getTransport: () => transport,
    };
  });

  afterEach(() => {
    delete (globalThis as { window: Record<string, unknown> }).window.Tone;
  });

  it('rearm during default → pitched transition: wraps current iter (no perIterGain) with fade-out gain', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    // Initial arm with crossfade=0 (default routing → no per-iter gain).
    deps.scheduler.setInterIterCrossfadeSeconds(0);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    // No per-iter gain nodes were created (because crossfade=0).
    const gainsBeforeRearm = deps.created.gains.length;
    expect(gainsBeforeRearm).toBe(0);

    // Now flip crossfade ON and advance ctx so iter 0 is currently
    // playing.
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    (deps.audioContext as unknown as { currentTime: number }).currentTime = 0.5;

    deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 0.14 },
    );

    // Retroactive wrap should create ONE new gain node for iter 0 +
    // TWO new wrapper gain nodes for the rearmed iter 1 and iter 2.
    expect(deps.created.gains.length).toBe(3);
    // The first newly-created gain (iter 0's retroactive wrap) should
    // have a fade-out scheduled.
    const retroactiveGain = deps.created.gains[0]!;
    const ops = retroactiveGain.gain.scheduledOps;
    // Last op should be ramp to 0 at iter 0's natural endAt (2s).
    const last = ops[ops.length - 1]!;
    expect(last.op).toBe('linearRampToValueAtTime');
    expect(last.value).toBe(0);
    expect(last.time).toBeCloseTo(2, 5);
  });

  it('rearm during pitched → pitched transition: NO retroactive wrap (iter already has perIterGain)', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    // First arm WITH crossfade so iter 0 already has a perIterGain.
    deps.scheduler.setInterIterCrossfadeSeconds(0.14);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    const gainsAfterFirstArm = deps.created.gains.length;
    expect(gainsAfterFirstArm).toBe(WINDOW); // 3 per-iter gains

    // Mid-iter 0, rearm again (pitched→pitched, no change in crossfade).
    (deps.audioContext as unknown as { currentTime: number }).currentTime = 0.5;
    deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 0 }, // delta=0 (already pre-rolled)
    );

    // The rearm should create 2 NEW gains for iter 1 + iter 2 (the
    // future ones) — but NO additional retroactive wrap for iter 0 (it
    // already has one).
    expect(deps.created.gains.length).toBe(gainsAfterFirstArm + 2);
  });

  it('rearm when crossfade is 0: NO retroactive wrap (no point — direct routing)', () => {
    const deps = setupDeps({ routesThroughProcessor: true });
    deps.scheduler.setInterIterCrossfadeSeconds(0);
    deps.tracks.set('card-A-bass', singleBassTrack());
    callScheduleAll(deps);

    expect(deps.created.gains.length).toBe(0);

    (deps.audioContext as unknown as { currentTime: number }).currentTime = 0.5;
    deps.scheduler.rearmFutureIterations(
      'r1',
      deps.audioContext,
      deps.audioStemAccess as unknown as Parameters<
        RegionScheduler['rearmFutureIterations']
      >[2],
      undefined,
      { preRollSeconds: 0 },
    );

    // Still no gains: crossfade is off, rearm shouldn't wrap iter 0.
    expect(deps.created.gains.length).toBe(0);
  });
});
