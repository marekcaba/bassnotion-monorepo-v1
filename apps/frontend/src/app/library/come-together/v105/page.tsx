'use client';

import React, { useEffect } from 'react';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V105: Debug why exercises aren't loading
export default function V105Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  logger.info('🔍 V105 - Debug exercise loading');

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;

  logger.info('Tutorial slug:', tutorialSlug);

  const result = useTutorialExercises(tutorialSlug);

  useEffect(() => {
    logger.info('useTutorialExercises result:', {
      tutorial: result.tutorial,
      exercises: result.exercises,
      isLoading: result.isLoading,
      error: result.error,
    });
  }, [result]);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V105: Exercise Loading Debug</h1>

      <div className="space-y-4 font-mono text-sm">
        <div className="bg-gray-800 p-4 rounded">
          <strong>Tutorial Slug:</strong> {tutorialSlug}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Loading:</strong> {result.isLoading ? 'YES' : 'NO'}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Error:</strong> {result.error || 'None'}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Tutorial:</strong>
          <pre>{JSON.stringify(result.tutorial, null, 2)}</pre>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Exercises ({result.exercises?.length || 0}):</strong>
          <pre>{JSON.stringify(result.exercises, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
