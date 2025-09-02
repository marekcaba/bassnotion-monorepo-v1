'use client';

import React, { useEffect, useRef } from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V109: FretboardCard with real data using hardcoded slug
export default function V109Page() {
  logger.info('✅ V109 - FretboardCard with real API data');

  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    logger.info(`V109 rendered ${renderCount.current} times`);
  });

  // Use hardcoded slug
  const { tutorial, exercises, isLoading } =
    useTutorialExercises('come-together');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 p-8 text-white">
        <h1 className="text-2xl mb-4">V109: Loading...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="fixed top-4 right-4 bg-green-500 text-white p-2 rounded z-50">
        Renders: {renderCount.current}
      </div>
      <h1 className="text-white text-2xl mb-4">V109: Real Data Test</h1>
      <p className="text-white mb-4">Tutorial: {tutorial?.title || 'None'}</p>
      <p className="text-white mb-4">Exercises: {exercises?.length || 0}</p>

      <div className="max-w-4xl mx-auto">
        <FretboardCard
          exercises={exercises}
          onExerciseSelect={(id) => logger.info('V109: Selected:', id)}
        />
      </div>
    </div>
  );
}
