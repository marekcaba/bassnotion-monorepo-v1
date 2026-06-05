'use client';

/**
 * TaskBlockForm — admin editor for a `'task'` block (the free-tier no-audio
 * drill brick: instruction + a completion criterion, usually a timer).
 * Vanilla-React form like the other BlockEditor config forms.
 */

import { useCallback } from 'react';
import type { TaskBlockConfig } from '@bassnotion/contracts';
import { CompletionCriterionFields } from './CompletionCriterionFields';

interface TaskBlockFormProps {
  config: TaskBlockConfig;
  onChange: (config: TaskBlockConfig) => void;
}

export function TaskBlockForm({ config, onChange }: TaskBlockFormProps) {
  const updateField = useCallback(
    <K extends keyof TaskBlockConfig>(field: K, value: TaskBlockConfig[K]) => {
      onChange({ ...config, [field]: value });
    },
    [config, onChange],
  );

  return (
    <div className="space-y-4 text-sm">
      <fieldset className="space-y-2">
        <legend className="mb-1 text-xs uppercase tracking-wider text-white/40">
          Task
        </legend>
        <input
          type="text"
          value={config.heading ?? ''}
          onChange={(e) => updateField('heading', e.target.value || undefined)}
          placeholder="Heading (optional, e.g. Warm-up)"
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
        />
        <textarea
          value={config.instruction ?? ''}
          onChange={(e) => updateField('instruction', e.target.value)}
          placeholder="Instruction (e.g. Practice C major scale triads, slowly, up and down.)"
          rows={3}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
        />
      </fieldset>

      {/* No audio → no 'loops' criterion for task blocks. */}
      <CompletionCriterionFields
        value={config.completionCriterion}
        onChange={(c) =>
          updateField(
            'completionCriterion',
            // task blocks must have a criterion; default to a 5-min timer.
            c ?? { type: 'time', target: 5 },
          )
        }
        allowLoops={false}
      />
    </div>
  );
}
