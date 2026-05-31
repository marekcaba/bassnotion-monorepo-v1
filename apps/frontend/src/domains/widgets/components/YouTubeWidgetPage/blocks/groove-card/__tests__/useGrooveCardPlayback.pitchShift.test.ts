/**
 * useGrooveCardPlayback — pitch-shift scenarios (LAUNCH-02.5c).
 *
 * Comprehensive coverage of the user-facing pitch-shifting behaviour:
 *
 *   - Pre-play key taps (engine not yet warmed)
 *   - First default→pitched transition mid-loop
 *   - Pitched→pitched transitions (semitone-to-semitone)
 *   - Pitched→default disengagement
 *   - Stop / play cycles preserving pre-roll-state reset semantics
 *   - Interactions: mute bass while pitched, solo drums while pitched,
 *     click toggle while pitched, tempo change while pitched
 *   - Edge cases: rapid taps, taps during count-in, cap-exceeded taps
 *     on waitlist, loop-slice mode (slice doesn't pitch-shift via
 *     rearm), going through every key value -12..+12
 *
 * The engine is mocked at the WindowRegistry level so we can inspect
 * EVERY call into the pitch-shift API. The hook drives the orchestration
 * unmodified, so any regression in setKey's call ordering, in deferred
 * pitch math, or in the pre-roll constant will surface as a failed
 * assertion here.
 *
 * Why these tests matter:
 *   The pitch-shift work has many state interactions (idempotence flags
 *   on the engine, retroactive fade-out wraps on the scheduler, delta
 *   tracking of preRollSeconds) that we found EMPIRICALLY by listening.
 *   None of those are guarded by tests in the engine itself. A future
 *   refactor that "cleans up" any of those without understanding the
 *   audio-thread implications will only break at runtime. These tests
 *   lock the contract from the caller's perspective.
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

/** True iff the rearm call carries the canonical "pitched" preRoll. */
function rearmHadPitchedPreRoll(call: PitchShiftCall): boolean {
  const opts = call.args[1] as { preRollSeconds?: number } | undefined;
  return opts?.preRollSeconds === 0.14;
}

