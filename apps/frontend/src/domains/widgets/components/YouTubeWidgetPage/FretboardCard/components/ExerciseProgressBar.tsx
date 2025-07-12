import React from 'react';
import type { ExerciseState } from '../types/fretboardTypes';

interface ExerciseProgressBarProps {
  exerciseData: ExerciseState & {
    hasExercise: boolean;
    selectedExercise: any;
  };
}

export const ExerciseProgressBar: React.FC<ExerciseProgressBarProps> = ({
  exerciseData,
}) => {
  if (!exerciseData.hasExercise) {
    return null;
  }

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-300">Exercise Progress</span>
        <span className="text-sm text-slate-400">
          {Math.round(exerciseData.exerciseProgress)}%
        </span>
      </div>
      <div
        className="w-full h-2 bg-slate-700 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={exerciseData.exerciseProgress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${exerciseData.exerciseProgress}%` }}
        />
      </div>
      {exerciseData.selectedExercise && (
        <div className="mt-2 text-xs text-slate-400">
          <span className="font-medium">
            {exerciseData.selectedExercise.title}
          </span>
          {exerciseData.selectedExercise.bpm && (
            <span className="ml-2">
              • {exerciseData.selectedExercise.bpm} BPM
            </span>
          )}
          {exerciseData.selectedExercise.difficulty && (
            <span className="ml-2">
              • {exerciseData.selectedExercise.difficulty}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
