/**
 * useGrooveCardStemPreload — LAUNCH-02.5c tests.
 *
 * Covers the orchestration mirrored from useAssessmentAudioPreloader:
 *   - Successful parallel load populates the cache for every (keySet,
 *     stem) pair
 *   - In-flight dedupe: two callers requesting the same URL only fetch
 *     once
 *   - Per-item failure does not block other items (Promise.allSettled)
 *   - getBuffer returns the cached buffer post-preload
 *   - preloadOnMount=false defers preload until manually called
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { GrooveCardKeySet } from '@bassnotion/contracts';
import {
  useGrooveCardStemPreload,
  _resetStemPreloadCache,
  _peekStemCache,
} from '../useGrooveCardStemPreload';

function mockBuffer(): AudioBuffer {
  return {
    length: 44100,
    duration: 1,
    sampleRate: 44100,
    numberOfChannels: 2,
    getChannelData: vi.fn(() => new Float32Array(44100)),
    copyFromChannel: vi.fn(),
    copyToChannel: vi.fn(),
  } as unknown as AudioBuffer;
}

function mockAudioContext(): AudioContext {
  return {
    currentTime: 0,
    sampleRate: 44100,
    state: 'running',
    destination: {} as AudioDestinationNode,
    decodeAudioData: vi.fn(async () => mockBuffer()),
  } as unknown as AudioContext;
}

function makeKeySet(
  label: string,
  offset: -8 | -4 | 0 | 4 | 8,
): GrooveCardKeySet {
  return {
    label,
    semitoneOffset: offset,
    isDefault: offset === 0,
    stems: {
      bass: `https://stub/${label}/bass.ogg`,
      drums: `https://stub/${label}/drums.ogg`,
      harmony: `https://stub/${label}/harmony.ogg`,
      click: `https://stub/${label}/click.ogg`,
    },
  };
}

const FIVE_KEYS: readonly GrooveCardKeySet[] = [
  makeKeySet('C', -8),
  makeKeySet('D', -4),
  makeKeySet('E', 0),
  makeKeySet('G', 4),
  makeKeySet('A', 8),
];

beforeEach(() => {
  _resetStemPreloadCache();
  // Default global fetch returns ok for every URL.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('useGrooveCardStemPreload — LAUNCH-02.5c', () => {
  it('preloads all 4 stems for the default key set on mount', async () => {
    const ctx = mockAudioContext();
    const { result } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: true,
      }),
    );

    await waitFor(() => expect(result.current.isPreloaded).toBe(true));
    expect(result.current.loadedCount).toBe(4);
    expect(result.current.totalCount).toBe(4);
    expect(result.current.errors).toEqual([]);
    expect(_peekStemCache().size).toBe(4);
    expect(result.current.getBuffer(2, 'bass')).toBeDefined();
    expect(result.current.getBuffer(2, 'drums')).toBeDefined();
    expect(result.current.getBuffer(2, 'harmony')).toBeDefined();
    expect(result.current.getBuffer(2, 'click')).toBeDefined();
  });

  it('returns isPreloaded=false until the preload completes', () => {
    const ctx = mockAudioContext();
    // Don't preload on mount so we can observe the pre-state.
    const { result } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: false,
      }),
    );
    expect(result.current.isPreloaded).toBe(false);
    expect(result.current.loadedCount).toBe(0);
    expect(result.current.totalCount).toBe(4);
  });

  it('manual preload() fills the cache when preloadOnMount=false', async () => {
    const ctx = mockAudioContext();
    const { result } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: false,
      }),
    );
    await act(async () => {
      await result.current.preload();
    });
    expect(result.current.loadedCount).toBe(4);
    expect(result.current.isPreloaded).toBe(true);
  });

  it('dedupes concurrent fetches across two hook instances on the same URL', async () => {
    const ctx = mockAudioContext();
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;

    // Two cards on one page both want the default key set.
    const { result: a } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: true,
      }),
    );
    const { result: b } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: true,
      }),
    );
    await waitFor(() => {
      expect(a.current.isPreloaded).toBe(true);
      expect(b.current.isPreloaded).toBe(true);
    });

    // Only 4 fetches total (one per stem URL) despite two hook instances.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('per-item failure does not block other items (Promise.allSettled)', async () => {
    const ctx = mockAudioContext();
    // Make the "drums" URL fail; everything else succeeds.
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('drums.ogg')) {
          return {
            ok: false,
            status: 500,
            statusText: 'Server Error',
            arrayBuffer: async () => new ArrayBuffer(0),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: 'OK',
          arrayBuffer: async () => new ArrayBuffer(8),
        };
      }),
    );

    const { result } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: true,
      }),
    );

    await waitFor(() => expect(result.current.loadedCount).toBe(3));
    // 3 of 4 succeed; the one failure populates errors.
    expect(result.current.loadedCount).toBe(3);
    expect(result.current.isPreloaded).toBe(false);
    expect(result.current.errors).toHaveLength(1);
    expect(result.current.errors[0]).toMatch(/drums/);
  });

  it('totalCount scales with the number of key sets requested', () => {
    const ctx = mockAudioContext();
    const { result } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: ctx,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [1, 2, 3],
        preloadOnMount: false,
      }),
    );
    expect(result.current.totalCount).toBe(12); // 3 sets × 4 stems
  });

  it('no audioContext → no preload, no errors', () => {
    const { result } = renderHook(() =>
      useGrooveCardStemPreload({
        audioContext: null,
        keys: FIVE_KEYS,
        keySetIndicesToLoad: [2],
        preloadOnMount: true,
      }),
    );
    expect(result.current.loadedCount).toBe(0);
    expect(result.current.errors).toEqual([]);
    expect(result.current.isPreloaded).toBe(false);
  });
});
