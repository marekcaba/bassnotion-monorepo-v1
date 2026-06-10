'use client';

/**
 * Admin Groove Library — /admin/grooves.
 *
 * Create reusable groove cards ONCE (stems + default bpm/key + length); drills
 * then reference them by id and override key/tempo/role/timebox per use. Each
 * existing groove can be EDITED inline — including its chord chart (the sparse
 * harmony shown to players as they play along).
 */

import { useState } from 'react';
import type {
  CreateGrooveInput,
  GrooveCardStemSet,
  GrooveLibraryItem,
} from '@bassnotion/contracts';

import {
  useGrooveLibrary,
  useCreateGroove,
  useUpdateGroove,
} from '@/domains/drill/hooks/useGrooveLibrary';
import { StemUploadButton } from '@/domains/admin/components/BlockEditor/configs/groove-card/StemUploadButton';
import { ChordChartEditor } from '@/domains/admin/components/BlockEditor/configs/groove-card/ChordChartEditor';
import { BasslineVariantsEditor } from '@/domains/admin/components/BlockEditor/configs/groove-card/BasslineVariantsEditor';

const STEM_SLOTS = ['bass', 'drums', 'harmony'] as const;

const EMPTY_DRAFT: CreateGrooveInput = {
  name: '',
  subtitle: '',
  originalBpm: 100,
  originalKey: 'E',
  lengthBars: 4,
  stems: { bass: '', drums: '', harmony: '' },
  chordChart: [],
  genre: '',
};

