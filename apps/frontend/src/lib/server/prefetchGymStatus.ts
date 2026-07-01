import 'server-only';

import type { GoalEnrollment } from '@bassnotion/contracts';
import { getServerAuth } from './serverAuth';
import { serverFetchJson } from './serverFetch';

/**
 * Server prefetch of the gym's "is today's rep done?" verdict (P3) — GYM ROUTE ONLY.
 *
 * Chains two READ-ONLY GETs server-side: enrollments → find the active one → today-rep-STATUS
 * (the read-only endpoint, NOT the minting today-rep POST — R11). Returns the boolean the gym uses
 * to pick the completed-vs-fresh screen, so it renders correctly on first paint (no
 * "Six minutes → session complete" flip).
 *
 * NEVER throws / never mints. Returns null when we can't determine it (logged out, no active goal,
 * or any hiccup) — the gym then resolves doneTodayUtc live exactly as before. So the worst case is
 * "no seed → today's small flip", never a wrong screen or a side effect.
 */
export async function prefetchGymDoneToday(): Promise<boolean | null> {
  const { user, token } = await getServerAuth();
  if (!user || !token) return null;

  const enrollments = await serverFetchJson<GoalEnrollment[]>(
    '/api/v1/training-engine/enrollments',
    token,
  );
  const active = enrollments?.find((e) => e.status === 'active');
  if (!active) return null; // no active goal → the gym shows the picker; nothing to seed.

  const status = await serverFetchJson<{ doneTodayUtc: boolean }>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(active.id)}/today-rep-status`,
    token,
  );
  return status ? status.doneTodayUtc : null;
}
