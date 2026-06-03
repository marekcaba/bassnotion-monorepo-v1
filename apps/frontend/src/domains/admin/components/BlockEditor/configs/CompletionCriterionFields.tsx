'use client';

/**
 * CompletionCriterionFields — the admin editor for a drill block's completion
 * criterion (type + target / targetTier). Shared by the groove-card form and
 * the task-block form so the criterion UI lives in one place.
 */

import type {
  DrillCompletionCriterion,
  DrillCriterionType,
  MasteryTier,
} from '@bassnotion/contracts';

interface CompletionCriterionFieldsProps {
  value: DrillCompletionCriterion | undefined;
  onChange: (next: DrillCompletionCriterion | undefined) => void;
  /** Task blocks have no audio, so 'loops' isn't offered there. */
  allowLoops?: boolean;
}

export function CompletionCriterionFields({
  value,
  onChange,
  allowLoops = true,
}: CompletionCriterionFieldsProps) {
  const type = value?.type;

  const setType = (t: DrillCriterionType | '') => {
    if (!t) {
      onChange(undefined);
      return;
    }
    // Reset target/tier when switching type to avoid stale values.
    onChange({ type: t });
  };

  const patch = (p: Partial<DrillCompletionCriterion>) => {
    if (!type) return;
    onChange({ ...value, type, ...p } as DrillCompletionCriterion);
  };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-xs uppercase tracking-wider text-white/40">
        Completion — how this brick is "done"
      </legend>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1">
          <span className="text-xs text-white/50">Criterion</span>
          <select
            value={type ?? ''}
            onChange={(e) => setType(e.target.value as DrillCriterionType | '')}
            className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
          >
            <option value="">None</option>
            <option value="time">Time (practice N min)</option>
            {allowLoops && <option value="loops">Loops (play N times)</option>}
            <option value="conquer">Conquer (clean pass)</option>
            <option value="manual">Manual (I&apos;m done)</option>
          </select>
        </label>

        {/* Target: minutes for time, count for loops. */}
        {(type === 'time' || type === 'loops') && (
          <label className="space-y-1">
            <span className="text-xs text-white/50">
              {type === 'time' ? 'Minutes' : 'Loop count'}
            </span>
            <input
              type="number"
              min={1}
              value={value?.target ?? ''}
              onChange={(e) =>
                patch({
                  target: e.target.value ? Number(e.target.value) : undefined,
                })
              }
              placeholder={type === 'time' ? '5' : '4'}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white placeholder:text-white/30"
            />
          </label>
        )}

        {/* Target tier for conquer. */}
        {type === 'conquer' && (
          <label className="space-y-1">
            <span className="text-xs text-white/50">Target tier</span>
            <select
              value={value?.targetTier ?? 'bronze'}
              onChange={(e) =>
                patch({ targetTier: e.target.value as MasteryTier })
              }
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
            >
              <option value="bronze">🥉 Bronze</option>
              <option value="silver">🥈 Silver</option>
              <option value="gold">🥇 Gold</option>
            </select>
          </label>
        )}
      </div>
    </fieldset>
  );
}
