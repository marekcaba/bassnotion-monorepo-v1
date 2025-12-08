import { defineConfig, devices } from '@playwright/test';
// import { workspaceRoot } from '@nx/devkit';

// For CI, you may want to set BASE_URL to the deployed app URL
// For local testing, use the dev server
const baseURL = process.env['BASE_URL'] || 'http://localhost:3001';

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './src',
  /* Retry flaky tests automatically - helps with resource contention when running many tests */
  retries: process.env.CI ? 2 : 1, // Retry twice in CI, once locally
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    baseURL,
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
  },
  /* Run your local dev server before starting the tests */
  // webServer: {
  //   command: 'pnpm nx serve @bassnotion/frontend',
  //   url: baseURL,
  //   reuseExistingServer: !process.env.CI,
  //   cwd: workspaceRoot,
  //   timeout: 120000, // 2 minutes
  // },
  /* Configure projects for all 5 browsers (3 desktop + 2 mobile) */
  /* These override the NX preset default projects */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        // CRITICAL: Ignore HTTPS errors to bypass cached HSTS
        // The HSTS header was sending "always use HTTPS" for localhost:3001
        // Even after removing the header, Webkit remembers for 2 years
        ignoreHTTPSErrors: true,
        // Webkit-specific settings for stability
        launchOptions: {
          args: [
            '--disable-web-security', // Needed for CORS in local testing
            '--disable-features=TranslateUI', // Reduces UI noise
            '--disable-ipc-flooding-protection', // Allows high message volume
            '--no-sandbox', // Required for CI environments
            '--disable-setuid-sandbox', // Required for CI environments
            '--disable-dev-shm-usage', // Prevents /dev/shm issues in Docker/CI
          ],
          timeout: 60000, // Increase browser launch timeout
        },
        // Additional test-specific settings for webkit
        // CRITICAL: Increase actionTimeout to 45s for CoreServices initialization
        // ScrollTriggerLoader requires user interaction and Webkit is slower
        actionTimeout: 45000,
        navigationTimeout: 45000,
        video: 'off', // Disable video recording for webkit to reduce overhead
        screenshot: 'off', // Disable screenshots for webkit to reduce overhead
      },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        // CRITICAL: Ignore HTTPS errors to bypass cached HSTS
        ignoreHTTPSErrors: true,
        // Mobile webkit-specific settings
        launchOptions: {
          args: [
            '--disable-web-security', // Needed for CORS in local testing
            '--disable-features=TranslateUI', // Reduces UI noise
            '--disable-ipc-flooding-protection', // Allows high message volume
            '--no-sandbox', // Required for CI environments
            '--disable-setuid-sandbox', // Required for CI environments
            '--disable-dev-shm-usage', // Prevents /dev/shm issues in Docker/CI
          ],
          timeout: 60000, // Increase browser launch timeout
        },
        // Additional test-specific settings for mobile webkit
        // CRITICAL: Increase actionTimeout to 45s for CoreServices initialization
        // ScrollTriggerLoader requires user interaction and mobile Webkit is slower
        actionTimeout: 45000,
        navigationTimeout: 45000,
        video: 'off', // Disable video recording for mobile webkit
        screenshot: 'off', // Disable screenshots for mobile webkit
      },
    },
  ],
  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: '../../dist/apps/frontend-e2e/test-results',
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html', { outputFolder: '../../dist/apps/frontend-e2e/html-report' }],
    ['junit', { outputFile: '../../dist/apps/frontend-e2e/junit.xml' }],
    ['json', { outputFile: '../../dist/apps/frontend-e2e/test-results.json' }],
  ],
  /* Timeout settings */
  timeout: 30000, // 30 seconds
  expect: {
    timeout: 10000, // 10 seconds
  },
});
