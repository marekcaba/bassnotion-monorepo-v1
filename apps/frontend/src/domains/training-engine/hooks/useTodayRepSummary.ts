'use client';

/**
 * useTodayRepSummary — a READ-ONLY summary of the user's daily rep for the Backstage "Today's Rep"
 * card. It describes what today's rep is ABOUT without PLANNING or MINTING it (unlike
 * useGymSession, which auto-plans the rep as a side effect — we don't want merely viewing
 * backstage to advance/mint a rep). The actual rep is planned only when the user clicks through to
 * the gym.
 *
 * Source: the active goal enrollment (fetchMyEnrollments — cached, shared with the calendar). Its
 * frozen goalSnapshot carries the goal title + the content-ladder topics + the speed target — all
 * we need to name the rep. No rep planning, no writes.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GoalEnrollment } from '@bassnotion/contracts';

import { useAuth } from '@/domains/user/hooks/use-auth';
import { fetchMyEnrollments } from '../api/training-engine.api';
import { gymKeys } from '../api/gymQueryKeys';

/** Every coached rep is the gym's ~6-minute session (the "Six minutes." front door). */
const REP_MINUTES = 6;

export interface TodayRepSummary {
  /** True once enrollments have resolved (so the card knows mock vs real / empty). */
  ready: boolean;
  /** Is there an active goal enrollment? false → the "set up your goal" state. */
  hasActiveGoal: boolean;
  /** The goal's title (frozen at enrollment), e.g. "Lock The Pocket". */
  goalTitle: string | null;
  /** A short "what it's about" line — the first content topic, or the speed target. */
  focus: string | null;
  /** Approx minutes for the rep (fixed gym rep length). */
  minutes: number;
}

function pickActive(enrollments: GoalEnrollment[]): GoalEnrollment | null {
  const active = enrollments.filter((e) => e.status === 'active');
  if (active.length === 0) return null;
  return active.sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0]!;
}

export function useTodayRepSummary(): TodayRepSummary {
  const { isAuthenticatedSync, user } = useAuth();

  const query = useQuery<GoalEnrollment[]>({
    queryKey: gymKeys.enrollments(user?.id ?? 'anon'),
    queryFn: fetchMyEnrollments,
    enabled: isAuthenticatedSync,
    staleTime: 60 * 1000,
  });

  return useMemo<TodayRepSummary>(() => {
    const ready = query.isSuccess || query.isError;
    const enrollment = pickActive(query.data ?? []);
    if (!enrollment) {
      return {
        ready,
        hasActiveGoal: false,
        goalTitle: null,
        focus: null,
        minutes: REP_MINUTES,
      };
    }

    const snap = enrollment.goalSnapshot;
    const goalTitle = snap?.title?.trim() || 'Your goal';

    // Focus line: name the first content topic if the goal has topics; else the speed target.
    let focus: string | null = null;
    const firstTopic = snap?.topics?.[0]?.title?.trim();
    if (firstTopic) {
      focus = firstTopic;
    } else {
      const bpm = snap?.target?.tempoBpm;
      focus = typeof bpm === 'number' ? `Aiming for ${bpm} BPM` : null;
    }

    return {
      ready,
      hasActiveGoal: true,
      goalTitle,
      focus,
      minutes: REP_MINUTES,
    };
  }, [query.data, query.isSuccess, query.isError]);
}
