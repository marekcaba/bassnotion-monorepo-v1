'use client';

/**
 * Segment-Based Assessment Page (V2)
 *
 * The new branching assessment with multiple video segments,
 * skill verification, and personalized coach insights.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { navigateToApp } from '@/lib/marketing-url';
import { SegmentAssessmentPlayer } from '@/domains/assessment/components';

export default function AssessmentV2Page() {
  const router = useRouter();

  const handleComplete = useCallback(
    (bucket: string, journeyId?: string) => {
      // After completion land on Backstage (the app home; the legacy /dashboard was removed). This
      // page lives on the APEX, so navigateToApp full-page-navigates to the app host cross-origin.
      // The journey ID rides along so the app can start a specific learning path.
      const dest = journeyId ? `/backstage?journey=${journeyId}` : '/backstage';
      navigateToApp(dest, (url) => router.push(url));
    },
    [router],
  );

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  return (
    <>
      <Button
        onClick={handleBack}
        variant="ghost"
        size="sm"
        aria-label="Go back"
        title="Back"
        className="fixed top-4 left-4 z-50 text-white/70 hover:text-white hover:bg-white/10 p-2"
      >
        <ArrowLeft className="w-5 h-5" />
      </Button>
      <SegmentAssessmentPlayer onComplete={handleComplete} />
    </>
  );
}
