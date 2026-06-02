'use client';

/**
 * useGrooveCardStemPreload — LAUNCH-02.5c, updated for 02.5e
 * (single-key-set + PitchShift).
 *
 * Preloads decoded `AudioBuffer`s for the Groove Card's 3 stem URLs
 * (bass / drums / harmony). Mirrors the orchestration pattern from
 * useAssessmentAudioPreloader:
 *
 *  - Module-level cache keyed by URL (persists across remounts so
 *    navigating away and back doesn't re-decode)
 *  - Module-level in-flight dedupe so two cards on the same page sharing
 *    a URL only fetch once
 *  - Promise.allSettled for parallel load with graceful per-item failure
 *  - requestIdleCallback with setTimeout(..., 10) Safari fallback
 *
 * Difference from the assessment preloader: this caches **decoded
 * AudioBuffer** instances via `audioContext.decodeAudioData(arrayBuffer)`
 * rather than HTMLAudioElement. The Groove Card needs raw buffers for
 * AudioPlayerScheduler / the infinite-loop scheduling path.
 *
 * The hook does not own the AudioContext — the caller passes one.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GrooveCardStemSet } from '@bassnotion/contracts';
import type { AudioStemKey } from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';

/** URL-keyed cache. Multiple cards sharing the same stem URL share the
 *  decoded buffer. */
const stemCache = new Map<string, AudioBuffer>();

/** Module-level in-flight dedupe so concurrent decodes of the same URL
 *  collapse to one fetch + decode pass. */
const inflight = new Map<string, Promise<AudioBuffer>>();

async function fetchAndDecode(
  audioContext: AudioContext,
  url: string,
): Promise<AudioBuffer> {
  if (stemCache.has(url)) {
    return stemCache.get(url)!;
  }
  if (inflight.has(url)) {
    return inflight.get(url)!;
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
    stemCache.set(url, buffer);
    inflight.delete(url);
    return buffer;
  })().catch((err) => {
    inflight.delete(url);
    throw err;
  });

  inflight.set(url, promise);
  return promise;
}

export interface UseGrooveCardStemPreloadOptions {
  /** AudioContext used to decode the buffers. Required. */
  audioContext: AudioContext | null;
  /** The single stem set from the block config. */
  stems: GrooveCardStemSet;
  /** Start preloading immediately when audioContext is ready. */
  preloadOnMount?: boolean;
}

export interface UseGrooveCardStemPreloadReturn {
  /** True once every non-empty stem URL is cached. */
  isPreloaded: boolean;
  /** Cached buffers so far. */
  loadedCount: number;
  /** Total non-empty stem URLs requested. */
  totalCount: number;
  /** Per-item error messages. Does not prevent other items from loading. */
  errors: string[];
  /** Manually trigger preload. Idempotent. */
  preload: () => Promise<void>;
  /** Read a buffer if cached, else undefined. */
  getBuffer: (stem: AudioStemKey) => AudioBuffer | undefined;
}

// Musical stems the preloader fetches. The metronome click is NOT a
// per-groove upload (shared MIDI metronome in /app, single bundled
// sample on the waitlist), so it's not preloaded here. AudioStemKey
// still includes 'click' at the engine-channel level.
const STEM_NAMES = [
  'bass',
  'drums',
  'harmony',
] as const satisfies readonly Exclude<AudioStemKey, 'click'>[];

export function useGrooveCardStemPreload({
  audioContext,
  stems,
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
  const completedUrlsRef = useRef<Set<string>>(new Set());
  // Tracks URLs this hook instance has already tried, independent of
  // success/failure — without this guard a re-render that reruns the
  // mount effect would queue a duplicate preload for the same URLs.
  const attemptedUrlsRef = useRef<Set<string>>(new Set());

  // Total = number of non-empty stem URLs we actually plan to fetch.
  const requestedUrls = STEM_NAMES.map((stem) => stems[stem]).filter(
    (url): url is string => !!url,
  );
  const totalCount = requestedUrls.length;

  const preload = useCallback(async () => {
    if (!audioContext) return;

    const tasks: Array<{ stem: AudioStemKey; url: string }> = [];
    for (const stem of STEM_NAMES) {
      const url = stems[stem];
      if (!url) continue;
      if (completedUrlsRef.current.has(url)) continue;
      if (attemptedUrlsRef.current.has(url)) continue;
      tasks.push({ stem, url });
      attemptedUrlsRef.current.add(url);
    }
    if (tasks.length === 0) return;

    startedRef.current = true;

    const results = await Promise.allSettled(
      tasks.map(async ({ stem, url }) => {
        try {
          await fetchAndDecode(audioContext, url);
          if (mountedRef.current) {
            completedUrlsRef.current.add(url);
            loadedCountRef.current += 1;
            forceUpdate();
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (mountedRef.current) {
            errorsRef.current.push(`${stem} (${url}): ${msg}`);
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
  }, [audioContext, stems, forceUpdate]);

  useEffect(() => {
    mountedRef.current = true;
    if (!preloadOnMount) return;
    if (!audioContext) return;
    if (totalCount === 0) return;

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
  }, [audioContext, preloadOnMount, preload, totalCount]);

  const getBuffer = useCallback(
    (stem: AudioStemKey): AudioBuffer | undefined => {
      // 'click' is not a per-groove stem — see STEM_NAMES comment.
      if (stem === 'click') return undefined;
      const url = stems[stem];
      if (!url) return undefined;
      return stemCache.get(url);
    },
    [stems],
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
