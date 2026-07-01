import { GymPageClient } from './GymPageClient';
import { prefetchGymDoneToday } from '@/lib/server/prefetchGymStatus';

/**
 * SERVER wrapper for /app/gym (P3). Reads today-rep-STATUS (read-only, no mint — R11) server-side
 * and hands the client tree `initialDoneTodayUtc`, so the gym renders the completed-vs-fresh screen
 * on FIRST PAINT — no "Six minutes → session complete" flip. prefetchGymDoneToday never throws /
 * never mints; on any hiccup it returns null and the client resolves doneTodayUtc live as before.
 *
 * The heavy gym UI + audio all live in GymPageClient ('use client'); this stays a thin async
 * server component so it can do the cookie-authed read.
 */
export default async function GymPage() {
  const initialDoneTodayUtc = await prefetchGymDoneToday();
  return <GymPageClient initialDoneTodayUtc={initialDoneTodayUtc} />;
}
