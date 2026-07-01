import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { StoreProduct } from '@/domains/billing/api/store.api';
import { makeServerQueryClient } from '@/lib/server/serverQueryClient';
import { serverFetchPublicJson } from '@/lib/server/serverFetch';
import { StorePageClient } from './StorePageClient';

/**
 * SERVER wrapper for /app/store (full-SSR, partial). Prefetches the PUBLIC product catalog
 * (['store','products'], GET /api/v1/billing/products, unwraps { products }) and hydrates, so the
 * grid paints on first load with no product spinner. The user-specific "Owned" badges come from
 * useUserAccess, which the /app layout already hydrates (['billing','access']) — so both the
 * products AND ownership are warm on first paint.
 *
 * StorePageClient stays 'use client' (StoreContent uses useSearchParams for Stripe returns).
 * serverFetchPublicJson never throws — a hiccup leaves products unseeded and the client fetches live.
 */
export default async function StorePage() {
  const queryClient = makeServerQueryClient();
  const res = await serverFetchPublicJson<{ products: StoreProduct[] }>(
    '/api/v1/billing/products',
  );
  if (res && Array.isArray(res.products)) {
    queryClient.setQueryData(['store', 'products'], res.products);
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <StorePageClient />
    </HydrationBoundary>
  );
}
