'use client';

/**
 * Assessment Audio Preloader Hook
 *
 * FAANG-style audio preloading for assessment questions.
 * Preloads all question audio files when questions are available,
 * storing them in a memory cache for instant playback.
 *
 * Pattern inspired by BassNotion's tutorial page preloading:
 * - Parallel downloads with Promise.allSettled
 * - Memory cache with Map
 * - Graceful fallback if preload fails
 */

import { useEffect, useRef, useCallback } from 'react';
import type { AssessmentQuestion } from '@bassnotion/contracts';

// Global cache for preloaded audio - persists across component remounts
const audioCache = new Map<string, HTMLAudioElement>();
const preloadPromises = new Map<string, Promise<HTMLAudioElement>>();

/**
 * Resolve audio URL - handles both full URLs and Supabase storage paths
 */
function resolveAudioUrl(url: string): string {
  if (
    url.startsWith('http://') ||
    url.startsWith('https://') ||
    url.startsWith('/')
  ) {
    return url;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return `/audio/${url}`;
  }
  return `${supabaseUrl}/storage/v1/object/public/audio-samples/${url}`;
}

/**
 * Preload a single audio file
 * Returns existing promise if already loading (deduplication)
 */
async function preloadAudio(url: string): Promise<HTMLAudioElement> {
  const resolvedUrl = resolveAudioUrl(url);

  // Check if already cached
  if (audioCache.has(resolvedUrl)) {
    return audioCache.get(resolvedUrl)!;
  }

  // Check if already loading (deduplication)
  if (preloadPromises.has(resolvedUrl)) {
    return preloadPromises.get(resolvedUrl)!;
  }

  // Create preload promise
  const loadPromise = new Promise<HTMLAudioElement>((resolve, reject) => {
    const audio = new Audio();
    audio.preload = 'auto';

    audio.addEventListener(
      'canplaythrough',
      () => {
        audioCache.set(resolvedUrl, audio);
        preloadPromises.delete(resolvedUrl);
        resolve(audio);
      },
      { once: true },
    );

    audio.addEventListener(
      'error',
      (e) => {
        preloadPromises.delete(resolvedUrl);
        reject(new Error(`Failed to preload audio: ${resolvedUrl}`));
      },
      { once: true },
    );

    // Start loading
    audio.src = resolvedUrl;
    audio.load();
  });

  preloadPromises.set(resolvedUrl, loadPromise);
  return loadPromise;
}

/**
 * Get cached audio element for a URL
 */
export function getCachedAudio(url: string): HTMLAudioElement | undefined {
  const resolvedUrl = resolveAudioUrl(url);
  return audioCache.get(resolvedUrl);
}

/**
 * Check if audio is cached
 */
export function isAudioCached(url: string): boolean {
  const resolvedUrl = resolveAudioUrl(url);
  return audioCache.has(resolvedUrl);
}

export interface UseAssessmentAudioPreloaderOptions {
  /** Questions to preload audio for */
  questions: AssessmentQuestion[];
  /** Start preloading immediately on mount (default: true) */
  preloadOnMount?: boolean;
}

export interface UseAssessmentAudioPreloaderReturn {
  /** Whether all audio has been preloaded */
  isPreloaded: boolean;
  /** Number of audio files loaded */
  loadedCount: number;
  /** Total number of audio files to load */
  totalCount: number;
  /** Any errors that occurred during preloading */
  errors: string[];
  /** Manually trigger preloading */
  preload: () => Promise<void>;
  /** Get a cached audio element */
  getCached: (url: string) => HTMLAudioElement | undefined;
}

/**
 * Hook to preload assessment question audio files
 *
 * @example
 * ```tsx
 * const { isPreloaded, loadedCount, totalCount } = useAssessmentAudioPreloader({
 *   questions,
 *   preloadOnMount: true,
 * });
 * ```
 */
export function useAssessmentAudioPreloader({
  questions,
  preloadOnMount = true,
}: UseAssessmentAudioPreloaderOptions): UseAssessmentAudioPreloaderReturn {
  const mountedRef = useRef(true);
  const preloadStartedRef = useRef(false);
  const loadedCountRef = useRef(0);
  const errorsRef = useRef<string[]>([]);
  const forceUpdateRef = useRef(0);

  // Extract all audio URLs from questions
  const audioUrls = questions
    .filter((q) => q.audioConfig?.url)
    .map((q) => q.audioConfig!.url);

  const totalCount = audioUrls.length;

  // Force re-render when state changes
  const forceUpdate = useCallback(() => {
    forceUpdateRef.current += 1;
  }, []);

  // Preload all audio files in parallel
  const preload = useCallback(async () => {
    if (audioUrls.length === 0) return;
    if (preloadStartedRef.current) return;

    preloadStartedRef.current = true;
    loadedCountRef.current = 0;
    errorsRef.current = [];

    console.log(
      `[AssessmentAudioPreloader] Starting preload of ${audioUrls.length} audio files`,
    );
    const startTime = performance.now();

    // Load all in parallel with Promise.allSettled (FAANG pattern)
    const results = await Promise.allSettled(
      audioUrls.map(async (url) => {
        try {
          await preloadAudio(url);
          if (mountedRef.current) {
            loadedCountRef.current += 1;
            forceUpdate();
          }
          return url;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          if (mountedRef.current) {
            errorsRef.current.push(errorMsg);
          }
          throw error;
        }
      }),
    );

    const loadTime = performance.now() - startTime;
    const successCount = results.filter((r) => r.status === 'fulfilled').length;

    console.log(
      `[AssessmentAudioPreloader] Preload complete: ${successCount}/${audioUrls.length} in ${loadTime.toFixed(0)}ms`,
    );
  }, [audioUrls, forceUpdate]);

  // Preload on mount if enabled
  useEffect(() => {
    mountedRef.current = true;

    if (preloadOnMount && audioUrls.length > 0) {
      // Use requestIdleCallback for non-blocking load (FAANG pattern)
      if ('requestIdleCallback' in window) {
        window.requestIdleCallback(() => preload(), { timeout: 1000 });
      } else {
        // Safari fallback
        setTimeout(() => preload(), 10);
      }
    }

    return () => {
      mountedRef.current = false;
    };
  }, [preloadOnMount, preload, audioUrls.length]);

  return {
    isPreloaded: loadedCountRef.current >= totalCount && totalCount > 0,
    loadedCount: loadedCountRef.current,
    totalCount,
    errors: errorsRef.current,
    preload,
    getCached: getCachedAudio,
  };
}

export default useAssessmentAudioPreloader;
