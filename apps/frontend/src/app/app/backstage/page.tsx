'use client';

import { useEffect } from 'react';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Martini } from 'lucide-react';
import { TakeHistoryPanel } from '@/domains/training-engine/components/TakeHistoryPanel';
import { CycleCalendar } from '@/domains/training-engine/components/CycleCalendar';
import { SessionCard } from '@/domains/platform/components/NodeMatrix';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { warmTodayRep } from '@/domains/training-engine/lib/warmTodayRep';

function BackstageContent() {
  // Warm the gym rep chain (enrollments → today-rep → tutorial) into the shared cache the moment
  // backstage loads — so when the player clicks "Start today's rep", the gym reads it INSTANTLY
  // (no load behind the "Are you ready?" step). Member-gated; planTodayRep is a pure read+mint, so
  // this never advances/completes the rep. Mirrors AppGymWarmup but fires NOW (not 3s-idle-delayed),
  // since the player is one click from the gym here.
  const { user, isAuthenticatedSync } = useAuth();
  const { tier } = useEntitlement();
  useEffect(() => {
    if (isAuthenticatedSync && user?.id && tier === 'member') {
      void warmTodayRep(user.id);
    }
  }, [isAuthenticatedSync, user?.id, tier]);

  // Top-anchored, horizontally centered. NOT vertically centered: the recordings panel below
  // changes height (loading → empty → list), and justify-center would shift the headline up/down
  // as it does. Anchoring to the top keeps the headline fixed in place while content fills in.
  return (
    <div className="flex min-h-[calc(100svh-4rem)] w-full flex-col items-center p-6 pt-[12vh] md:p-10 md:pt-[12vh]">
      <div className="flex w-full max-w-4xl flex-col items-center space-y-10">
        <div className="w-full text-left">
          <div className="flex items-center gap-3.5">
            <Martini className="size-10 shrink-0 text-[#ffc700]" />
            <h1 className="font-heading text-[clamp(34px,5vw,52px)] uppercase leading-none tracking-[0.01em] text-zinc-100">
              Backstage
            </h1>
          </div>
          <p className="mt-4 text-zinc-400">
            Your session, progress, and recordings.
          </p>
        </div>

        {/* Today's Session + the billing-cycle rep calendar (Your progress). The calendar replaces
            the old Streak/Today/Takes stat panel — a real Apple-style month grid lighting the days
            you banked a rep this cycle. Fixed row height so both cards are equal + compact (the
            calendar fills its card and snap-scrolls one month at a time within it). */}
        <div className="grid w-full grid-cols-1 gap-4 lg:h-[350px] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <SessionCard />
          <CycleCalendar />
        </div>

        {/* Your recordings — submitted takes, replayable IN CONTEXT (the take + the backing it
            was recorded over). Auth-gated; empty until the first gig submit. */}
        <div className="w-full">
          <TakeHistoryPanel />
        </div>
      </div>
    </div>
  );
}

export default function BackstagePage() {
  return (
    <>
      <PageErrorBoundary pageName="Backstage">
        <BackstageContent />
      </PageErrorBoundary>
    </>
  );
}
