import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

/**
 * SERVER OAuth callback (Approach B / Option 2). Google (and magic-link) redirect here with a
 * ?code; we exchange it for the sb-bn session cookie SERVER-SIDE and 307 straight to the
 * destination — the browser never renders an intermediate page, so the flow is: provider form →
 * (invisible server hop) → the destination, where the Backstage welcome overlay takes over.
 *
 * The PKCE code_verifier was written by the BROWSER client (signInWithOAuth) into the non-httpOnly,
 * sameSite=lax `sb-bn-code-verifier` cookie; sameSite=lax sends it on this top-level redirect, and
 * we read it here with the SAME cookieOptions.name + base64url so exchangeCodeForSession can use it.
 *
 * GRACEFUL FALLBACK (de-risk): if the server exchange fails for ANY reason (verifier not sent,
 * error), we redirect to the CLIENT callback page (/auth/callback-client) which re-attempts the
 * exchange the proven client-side way. So a server-exchange miss degrades to today's working flow
 * with zero user impact — this is how we prove Option 2 on staging safely.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const errorParam = url.searchParams.get('error');
  const errorDescription = url.searchParams.get('error_description');

  // Provider returned an error (user denied, etc.) — send to login with the message.
  if (errorParam) {
    const login = new URL('/login', req.url);
    login.searchParams.set('error', errorDescription || errorParam);
    return NextResponse.redirect(login);
  }

  // No code → can't exchange here; hand to the client fallback (also covers hash-fragment flows).
  if (!code) {
    return NextResponse.redirect(new URL('/auth/callback-client', req.url));
  }

  // The response we write refreshed session cookies onto (a redirect to /backstage on success).
  const success = NextResponse.redirect(new URL('/backstage', req.url));

  const supabase = createServerClient(
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
          return req.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options: CookieOptions;
          }[],
          headers?: Record<string, string>,
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            success.cookies.set(name, value, options);
          });
          // Never let a CDN cache a response carrying auth cookies.
          if (headers) {
            for (const [k, v] of Object.entries(headers)) {
              success.headers.set(k, v);
            }
          }
        },
      },
    },
  );

  try {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    // Success: session cookies are on `success`; go straight to Backstage.
    return success;
  } catch {
    // Server exchange failed (verifier not sent / any error) → hand the SAME code to the client
    // callback, which re-runs the exchange the proven browser-side way. Zero user impact.
    const fallback = new URL('/auth/callback-client', req.url);
    fallback.searchParams.set('code', code);
    return NextResponse.redirect(fallback);
  }
}
