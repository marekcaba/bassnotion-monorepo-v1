'use client';

/**
 * Segment-Based Assessment Page (V2)
 *
 * The new branching assessment with multiple video segments,
 * skill verification, and personalized coach insights.
 */

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
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

  return (
    <>
      <SegmentAssessmentPlayer onComplete={handleComplete} />
    </>
  );
}
