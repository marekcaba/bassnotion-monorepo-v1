'use client';

/**
 * Admin Training Goals — /admin/training-goals (Phase 5a).
 *
 * Author the goals the Bass Gym engine plans from, no seed SQL: pick a type,
 * name it, set the target + the focal task, and the page assembles the
 * block_set the engine reads (a single task block embedded inline — the shape
 * the seed used). Mirrors the admin products/grooves house style (plain
 * useState form + list, amber accent). Editing never disturbs an in-flight
 * climb — enrollments hold a frozen snapshot.
 */

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Goal, GoalType, CreateGoalInput } from '@bassnotion/contracts';

import {
  useAdminTrainingGoals,
  useCreateTrainingGoal,
  useDeleteTrainingGoal,
  useUpdateTrainingGoal,
} from '@/domains/admin/hooks/useAdminTrainingGoals';
import { Button } from '@/shared/components/ui/button';

const GOAL_TYPES: GoalType[] = ['speed', 'knowledge', 'vocabulary', 'feel'];

interface Draft {
  type: GoalType;
  title: string;
  description: string;
  targetTempo: number;
  /** BPM step between rep levels (L1=today−notch … L3=today+notch). */
  tempoNotch: number;
  instruction: string;
}

const EMPTY_DRAFT: Draft = {
  type: 'speed',
  title: '',
  description: '',
  targetTempo: 120,
  tempoNotch: 8,
  instruction: 'Play the {item} at {tempo} BPM. Keep it even and relaxed.',
};

/** Assemble a CreateGoalInput from the simple draft (the SPEED-task shape). */
function draftToInput(d: Draft): CreateGoalInput {
  const focalId = `${slugify(d.title) || 'goal'}-focal`;
  return {
    type: d.type,
    title: d.title.trim(),
    description: d.description.trim() || null,
    target: { tempoBpm: d.targetTempo, tempoNotchBpm: d.tempoNotch },
    assessmentConfig: {},
    blockSet: [
      {
        blockId: focalId,
        ladderPosition: 'L2',
        // Embed the full task block inline — the shape the engine resolves
        // (no audio / library dependency, works everywhere).
        block: {
          id: focalId,
          type: 'task',
          title: d.title.trim(),
          order: 0,
          tempoRange: { min: 50, max: 180 },
          config: {
            heading: d.title.trim(),
            // The engine interpolates {tempo} per ladder level at plan time.
            instruction: d.instruction.trim(),
            completionCriterion: { type: 'time', target: 2 },
          },
        },
      },
    ] as CreateGoalInput['blockSet'],
    prerequisites: [],
    day30Milestone: {},
    forkConfig: {},
    isActive: true,
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export default function AdminTrainingGoalsPage() {
  const { data: goals, isLoading } = useAdminTrainingGoals();
  const createGoal = useCreateTrainingGoal();
  const updateGoal = useUpdateTrainingGoal();
  const deleteGoal = useDeleteTrainingGoal();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const canSave = draft.title.trim().length > 0 && draft.instruction.trim();

  const handleCreate = async () => {
    setError(null);
    try {
      await createGoal.mutateAsync(draftToInput(draft));
      setDraft(EMPTY_DRAFT);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create goal');
    }
  };

  const handleToggleActive = async (g: Goal) => {
    setError(null);
    try {
      await updateGoal.mutateAsync({
        id: g.id,
        patch: { isActive: !g.isActive },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update goal');
    }
  };

  const handleDelete = async (g: Goal) => {
    if (!confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteGoal.mutateAsync(g.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete goal');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 text-gray-900">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-gray-900">Training Goals</h1>
        <p className="text-sm text-gray-500">
          Author the goals the Bass Gym plans daily reps from. Editing a goal
          only affects NEW enrollments — in-flight climbs keep their snapshot.
        </p>
      </header>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* ── New goal ─────────────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#B97216]">
          New goal
        </h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            Type
            <select
              value={draft.type}
              onChange={(e) => set('type', e.target.value as GoalType)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            >
              {GOAL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            Target tempo (BPM)
            <input
              type="number"
              value={draft.targetTempo}
              onChange={(e) => set('targetTempo', Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
          </label>
          <label className="block space-y-1 text-xs font-medium text-gray-600">
            Tempo step between levels (BPM)
            <input
              type="number"
              min={1}
              max={30}
              value={draft.tempoNotch}
              onChange={(e) => set('tempoNotch', Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
            />
            <span className="block text-[10px] font-normal text-gray-400">
              The daily bracket: L1 = today −{draft.tempoNotch || 0}, L3 = today
              +{draft.tempoNotch || 0} BPM (spread {(draft.tempoNotch || 0) * 2}).
            </span>
          </label>
        </div>

        <label className="block space-y-1 text-xs font-medium text-gray-600">
          Title
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Speed: C Major Scale"
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400"
          />
        </label>

        <label className="block space-y-1 text-xs font-medium text-gray-600">
          Description
          <textarea
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        <label className="block space-y-1 text-xs font-medium text-gray-600">
          Focal task instruction (use {'{tempo}'} — the engine fills the
          per-level BPM)
          <textarea
            value={draft.instruction}
            onChange={(e) => set('instruction', e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900"
          />
        </label>

        {draft.type !== 'speed' && (
          <p className="text-xs text-amber-700">
            Note: only SPEED goals plan a rep today. Other types are authored
            but not yet playable (engine support lands later).
          </p>
        )}

        <Button
          onClick={handleCreate}
          disabled={!canSave || createGoal.isPending}
          className="bg-[#E8A44A] text-black hover:bg-[#E8A44A]/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          {createGoal.isPending ? 'Creating…' : 'Create goal'}
        </Button>
      </section>

      {/* ── Existing goals ───────────────────────────────────────────────── */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
          Goals
        </h2>
        {isLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : !goals || goals.length === 0 ? (
          <p className="text-sm text-gray-400">No goals yet.</p>
        ) : (
          <ul className="space-y-2">
            {goals.map((g) => (
              <li
                key={g.id}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {g.title} <span className="text-gray-300">·</span>{' '}
                    <span className="text-gray-500">{g.type}</span>
                    {!g.isActive && (
                      <span className="ml-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                        inactive
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {g.slug}
                    {typeof g.target?.tempoBpm === 'number' &&
                      ` · target ${g.target.tempoBpm} BPM`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => handleToggleActive(g)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {g.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(g)}
                    className="rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Delete goal"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
