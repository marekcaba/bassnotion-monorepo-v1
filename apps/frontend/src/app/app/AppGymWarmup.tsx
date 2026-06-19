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
import { queryClient } from '@/lib/react-query';
import { gymKeys } from '@/domains/training-engine/api/gymQueryKeys';
import {
  fetchMyEnrollments,
  planTodayRep,
} from '@/domains/training-engine/api/training-engine.api';

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

    const cancel = onIdle(() => {
      void (async () => {
        try {
          // 1) Enrollments (pure read). Cache under the user-scoped key the gym
          //    + dashboard share.
          const enrollments = await queryClient.fetchQuery({
            queryKey: gymKeys.enrollments(userId),
            queryFn: fetchMyEnrollments,
            staleTime: 5 * 60 * 1000,
          });

          // 2) Today's rep for the active enrollment (pure read+mint now). Skip
          //    if there's no active enrollment (the gym will route to the
          //    goal picker, which doesn't need a warm rep).
          const active = enrollments.find((e) => e.status === 'active');
          if (!active) return;

          await queryClient.prefetchQuery({
            queryKey: gymKeys.todayRep(userId, active.id, 'full'),
            queryFn: () => planTodayRep(active.id, 'full'),
            staleTime: 5 * 60 * 1000,
          });
        } catch {
          // Login prefetch is best-effort — a lapsed sub / missing climb /
          // not-ready goal must never bubble up. The gym handles those live.
        }
      })();
    }, 3000);

    return cancel;
  }, [isReady, isAuthenticated, userId, tier]);

  return null;
}
