'use client';

import React, { useState } from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { SyncProvider } from '@/domains/widgets/components/base';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V99: FretboardCard with SyncProvider wrapper
export default function V99Page() {
  logger.info('🔍 V99 - FretboardCard with SyncProvider');

  const [renderCount, setRenderCount] = useState(0);
  React.useEffect(() => {
    setRenderCount((prev) => prev + 1);
  }, []);

  const exercises = [
    {
      id: 'ex1',
      title: 'Test Exercise 1',
      duration: 120000,
      bpm: 100,
      key: 'C',
      difficulty: 'beginner',
      chord_progression: ['C', 'F', 'G', 'C'],
    },
  ];

  return (
    <SyncProvider tutorialSlug="come-together">
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="fixed top-4 right-4 bg-blue-500 text-white p-2 rounded z-50">
          Renders: {renderCount}
        </div>
        <h1 className="text-white text-2xl mb-4">
          V99: FretboardCard with SyncProvider
        </h1>
        <div className="max-w-4xl mx-auto">
          <FretboardCard
            exercises={exercises}
            onExerciseSelect={(id) => logger.info('Exercise selected:', id)}
          />
        </div>
      </div>
    </SyncProvider>
  );
}
