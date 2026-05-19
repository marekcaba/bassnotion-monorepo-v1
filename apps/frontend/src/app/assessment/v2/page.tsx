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
import { SegmentAssessmentPlayer } from '@/domains/assessment/components';

export default function AssessmentV2Page() {
  const router = useRouter();

  const handleComplete = useCallback(
    (bucket: string, journeyId?: string) => {
      // Redirect to dashboard after completion
      // The journey ID could be used to start a specific learning path
      if (journeyId) {
        router.push(`/dashboard?journey=${journeyId}`);
      } else {
        router.push('/dashboard');
      }
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
