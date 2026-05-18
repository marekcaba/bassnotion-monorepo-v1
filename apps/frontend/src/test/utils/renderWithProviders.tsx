/**
 * Shared test render helper that wraps a component with the common
 * providers our React tree expects (currently: QueryClient).
 *
 * Use this in component tests that exercise hooks like useTutorials,
 * useTutorialExercises, useYouTubeChannelData, or any other TanStack
 * Query consumer. Without the provider, calls to `useQuery` throw
 * "No QueryClient set, use QueryClientProvider to set one".
 *
 * Each call constructs a fresh QueryClient so tests stay isolated and
 * don't leak cached query state between cases.
 */

import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't retry in tests; fail fast and assert on the failure shape.
        retry: false,
        // Don't refetch on window focus / reconnect during test runs.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export interface RenderWithProvidersOptions extends RenderOptions {
  /**
   * Pass a pre-built QueryClient if the test needs to seed cache data
   * or assert on the client's internal state. Otherwise a fresh one is
   * created per call.
   */
  queryClient?: QueryClient;
}

export function renderWithProviders(
  ui: React.ReactElement,
  options: RenderWithProvidersOptions = {},
) {
  const { queryClient = makeQueryClient(), ...renderOptions } = options;

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

// Re-export the common testing-library bits so test files only need one import.
export {
  screen,
  fireEvent,
  waitFor,
  within,
  act,
  cleanup,
} from '@testing-library/react';
