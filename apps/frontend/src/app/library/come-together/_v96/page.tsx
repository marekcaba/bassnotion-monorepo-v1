'use client';

import React from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V96: MINIMAL - Just FretboardCard with hardcoded exercises
export default function V96Page() {
  logger.info('🎯 V96 - JUST FretboardCard, nothing else!');

  // Hardcoded exercises to test
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
    {
      id: 'ex2',
      title: 'Test Exercise 2',
      duration: 180000,
      bpm: 120,
      key: 'G',
      difficulty: 'intermediate',
      chord_progression: ['G', 'C', 'D', 'G'],
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-8">
        <h1 className="text-white text-2xl mb-4">V96: Just FretboardCard</h1>
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
