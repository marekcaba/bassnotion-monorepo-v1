/**
 * Shared Playwright test fixture for the legacy e2e specs.
 *
 * Most specs in this suite predate real-auth E2E testing and rely on the
 * app's "mock / minimal" startup fallback (AuthProvider skips its auth
 * listener, Supabase client uses minimal config, etc). That fallback is
 * now OPT-IN via `window.__playwright` — see
 * apps/frontend/src/shared/utils/testEnv.ts.
 *
 * This fixture sets `window.__playwright = true` before every page loads,
 * restoring the original behavior for all specs that import `test` from
 * here. Specs that need the REAL auth flow (auth-flow.spec.ts) import
 * `test` directly from '@playwright/test' instead and do NOT get the flag.
 */
import { test as base, expect } from '@playwright/test';

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      (window as unknown as { __playwright?: boolean }).__playwright = true;
    });
    await use(page);
  },
});

export { expect };
