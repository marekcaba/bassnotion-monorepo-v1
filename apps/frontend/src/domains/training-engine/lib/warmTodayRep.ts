/**
 * warmTodayRep — prefetch the member's gym rep chain into the shared TanStack Query cache, so the
 * gym opens from a warm cache (no fetch chain on open). Used by BOTH the login-time AppGymWarmup
 * and the Backstage page (so clicking "Start today's rep" lands the rep instantly).
 *
 * The chain (each cached under the key the gym reads through):
 *   1. enrollments        → gymKeys.enrollments(userId)
 *   2. today's rep        → gymKeys.todayRep(userId, enrollmentId, 'full')   [planTodayRep]
 *   3. the rep's tutorial → ['tutorial-exercises', slug]                     [fetchTutorialExercises]
 *
 * planTodayRep is a PURE read+mint — it PLANS the rep, it does NOT advance/complete it (the climb
 * advances on rep COMPLETION). So warming it has no side effect on the player's progress.
 *
 * Best-effort + tolerant: a lapsed sub / missing climb / not-ready goal must NEVER throw (the gym
 * handles those live), so every step swallows failures. Returns when done (or on first failure).
 */

import { queryClient } from '@/lib/react-query';
import { gymKeys } from '../api/gymQueryKeys';
import { fetchMyEnrollments, planTodayRep } from '../api/training-engine.api';
import { fetchTutorialExercises } from '@/domains/widgets/api/tutorials';

const FIVE_MIN = 5 * 60 * 1000;

export async function warmTodayRep(userId: string): Promise<void> {
  try {
    const enrollments = await queryClient.fetchQuery({
      queryKey: gymKeys.enrollments(userId),
      queryFn: fetchMyEnrollments,
      staleTime: FIVE_MIN,
    });

    const active = enrollments.find((e) => e.status === 'active');
    if (!active) return; // no active goal → the gym routes to the picker (no rep to warm)

    const rep = await queryClient.fetchQuery({
      queryKey: gymKeys.todayRep(userId, active.id, 'full'),
      queryFn: () => planTodayRep(active.id, 'full'),
      staleTime: FIVE_MIN,
    });

    if (rep?.slug) {
      await queryClient.prefetchQuery({
        queryKey: ['tutorial-exercises', rep.slug],
        queryFn: () => fetchTutorialExercises(rep.slug),
        staleTime: FIVE_MIN,
      });
    }
  } catch {
    // Best-effort prefetch — never bubble up; the gym handles live.
  }
}
