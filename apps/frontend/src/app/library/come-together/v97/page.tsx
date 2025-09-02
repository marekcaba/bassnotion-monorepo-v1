'use client';

import React, { useEffect, useRef } from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V97: FretboardCard with NO exercises and render tracking
export default function V97Page() {
  logger.info('🔍 V97 - FretboardCard with empty exercises');

  const renderCount = useRef(0);
  renderCount.current++;

  useEffect(() => {
    logger.info(`V97 rendered ${renderCount.current} times`);
    if (renderCount.current > 50) {
      logger.error('🚨 EXCESSIVE RENDERS!');
    }
  });

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="fixed top-4 right-4 bg-red-500 text-white p-2 rounded z-50">
          Renders: {renderCount.current}
        </div>
        <h1 className="text-white text-2xl mb-4">
          V97: FretboardCard with NO exercises
        </h1>
        <div className="max-w-4xl mx-auto">
          <FretboardCard
            exercises={[]}
            onExerciseSelect={(id) => logger.info('Exercise selected:', id)}
          />
        </div>
      </div>
    </>
  );
}
