import 'server-only';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Server-side Bearer fetch of the (Bearer-only, cross-origin Railway) backend for SSR prefetch (P3).
 *
 * Mirrors the client billing.api getAuthHeaders pattern (Authorization: Bearer <token>) but sources
 * the token from the SERVER cookie session (see getServerAuth). The cookie itself is NEVER sent to
 * the backend — only the Bearer — exactly like the browser client (credentials unset).
 *
 * cache:'no-store' — this is per-user auth'd data; it must never be cached by Next's data cache and
 * served to another user. NEVER throws: any failure (no token, non-2xx, network) resolves to null,
 * and the client-side query fetches it live. So a server hiccup degrades to "no seed → tiny flash",
 * never to a broken render or a wrong-user leak.
 */
export async function serverFetchJson<T>(
  path: string,
  token: string | null,
): Promise<T | null> {
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Server-side fetch of a PUBLIC backend GET (no auth) for SSR prefetch — e.g. the store product
 * catalog, which is the same for everyone. Cacheable (not per-user), so unlike the auth'd variant
 * this allows Next's data cache with a short revalidate. NEVER throws: null on any failure → the
 * client fetches it live.
 */
export async function serverFetchPublicJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      // Public catalog — safe to cache briefly at the edge (not per-user data).
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
