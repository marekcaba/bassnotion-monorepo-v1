'use client';

/**
 * Admin Training Goals — /admin/training-goals.
 *
 * Author + manage the goals the Bass Gym engine plans from, no seed SQL.
 * Lifecycle: CREATE / EDIT (pre-filled, edits hit NEW enrollments only —
 * in-flight climbs keep their frozen snapshot) / ACTIVATE-DEACTIVATE (hide from
 * new enrollments) / ARCHIVE (soft-delete: off the list + not enrollable,
 * reversible) / DELETE (guarded; force-delete behind a typed-title confirm for
 * test goals). Single-focal SPEED goals (one inline task block) and content-
 * ladder goals (~3 topics × stages) are both authored here.
 */

import { useState } from 'react';
import { Plus, Trash2, Archive, Pencil, X } from 'lucide-react';
import type {
  Goal,
  AdminGoalSummary,
  GoalType,
  CreateGoalInput,
  Topic,
} from '@bassnotion/contracts';

import {
  useAdminTrainingGoals,
  useCreateTrainingGoal,
  useDeleteTrainingGoal,
  useUpdateTrainingGoal,
  useArchiveTrainingGoal,
} from '@/domains/admin/hooks/useAdminTrainingGoals';
import { TopicStageEditor } from '@/domains/admin/components/TopicStageEditor';
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
  /** Content-ladder: when true the goal is MULTI-TOPIC (ships `topics`); else
   *  the single-focal SPEED shape (one inline task block). */
  multiTopic: boolean;
  topics: Topic[];
}

const EMPTY_DRAFT: Draft = {
  type: 'speed',
  title: '',
  description: '',
  targetTempo: 120,
  tempoNotch: 8,
  instruction: 'Play the {item} at {tempo} BPM. Keep it even and relaxed.',
  multiTopic: false,
  topics: [],
};

/** Hydrate the form from an existing goal (the EDIT path). Detects multi-topic
 *  from `topics`; pulls the focal instruction back out of the single task block. */
function goalToDraft(g: Goal): Draft {
  const multiTopic = !!g.topics && g.topics.length > 0;
  const focalInstruction =
    (g.blockSet?.[0]?.block?.config as { instruction?: string } | undefined)
      ?.instruction ?? EMPTY_DRAFT.instruction;
  return {
    type: g.type,
    title: g.title,
    description: g.description ?? '',
    targetTempo:
      typeof g.target?.tempoBpm === 'number' ? g.target.tempoBpm : 120,
    tempoNotch:
      typeof g.target?.tempoNotchBpm === 'number' ? g.target.tempoNotchBpm : 8,
    instruction: focalInstruction,
    multiTopic,
    topics: multiTopic ? (g.topics ?? []) : [],
  };
}

/** Assemble a CreateGoalInput from the draft (also the UpdateGoalInput shape).
 *  Two mutually-exclusive content shapes: multi-topic `topics`, or the single
 *  focal task `blockSet`. */
