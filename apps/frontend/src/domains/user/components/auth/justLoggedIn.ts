'use client';

import { WELCOME_COOKIE } from './welcomeCookie';

/**
 * One-shot "the user just logged in" signal, backed by a short-lived COOKIE (bn-welcome).
 *
 * WHY a cookie (not sessionStorage): the welcome overlay must be painted by the SERVER in the first
 * HTML — so the signal has to be readable on the request. A cookie is; sessionStorage isn't. The
 * server layout reads bn-welcome (see readWelcomeCookie in the server helper) and renders the
 * overlay in the initial paint, eliminating any client-side "Backstage → overlay" flash.
 *
 * WHERE it's set (covers every login method uniformly):
 *  - OAuth: the SERVER /auth/callback route sets it on its redirect response (client can't run there).
 *  - Email/password + magic-link: set here client-side (document.cookie) right before the redirect.
 * WHERE it's read: server-side in app/app/layout.tsx (first paint). WHERE it's cleared: the client
 * overlay clears it on mount (non-httpOnly) so it fires exactly once — never on a refresh.
 *
 * host-only, path=/, sameSite=lax (survives the OAuth top-level redirect), NOT httpOnly (the client
 * overlay clears it), short Max-Age (60s) as a belt-and-suspenders auto-expiry.
 */
// WELCOME_COOKIE is imported from the neutral './welcomeCookie' (see top) — it must NOT be defined
// in this 'use client' module, or the server reader would import a client-reference proxy, not the
// string. Server + client both import the constant from welcomeCookie.ts.

/** Client-side setter (email/magic-link). The OAuth server route sets the same cookie server-side. */
export function markJustLoggedIn(): void {
  try {
    if (typeof document === 'undefined') return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${WELCOME_COOKIE}=1; path=/; max-age=60; SameSite=Lax${secure}`;
  } catch {
    /* cookie blocked → overlay just won't show; harmless */
  }
}

/** Client-side clear (called by the overlay on mount so it fires exactly once). */
export function clearJustLoggedIn(): void {
  try {
    if (typeof document === 'undefined') return;
    document.cookie = `${WELCOME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}
