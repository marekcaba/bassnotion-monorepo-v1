'use client';

/**
 * CollectionEditor — the expandable edit panel for one DB-driven sidebar folder
 * on the admin collections page. Edit the folder's fields (title, description,
 * access tier, sort order, active) and assign/unassign tutorials.
 *
 * Assigning a tutorial here is PURELY organizational — it groups the tutorial
 * into this folder. It does NOT change the tutorial's access tier (unlike
 * bundling content into a pack). Plain-useState house style.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  useAdminCollection,
  useUpdateCollection,
  useAssignTutorial,
  useUnassignTutorial,
} from '@/domains/admin/hooks/useAdminCollections';
import { CollectionAccessTier } from '@/domains/admin/api/collections.api';
import { fetchTutorials } from '@/domains/widgets/api/tutorials';

const TIERS: { value: CollectionAccessTier; label: string }[] = [
  { value: 'free', label: 'Free (everyone)' },
  { value: 'member', label: 'Member (subscribers)' },
  { value: 'product', label: 'Product (paid folder)' },
];

export function CollectionEditor({ collectionId }: { collectionId: string }) {
  const { data, isLoading } = useAdminCollection(collectionId);
  const updateCollection = useUpdateCollection();
  const assignTutorial = useAssignTutorial();
  const unassignTutorial = useUnassignTutorial();

  // Tutorial source for the assignment picker (same list the sidebar uses).
  const { data: tutorialData } = useQuery({
    queryKey: ['admin-tutorials-list'],
    queryFn: fetchTutorials,
    staleTime: 1000 * 60 * 5,
  });
  const tutorials = tutorialData?.tutorials ?? [];

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [accessTier, setAccessTier] = useState<CollectionAccessTier>('free');
  const [sortOrder, setSortOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  // Tutorial-to-add picker state
  const [tutorialToAdd, setTutorialToAdd] = useState('');

  useEffect(() => {
    if (data?.collection) {
      setTitle(data.collection.title);
      setDescription(data.collection.description ?? '');
      setAccessTier(data.collection.accessTier);
      setSortOrder(data.collection.sortOrder);
      setIsActive(data.collection.isActive);
    }
  }, [data?.collection]);

  if (isLoading || !data) {
    return (
      <div className="border-t px-4 py-3 text-sm text-gray-500">Loading…</div>
    );
  }

  const { tutorials: assignments } = data;
  const assignedIds = new Set(assignments.map((a) => a.tutorialId));

  // Resolve a tutorial's display name; fall back to a short id for ones not in
  // the loaded list (e.g. an inactive/gated tutorial the picker doesn't show).
  const tutorialName = (id: string): string =>
    tutorials.find((t) => t.id === id)?.title ?? id.slice(0, 8);

  // Options for the picker, excluding already-assigned tutorials.
  const addOptions = tutorials
    .filter((t) => !assignedIds.has(t.id))
    .map((t) => ({ id: t.id, label: `${t.title} — ${t.artist}` }));

  const saveFields = async () => {
    setMsg(null);
    try {
      await updateCollection.mutateAsync({
        id: collectionId,
        patch: {
          title: title.trim(),
          description: description.trim() || undefined,
          accessTier,
          sortOrder,
          isActive,
        },
      });
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleAssign = async () => {
    if (!tutorialToAdd) return;
    setMsg(null);
    try {
      await assignTutorial.mutateAsync({
        collectionId,
        input: { tutorialId: tutorialToAdd, sortOrder: assignments.length },
      });
      setTutorialToAdd('');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to assign tutorial');
    }
  };

  return (
    <div className="space-y-4 border-t bg-gray-50 px-4 py-4 text-sm">
      {/* Folder fields */}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-gray-500">
          Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Access tier
          <select
            value={accessTier}
            onChange={(e) =>
              setAccessTier(e.target.value as CollectionAccessTier)
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
      </div>

      <label className="block space-y-1 text-xs text-gray-500">
        Description
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short folder description"
          className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="flex items-center gap-4">
        <label className="space-y-1 text-xs text-gray-500">
          Sort order
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-24 rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="mt-4 flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (visible in sidebar)
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveFields}
          disabled={updateCollection.isPending || !title.trim()}
          className="rounded-md bg-[#E8A44A] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {updateCollection.isPending ? 'Saving…' : 'Save fields'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* Assigned tutorials */}
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          Tutorials in this folder ({assignments.length})
        </h3>
        <p className="text-[11px] text-gray-400">
          Organizational only — assigning a tutorial does not change its access
          tier. A tutorial can live in several folders.
        </p>
        {assignments.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between rounded border bg-white px-3 py-2"
          >
            <span>{tutorialName(a.tutorialId)}</span>
            <button
              type="button"
              onClick={() =>
                unassignTutorial.mutate({
                  assignmentId: a.id,
                  collectionId,
                })
              }
              className="text-xs text-red-500 hover:underline"
            >
              remove
            </button>
          </div>
        ))}

        {/* Assign a tutorial */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={tutorialToAdd}
            onChange={(e) => setTutorialToAdd(e.target.value)}
            className="flex-1 rounded-md border px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">Select a tutorial to add…</option>
            {addOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleAssign}
            disabled={!tutorialToAdd || assignTutorial.isPending}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
