'use client';

/**
 * ExerciseBlockForm - Configuration form for Exercise blocks.
 *
 * Provides multi-select of available exercises and a "required completions"
 * input. Each exercise can be toggled on/off with a checkbox-style button.
 */

import React, { useCallback, useMemo } from 'react';
import type { ExerciseBlockConfig } from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NormalizedExercise {
  id: string;
  title: string;
  difficulty: string;
}

interface ExerciseBlockFormProps {
  config: ExerciseBlockConfig;
  exercises: Array<{ id: unknown; title?: unknown; difficulty?: unknown }>;
  onChange: (config: ExerciseBlockConfig) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Unwrap a value that may be wrapped in a {value} object from Supabase JSONB */
function unwrapValue(val: unknown, fallback = ''): string {
  if (val == null) return fallback;
  if (typeof val === 'object' && val !== null && 'value' in val) {
    return String((val as { value: unknown }).value);
  }
  return String(val);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ExerciseBlockForm = React.memo(function ExerciseBlockForm({
  config,
  exercises,
  onChange,
}: ExerciseBlockFormProps) {
  const exerciseList: NormalizedExercise[] = useMemo(
    () =>
      exercises
        .filter((ex) => ex?.id != null && ex?.title != null)
        .map((ex) => ({
          id: unwrapValue(ex.id),
          title: unwrapValue(ex.title),
          difficulty: unwrapValue(ex.difficulty, 'beginner'),
        })),
    [exercises],
  );

  const handleExerciseToggle = useCallback(
    (exerciseId: string) => {
      const current = config.exerciseIds ?? [];
      const updated = current.includes(exerciseId)
        ? current.filter((id) => id !== exerciseId)
        : [...current, exerciseId];
      onChange({ ...config, exerciseIds: updated });
    },
    [config, onChange],
  );

  const handleCompletionsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = parseInt(e.target.value, 10);
      onChange({ ...config, requiredCompletions: Number.isNaN(value) ? 4 : value });
    },
    [config, onChange],
  );

  const selectedCount = (config.exerciseIds ?? []).length;

  return (
    <div className="space-y-4">
      {/* Exercise list with toggleable checkboxes */}
      <div>
        <label className="block text-xs text-white/40 mb-2">
          Exercises ({selectedCount} selected)
        </label>
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {exerciseList.length === 0 ? (
            <p className="text-xs text-white/30 italic">No exercises created yet</p>
          ) : (
            exerciseList.map((ex) => (
              <ExerciseToggleRow
                key={ex.id}
                exercise={ex}
                isSelected={(config.exerciseIds ?? []).includes(ex.id)}
                onToggle={handleExerciseToggle}
              />
            ))
          )}
        </div>
      </div>

      {/* Required completions */}
      <div>
        <label className="block text-xs text-white/40 mb-1">Required Completions</label>
        <input
          type="number"
          min={1}
          max={10}
          value={Number(unwrapValue(config.requiredCompletions, '4')) || 4}
          onChange={handleCompletionsChange}
          className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        />
      </div>
    </div>
  );
});

// ---------------------------------------------------------------------------
// Individual exercise row (memoized)
// ---------------------------------------------------------------------------

interface ExerciseToggleRowProps {
  exercise: NormalizedExercise;
  isSelected: boolean;
  onToggle: (exerciseId: string) => void;
}

const ExerciseToggleRow = React.memo(function ExerciseToggleRow({
  exercise,
  isSelected,
  onToggle,
}: ExerciseToggleRowProps) {
  const handleClick = useCallback(() => {
    onToggle(exercise.id);
  }, [onToggle, exercise.id]);

  return (
    <button
      onClick={handleClick}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
        isSelected
          ? 'bg-blue-500/15 border border-blue-500/30'
          : 'bg-white/5 border border-transparent hover:border-white/10'
      }`}
    >
      {/* Checkbox indicator */}
      <div
        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
          isSelected ? 'bg-blue-500 border-blue-500' : 'border-white/20'
        }`}
      >
        {isSelected && <span className="text-white text-[10px]">&#10003;</span>}
      </div>

      <span className="text-sm text-white truncate">{exercise.title}</span>
      <span className="text-xs text-white/30 ml-auto capitalize">{exercise.difficulty}</span>
    </button>
  );
});
