/**
 * useGrooveCardPlayback — bassline variant swap ("Lines & Fills", PR3a).
 *
 * The caller-observable contract of `setBassVariant`:
 *   1. Selecting a variant swaps the BASS PCM in place via swapStemBuffer
 *      ('audio-bass', <variant buffer>) — drums/harmony are NEVER passed.
 *   2. The swap RE-ASSERTS the live key (setInstrumentPitchShift) AND tempo
 *      (setStemRate) on audio-bass so the new take plays at the user's current
 *      transpose + speed.
 *
 * NOTE on timing: the buffer swap is SAMPLE-ACCURATE in the worklet — the hook
 * hands the PCM to engine.swapStemBuffer immediately, and the patched signalsmith
 * worklet (`swapAtLoopStart`) replaces the looping buffer the instant its
 * read-head wraps to loopStart (exactly on the downbeat, no JS-timer jitter).
 * These tests assert the swap MECHANISM (right buffer/stem, key+tempo re-assert);
 * the sample-exact timing lives in the worklet and is verified by ear.
 *   3. `null` restores the DEFAULT bass (resolves the default buffer).
 *   4. Re-selecting the already-active variant is a no-op (no engine call).
 *   5. A cold variant is decoded on demand (ensureVariant) before the swap.
 *
 * The audible SEAMLESSNESS of the swap is NOT asserted here — that needs a real
 * variant file + a browser + ears (per the plan). This test proves the swap
 * LOGIC: the right engine calls, with the right buffer, re-asserting key+tempo.
 * The engine is mocked at WindowRegistry (no audio thread in jsdom).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { GrooveCardBlockConfig } from '@bassnotion/contracts';

const transportStart = vi.fn(async () => undefined);
vi.mock('@/domains/playback/contexts/TransportContext', () => ({
  useTransportControlsSafe: () => ({
    start: transportStart,
    pause: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    isPlaying: false,
    setAutoStopEnabled: vi.fn(),
  }),
}));

const engineCalls: {
  swapStemBuffer: Array<[unknown, unknown]>;
  pitchShift: Array<[unknown, unknown, unknown]>;
  stemRate: Array<[unknown, unknown, unknown]>;
} = { swapStemBuffer: [], pitchShift: [], stemRate: [] };

const SEAM_TIME = 4.2;

const engineMock = {
  getState: vi.fn(() => 'stopped'),
  setAudioStemBuffers: vi.fn(),
  stopAudioStems: vi.fn(),
  unregisterTracksByPrefix: vi.fn(),
  registerTracks: vi.fn(),
  setInstrumentMuted: vi.fn(),
  enableCountdown: vi.fn(),
  addCountdownRegion: vi.fn(),
  setCountdownConfig: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getTransportStartTime: vi.fn(() => 0.5),
  setInstrumentVolume: vi.fn(),
  setInstrumentPitchShift: vi.fn((t: unknown, s: unknown, at?: unknown) => {
    engineCalls.pitchShift.push([t, s, at]);
  }),
  setStemRate: vi.fn((t: unknown, r: unknown, at?: unknown) => {
    engineCalls.stemRate.push([t, r, at]);
  }),
  swapStemBuffer: vi.fn(async (t: unknown, buf: unknown) => {
    engineCalls.swapStemBuffer.push([t, buf]);
  }),
  getStemNextSeamTime: vi.fn(() => SEAM_TIME),
  enablePitchShiftForStem: vi.fn(),
  setPitchShiftLatencyCompensation: vi.fn(),
  rearmFutureIterationsForRegions: vi.fn(() => 2),
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

const makeBuffer = (tag: string) =>
  ({
    __tag: tag,
    duration: 16,
    length: 16 * 44100,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(16 * 44100)),
  }) as unknown as AudioBuffer;

const defaultBass = makeBuffer('default-bass');
const variantWarm = makeBuffer('variant-warm');
const variantCold = makeBuffer('variant-cold');

const ensureVariant = vi.fn(async (id: string) =>
  id === 'cold' ? variantCold : undefined,
);

vi.mock('../useGrooveCardStemPreload', () => ({
  useGrooveCardStemPreload: () => ({
    isPreloaded: true,
    loadedCount: 3,
    totalCount: 3,
    errors: [],
    preload: vi.fn(),
    getBuffer: vi.fn((stemKey: string) =>
      stemKey === 'bass' || stemKey === 'drums' || stemKey === 'harmony'
        ? defaultBass
        : null,
    ),
    getVariantBuffer: vi.fn((id: string) =>
      id === 'warm' ? variantWarm : undefined,
    ),
    ensureVariant,
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

const BLOCK: GrooveCardBlockConfig = {
  title: 'Test',
  subtitle: '',
  originalBpm: 120,
  originalKey: 'C',
  lengthBars: 8,
  stems: {
    bass: 'https://x/storage/v1/object/public/audio-samples/g/c/bass.ogg',
    drums: 'https://x/storage/v1/object/public/audio-samples/g/c/drums.ogg',
    harmony: 'https://x/storage/v1/object/public/audio-samples/g/c/harmony.ogg',
    bassVariants: [
      { id: 'warm', title: 'Bassline B', url: 'https://x/.../b.ogg' },
      { id: 'cold', title: 'Walking', url: 'https://x/.../w.ogg' },
    ],
  },
} as unknown as GrooveCardBlockConfig;

function mountHook() {
  return renderHook(() =>
    useGrooveCardPlayback({ block: BLOCK, cardId: 'card-1' } as never),
  );
}

describe('useGrooveCardPlayback — setBassVariant', () => {
  beforeEach(() => {
    engineCalls.swapStemBuffer = [];
    engineCalls.pitchShift = [];
    engineCalls.stemRate = [];
    mockAudioContextTime = 0;
    vi.clearAllMocks();
  });

  it('swaps the warm variant buffer into audio-bass (drums/harmony untouched)', async () => {
    const { result } = mountHook();
    await act(async () => {
      result.current.setBassVariant('warm');
    });
    expect(engineCalls.swapStemBuffer).toHaveLength(1);
    const [stem, buf] = engineCalls.swapStemBuffer[0];
    expect(stem).toBe('audio-bass');
    expect((buf as { __tag: string }).__tag).toBe('variant-warm');
    expect(result.current.activeBassVariantId).toBe('warm');
  });

  it('re-asserts the live key + tempo on audio-bass after the swap', async () => {
    const { result } = mountHook();
    await act(async () => {
      result.current.setBassVariant('warm');
    });
    // key re-assert on audio-bass
    expect(
      engineCalls.pitchShift.some(([t]) => t === 'audio-bass'),
    ).toBe(true);
    // tempo re-assert on audio-bass (ratio currentBpm/originalBpm = 1 at default)
    const rate = engineCalls.stemRate.find(([t]) => t === 'audio-bass');
    expect(rate).toBeDefined();
    expect(rate?.[1]).toBeCloseTo(1, 5);
  });

  it('cold variant is decoded on demand (ensureVariant) before swapping', async () => {
    const { result } = mountHook();
    await act(async () => {
      result.current.setBassVariant('cold');
    });
    expect(ensureVariant).toHaveBeenCalledWith('cold');
    const [, buf] = engineCalls.swapStemBuffer[0];
    expect((buf as { __tag: string }).__tag).toBe('variant-cold');
  });

  it('null restores the default bass buffer', async () => {
    const { result } = mountHook();
    await act(async () => {
      result.current.setBassVariant('warm');
    });
    engineCalls.swapStemBuffer = [];
    await act(async () => {
      result.current.setBassVariant(null);
    });
    expect(engineCalls.swapStemBuffer).toHaveLength(1);
    const [stem, buf] = engineCalls.swapStemBuffer[0];
    expect(stem).toBe('audio-bass');
    expect((buf as { __tag: string }).__tag).toBe('default-bass');
    expect(result.current.activeBassVariantId).toBeNull();
  });

  it('re-selecting the active variant is a no-op', async () => {
    const { result } = mountHook();
    await act(async () => {
      result.current.setBassVariant('warm');
    });
    engineCalls.swapStemBuffer = [];
    await act(async () => {
      result.current.setBassVariant('warm');
    });
    expect(engineCalls.swapStemBuffer).toHaveLength(0);
  });
});
