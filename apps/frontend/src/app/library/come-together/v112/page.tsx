'use client';

import React from 'react';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V112: Just test the data loading hook
export default function V112Page() {
  logger.info('📊 V112 - Testing useTutorialExercises hook');

  // Use the hook with hardcoded slug
  const { tutorial, exercises, isLoading, error } =
    useTutorialExercises('come-together');

  logger.info('📊 V112 Hook result:', {
    tutorial: tutorial?.title,
    exercisesCount: exercises?.length,
    isLoading,
    error: error?.message,
  });

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V112: Data Loading Test</h1>

      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded">
          <h2 className="font-bold">Loading State:</h2>
          <p>{isLoading ? '⏳ Loading...' : '✅ Loaded'}</p>
        </div>

        <div className="p-4 bg-gray-800 rounded">
          <h2 className="font-bold">Error:</h2>
          <p>{error ? `❌ ${error.message}` : '✅ No errors'}</p>
        </div>

        <div className="p-4 bg-gray-800 rounded">
          <h2 className="font-bold">Tutorial:</h2>
          <p>{tutorial ? tutorial.title : 'No tutorial loaded'}</p>
        </div>

        <div className="p-4 bg-gray-800 rounded">
          <h2 className="font-bold">Exercises:</h2>
          <p>{exercises?.length || 0} exercises loaded</p>
        </div>
      </div>
    </div>
  );
}
