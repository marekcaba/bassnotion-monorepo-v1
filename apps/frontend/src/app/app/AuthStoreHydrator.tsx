'use client';

import { useRef } from 'react';
import { useAuthStore } from '@/domains/user/hooks/use-auth';

/**
 * AuthStoreHydrator (P3) — seeds the SSR-verified auth verdict into the Zustand auth store
 * SYNCHRONOUSLY on the client's first render, so `isReady`/`isAuthenticated` are true on first
 * paint for a logged-in member (killing the auth-resolution flash on the /app shell).
 *
 * `serverAuthed` comes from the server layout's getServerAuth() (a verified getUser() over the P1
 * cookie). We seed it in the RENDER phase (not an effect) via a one-shot ref guard, so it lands
 * before children read useAuth on first paint — an effect would run one tick too late and the flash
 * would survive. Renders null.
 *
 * Only ever seeds TRUE. A logged-out request passes serverAuthed=false → no-op (the store's own
 * default is false, and AuthProvider.reset() keeps it false), so this can only pull the authed
 * verdict EARLIER, never assert auth the server didn't confirm.
 */
export function AuthStoreHydrator({ serverAuthed }: { serverAuthed: boolean }) {
  const seeded = useRef(false);
  if (!seeded.current && serverAuthed) {
    seeded.current = true;
    // Set outside React's render reconciliation is safe for Zustand (external store); guarded to
    // run exactly once so we don't clobber a later real sign-out within the same mount.
    useAuthStore.getState().setServerAuthed(true);
  }
  return null;
}
