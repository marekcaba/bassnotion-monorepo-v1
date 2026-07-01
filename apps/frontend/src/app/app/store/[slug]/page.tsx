import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { StoreProduct } from '@/domains/billing/api/store.api';
import { makeServerQueryClient } from '@/lib/server/serverQueryClient';
import { serverFetchPublicJson } from '@/lib/server/serverFetch';
import { PackDetailPageClient } from './PackDetailPageClient';

/**
 * SERVER wrapper for /app/store/[slug] (full-SSR). The slug is known server-side (route params), so
 * prefetch the PUBLIC product (['store','product',slug], GET /api/v1/billing/products/:slug) and
 * hydrate — the detail paints on first load, no full-page spinner. Ownership badge comes from
 * useUserAccess (already hydrated by the /app layout). Client stays 'use client' (useParams).
 * serverFetchPublicJson never throws — a hiccup leaves it unseeded and the client fetches live.
 */
export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const queryClient = makeServerQueryClient();
  const product = await serverFetchPublicJson<StoreProduct>(
    `/api/v1/billing/products/${encodeURIComponent(slug)}`,
  );
  if (product) {
    queryClient.setQueryData(['store', 'product', slug], product);
  }
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PackDetailPageClient />
    </HydrationBoundary>
  );
}
