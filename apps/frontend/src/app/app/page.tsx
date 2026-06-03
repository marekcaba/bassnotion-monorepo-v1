'use client';

import {
  // NodeMatrix, // center constellation/wheel — temporarily disabled
  SessionCard,
  ProgressCard,
} from '@/domains/platform/components/NodeMatrix';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';

export default function AppHomePage() {
  return (
    <>
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
    </>
  );
}
