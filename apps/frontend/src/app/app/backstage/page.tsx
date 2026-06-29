'use client';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { Martini } from 'lucide-react';
import { TakeHistoryPanel } from '@/domains/training-engine/components/TakeHistoryPanel';
import {
  SessionCard,
  ProgressCard,
} from '@/domains/platform/components/NodeMatrix';

function BackstageContent() {
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

        {/* Today's Session + Your Progress — the panel that used to live on the bare app root. */}
        <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
          <SessionCard />
          <ProgressCard />
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
