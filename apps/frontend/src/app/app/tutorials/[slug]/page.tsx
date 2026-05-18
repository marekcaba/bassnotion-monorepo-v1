'use client';

import React from 'react';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage';
import { TutorialPageSkeleton } from '@/domains/widgets/components/YouTubeWidgetPage/TutorialPageSkeleton';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
// NOTE: ScrollTriggerLoader removed - act-aware preloading now handled by useActAwarePreload in YouTubeWidgetPage

interface PlatformTutorialPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default function PlatformTutorialPage({
  params,
}: PlatformTutorialPageProps) {
  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.slug;

  const { tutorial, exercises, isLoading, error } =
    useTutorialExercises(tutorialSlug);

  const memoizedTutorial = React.useMemo(
    () => tutorial,
    [tutorial, tutorial?.id],
  );
  const memoizedExercises = React.useMemo(
    () => exercises,
    [exercises, exercises?.length, exercises?.[0]?.id],
  );

  if (isLoading) {
    return <TutorialPageSkeleton />;
  }

  if (error || !tutorial) {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            Tutorial Not Found
          </h2>
          <p className="text-zinc-400">
            Could not load &quot;{tutorialSlug}&quot;
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageErrorBoundary pageName="Platform Tutorial">
        <YouTubeWidgetPage
          tutorialData={memoizedTutorial}
          tutorialSlug={tutorialSlug}
          exercises={memoizedExercises}
          hideChrome
        />
      </PageErrorBoundary>
    </>
  );
}
