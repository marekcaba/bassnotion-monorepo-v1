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
import type {
  GoalEnrollment,
  TutorialBlock,
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
} from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';
import {
  fetchMyEnrollments,
  enrollInGoal,
  planTodayRep,
  fetchGraduation,
  fetchMonthInReview,
  graduate,
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
  /** Day-30 fork status when due (and not yet graduated); null otherwise. The
   *  gym SURFACES this without blocking the rep (spec §7). */
  graduation: GraduationSummary | null;
  /** The day-30 month-in-review recap (Treadmill epic Story 6), fetched only
   *  when graduation is due; null otherwise. The journey screen shown alongside
   *  the fork. */
  monthInReview: MonthInReview | null;
  /** Attendance over the window (Treadmill epic Story 7): "showed up X of N
   *  days". Kept regardless of graduation status so the gym shows it every day
   *  (graduation is null until day 30; this isn't). null if the summary lacked
   *  the count. */
  attendance: { daysPracticed: number; windowDays: number } | null;
  /** The current rep shape (Story 5). 'floor' = the short 3-min session. */
  repMode: 'full' | 'floor';
  /** status 'placement' → enroll with a chosen starting tempo, then plan. */
  placeAndStart: (startTempoBpm: number) => void;
  /** Re-plan today's rep as the short 'floor' session (one 3-min brick). */
  chooseFloor: () => void;
  /** Walk through a graduation door, then re-load (re-plan / re-place). */
  chooseDoor: (door: GraduationDoor) => void;
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
  const [graduation, setGraduation] = useState<GraduationSummary | null>(null);
  const [monthInReview, setMonthInReview] = useState<MonthInReview | null>(
    null,
  );
  const [attendance, setAttendance] = useState<{
    daysPracticed: number;
    windowDays: number;
  } | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [repMode, setRepMode] = useState<'full' | 'floor'>('full');
  // Guards against overlapping runs (StrictMode double-mount, refresh races).
  const runningRef = useRef(false);

  /** Plan + mint today's rep for an enrollment and go 'ready'. Also checks the
   *  day-30 fork (surfaced alongside the rep, never blocking it). */
  const planFor = useCallback(
    async (active: GoalEnrollment, mode: 'full' | 'floor' = 'full') => {
    setRepMode(mode);
    const { slug: repSlug, bricks: repBricks } = await planTodayRep(
      active.id,
      mode,
    );
    setEnrollment(active);
    setSlug(repSlug);
    setBricks(repBricks);
    // Best-effort: a graduation-check failure must not block the rep.
    try {
      const grad = await fetchGraduation(active.id);
      const due = grad.isDue && !grad.graduated;
      setGraduation(due ? grad : null);
      // Attendance rides the same summary but is shown EVERY day (Story 7), not
      // only at graduation — so keep it regardless of isDue.
      setAttendance(
        typeof grad.daysPracticedInWindow === 'number' &&
          typeof grad.windowDays === 'number'
          ? {
              daysPracticed: grad.daysPracticedInWindow,
              windowDays: grad.windowDays,
            }
          : null,
      );
      // The month-in-review recap (Story 6) only matters at graduation — fetch
      // it lazily when due. Best-effort: a recap failure must not block the rep.
      if (due) {
        try {
          setMonthInReview(await fetchMonthInReview(active.id));
        } catch {
          setMonthInReview(null);
        }
      } else {
        setMonthInReview(null);
      }
    } catch {
      setGraduation(null);
      setAttendance(null);
      setMonthInReview(null);
    }
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

  /** Re-plan the active enrollment's rep as the short 'floor' session (Story 5).
   *  Available once an enrollment is ready; a no-op if there's none yet. */
  const chooseFloor = useCallback(async () => {
    const active = enrollment;
    if (!active || runningRef.current) return;
    runningRef.current = true;
    setStatus('loading');
    setError(null);
    try {
      await planFor(active, 'floor');
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      setStatus('error');
    } finally {
      runningRef.current = false;
    }
  }, [enrollment, planFor]);

  const chooseDoor = useCallback(
    async (door: GraduationDoor) => {
      const active = enrollment;
      if (!active || runningRef.current) return;
      runningRef.current = true;
      setStatus('loading');
      setError(null);
      try {
        await graduate(active.id, door);
        // Clear the banner up front — the door was walked through regardless of
        // whether the re-load below succeeds (so a failed re-plan can't leave a
        // stuck graduation banner).
        setGraduation(null);
        setMonthInReview(null);
        // Release before run() re-acquires its own lock. Re-load: go_deeper
        // continues the same enrollment (re-plans with the raised target);
        // lock_it_in/switch_lanes graduated it, so run() finds no active
        // enrollment → drops to placement for a fresh start.
        runningRef.current = false;
        await run();
      } catch (e) {
        setError(e instanceof Error ? e : new Error(String(e)));
        setStatus('error');
      } finally {
        // Always release (run() manages its own lock; this covers the
        // graduate()-threw path before the release above).
        runningRef.current = false;
      }
    },
    [enrollment, run],
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
    graduation,
    monthInReview,
    attendance,
    repMode,
    placeAndStart,
    chooseFloor,
    chooseDoor,
    refresh: run,
  };
}
