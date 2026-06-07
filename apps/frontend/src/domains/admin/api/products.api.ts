/**
 * Admin Products API Client — create/edit store products (Groove Packs,
 * Accelerator) and manage which content they bundle. Mirrors
 * groove-library.api.ts. All endpoints are admin-gated on the backend.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ---- Types (the storefront product shape; admin-facing) -------------------

export type AdminProductType =
  | 'membership'
  | 'groove_pack'
  | 'accelerator'
  | 'course';

export type AdminContentType = 'groove' | 'video' | 'exercise';

export interface AdminProduct {
  id: string;
  slug: string;
  type: AdminProductType;
  name: string;
  description?: string;
  stripePriceId?: string;
  priceInCents: number;
  currency: string;
  isActive: boolean;
  tagline?: string;
  coverImageUrl?: string;
  previewGrooveId?: string;
  features: string[];
  sortOrder: number;
  badge?: string;
  metadata: Record<string, unknown>;
}

export interface AdminProductContent {
  id: string;
  productId: string;
  contentType: AdminContentType;
  contentId: string;
  unlockDay: number;
  sortOrder: number;
  note?: string;
}

export interface CreateProductPayload {
  slug: string;
  type: AdminProductType;
  name: string;
  description?: string;
  stripePriceId?: string;
  priceInCents: number;
  currency?: string;
  isActive?: boolean;
  tagline?: string;
  coverImageUrl?: string;
  previewGrooveId?: string;
  features?: string[];
  sortOrder?: number;
  badge?: string;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;

export interface AddContentPayload {
  contentType: AdminContentType;
  contentId: string;
  unlockDay?: number;
  sortOrder?: number;
  note?: string;
}

// ---- Auth ------------------------------------------------------------------

let supabaseClient: SupabaseClient | null = null;
function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }
  return supabaseClient;
}

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = getSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

const BASE = `${API_BASE_URL}/api/v1/billing/admin/products`;

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({ message: res.statusText }));
  throw new Error(err.message || fallback);
}

// ---- API -------------------------------------------------------------------

export const adminProductsApi = {
  async list(): Promise<AdminProduct[]> {
    const res = await fetch(BASE, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to list products');
    const { products } = (await res.json()) as { products: AdminProduct[] };
    return products;
  },

  async get(
    id: string,
  ): Promise<{ product: AdminProduct; contents: AdminProductContent[] }> {
    const res = await fetch(`${BASE}/${id}`, { headers: await authHeaders() });
    if (!res.ok) await parseError(res, 'Failed to fetch product');
    return res.json();
  },

  async create(input: CreateProductPayload): Promise<AdminProduct> {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to create product');
    const { product } = (await res.json()) as { product: AdminProduct };
    return product;
  },

  async update(id: string, patch: UpdateProductPayload): Promise<AdminProduct> {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) await parseError(res, 'Failed to update product');
    const { product } = (await res.json()) as { product: AdminProduct };
    return product;
  },

  async addContent(
    productId: string,
    input: AddContentPayload,
  ): Promise<AdminProductContent> {
    const res = await fetch(`${BASE}/${productId}/contents`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify(input),
    });
    if (!res.ok) await parseError(res, 'Failed to add content');
    const { content } = (await res.json()) as { content: AdminProductContent };
    return content;
  },

  async removeContent(contentRowId: string): Promise<void> {
    const res = await fetch(`${BASE}/contents/${contentRowId}`, {
      method: 'DELETE',
      headers: await authHeaders(),
    });
    if (!res.ok) await parseError(res, 'Failed to remove content');
  },

  /** Upload a cover image (multipart). Returns the public URL. */
  async uploadCover(productId: string, file: File): Promise<string> {
    const headers = await authHeaders();
    delete headers['Content-Type']; // let the browser set the multipart boundary
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${BASE}/${productId}/upload-cover`, {
      method: 'POST',
      headers,
      body: form,
    });
    if (!res.ok) await parseError(res, 'Failed to upload cover');
    const { publicUrl } = (await res.json()) as { publicUrl: string };
    return publicUrl;
  },
};
