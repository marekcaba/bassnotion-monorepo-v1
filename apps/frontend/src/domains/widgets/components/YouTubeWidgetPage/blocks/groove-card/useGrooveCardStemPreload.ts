'use client';

/**
 * useGrooveCardStemPreload — LAUNCH-02.5c.
 *
 * Preloads decoded `AudioBuffer`s for the Groove Card's stem URLs.
 * Mirrors the orchestration pattern from useAssessmentAudioPreloader:
 *
 *  - Module-level cache and in-flight promise dedupe
 *  - Promise.allSettled for parallel load with graceful per-item failure
 *  - requestIdleCallback with setTimeout(..., 10) Safari fallback
 *
 * Difference from the assessment preloader: this caches **decoded
 * AudioBuffer** instances via `audioContext.decodeAudioData(arrayBuffer)`
 * rather than HTMLAudioElement. The Groove Card needs raw buffers for
 * AudioPlayerScheduler / the infinite-loop scheduling path.
 *
 * The hook does not own the AudioContext — the caller passes one. This
 * keeps stem preload independent of TransportContext's lifecycle and lets
 * the (future) waitlist surface use the same hook with its own AudioContext.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrooveCardKeySet } from '@bassnotion/contracts';
import type { AudioStemKey } from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';

/** Cache key: `${keySetIndex}#${stemName}`. The key set index pins the
 * 5-tuple position; the stem name pins which of the 4 stems. */
type CacheKey = string;

/** Module-level cache. Persists across remounts so navigating away and
 * back to the same tutorial doesn't re-decode every buffer. */
const stemCache = new Map<CacheKey, AudioBuffer>();

/** Module-level in-flight dedupe so two cards on the same page both
 * requesting the same stem URL only fetch once. */
const inflight = new Map<CacheKey, Promise<AudioBuffer>>();

function makeKey(keySetIndex: number, stem: AudioStemKey): CacheKey {
  return `${keySetIndex}#${stem}`;
}

/**
 * Fetch a URL, decode to an AudioBuffer, cache it. Dedupes concurrent
 * fetches via the inflight Map.
 */
