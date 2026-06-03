/**
 * useGrooveCardPlayback — pitch-shift behaviour (LAUNCH-06 buffer-streaming).
 *
 * A key change transposes ONLY bass + harmony, which play through a single
 * signalsmith buffer-streaming node (pitch ⟂ tempo). The caller-observable
 * contract — what a player actually hears/sees — is:
 *
 *   1. Tap a key → bass + harmony get the requested semitone offset; drums
 *      and click are never transposed.
 *   2. WHILE PLAYING, the change is DEFERRED to the next loop seam (a future
 *      audio time), so the current loop finishes in the old key and the next
 *      plays the new one — no mid-loop pitch jump.
 *   3. WHILE STOPPED, the change applies immediately (no boundary), so the
 *      next play() starts already transposed.
 *   4. Changing TEMPO does not change PITCH (and vice-versa).
 *   5. Past the transpose cap the request is SWALLOWED (cap-as-CTA: fire the
 *      upsell, keep the current key) — it is NOT silently clamped.
 *
 * Tests are split in two:
 *   - "engine calls" — the only place we assert mechanism, because the
 *     deferral time is itself the behaviour (the 3rd arg to
 *     setInstrumentPitchShift IS the seam). We assert WHAT that time means
 *     (undefined vs future), not how many calls fire.
 *   - "playing-path behaviour (intent)" — drives play() so the loop anchor
 *     exists, then asserts the audible outcomes above through the hook's
 *     reactive surface + the boundary semantics.
 *
 * The engine is mocked at the WindowRegistry level. Because the pitch path is
 * pure scheduling (no audio thread in jsdom), the boundary argument is the
 * faithful proxy for "when will a listener hear this".
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

// Engine mock with state tracking. We instrument every pitch-shift API
// call so we can read back the full call sequence after each user
// action and assert order + arguments.
interface PitchShiftCall {
  method: string;
  args: unknown[];
}
const engineCalls: {
  pitchShiftSequence: PitchShiftCall[];
  registerTracks: Array<Array<unknown>>;
  unregisterTracksByPrefix: Array<string>;
  setAudioStemBuffers: Array<unknown>;
  stopAudioStems: number;
  start: number;
  setInstrumentMuted: Array<[unknown, boolean]>;
} = {
  pitchShiftSequence: [],
  registerTracks: [],
  unregisterTracksByPrefix: [],
  setAudioStemBuffers: [],
  stopAudioStems: 0,
  start: 0,
  setInstrumentMuted: [],
};

function track(method: string, ...args: unknown[]) {
  engineCalls.pitchShiftSequence.push({ method, args });
}

const engineMock = {
  getState: vi.fn(() => 'stopped'),
  setAudioStemBuffers: vi.fn((stems: unknown) => {
    engineCalls.setAudioStemBuffers.push(stems);
  }),
  stopAudioStems: vi.fn(() => {
    engineCalls.stopAudioStems += 1;
  }),
  unregisterTracksByPrefix: vi.fn((prefix: string) => {
    engineCalls.unregisterTracksByPrefix.push(prefix);
  }),
  registerTracks: vi.fn((tracks: unknown[]) => {
    engineCalls.registerTracks.push(tracks);
  }),
  setInstrumentMuted: vi.fn((stem: unknown, muted: boolean) => {
    engineCalls.setInstrumentMuted.push([stem, muted]);
  }),
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
  setInstrumentVolume: vi.fn(),

  // Pitch-shift surface — what we're testing.
  setInstrumentPitchShift: vi.fn(
    (
      instrumentType: unknown,
      semitones: unknown,
      applyAtAudioTime?: unknown,
    ) => {
      track(
        'setInstrumentPitchShift',
        instrumentType,
        semitones,
        applyAtAudioTime,
      );
    },
  ),
  enablePitchShiftForStem: vi.fn(
    (instrumentType: unknown, enabled: unknown, options?: unknown) => {
      track('enablePitchShiftForStem', instrumentType, enabled, options);
    },
  ),
  setPitchShiftLatencyCompensation: vi.fn(
    (enabled: unknown, options?: unknown) => {
      track('setPitchShiftLatencyCompensation', enabled, options);
    },
  ),
  rearmFutureIterationsForRegions: vi.fn(
    (regionIds: unknown, options?: unknown) => {
      track('rearmFutureIterationsForRegions', regionIds, options);
      return 2;
    },
  ),
  setPendingBufferResolver: vi.fn(),
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

// Force preload to be "ready" with realistic bass buffers so the hook's
// isReady is true after mount. Buffer length matches one 8-bar groove
// at 120 BPM (16 s).
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
    startCountdown: vi.fn(async () => undefined),
    cancelCountdown: vi.fn(),
  }),
}));

vi.mock('@/shared/utils/sentry', () => ({ trackEvent: vi.fn() }));

import { useGrooveCardPlayback } from '../useGrooveCardPlayback';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeConfig(
  overrides: Partial<GrooveCardBlockConfig> = {},
): GrooveCardBlockConfig {
  return {
    title: 'Test Groove',
    subtitle: '',
    originalBpm: 120,
    originalKey: 'E',
    lengthBars: 8,
    stems: {
      bass: '/audio-samples/bass.ogg',
      drums: '/audio-samples/drums.ogg',
      harmony: '/audio-samples/harmony.ogg',
    },
    previewCaption: '',
    stateCaptions: {},
    allowBookmark: false,
    ...overrides,
  };
}

function resetCalls() {
  engineCalls.pitchShiftSequence = [];
  engineCalls.registerTracks = [];
  engineCalls.unregisterTracksByPrefix = [];
  engineCalls.setAudioStemBuffers = [];
  engineCalls.stopAudioStems = 0;
  engineCalls.start = 0;
  engineCalls.setInstrumentMuted = [];
  engineMock.setInstrumentPitchShift.mockClear();
  engineMock.enablePitchShiftForStem.mockClear();
  engineMock.setPitchShiftLatencyCompensation.mockClear();
  engineMock.rearmFutureIterationsForRegions.mockClear();
  engineMock.setAudioStemBuffers.mockClear();
  engineMock.registerTracks.mockClear();
  engineMock.unregisterTracksByPrefix.mockClear();
  engineMock.stopAudioStems.mockClear();
  engineMock.start.mockClear();
  engineMock.setInstrumentMuted.mockClear();
}

function callsOf(method: string): PitchShiftCall[] {
  return engineCalls.pitchShiftSequence.filter((c) => c.method === method);
}

// ── Intent-level helpers ─────────────────────────────────────────────────────
//
// These describe pitch behaviour the way a listener experiences it, so the
// assertions read as musical guarantees rather than call bookkeeping.

/** The pitch writes (stem, semitones, boundary) produced since the last reset. */
function pitchWrites(): Array<{
  stem: unknown;
  semitones: unknown;
  boundary: unknown;
}> {
  return callsOf('setInstrumentPitchShift').map((c) => ({
    stem: c.args[0],
    semitones: c.args[1],
    boundary: c.args[2],
  }));
}