function draftToInput(d: Draft): CreateGoalInput {
  const base = {
    type: d.type,
    title: d.title.trim(),
    description: d.description.trim() || null,
    target: { tempoBpm: d.targetTempo, tempoNotchBpm: d.tempoNotch },
    assessmentConfig: {},
    prerequisites: [],
    day30Milestone: {},
    forkConfig: {},
    isActive: true,
  } satisfies Partial<CreateGoalInput>;

  if (d.multiTopic) {
    // Multi-topic: ship topics, and clear blockSet so a goal switched FROM
    // single-focal doesn't keep a stale focal block.
    return { ...base, topics: d.topics, blockSet: [] };
  }

  const focalId = `${slugify(d.title) || 'goal'}-focal`;
  return {
    ...base,
    topics: [], // clear topics if switched away from multi-topic
    blockSet: [
      {
        blockId: focalId,
        ladderPosition: 'L2',
        block: {
          id: focalId,
          type: 'task',
          title: d.title.trim(),
          order: 0,
          tempoRange: { min: 50, max: 180 },
          config: {
            heading: d.title.trim(),
            instruction: d.instruction.trim(),
            completionCriterion: { type: 'time', target: 2 },
          },
        },
      },
    ] as CreateGoalInput['blockSet'],
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
  const archiveGoal = useArchiveTrainingGoal();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  // null = creating; a goal = editing that goal (form is pre-filled).
  const [editing, setEditing] = useState<AdminGoalSummary | null>(null);
  // Which topic/stage panels in the TopicStageEditor are open (parent-owned).
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const resetForm = () => {
    setDraft(EMPTY_DRAFT);
    setEditing(null);
    setExpanded(new Set());
  };

  const topicsValid =
    draft.topics.length > 0 &&
    draft.topics.every((t) => t.title.trim().length > 0 && t.repQuota > 0);
  const canSave =
    draft.title.trim().length > 0 &&
    (draft.multiTopic ? topicsValid : !!draft.instruction.trim());

  const startEdit = (g: AdminGoalSummary) => {
    setEditing(g);
    setDraft(goalToDraft(g));
    setExpanded(new Set());
    setError(null);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const handleSubmit = async () => {
    setError(null);
    try {
      if (editing) {
        await updateGoal.mutateAsync({ id: editing.id, patch: draftToInput(draft) });
      } else {
        await createGoal.mutateAsync(draftToInput(draft));
      }
      resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save goal');
    }
  };

  const handleToggleActive = async (g: Goal) => {
    setError(null);
    try {
      await updateGoal.mutateAsync({ id: g.id, patch: { isActive: !g.isActive } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update goal');
    }
  };

  const handleArchive = async (g: AdminGoalSummary) => {
    if (
      !confirm(
        `Archive "${g.title}"? It disappears from this list and can't be ` +
          'enrolled in. Existing climbs keep running. You can unarchive later.',
      )
    )
      return;
    setError(null);
    try {
      await archiveGoal.mutateAsync(g.id);
      if (editing?.id === g.id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive goal');
    }
  };

  const handleDelete = async (g: AdminGoalSummary) => {
    // No enrollments → a plain confirm is enough.
    if (g.enrollmentCount === 0) {
      if (!confirm(`Delete "${g.title}"? This cannot be undone.`)) return;
      setError(null);
      try {
        await deleteGoal.mutateAsync({ id: g.id });
        if (editing?.id === g.id) resetForm();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to delete goal');
      }
      return;
    }
    // Enrollments exist → force-delete behind a typed-title confirmation. This
    // CASCADES (destroys those enrollments' climbs + rep history) — for test
    // goals only; archive is the safe path for real ones.
    const typed = prompt(
      `"${g.title}" has ${g.enrollmentCount} enrollment(s). Deleting it will ` +
        `PERMANENTLY destroy their climbs + rep history (this is for test goals — ` +
        `use Archive for a real one).\n\nType the goal's title to confirm:`,
    );
    if (typed === null) return; // cancelled
    if (typed.trim() !== g.title.trim()) {
      setError('Title did not match — delete cancelled.');
      return;
    }
    setError(null);
    try {
      await deleteGoal.mutateAsync({ id: g.id, force: true });
      if (editing?.id === g.id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete goal');
    }
  };

  const saving = createGoal.isPending || updateGoal.isPending;

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

      {/* ── New / Edit goal ──────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#B97216]">
            {editing ? `Edit: ${editing.title}` : 'New goal'}
          </h2>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800"
            >
              <X className="h-3.5 w-3.5" />
              Cancel edit
            </button>
          )}
        </div>

        {/* Blast-radius banner — edits never touch in-flight climbs (frozen
            snapshot), but the admin should SEE how many students are on the
            current version before they change it. */}
        {editing && editing.enrollmentCount > 0 && (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {editing.enrollmentCount} student(s) are enrolled in the current
            version. Your changes apply to <strong>new enrollments only</strong>
            {' '}— their in-flight climbs keep the version they started.
          </p>
        )}

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

        {/* ── Goal structure: single-focal vs content-ladder ──────────────── */}
        <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/60 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Structure
            </span>
            <div className="flex rounded-md border border-gray-300 bg-white p-0.5 text-xs">
              <button
                type="button"
                onClick={() => set('multiTopic', false)}
                className={`rounded px-2.5 py-1 ${
                  !draft.multiTopic
                    ? 'bg-[#E8A44A] font-medium text-black'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Single focal task
              </button>
              <button
                type="button"
                onClick={() => set('multiTopic', true)}
                className={`rounded px-2.5 py-1 ${
                  draft.multiTopic
                    ? 'bg-[#E8A44A] font-medium text-black'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                Content ladder (topics)
              </button>
            </div>
          </div>

          {draft.multiTopic ? (
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400">
                Author ~3 topics, each with a rep quota and internal stages. The
                engine serves one topic per rep and counts toward its quota; the
                student sees a progress bar per topic, never the stages.
              </p>
              <TopicStageEditor
                value={draft.topics}
                onChange={(topics) => set('topics', topics)}
                expanded={expanded}
                onToggleExpanded={toggleExpanded}
              />
            </div>
          ) : (
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
          )}
        </div>

        {draft.type !== 'speed' && !draft.multiTopic && (
          <p className="text-xs text-amber-700">
            Note: a single-focal goal of a non-SPEED type isn’t playable yet.
            For KNOWLEDGE / VOCABULARY / FEEL goals, use a content ladder — the
            engine serves those through topics.
          </p>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!canSave || saving}
          className="bg-[#E8A44A] text-black hover:bg-[#E8A44A]/90"
        >
          <Plus className="mr-1 h-4 w-4" />
          {saving
            ? 'Saving…'
            : editing
              ? 'Save changes'
              : 'Create goal'}
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
                className={`flex items-center justify-between rounded-lg border bg-white px-4 py-3 shadow-sm ${
                  editing?.id === g.id
                    ? 'border-[#E8A44A] ring-1 ring-[#E8A44A]'
                    : 'border-gray-200'
                }`}
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
                    {g.enrollmentCount > 0 && (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] uppercase text-blue-600">
                        {g.enrollmentCount} enrolled
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {g.slug}
                    {g.topics && g.topics.length > 0
                      ? ` · ${g.topics.length} topics · ${g.topics.reduce(
                          (n, t) => n + (t.repQuota || 0),
                          0,
                        )} reps`
                      : typeof g.target?.tempoBpm === 'number' &&
                        ` · target ${g.target.tempoBpm} BPM`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => startEdit(g)}
                    className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                    aria-label="Edit goal"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggleActive(g)}
                    className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                  >
                    {g.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleArchive(g)}
                    className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-50"
                    aria-label="Archive goal"
                    title="Archive (reversible — keeps climbs)"
                  >
                    <Archive className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(g)}
                    className="rounded-md border border-red-300 p-1.5 text-red-600 hover:bg-red-50"
                    aria-label="Delete goal"
                    title={
                      g.enrollmentCount > 0
                        ? 'Force-delete (destroys enrollments — test goals only)'
                        : 'Delete'
                    }
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
