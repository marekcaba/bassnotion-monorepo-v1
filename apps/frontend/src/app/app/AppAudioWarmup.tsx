'use client';

/**
 * AppAudioWarmup — route-aware background warm-up for the audio engine.
 *
 * Mounted ONCE in AppClientLayout as a sibling to children (never wrapping them,
 * so it can't block paint). After first paint, on routes that can actually reach
 * audio (gym, college, tutorials), it schedules ensureAudioReady() on idle — so
 * by the time the user picks something that needs sound, the engine is already
 * warm in the WindowRegistry singleton.
 *
 * On audio-free routes (Backstage root, gigs, studio, settings, welcome, store)
 * it does nothing — those pages stay engine-free.
 *
 * Renders null; this is a pure side-effect component.
 */

import { useEffect } from 'react';
import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';
import {
  ensureAudioReady,
  isAudioReady,
} from '@/domains/playback/services/ensureAudioReady';
import { routeCanReachAudio } from './audioRoutes';

const noop = () => undefined;

/** requestIdleCallback with a setTimeout fallback (Safari lacks rIC). */
function onIdle(cb: () => void, timeout: number): () => void {
  if (typeof window === 'undefined') return noop;
  const ric = (
    window as unknown as {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
      cancelIdleCallback?: (id: number) => void;
    }
  ).requestIdleCallback;
  if (ric) {
    const id = ric(cb, { timeout });
    return () => {
      (
        window as unknown as { cancelIdleCallback?: (id: number) => void }
      ).cancelIdleCallback?.(id);
    };
  }
  const id = window.setTimeout(cb, Math.min(timeout, 1500));
  return () => window.clearTimeout(id);
}

export function AppAudioWarmup() {
  const pathname = useInternalPathname();

  useEffect(() => {
    if (!routeCanReachAudio(pathname)) return;
    if (isAudioReady()) return;
    // Warm on idle after paint; best-effort, never blocks render.
    const cancel = onIdle(() => {
      void ensureAudioReady();
    }, 3000);
    return cancel;
  }, [pathname]);

  return null;
}
