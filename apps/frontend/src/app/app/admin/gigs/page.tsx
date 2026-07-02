'use client';

/**
 * Admin Gigs — /admin/gigs. The GIG BUILDER + management list.
 *
 * A gig is a goal's DELIVERABLE: the admin authors "submit a recording of X by day N of the
 * cycle", and every student enrolled in that GOAL inherits it. Gigs surface in the student's
 * backstage and route them to /gigs to perform the action. For now the only gig type is a
 * RECORDING submission (play a gym exercise → graded take → submit audio).
 *
 * The builder: pick the GOAL, pick the gym EXERCISE to record (from the scales library), set the
 * CYCLE DAY (day-offset into the 30-day billing cycle, relative to each student's own start), and a
 * title + optional key/tempo. Save → POST /admin/gigs.
 *
 * Below the builder: the LIST of authored gigs (mirrors the scales exercise list), each row with
 * Edit (loads it back into the form) and Delete.
 */

import React from 'react';
import type {
  AdminGoalSummary,
  Gig,
  GymExercise,
} from '@bassnotion/contracts';
import { adminTrainingGoalsApi } from '@/domains/admin/api/training-goals.api';
import { useAdminGymExercises } from '@/domains/admin/hooks/useAdminGymExercises';
import {
  createGig,
  updateGig,
  deleteGig,
  fetchAdminGigs,
} from '@/domains/training-engine/api/training-engine.api';

/** The 12 keys, ASCII-spelled to MATCH the gym tool's byKey lookup (which normalizes glyphs to
 *  these). A free-text field would let a typo silently mismatch — hence a fixed picker. Shared
 *  with the scales path editor (the canonical PathKey list). */
import { SCALE_KEYS_ASCII as KEYS } from '@/app/app/admin/scales/pathKeys';

