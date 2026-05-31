/**
 * useGrooveCardPlayback — loop-selection (bar-range looper) scenarios.
 *
 * Covers every path through `setLoopSelection` × `play / pause / stop`
 * that was previously uncovered. These tests pin the engine-facing contract
 * (registerTracks payload must reflect the CURRENT loopSelection on every
 * call site) so future refactors of the hook can't silently regress to the
 * "engine sees stale loopSlice" bug we hit while shipping the looper.
 *
 * What the engine MUST see:
 *   - registerTracks is called with regions that have `loopSlice` set when
 *     loopSelection is non-null, and have no `loopSlice` when null.
 *   - Every registerTracks is preceded by an unregisterTracksByPrefix for
 *     the card's track prefix (so the engine's redundant-update fast-path
 *     can't drop the new region — defense in depth alongside the engine-
 *     side patch).
 *
 * Test surface design:
 *   - We mock WindowRegistry to a single engine instance and capture every
 *     registerTracks payload.
 *   - We force isReady=true by feeding a preloaded AudioBuffer through
 *     useGrooveCardStemPreload's module cache.
 *   - We give the hook a real (mocked) TransportProvider via the safe
 *     hook so play() runs end-to-end.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GrooveCardBlockConfig } from '@bassnotion/contracts';

// ── Mocks ───────────────────────────────────────────────────────────────────

const transportStart = vi.fn(async () => undefined);
const transportPause = vi.fn(async () => undefined);
const transportStop = vi.fn(async () => undefined);
vi.mock('@/domains/playback/contexts/TransportContext', () => ({
  useTransportControlsSafe: () => ({
    start: transportStart,
    pause: transportPause,
    stop: transportStop,
    isPlaying: false,
    setAutoStopEnabled: vi.fn(),
  }),
}));

// Engine mock with state tracking so we can inspect every registerTracks
// call after each user action.
const engineCalls: {
  registerTracks: Array<Array<any>>;
  unregisterTracksByPrefix: Array<string>;
  stopAudioStems: number;
  start: number;
} = {
  registerTracks: [],
  unregisterTracksByPrefix: [],
  stopAudioStems: 0,
  start: 0,
};
const engineMock = {
  getState: vi.fn(() => 'stopped'),
  setAudioStemBuffers: vi.fn(),
  stopAudioStems: vi.fn(() => {
    engineCalls.stopAudioStems += 1;
  }),
  unregisterTracksByPrefix: vi.fn((prefix: string) => {
    engineCalls.unregisterTracksByPrefix.push(prefix);
  }),
  registerTracks: vi.fn((tracks: any[]) => {
    engineCalls.registerTracks.push(tracks);
  }),
  setInstrumentMuted: vi.fn(),
  enableCountdown: vi.fn(),
  addCountdownRegion: vi.fn(),
  setCountdownConfig: vi.fn(),
  start: vi.fn(() => {
    engineCalls.start += 1;
  }),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getTransportStartTime: vi.fn(() => 0.5),
};

let mockAudioContextTime = 0;
const mockAudioContext = {
  get currentTime() {
    return mockAudioContextTime;
  },
  state: 'running',
  resume: vi.fn(async () => undefined),
};

vi.mock('@/domains/playback/services/WindowRegistry', () => ({
  WindowRegistry: {
    getAudioContext: () => mockAudioContext,
    getPlaybackEngine: () => engineMock,
    getCoreServices: () => null,
  },
}));

vi.mock('@/domains/playback/modules/tempo/MusicalTruthAuthority', () => ({
  musicalTruth: {
    setBPM: vi.fn(),
    getBPM: () => 120,
    subscribe: vi.fn(() => () => undefined),
  },
}));

// Force preload to be "ready" with a real-ish bass buffer so the hook's
// isReady becomes true after mount. We construct a mock AudioBuffer with
// the duration that matches one 8-bar groove at 120 BPM (16s).
const fakeBassBuffer = {
  duration: 16,
  length: 16 * 44100,
  sampleRate: 44100,
  numberOfChannels: 2,
  getChannelData: vi.fn(() => new Float32Array(16 * 44100)),
} as unknown as AudioBuffer;

vi.mock('../useGrooveCardStemPreload', () => ({
  useGrooveCardStemPreload: () => ({
    isPreloaded: true,
    loadedCount: 3,
    totalCount: 3,
    errors: [],
    preload: vi.fn(),
    getBuffer: vi.fn((stemKey: string) => {
      if (stemKey === 'bass') return fakeBassBuffer;
      if (stemKey === 'drums') return fakeBassBuffer;
      if (stemKey === 'harmony') return fakeBassBuffer;
      return null;
    }),
  }),
}));

vi.mock('@/domains/widgets/hooks/useCountdown', () => ({
  useCountdown: () => ({
    countdownState: { isCountingDown: false, currentBeat: 0, totalBeats: 4 },
    // startCountdown returns a Promise (the production code chains `.catch`)
    startCountdown: vi.fn(async () => undefined),
    cancelCountdown: vi.fn(),
  }),
}));

vi.mock('@/shared/utils/sentry', () => ({ trackEvent: vi.fn() }));

import { useGrooveCardPlayback } from '../useGrooveCardPlayback';

// ── Fixture ─────────────────────────────────────────────────────────────────

function makeConfig(): GrooveCardBlockConfig {
  return {
    title: 'Test Groove',
    subtitle: '',
    originalBpm: 120,
    originalKey: 'E',
    lengthBars: 8,
    stems: {
      bass: '/audio-samples/silence.ogg',
      drums: '/audio-samples/silence.ogg',
      harmony: '/audio-samples/silence.ogg',
    },
    previewCaption: '',
    stateCaptions: {},
    allowBookmark: false,
  };
}

function resetCalls() {
  engineCalls.registerTracks = [];
  engineCalls.unregisterTracksByPrefix = [];
  engineCalls.stopAudioStems = 0;
  engineCalls.start = 0;
  engineMock.registerTracks.mockClear();
  engineMock.unregisterTracksByPrefix.mockClear();
  engineMock.stopAudioStems.mockClear();
  engineMock.start.mockClear();
}

// Helper: read the bass region's loopSlice from the LAST registerTracks call.
function lastBassLoopSlice():
  | { startSeconds: number; endSeconds: number }
  | undefined {
  const last = engineCalls.registerTracks.at(-1);
  if (!last) return undefined;
  const bassTrack = last.find((t: any) => t.instrumentType === 'audio-bass');
  return bassTrack?.regions?.[0]?.loopSlice;
}

function lastBassRegion(): any {
  const last = engineCalls.registerTracks.at(-1);
  if (!last) return undefined;
  return last.find((t: any) => t.instrumentType === 'audio-bass')?.regions?.[0];
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useGrooveCardPlayback — loop-selection scenarios', () => {
  beforeEach(() => {
    resetCalls();
    mockAudioContextTime = 0;
    engineMock.getState.mockReturnValue('stopped');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('registerStemTracks always calls unregisterTracksByPrefix immediately before registerTracks', async () => {
    // This is the defensive pattern that fixes the engine's redundant-
    // update bug. Every register MUST be preceded by an unregister so the
    // engine cannot accidentally keep a stale loopSlice from a prior call.
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
    );

    await act(async () => {
      await result.current.play();
    });

    expect(engineCalls.unregisterTracksByPrefix.length).toBeGreaterThan(0);
    expect(engineCalls.registerTracks.length).toBeGreaterThan(0);
    // The unregister must happen FIRST.
    expect(
      engineMock.unregisterTracksByPrefix.mock.invocationCallOrder[0]!,
    ).toBeLessThan(engineMock.registerTracks.mock.invocationCallOrder[0]!);
  });

  it('selection BEFORE play → first registerTracks delivers regions WITH loopSlice', async () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-B' }),
    );
    act(() => result.current.setLoopSelection({ startBar: 1, endBar: 4 }));
    resetCalls();

    await act(async () => {
      await result.current.play();
    });

    const slice = lastBassLoopSlice();
    expect(slice).toBeDefined();
    // 16s buffer ÷ 8 bars = 2s/bar; bars 1..4 = 0..8s.
    expect(slice!.startSeconds).toBeCloseTo(0, 3);
    expect(slice!.endSeconds).toBeCloseTo(8, 3);
  });

  it('no selection → first registerTracks delivers regions WITHOUT loopSlice', async () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-C' }),
    );
    await act(async () => {
      await result.current.play();
    });

    expect(lastBassLoopSlice()).toBeUndefined();
  });

  it('play with selection → stop → CLEAR selection → play again: second registerTracks has NO loopSlice', async () => {
    // This is the EXACT bug we hit. Engine's redundant-update optimization
    // would drop the second registerTracks because region/event counts
    // matched, leaving the stale loopSlice in place. With the hook-side
    // unregisterTracksByPrefix and the engine-side audio-stem exemption,
    // the second register must take effect.
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-D' }),
    );

    act(() => result.current.setLoopSelection({ startBar: 1, endBar: 4 }));
    await act(async () => {
      await result.current.play();
    });
    expect(lastBassLoopSlice()).toBeDefined();

    await act(async () => {
      await result.current.stop();
    });
    act(() => result.current.setLoopSelection(null));
    resetCalls();

    await act(async () => {
      await result.current.play();
    });

    expect(lastBassLoopSlice()).toBeUndefined();
    // Defensive unregister was applied.
    expect(engineCalls.unregisterTracksByPrefix.length).toBeGreaterThan(0);
  });

  it('play with NO selection → stop → ADD selection → play again: second registerTracks HAS loopSlice', async () => {
    // The mirror image of the previous test. Going from "no slice" to
    // "slice" must also propagate to the engine.
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-E' }),
    );

    await act(async () => {
      await result.current.play();
    });
    expect(lastBassLoopSlice()).toBeUndefined();

    await act(async () => {
      await result.current.stop();
    });
    act(() => result.current.setLoopSelection({ startBar: 2, endBar: 5 }));
    resetCalls();

    await act(async () => {
      await result.current.play();
    });

    const slice = lastBassLoopSlice();
    expect(slice).toBeDefined();
    expect(slice!.startSeconds).toBeCloseTo(2, 3); // bar 2 starts at 2s
    expect(slice!.endSeconds).toBeCloseTo(10, 3); // bar 5 ends at 10s
  });

  it('play with selection → stop → CHANGE selection → play again: second registerTracks reflects the NEW range', async () => {
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-F' }),
    );

    act(() => result.current.setLoopSelection({ startBar: 1, endBar: 4 }));
    await act(async () => {
      await result.current.play();
    });
    expect(lastBassLoopSlice()!.endSeconds).toBeCloseTo(8, 3);

    await act(async () => {
      await result.current.stop();
    });
    act(() => result.current.setLoopSelection({ startBar: 5, endBar: 8 }));
    resetCalls();

    await act(async () => {
      await result.current.play();
    });

    const slice = lastBassLoopSlice();
    expect(slice).toBeDefined();
    expect(slice!.startSeconds).toBeCloseTo(8, 3); // bar 5 starts at 8s
    expect(slice!.endSeconds).toBeCloseTo(16, 3); // bar 8 ends at 16s
  });

  it('every region carries loopCount: 0 (infinite) regardless of whether loopSlice is present', async () => {
    // Guard against an accidental change that would let regions auto-stop
    // when toggling slice on/off.
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-G' }),
    );

    await act(async () => {
      await result.current.play();
    });
    expect(lastBassRegion()?.loopCount).toBe(0);

    await act(async () => {
      await result.current.stop();
    });
    act(() => result.current.setLoopSelection({ startBar: 1, endBar: 4 }));
    resetCalls();

    await act(async () => {
      await result.current.play();
    });
    expect(lastBassRegion()?.loopCount).toBe(0);
    expect(lastBassRegion()?.loopSlice).toBeDefined();
  });

  it('selecting the FULL range collapses to null (no slice — equivalent to full-buffer loop)', async () => {
    // The hook's setLoopSelection contains a guard that collapses
    // {startBar:1, endBar:lengthBars} to null because it's a no-op
    // selection. Without this collapse the user would see "loop the whole
    // groove" rendered as a "slice loop"; the audio behavior is identical
    // but it confuses the engine path.
    const { result } = renderHook(() =>
      useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-H' }),
    );

    act(() => result.current.setLoopSelection({ startBar: 1, endBar: 8 }));
    expect(result.current.loopSelection).toBeNull();

    await act(async () => {
      await result.current.play();
    });
    expect(lastBassLoopSlice()).toBeUndefined();
  });
});
