import { createServerClient } from '@supabase/ssr';
import type { NextRequest, NextResponse } from 'next/server';

/**
 * Edge-middleware Supabase session refresh (@supabase/ssr).
 *
 * Binds a per-request server client to the REQUEST cookies (read) and the RESPONSE cookies
 * (write), then calls getUser() — which validates the session against the Auth server and, if the
 * access token was refreshed, writes the new token cookies back onto the response. Returns the
 * (possibly cookie-updated) response so the caller can return it.
 *
 * This is the ONE place tokens get refreshed at the edge. It does NOT change routing — the caller
 * (middleware.ts) passes its already-decided NextResponse (next()/rewrite()) through here.
 *
 * CRITICAL: a response carrying a refreshed session cookie must NEVER be cached by a CDN / reverse
 * proxy, or one user's token could be served to another. @supabase/ssr@0.7's setAll doesn't pass
 * the no-cache headers, so we set them ourselves whenever we write a cookie.
 */
export async function refreshSession(
  req: NextRequest,
  res: NextResponse,
): Promise<NextResponse> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        name: 'sb-bn',
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        // No `domain` → host-only (app.bassicology.com), mirroring the browser client.
      },
      cookieEncoding: 'base64url',
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          let wroteCookie = false;
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
            wroteCookie = true;
          });
          if (wroteCookie) {
            res.headers.set(
              'Cache-Control',
              'private, no-cache, no-store, must-revalidate, max-age=0',
            );
            res.headers.set('Pragma', 'no-cache');
            res.headers.set('Expires', '0');
          }
        },
      },
    },
  );

  // getUser() (not getSession()) validates against the Auth server and triggers the refresh +
  // write-back through setAll above. A network/auth failure must NOT break the page render — the
  // response still returns; the client falls back to its own auth resolution.
  try {
    await supabase.auth.getUser();
  } catch {
    /* refresh failed — return the response unchanged; client-side auth still works */
  }

  return res;
}
