import { test, expect } from '@playwright/test';

/**
 * Post-deploy smoke test — the @smoke-tagged checks run by deploy.yml
 * after a staging/production deploy goes live.
 *
 * Run with: npx playwright test --grep @smoke
 *
 * BASE_URL  — deployed frontend URL (drives Playwright's baseURL).
 * API_URL   — deployed backend URL; the /api/health check is skipped when unset
 *             so local `pnpm test:e2e` runs don't fail without it.
 *
 * The auth state-transition guard in auth-flow.spec.ts also carries a @smoke
 * tag; together they form the deploy gate.
 */

const API_URL = process.env['API_URL'];

test.describe('Deploy smoke checks', () => {
  test('@smoke homepage responds 200', async ({ page }) => {
    const response = await page.goto('/', { waitUntil: 'commit' });
    expect(response?.status()).toBe(200);
  });

  test('@smoke backend /api/health is healthy', async ({ request }) => {
    test.skip(!API_URL, 'Set API_URL to the deployed backend URL to run');

    const response = await request.get(`${API_URL}/api/health`);
    expect(response.status()).toBe(200);

    const body = (await response.json()) as { status?: string };
    expect(body.status).toBe('healthy');
  });
});
