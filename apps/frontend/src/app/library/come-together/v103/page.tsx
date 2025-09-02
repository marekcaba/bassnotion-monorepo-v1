'use client';

import React from 'react';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V103: Just show the exercises data
export default function V103Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  logger.info('📋 V103 - Just showing exercises data');

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;
  const { tutorial, exercises, isLoading, error } =
    useTutorialExercises(tutorialSlug);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V103: Exercises Data Check</h1>

      {isLoading && <p>Loading...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      <div className="mb-4">
        <h2 className="text-xl mb-2">
          Tutorial: {tutorial?.title || 'No tutorial'}
        </h2>
        <p>Exercises count: {exercises?.length || 0}</p>
      </div>

      <div className="space-y-4">
        {exercises?.map((ex: any, idx: number) => (
          <div key={ex.id} className="bg-gray-800 p-4 rounded">
            <h3 className="font-bold">
              #{idx + 1}: {ex.title}
            </h3>
            <p>ID: {ex.id}</p>
            <p>BPM: {ex.bpm}</p>
            <p>Duration: {ex.duration}ms</p>
            <p>Key: {ex.key}</p>
            <p>Difficulty: {ex.difficulty}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
