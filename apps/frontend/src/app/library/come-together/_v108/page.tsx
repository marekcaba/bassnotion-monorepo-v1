'use client';

import React from 'react';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V108: Force the correct tutorial slug
export default function V108Page() {
  logger.info('📌 V108 - Using hardcoded slug');

  // Hardcode the correct slug
  const tutorialSlug = 'come-together';
  const result = useTutorialExercises(tutorialSlug);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V108: Hardcoded Tutorial Slug</h1>

      <div className="space-y-4 font-mono text-sm">
        <div className="bg-gray-800 p-4 rounded">
          <strong>Tutorial Slug:</strong> {tutorialSlug} (hardcoded)
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Loading:</strong> {result.isLoading ? 'YES' : 'NO'}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Error:</strong> {result.error?.message || 'None'}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Tutorial:</strong>
          <pre>{JSON.stringify(result.tutorial, null, 2)}</pre>
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Exercises ({result.exercises?.length || 0}):</strong>
          {result.exercises?.map((ex: any) => (
            <div key={ex.id} className="mt-2 p-2 bg-gray-700 rounded">
              {ex.title} (ID: {ex.id})
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
