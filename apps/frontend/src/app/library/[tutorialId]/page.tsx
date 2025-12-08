'use client';

import React from 'react';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { ScrollTriggerLoader } from '@/domains/playback/components/ScrollTriggerLoader';
import { ResumeOverlay } from '@/domains/playback/components/ResumeOverlay';
import { getLogger } from '@/utils/logger';

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

  // SAFARI/WEBKIT DIAGNOSTIC LOGGING
  console.log('[SAFARI DEBUG] TutorialPage component rendering, count:', tutorialPageRenderCount);
  console.log('[SAFARI DEBUG] User Agent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR');

  if (tutorialPageRenderCount % 10 === 0) {
    logger.info(`🔄 TutorialPage (ROOT) RENDER #${tutorialPageRenderCount}`);
  }

  // Add error logging
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error('🚨 Global error in tutorial page:', event.error);
      console.error('[SAFARI DEBUG] Global error:', event.error);
    };
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // SAFARI/WEBKIT: Log before React.use()
  console.log('[SAFARI DEBUG] About to call React.use(params)...');

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;

  // SAFARI/WEBKIT: Log after params resolved
  console.log('[SAFARI DEBUG] Params resolved, slug:', tutorialSlug);
  console.log('[SAFARI DEBUG] About to call useTutorialExercises hook...');

  // Load real tutorial data from API
  const { tutorial, exercises, isLoading, error } =
    useTutorialExercises(tutorialSlug);

  // SAFARI/WEBKIT: Log hook results
  console.log('[SAFARI DEBUG] Hook returned:', {
    isLoading,
    hasTutorial: !!tutorial,
    hasExercises: !!exercises,
    exerciseCount: exercises?.length,
    hasError: !!error,
    errorMessage: error?.message,
  });

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
  if (isLoading) {
    console.log('[SAFARI DEBUG] Rendering loading state...');
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading tutorial...</p>
        </div>
      </div>
    );
  }

  // Handle error state - AFTER all hooks
  if (error || !tutorial) {
    console.log('[SAFARI DEBUG] Rendering error state, error:', error, 'tutorial:', tutorial);
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
  console.log('[SAFARI DEBUG] Rendering YouTubeWidgetPage...');
  return (
    <>
      {/* iOS Background Audio: Show resume overlay when returning from background */}
      <ResumeOverlay />
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
        />
      </ErrorBoundary>
    </>
  );
}
