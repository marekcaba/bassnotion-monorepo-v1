'use client';

import React from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V110: Minimal test to reproduce the exact error
export default function V110Page() {
  logger.info('🚨 V110 - Testing sync undefined error');

  // Hardcoded minimal exercise
  const exercises = [
    {
      id: 'test1',
      title: 'Test Exercise',
      duration: 120000,
      bpm: 100,
      key: 'C',
      difficulty: 'beginner',
      chord_progression: ['C', 'F', 'G', 'C'],
    },
  ];

  // Add global error handler
  React.useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      logger.error('🚨 Global error caught:', event.error);
      logger.error('Error message:', event.message);
      logger.error('Error stack:', event.error?.stack);
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Try-catch around the component
  try {
    return (
      <div className="min-h-screen bg-gray-900 p-8">
        <h1 className="text-white text-2xl mb-4">V110: Error Test</h1>
        <div className="max-w-4xl mx-auto">
          <FretboardCard
            exercises={exercises}
            onExerciseSelect={(id) => logger.info('Selected:', id)}
          />
        </div>
      </div>
    );
  } catch (error) {
    logger.error('🚨 Render error:', error);
    return (
      <div className="min-h-screen bg-red-900 p-8 text-white">
        <h1>Error in render:</h1>
        <pre>{String(error)}</pre>
      </div>
    );
  }
}
