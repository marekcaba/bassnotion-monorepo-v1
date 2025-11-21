'use client';

import React, { useState, useCallback } from 'react';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';
import { ExerciseCard } from './ExerciseCard';
import { Button } from '@/shared/components/ui/button';
import { Plus, GripVertical } from 'lucide-react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from '@hello-pangea/dnd';

interface ExerciseSelectorProps {
  exercises: Exercise[];
  selectedExerciseId?: string;
  isPlaying?: boolean;
  onSelectExercise?: (exercise: Exercise) => void;
  onPlayExercise?: (exercise: Exercise) => void;
  onPauseExercise?: () => void;
  editable?: boolean;
  onAddExercise?: () => void;
  onEditExercise?: (exercise: Exercise) => void;
  onDeleteExercise?: (exerciseId: string) => void;
  onReorderExercises?: (exercises: Exercise[]) => void;
  className?: string;
}

export function ExerciseSelector({
  exercises,
  selectedExerciseId,
  isPlaying = false,
  onSelectExercise,
  onPlayExercise,
  onPauseExercise,
  editable = false,
  onAddExercise,
  onEditExercise,
  onDeleteExercise,
  onReorderExercises,
  className = '',
}: ExerciseSelectorProps) {
  const [localExercises, setLocalExercises] = useState(exercises);

  React.useEffect(() => {
    setLocalExercises(exercises);
  }, [exercises]);

  const handleDragEnd = useCallback((result: DropResult) => {
    if (!result.destination) return;

    const items = Array.from(localExercises);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setLocalExercises(items);
    onReorderExercises?.(items);
  }, [localExercises, onReorderExercises]);

  const renderExerciseCard = (exercise: Exercise, index: number) => {
    const isSelected = exercise.id.value === selectedExerciseId;
    const card = (
      <ExerciseCard
        key={exercise.id.value}
        exercise={exercise}
        isSelected={isSelected}
        isPlaying={isSelected && isPlaying}
        onSelect={() => onSelectExercise?.(exercise)}
        onPlay={() => onPlayExercise?.(exercise)}
        onPause={onPauseExercise}
        editable={editable}
        onEdit={() => onEditExercise?.(exercise)}
        onDelete={() => onDeleteExercise?.(exercise.id.value)}
      />
    );

    if (editable && onReorderExercises) {
      return (
        <Draggable
          key={exercise.id.value}
          draggableId={exercise.id.value}
          index={index}
        >
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              className={`mb-4 ${snapshot.isDragging ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-2">
                <div
                  {...provided.dragHandleProps}
                  className="mt-4 cursor-move text-gray-400 hover:text-gray-200"
                >
                  <GripVertical className="w-5 h-5" />
                </div>
                <div className="flex-1">{card}</div>
              </div>
            </div>
          )}
        </Draggable>
      );
    }

    return (
      <div key={exercise.id.value} className="mb-4">
        {card}
      </div>
    );
  };

  if (editable && onReorderExercises) {
    return (
      <div className={`exercise-selector ${className}`}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Exercises</h2>
          {editable && onAddExercise && (
            <Button onClick={onAddExercise} size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Exercise
            </Button>
          )}
        </div>

        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="exercises">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef}>
                {localExercises.map((exercise, index) =>
                  renderExerciseCard(exercise, index)
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>

        {localExercises.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p>No exercises added yet.</p>
            {editable && (
              <Button onClick={onAddExercise} className="mt-4" variant="outline">
                <Plus className="w-4 h-4 mr-1" />
                Add First Exercise
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  // Non-editable version without drag and drop
  return (
    <div className={`exercise-selector ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Exercises</h2>
        {editable && onAddExercise && (
          <Button onClick={onAddExercise} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            Add Exercise
          </Button>
        )}
      </div>

      {exercises.map((exercise, index) => renderExerciseCard(exercise, index))}

      {exercises.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No exercises available for this tutorial.</p>
        </div>
      )}
    </div>
  );
}