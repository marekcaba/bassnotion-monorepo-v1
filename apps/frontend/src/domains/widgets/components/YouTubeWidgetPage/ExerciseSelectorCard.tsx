'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Clock, Target, Music, CheckCircle, Loader2 } from 'lucide-react';
import { useExerciseSelection } from '../../hooks/useExerciseSelection';
import { SyncedWidget } from '../base';
import type { SyncedWidgetRenderProps } from '../base';
import type { Tutorial } from '@bassnotion/contracts';

interface ExerciseSelectorCardProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[]; // Exercise data from tutorial API
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
} as const;

// Helper function to get difficulty config with fallback
function getDifficultyConfig(difficulty: any) {
  const normalizedDifficulty = difficulty?.toLowerCase();
  if (normalizedDifficulty in difficultyConfig) {
    return difficultyConfig[
      normalizedDifficulty as keyof typeof difficultyConfig
    ];
  }
  // Fallback for unknown difficulties
  return {
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    label: 'Unknown',
  };
}

export function ExerciseSelectorCard({
  tutorialData: _tutorialData,
  tutorialSlug,
  exercises: propExercises,
  onExerciseSelect,
}: ExerciseSelectorCardProps) {
  // Debug: Log every render of ExerciseSelectorCard
  // console.log('🔄 ExerciseSelectorCard RENDER:', {
  //   tutorialSlug,
  //   propExercisesCount: propExercises?.length || 0,
  //   timestamp: new Date().toISOString(),
  // });

  // Debug: Log mount/unmount
  React.useEffect(() => {
    // console.log('🟢 ExerciseSelectorCard MOUNTED');
    return () => {
      // console.log('🔴 ExerciseSelectorCard UNMOUNTED');
    };
  }, []);

  return (
    <SyncedWidget
      widgetId="exercise-selector"
      widgetName="Exercise Selector"
      debugMode={false}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <ExerciseSelectorCardContent
          tutorialData={_tutorialData}
          tutorialSlug={tutorialSlug}
          exercises={propExercises}
          onExerciseSelect={onExerciseSelect}
          syncProps={syncProps}
        />
      )}
    </SyncedWidget>
  );
}

interface ExerciseSelectorCardContentProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[];
  onExerciseSelect?: (exerciseId: string) => void;
  syncProps: SyncedWidgetRenderProps;
}

function ExerciseSelectorCardContent({
  tutorialData: _tutorialData,
  tutorialSlug: _tutorialSlug,
  exercises: propExercises,
  onExerciseSelect,
  syncProps,
}: ExerciseSelectorCardContentProps) {
  // Use tutorial-specific exercises if provided, otherwise fallback to useExerciseSelection
  const {
    exercises: fallbackExercises,
    isLoading: loading,
    error,
    selectExercise,
  } = useExerciseSelection();

  // Prefer prop exercises (from tutorial) over fallback exercises
  const exercises =
    propExercises && propExercises.length > 0
      ? propExercises
      : fallbackExercises;

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const handleExerciseSelect = useCallback(
    (exerciseId: string) => {
      const exercise = exercises.find((ex) => ex.id === exerciseId);
      if (exercise) {
        setSelectedExerciseId(exerciseId);
        selectExercise(exercise);
        onExerciseSelect?.(exerciseId);

        // Debug log (disabled to reduce console noise)
        // console.log('🎯 Exercise Selected - Configuring all widgets:', {
        //   id: exercise.id,
        //   title: exercise.title,
        //   bpm: exercise.bpm,
        //   key: exercise.key,
        //   chords: exercise.chord_progression,
        // });

        // Emit comprehensive sync events to configure all widgets

        // 1. Main exercise change event
        syncProps.sync.actions.emitEvent(
          'EXERCISE_CHANGE',
          { exercise },
          'high',
        );

        // 2. Tempo change for metronome and global controls
        if (exercise.bpm && exercise.bpm > 0) {
          syncProps.sync.actions.emitEvent(
            'TEMPO_CHANGE',
            {
              tempo: exercise.bpm,
              source: 'exercise-selector',
              reason: 'exercise-template',
            },
            'high',
          );
        }

        // 3. Custom bassline pattern if available
        if (
          exercise.chord_progression &&
          Array.isArray(exercise.chord_progression)
        ) {
          syncProps.sync.actions.emitEvent(
            'CUSTOM_BASSLINE',
            {
              chordProgression: exercise.chord_progression,
              key: exercise.key,
              source: 'exercise-selector',
              reason: 'exercise-template',
            },
            'normal',
          );
        }

        // 4. Volume configuration for optimal practice
        syncProps.sync.actions.emitEvent(
          'VOLUME_CHANGE',
          {
            masterVolume: 0.8,
            metronomeVolume: 0.7,
            source: 'exercise-selector',
            reason: 'exercise-template',
          },
          'low',
        );
      }
    },
    [exercises, selectExercise, onExerciseSelect, syncProps.sync.actions],
  );

  // Auto-select first exercise when exercises load
  useEffect(() => {
    // Auto-select first exercise if none is selected and exercises are available
    if (exercises.length > 0 && !selectedExerciseId) {
      const firstExercise = exercises[0];
      if (firstExercise && firstExercise.id) {
        handleExerciseSelect(firstExercise.id);
      }
    }
  }, [exercises, selectedExerciseId, handleExerciseSelect]);

  return (
    <div className="space-y-6">
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
          {!loading &&
            !error &&
            exercises
              .filter((exercise) => exercise?.id && exercise?.title)
              .map((exercise, index) => (
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
                          getDifficultyConfig(exercise.difficulty).color
                        }`}
                      >
                        {getDifficultyConfig(exercise.difficulty).label}
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
