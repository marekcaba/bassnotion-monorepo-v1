'use client';

/**
 * GrooveBlockForm - Configuration form for Groove blocks.
 *
 * Allows setting a YouTube URL for sync playback, selecting a groove
 * exercise, and toggling whether previous blocks must be completed first.
 */

import React, { useCallback, useMemo } from 'react';
import type { GrooveBlockConfig } from '@bassnotion/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NormalizedExercise {
  id: string;
  title: string;
  difficulty: string;
}

interface GrooveBlockFormProps {
  config: GrooveBlockConfig;
  exercises: Array<{
    id: string | { value: string };
    title?: string;
    difficulty?: string;
  }>;
  onChange: (config: GrooveBlockConfig) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeExerciseId(id: string | { value: string }): string {
  return typeof id === 'object' ? id.value : String(id);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const GrooveBlockForm = React.memo(function GrooveBlockForm({
  config,
  exercises,
  onChange,
}: GrooveBlockFormProps) {
  const exerciseList: NormalizedExercise[] = useMemo(
    () =>
      exercises
        .filter((ex) => ex?.id && ex?.title)
        .map((ex) => ({
          id: normalizeExerciseId(ex.id),
          title: ex.title!,
          difficulty: ex.difficulty ?? 'beginner',
        })),
    [exercises],
  );

  const handleYoutubeUrlChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, youtubeUrl: e.target.value });
    },
    [config, onChange],
  );

  const handleExerciseChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange({ ...config, grooveExerciseId: e.target.value || undefined });
    },
    [config, onChange],
  );

  const handleRequiresPreviousChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...config, requiresPreviousCompletion: e.target.checked });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4">
      {/* YouTube URL */}
      <div>
        <label className="block text-xs text-white/40 mb-1">YouTube URL</label>
        <input
          type="text"
          value={config.youtubeUrl ?? ''}
          onChange={handleYoutubeUrlChange}
          placeholder="YouTube video URL or ID"
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/20"
        />
      </div>

      {/* Groove exercise selector */}
      <div>
        <label className="block text-xs text-white/40 mb-2">
          Groove Exercise
        </label>
        <select
          value={config.grooveExerciseId ?? ''}
          onChange={handleExerciseChange}
          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm"
        >
          <option value="">None selected</option>
          {exerciseList.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.title} ({ex.difficulty})
            </option>
          ))}
        </select>
      </div>

      {/* Requires previous completion */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="groove-requires-previous"
          checked={config.requiresPreviousCompletion ?? true}
          onChange={handleRequiresPreviousChange}
          className="rounded"
        />
        <label
          htmlFor="groove-requires-previous"
          className="text-sm text-white/60"
        >
          Requires previous exercise blocks to be complete
        </label>
      </div>
    </div>
  );
});
