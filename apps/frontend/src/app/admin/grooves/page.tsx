'use client';

/**
 * Admin Groove Library — /admin/grooves.
 *
 * Create reusable groove cards ONCE (stems + default bpm/key + length); drills
 * then reference them by id and override key/tempo/role/timebox per use. Mirrors
 * the admin tutorials list posture (list + create), kept simple since a groove
 * is a flat entity.
 */

import { useState } from 'react';
import type {
  CreateGrooveInput,
  GrooveCardStemSet,
} from '@bassnotion/contracts';

import {
  useGrooveLibrary,
  useCreateGroove,
} from '@/domains/drill/hooks/useGrooveLibrary';
import { StemUploadButton } from '@/domains/admin/components/BlockEditor/configs/groove-card/StemUploadButton';

const STEM_SLOTS = ['bass', 'drums', 'harmony'] as const;

const EMPTY_DRAFT: CreateGrooveInput = {
  name: '',
  subtitle: '',
  originalBpm: 100,
  originalKey: 'E',
  lengthBars: 4,
  stems: { bass: '', drums: '', harmony: '' },
  genre: '',
};

export default function AdminGroovesPage() {
  const { data, isLoading } = useGrooveLibrary(true);
  const createGroove = useCreateGroove();
  const [draft, setDraft] = useState<CreateGrooveInput>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);

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
    <div className="mx-auto max-w-3xl space-y-8 p-6 text-white">
      <header>
        <h1 className="font-serif text-2xl">Groove Library</h1>
        <p className="mt-1 text-sm text-white/60">
          Create a groove once; reference it from any drill and override
          key/tempo/role/timebox per use.
        </p>
      </header>

      {/* Create */}
      <section className="space-y-3 rounded-lg border border-white/10 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
          New groove
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Name (e.g. Greasy Pocket)"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
          />
          <input
            value={draft.subtitle ?? ''}
            onChange={(e) => set('subtitle', e.target.value)}
            placeholder="Subtitle (e.g. Funk in E)"
            className="rounded-md border border-white/10 bg-white/5 px-3 py-2"
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-xs text-white/50">
            BPM
            <input
              type="number"
              min={50}
              max={180}
              value={draft.originalBpm}
              onChange={(e) => set('originalBpm', Number(e.target.value))}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-1 text-xs text-white/50">
            Key
            <input
              value={draft.originalKey}
              onChange={(e) => set('originalKey', e.target.value)}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
            />
          </label>
          <label className="space-y-1 text-xs text-white/50">
            Length (bars)
            <input
              type="number"
              min={1}
              value={draft.lengthBars}
              onChange={(e) => set('lengthBars', Number(e.target.value))}
              className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
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
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2"
        />
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="button"
          disabled={!canSave || createGroove.isPending}
          onClick={handleCreate}
          className="rounded-md bg-[#E8A44A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {createGroove.isPending ? 'Saving…' : 'Create groove'}
        </button>
      </section>

      {/* List */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
          Library ({grooves.length})
        </h2>
        {isLoading && <p className="text-sm text-white/50">Loading…</p>}
        {grooves.map((g) => (
          <div
            key={g.id}
            className="flex items-center justify-between rounded-md border border-white/10 bg-white/5 px-4 py-3"
          >
            <div>
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-white/50">
                {g.subtitle} · {g.originalKey} · {g.originalBpm} BPM ·{' '}
                {g.lengthBars} bars{g.isActive ? '' : ' · inactive'}
              </div>
            </div>
            <code className="text-[10px] text-white/30">
              {g.id.slice(0, 8)}
            </code>
          </div>
        ))}
        {!isLoading && grooves.length === 0 && (
          <p className="text-sm text-white/40">
            No grooves yet — create your first above.
          </p>
        )}
      </section>
    </div>
  );
}
