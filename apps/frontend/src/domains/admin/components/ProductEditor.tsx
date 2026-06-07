'use client';

/**
 * ProductEditor — the expandable edit panel for one store product on the admin
 * products page. Edit marketing fields + Stripe price, upload a cover, and
 * bundle grooves into the pack (product_contents). Plain-useState house style.
 */

import { useState, useEffect, useRef } from 'react';

import {
  useAdminProduct,
  useUpdateProduct,
  useAddProductContent,
  useRemoveProductContent,
} from '@/domains/admin/hooks/useAdminProducts';
import { adminProductsApi } from '@/domains/admin/api/products.api';
import { useGrooveLibrary } from '@/domains/drill/hooks/useGrooveLibrary';

export function ProductEditor({ productId }: { productId: string }) {
  const { data, isLoading } = useAdminProduct(productId);
  const updateProduct = useUpdateProduct();
  const addContent = useAddProductContent();
  const removeContent = useRemoveProductContent();
  const { data: grooveData } = useGrooveLibrary(false);
  const grooves = grooveData?.grooves ?? [];

  const [stripePriceId, setStripePriceId] = useState('');
  const [badge, setBadge] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [previewGrooveId, setPreviewGrooveId] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Groove-to-add picker state
  const [grooveToAdd, setGrooveToAdd] = useState('');
  const [unlockDay, setUnlockDay] = useState(0);

  // Sync local fields when the product loads.
  useEffect(() => {
    if (data?.product) {
      setStripePriceId(data.product.stripePriceId ?? '');
      setBadge(data.product.badge ?? '');
      setIsActive(data.product.isActive);
      setPreviewGrooveId(data.product.previewGrooveId ?? '');
    }
  }, [data?.product]);

  if (isLoading || !data) {
    return <div className="border-t px-4 py-3 text-sm text-gray-500">Loading…</div>;
  }

  const { product, contents } = data;

  const grooveName = (id: string) =>
    grooves.find((g) => g.id === id)?.name ?? id.slice(0, 8);

  const saveFields = async () => {
    setMsg(null);
    try {
      await updateProduct.mutateAsync({
        id: productId,
        patch: {
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

  const handleAddGroove = async () => {
    if (!grooveToAdd) return;
    setMsg(null);
    try {
      await addContent.mutateAsync({
        productId,
        input: {
          contentType: 'groove',
          contentId: grooveToAdd,
          unlockDay,
          sortOrder: contents.length,
        },
      });
      setGrooveToAdd('');
      setUnlockDay(0);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed to add groove');
    }
  };

  const isAccelerator = product.type === 'accelerator';

  return (
    <div className="space-y-4 border-t bg-gray-50 px-4 py-4 text-sm">
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
          // eslint-disable-next-line @next/next/no-img-element
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
        {coverUploading && <span className="text-xs text-gray-500">Uploading…</span>}
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
          Grooves in this pack ({contents.length})
        </h3>
        {contents.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between rounded border bg-white px-3 py-2"
          >
            <span>
              {c.contentType === 'groove' ? grooveName(c.contentId) : c.contentId}
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

        {/* Add groove */}
        <div className="flex items-center gap-2 pt-1">
          <select
            value={grooveToAdd}
            onChange={(e) => setGrooveToAdd(e.target.value)}
            className="flex-1 rounded-md border px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">Select a groove to add…</option>
            {grooves
              .filter(
                (g) => !contents.some((c) => c.contentId === g.id),
              )
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} · {g.originalKey} · {g.originalBpm} BPM
                </option>
              ))}
          </select>
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
            onClick={handleAddGroove}
            disabled={!grooveToAdd || addContent.isPending}
            className="rounded-md bg-gray-800 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
