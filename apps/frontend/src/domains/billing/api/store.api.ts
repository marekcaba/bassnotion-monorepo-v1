/**
 * Store API — the customer-facing catalog + checkout for /app/store.
 * Reads the DB-backed product catalog and creates Stripe checkout sessions
 * for membership and one-time products (Groove Packs, Accelerator).
 */

import { supabase } from '@/infrastructure/supabase/client';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export type StoreProductType =
  | 'membership'
  | 'groove_pack'
  | 'accelerator'
  | 'course';

export interface StoreProduct {
  id: string;
  slug: string;
  type: StoreProductType;
  name: string;
  description?: string;
  tagline?: string;
  coverImageUrl?: string;
  previewGrooveId?: string;
  features: string[];
  badge?: string;
  sortOrder: number;
  price: number;
  priceInCents: number;
  currency: string;
  /** True when checkout can run (membership, or a pack with a Stripe price). */
  purchasable: boolean;
}

export interface StoreProductContent {
  contentType: 'groove' | 'video' | 'exercise';
  contentId: string;
  unlockDay: number;
  sortOrder: number;
  note?: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  } catch {
    /* anon */
  }
  return headers;
}

export const storeApi = {
  /** Public catalog of active products. */
  async listProducts(): Promise<StoreProduct[]> {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/products`);
    if (!res.ok) throw new Error('Failed to load products');
    const { products } = (await res.json()) as { products: StoreProduct[] };
    return products;
  },

  /** One product by slug + its bundled contents (pack detail page). */
  async getProduct(
    slug: string,
  ): Promise<{ product: StoreProduct; contents: StoreProductContent[] }> {
    const res = await fetch(
      `${API_BASE_URL}/api/v1/billing/products/${encodeURIComponent(slug)}`,
    );
    if (res.status === 404) throw new Error('Product not found');
    if (!res.ok) throw new Error('Failed to load product');
    return res.json();
  },

  /**
   * Start a Stripe checkout for a one-time product. Requires auth.
   * Returns the checkout URL (caller redirects).
   */
  async checkoutProduct(
    productId: string,
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({
        type: 'product',
        productId,
        successUrl,
        cancelUrl,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Checkout failed');
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  },

  /** Start a Stripe checkout for the monthly membership. Requires auth. */
  async checkoutMembership(
    successUrl: string,
    cancelUrl: string,
  ): Promise<string> {
    const res = await fetch(`${API_BASE_URL}/api/v1/billing/checkout`, {
      method: 'POST',
      headers: await authHeaders(),
      body: JSON.stringify({ type: 'subscription', successUrl, cancelUrl }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || 'Checkout failed');
    }
    const { url } = (await res.json()) as { url: string };
    return url;
  },
};
