import 'server-only';

import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import type { UserAccessStatus } from '@/domains/billing/types/billing.types';
import { billingKeys } from '@/domains/billing/hooks/useBilling';
import { getServerAuth } from './serverAuth';
import { serverFetchJson } from './serverFetch';
import { makeServerQueryClient } from './serverQueryClient';

export interface AppShellPrefetch {
  /** The server VERIFIED a cookie session — AuthStoreHydrator seeds this so isReady/isAuthenticated
   *  are true on first paint (kills the auth-resolution flash). */
  serverAuthed: boolean;
  /** TanStack cache (currently ['billing','access']) to hydrate into the client singleton so
   *  useEntitlement resolves the real tier on first paint instead of flashing 'free'. */
  dehydratedState: DehydratedState;
}

/**
 * Server prefetch for the /app shell (P3) — GENERIC, safe on every /app route.
 *
 * Reads the P1 cookie (getServerAuth → verified getUser), and for a logged-in user prefetches the
 * billing/access status into a per-request server QueryClient, then dehydrates it. The client
 * HydrationBoundary hydrates that into its singleton, so useEntitlement's access query starts with
 * data (isLoading:false) → the real tier on first paint.
 *
 * Deliberately does NOT touch anything gym-specific (the today-rep POST MINTS — R11); the gym's
 * doneTodayUtc is seeded route-locally by the gym page, never here.
 *
 * NEVER throws: getServerAuth + serverFetchJson both swallow failures → a hiccup degrades to
 * "no seed → the tiny flash we had before", never a broken render.
 */
export async function prefetchAppShell(): Promise<AppShellPrefetch> {
  const { user, token } = await getServerAuth();

  if (!user || !token) {
    // Logged out (or unverifiable) — nothing to seed; the edge already redirects protected routes,
    // and public/preview paths resolve client-side as before.
    return { serverAuthed: false, dehydratedState: dehydrate(makeServerQueryClient()) };
  }

  const queryClient = makeServerQueryClient();

  const access = await serverFetchJson<UserAccessStatus>(
    '/api/v1/billing/access',
    token,
  );
  // Seed ONLY on a real response. On a null (backend hiccup) we leave the query unseeded so the
  // client fetches it live — better a brief flash than seeding a wrong/empty entitlement.
  if (access) {
    queryClient.setQueryData(billingKeys.access(), access);
  }

  return { serverAuthed: true, dehydratedState: dehydrate(queryClient) };
}
