'use client';

/**
 * useGymSession — drives the /app/gym daily-rep flow end to end:
 *   1. list the user's enrollments
 *   2a. if NONE → status 'placement': the gym shows a one-time "what tempo can
 *       you play this cleanly?" step (spec §5); placeAndStart(tempo) enrolls
 *       with that placement, seeding where the climb begins.
 *   2b. if an enrollment exists → straight to planning (placement is one-time).
 *   3. plan + mint today's rep for the active enrollment
 *   4. expose the virtual-tutorial slug the gym renders DrillSessionFrame against
 *
 * Goal SELECTION (choosing among multiple goals, the prerequisite graph) is a
 * later phase; here the default goal is the one new players are placed into.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GoalEnrollment, TutorialBlock } from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';
import {
  fetchMyEnrollments,
  enrollInGoal,
  planTodayRep,
} from '../api/training-engine.api';

/** The seeded MVP goal a new player is placed into. */
export const DEFAULT_GOAL_SLUG = 'speed-c-major-scale';

type GymStatus = 'loading' | 'placement' | 'ready' | 'error';

export interface GymSession {
  status: GymStatus;
  /** The virtual-tutorial slug to render the rep through (when ready). */
  slug: string | null;
  /** The generated rep bricks (for ladder/tempo lookup when recording reps). */
  bricks: TutorialBlock[];
  enrollment: GoalEnrollment | null;
  error: Error | null;
  /** status 'placement' → enroll with a chosen starting tempo, then plan. */
  placeAndStart: (startTempoBpm: number) => void;
  /** Re-plan today's rep (e.g. after finishing a session). */
  refresh: () => void;
}

export function useGymSession(
  goalSlug: string = DEFAULT_GOAL_SLUG,
): GymSession {
  const { isAuthenticated, user } = useAuth();
  const [status, setStatus] = useState<GymStatus>('loading');
  const [slug, setSlug] = useState<string | null>(null);
  const [bricks, setBricks] = useState<TutorialBlock[]>([]);
  const [enrollment, setEnrollment] = useState<GoalEnrollment | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Guards against overlapping runs (StrictMode double-mount, refresh races).
  const runningRef = useRef(false);

  /** Plan + mint today's rep for an enrollment and go 'ready'. */
  const planFor = useCallback(async (active: GoalEnrollment) => {
    const { slug: repSlug, bricks: repBricks } = await planTodayRep(active.id);
    setEnrollment(active);
    setSlug(repSlug);
    setBricks(repBricks);
    setStatus('ready');
  }, []);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      const enrollments = await fetchMyEnrollments();
      const active =
        enrollments.find((e) => e.status === 'active') ?? enrollments[0];
      if (active) {
        await planFor(active); // already enrolled → no placement re-prompt
      } else {
        // First time in this goal → ask for placement before enrolling.
        setStatus('placement');
      }
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [planFor]);

  const placeAndStart = useCallback(
    async (startTempoBpm: number) => {
      if (runningRef.current) return;
      runningRef.current = true;
      setStatus('loading');
      setError(null);
      try {
        const active = await enrollInGoal(goalSlug, startTempoBpm);
        await planFor(active);
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus('error');
      } finally {
        runningRef.current = false;
      }
    },
    [goalSlug, planFor],
  );

  // Wait for auth to resolve before touching the AuthGuard-protected endpoints
  // (firing on raw mount races AuthProvider setting the token → a 401).
  useEffect(() => {
    if (!isAuthenticated || !user) return;
    void run();
  }, [isAuthenticated, user, run]);

  return {
    status,
    slug,
    bricks,
    enrollment,
    error,
    placeAndStart,
    refresh: run,
  };
}
