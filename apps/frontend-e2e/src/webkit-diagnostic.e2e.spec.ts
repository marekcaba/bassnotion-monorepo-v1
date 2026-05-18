/**
 * Webkit React Query Diagnostic Test
 *
 * This test provides comprehensive visibility into Webkit behavior:
 * - Console logs (all types)
 * - Network requests/responses
 * - DOM state at different checkpoints
 * - React Query state (via DOM attributes)
 *
 * Run with: pnpm playwright test webkit-diagnostic --browser=webkit
 */

import { test, expect } from './fixtures';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Webkit React Query Diagnostic', () => {
  test('diagnose query execution and data loading', async ({
    page,
    browserName,
  }) => {
    // Only run for Webkit
    test.skip(browserName !== 'webkit', 'Webkit-only diagnostic test');

    const logs: string[] = [];
    const requests: string[] = [];
    const responses: string[] = [];

    // ========== STEP 1: Set up monitoring ==========

    // Capture ALL console output
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      logs.push(`[${type.toUpperCase()}] ${text}`);
      console.log(`[WEBKIT ${type.toUpperCase()}]`, text);
    });

    // Capture page errors
    page.on('pageerror', (error) => {
      const msg = `[PAGE ERROR] ${error.message}\n${error.stack}`;
      logs.push(msg);
      console.error('[WEBKIT PAGE ERROR]', error);
    });

    // Capture network requests
    page.on('request', (request) => {
      const url = request.url();
      requests.push(`${request.method()} ${url}`);
      if (
        url.includes('tutorial') ||
        url.includes('exercise') ||
        url.includes('api')
      ) {
        console.log('[WEBKIT REQUEST]', request.method(), url);
      }
    });

    // Capture network responses
    page.on('response', (response) => {
      const url = response.url();
      responses.push(`${response.status()} ${url}`);
      if (
        url.includes('tutorial') ||
        url.includes('exercise') ||
        url.includes('api')
      ) {
        console.log('[WEBKIT RESPONSE]', response.status(), url);
      }
    });

    // Capture failed requests
    page.on('requestfailed', (request) => {
      const msg = `[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`;
      logs.push(msg);
      console.error(
        '[WEBKIT REQUEST FAILED]',
        request.url(),
        request.failure()?.errorText,
      );
    });

    // ========== STEP 2: Navigate to page ==========

    console.log('\n========== WEBKIT DIAGNOSTIC TEST STARTED ==========\n');
    console.log('Navigating to tutorial page...');

    await page.goto(
      `${BASE_URL}/library/how-to-find-notes-on-the-bass-fretboard`,
      {
        waitUntil: 'domcontentloaded',
      },
    );

    console.log('Page loaded, waiting for network idle...');
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {
      console.log('Network idle timeout (this is OK)');
    });

    // ========== STEP 3: Initial state capture (2s) ==========

    console.log('\n--- Checkpoint 1: 2s after load ---');
    await page.waitForTimeout(2000);

    const state2s = await page.evaluate(() => {
      return {
        // Page basics
        title: document.title,
        url: window.location.href,
        bodyLength: document.body.innerHTML.length,

        // Check for key elements
        hasH1: !!document.querySelector('h1'),
        hasH4: !!document.querySelector('h4'),
        h4Contents: Array.from(document.querySelectorAll('h4')).map((h) =>
          h.textContent?.trim(),
        ),

        // Check for loading/error states
        hasLoadingText: document.body.innerText.includes('Loading'),
        hasErrorText:
          document.body.innerText.includes('Error') ||
          document.body.innerText.includes('error'),

        // Check for React Query debug element
        hasRqDebug: !!document.getElementById('rq-debug'),
        rqDebugAttrs: (() => {
          const el = document.getElementById('rq-debug');
          if (!el) return null;
          return Object.fromEntries(
            Array.from(el.attributes).map((a) => [a.name, a.value]),
          );
        })(),

        // Check window objects
        hasReactQuery: !!(window as any).__REACT_QUERY_CLIENT__,
        hasNavigation: typeof (window as any).navigation !== 'undefined',
        userAgent: navigator.userAgent,
      };
    });

    console.log('State at 2s:', JSON.stringify(state2s, null, 2));

    // ========== STEP 4: Mid-point state capture (10s) ==========

    console.log('\n--- Checkpoint 2: 10s after load ---');
    await page.waitForTimeout(8000); // Additional 8s (total 10s)

    const state10s = await page.evaluate(() => {
      return {
        hasH4: !!document.querySelector('h4'),
        h4Contents: Array.from(document.querySelectorAll('h4')).map((h) =>
          h.textContent?.trim(),
        ),
        hasLoadingText: document.body.innerText.includes('Loading'),
        hasErrorText: document.body.innerText.includes('Error'),
        rqDebugAttrs: (() => {
          const el = document.getElementById('rq-debug');
          if (!el) return null;
          return Object.fromEntries(
            Array.from(el.attributes).map((a) => [a.name, a.value]),
          );
        })(),
      };
    });

    console.log('State at 10s:', JSON.stringify(state10s, null, 2));

    // ========== STEP 5: Final state capture (20s) ==========

    console.log('\n--- Checkpoint 3: 20s after load ---');
    await page.waitForTimeout(10000); // Additional 10s (total 20s)

    const state20s = await page.evaluate(() => {
      return {
        hasH4: !!document.querySelector('h4'),
        h4Contents: Array.from(document.querySelectorAll('h4')).map((h) =>
          h.textContent?.trim(),
        ),
        hasLoadingText: document.body.innerText.includes('Loading'),
        hasErrorText: document.body.innerText.includes('Error'),
        rqDebugAttrs: (() => {
          const el = document.getElementById('rq-debug');
          if (!el) return null;
          return Object.fromEntries(
            Array.from(el.attributes).map((a) => [a.name, a.value]),
          );
        })(),
        // Sample of actual body text
        bodyTextSample: document.body.innerText.substring(0, 500),
      };
    });

    console.log('State at 20s:', JSON.stringify(state20s, null, 2));

    // ========== STEP 6: Analyze and report findings ==========

    console.log('\n========== DIAGNOSTIC REPORT ==========\n');

    console.log('--- Console Logs Summary ---');
    console.log(`Total logs captured: ${logs.length}`);
    const reactQueryLogs = logs.filter(
      (l) =>
        l.includes('ReactQueryProvider') ||
        l.includes('QueryCache') ||
        l.includes('useTutorialExercises'),
    );
    console.log(`React Query related logs: ${reactQueryLogs.length}`);
    if (reactQueryLogs.length > 0) {
      console.log('Sample React Query logs:');
      reactQueryLogs.slice(0, 10).forEach((log) => console.log('  ', log));
    }

    console.log('\n--- Network Activity Summary ---');
    console.log(`Total requests: ${requests.length}`);
    console.log(`Total responses: ${responses.length}`);

    const apiRequests = requests.filter(
      (r) =>
        r.includes('tutorial') || r.includes('exercise') || r.includes('/api/'),
    );
    console.log(`API requests: ${apiRequests.length}`);
    if (apiRequests.length > 0) {
      console.log('API calls made:');
      apiRequests.forEach((req) => console.log('  ', req));
    } else {
      console.log('❌ NO API REQUESTS DETECTED');
    }

    const apiResponses = responses.filter(
      (r) =>
        r.includes('tutorial') || r.includes('exercise') || r.includes('/api/'),
    );
    if (apiResponses.length > 0) {
      console.log('API responses received:');
      apiResponses.forEach((res) => console.log('  ', res));
    }

    console.log('\n--- State Evolution ---');
    console.log(
      '2s:  h4 elements:',
      state2s.h4Contents.length,
      state2s.h4Contents,
    );
    console.log(
      '10s: h4 elements:',
      state10s.h4Contents.length,
      state10s.h4Contents,
    );
    console.log(
      '20s: h4 elements:',
      state20s.h4Contents.length,
      state20s.h4Contents,
    );

    console.log('\n--- React Query Debug State ---');
    console.log('2s:  ', state2s.rqDebugAttrs || 'NO DEBUG ELEMENT');
    console.log('10s: ', state10s.rqDebugAttrs || 'NO DEBUG ELEMENT');
    console.log('20s: ', state20s.rqDebugAttrs || 'NO DEBUG ELEMENT');

    console.log('\n--- Critical Findings ---');

    if (reactQueryLogs.length === 0) {
      console.log('❌ FINDING: No React Query logs captured');
      console.log('   POSSIBLE CAUSES:');
      console.log('   1. ReactQueryProvider not mounting in Webkit');
      console.log('   2. console.log calls not being forwarded by Playwright');
      console.log('   3. Component rendering but console blocked');
    }

    if (apiRequests.length === 0) {
      console.log('❌ FINDING: No API requests made for tutorial data');
      console.log('   ROOT CAUSE: React Query queryFn never executed');
      console.log(
        '   IMPLICATION: Confirms React Query v5 + Webkit incompatibility',
      );
    }

    if (state20s.hasLoadingText) {
      console.log('⚠️  FINDING: Page stuck in loading state after 20s');
      console.log('   IMPLICATION: Query never completes or transitions');
    }

    if (!state20s.hasH4 && apiResponses.length > 0) {
      console.log('⚠️  FINDING: API responded but h4 not rendered');
      console.log('   POSSIBLE CAUSE: React rendering issue in Webkit');
    }

    if (state20s.hasH4 && state20s.h4Contents.includes('Harmony')) {
      console.log('✅ FINDING: Page loaded successfully!');
      console.log('   IMPLICATION: Issue may have been fixed or intermittent');
    }

    if (state20s.hasErrorText) {
      console.log('❌ FINDING: Error state detected');
      console.log('   Error text sample:', state20s.bodyTextSample);
    }

    console.log('\n========================================\n');

    // Take screenshot for visual inspection
    await page.screenshot({
      path: `./webkit-diagnostic-${Date.now()}.png`,
      fullPage: true,
    });
    console.log('Screenshot saved to: webkit-diagnostic-<timestamp>.png');

    // This test always passes - it's for diagnostics only
    expect(true).toBe(true);
  });
});
