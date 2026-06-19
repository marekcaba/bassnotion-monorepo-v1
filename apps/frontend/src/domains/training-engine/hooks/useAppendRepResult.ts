'use client';

/**
 * useAppendRepResult — the RepResultSink as a React Query mutation.
 *
 * Wired as a SIBLING write next to the drill executor's `useCompleteBlock`
 * (spec §12): the executor keeps writing `block_completions` for the UI's
 * unlock/summary state; the engine ADDITIONALLY appends a RepResult as its own
 * append-only source of truth. Two writes, two purposes — neither blocks the
 * other.
 *
 * Best-effort: a failed rep-result append must NOT break the drill UI (the
 * block completion already succeeded on its own path). Callers fire-and-forget
 * via `.mutate`; the engine's history tolerates a missing rep (generateRep
 * reads whatever is there). The mutation surfaces errors for logging only.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { RepResult, RepResultInput } from '@bassnotion/contracts';

import { appendRepResult } from '../api/training-engine.api';

/** Query key for an enrollment's rep history (kept here to avoid a cycle). */
export const repHistoryKey = (enrollmentId: string) =>
  ['training-engine', 'rep-history', enrollmentId] as const;

export function useAppendRepResult() {
  const queryClient = useQueryClient();

  return useMutation<RepResult, Error, RepResultInput>({
    mutationFn: (input: RepResultInput) => appendRepResult(input),
    onSuccess: (_result, input) => {
      // The engine's history changed — let any subscriber refetch it.
      queryClient.invalidateQueries({
        queryKey: repHistoryKey(input.goalEnrollmentId),
      });
      // Completing a rep advances the climb (server-side), so the cached
      // today-rep + enrollments are now stale — the NEXT gym open should re-plan
      // from the advanced position, not serve the warm pre-rep cache. Invalidate
      // the whole ['gym', …] prefix (covers gymKeys.todayRep / .enrollments and
      // the dashboard's keys). Cheap: they just refetch on next read.
      queryClient.invalidateQueries({ queryKey: ['gym'] });
    },
    // No onError rollback: there is nothing to roll back (this is an additive
    // append, not an optimistic patch). Errors propagate to the caller's
    // logger; the drill UI is unaffected.
  });
}
