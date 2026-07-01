import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchBackstage } from '@/lib/server/prefetchBackstage';
import { BackstagePageClient } from './BackstagePageClient';

/**
 * SERVER wrapper for /app/backstage (full-SSR) — the app's real home landing (/ → /backstage).
 * Prefetches the three read-only queries its cards read (enrollments, rep-history for the active
 * enrollment, take-history) and hydrates, so SessionCard + CycleCalendar + TakeHistoryPanel paint
 * their real data on first render instead of each flashing its own loading→settle.
 *
 * prefetchBackstage never throws / never mints (all GETs). The warmTodayRep mint stays client-side
 * in BackstagePageClient. Logged out / hiccup → empty cache, cards resolve live as before.
 */
export default async function BackstagePage() {
  const { dehydratedState } = await prefetchBackstage();
  return (
    <HydrationBoundary state={dehydratedState}>
      <BackstagePageClient />
    </HydrationBoundary>
  );
}
