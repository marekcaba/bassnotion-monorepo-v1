import 'server-only';

import { cookies } from 'next/headers';
// Import the constant from the NEUTRAL module, NOT the 'use client' justLoggedIn — a client-module
// export read server-side is a client-reference proxy (function), not the string. This was the bug.
import { WELCOME_COOKIE } from '@/domains/user/components/auth/welcomeCookie';

/**
 * Server read of the one-shot bn-welcome cookie (set at login). When present, the /app server layout
 * renders the welcome overlay in the FIRST HTML paint — so the branded moment covers Backstage from
 * frame one (no client-side "Backstage → overlay" flash). The client overlay clears the cookie on
 * mount so it fires exactly once.
 */
export async function readWelcomeCookie(): Promise<boolean> {
  try {
    const store = await cookies();
    return store.get(WELCOME_COOKIE)?.value === '1';
  } catch {
    return false;
  }
}
