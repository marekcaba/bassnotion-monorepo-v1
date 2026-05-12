'use client';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { PracticeChartDashboard } from '@/domains/platform/components/PracticeChartDashboard';

function BassmentContent() {
  return (
    <div className="h-full overflow-auto">
      <PracticeChartDashboard />
    </div>
  );
}

export default function BassmentPage() {
  return (
    <>
      <PageErrorBoundary pageName="Bassment">
        <BassmentContent />
      </PageErrorBoundary>
    </>
  );
}
