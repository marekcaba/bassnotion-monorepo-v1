/**
 * Test-environment detection.
 *
 * Some startup paths (AuthProvider, Supabase client config, layout) have a
 * "mock / minimal" fallback meant for older Playwright specs that stub the
 * whole backend. That fallback must be OPT-IN only: detecting it from
 * `window.location.hostname === 'localhost'` or `navigator.webdriver` is too
 * broad — it disabled the real auth flow for ALL local development and made
 * real-auth E2E tests impossible (the auth state listener was skipped, so a
 * successful Supabase login never reached the Zustand store).
 *
 * Opt in by either:
 *   - setting `window.__playwright = true` in a Playwright init script, or
 *   - running under `NODE_ENV === 'test'` (Vitest unit tests).
 *
 * Real-auth E2E specs (e.g. auth-flow.spec.ts) deliberately do NOT set the
 * flag, so they exercise the production auth path.
 */
export function isMockTestEnv(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV === 'test';
  }
  return process.env.NODE_ENV === 'test' || window.__playwright === true;
}

/**
 * WebKit/Safari detection — used alongside isMockTestEnv() for browser-
 * specific startup tweaks.
 */
export function isWebkitBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return ua.includes('WebKit') || ua.includes('Safari');
}
