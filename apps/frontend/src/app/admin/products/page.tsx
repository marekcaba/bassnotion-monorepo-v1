'use client';

/**
 * Admin Products — /admin/products.
 *
 * Author store products (Groove Packs, Accelerator, membership) without SQL:
 * create a product, set its marketing fields, upload a cover, and bundle
 * grooves into it (product_contents). Mirrors the admin grooves page house
 * style (plain useState form + list, amber accent).
 */

import { useState } from 'react';

import {
  useAdminProducts,
  useCreateProduct,
} from '@/domains/admin/hooks/useAdminProducts';
import {
  AdminProductType,
  CreateProductPayload,
} from '@/domains/admin/api/products.api';
import { ProductEditor } from '@/domains/admin/components/ProductEditor';

const PRODUCT_TYPES: AdminProductType[] = [
  'groove_pack',
  'accelerator',
  'membership',
  'course',
];

const EMPTY_DRAFT: CreateProductPayload = {
  slug: '',
  type: 'groove_pack',
  name: '',
  tagline: '',
  description: '',
  priceInCents: 3900,
  currency: 'usd',
  isActive: true,
  features: [],
  sortOrder: 0,
};

export default function AdminProductsPage() {
  const { data: products, isLoading } = useAdminProducts();
  const createProduct = useCreateProduct();
  const [draft, setDraft] = useState<CreateProductPayload>(EMPTY_DRAFT);
  const [featuresText, setFeaturesText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const set = <K extends keyof CreateProductPayload>(
    k: K,
    v: CreateProductPayload[K],
  ) => setDraft((d) => ({ ...d, [k]: v }));

  const canSave =
    draft.slug.trim() && draft.name.trim() && draft.priceInCents >= 0;

  const handleCreate = async () => {
    setError(null);
    try {
      const features = featuresText
        .split('\n')
        .map((f) => f.trim())
        .filter(Boolean);
      await createProduct.mutateAsync({ ...draft, features });
      setDraft(EMPTY_DRAFT);
      setFeaturesText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create product');
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-6">
      <header>
        <h1 className="text-2xl font-semibold">Store Products</h1>
        <p className="mt-1 text-sm text-gray-600">
          Author Groove Packs and the Accelerator. Create a product, then bundle
          grooves into it below. Set its Stripe price ID once a price exists in
          the Stripe dashboard.
        </p>
      </header>

      {/* Create */}
      <section className="space-y-3 rounded-lg border bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          New product
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <input
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Name (e.g. Funk 101 Pack)"
            className="rounded-md border px-3 py-2 text-sm"
          />
          <input
            value={draft.slug}
            onChange={(e) =>
              set('slug', e.target.value.toLowerCase().replace(/\s+/g, '-'))
            }
            placeholder="slug (e.g. groove-pack-funk-101)"
            className="rounded-md border px-3 py-2 font-mono text-sm"
          />
        </div>
        <input
          value={draft.tagline ?? ''}
          onChange={(e) => set('tagline', e.target.value)}
          placeholder="Tagline (one-line hook)"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <textarea
          value={draft.description ?? ''}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Description"
          rows={2}
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
        <div className="grid grid-cols-3 gap-2">
          <label className="space-y-1 text-xs text-gray-500">
            Type
            <select
              value={draft.type}
              onChange={(e) => set('type', e.target.value as AdminProductType)}
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
              value={draft.priceInCents}
              onChange={(e) => set('priceInCents', Number(e.target.value))}
              className="w-full rounded-md border px-3 py-2 text-sm text-gray-900"
            />
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
        {error && <p className="text-xs text-red-500">{error}</p>}
        <button
          type="button"
          disabled={!canSave || createProduct.isPending}
          onClick={handleCreate}
          className="rounded-md bg-[#E8A44A] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
        >
          {createProduct.isPending ? 'Saving…' : 'Create product'}
        </button>
      </section>

      {/* List */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
          Products ({products?.length ?? 0})
        </h2>
        {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
        {(products ?? []).map((p) => (
          <div key={p.id} className="rounded-md border bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div>
                <div className="font-medium">
                  {p.name}
                  {p.badge && (
                    <span className="ml-2 rounded bg-[#E8A44A]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-[#9a6a1f]">
                      {p.badge}
                    </span>
                  )}
                  {!p.isActive && (
                    <span className="ml-2 text-xs text-gray-400">inactive</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  {p.type} · ${(p.priceInCents / 100).toFixed(2)} ·{' '}
                  {p.stripePriceId ? 'price set' : 'no Stripe price'}
                </div>
              </div>
              <span className="text-gray-400">
                {expandedId === p.id ? '▲' : '▼'}
              </span>
            </button>
            {expandedId === p.id && (
              <ProductEditor
                productId={p.id}
                onDeleted={() => setExpandedId(null)}
              />
            )}
          </div>
        ))}
        {!isLoading && (products?.length ?? 0) === 0 && (
          <p className="text-sm text-gray-400">
            No products yet — create your first above.
          </p>
        )}
      </section>
    </div>
  );
}
