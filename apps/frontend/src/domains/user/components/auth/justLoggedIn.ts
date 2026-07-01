'use client';

/**
 * One-shot "the user just logged in" flag, backed by sessionStorage.
 *
 * WHY sessionStorage: it survives same-tab top-level navigations (including the OAuth round-trip
 * through Google) but is scoped to the tab and cleared when consumed — so the welcome overlay fires
 * exactly once on a fresh login and NEVER on a normal page load / refresh.
 *
 * WHERE it's set (covers every login method uniformly):
 *  - OAuth: at signInWithOAuth INITIATION (client), because the code exchange is server-side —
 *    the flag persists in the tab through Google → /auth/callback → /backstage.
 *  - Email/password + magic-link: at the client login-success / callback point.
 * WHERE it's read: the AuthWelcomeOverlay on the /app shell, once on mount.
 */
const KEY = 'bn-just-logged-in';

export function markJustLoggedIn(): void {
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(KEY, '1');
    }
  } catch {
    // sessionStorage can throw in private/blocked contexts — the overlay just won't show; harmless.
  }
}

/** Read-and-clear: returns true at most once per fresh login, then resets so a refresh won't re-fire. */
export function consumeJustLoggedIn(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const v = window.sessionStorage.getItem(KEY);
    if (v) {
      window.sessionStorage.removeItem(KEY);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}
