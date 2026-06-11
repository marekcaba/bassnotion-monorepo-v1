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
import type { BasslineVariant, GrooveCardStemSet } from '@bassnotion/contracts';
import type { AudioStemKey } from '@/domains/playback/modules/tracks/management/TrackManagerProcessor';
import { supabase } from '@/infrastructure/supabase/client';

/** A premium-bassline ref lives in the private bucket (object/sign/…) and needs
 *  signing before fetch; a public audio-samples url is fetched directly. */
function isPremiumBasslineRef(url: string): boolean {
  return url.includes('/premium-basslines/');
}

/**
 * Exchange a private-bucket bassline ref for a real, short-lived signed URL via
 * the gated signer (backend checks the linesAndFills feature grant). Throws on a
 * 403 (not entitled) or any failure — the caller treats that as "no variant".
 */
async function resolveSignedVariantUrl(refUrl: string): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(
    `${apiUrl}/api/v1/grooves/bassline-url?path=${encodeURIComponent(refUrl)}`,
    {
      headers: session
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
    },
  );
  if (!res.ok) {
    throw new Error(`bassline-url signer failed: HTTP ${res.status}`);
  }
  const { url } = (await res.json()) as { url: string };
  return url;
}

/** URL-keyed cache. Multiple cards sharing the same stem URL share the
 *  decoded buffer. */
const stemCache = new Map<string, AudioBuffer>();

/** Module-level in-flight dedupe so concurrent decodes of the same URL
 *  collapse to one fetch + decode pass. */
const inflight = new Map<string, Promise<AudioBuffer>>();

/**
 * Premium bassline variants are keyed by their STABLE id, NOT their URL — a
 * signed premium-bucket URL carries an ephemeral token that changes on every
 * mint, so URL-keying would never hit the cache. The decoded buffer is the
 * stable identity; the URL is only needed for a cold fetch.
 */
const variantCache = new Map<string, AudioBuffer>();
const variantInflight = new Map<string, Promise<AudioBuffer>>();

async function fetchAndDecodeVariant(
  audioContext: AudioContext,
  variant: BasslineVariant,
): Promise<AudioBuffer> {
  const key = variant.id;
  if (variantCache.has(key)) return variantCache.get(key)!;
  if (variantInflight.has(key)) return variantInflight.get(key)!;

  const promise = (async () => {
    // A premium variant lives in the PRIVATE premium-basslines bucket — its
    // stored url is a tokenless `object/sign/…` ref that 400s if fetched
    // directly. Resolve a real, short-lived signed URL through the gated signer
    // first (the backend checks the linesAndFills feature grant). A public
    // audio-samples url (legacy / free) is fetched directly.
    const fetchUrl = isPremiumBasslineRef(variant.url)
      ? await resolveSignedVariantUrl(variant.url)
      : variant.url;
    const response = await fetch(fetchUrl);
    if (!response.ok) {
      throw new Error(
        `variant fetch failed: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    variantCache.set(key, buffer);
    variantInflight.delete(key);
    return buffer;
  })().catch((err) => {
    variantInflight.delete(key);
    throw err;
  });

  variantInflight.set(key, promise);
  return promise;
}

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
  /** Read a premium bassline variant's decoded buffer by its stable id. */
  getVariantBuffer: (variantId: string) => AudioBuffer | undefined;
  /** Ensure a variant is decoded (on-demand, e.g. at hover/select). Resolves to
   *  the buffer or undefined if it fails (gated/403). Best-effort. */
  ensureVariant: (variantId: string) => Promise<AudioBuffer | undefined>;
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

    // Best-effort: warm the premium bassline variants too, so a member's first
    // swap is instant. A gated/403 variant is SKIPPED (caught) and never blocks
    // the core stems — they already loaded above. Keyed by stable id, not URL.
    const variants = stems.bassVariants ?? [];
    if (variants.length > 0) {
      await Promise.allSettled(
        variants.map((v) => fetchAndDecodeVariant(audioContext, v)),
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

  const getVariantBuffer = useCallback(
    (variantId: string): AudioBuffer | undefined => variantCache.get(variantId),
    [],
  );

  const ensureVariant = useCallback(
    async (variantId: string): Promise<AudioBuffer | undefined> => {
      if (!audioContext) return undefined;
      const cached = variantCache.get(variantId);
      if (cached) return cached;
      const variant = stems.bassVariants?.find((v) => v.id === variantId);
      if (!variant) return undefined;
      try {
        return await fetchAndDecodeVariant(audioContext, variant);
      } catch {
        return undefined; // gated / 403 / decode failure — best-effort
      }
    },
    [audioContext, stems],
  );

  return {
    isPreloaded: totalCount > 0 && loadedCountRef.current >= totalCount,
    loadedCount: loadedCountRef.current,
    totalCount,
    errors: errorsRef.current,
    preload,
    getBuffer,
    getVariantBuffer,
    ensureVariant,
  };
}

// ---------------------------------------------------------------------------
// Test-only exports.
// ---------------------------------------------------------------------------

/** @internal — test use only. */
export function _resetStemPreloadCache(): void {
  stemCache.clear();
  inflight.clear();
  variantCache.clear();
  variantInflight.clear();
}

/** @internal — test use only; lets tests assert cache content. */
export function _peekStemCache(): ReadonlyMap<string, AudioBuffer> {
  return stemCache;
}
