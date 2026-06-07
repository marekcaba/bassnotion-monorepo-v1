'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

/**
 * The app's single QueryClient, exported as a module singleton so code that
 * lives OUTSIDE the QueryClientProvider tree (e.g. AuthProvider, which is
 * mounted above this provider in the root layout) can access it directly —
 * importing this avoids `useQueryClient()`, which throws "No QueryClient set"
 * when called outside the provider (and breaks static prerendering).
 *
 * There is exactly one ReactQueryProvider mounted (root layout), so this
 * singleton IS the app's client.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // With SSR, we usually want a staleTime above 0 to avoid refetching
      // immediately on the client.
      staleTime: 60 * 1000, // 1 minute
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status?: number }).status;
          if (status && status >= 400 && status < 500) {
            return false;
          }
        }
        return failureCount < 3;
      },
    },
    mutations: {
      retry: false,
    },
  },
});

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
