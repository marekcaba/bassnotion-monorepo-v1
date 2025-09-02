'use client';

import React from 'react';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// Error boundary to catch errors
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
    logger.error('🚨 Error caught by boundary:', error);
    logger.error('Error info:', errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-red-900 text-white p-8">
          <h1 className="text-2xl mb-4">Error Caught!</h1>
          <pre className="bg-black p-4 rounded overflow-auto">
            {this.state.error?.toString()}
            {'\n\n'}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

// V104: Full YouTubeWidgetPage with error boundary
export default function V104Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  logger.info('🛡️ V104 - YouTubeWidgetPage with error boundary');

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;
  const { tutorial, exercises } = useTutorialExercises(tutorialSlug);

  return (
    <ErrorBoundary>
      <YouTubeWidgetPage
        tutorialData={tutorial}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </ErrorBoundary>
  );
}
