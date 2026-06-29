'use client';

/**
 * useCycleRepCalendar — the data for the billing-cycle rep calendar (Backstage › Your progress).
 *
 * It resolves the user's ACTIVE goal enrollment, derives that enrollment's BILLING CYCLE window
 * (purchase/enroll day → the SAME day next month, the natural Apple-calendar feel — not a fixed
 * 30-day count), and buckets the enrollment's banked reps by LOCAL day so the calendar can light
 * the days a rep was logged.
 *
 * Sources (all existing):
 *   - fetchMyEnrollments() → the active GoalEnrollment (startedAt = the cycle anchor).
 *   - fetchRepHistory(enrollmentId) → RepResult[] (each completedAt → a rep day).
 *
 * Auth-gated on isAuthenticatedSync (session hydrated) so the first fetch carries a token.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GoalEnrollment, RepResult } from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';
import {
  fetchMyEnrollments,
  fetchRepHistory,
} from '../api/training-engine.api';
import { gymKeys } from '../api/gymQueryKeys';

/** Local-day key "YYYY-MM-DD" for a Date (LOCAL time — the calendar is rendered in the user's
 *  timezone, so reps must bucket by local day, not UTC). */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The same calendar day one month later — clamped to the last day of the target month so e.g.
 *  Jan 31 → Feb 28/29 (Date would otherwise roll into March). This is the "same date next month"
 *  the user described for the cycle end. */
function sameDayNextMonth(d: Date): Date {
  const day = d.getDate();
  const target = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const lastOfTarget = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate();
  target.setDate(Math.min(day, lastOfTarget));
  // Preserve the time-of-day so the window is a clean [start, end) by date.
  target.setHours(d.getHours(), d.getMinutes(), d.getSeconds(), 0);
  return target;
}

export interface CycleRepCalendar {
  /** The active enrollment, or null (no active goal → no cycle to show). */
  enrollment: GoalEnrollment | null;
  /** Cycle start (enroll/purchase day) and end (same day next month). Null until resolved. */
  cycleStart: Date | null;
  cycleEnd: Date | null;
  /** Local-day keys ("YYYY-MM-DD") on which ≥1 rep was banked, within the cycle. */
  repDays: Set<string>;
  isLoading: boolean;
  error: string | null;
}

/** Pick the active enrollment from the list (status 'active'; newest startedAt wins if several). */
function pickActive(enrollments: GoalEnrollment[]): GoalEnrollment | null {
  const active = enrollments.filter((e) => e.status === 'active');
  if (active.length === 0) return null;
  return active.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]!;
}

export function useCycleRepCalendar(): CycleRepCalendar {
  const { isAuthenticatedSync, user } = useAuth();

  const enrollmentsQuery = useQuery<GoalEnrollment[]>({
    queryKey: gymKeys.enrollments(user?.id ?? 'anon'),
    queryFn: fetchMyEnrollments,
    enabled: isAuthenticatedSync,
    staleTime: 60 * 1000,
  });

  const enrollment = useMemo(
    () => pickActive(enrollmentsQuery.data ?? []),
    [enrollmentsQuery.data],
  );

  const repQuery = useQuery<RepResult[]>({
    queryKey: gymKeys.repHistory(user?.id ?? 'anon', enrollment?.id ?? 'none'),
    queryFn: () => fetchRepHistory(enrollment!.id),
    enabled: isAuthenticatedSync && !!enrollment,
    staleTime: 60 * 1000,
  });

  const { cycleStart, cycleEnd } = useMemo(() => {
    if (!enrollment) return { cycleStart: null, cycleEnd: null };
    const start = new Date(enrollment.startedAt);
    return { cycleStart: start, cycleEnd: sameDayNextMonth(start) };
  }, [enrollment]);

  const repDays = useMemo(() => {
    const set = new Set<string>();
    if (!cycleStart || !cycleEnd) return set;
    for (const r of repQuery.data ?? []) {
      const d = new Date(r.completedAt);
      // Only count reps inside the current cycle window [start, end).
      if (d >= cycleStart && d < cycleEnd) set.add(localDayKey(d));
    }
    return set;
  }, [repQuery.data, cycleStart, cycleEnd]);

  return {
    enrollment,
    cycleStart,
    cycleEnd,
    repDays,
    isLoading:
      (enrollmentsQuery.isLoading &&
        enrollmentsQuery.fetchStatus !== 'idle') ||
      (repQuery.isLoading && repQuery.fetchStatus !== 'idle'),
    error:
      enrollmentsQuery.error || repQuery.error
        ? 'Could not load your progress.'
        : null,
  };
}
