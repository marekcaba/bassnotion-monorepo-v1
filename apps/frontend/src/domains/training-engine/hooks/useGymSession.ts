'use client';

/**
 * useGymSession — drives the /app/gym daily-rep flow end to end:
 *   1. list the user's enrollments
 *   2. if none, auto-enroll in the default goal (the seeded SPEED scales)
 *   3. plan + mint today's rep for the active enrollment
 *   4. expose the virtual-tutorial slug the gym renders DrillSessionFrame against
 *
 * Phase 3 keeps step 2 simple (one default goal). Goal SELECTION (choosing
 * among multiple goals, the prerequisite graph) is a later phase; here we just
 * get the player into a rep.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { GoalEnrollment, TutorialBlock } from '@bassnotion/contracts';

import {
  fetchMyEnrollments,
  enrollInGoal,
  planTodayRep,
} from '../api/training-engine.api';

/** The seeded MVP goal the gym auto-enrolls into when the user has none. */
export const DEFAULT_GOAL_SLUG = 'speed-c-major-scale';

type GymStatus = 'loading' | 'ready' | 'error';

export interface GymSession {
  status: GymStatus;
  /** The virtual-tutorial slug to render the rep through (when ready). */
  slug: string | null;
  /** The generated rep bricks (for ladder/tempo lookup when recording reps). */
  bricks: TutorialBlock[];
  enrollment: GoalEnrollment | null;
  error: Error | null;
  /** Re-plan today's rep (e.g. after finishing a session). */
  refresh: () => void;
}

export function useGymSession(
  goalSlug: string = DEFAULT_GOAL_SLUG,
): GymSession {
  const [status, setStatus] = useState<GymStatus>('loading');
  const [slug, setSlug] = useState<string | null>(null);
  const [bricks, setBricks] = useState<TutorialBlock[]>([]);
  const [enrollment, setEnrollment] = useState<GoalEnrollment | null>(null);
  const [error, setError] = useState<Error | null>(null);
  // Guards against overlapping runs (StrictMode double-mount, refresh races).
  const runningRef = useRef(false);

  const run = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      const enrollments = await fetchMyEnrollments();
      const active =
        enrollments.find((e) => e.goalId && e.status === 'active') ??
        enrollments[0] ??
        (await enrollInGoal(goalSlug));

      const { slug: repSlug, bricks: repBricks } = await planTodayRep(
        active.id,
      );
      setEnrollment(active);
      setSlug(repSlug);
      setBricks(repBricks);
      setStatus('ready');
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [goalSlug]);

  useEffect(() => {
    void run();
  }, [run]);

  return { status, slug, bricks, enrollment, error, refresh: run };
}
