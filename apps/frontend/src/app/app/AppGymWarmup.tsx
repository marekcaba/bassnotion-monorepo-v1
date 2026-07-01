'use client';

/**
 * AppGymWarmup — login/app-entry prefetch of the member's gym session.
 *
 * Mounted ONCE in AppClientLayout as a null-rendering sibling (never blocks
 * paint). After first paint, for an authenticated MEMBER, it warms the gym's
 * data into the TanStack Query cache on idle: the enrollment list, then today's
 * planned rep for the active enrollment. So when the user opens /app/gym it reads
 * from a warm cache and the overlay's Start button is live immediately — instead
 * of the gym running its fetch chain on open.
 *
 * Safe to prefetch the rep now that planning is a PURE read (the treadmill climb
 * advances on rep COMPLETION, not on plan — see training-engine.service
 * advanceClimbForToday). Tolerant by contract: a login prefetch must never
 * surface 401/403/404/422 as an error, so every step swallows failures.
 *
 * Renders null; pure side-effect.
 */

import { useEffect } from 'react';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { warmTodayRep } from '@/domains/training-engine/lib/warmTodayRep';

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

export function AppGymWarmup() {
  const { user, isAuthenticated, isReady } = useAuth();
  const { tier } = useEntitlement();
  const userId = user?.id;

  useEffect(() => {
    // Only warm for an authenticated member with a known id — never spam the
    // membership-gated endpoints for anon/free users (they'd 401/403).
    if (!isReady || !isAuthenticated || !userId || tier !== 'member') return;

    // Warm the whole rep chain (enrollments → today-rep → tutorial) into the shared cache, so the
    // gym opens instantly. The shared warmTodayRep() is also called on the Backstage page. (1)
    const cancel = onIdle(() => {
      void warmTodayRep(userId);
    }, 3000);

    return cancel;
  }, [isReady, isAuthenticated, userId, tier]);

  return null;
}