async function fetchAndDecode(
  audioContext: AudioContext,
  url: string,
  cacheKey: CacheKey,
): Promise<AudioBuffer> {
  if (stemCache.has(cacheKey)) {
    return stemCache.get(cacheKey)!;
  }
  if (inflight.has(cacheKey)) {
    return inflight.get(cacheKey)!;
  }

  const promise = (async () => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `stem fetch failed: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    stemCache.set(cacheKey, buffer);
    inflight.delete(cacheKey);
    return buffer;
  })().catch((err) => {
    inflight.delete(cacheKey);
    throw err;
  });

  inflight.set(cacheKey, promise);
  return promise;
}

export interface UseGrooveCardStemPreloadOptions {
  /** AudioContext used to decode the buffers. Required. */
  audioContext: AudioContext | null;
  /** All 5 key sets from the block config. */
  keys: readonly GrooveCardKeySet[];
  /** Which key sets to actively preload. Subset of [0..4]. Typically the
   *  hook starts with [defaultIndex], then expands when the user crosses
   *  into adjacent territory. */
  keySetIndicesToLoad: readonly number[];
  /** Start preloading immediately when audioContext + indices are ready. */
  preloadOnMount?: boolean;
}

export interface UseGrooveCardStemPreloadReturn {
  /** True once every (keySetIndex, stem) in keySetIndicesToLoad is cached. */
  isPreloaded: boolean;
  /** Cached buffers so far. */
  loadedCount: number;
  /** Total buffers requested (= keySetIndicesToLoad.length × 4). */
  totalCount: number;
  /** Per-item error messages. Does not prevent other items from loading. */
  errors: string[];
  /** Manually trigger preload (e.g. when the user first crosses into a
   *  not-yet-loaded key set). Idempotent. */
  preload: () => Promise<void>;
  /** Read a buffer if cached, else undefined. */
  getBuffer: (
    keySetIndex: number,
    stem: AudioStemKey,
  ) => AudioBuffer | undefined;
}

const STEM_NAMES: readonly AudioStemKey[] = [
  'bass',
  'drums',
  'harmony',
  'click',
];

export function useGrooveCardStemPreload({
  audioContext,
  keys,
  keySetIndicesToLoad,
  preloadOnMount = true,
}: UseGrooveCardStemPreloadOptions): UseGrooveCardStemPreloadReturn {
  const mountedRef = useRef(true);
  // Re-render only when the loaded/error counts actually change.
  const [, setTick] = useState(0);
  const tickRef = useRef(0);
  const forceUpdate = useCallback(() => {
    if (!mountedRef.current) return;
    tickRef.current += 1;
    setTick(tickRef.current);
  }, []);

  const loadedCountRef = useRef(0);
  const errorsRef = useRef<string[]>([]);
  const startedRef = useRef(false);
  const completedKeysRef = useRef<Set<CacheKey>>(new Set());
  // Tracks (keySetIndex, stem) pairs this hook instance has already tried,
  // independent of success/failure. A retry requires an explicit
  // `preload()` call that flips this back via the public `retry` path
  // (LAUNCH-05 will add a retry UI; v1 just accepts the failure).
  const attemptedKeysRef = useRef<Set<CacheKey>>(new Set());

  const totalCount = keySetIndicesToLoad.length * STEM_NAMES.length;

  const preload = useCallback(async () => {
    if (!audioContext) return;
    if (keySetIndicesToLoad.length === 0) return;

    // Build the list of (keySetIndex, stem, url) tuples we need.
    // Filter out anything already completed OR already being attempted in
    // this hook instance — without this guard, a re-render that reruns
    // the mount effect would queue a duplicate preload for the same keys.
    const tasks: Array<{
      keySetIndex: number;
      stem: AudioStemKey;
      url: string;
    }> = [];
    for (const keySetIndex of keySetIndicesToLoad) {
      const keySet = keys[keySetIndex];
      if (!keySet) continue;
      for (const stem of STEM_NAMES) {
        const url = keySet.stems[stem];
        if (!url) continue;
        const cacheKey = makeKey(keySetIndex, stem);
        if (completedKeysRef.current.has(cacheKey)) continue;
        // Skip keys already attempted (success path adds to completedKeys;
        // failure path adds to attemptedKeysRef so retries are explicit).
        if (attemptedKeysRef.current.has(cacheKey)) continue;
        tasks.push({ keySetIndex, stem, url });
        attemptedKeysRef.current.add(cacheKey);
      }
    }
    if (tasks.length === 0) return;

    startedRef.current = true;

    const results = await Promise.allSettled(
      tasks.map(async ({ keySetIndex, stem, url }) => {
        const cacheKey = makeKey(keySetIndex, stem);
        try {
          await fetchAndDecode(audioContext, url, cacheKey);
          if (mountedRef.current) {
            completedKeysRef.current.add(cacheKey);
            loadedCountRef.current += 1;
            forceUpdate();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (mountedRef.current) {
            errorsRef.current.push(`${cacheKey}: ${msg}`);
            forceUpdate();
          }
          throw err;
        }
      }),
    );

    // Telemetry hook: silently log so unrecoverable failures are visible
    // in the console. Avoid throwing — the playback hook decides how to
    // degrade.
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0) {
      // eslint-disable-next-line no-console
      console.warn(
        `[GrooveCardStemPreload] ${failed}/${tasks.length} stems failed to load`,
      );
    }
  }, [audioContext, keys, keySetIndicesToLoad, forceUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    if (!preloadOnMount) return;
    if (!audioContext) return;
    if (keySetIndicesToLoad.length === 0) return;

    // Non-blocking schedule via requestIdleCallback, Safari fallback.
    if (
      typeof window !== 'undefined' &&
      'requestIdleCallback' in window &&
      typeof window.requestIdleCallback === 'function'
    ) {
      const id = window.requestIdleCallback(() => void preload(), {
        timeout: 1000,
      });
      return () => {
        mountedRef.current = false;
        if (typeof window.cancelIdleCallback === 'function') {
          window.cancelIdleCallback(id);
        }
      };
    } else {
      const id = setTimeout(() => void preload(), 10);
      return () => {
        mountedRef.current = false;
        clearTimeout(id);
      };
    }
  }, [audioContext, preloadOnMount, preload, keySetIndicesToLoad.length]);

  const getBuffer = useCallback(
    (keySetIndex: number, stem: AudioStemKey): AudioBuffer | undefined => {
      return stemCache.get(makeKey(keySetIndex, stem));
    },
    [],
  );

  return {
    isPreloaded: totalCount > 0 && loadedCountRef.current >= totalCount,
    loadedCount: loadedCountRef.current,
    totalCount,
    errors: errorsRef.current,
    preload,
    getBuffer,
  };
}

// ---------------------------------------------------------------------------
// Test-only exports.
// ---------------------------------------------------------------------------

/** @internal — test use only. */
export function _resetStemPreloadCache(): void {
  stemCache.clear();
  inflight.clear();
}

/** @internal — test use only; lets tests assert cache content. */
export function _peekStemCache(): ReadonlyMap<string, AudioBuffer> {
  return stemCache;
}
