'use client';

/**
 * ScalesBlockForm — admin editor for a `'scales'` block: pick the gym Scales exercise the block
 * locks to, plus optional key / tempo / take-loops. Empty exercise = open (tool default). The
 * preset feeds ScalesTool's `context` when the block renders (gig/rep both lock to it).
 * Vanilla-React form like the other BlockEditor config forms.
 */

import { useCallback } from 'react';
import type { ScalesBlockConfig } from '@bassnotion/contracts';
import { useGymExerciseLibrary } from '@/domains/training-engine/hooks/useGymExerciseLibrary';

interface ScalesBlockFormProps {
  config: ScalesBlockConfig;
  onChange: (config: ScalesBlockConfig) => void;
  /** Surface theme — the BlockEditor is a DARK card (default); the training-goals admin form is
   *  a LIGHT page. The inputs' colours must follow, or white-on-white / dark-on-dark is invisible. */
  variant?: 'dark' | 'light';
}

// ASCII PathKeys the scale tool understands (matches the tool's KEYS roller).
const KEY_OPTIONS = [
  'C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B',
] as const;

export function ScalesBlockForm({
  config,
  onChange,
  variant = 'dark',
}: ScalesBlockFormProps) {
  const { data: library = [] } = useGymExerciseLibrary('scales');

  const updateField = useCallback(
    <K extends keyof ScalesBlockConfig>(
      field: K,
      value: ScalesBlockConfig[K],
    ) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  // Theme-aware classes so the form reads on both the dark BlockEditor card and the light
  // training-goals page.
  const labelCls =
    variant === 'light'
      ? 'text-xs uppercase tracking-wider text-gray-500'
      : 'text-xs uppercase tracking-wider text-white/40';
  const fieldCls =
    variant === 'light'
      ? 'w-full rounded-md border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400'
      : 'w-full rounded-md border border-white/10 bg-white/5 text-white placeholder:text-white/30';

  return (
    <div className="space-y-4 text-sm">
      <fieldset className="space-y-2">
        <legend className={`mb-1 ${labelCls}`}>Scale exercise</legend>
        <select
          value={config.exerciseId ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            const name = library.find((ex) => ex.id === id)?.name ?? null;
            onChange({ ...config, exerciseId: id, exerciseName: name });
          }}
          className={`${fieldCls} px-3 py-2`}
        >
          <option value="">— Open (tool default) —</option>
          {library.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </fieldset>

      <div className="grid grid-cols-3 gap-3">
        <label className="space-y-1">
          <span className={labelCls}>Key</span>
          <select
            value={config.scaleKey ?? ''}
            onChange={(e) => updateField('scaleKey', e.target.value || null)}
            className={`${fieldCls} px-2 py-2`}
          >
            <option value="">Default</option>
            {KEY_OPTIONS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-1">
          <span className={labelCls}>Tempo</span>
          <input
            type="number"
            min={40}
            max={220}
            value={config.tempoBpm ?? ''}
            onChange={(e) =>
              updateField(
                'tempoBpm',
                e.target.value ? Number(e.target.value) : null,
              )
            }
            placeholder="BPM"
            className={`${fieldCls} px-2 py-2`}
          />
        </label>

        <label className="space-y-1">
          <span className={labelCls}>Loops</span>
          <input
            type="number"
            min={1}
            max={8}
            value={config.recordLoops ?? 2}
            onChange={(e) =>
              updateField('recordLoops', Number(e.target.value) || 2)
            }
            className={`${fieldCls} px-2 py-2`}
          />
        </label>
      </div>
    </div>
  );
}