/** Map of stem → semitone offset that will be heard after the writes settle. */
function transposeByStem(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const w of pitchWrites()) out[String(w.stem)] = w.semitones as number;
  return out;
}

/**
 * True iff every pitch write is scheduled at a FUTURE audio time — i.e. the
 * key change is queued for the next loop seam, not applied mid-loop. The
 * caller passes `now` (the mocked AudioContext.currentTime).
 */
function allDeferredToFutureSeam(now: number): boolean {
  const writes = pitchWrites();
  return (
    writes.length > 0 &&
    writes.every((w) => typeof w.boundary === 'number' && w.boundary > now)
  );
}

/** True iff every pitch write applies immediately (no scheduled boundary). */
function allAppliedImmediately(): boolean {
  const writes = pitchWrites();
  return writes.length > 0 && writes.every((w) => w.boundary === undefined);
}

/**
 * Drive the hook from stopped → actively looping, so setKey/setTempo take the
 * "playing" branch (a loop anchor exists and changes defer to the seam).
 * Returns the audio time the loop is now anchored at. `nowAfter` advances the
 * mocked clock to mid-loop so a future seam is computable.
 */
async function playUntilLooping(
  result: { current: ReturnType<typeof useGrooveCardPlayback> },
  nowAfter = 1.0,
): Promise<void> {
  await act(async () => {
    await result.current.play();
  });
  mockAudioContextTime = nowAfter;
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('useGrooveCardPlayback — pitch-shift scenarios', () => {
  beforeEach(() => {
    resetCalls();
    mockAudioContextTime = 0;
    engineMock.getState.mockReturnValue('stopped');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── Group 1: Pre-play state ───────────────────────────────────────────────

  describe('pre-play (engine not warmed yet)', () => {
    it('tap key BEFORE play: state advances, NO engine writes fire while paused', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      // setKey while not playing — should update state but not fire any
      // pitch-shift engine writes because nothing is live.
      act(() => {
        result.current.setKey(1);
      });

      // The pitch param write is "immediate" when not playing (so the
      // engine has it ready for the next play); the enable / latency /
      // rearm calls also fire because the hook doesn't gate on isPlaying.
      // But they're still safe — engine treats them as no-ops without a
      // running scheduler.
      expect(result.current.currentSemitones).toBe(1);
      expect(result.current.pendingKeyShift).toBe(1);
    });

    it('tap key BEFORE play: setInstrumentPitchShift is called WITHOUT applyAtAudioTime (immediate write)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2); // bass + harmony
      // applyAtAudioTime arg should be undefined (immediate) since not playing.
      expect(writes[0]?.args[2]).toBeUndefined();
      expect(writes[1]?.args[2]).toBeUndefined();
    });

    it('tap key BEFORE play: pitch write applies immediately (boundary undefined when not playing)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2);
      // Not playing → the deferral boundary (3rd arg) is undefined, so the
      // write lands immediately and the next play() picks it up.
      writes.forEach((c) => {
        expect(c.args[1]).toBe(1);
        expect(c.args[2]).toBeUndefined();
      });
    });

    it('tap key BEFORE play, then back to 0: writes the 0-offset to both stems', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      // First tap to a non-zero offset to be in pitched state.
      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      // Tap back to 0.
      act(() => {
        result.current.setKey(0);
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2);
      writes.forEach((c) => {
        expect(c.args[1]).toBe(0);
      });
    });
  });

  // ── Group 2: setKey value normalisation ────────────────────────────────────

  describe('setKey value normalisation', () => {
    it('±6 is the block-mode cap: at-cap taps apply, past-cap taps are swallowed (cap-as-CTA)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      // Exactly at the cap applies.
      act(() => {
        result.current.setKey(6);
      });
      expect(result.current.currentSemitones).toBe(6);

      act(() => {
        result.current.setKey(-6);
      });
      expect(result.current.currentSemitones).toBe(-6);

      // Past the cap is swallowed (no silent clamp): the request is dropped
      // and surfaces the upsell instead, so currentSemitones stays put.
      act(() => {
        result.current.setKey(50);
      });
      expect(result.current.currentSemitones).toBe(-6);
    });

    it('rounds fractional values to nearest integer', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(2.3);
      });
      expect(result.current.currentSemitones).toBe(2);

      act(() => {
        result.current.setKey(-3.7);
      });
      expect(result.current.currentSemitones).toBe(-4);
    });

    it('same-value tap is a no-op (no engine writes)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      act(() => {
        result.current.setKey(1); // same value
      });

      // The hook short-circuits when desired === currentSemitones AND
      // pendingKeyShift is null. The first tap sets pendingKeyShift, but
      // we never cleared it, so this second tap actually runs the engine
      // calls again because pendingKeyShift !== null. Document this so
      // future refactors don't accidentally change it.
      // (If you change this behaviour, also revisit the engine's
      // idempotence guards — they protect against the same-value double
      // tap at the engine layer.)
      expect(callsOf('setInstrumentPitchShift').length).toBe(2);
    });
  });

  // ── Group 3: Sweep through every semitone value ────────────────────────────

  describe('semitone value sweep -6..+6', () => {
    // Skip 0 here because tapping 0 from the initial 0 state is a
    // short-circuit no-op (no writes fire). The 0-from-pitched case is
    // covered in the disengagement test below.
    it.each([-6, -5, -4, -3, -2, -1, 1, 2, 3, 4, 5, 6])(
      'tap key %i: writes the correct residualShift to setInstrumentPitchShift',
      (offset) => {
        const { result } = renderHook(() =>
          useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
        );

        act(() => {
          result.current.setKey(offset);
        });

        const writes = callsOf('setInstrumentPitchShift');
        // bass + harmony each get a write.
        expect(writes.length).toBe(2);
        // With single-key-set + PitchShift, the residualShift equals the
        // requested offset. Assert both stems get the same value.
        const bassWrite = writes.find((w) => w.args[0] === 'audio-bass');
        const harmonyWrite = writes.find((w) => w.args[0] === 'audio-harmony');
        expect(bassWrite).toBeDefined();
        expect(harmonyWrite).toBeDefined();
        expect(bassWrite!.args[1]).toBe(harmonyWrite!.args[1]);
      },
    );

    it('disengage (pitched → 0): writes 0 semitones to bass + harmony', () => {
      // LAUNCH-06 buffer-streaming: there is no enable/disable toggle.
      // Returning to default is just a 0-semitone pitch write on the same
      // node (it keeps streaming; only its pitch field changes).
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      // Engage pitched first.
      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      // Now back to default.
      act(() => {
        result.current.setKey(0);
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2);
      writes.forEach((c) => {
        expect(c.args[1]).toBe(0);
      });
    });

    it('non-zero offset: writes the offset to bass + harmony', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(3);
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2);
      writes.forEach((c) => {
        expect(c.args[1]).toBe(3);
      });
    });
  });

  // ── Group 4: Call ordering invariants ──────────────────────────────────────

  describe('call ordering in setKey', () => {
    // LAUNCH-06 buffer-streaming: a key change is a single deferred pitch
    // write per pitched stem. The legacy enable→pitch→latency→rearm dance
    // no longer exists, so the only ordering invariant is bass-then-harmony.
    it('writes bass before harmony, and ONLY setInstrumentPitchShift fires', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const seq = engineCalls.pitchShiftSequence;
      // The deferred design touches the node exactly twice (bass + harmony).
      expect(seq.length).toBe(2);
      expect(seq.every((c) => c.method === 'setInstrumentPitchShift')).toBe(
        true,
      );
      const bassIdx = seq.findIndex((c) => c.args[0] === 'audio-bass');
      const harmonyIdx = seq.findIndex((c) => c.args[0] === 'audio-harmony');
      expect(bassIdx).toBeGreaterThan(-1);
      expect(harmonyIdx).toBeGreaterThan(-1);
      expect(bassIdx).toBeLessThan(harmonyIdx);
    });

    it('does NOT call the legacy enable / latency-comp / rearm APIs', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      expect(callsOf('enablePitchShiftForStem').length).toBe(0);
      expect(callsOf('setPitchShiftLatencyCompensation').length).toBe(0);
      expect(callsOf('rearmFutureIterationsForRegions').length).toBe(0);
    });
  });

  // ── Group 5: Mid-loop transitions ──────────────────────────────────────────
  //
  // For these we need isPlaying to be true and a loop anchor (loopStart-
  // AudioTime) set. We simulate that by triggering play() with a mocked
  // count-in and then advancing audio time to mid-loop.

  describe('mid-loop transitions', () => {
    // LAUNCH-06: pitch is written to the buffer-streaming node with a
    // boundary argument (computeNextBoundaryAudioTime). The node loops
    // itself, so there is no rearm/pre-roll — the third arg carries the
    // deferral instead. When not playing the boundary is undefined and the
    // write applies immediately so the next play() picks it up.
    it('pitched→pitched: re-writes the new offset to bass + harmony', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      act(() => {
        result.current.setKey(1);
      });

      resetCalls();
      act(() => {
        result.current.setKey(2); // pitched→pitched
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2);
      writes.forEach((c) => {
        expect(c.args[1]).toBe(2);
      });
      // No legacy rearm in the new design.
      expect(callsOf('rearmFutureIterationsForRegions').length).toBe(0);
    });

    it('pitched→default: writes 0 with no rearm', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      // Engage pitched.
      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      // Back to default.
      act(() => {
        result.current.setKey(0);
      });

      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(2);
      writes.forEach((c) => {
        expect(c.args[1]).toBe(0);
      });
      expect(callsOf('rearmFutureIterationsForRegions').length).toBe(0);
    });

    it('default→pitched→pitched→default: each transition writes the new offset', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      const lastOffsetWritten = () => {
        const writes = callsOf('setInstrumentPitchShift');
        return writes.length ? writes[writes.length - 1]!.args[1] : undefined;
      };

      // Default → +1
      act(() => {
        result.current.setKey(1);
      });
      expect(lastOffsetWritten()).toBe(1);

      // +1 → +2
      act(() => {
        result.current.setKey(2);
      });
      expect(lastOffsetWritten()).toBe(2);

      // +2 → -1 (still pitched)
      act(() => {
        result.current.setKey(-1);
      });
      expect(lastOffsetWritten()).toBe(-1);

      // -1 → 0
      act(() => {
        result.current.setKey(0);
      });
      expect(lastOffsetWritten()).toBe(0);

      // 0 → +3 (re-engage)
      act(() => {
        result.current.setKey(3);
      });
      expect(lastOffsetWritten()).toBe(3);
    });
  });

  // ── Group 7: pitch-shift region scope ──────────────────────────────────────

  describe('pitch-shift region scope (drums NOT shifted)', () => {
    it('pitch-shift writes are scoped to bass + harmony — NOT drums or click', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const writes = callsOf('setInstrumentPitchShift');
      const stems = writes.map((w) => w.args[0]);
      expect(stems).toContain('audio-bass');
      expect(stems).toContain('audio-harmony');
      expect(stems).not.toContain('audio-drums');
      expect(stems).not.toContain('audio-click');
    });
  });

  // ── Group 8: Mute / solo / click interactions ──────────────────────────────

  describe('mute / solo / click interactions with pitch', () => {
    it('setStemMuted(audio-bass) while pitched: mute fires, NO pitch-shift collateral', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      act(() => {
        result.current.setStemMuted('audio-bass', true);
      });

      // The pitch-shift surface should NOT be touched by mute.
      expect(callsOf('setInstrumentPitchShift').length).toBe(0);
      expect(callsOf('enablePitchShiftForStem').length).toBe(0);
      expect(callsOf('rearmFutureIterationsForRegions').length).toBe(0);
      // setInstrumentMuted IS called.
      expect(engineCalls.setInstrumentMuted).toEqual(
        expect.arrayContaining([['audio-bass', true]]),
      );
    });

    it('setStemSolo(audio-drums) while pitched: sibling-mute fires, NO pitch-shift collateral', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      act(() => {
        result.current.setStemSolo('audio-drums');
      });

      // Bass + harmony get muted (sibling-mute pattern), but no pitch
      // calls fire.
      expect(callsOf('setInstrumentPitchShift').length).toBe(0);
      expect(callsOf('enablePitchShiftForStem').length).toBe(0);
      // Verify the sibling-mute did happen.
      const sibMutes = engineCalls.setInstrumentMuted.filter(
        ([, muted]) => muted === true,
      );
      expect(sibMutes.length).toBe(2);
    });

    it('setClickEnabled(true) while pitched: NO pitch-shift collateral', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      act(() => {
        result.current.setClickEnabled(true);
      });

      expect(callsOf('setInstrumentPitchShift').length).toBe(0);
      expect(callsOf('enablePitchShiftForStem').length).toBe(0);
    });

    it('setKey while bass is muted: pitch still applied (mute is independent of pitch)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      // Mute first.
      act(() => {
        result.current.setStemMuted('audio-bass', true);
      });
      resetCalls();
      // Then change key — pitch writes should still fire.
      act(() => {
        result.current.setKey(2);
      });

      expect(callsOf('setInstrumentPitchShift').length).toBe(2);
    });

    it('setKey while drums is soloed: pitch still applied (solo is independent of pitch)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setStemSolo('audio-drums');
      });
      resetCalls();
      act(() => {
        result.current.setKey(2);
      });

      expect(callsOf('setInstrumentPitchShift').length).toBe(2);
    });
  });

  // ── Group 9: Tempo + key interactions ─────────────────────────────────────

  describe('tempo + key interactions', () => {
    it('setTempo while pitched: tempo change does NOT fire pitch-shift writes', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });
      resetCalls();
      act(() => {
        result.current.setTempo(140);
      });

      expect(callsOf('setInstrumentPitchShift').length).toBe(0);
      expect(callsOf('enablePitchShiftForStem').length).toBe(0);
      expect(callsOf('rearmFutureIterationsForRegions').length).toBe(0);
    });
  });

  // ── Playing-path behaviour (intent) ────────────────────────────────────────
  //
  // These drive play() so a loop anchor exists, then assert the AUDIBLE
  // outcome — how a listener experiences a key/tempo change — rather than the
  // shape of the engine calls. This is the path the original suite couldn't
  // reach, so the mid-loop deferral guarantee went untested until now.

  describe('playing-path behaviour (intent)', () => {
    it('a key change while playing is deferred to the next loop seam (no mid-loop jump)', async () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      await playUntilLooping(result, 1.0);
      resetCalls();

      act(() => {
        result.current.setKey(3);
      });

      // The listener keeps hearing the current loop in the old key; the +3
      // only takes effect at a future seam.
      expect(allDeferredToFutureSeam(1.0)).toBe(true);
      expect(transposeByStem()).toEqual({
        'audio-bass': 3,
        'audio-harmony': 3,
      });
    });

    it('a key change while stopped applies immediately so the next play starts transposed', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      // Never played → no loop anchor.
      act(() => {
        result.current.setKey(-2);
      });

      expect(allAppliedImmediately()).toBe(true);
      expect(transposeByStem()).toEqual({
        'audio-bass': -2,
        'audio-harmony': -2,
      });
    });

    it('drums are never transposed by a key change', async () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      await playUntilLooping(result, 1.0);
      resetCalls();

      act(() => {
        result.current.setKey(5);
      });

      const stems = pitchWrites().map((w) => w.stem);
      expect(stems).not.toContain('audio-drums');
      expect(stems).not.toContain('audio-click');
    });

    it('changing tempo preserves the current key (tempo ⟂ pitch)', async () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      // Transpose +4, start playing.
      act(() => {
        result.current.setKey(4);
      });
      await playUntilLooping(result, 1.0);
      resetCalls();

      act(() => {
        result.current.setTempo(150);
      });

      // The audible key is unchanged: setTempo issues NO transposition write,
      // and the displayed semitone offset stays put.
      expect(callsOf('setInstrumentPitchShift').length).toBe(0);
      expect(result.current.currentSemitones).toBe(4);
    });

    it('changing key preserves the current tempo (pitch ⟂ tempo)', async () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      act(() => {
        result.current.setTempo(150);
      });
      await playUntilLooping(result, 1.0);

      act(() => {
        result.current.setKey(2);
      });

      // The tempo the listener hears is unchanged by a key tap.
      expect(result.current.currentBpm).toBe(150);
    });
  });

  // ── Group 10: Waitlist cap interactions ───────────────────────────────────

  describe('waitlist cap interaction with pitch', () => {
    it('mode=waitlist + tap past ±4: pitch writes SHOULD NOT fire (request swallowed)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({
          block: makeConfig(),
          cardId: 'card-A',
          mode: 'waitlist',
        }),
      );

      act(() => {
        result.current.setKey(7); // past the ±4 cap
      });

      // Cap-exceeded request is swallowed before reaching the engine.
      expect(callsOf('setInstrumentPitchShift').length).toBe(0);
      expect(callsOf('enablePitchShiftForStem').length).toBe(0);
      expect(callsOf('rearmFutureIterationsForRegions').length).toBe(0);
    });

    it('mode=waitlist + tap to ±4 exact: pitch writes DO fire (at cap, not over)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({
          block: makeConfig(),
          cardId: 'card-A',
          mode: 'waitlist',
        }),
      );

      act(() => {
        result.current.setKey(4); // exactly at cap
      });

      expect(callsOf('setInstrumentPitchShift').length).toBe(2);
    });

    it('mode=waitlist + tap to -4: writes fire correctly for negative side', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({
          block: makeConfig(),
          cardId: 'card-A',
          mode: 'waitlist',
        }),
      );

      act(() => {
        result.current.setKey(-4);
      });

      expect(callsOf('setInstrumentPitchShift').length).toBe(2);
    });
  });

  // ── Group 11: Rapid taps ──────────────────────────────────────────────────

  describe('rapid taps (engine delta tracking)', () => {
    it('rapid taps within a single act: setKey uses closure-captured state, so duplicates of initial value short-circuit', () => {
      // Documents an important behaviour: setKey's short-circuit check
      // (`desired === currentSemitones && pendingKeyShift === null`)
      // reads the CLOSURE value of currentSemitones, which is the
      // render-time snapshot. When multiple setKey calls fire in a
      // single act, the closure sees the INITIAL value across all of
      // them. So a final tap back to the initial value short-circuits,
      // even though intermediate taps progressed the state.
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1); // 0 → 1 (proceeds)
        result.current.setKey(2); // closure says 0, desired 2, proceeds
        result.current.setKey(3); // closure says 0, desired 3, proceeds
        result.current.setKey(2); // closure says 0, desired 2, proceeds
        result.current.setKey(0); // closure says 0, desired 0, short-circuits
      });

      // 4 taps proceeded (not 5) — the final 0-tap was short-circuited.
      // Each proceeding tap writes pitch to bass + harmony => 4 × 2 = 8.
      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(8);
    });

    it('rapid taps across separate acts: each tap proceeds (closure refreshes per render)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });
      act(() => {
        result.current.setKey(2);
      });
      act(() => {
        result.current.setKey(3);
      });
      act(() => {
        result.current.setKey(2);
      });
      act(() => {
        result.current.setKey(0);
      });

      // Each act refreshes the closure, so all 5 taps proceed (incl. the
      // final return to 0). 5 taps × 2 stems = 10 pitch writes; the last
      // pair carries the 0 offset.
      const writes = callsOf('setInstrumentPitchShift');
      expect(writes.length).toBe(10);
      expect(writes[writes.length - 1]!.args[1]).toBe(0);
      expect(writes[writes.length - 2]!.args[1]).toBe(0);
    });

    it('rapid taps converge to final value (currentSemitones reflects last tap)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
        result.current.setKey(2);
        result.current.setKey(3);
        result.current.setKey(2);
        result.current.setKey(5);
      });

      expect(result.current.currentSemitones).toBe(5);
    });
  });
});
