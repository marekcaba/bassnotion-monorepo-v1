import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
// import { workspaceRoot } from '@nx/devkit';
import { fileURLToPath } from 'url';

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
  ...nxE2EPreset(fileURLToPath(import.meta.url), { testDir: './src' }),
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
  /* Configure projects for major browsers - this overrides NX preset projects */
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
        // Webkit-specific settings for stability
        launchOptions: {
          slowMo: 200, // Increased slow motion for webkit stability
          args: [
            '--disable-web-security',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // Force single process for stability
          ],
          timeout: 60000, // Increase browser launch timeout
        },
        // Additional test-specific settings for webkit
        actionTimeout: 15000,
        navigationTimeout: 30000,
        video: 'off', // Disable video recording for webkit to reduce overhead
        screenshot: 'off', // Disable screenshots for webkit to reduce overhead
      },
    },
    // Test against mobile viewports.
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        // Mobile webkit-specific settings
        launchOptions: {
          slowMo: 200, // Increased slow motion for mobile webkit
          args: [
            '--disable-web-security',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding',
            '--disable-features=TranslateUI',
            '--disable-ipc-flooding-protection',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process', // Force single process for stability
          ],
          timeout: 60000, // Increase browser launch timeout
        },
        // Additional test-specific settings for mobile webkit
        actionTimeout: 15000,
        navigationTimeout: 30000,
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
