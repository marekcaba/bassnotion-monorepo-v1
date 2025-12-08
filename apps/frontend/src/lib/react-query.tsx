'use client';

import { QueryClient, QueryClientProvider, QueryCache, onlineManager } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState, useEffect } from 'react';

// WEBKIT/SAFARI FIX: Configure React Query for Safari compatibility
// Issue: Safari's unreliable navigator.onLine causes queries to pause indefinitely
// Solution: Bypass network detection entirely
onlineManager.setOnline(true);  // Fix: Force online state, bypass navigator.onLine
// Note: Removed notifyManager.setScheduler(queueMicrotask) - it was breaking queryFn execution

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // STEP 1: Verify component renders in Webkit
  console.log('[✅ ReactQueryProvider] Component rendering', {
    timestamp: Date.now(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR',
  });

  const [queryClient] = useState(
    () => {
      console.log('[✅ ReactQueryProvider] Creating QueryClient', {
        timestamp: Date.now(),
      });
      return new QueryClient({
        queryCache: new QueryCache({
          onError: (error, query) => {
            console.error('[🔴 QueryCache ERROR]', {
              queryKey: query.queryKey,
              error: error instanceof Error ? error.message : String(error),
              state: query.state,
              fetchStatus: query.state.fetchStatus,
              timestamp: Date.now(),
            });
          },
          onSuccess: (data, query) => {
            console.log('[🟢 QueryCache SUCCESS]', {
              queryKey: query.queryKey,
              hasData: !!data,
              dataType: typeof data,
              state: query.state,
              fetchStatus: query.state.fetchStatus,
              timestamp: Date.now(),
            });
          },
        }),
        defaultOptions: {
          queries: {
            // WEBKIT/SAFARI FIX: Bypass network detection entirely
            // Safari's navigator.onLine is unreliable, causing queries to pause indefinitely
            networkMode: 'always',
            // With SSR, we usually want to set some default staleTime
            // above 0 to avoid refetching immediately on the client
            staleTime: 60 * 1000, // 1 minute
            retry: (failureCount, error) => {
              // Don't retry on 4xx errors
              if (error instanceof Error && 'status' in error) {
                const status = (error as any).status;
                if (status >= 400 && status < 500) {
                  return false;
                }
              }
              return failureCount < 3;
            },
          },
          mutations: {
            // WEBKIT/SAFARI FIX: Also bypass network detection for mutations
            networkMode: 'always',
            retry: false,
          },
        },
      });
    },
  );

  // STEP 2: Log QueryClient instance details
  console.log('[✅ ReactQueryProvider] QueryClient initialized', {
    timestamp: Date.now(),
    cacheSize: queryClient.getQueryCache().getAll().length,
  });

  // WEBKIT DEBUG: Subscribe to QueryCache events (filtered to reduce noise)
  useEffect(() => {
    // Only log important events, skip frequent internal events like observerOptionsUpdated
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (!event) return;

      // Skip noisy internal events that fire on every render
      if (event.type === 'observerOptionsUpdated' || event.type === 'observerResultsUpdated') {
        return; // Skip - these fire constantly and aren't useful for debugging
      }

      console.log('[📊 QueryCache EVENT]', {
        type: event.type,
        queryKey: event.query?.queryKey,
        state: event.query?.state.status,
        fetchStatus: event.query?.state.fetchStatus,
        timestamp: Date.now(),
      });
    });

    return () => unsubscribe();
  }, [queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
