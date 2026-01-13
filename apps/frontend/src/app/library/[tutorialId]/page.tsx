'use client';

import React from 'react';
import { useSearchParams } from 'next/navigation';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage';
import { TutorialPageSkeleton } from '@/domains/widgets/components/YouTubeWidgetPage/TutorialPageSkeleton';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { ScrollTriggerLoader } from '@/domains/playback/components/ScrollTriggerLoader';
import { getLogger } from '@/utils/logger';
import { logSkeletonDebug, getSkeletonDebugTime, resetSkeletonDebugBaseline } from '@/utils/skeletonDebug';

const logger = getLogger('TutorialPage');

// Error boundary component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('🚨 TutorialPage Error:', error, { errorInfo });
  }

  render() {
    if (this.state.hasError && this.state.error) {
      // TEMPORARY: Don't show error screen for timeSignature rendering errors
      // Just log and continue rendering to test if audio works
      logger.error(
        '🚨 Error boundary caught error but continuing to render:',
        this.state.error,
      );

      // Still render children - the error might be in a non-critical component
      // Uncomment below to show error screen again:
      // return (
      //   <div className="min-h-screen bg-red-900 text-white p-8">
      //     <h1 className="text-2xl mb-4">Error Loading Tutorial</h1>
      //     <pre className="bg-black p-4 rounded overflow-auto">
      //       {this.state.error.toString()}
      //       {'\n\n'}
      //       {this.state.error.stack}
      //     </pre>
      //   </div>
      // );
    }

    return this.props.children;
  }
}

interface TutorialPageProps {
  params: Promise<{
    tutorialId: string;
  }>;
}

// Add render counter
let tutorialPageRenderCount = 0;

export default function TutorialPage({ params }: TutorialPageProps) {
  tutorialPageRenderCount++;

  // Reset baseline on first render of a new page load
  if (tutorialPageRenderCount === 1) {
    resetSkeletonDebugBaseline();
  }

  // SKELETON-DEBUG: Log first 5 renders with timing
  logSkeletonDebug('📃', 'TutorialPage', tutorialPageRenderCount);

  if (tutorialPageRenderCount % 10 === 0) {
    logger.info(`🔄 TutorialPage (ROOT) RENDER #${tutorialPageRenderCount}`);
  }

  // Add error logging
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error('🚨 Global error in tutorial page:', event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;

  // Get initial exercise ID from URL query params (e.g., from favorites navigation)
  const searchParams = useSearchParams();
  const initialExerciseId = searchParams.get('exerciseId') || undefined;

  // Load real tutorial data from API
  const { tutorial, exercises, isLoading, error } =
    useTutorialExercises(tutorialSlug);

  // Memoize the tutorial and exercises to prevent unnecessary re-renders
  // MUST be called unconditionally BEFORE any early returns
  const memoizedTutorial = React.useMemo(
    () => tutorial,
    [tutorial, tutorial?.id],
  );
  const memoizedExercises = React.useMemo(
    () => exercises,
    [exercises, exercises?.length, exercises?.[0]?.id],
  );

  // Handle loading state - AFTER all hooks
  // Using FAANG-style skeleton loading for better perceived performance
  if (isLoading) {
    if (tutorialPageRenderCount <= 5) {
      console.log(`⏳ [SKELETON-DEBUG] Showing skeleton at +${getSkeletonDebugTime()}ms`);
    }
    return <TutorialPageSkeleton />;
  }

  // SKELETON-DEBUG: Log when we switch from skeleton to content
  if (tutorialPageRenderCount <= 5) {
    console.log(`✅ [SKELETON-DEBUG] Loading complete! Rendering content at +${getSkeletonDebugTime()}ms`, {
      hasExercises: !!exercises,
      exerciseCount: exercises?.length ?? 0,
      tutorialTitle: tutorial?.title,
    });
  }

  // Handle error state - AFTER all hooks
  if (error || !tutorial) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Tutorial Not Found</h1>
          <p className="text-slate-400 mb-4">
            The tutorial "{tutorialSlug}" could not be loaded.
          </p>
        </div>
      </div>
    );
  }

  // Render WITHOUT AudioEnabledTutorial wrapper
  // CRITICAL: Wrap in Fragment to prevent rendering boundary issues that cause click blocking
  return (
    <>
      <ErrorBoundary>
        {/* Phase 2: Progressive sample loading on first user interaction */}
        {/* Pass exercises to enable tutorial-level sample loading */}
        <ScrollTriggerLoader
          exercises={memoizedExercises}
          tutorialId={tutorial?.id}
        />
        <YouTubeWidgetPage
          tutorialData={memoizedTutorial}
          tutorialSlug={tutorialSlug}
          exercises={memoizedExercises}
          initialExerciseId={initialExerciseId}
        />
      </ErrorBoundary>
    </>
  );
}