export default function AdminGigsPage() {
  const [goals, setGoals] = React.useState<AdminGoalSummary[]>([]);
  const { data: exercises = [] } = useAdminGymExercises({ equipment: 'scales' });

  // The authored gigs, for the management list.
  const [gigs, setGigs] = React.useState<Gig[]>([]);

  // Form state.
  const [goalId, setGoalId] = React.useState('');
  const [exerciseId, setExerciseId] = React.useState('');
  const [title, setTitle] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [cycleDay, setCycleDay] = React.useState(3);
  const [scaleKey, setScaleKey] = React.useState('');
  const [tempoBpm, setTempoBpm] = React.useState<number | ''>(90);
  // How many full loops the student's record-mode take captures before auto-stop (1-8). It's
  // the length of the deliverable — the student can't change it on the perform page.
  const [recordLoops, setRecordLoops] = React.useState(2);

  // When set, the form is EDITING this gig (rather than creating a new one).
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState<Gig | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    adminTrainingGoalsApi
      .list()
      .then(setGoals)
      .catch(() => setError('Could not load goals'));
    fetchAdminGigs()
      .then(setGigs)
      .catch(() => setError('Could not load gigs'));
  }, []);

  const selectedExercise = exercises.find(
    (e: GymExercise) => e.id === exerciseId,
  );

  // A recording gig locks the student to its presets, so they're all REQUIRED — a blank one
  // would leave the perform page with nothing to lock. Exercise + key + tempo are mandatory.
  const canSave =
    !!goalId &&
    !!title.trim() &&
    cycleDay >= 0 &&
    !!exerciseId &&
    !!scaleKey &&
    tempoBpm !== '';

  // Goal title lookup for the list rows.
  const goalTitle = React.useCallback(
    (id: string) => goals.find((g) => g.id === id)?.title ?? '(unknown goal)',
    [goals],
  );

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setInstructions('');
    setExerciseId('');
    setScaleKey('');
    setTempoBpm(90);
    setCycleDay(3);
    setRecordLoops(2);
  };

  /** Load a gig back into the form for editing. */
  const onEdit = (g: Gig) => {
    setEditingId(g.id);
    setGoalId(g.goalId);
    setTitle(g.title);
    setInstructions(g.instructions ?? '');
    setExerciseId(g.exerciseId ?? '');
    setScaleKey(g.scaleKey ?? '');
    setTempoBpm(typeof g.tempoBpm === 'number' ? g.tempoBpm : '');
    setCycleDay(g.cycleDay);
    setRecordLoops(g.recordLoops ?? 2);
    setSaved(null);
    setError(null);
    // Scroll the form into view (it's above the list).
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    setSaved(null);
    try {
      if (editingId) {
        // EDIT — goalId is not editable server-side (re-target = delete + recreate).
        const gig = await updateGig(editingId, {
          title: title.trim(),
          instructions: instructions.trim() || null,
          cycleDay,
          station: 'scales',
          exerciseId: exerciseId || null,
          exerciseName: selectedExercise?.name || null,
          scaleKey: scaleKey.trim() || null,
          // canSave guarantees tempoBpm is a number here (it's required + non-empty).
          tempoBpm: Number(tempoBpm),
          recordLoops,
        });
        setGigs((prev) => prev.map((g) => (g.id === gig.id ? gig : g)));
        setSaved(gig);
        resetForm();
      } else {
        // CREATE.
        const gig = await createGig({
          goalId,
          gigType: 'recording',
          title: title.trim(),
          instructions: instructions.trim() || undefined,
          cycleDay,
          station: 'scales',
          exerciseId: exerciseId || undefined,
          exerciseName: selectedExercise?.name || undefined,
          scaleKey: scaleKey.trim() || undefined,
          tempoBpm: Number(tempoBpm),
          recordLoops,
        });
        setGigs((prev) => [...prev, gig]);
        setSaved(gig);
        // Reset the title so the next gig is fresh (keep goal/cycle for batch authoring).
        setTitle('');
        setInstructions('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save gig');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (g: Gig) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete gig “${g.title}”? Submitted takes are kept.`)
    ) {
      return;
    }
    try {
      await deleteGig(g.id);
      setGigs((prev) => prev.filter((x) => x.id !== g.id));
      if (editingId === g.id) resetForm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete gig');
    }
  };

  // Group gigs by goal for the list, then sort by cycle day within a goal.
  const gigsByGoal = React.useMemo(() => {
    const map = new Map<string, Gig[]>();
    for (const g of gigs) {
      const arr = map.get(g.goalId) ?? [];
      arr.push(g);
      map.set(g.goalId, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => a.cycleDay - b.cycleDay);
    }
    return Array.from(map.entries());
  }, [gigs]);

  return (
    <div className="mx-auto max-w-2xl p-6">
      {/* Dark text — the admin page sits on a WHITE (bg-gray-50) background, so the headline
          must be dark (the form card below is dark, with its own light text). */}
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Gig builder</h1>
      <p className="mb-6 text-sm text-gray-600">
        Author a recording deliverable for a goal. Every student enrolled in the
        goal inherits it, due on day&nbsp;N of their billing cycle.
      </p>

      <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-900 p-5 text-gray-100">
        {editingId && (
          <div className="flex items-center justify-between rounded bg-blue-900/40 px-3 py-2 text-sm text-blue-200">
            <span>Editing an existing gig.</span>
            <button
              type="button"
              onClick={resetForm}
              className="rounded bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white hover:bg-blue-600"
            >
              Cancel edit → new gig
            </button>
          </div>
        )}

        {/* GOAL */}
        <Field label="Goal">
          <select
            value={goalId}
            onChange={(e) => setGoalId(e.target.value)}
            disabled={!!editingId}
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5 disabled:opacity-50"
          >
            <option value="">— pick a goal —</option>
            {goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title} ({g.enrollmentCount} enrolled)
              </option>
            ))}
          </select>
          {editingId && (
            <span className="mt-1 block text-xs text-gray-500">
              Goal can&apos;t be changed on edit — delete and recreate to move a
              gig to another goal.
            </span>
          )}
        </Field>

        {/* TITLE */}
        <Field label="Title (what the student sees)">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Submit Funky Groove — 90 BPM, in key"
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
          />
        </Field>

        {/* INSTRUCTIONS */}
        <Field label="Instructions (optional)">
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={2}
            placeholder="Play it twice through, clean and in time."
            className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          {/* EXERCISE — REQUIRED (it's the locked thing the student records). */}
          <Field label="Exercise to record *">
            <select
              value={exerciseId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
            >
              <option value="">— pick an exercise —</option>
              {exercises.map((ex: GymExercise) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name || ex.id}
                </option>
              ))}
            </select>
          </Field>

          {/* CYCLE DAY */}
          <Field label="Due — day of the cycle (0–31)">
            <input
              type="number"
              min={0}
              max={31}
              value={cycleDay}
              onChange={(e) => setCycleDay(Number(e.target.value))}
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* KEY — REQUIRED. A fixed picker, not free text (a typo'd "Bb"/"B♭"/"bb" would
              silently mismatch the ASCII PathKeys the gym tool reads). */}
          <Field label="Key *">
            <select
              value={scaleKey}
              onChange={(e) => setScaleKey(e.target.value)}
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
            >
              <option value="">— pick a key —</option>
              {KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>

          {/* TEMPO — REQUIRED (it's the locked tempo the student records at). */}
          <Field label="Tempo BPM *">
            <input
              type="number"
              min={40}
              max={220}
              value={tempoBpm}
              onChange={(e) =>
                setTempoBpm(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="90"
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* LOOP COUNT — how many full loops the take captures before auto-stop. The
              student can't change it; it's the length of the deliverable. */}
          <Field label="Record length (loops)">
            <select
              value={recordLoops}
              onChange={(e) => setRecordLoops(Number(e.target.value))}
              className="w-full rounded border border-gray-600 bg-gray-800 px-2 py-1.5"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n} {n === 1 ? 'loop' : 'loops'}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          type="button"
          disabled={!canSave || saving}
          onClick={onSave}
          className="w-full rounded bg-green-600 px-4 py-2 font-bold text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving
            ? 'Saving…'
            : editingId
              ? 'Save changes'
              : 'Create gig'}
        </button>

        {saved && (
          <div className="rounded bg-green-900/40 px-3 py-2 text-sm text-green-300">
            ✓ Saved “{saved.title}” for day {saved.cycleDay}. Enrolled students
            will see it in their gig list.
          </div>
        )}
        {error && (
          <div className="rounded bg-red-900/40 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      {/* ── The authored-gigs list, grouped by goal (mirrors the scales exercise list). ── */}
      <h2 className="mb-3 mt-8 text-lg font-bold text-gray-900">
        Authored gigs
      </h2>
      {gigs.length === 0 ? (
        <p className="text-sm text-gray-500">No gigs yet.</p>
      ) : (
        <div className="space-y-6">
          {gigsByGoal.map(([gid, list]) => (
            <div key={gid}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">
                {goalTitle(gid)}
              </h3>
              <ul className="space-y-2">
                {list.map((g) => (
                  <li
                    key={g.id}
                    className={`flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3 ${
                      editingId === g.id
                        ? 'border-blue-400 ring-1 ring-blue-300'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium text-gray-900">
                          {g.title}
                        </span>
                        {!g.isActive && (
                          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                            disabled
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        Day {g.cycleDay}
                        {g.exerciseName ? ` · ${g.exerciseName}` : ''}
                        {g.scaleKey ? ` · ${g.scaleKey}` : ''}
                        {g.tempoBpm ? ` · ${g.tempoBpm} BPM` : ''}
                        {g.recordLoops
                          ? ` · ${g.recordLoops} ${g.recordLoops === 1 ? 'loop' : 'loops'}`
                          : ''}
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => onEdit(g)}
                        className="rounded border border-gray-300 px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDelete(g)}
                        className="rounded border border-red-300 px-3 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
