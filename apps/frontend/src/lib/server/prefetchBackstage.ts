import 'server-only';

import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import type { GoalEnrollment, RepResult } from '@bassnotion/contracts';
import { getServerAuth } from './serverAuth';
import { serverFetchJson } from './serverFetch';
import { makeServerQueryClient } from './serverQueryClient';

/**
 * Server prefetch for /app/backstage (full-SSR). Seeds the three read-only queries its cards read:
 *   - enrollments      → gymKeys.enrollments(userId)            [SessionCard + CycleCalendar share it]
 *   - rep-history      → gymKeys.repHistory(userId, activeId)   [CycleCalendar — CHAINED off the active enrollment]
 *   - take-history     → gymKeys.takeHistory(userId)            [TakeHistoryPanel; unwrap { takes }]
 * so all three cards paint on first render (no loading→settle flash).
 *
 * rep-history is a dependent chain (needs the active enrollment id first), so this can't use the
 * flat prefetchQueries. enrollments must resolve first; then rep-history + take-history fetch in
 * parallel. All READ-ONLY GETs — no mint (R11). NEVER throws: a hiccup leaves that query unseeded
 * and the client fetches it live.
 */
export async function prefetchBackstage(): Promise<{
  serverAuthed: boolean;
  dehydratedState: DehydratedState;
}> {
  const { user, token } = await getServerAuth();
  const queryClient = makeServerQueryClient();
  if (!user || !token) {
    return { serverAuthed: false, dehydratedState: dehydrate(queryClient) };
  }

  const enrollments = await serverFetchJson<GoalEnrollment[]>(
    '/api/v1/training-engine/enrollments',
    token,
  );
  if (enrollments) {
    queryClient.setQueryData(['gym', 'my-enrollments', user.id], enrollments);
  }
  const active = enrollments?.find((e) => e.status === 'active');

  await Promise.all([
    // rep-history — only when there's an active enrollment (the calendar keys on it).
    active
      ? serverFetchJson<RepResult[]>(
          `/api/v1/training-engine/enrollments/${encodeURIComponent(active.id)}/rep-results`,
          token,
        ).then((repHistory) => {
          if (repHistory) {
            queryClient.setQueryData(
              ['gym', 'rep-history', user.id, active.id],
              repHistory,
            );
          }
        })
      : Promise.resolve(),
    // take-history — unwrap the { takes } envelope to match fetchMyTakeHistory's cached shape.
    serverFetchJson<{ takes: unknown[] }>(
      '/api/v1/training-engine/recordings/takes',
      token,
    ).then((res) => {
      if (res && Array.isArray(res.takes)) {
        queryClient.setQueryData(['gym', 'take-history', user.id], res.takes);
      }
    }),
  ]);

  return { serverAuthed: true, dehydratedState: dehydrate(queryClient) };
}
