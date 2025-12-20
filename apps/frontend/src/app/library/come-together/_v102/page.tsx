'use client';

import React, { useEffect, useRef } from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V102: Testing the ACTUAL FretboardCard with render tracking
export default function V102Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  logger.info('🔍 V102 - Real FretboardCard with extensive logging');

  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    logger.info(`V102 Page rendered ${renderCount.current} times`);
    if (renderCount.current > 100) {
      logger.error('🚨 INFINITE RENDER DETECTED IN V102!');
    }
  });

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;
  const { tutorial, exercises } = useTutorialExercises(tutorialSlug);

  // Log exercises data
  useEffect(() => {
    logger.info('V102 exercises loaded:', exercises?.length || 0);
  }, [exercises?.length]);

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="fixed top-4 right-4 bg-red-500 text-white p-2 rounded z-50">
          V102 Renders: {renderCount.current}
        </div>
        <h1 className="text-white text-2xl mb-4">
          V102: Testing Real FretboardCard
        </h1>
        <p className="text-white mb-4">
          Tutorial: {tutorial?.title || 'Loading...'}
        </p>
        <p className="text-white mb-4">Exercises: {exercises?.length || 0}</p>

        <div className="max-w-4xl mx-auto">
          <FretboardCard
            exercises={exercises}
            onExerciseSelect={(id) =>
              logger.info('V102: Exercise selected:', id)
            }
          />
        </div>
      </div>
    </>
  );
}
