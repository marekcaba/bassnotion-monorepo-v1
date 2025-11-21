'use client';

import React, { useState } from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V100: FretboardCard with real tutorial data
export default function V100Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  const { logger } = useCorrelation('V100Page');
  logger.info('🎯 V100 - FretboardCard with real tutorial data');

  const [renderCount, setRenderCount] = useState(0);
  React.useEffect(() => {
    setRenderCount((prev) => prev + 1);
  }, []);

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;
  const { tutorial, exercises } = useTutorialExercises(tutorialSlug);

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="fixed top-4 right-4 bg-purple-500 text-white p-2 rounded z-50">
          Renders: {renderCount}
        </div>
        <h1 className="text-white text-2xl mb-4">
          V100: FretboardCard with real data
        </h1>
        <p className="text-white mb-4">
          Tutorial: {tutorial?.title || 'Loading...'}
        </p>
        <p className="text-white mb-4">Exercises: {exercises?.length || 0}</p>
        <div className="max-w-4xl mx-auto">
          <FretboardCard
            exercises={exercises}
            onExerciseSelect={(id) => logger.info('Exercise selected:', id)}
          />
        </div>
      </div>
    </>
  );
}
