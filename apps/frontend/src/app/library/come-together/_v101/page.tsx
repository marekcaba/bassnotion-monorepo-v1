'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { SyncedWidget } from '@/domains/widgets/components/base';
import type { SyncedWidgetRenderProps } from '@/domains/widgets/components/base';
import { Card, CardContent } from '@/shared/components/ui/card';
import { useExerciseSelection } from '@/domains/widgets/hooks/useExerciseSelection';
import { Loader2, Clock, Music, CheckCircle } from 'lucide-react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V101: Fixed FretboardCard with stable auto-selection
export default function V101Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  logger.info('✅ V101 - Fixed auto-selection logic');

  const [renderCount, setRenderCount] = useState(0);
  React.useEffect(() => {
    setRenderCount((prev) => prev + 1);
  }, []);

  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;
  const { tutorial, exercises } = useTutorialExercises(tutorialSlug);

  return (
    <>
      <div className="min-h-screen bg-gray-900 p-8">
        <div className="fixed top-4 right-4 bg-green-500 text-white p-2 rounded z-50">
          Renders: {renderCount}
        </div>
        <h1 className="text-white text-2xl mb-4">V101: Fixed auto-selection</h1>
        <p className="text-white mb-4">Exercises: {exercises?.length || 0}</p>
        <div className="max-w-4xl mx-auto">
          <FixedFretboardCard
            exercises={exercises}
            onExerciseSelect={(id) => logger.info('Exercise selected:', id)}
          />
        </div>
      </div>
    </>
  );
}

function FixedFretboardCard({ exercises = [], onExerciseSelect }: any) {
  return (
    <SyncedWidget
      widgetId="interactive-fretboard"
      widgetName="Interactive Fretboard"
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE',
          'TIMELINE_UPDATE',
          'EXERCISE_CHANGE',
          'TEMPO_CHANGE',
        ],
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <FixedFretboardContent
          syncProps={syncProps}
          exercises={exercises}
          onExerciseSelect={onExerciseSelect}
        />
      )}
    </SyncedWidget>
  );
}

function FixedFretboardContent({
  syncProps,
  exercises = [],
  onExerciseSelect,
}: any) {
  const { selectExercise } = useExerciseSelection();
  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');
  const hasAutoSelectedRef = useRef(false);

  // Create stable callback using ref for sync actions
  const syncActionsRef = useRef(syncProps.sync?.actions);
  syncActionsRef.current = syncProps.sync?.actions;

  const handleExerciseSelect = useCallback(
    (exerciseId: string) => {
      logger.info('🎯 handleExerciseSelect called with:', exerciseId);
      const exercise = exercises.find((ex: any) => ex.id === exerciseId);
      if (exercise) {
        setSelectedExerciseId(exerciseId);
        selectExercise(exercise);
        onExerciseSelect?.(exerciseId);

        // Use ref to access sync actions
        const syncActions = syncActionsRef.current;
        if (syncActions?.emitEvent) {
          syncActions.emitEvent('EXERCISE_CHANGE', { exercise }, 'high');
        }
      }
    },
    [exercises, selectExercise, onExerciseSelect],
  ); // NO syncProps here!

  // Auto-select with flag to prevent loops
  React.useEffect(() => {
    if (
      exercises.length > 0 &&
      !selectedExerciseId &&
      !hasAutoSelectedRef.current
    ) {
      hasAutoSelectedRef.current = true;
      const firstExercise = exercises[0];
      if (firstExercise?.id) {
        logger.info('🚀 Auto-selecting (once only):', firstExercise.id);
        // Defer to next tick
        setTimeout(() => {
          handleExerciseSelect(firstExercise.id);
        }, 0);
      }
    }
  }, [exercises.length]); // Only depend on length change!

  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="p-0">
        <div className="bg-slate-800 rounded-2xl p-6">
          <h3 className="text-white text-lg mb-4">Select Exercise</h3>
          <div className="space-y-3">
            {exercises.map((exercise: any, index: number) => (
              <div
                key={exercise.id}
                className={`p-4 rounded-xl cursor-pointer transition-all ${
                  selectedExerciseId === exercise.id
                    ? 'bg-orange-500/20 border border-orange-500/30'
                    : 'bg-slate-700/50 hover:bg-slate-700/70'
                }`}
                onClick={() => handleExerciseSelect(exercise.id)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-white font-medium">{exercise.title}</h4>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {Math.floor(exercise.duration / 60000)}:
                        {String(
                          Math.floor((exercise.duration % 60000) / 1000),
                        ).padStart(2, '0')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        {exercise.bpm} BPM
                      </span>
                    </div>
                  </div>
                  {selectedExerciseId === exercise.id && (
                    <CheckCircle className="w-5 h-5 text-orange-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
