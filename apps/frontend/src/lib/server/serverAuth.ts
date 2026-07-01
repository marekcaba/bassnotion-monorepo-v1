import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

/**
 * Server-side auth read for the SSR shell (P3).
 *
 * Reads the P1 cookie session and returns the VERIFIED user + the raw access token. getUser()
 * (not getSession()) validates against the Auth server so the identity is trustworthy; the token
 * is returned alongside so a server prefetch can call the Bearer-only backend without a second
 * getSession round-trip.
 *
 * NEVER throws — a logged-out visitor or an Auth-server blip resolves to {user:null,token:null},
 * and the client falls back to its own auth resolution. This is the ONE place the server learns
 * "who is this request" for seeding the auth store + entitlement/gym prefetch.
 */
export interface ServerAuth {
  user: User | null;
  token: string | null;
}

export async function getServerAuth(): Promise<ServerAuth> {
  try {
    const supabase = await createSupabaseServerClient();
    // getUser() validates against the Auth server (trustworthy identity).
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, token: null };

    // getSession() is a no-network cookie read here (autoRefreshToken is off server-side); we only
    // need the access_token to mint the backend Bearer for the prefetch.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return { user, token: session?.access_token ?? null };
  } catch {
    // Logged out, no cookie, or Auth server unreachable — treat as anonymous; the client resolves.
    return { user: null, token: null };
  }
}
