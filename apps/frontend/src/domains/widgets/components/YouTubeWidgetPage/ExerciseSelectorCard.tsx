'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Clock, Target, Music, CheckCircle, Loader2 } from 'lucide-react';
import { useExerciseSelection } from '../../hooks/useExerciseSelection';
import { SyncedWidget } from '../base/SyncedWidget.js';
import type { SyncedWidgetRenderProps } from '../base/SyncedWidget.js';

interface TutorialData {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  duration: string;
  videoUrl: string;
  concepts: string[];
}

interface ExerciseSelectorCardProps {
  tutorialData?: TutorialData;
  onExerciseSelect?: (exerciseId: string) => void;
}

// Helper function to format duration from milliseconds to mm:ss
function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const difficultyConfig = {
  beginner: {
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    label: 'Beginner',
  },
  intermediate: {
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    label: 'Intermediate',
  },
  advanced: {
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    label: 'Advanced',
  },
};

export function ExerciseSelectorCard({
  tutorialData: _tutorialData,
  onExerciseSelect,
}: ExerciseSelectorCardProps) {
  return (
    <SyncedWidget
      widgetId="exercise-selector"
      widgetName="Exercise Selector"
      debugMode={process.env.NODE_ENV === 'development'}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <ExerciseSelectorCardContent
          tutorialData={_tutorialData}
          onExerciseSelect={onExerciseSelect}
          syncProps={syncProps}
        />
      )}
    </SyncedWidget>
  );
}

interface ExerciseSelectorCardContentProps {
  tutorialData?: TutorialData;
  onExerciseSelect?: (exerciseId: string) => void;
  syncProps: SyncedWidgetRenderProps;
}

function ExerciseSelectorCardContent({
  tutorialData: _tutorialData,
  onExerciseSelect,
  syncProps,
}: ExerciseSelectorCardContentProps) {
  const {
    exercises,
    isLoading: loading,
    error,
    selectExercise,
  } = useExerciseSelection();

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  // Auto-select first exercise when exercises load
  useEffect(() => {
    if (exercises.length > 0 && !selectedExerciseId) {
      const firstExercise = exercises[0];
      if (firstExercise) {
        console.log(
          '🎯 ExerciseSelectorCard: Auto-selecting first exercise:',
          firstExercise.id,
        );
        setSelectedExerciseId(firstExercise.id);
        selectExercise(firstExercise);
        onExerciseSelect?.(firstExercise.id);

        // Emit sync event for exercise change
        syncProps.sync.actions.emitEvent(
          'EXERCISE_CHANGE',
          { exercise: firstExercise },
          'normal',
        );
      }
    }
  }, [
    exercises,
    selectedExerciseId,
    selectExercise,
    onExerciseSelect,
    syncProps,
  ]);

  const handleExerciseSelect = (exerciseId: string) => {
    const exercise = exercises.find((ex) => ex.id === exerciseId);
    if (exercise) {
      setSelectedExerciseId(exerciseId);
      selectExercise(exercise);
      onExerciseSelect?.(exerciseId);

      // Emit sync event for exercise change
      syncProps.sync.actions.emitEvent(
        'EXERCISE_CHANGE',
        { exercise },
        'normal',
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Concept Card */}
      <Card className="bg-purple-900/30 backdrop-blur-xl border border-purple-700/50 shadow-2xl">
        <CardContent className="p-6">
          <h3 className="text-xl font-semibold text-white mb-3">
            Core Concept
          </h3>
          <p className="text-purple-200 leading-relaxed mb-4">
            Use different modes starting from the same root note (D) over a
            2-5-1 progression to create intentional tension and release without
            shifting the root.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-green-300">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm">
                Modal interchange over static root notes
              </span>
            </div>
            <div className="flex items-center gap-2 text-green-300">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm">
                Advanced tension and release techniques
              </span>
            </div>
            <div className="flex items-center gap-2 text-green-300">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm">II-V-I progression variations</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exercise Selection Card */}
      <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                🎯 Exercise Selector
              </CardTitle>
              <p className="text-slate-400">
                Choose an exercise to configure your practice session
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
              <span className="ml-2 text-slate-400">Loading exercises...</span>
            </div>
          )}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          // TODO: Review non-null assertion - consider null safety
          {!loading &&
            // TODO: Review non-null assertion - consider null safety
            !error &&
            exercises.map((exercise, index) => (
              <div
                key={exercise.id}
                className={`relative p-5 rounded-xl border cursor-pointer transition-all duration-300 group ${
                  selectedExerciseId === exercise.id
                    ? 'bg-slate-700/60 border-orange-500/50 shadow-lg shadow-orange-500/10'
                    : 'bg-slate-800/40 border-slate-600/30 hover:bg-slate-700/40 hover:border-slate-500/50'
                }`}
                onClick={() => handleExerciseSelect(exercise.id)}
              >
                {/* Exercise Number Badge */}
                <div className="absolute -left-2 -top-2 w-8 h-8 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  {index + 1}
                </div>

                {/* Selected Indicator */}
                {selectedExerciseId === exercise.id && (
                  <div className="absolute -right-2 -top-2">
                    <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-white mb-2 group-hover:text-orange-300 transition-colors">
                      {exercise.title}
                    </h3>
                    <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                      {exercise.description}
                    </p>

                    <div className="flex items-center gap-4 text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatDuration(exercise.duration)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Music className="w-3.5 h-3.5" />
                        <span>{exercise.bpm} BPM</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <span className="text-xs">Key:</span>
                        <span className="font-medium">{exercise.key}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        difficultyConfig[exercise.difficulty].color
                      }`}
                    >
                      {difficultyConfig[exercise.difficulty].label}
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