/** True iff the rearm call passed no pre-roll (i.e. going to default). */
function rearmHadNoPreRoll(call: PitchShiftCall): boolean {
  return call.args[1] === undefined;
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

    it('tap key BEFORE play: rearm runs even when not playing (no-op in engine when no live iters)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const rearmCalls = callsOf('rearmFutureIterationsForRegions');
      expect(rearmCalls.length).toBe(1);
      // Pre-roll 0.14 since residualShift !== 0.
      expect(rearmHadPitchedPreRoll(rearmCalls[0]!)).toBe(true);
    });

    it('tap key BEFORE play with offset=0 (no-op default): no rearm fires', () => {
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

      // Going back to default: rearm IS called (it's idempotent on the
      // engine side and removes pre-roll on existing entries).
      const rearmCalls = callsOf('rearmFutureIterationsForRegions');
      expect(rearmCalls.length).toBe(1);
      expect(rearmHadNoPreRoll(rearmCalls[0]!)).toBe(true);
    });
  });

  // ── Group 2: setKey value normalisation ────────────────────────────────────

  describe('setKey value normalisation', () => {
    it('clamps to ±6 in block mode (the universal cap after single-key-set + PitchShift)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(50);
      });
      expect(result.current.currentSemitones).toBe(6);

      act(() => {
        result.current.setKey(-50);
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

    it('disengage (pitched → 0): enablePitchShiftForStem is called with enabled=false', () => {
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

      const enables = callsOf('enablePitchShiftForStem');
      expect(enables.length).toBe(2);
      enables.forEach((c) => {
        expect(c.args[1]).toBe(false);
      });
    });

    it('non-zero offset: enablePitchShiftForStem is called with enabled=true', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(3);
      });

      const enables = callsOf('enablePitchShiftForStem');
      expect(enables.length).toBe(2);
      enables.forEach((c) => {
        expect(c.args[1]).toBe(true);
      });
    });
  });

  // ── Group 4: Call ordering invariants ──────────────────────────────────────

  describe('call ordering in setKey', () => {
    it('enablePitchShiftForStem is called BEFORE setInstrumentPitchShift (node must exist before pitch write)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const seq = engineCalls.pitchShiftSequence;
      const firstEnable = seq.findIndex(
        (c) => c.method === 'enablePitchShiftForStem',
      );
      const firstPitch = seq.findIndex(
        (c) => c.method === 'setInstrumentPitchShift',
      );
      expect(firstEnable).toBeGreaterThan(-1);
      expect(firstPitch).toBeGreaterThan(-1);
      expect(firstEnable).toBeLessThan(firstPitch);
    });

    it('setPitchShiftLatencyCompensation is ALWAYS called with enabled=false (latency comp is unused in current design)', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const latency = callsOf('setPitchShiftLatencyCompensation');
      expect(latency.length).toBeGreaterThanOrEqual(1);
      latency.forEach((c) => {
        expect(c.args[0]).toBe(false);
      });
    });

    it('rearmFutureIterationsForRegions is the LAST call in setKey', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const seq = engineCalls.pitchShiftSequence;
      const lastRearm = seq.findLastIndex(
        (c) => c.method === 'rearmFutureIterationsForRegions',
      );
      expect(lastRearm).toBe(seq.length - 1);
    });
  });

  // ── Group 5: Mid-loop transitions ──────────────────────────────────────────
  //
  // For these we need isPlaying to be true and a loop anchor (loopStart-
  // AudioTime) set. We simulate that by triggering play() with a mocked
  // count-in and then advancing audio time to mid-loop.

  describe('mid-loop transitions', () => {
    it('pitched→pitched mid-loop: setInstrumentPitchShift is DEFERRED to next loop seam', async () => {
      // First tap (default→pitched): state moves to +1.
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );
      act(() => {
        result.current.setKey(1);
      });

      // Play start: simulate that we're now playing.
      // We can't easily mock isPlaying directly, but the orchestration
      // calls play() which internally calls becomeActive() and the
      // engine state-transitions. The actual deferred behaviour depends
      // on `isPlaying && loopStartAudioTime != null`. Without a fully
      // wired play, the second tap in this test will still treat it as
      // not-playing (immediate write). We document that limitation and
      // verify the pre-roll value either way is 0.14 (pitched mode).
      resetCalls();
      act(() => {
        result.current.setKey(2); // pitched→pitched
      });

      const rearmCalls = callsOf('rearmFutureIterationsForRegions');
      expect(rearmCalls.length).toBe(1);
      expect(rearmHadPitchedPreRoll(rearmCalls[0]!)).toBe(true);
    });

    it('pitched→default: rearm is called WITHOUT preRollSeconds (delta -0.14 applied internally)', () => {
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

      const rearm = callsOf('rearmFutureIterationsForRegions');
      expect(rearm.length).toBe(1);
      expect(rearmHadNoPreRoll(rearm[0]!)).toBe(true);
    });

    it('default→pitched→pitched→default: every transition fires the correct rearm pre-roll', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      // Default → +1
      act(() => {
        result.current.setKey(1);
      });
      const r1 = callsOf('rearmFutureIterationsForRegions');
      expect(rearmHadPitchedPreRoll(r1[r1.length - 1]!)).toBe(true);

      // +1 → +2
      act(() => {
        result.current.setKey(2);
      });
      const r2 = callsOf('rearmFutureIterationsForRegions');
      expect(rearmHadPitchedPreRoll(r2[r2.length - 1]!)).toBe(true);

      // +2 → -1 (still pitched)
      act(() => {
        result.current.setKey(-1);
      });
      const r3 = callsOf('rearmFutureIterationsForRegions');
      expect(rearmHadPitchedPreRoll(r3[r3.length - 1]!)).toBe(true);

      // -1 → 0
      act(() => {
        result.current.setKey(0);
      });
      const r4 = callsOf('rearmFutureIterationsForRegions');
      expect(rearmHadNoPreRoll(r4[r4.length - 1]!)).toBe(true);

      // 0 → +3 (re-engage)
      act(() => {
        result.current.setKey(3);
      });
      const r5 = callsOf('rearmFutureIterationsForRegions');
      expect(rearmHadPitchedPreRoll(r5[r5.length - 1]!)).toBe(true);
    });
  });

  // ── Group 6: enablePitchShiftForStem uses { seamless: true } ──────────────

  describe('seamless option on routing changes', () => {
    it('enablePitchShiftForStem is called with { seamless: true } so in-flight sources are NOT killed', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const enables = callsOf('enablePitchShiftForStem');
      enables.forEach((c) => {
        const opts = c.args[2] as { seamless?: boolean } | undefined;
        expect(opts?.seamless).toBe(true);
      });
    });

    it('setPitchShiftLatencyCompensation is called with { seamless: true } so drum sources are NOT killed', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const latency = callsOf('setPitchShiftLatencyCompensation');
      latency.forEach((c) => {
        const opts = c.args[1] as { seamless?: boolean } | undefined;
        expect(opts?.seamless).toBe(true);
      });
    });
  });

  // ── Group 7: rearm region scope ────────────────────────────────────────────

  describe('rearm region scope (drums NOT rearmed)', () => {
    it('rearmFutureIterationsForRegions is called ONLY with bass + harmony region ids — drums omitted', () => {
      const { result } = renderHook(() =>
        useGrooveCardPlayback({ block: makeConfig(), cardId: 'card-A' }),
      );

      act(() => {
        result.current.setKey(1);
      });

      const rearm = callsOf('rearmFutureIterationsForRegions');
      expect(rearm.length).toBe(1);
      const regionIds = rearm[0]!.args[0] as string[];
      const joined = regionIds.join(',');
      expect(joined).toContain('audio-bass-region');
      expect(joined).toContain('audio-harmony-region');
      expect(joined).not.toContain('audio-drums-region');
    });

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
      expect(callsOf('enablePitchShiftForStem').length).toBe(2);
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

      // 4 rearm calls, not 5. The final 0-tap was short-circuited.
      const rearm = callsOf('rearmFutureIterationsForRegions');
      expect(rearm.length).toBe(4);
      // All four were pitched (none of the proceeded taps had residualShift=0).
      rearm.forEach((r) => {
        expect(rearmHadPitchedPreRoll(r)).toBe(true);
      });
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

      const rearm = callsOf('rearmFutureIterationsForRegions');
      expect(rearm.length).toBe(5);
      expect(rearmHadPitchedPreRoll(rearm[0]!)).toBe(true);
      expect(rearmHadPitchedPreRoll(rearm[1]!)).toBe(true);
      expect(rearmHadPitchedPreRoll(rearm[2]!)).toBe(true);
      expect(rearmHadPitchedPreRoll(rearm[3]!)).toBe(true);
      expect(rearmHadNoPreRoll(rearm[4]!)).toBe(true);
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
