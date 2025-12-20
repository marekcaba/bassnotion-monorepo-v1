'use client';

import React, { useState, useEffect } from 'react';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V106: FretboardCard with controlled exercises loading
export default function V106Page() {
  logger.info('🎮 V106 - Controlled exercise loading');

  const [exercises, setExercises] = useState<any[]>([]);
  const [renderCount, setRenderCount] = useState(0);

  useEffect(() => {
    setRenderCount((prev) => prev + 1);
  }, []);

  // Simulate loading exercises after a delay
  useEffect(() => {
    const timer = setTimeout(() => {
      logger.info('Loading exercises...');
      setExercises([
        {
          id: 'ex1',
          title: 'Exercise 1',
          duration: 120000,
          bpm: 100,
          key: 'C',
          difficulty: 'beginner',
          chord_progression: ['C', 'F', 'G', 'C'],
        },
        {
          id: 'ex2',
          title: 'Exercise 2',
          duration: 180000,
          bpm: 120,
          key: 'G',
          difficulty: 'intermediate',
          chord_progression: ['G', 'C', 'D', 'G'],
        },
      ]);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="fixed top-4 right-4 bg-blue-500 text-white p-2 rounded z-50">
        Renders: {renderCount}
      </div>
      <h1 className="text-white text-2xl mb-4">V106: Controlled Loading</h1>
      <p className="text-white mb-4">Exercises: {exercises.length}</p>

      <div className="max-w-4xl mx-auto">
        <FretboardCard
          exercises={exercises}
          onExerciseSelect={(id) => logger.info('V106: Selected:', id)}
        />
      </div>
    </div>
  );
}
