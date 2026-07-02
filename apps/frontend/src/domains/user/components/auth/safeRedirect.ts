/**
 * Open-redirect guard for the post-login `?redirect=` param, shared by BOTH the client login page
 * (email/password/magic-link) and the SERVER OAuth callback route (`next=`). Neutral module (NO
 * 'use client') so the server importing it gets the real functions, not a client-reference proxy —
 * see the [[use-client-const-server-import-proxy]] footgun.
 *
 * We only ever redirect a freshly-authenticated user to a CLEAN in-app path (the user-facing URLs
 * that middleware rewrites onto /app/*). Anything else — an absolute URL, protocol-relative `//evil`,
 * a backslash trick, or a path outside the app tree — is rejected so a crafted `?redirect=` link can
 * never bounce the user to an attacker origin or an unexpected page.
 */

// The clean top-level segments that middleware rewrites onto /app/* (mirrors APP_ROUTES in
// middleware.ts) plus '/college' (the label alias for /app/bassment) and '/' (Backstage home).
// Kept as a set of FIRST segments so deep paths (/tutorials/<slug>, /store/<slug>, /college/<slug>,
// /gigs/<goal>/<id>) are covered by prefix.
const ALLOWED_APP_SEGMENTS = new Set([
  'backstage',
  'gym',
  'gigs',
  'settings',
  'studio',
  'welcome',
  'store',
  'tutorials',
  'college',
]);

/**
 * Returns `raw` if it's a safe internal destination to redirect to after login, else `null`.
 * Safe = a same-origin absolute path ('/...') whose first segment is an allowed app route.
 * Bare '/' (Backstage home) is allowed. Callers fall back to their default when this returns null.
 */
export function safeRedirectPath(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Must be a plain absolute path. Reject protocol-relative ('//host'), backslash variants
  // ('/\\host' → some browsers treat as '//host'), and any scheme/host.
  if (!raw.startsWith('/')) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  // A literal control char or whitespace has no business in a path we generate.
  if (/[\x00-\x1f\x7f]/.test(raw)) return null;

  // Strip query/hash for the allowlist check, but preserve them in the returned value so a
  // destination like `/gigs/scales/abc?take=1` keeps its params. (`raw` starts with '/', so
  // split always yields a leading element; `?? ''` satisfies noUncheckedIndexedAccess.)
  const pathOnly = raw.split(/[?#]/)[0] ?? '';

  // Bare Backstage home.
  if (pathOnly === '/') return raw;

  const firstSegment = pathOnly.split('/')[1] ?? '';
  return ALLOWED_APP_SEGMENTS.has(firstSegment) ? raw : null;
}
