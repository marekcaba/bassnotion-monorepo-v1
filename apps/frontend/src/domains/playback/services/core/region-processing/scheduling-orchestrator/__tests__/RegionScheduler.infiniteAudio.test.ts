/**
 * RegionScheduler — LAUNCH-02.5b infinite-loop audio region tests.
 *
 * Verifies the new audio-stem branch added in 02.5b:
 *   - First iteration scheduled at transportStartTime + region.startTime
 *   - Tone.getTransport().schedule is invoked for the next boundary with
 *     a callback at T0 + D - 50ms
 *   - Self-rescheduling fires the next iteration with D derived from the
 *     LIVE BPM (not the stale BPM at first-iteration scheduling time)
 *   - Generation-counter cleanup: stopAllInfiniteAudio() called between
 *     scheduling and callback firing produces NO new sources
 *   - Timer drift: when callback fires past the boundary, incoming source
 *     starts at currentTime instead of a negative pre-roll
 *
 * Test design notes:
 *   - Production code accesses Tone via the getTone() helper which reads
 *     window.Tone, so beforeEach installs a Tone-like object there.
 *   - Tone.Transport.schedule is implemented as a queue that captures the
 *     callback + scheduled time so the test can fire callbacks manually,
 *     simulating the Tone.Transport advancing past the scheduled instant.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from 'vitest';
import { RegionScheduler } from '../RegionScheduler.js';

// ----------------------------------------------------------------------------
// Tone mock — installed onto window.Tone (not via vi.mock('tone')) because
// the production code path uses getTone() to read from window/__globalTone.
// ----------------------------------------------------------------------------

interface QueuedCallback {
  callback: (time: number) => void;
  time: number;
  id: number;
  cleared: boolean;
}

interface MockTransport {
  bpm: { value: number };
  seconds: number;
  schedule: MockedFunction<(cb: (t: number) => void, t: number) => number>;
  clear: MockedFunction<(id: number) => void>;
  __queue: QueuedCallback[];
  __nextId: number;
  __reset(): void;
  __fireNext(): QueuedCallback | undefined;
}

function createMockTransport(): MockTransport {
  const t: MockTransport = {
    bpm: { value: 120 },
    seconds: 0,
    schedule: vi.fn(),
    clear: vi.fn(),
    __queue: [],
    __nextId: 1,
    __reset() {
      this.__queue.length = 0;
      this.__nextId = 1;
      this.bpm.value = 120;
      this.seconds = 0;
    },
    __fireNext() {
      // pop the earliest-scheduled non-cleared callback and invoke it
      const pending = this.__queue
        .filter((q) => !q.cleared)
        .sort((a, b) => a.time - b.time);
      const next = pending[0];
      if (!next) return undefined;
      next.cleared = true;
      next.callback(next.time);
      return next;
    },
  };
  t.schedule.mockImplementation((cb, time) => {
    const id = t.__nextId++;
    t.__queue.push({ callback: cb, time, id, cleared: false });
    return id;
  });
  t.clear.mockImplementation((id) => {
    const entry = t.__queue.find((q) => q.id === id);
    if (entry) entry.cleared = true;
  });
  return t;
}

// ----------------------------------------------------------------------------
// Audio mocks
// ----------------------------------------------------------------------------

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

function createMockGainNode(): GainNode {
  return {
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  } as unknown as GainNode;
}

interface MockSource {
  buffer: AudioBuffer | null;
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  onended: (() => void) | null;
}

function createMockSource(): MockSource {
  return {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    addEventListener: vi.fn(),
    onended: null,
  };
}

function createMockAudioContext(): {
  ctx: AudioContext;
  sources: MockSource[];
} {
  const sources: MockSource[] = [];
  const ctx = {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {} as AudioDestinationNode,
    createBufferSource: vi.fn(() => {
      const s = createMockSource();
      sources.push(s);
      return s;
    }),
    createGain: vi.fn(() => createMockGainNode()),
  } as unknown as AudioContext;
  return { ctx, sources };
}

// ----------------------------------------------------------------------------
// Helpers to build the scheduleAll dependency bag
// ----------------------------------------------------------------------------

interface ScheduleAllDeps {
  scheduler: RegionScheduler;
  tracks: Map<string, any>;
  scheduledEvents: Map<string, Set<string>>;
  emitEvent: ReturnType<typeof vi.fn>;
  audioContext: AudioContext;
  sources: MockSource[];
  audioStemAccess: {
    getStem: ReturnType<typeof vi.fn>;
    trackExternalSource: ReturnType<typeof vi.fn>;
  };
  stemBuffer: AudioBuffer;
  stemGain: GainNode;
}

function setupDeps(): ScheduleAllDeps {
  const scheduler = new RegionScheduler('test-instance');
  const { ctx, sources } = createMockAudioContext();
  const stemBuffer = createMockAudioBuffer(8.0);
  const stemGain = createMockGainNode();
  const audioStemAccess = {
    getStem: vi.fn((stemKey: string) => {
      if (stemKey === 'bass') return { buffer: stemBuffer, gain: stemGain };
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
    sources,
    audioStemAccess,
    stemBuffer,
    stemGain,
  };
}

function callScheduleAll(deps: ScheduleAllDeps, transportStartTime = 0): void {
  deps.scheduler.scheduleAll(
    deps.tracks,
    deps.scheduledEvents,
    false, // countdownEnabled
    0, // countdownOffsetBeats
    transportStartTime,
    deps.audioContext,
    (track: any) => track.instrumentType ?? 'unknown',
    (pos: any) => {
      if (typeof pos === 'object') return pos;
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
    undefined, // resolvePendingBuffer
    deps.audioStemAccess,
  );
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe('RegionScheduler — LAUNCH-02.5b infinite audio regions', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = createMockTransport();
    // Install on window.Tone (getTone() reads from there).
    (globalThis as any).window = (globalThis as any).window ?? {};
    (globalThis as any).window.Tone = {
      getTransport: () => transport,
    };
  });

  afterEach(() => {
    delete (globalThis as any).window.Tone;
  });

  // --------------------------------------------------------------------------
  it('schedules iteration 0 at transportStartTime + region.startTime', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8, // 8 beats = 4 seconds at 120 BPM
          loopCount: 0, // infinite
        },
      ],
    });

    callScheduleAll(deps, /* transportStartTime */ 2.0);

    // Iteration 0 source must have been created and started at 2.0 (T0).
    expect(deps.sources.length).toBe(1);
    expect(deps.sources[0]!.buffer).toBe(deps.stemBuffer);
    expect(deps.sources[0]!.connect).toHaveBeenCalledWith(deps.stemGain);
    expect(deps.sources[0]!.start).toHaveBeenCalledWith(2.0, 0);

    // External source tracking handed off to AudioPlayerScheduler.
    expect(deps.audioStemAccess.trackExternalSource).toHaveBeenCalledWith(
      'bass',
      deps.sources[0],
    );
  });

  // --------------------------------------------------------------------------
  it('arms Tone.Transport.schedule for the next boundary at T0 + D - 50ms', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8, // 8 beats = 4s at 120 BPM
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, /* transportStartTime */ 1.0);

    // D = 8 beats * (60/120) = 4s; boundary = T0 + D = 5.0; lookahead = 50ms.
    // Expected scheduled-at time = 5.0 - 0.05 = 4.95s
    expect(transport.schedule).toHaveBeenCalledTimes(1);
    const [callback, time] = transport.schedule.mock.calls[0]!;
    expect(typeof callback).toBe('function');
    expect(time).toBeCloseTo(4.95, 5);
  });

  // --------------------------------------------------------------------------
  it('fires iteration 1 with D recomputed from LIVE BPM (mid-loop tempo change)', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8, // 8 beats
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, 0);
    // After scheduleAll: 1 source created (iter 0), 1 schedule armed.
    expect(deps.sources.length).toBe(1);

    // Simulate the user pushing tempo to 180 BPM mid-loop. (60/180)*8 = 2.667s.
    transport.bpm.value = 180;
    // Move the audio clock forward so currentTime is plausibly near the
    // scheduled callback time. boundary == 4.0, callback armed at 3.95.
    (deps.audioContext as any).currentTime = 3.95;

    // Fire the scheduled callback as if Tone.Transport reached its time.
    const fired = transport.__fireNext();
    expect(fired).toBeDefined();

    // The callback should have created the incoming source (iter 1).
    expect(deps.sources.length).toBe(2);
    expect(deps.sources[1]!.buffer).toBe(deps.stemBuffer);

    // It should have armed the NEXT boundary using the new BPM:
    // next D = 8 beats * (60/180) = ~2.667s; new boundary = 4.0 + 2.667 = 6.667s;
    // callback at 6.667 - 0.05 = 6.617s.
    expect(transport.schedule).toHaveBeenCalledTimes(2);
    const [, secondTime] = transport.schedule.mock.calls[1]!;
    expect(secondTime).toBeCloseTo(6.617, 2);
  });

  // --------------------------------------------------------------------------
  it('generation-counter cleanup: stopAllInfiniteAudio before a callback fires creates NO new sources', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8,
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, 0);
    const sourceCountBeforeStop = deps.sources.length;
    expect(sourceCountBeforeStop).toBe(1);
    expect(transport.schedule).toHaveBeenCalledTimes(1);

    // Stop BEFORE the boundary callback fires.
    deps.scheduler.stopAllInfiniteAudio(deps.audioContext);

    // Cleanup must clear the pending schedule.
    expect(transport.clear).toHaveBeenCalledTimes(1);
    // Iteration 0's source must be stopped.
    expect(deps.sources[0]!.stop).toHaveBeenCalled();

    // Simulate the boundary callback firing anyway (timer races stop).
    // Because the queued entry's `cleared` flag is true, __fireNext skips it.
    const fired = transport.__fireNext();
    expect(fired).toBeUndefined();

    // No incoming source was created.
    expect(deps.sources.length).toBe(sourceCountBeforeStop);
  });

  // --------------------------------------------------------------------------
  it('generation-counter bail: a late-firing callback whose generation has been bumped creates NO source', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8,
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, 0);
    expect(deps.sources.length).toBe(1);

    // Grab the callback so we can fire it AFTER calling stopAll, simulating
    // the case where clear() failed (e.g. Tone fires before clear lands).
    const queued = transport.__queue[0]!;
    expect(queued).toBeDefined();

    // Bump generation by calling stop, but defeat the "cleared" guard so the
    // callback still runs. This isolates the generation-counter check.
    deps.scheduler.stopAllInfiniteAudio(deps.audioContext);
    queued.cleared = false; // pretend Tone's clear() did NOT land

    const sourcesBefore = deps.sources.length;
    queued.callback(queued.time);
    // Generation mismatch → bail → no new source.
    expect(deps.sources.length).toBe(sourcesBefore);
  });

  // --------------------------------------------------------------------------
  it('timer drift: when the callback fires past the boundary, incoming starts at currentTime (no negative pre-roll)', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8,
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, 0);
    // boundary B = 4.0s. Crossfade window = B - 10ms = 3.99s. Simulate the
    // callback firing 100ms past the boundary.
    (deps.audioContext as any).currentTime = 4.1;
    transport.__fireNext();

    expect(deps.sources.length).toBe(2);
    const incoming = deps.sources[1]!;
    // The incoming source must start at currentTime + 0.001 (not negative).
    const [startAt, offset] = incoming.start.mock.calls[0]!;
    expect(startAt).toBeGreaterThanOrEqual(4.1);
    expect(offset).toBe(0);
  });

  // --------------------------------------------------------------------------
  it('does NOT touch the finite-loop path: regions with loopCount: 2 still go through the existing eventsByTime expansion', () => {
    const deps = setupDeps();
    deps.tracks.set('finite-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'finite-region',
          startTime: 0,
          duration: 8,
          loopCount: 2,
          // No pattern.events → existing early-return skips this region,
          // confirming the audio path is the only one engaged for audio-*
          // tracks. (The infinite branch fires only when loopCount === 0.)
        },
      ],
    });

    callScheduleAll(deps, 0);

    // No infinite-loop scheduling → no source, no schedule armed.
    expect(deps.sources.length).toBe(0);
    expect(transport.schedule).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  it('silently no-ops when audioStemAccess is not provided', () => {
    const scheduler = new RegionScheduler('test-no-access');
    const { ctx } = createMockAudioContext();
    const emitEvent = vi.fn();

    scheduler.scheduleAll(
      new Map([
        [
          'card-1-bass',
          {
            instrumentType: 'audio-bass',
            regions: [{ id: 'r', startTime: 0, duration: 8, loopCount: 0 }],
          },
        ],
      ]),
      new Map(),
      false,
      0,
      0,
      ctx,
      (track: any) => track.instrumentType ?? 'unknown',
      (_pos: any) => ({ measure: 0, beat: 0, subdivision: 0, tick: 0 }),
      (_pos: string) => 0,
      () => new Map(),
      vi.fn(),
      () => null,
      vi.fn(),
      emitEvent,
      vi.fn(),
      vi.fn(),
      // resolvePendingBuffer undefined
      // audioStemAccess undefined
    );

    // No schedule armed, no errors thrown.
    expect(transport.schedule).not.toHaveBeenCalled();
    expect(emitEvent).not.toHaveBeenCalled();
  });
});
