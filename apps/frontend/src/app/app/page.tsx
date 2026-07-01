import { HydrationBoundary } from '@tanstack/react-query';
import {
  // NodeMatrix, // center constellation/wheel — temporarily disabled
  SessionCard,
  ProgressCard,
} from '@/domains/platform/components/NodeMatrix';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { prefetchQueries } from '@/lib/server/prefetchQueries';

/**
 * App home (full-SSR). SessionCard reads the active enrollment (useTodayRepSummary →
 * gymKeys.enrollments) and ProgressCard reads the practice streak (useStreak → ['practice-streak',
 * userId]) — both read-only GETs. Prefetch both server-side and hydrate, so the cards paint their
 * real values on first render instead of flashing "…" → goal-title / a settling streak counter.
 *
 * A server component: SessionCard/ProgressCard are client components that read from the (now
 * server-seeded) TanStack cache via HydrationBoundary. prefetchQueries never throws — logged out or
 * a hiccup yields an empty cache and the cards resolve live, exactly as before.
 */
export default async function AppHomePage() {
  const { dehydratedState } = await prefetchQueries([
    {
      key: (userId) => ['gym', 'my-enrollments', userId],
      path: '/api/v1/training-engine/enrollments',
    },
    {
      key: (userId) => ['practice-streak', userId],
      path: '/api/v1/users/me/practice-streak',
    },
  ]);

  return (
    <HydrationBoundary state={dehydratedState}>
      <PageErrorBoundary pageName="App Home">
        <div className="flex h-full flex-col lg:overflow-hidden">
          {/* Center constellation/wheel — temporarily commented out. */}
          {/* <NodeMatrix /> */}

          {/* Mobile: show cards inline since DetailPanel is hidden below lg */}
          <div className="mx-auto grid w-full max-w-[640px] shrink-0 grid-cols-2 gap-4 px-4 pb-6 lg:hidden">
            <SessionCard />
            <ProgressCard />
          </div>
        </div>
      </PageErrorBoundary>
    </HydrationBoundary>
  );
}
