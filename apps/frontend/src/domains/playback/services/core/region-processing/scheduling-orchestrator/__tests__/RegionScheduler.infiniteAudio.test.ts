/**
 * RegionScheduler — infinite-loop audio region tests.
 *
 * Verifies the audio-stem branch (LAUNCH-02.5b infinite-loop, rewritten in
 * the LOOP-GAP fix to pre-arm a sliding window of Web Audio sources rather
 * than scheduling a JS callback at each boundary):
 *   - Pre-arm: WINDOW sources are created up-front and started at
 *     T0 + i*D via source.start(when, 0).
 *   - Refill: when iter N's onended fires, iter N+WINDOW is armed anchored
 *     to iter N+WINDOW-1's startAt + D, so an already-armed iteration's
 *     start time never changes.
 *   - Live BPM at refill: a tempo bump applied mid-loop affects iterations
 *     strictly past the current window (same documented seam as the MIDI
 *     scheduling path).
 *   - Stop: stopAllInfiniteAudio() drops the map first (so any racing
 *     onended skips refill) and calls source.stop(stopAt) on every entry —
 *     no Tone.Transport.schedule clearing needed.
 *
 * Test design notes:
 *   - Production code accesses Tone via getTone() reading window.Tone. We
 *     only need bpm.value (no schedule/clear anymore).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RegionScheduler } from '../RegionScheduler.js';

const WINDOW = 3; // mirrors INFINITE_AUDIO_WINDOW in RegionScheduler.ts

// ----------------------------------------------------------------------------
// Tone mock — only bpm.value is read by computeIterationDuration.
// ----------------------------------------------------------------------------

interface MockTransport {
  bpm: { value: number };
  seconds: number;
}

function createMockTransport(): MockTransport {
  return {
    bpm: { value: 120 },
    seconds: 0,
  };
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
  onended: (() => void) | null;
}

function createMockSource(): MockSource {
  return {
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
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
// scheduleAll dependency bag
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

describe('RegionScheduler — infinite audio regions (pre-arm)', () => {
  let transport: MockTransport;

  beforeEach(() => {
    transport = createMockTransport();
    (globalThis as any).window = (globalThis as any).window ?? {};
    (globalThis as any).window.Tone = {
      getTransport: () => transport,
    };
  });

  afterEach(() => {
    delete (globalThis as any).window.Tone;
  });

  // --------------------------------------------------------------------------
  it('pre-arms a WINDOW of upcoming iterations at T0 + i*D', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8, // 8 beats = 4 seconds at 120 BPM
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, /* transportStartTime */ 2.0);

    // WINDOW sources created and started at T0, T0+D, T0+2D.
    expect(deps.sources.length).toBe(WINDOW);
    const D = 4.0; // 8 beats * 60/120
    for (let i = 0; i < WINDOW; i++) {
      const src = deps.sources[i]!;
      expect(src.buffer).toBe(deps.stemBuffer);
      expect(src.connect).toHaveBeenCalledWith(deps.stemGain);
      expect(src.start).toHaveBeenCalledWith(2.0 + i * D, 0);
    }
    // Each source registered with the stem access for centralised stop.
    expect(deps.audioStemAccess.trackExternalSource).toHaveBeenCalledTimes(
      WINDOW,
    );
  });

  // --------------------------------------------------------------------------
  it('refills the window when iter N ends: iter N+WINDOW armed at anchor+D', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'region-bass',
          startTime: 0,
          duration: 8, // D = 4s at 120 BPM
          loopCount: 0,
        },
      ],
    });

    callScheduleAll(deps, /* transportStartTime */ 0);
    // Initial 3 sources at 0, 4, 8.
    expect(deps.sources.length).toBe(WINDOW);

    // Fire iter 0's onended (the source naturally ended). Refill should
    // create source for iter 3 anchored on iter 2.startAt + D = 8 + 4 = 12.
    const iter0 = deps.sources[0]!;
    iter0.onended?.();

    expect(deps.sources.length).toBe(WINDOW + 1);
    expect(deps.sources[WINDOW]!.start).toHaveBeenCalledWith(12.0, 0);
  });

  // --------------------------------------------------------------------------
  it('applies LIVE BPM at refill (mid-loop tempo change affects iter past window)', () => {
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
    // Initial sources at 0, 4, 8 (D=4s at 120 BPM).
    expect(deps.sources[0]!.start).toHaveBeenCalledWith(0, 0);
    expect(deps.sources[1]!.start).toHaveBeenCalledWith(4, 0);
    expect(deps.sources[2]!.start).toHaveBeenCalledWith(8, 0);

    // User bumps tempo to 240 BPM (D becomes 2s).
    transport.bpm.value = 240;

    // Iter 0 ends → refill iter 3 anchored to iter 2.startAt(8) + new D(2) = 10.
    deps.sources[0]!.onended?.();
    expect(deps.sources[WINDOW]!.start).toHaveBeenCalledWith(10, 0);

    // Iter 1 ends → refill iter 4 anchored to iter 3.startAt(10) + new D(2) = 12.
    deps.sources[1]!.onended?.();
    expect(deps.sources[WINDOW + 1]!.start).toHaveBeenCalledWith(12, 0);
  });

  // --------------------------------------------------------------------------
  it('stopAllInfiniteAudio stops every active source', () => {
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
    expect(deps.sources.length).toBe(WINDOW);

    deps.scheduler.stopAllInfiniteAudio(deps.audioContext);

    // Every pre-armed source received .stop(). Web Audio cancels both
    // already-playing and pending-start sources via the same call.
    for (const src of deps.sources) {
      expect(src.stop).toHaveBeenCalledTimes(1);
    }
  });

  // --------------------------------------------------------------------------
  it('after stopAllInfiniteAudio, a stale onended does NOT refill the window', () => {
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
    expect(deps.sources.length).toBe(WINDOW);

    deps.scheduler.stopAllInfiniteAudio(deps.audioContext);

    // onended fires AFTER stop (e.g. natural buffer end racing with stop).
    // The entry is gone from the map, so no new source should be created.
    const sourcesBefore = deps.sources.length;
    deps.sources[0]!.onended?.();
    expect(deps.sources.length).toBe(sourcesBefore);
  });

  // --------------------------------------------------------------------------
  it('does NOT touch the finite-loop path: regions with loopCount: 2 still go through the existing eventsByTime expansion', () => {
    const deps = setupDeps();
    deps.tracks.set('card-1-bass', {
      instrumentType: 'audio-bass',
      regions: [
        {
          id: 'finite-region',
          startTime: 0,
          duration: 8,
          loopCount: 2, // finite, NOT infinite
          pattern: { events: [] }, // empty so eventsByTime branch no-ops
        },
      ],
    });

    callScheduleAll(deps, 0);

    // No infinite-audio pre-arm took place.
    expect(deps.sources.length).toBe(0);
    expect(deps.audioStemAccess.trackExternalSource).not.toHaveBeenCalled();
  });

  // --------------------------------------------------------------------------
  it('silently no-ops when audioStemAccess is not provided', () => {
    const scheduler = new RegionScheduler('test-instance');
    const { ctx, sources } = createMockAudioContext();
    const tracks = new Map<string, any>();
    tracks.set('card-1-bass', {
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

    expect(() => {
      scheduler.scheduleAll(
        tracks,
        new Map(),
        false,
        0,
        0,
        ctx,
        (track: any) => track.instrumentType ?? 'unknown',
        (pos: any) => (typeof pos === 'object' ? pos : { measure: 0, beat: 0 }),
        (pos: string) => {
          const parts = pos.split(':').map(Number);
          return (parts[0] ?? 0) * 2 + (parts[1] ?? 0) * 0.5;
        },
        () => new Map(),
        vi.fn(),
        () => null,
        vi.fn(),
        vi.fn(),
        vi.fn(),
        vi.fn(),
        undefined,
        undefined, // audioStemAccess missing
      );
    }).not.toThrow();

    expect(sources.length).toBe(0);
  });
});
