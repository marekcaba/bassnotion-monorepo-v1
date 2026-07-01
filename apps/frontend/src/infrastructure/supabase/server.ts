import 'server-only';

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

/**
 * Server-side Supabase client (@supabase/ssr) — reads the session from the request cookies so
 * server components / route handlers can identify the user. Must be created PER REQUEST.
 *
 * DEAD-BUT-READY: nothing imports this in Phase 1 (the cookie-auth migration keeps rendering
 * identical to today). It lands as infra so Phase 3 (server-render the /app shell gating) can pick
 * it up. Mirrors the browser client's cookie name/encoding so both read the same session.
 *
 * Cookie WRITES: the middleware owns token refresh (it can set response cookies). From a Server
 * Component the cookie store is read-only, so `setAll` here is wrapped in try/catch — the throw is
 * expected and harmless (the middleware will have refreshed already).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'sb-bn',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
      },
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Called from a Server Component (read-only cookies) — the middleware handles the
            // refresh write, so swallowing this is correct.
          }
        },
      },
    },
  );
}
