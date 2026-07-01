import 'server-only';

import { QueryClient } from '@tanstack/react-query';

/**
 * Per-request server QueryClient for SSR prefetch (P3).
 *
 * A FRESH client every call — a server client must NEVER be shared across requests, or one user's
 * prefetched auth'd data could dehydrate into another user's HTML. (Instantiating a QueryClient
 * inside an async Server Component is the TanStack-blessed exception to the stable-client rule,
 * precisely because RSCs run once per request.)
 *
 * staleTime mirrors the client singleton (react-query.tsx, 60s) so a dehydrated query isn't
 * considered stale the instant it hydrates on the client and refetched immediately.
 *
 * This is the SERVER client only — the browser keeps its module singleton; HydrationBoundary
 * hydrates the dehydrated state from here INTO that singleton via context.
 */
export function makeServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
    },
  });
}
