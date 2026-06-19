'use client';

/**
 * useNavPrefetch — warm the spine's route chunks on idle so the FIRST click on a
 * room is as instant as the seamless re-visits.
 *
 * Why this exists: the sidebar navigates via `<button onClick>` + router.push
 * (useViewTransitionRouter), NOT `<Link>`. Next.js's automatic prefetch only
 * fires for `<Link>` elements in the viewport — button nav gets ZERO prefetch, so
 * every first visit to a room pays the full route-chunk download+parse, and only
 * the second visit (now cached) is instant. The view-transition pre-heat warms
 * the ANIMATION, not the page code; this warms the page code.
 *
 * We call router.prefetch() for each nav target after first paint, on idle, so
 * the chunks land in the router cache before the user clicks. We prefetch the
 * CLEAN url (e.g. '/gym') — the exact string the sidebar pushes (router.push;
 * the host-rewrite middleware maps it to /app/gym) — not the internal path.
 *
 * Idle-scheduled (requestIdleCallback, Safari setTimeout fallback) so it never
 * competes with first paint. Disabled/coming-soon items are skipped. Idempotent:
 * Next dedupes repeat prefetches, and we only run the effect once per mount.
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

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

/**
 * Prefetch the given CLEAN nav urls (the strings the sidebar router.push-es) on
 * idle after first paint. Pass the urls of items you want warm — typically the
 * enabled spine + bottom-nav items.
 */
export function useNavPrefetch(urls: string[]): void {
  const router = useRouter();

  useEffect(() => {
    if (urls.length === 0) return;

    const cancel = onIdle(() => {
      for (const url of urls) {
        try {
          router.prefetch(url);
        } catch {
          // Prefetch is best-effort warming — never surface failures.
        }
      }
    }, 2000);

    return cancel;
    // urls is a stable module-level array (nav constants); join for a cheap dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, urls.join('|')]);
}
