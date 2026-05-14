import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Auth state-transition smoke test.
 *
 * Unlike auth.spec.ts (which mocks the backend to test form validation),
 * this spec runs against the REAL backend to exercise the signin -> signout
 * state transitions and assert nothing alarming renders in between.
 *
 * Requires a seeded, email-confirmed test user — see .env.example.
 * Skipped automatically when E2E_TEST_EMAIL / E2E_TEST_PASSWORD are unset
 * so it never fails CI on a machine without credentials.
 */

const TEST_EMAIL = process.env['E2E_TEST_EMAIL'];
const TEST_PASSWORD = process.env['E2E_TEST_PASSWORD'];

// Console messages we expect and don't want to fail on. Browser autoplay
// policy always logs this for any Web Audio app that creates a context
// before a user gesture — it's not an app error.
const IGNORED_CONSOLE_PATTERNS = [
  /AudioContext was not allowed to start/i,
  /Download the React DevTools/i,
];

function isIgnorable(msg: ConsoleMessage): boolean {
  const text = msg.text();
  return IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text));
}

/**
 * Attaches console + pageerror listeners and returns a getter for collected
 * errors. Call this BEFORE navigating so nothing is missed.
 */
function collectErrors(page: Page): () => string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !isIgnorable(msg)) {
      errors.push(`console.error: ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });
  return () => errors;
}

test.describe('Auth state transitions', () => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    'Set E2E_TEST_EMAIL / E2E_TEST_PASSWORD in apps/frontend-e2e/.env to run',
  );

  test('logged-out user hitting /app is redirected to /login without an "Access Denied" flash', async ({
    page,
  }) => {
    const getErrors = collectErrors(page);

    await page.goto('/app');

    // Should end up on /login.
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    // The scary "Access Denied" card must never have rendered — AuthGuard
    // should show the neutral spinner fallback during the redirect instead.
    await expect(page.getByText('Access Denied')).toHaveCount(0);

    expect(getErrors(), 'no console errors during guarded redirect').toEqual(
      [],
    );
  });

  test('signin -> signout returns to /login with no dashboard flash or errors', async ({
    page,
  }) => {
    const getErrors = collectErrors(page);

    // --- Sign in ---
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_EMAIL!);
    await page.fill('input[name="password"]', TEST_PASSWORD!);
    await page.locator('button[type="submit"]').click();

    // Land on an authenticated route (dashboard or /app).
    await expect(page).toHaveURL(/\/(dashboard|app)/, { timeout: 20000 });

    // The signout control lives in UserIndicator with title="Sign out".
    const signOutButton = page.getByTitle('Sign out');
    await expect(signOutButton).toBeVisible({ timeout: 10000 });

    // --- Sign out ---
    // Watch for the regression we just fixed: during signout the old code
    // flashed the "Access Denied" card AND re-rendered the dashboard while
    // two navigations raced. Poll the DOM rapidly during the transition.
    let sawAccessDenied = false;
    const pollHandle = setInterval(async () => {
      try {
        const denied = await page
          .getByText('Access Denied')
          .count()
          .catch(() => 0);
        if (denied > 0) sawAccessDenied = true;
      } catch {
        // page may be mid-navigation — ignore
      }
    }, 50);

    await signOutButton.click();

    // Signout should land on /login (matches AuthGuard's redirect target).
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
    clearInterval(pollHandle);

    expect(sawAccessDenied, 'no "Access Denied" flash during signout').toBe(
      false,
    );

    // Session is actually gone: hitting an authed route bounces to /login.
    await page.goto('/app');
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

    expect(getErrors(), 'no console errors across signin->signout').toEqual(
      [],
    );
  });
});
