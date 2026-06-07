'use client';

/**
 * Store hooks (TanStack Query) — the customer-facing catalog + checkout for
 * /app/store. Owned-state comes from useUserAccess (purchasedProductIds +
 * hasActiveSubscription).
 */

import { useQuery } from '@tanstack/react-query';

import { storeApi } from '@/domains/billing/api/store.api';

const storeKeys = {
  all: ['store'] as const,
  products: () => [...storeKeys.all, 'products'] as const,
  product: (slug: string) => [...storeKeys.all, 'product', slug] as const,
};

/** Public product catalog (membership + packs + accelerator). */
export function useStoreProducts() {
  return useQuery({
    queryKey: storeKeys.products(),
    queryFn: () => storeApi.listProducts(),
    staleTime: 1000 * 60 * 5,
  });
}

/** One product by slug + its bundled contents (pack detail page). */
export function useStoreProduct(slug: string | undefined) {
  return useQuery({
    queryKey: storeKeys.product(slug ?? ''),
    queryFn: () => storeApi.getProduct(slug as string),
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
  });
}
