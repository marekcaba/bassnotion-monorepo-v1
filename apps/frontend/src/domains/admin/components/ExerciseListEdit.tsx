'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Plus, Settings, Trash } from 'lucide-react';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';

interface ExerciseListEditProps {
  exercises: Exercise[];
  onAddExercise: () => void;
  onEditExercise: (exercise: Exercise) => void;
  onDeleteExercise: (index: number) => void;
}

export function ExerciseListEdit({
  exercises,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
}: ExerciseListEditProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium">Exercises</h4>
        <Button onClick={onAddExercise} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Add Exercise
        </Button>
      </div>

      {exercises.length === 0 ? (
        <p className="text-gray-500 text-center py-4">
          No exercises yet. Click "Add Exercise" to create one.
        </p>
      ) : (
        exercises.map((exercise, index) => (
          <div
            key={exercise.id?.value || index}
            className="p-3 border rounded hover:bg-gray-50"
          >
            <div className="flex justify-between items-center">
              <div className="flex-1">
                <h5 className="font-medium">{exercise.title}</h5>
                <p className="text-sm text-gray-600">{exercise.description}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-gray-500">
                    BPM: {exercise.bpm}
                  </span>
                  <span className="text-xs text-gray-500">
                    Level: {exercise.difficulty?.value || 'intermediate'}
                  </span>
                  {exercise.drummerMidiUrl && (
                    <span className="text-xs text-green-600">🎵 Drums</span>
                  )}
                  {exercise.basslineMidiUrl && (
                    <span className="text-xs text-green-600">🎵 Bass</span>
                  )}
                  {exercise.harmonyMidiUrl && (
                    <span className="text-xs text-green-600">🎵 Harmony</span>
                  )}
                  {exercise.metronomeMidiUrl && (
                    <span className="text-xs text-green-600">🎵 Metronome</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => onEditExercise(exercise)}
                  size="sm"
                  variant="ghost"
                >
                  <Settings className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => onDeleteExercise(index)}
                  size="sm"
                  variant="ghost"
                  className="text-red-500"
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
