'use client';

/**
 * ProductEditor — the expandable edit panel for one store product on the admin
 * products page. Edit marketing fields + Stripe price, upload a cover, and
 * bundle CONTENT into the pack (tutorials primary, plus grooves / videos).
 * Adding content auto-gates it (backend flips its access_tier to 'product').
 * Plain-useState house style.
 */

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  useAdminProduct,
  useUpdateProduct,
  useAddProductContent,
  useRemoveProductContent,
  useDeleteProduct,
} from '@/domains/admin/hooks/useAdminProducts';
import {
  adminProductsApi,
  AdminContentType,
  type AdminProductType,
} from '@/domains/admin/api/products.api';
import { useGrooveLibrary } from '@/domains/drill/hooks/useGrooveLibrary';
import { fetchTutorials } from '@/domains/widgets/api/tutorials';

const CONTENT_TYPES: { value: AdminContentType; label: string }[] = [
  { value: 'tutorial', label: 'Tutorial' },
  { value: 'groove', label: 'Groove' },
  { value: 'video', label: 'Video' },
];

const PRODUCT_TYPES: AdminProductType[] = [
  'membership',
  'groove_pack',
  'accelerator',
  'course',
];

export function ProductEditor({
  productId,
  onDeleted,
}: {
  productId: string;
  /** Called after a successful hard-delete so the parent can collapse the
   *  (now-removed) editor panel. */
  onDeleted?: () => void;
}) {
  const { data, isLoading } = useAdminProduct(productId);
  const updateProduct = useUpdateProduct();
  const addContent = useAddProductContent();
  const removeContent = useRemoveProductContent();
  const deleteProduct = useDeleteProduct();

  // Two-step delete confirm: the button arms a typed-name confirmation so a
  // misclick can't nuke a product.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  // Pick-from sources
  const { data: grooveData } = useGrooveLibrary(false);
  const grooves = grooveData?.grooves ?? [];
  const { data: tutorialData } = useQuery({
    queryKey: ['admin-tutorials-list'],
    queryFn: fetchTutorials,
    staleTime: 1000 * 60 * 5,
  });
  const tutorials = tutorialData?.tutorials ?? [];

  // Core marketing/store fields.
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [type, setType] = useState<AdminProductType>('groove_pack');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [priceInCents, setPriceInCents] = useState(0);
  const [currency, setCurrency] = useState('usd');
  const [sortOrder, setSortOrder] = useState(0);
  const [featuresText, setFeaturesText] = useState('');

  const [stripePriceId, setStripePriceId] = useState('');
  const [badge, setBadge] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [previewGrooveId, setPreviewGrooveId] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Content-to-add picker state
  const [addType, setAddType] = useState<AdminContentType>('tutorial');
  const [contentToAdd, setContentToAdd] = useState('');
  const [unlockDay, setUnlockDay] = useState(0);

  useEffect(() => {
    if (data?.product) {
      const p = data.product;
      setName(p.name ?? '');
      setSlug(p.slug ?? '');
      setType(p.type);
      setTagline(p.tagline ?? '');
      setDescription(p.description ?? '');
      setPriceInCents(p.priceInCents ?? 0);
      setCurrency(p.currency ?? 'usd');
      setSortOrder(p.sortOrder ?? 0);
      setFeaturesText((p.features ?? []).join('\n'));
      setStripePriceId(p.stripePriceId ?? '');
      setBadge(p.badge ?? '');
      setIsActive(p.isActive);
      setPreviewGrooveId(p.previewGrooveId ?? '');
    }
  }, [data?.product]);

  if (isLoading || !data) {
    return (
      <div className="border-t px-4 py-3 text-sm text-gray-500">Loading…</div>
    );
  }

  const { product, contents } = data;
  const isAccelerator = product.type === 'accelerator';

  // Resolve a content row's display name from whichever source it came from.
  const contentName = (type: string, id: string): string => {
    if (type === 'tutorial')
      return tutorials.find((t) => t.id === id)?.title ?? id.slice(0, 8);
    if (type === 'groove')
      return grooves.find((g) => g.id === id)?.name ?? id.slice(0, 8);
    return id.slice(0, 8);
  };

  // Options for the currently-selected add type, excluding already-bundled ids.
  const addOptions = (() => {
    const bundledIds = new Set(contents.map((c) => c.contentId));
    if (addType === 'tutorial')
      return tutorials
        .filter((t) => !bundledIds.has(t.id))
        .map((t) => ({ id: t.id, label: `${t.title} — ${t.artist}` }));
    if (addType === 'groove')
      return grooves
        .filter((g) => !bundledIds.has(g.id))
        .map((g) => ({
          id: g.id,
          label: `${g.name} · ${g.originalKey} · ${g.originalBpm} BPM`,
        }));
    return []; // video: no central list yet — paste an id (handled below)
  })();

  const saveFields = async () => {
    setMsg(null);
    if (!name.trim() || !slug.trim()) {
      setMsg('Name and slug are required.');
      return;
    }
    const features = featuresText
      .split('\n')
      .map((f) => f.trim())
      .filter(Boolean);
    try {
      await updateProduct.mutateAsync({
        id: productId,
        patch: {
          name: name.trim(),
          slug: slug.trim(),
          type,
          tagline: tagline.trim() || undefined,
          description: description.trim() || undefined,
          priceInCents,
          currency: currency.trim() || undefined,
          sortOrder,
          features,
          stripePriceId: stripePriceId.trim() || undefined,
          badge: badge.trim() || undefined,
          isActive,
          previewGrooveId: previewGrooveId || undefined,
        },
      });
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleDelete = async () => {
    setMsg(null);
    try {
      await deleteProduct.mutateAsync(productId);
      // Row vanishes from the list (productKeys.all invalidated); tell the
      // parent to collapse this now-removed panel.
      onDeleted?.();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Delete failed');
      setConfirmingDelete(false);
    }
  };

  const handleCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverUploading(true);
    setMsg(null);
    try {
      await adminProductsApi.uploadCover(productId, file);
      setMsg('Cover uploaded.');
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Cover upload failed');
    } finally {
      setCoverUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleAddContent = async () => {
    if (!contentToAdd) return;
    setMsg(null);
    try {
      await addContent.mutateAsync({
        productId,
        input: {
          contentType: addType,
          contentId: contentToAdd.trim(),
          unlockDay,
          sortOrder: contents.length,
        },
      });
      setContentToAdd('');
      setUnlockDay(0);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to add content');
    }
  };

  return (
    <div className="space-y-4 border-t bg-gray-50 px-4 py-4 text-sm">
      {/* Core details — name / slug / type / pricing / copy. */}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-gray-500">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Funk Foundations"
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Slug
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="funk-foundations"
            className="w-full rounded-md border px-3 py-2 font-mono text-sm text-gray-900"
          />
        </label>
      </div>

      <label className="block space-y-1 text-xs text-gray-500">
        Tagline
        <input
          value={tagline}
          onChange={(e) => setTagline(e.target.value)}
          placeholder="Short marketing hook for the store card"
          className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <label className="block space-y-1 text-xs text-gray-500">
        Description
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
        />
      </label>

      <div className="grid grid-cols-4 gap-3">
        <label className="space-y-1 text-xs text-gray-500">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AdminProductType)}
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          >
            {PRODUCT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Price (cents)
          <input
            type="number"
            min={0}
            value={priceInCents}
            onChange={(e) => setPriceInCents(Number(e.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Currency
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="usd"
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Sort order
          <input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(Number(e.target.value))}
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
      </div>

      <label className="block space-y-1 text-xs text-gray-500">
        Features (one per line)
        <textarea
          value={featuresText}
          onChange={(e) => setFeaturesText(e.target.value)}
          placeholder={'12 funk grooves\nAll 12 keys\nLifetime access'}
          rows={3}
          className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
        />
      </label>

      {/* Stripe price + flags */}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1 text-xs text-gray-500">
          Stripe price ID
          <input
            value={stripePriceId}
            onChange={(e) => setStripePriceId(e.target.value)}
            placeholder="price_..."
            className="w-full rounded-md border px-3 py-2 font-mono text-sm text-gray-900"
          />
        </label>
        <label className="space-y-1 text-xs text-gray-500">
          Badge
          <input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            placeholder="Popular / New / Best value"
            className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Active (visible in store)
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-500">
          Preview groove
          <select
            value={previewGrooveId}
            onChange={(e) => setPreviewGrooveId(e.target.value)}
            className="rounded-md border px-2 py-1 text-sm text-gray-900"
          >
            <option value="">(none)</option>
            {grooves.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Cover upload */}
      <div className="flex items-center gap-3">
        {product.coverImageUrl ? (
          <img
            src={product.coverImageUrl}
            alt="cover"
            className="h-16 w-24 rounded object-cover"
          />
        ) : (
          <div className="flex h-16 w-24 items-center justify-center rounded bg-gray-200 text-[10px] text-gray-400">
            no cover
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={handleCover}
          disabled={coverUploading}
          className="text-xs"
        />
        {coverUploading && (
          <span className="text-xs text-gray-500">Uploading…</span>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={saveFields}
          disabled={updateProduct.isPending}
          className="rounded-md bg-[#E8A44A] px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
        >
          {updateProduct.isPending ? 'Saving…' : 'Save fields'}
        </button>
        {msg && <span className="text-xs text-gray-500">{msg}</span>}
      </div>

      {/* Bundled contents */}
      <div className="space-y-2 border-t pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
          In this pack ({contents.length})
        </h3>
        <p className="text-[11px] text-gray-400">
          Adding content locks it to this pack (only buyers can access it).
        </p>
        {contents.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded border bg-white px-3 py-2"
          >
            <span>
              <span className="mr-2 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase text-gray-500">
                {c.contentType}
              </span>
              {contentName(c.contentType, c.contentId)}
              {isAccelerator && (
                <span className="ml-2 text-xs text-gray-400">
                  day {c.unlockDay}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() =>
                removeContent.mutate({ contentRowId: c.id, productId })
              }
              className="text-xs text-red-500 hover:underline"
            >
              remove
            </button>
          </div>
        ))}

        {/* Add content */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <select
            value={addType}
            onChange={(e) => {
              setAddType(e.target.value as AdminContentType);
              setContentToAdd('');
            }}
            className="rounded-md border px-2 py-1.5 text-sm text-gray-900"
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>

          {addType === 'video' ? (
            <input
              value={contentToAdd}
              onChange={(e) => setContentToAdd(e.target.value)}
              placeholder="Bunny video id"
              className="flex-1 rounded-md border px-2 py-1.5 font-mono text-sm text-gray-900"
            />
          ) : (
            <select
              value={contentToAdd}
              onChange={(e) => setContentToAdd(e.target.value)}
              className="flex-1 rounded-md border px-2 py-1.5 text-sm text-gray-900"
            >
              <option value="">Select a {addType} to add…</option>
              {addOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {isAccelerator && (
            <label className="flex items-center gap-1 text-xs text-gray-500">
              day
              <input
                type="number"
                min={0}
                value={unlockDay}
                onChange={(e) => setUnlockDay(Number(e.target.value))}
                className="w-14 rounded-md border px-2 py-1.5 text-sm text-gray-900"
              />
            </label>
          )}
          <button
            type="button"
            onClick={handleAddContent}
            disabled={!contentToAdd || addContent.isPending}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Danger zone — hard delete. Behind a type-the-name confirm so a
          misclick can't remove a product. The backend un-gates bundled
          content, detaches purchases, and removes enrollments first. */}
      <div className="space-y-2 rounded-md border border-red-200 bg-red-50/60 p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-red-700">
          Danger zone
        </h3>
        {!confirmingDelete ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-red-700/80">
              Permanently delete this product. Bundled content is released back
              to free; purchases are detached. This can’t be undone.
            </p>
            <button
              type="button"
              onClick={() => {
                setConfirmingDelete(true);
                setConfirmText('');
              }}
              className="shrink-0 rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
            >
              Delete product
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-[11px] text-red-700">
              Type the product name{' '}
              <span className="font-mono font-semibold">{product.name}</span> to
              confirm deletion.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={product.name}
                className="flex-1 rounded-md border border-red-300 px-2 py-1.5 text-sm text-gray-900"
                autoFocus
              />
              <button
                type="button"
                onClick={handleDelete}
                disabled={
                  confirmText.trim() !== product.name || deleteProduct.isPending
                }
                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-40"
              >
                {deleteProduct.isPending ? 'Deleting…' : 'Delete forever'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmingDelete(false);
                  setConfirmText('');
                }}
                disabled={deleteProduct.isPending}
                className="rounded-md border px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
