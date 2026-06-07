'use client';

/**
 * Admin Folders — /admin/folders.
 *
 * Manage the DB-driven Bassment sidebar folders without SQL: create a folder,
 * set its access tier + sort order, and assign tutorials to it. Replaces the
 * old hardcoded PRODUCT_FOLDERS array. Owned packs render as their own sidebar
 * folders automatically (from product_contents) and are NOT managed here.
 *
 * Mirrors the admin products page house style (plain useState form + list,
 * amber accent).
 */

import { useState } from 'react';

import {
  useAdminCollections,
  useCreateCollection,
  useDeleteCollection,
} from '@/domains/admin/hooks/useAdminCollections';
import {
  CollectionAccessTier,
  CreateCollectionPayload,
} from '@/domains/admin/api/collections.api';
import { CollectionEditor } from '@/domains/admin/components/CollectionEditor';

// Free or member only — paid packs become their own folders automatically
// (managed on the Products page), so 'product' isn't a folder tier here.
const TIERS: { value: CollectionAccessTier; label: string }[] = [
  { value: 'free', label: 'Free (everyone)' },
  { value: 'member', label: 'Member (subscribers)' },
];

const EMPTY_DRAFT: CreateCollectionPayload = {
  slug: '',
  title: '',
  description: '',
  accessTier: 'free',
  sortOrder: 0,
  isActive: true,
};

export default function AdminCollectionsPage() {
  const { data: collections, isLoading } = useAdminCollections();
  const createCollection = useCreateCollection();
  const deleteCollection = useDeleteCollection();
  const [draft, setDraft] = useState<CreateCollectionPayload>(EMPTY_DRAFT);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const set = <K extends keyof CreateCollectionPayload>(
    k: K,
    v: CreateCollectionPayload[K],
  ) => setDraft((d) => ({ ...d, [k]: v }));

  const canSave = draft.slug.trim() && draft.title.trim();

  const handleCreate = async () => {
    setError(null);
    try {
      await createCollection.mutateAsync(draft);
      setDraft(EMPTY_DRAFT);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create collection');
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (
      !window.confirm(
        `Delete folder "${title}"? Its tutorial assignments are removed (the tutorials themselves are untouched).`,
      )
    ) {
      return;
    }
    try {
      await deleteCollection.mutateAsync(id);
      if (expandedId === id) setExpandedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete collection');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Sidebar Folders</h1>
        <p className="mt-1 text-sm text-gray-600">
          The DB-driven Bassment sidebar folders. Create a folder, set its
          access tier, and assign tutorials to it. Owned packs appear as their
          own folders automatically — manage those on the Products page.
        </p>
      </header>

      {/* Create */}
      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          New folder
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="Title (e.g. Starter Kit)"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            value={draft.slug}
            onChange={(e) =>
              set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))
            }
            placeholder="slug (e.g. starter-kit)"
            className="rounded-md border px-3 py-2 font-mono text-sm"
          />
        </div>
        <input
          value={draft.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Description (one line)"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs text-gray-500">
            Access tier
            <select
              value={draft.accessTier}
              onChange={(e) =>
                set('accessTier', e.target.value as CollectionAccessTier)
              }
              className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
            >
              {TIERS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs text-gray-500">
            Sort order
            <input
              type="number"
              value={draft.sortOrder}
              onChange={(e) => set('sortOrder', Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
            />
          </label>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          disabled={!canSave || createCollection.isPending}
          onClick={handleCreate}
          className="rounded-md bg-[#E8A44A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {createCollection.isPending ? 'Saving…' : 'Create folder'}
        </button>
      </section>

      {/* List */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Folders ({collections?.length ?? 0})
        </h2>
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {(collections ?? []).map((c) => (
          <div key={c.id} className="rounded-md border bg-white shadow-sm">
            <div className="flex w-full items-center justify-between px-4 py-3">
              <button
                type="button"
                onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                className="flex-1 text-left"
              >
                <div className="font-medium">
                  {c.title}
                  <span className="ml-2 rounded bg-[#E8A44A]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#9a6a1f]">
                    {c.accessTier}
                  </span>
                  {!c.isActive && (
                    <span className="ml-2 text-xs text-gray-400">inactive</span>
                  )}
                </div>
                <div className="font-mono text-xs text-gray-500">
                  {c.slug} · order {c.sortOrder}
                </div>
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleDelete(c.id, c.title)}
                  className="text-xs text-red-500 hover:underline"
                >
                  delete
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId(expandedId === c.id ? null : c.id)
                  }
                  className="text-gray-400"
                >
                  {expandedId === c.id ? '▲' : '▼'}
                </button>
              </div>
            </div>
            {expandedId === c.id && <CollectionEditor collectionId={c.id} />}
          </div>
        ))}
        {!isLoading && (collections?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-400">
            No folders yet — create your first above.
          </p>
        )}
      </section>
    </div>
  );
}