export default function AdminGroovesPage() {
  const { data, isLoading } = useGrooveLibrary(true);
  const createGroove = useCreateGroove();
  const [draft, setDraft] = useState<CreateGrooveInput>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grooves = data?.grooves ?? [];

  const set = <K extends keyof CreateGrooveInput>(
    k: K,
    v: CreateGrooveInput[K],
  ) => setDraft((d) => ({ ...d, [k]: v }));

  const setStem = (stem: keyof GrooveCardStemSet, url: string) =>
    setDraft((d) => ({ ...d, stems: { ...d.stems, [stem]: url } }));

  const canSave =
    draft.name.trim().length > 0 &&
    draft.stems.bass &&
    draft.stems.drums &&
    draft.stems.harmony;

  const handleCreate = async () => {
    setError(null);
    try {
      await createGroove.mutateAsync(draft);
      setDraft(EMPTY_DRAFT);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create groove');
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6 text-gray-900">
      <header>
        <h1 className="font-serif text-2xl">Groove Library</h1>
        <p className="mt-1 text-sm text-gray-600">
          Create a groove once; reference it from any drill and override
          key/tempo/role/timebox per use.
        </p>
      </header>

      {/* Create */}
      <section className="space-y-3 rounded-lg border border-gray-300 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          New groove
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Name (e.g. Greasy Pocket)"
            className="rounded-md border border-gray-300 bg-white px-3 py-2"
          />
          <input
            value={draft.subtitle ?? ''}
            onChange={(e) => set('subtitle', e.target.value)}
            placeholder="Subtitle (e.g. Funk in E)"
            className="rounded-md border border-gray-300 bg-white px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-xs text-gray-500">
            BPM
            <input
              type="number"
              min={50}
              max={180}
              value={draft.originalBpm}
              onChange={(e) => set('originalBpm', Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            Key
            <input
              value={draft.originalKey}
              onChange={(e) => set('originalKey', e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            Length (bars)
            <input
              type="number"
              min={1}
              value={draft.lengthBars}
              onChange={(e) => set('lengthBars', Number(e.target.value))}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {STEM_SLOTS.map((stem) => (
            <StemUploadButton
              key={stem}
              value={draft.stems[stem]}
              onChange={(url) => setStem(stem, url)}
              stemLabel={stem}
              uploadContext={{
                tutorialSlug: 'library',
                keyFolder: draft.originalKey.trim() || 'default',
                stem,
              }}
            />
          ))}
        </div>
        <input
          value={draft.genre ?? ''}
          onChange={(e) => set('genre', e.target.value)}
          placeholder="Genre (optional)"
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2"
        />
        {/* Chord chart for the new groove. */}
        <ChordChartEditor
          lengthBars={draft.lengthBars}
          value={draft.chordChart}
          onChange={(chart) => set('chordChart', chart)}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button
          type="button"
          disabled={!canSave || createGroove.isPending}
          onClick={handleCreate}
          className="rounded-md bg-[#E8A44A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {createGroove.isPending ? 'Saving…' : 'Create groove'}
        </button>
      </section>

      {/* List + inline edit */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Library ({grooves.length})
        </h2>
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {grooves.map((g) =>
          editingId === g.id ? (
            <GrooveEditRow
              key={g.id}
              groove={g}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-md border border-gray-300 bg-white px-4 py-3"
            >
              <div>
                <div className="font-medium">{g.name}</div>
                <div className="text-xs text-gray-500">
                  {g.subtitle} · {g.originalKey} · {g.originalBpm} BPM ·{' '}
                  {g.lengthBars} bars
                  {g.chordChart && g.chordChart.length > 0
                    ? ` · ${g.chordChart.length} chords`
                    : ''}
                  {g.isActive ? '' : ' · inactive'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingId(g.id)}
                className="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium hover:bg-gray-200"
              >
                Edit
              </button>
            </div>
          ),
        )}
        {!isLoading && grooves.length === 0 && (
          <p className="text-sm text-gray-400">
            No grooves yet — create your first above.
          </p>
        )}
      </section>
    </div>
  );
}

/**
 * Inline edit form for an existing groove. Pre-fills from the library entity,
 * exposes the same fields + the chord chart, and PATCHes on save.
 */
function GrooveEditRow({
  groove,
  onClose,
}: {
  groove: GrooveLibraryItem;
  onClose: () => void;
}) {
  const updateGroove = useUpdateGroove();
  const [draft, setDraft] = useState<GrooveLibraryItem>(groove);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof GrooveLibraryItem>(
    k: K,
    v: GrooveLibraryItem[K],
  ) => setDraft((d) => ({ ...d, [k]: v }));
  const setStem = (stem: keyof GrooveCardStemSet, url: string) =>
    setDraft((d) => ({ ...d, stems: { ...d.stems, [stem]: url } }));

  const handleSave = async () => {
    setError(null);
    try {
      await updateGroove.mutateAsync({
        id: groove.id,
        input: {
          name: draft.name,
          subtitle: draft.subtitle,
          originalBpm: draft.originalBpm,
          originalKey: draft.originalKey,
          lengthBars: draft.lengthBars,
          stems: draft.stems,
          chordChart: draft.chordChart ?? [],
          genre: draft.genre,
          isActive: draft.isActive,
        },
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save groove');
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{draft.name || 'Edit groove'}</h3>
        <code className="text-[10px] text-gray-400">
          {groove.id.slice(0, 8)}
        </code>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="Name"
          className="rounded-md border border-gray-300 bg-white px-3 py-2"
        />
        <input
          value={draft.subtitle ?? ''}
          onChange={(e) => set('subtitle', e.target.value)}
          placeholder="Subtitle"
          className="rounded-md border border-gray-300 bg-white px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 text-xs text-gray-500">
          BPM
          <input
            type="number"
            min={50}
            max={180}
            value={draft.originalBpm}
            onChange={(e) => set('originalBpm', Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Key
          <input
            value={draft.originalKey}
            onChange={(e) => set('originalKey', e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Length (bars)
          <input
            type="number"
            min={1}
            value={draft.lengthBars}
            onChange={(e) => set('lengthBars', Number(e.target.value))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
          />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {STEM_SLOTS.map((stem) => (
          <StemUploadButton
            key={stem}
            value={draft.stems[stem]}
            onChange={(url) => setStem(stem, url)}
            stemLabel={stem}
            uploadContext={{
              tutorialSlug: 'library',
              keyFolder: draft.originalKey.trim() || 'default',
              stem,
            }}
          />
        ))}
      </div>

      {/* The chord chart for THIS groove. */}
      <ChordChartEditor
        lengthBars={draft.lengthBars}
        value={draft.chordChart}
        onChange={(chart) => set('chordChart', chart)}
      />

      {/* Premium alternate basslines (Lines & Fills). */}
      <BasslineVariantsEditor
        variants={draft.stems.bassVariants ?? []}
        defaultBassUrl={draft.stems.bass}
        slug={draft.slug}
        onChange={(bassVariants) =>
          set('stems', { ...draft.stems, bassVariants })
        }
      />

      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={updateGroove.isPending}
          onClick={handleSave}
          className="rounded-md bg-[#E8A44A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {updateGroove.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
