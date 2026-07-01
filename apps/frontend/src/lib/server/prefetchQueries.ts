import 'server-only';

import { dehydrate, type DehydratedState } from '@tanstack/react-query';
import { getServerAuth } from './serverAuth';
import { serverFetchJson } from './serverFetch';
import { makeServerQueryClient } from './serverQueryClient';

/**
 * A read-only GET to prefetch + the TanStack query key the client reads it through. `key` may be a
 * function of the verified userId (most of our keys embed it, e.g. ['user-profile', userId]) — pass
 * a builder so the server seeds the EXACT key the client hook will look up.
 */
export interface PrefetchSpec {
  /** The query key to seed. Either a literal key, or a builder given the verified userId. */
  key: readonly unknown[] | ((userId: string) => readonly unknown[]);
  /** The read-only backend path (GET). MUST NOT mutate — this runs on every SSR page load (R11). */
  path: string;
  /**
   * Optional: map the RAW endpoint body to the exact value the client queryFn caches. REQUIRED when
   * the client hook unwraps an envelope (e.g. useUserProfile returns result.data from a
   * {success,data} response) — seed the SAME shape or the client reads undefined. If the response
   * is malformed, return null to skip seeding (the client fetches live). Omit when the raw body IS
   * the cached value (most of our GETs return the array/object directly).
   */
  transform?: (raw: unknown) => unknown;
}

export interface PrefetchResult {
  /** True when the server verified a cookie session (feeds AuthStoreHydrator). */
  serverAuthed: boolean;
  /** The verified user id, or null when logged out. */
  userId: string | null;
  /** Cache to hand to <HydrationBoundary state={...}> so the client hooks resolve on first paint. */
  dehydratedState: DehydratedState;
}

/**
 * Generic SSR prefetch (full-SSR pass): verify the cookie session, fetch N READ-ONLY GETs in
 * PARALLEL into a per-request server QueryClient, and dehydrate. Each /app page passes its own list
 * of {key, path} so the matching client hooks (useQuery) hydrate from cache and paint their data on
 * first render — no client-side loading spinner.
 *
 * The gym's bespoke prefetchGymStatus stays separate (it needs a POST-adjacent read + a non-query
 * useState seed). This helper is for the common case: pages whose data are plain read-only useQuery.
 *
 * NEVER throws: getServerAuth + serverFetchJson swallow failures. A logged-out user or a hiccup
 * yields an empty dehydrated state → the client fetches live, exactly as before (tiny flash), never
 * a broken render or a wrong-user leak. A single failed GET simply isn't seeded (that one query
 * fetches client-side); the others still hydrate.
 */
export async function prefetchQueries(
  specs: PrefetchSpec[],
): Promise<PrefetchResult> {
  const { user, token } = await getServerAuth();

  const queryClient = makeServerQueryClient();

  if (!user || !token) {
    return {
      serverAuthed: false,
      userId: null,
      dehydratedState: dehydrate(queryClient),
    };
  }

  await Promise.all(
    specs.map(async (spec) => {
      const raw = await serverFetchJson<unknown>(spec.path, token);
      if (raw === null) return; // failed GET → leave unseeded; the client fetches it live.
      // Map the raw body to the client's cached shape (envelope unwrap) when needed.
      const data = spec.transform ? spec.transform(raw) : raw;
      if (data === null || data === undefined) return; // malformed → skip; client fetches live.
      const key = typeof spec.key === 'function' ? spec.key(user.id) : spec.key;
      queryClient.setQueryData(key, data);
    }),
  );

  return {
    serverAuthed: true,
    userId: user.id,
    dehydratedState: dehydrate(queryClient),
  };
}
