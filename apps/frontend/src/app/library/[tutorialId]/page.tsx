'use client';

import React from 'react';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';

interface TutorialPageProps {
  params: Promise<{
    tutorialId: string;
  }>;
}

export default function TutorialPage({ params }: TutorialPageProps) {
  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;

  // Debug: Log mount/unmount (simplified)
  React.useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);

  // Load real tutorial data from API
  const { tutorial, exercises, isLoading, error } =
    useTutorialExercises(tutorialSlug);

  // Handle loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading tutorial...</p>
        </div>
      </div>
    );
  }

  // Handle error state
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Tutorial Content with real data and exercises */}
      <YouTubeWidgetPage
        tutorialData={tutorial}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </div>
  );
}
