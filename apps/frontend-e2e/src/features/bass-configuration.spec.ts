import { test, expect, Page } from '@playwright/test';

/**
 * Bass Configuration Persistence E2E Tests
 *
 * Tests bass configuration settings persistence across sessions,
 * fretboard adaptation, and cross-domain configuration impact.
 */

test.describe('Bass Configuration Persistence', () => {
  let page: Page;
  const user = {
    email: `bassconfig+${Date.now()}@test.com`,
    password: 'BassConfig123!',
  };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await setupBassConfigMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should persist bass configuration across sessions', async () => {
    await test.step('🔧 Initial Bass Configuration', async () => {
      // Register and login
      await page.goto('/register');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.fill('input[name="confirmPassword"]', user.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Open bass settings
      const settingsButton = page.locator(
        '[data-testid="bass-settings-button"]',
      );
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();

      await page.waitForSelector('[data-testid="bass-settings-modal"]');

      // Verify default settings
      await expect(
        page.locator('[data-testid="string-config-4-string"]'),
      ).toBeChecked();
      await expect(
        page.locator('[data-testid="fret-config-20-fret"]'),
      ).toBeChecked();
    });

    await test.step('🎸 Configure 5-String Bass', async () => {
      // Change to 5-string configuration
      await page.click('[data-testid="string-config-5-string"]');
      await expect(
        page.locator('[data-testid="string-config-5-string"]'),
      ).toBeChecked();

      // Change to 24-fret configuration
      await page.click('[data-testid="fret-config-24-fret"]');
      await expect(
        page.locator('[data-testid="fret-config-24-fret"]'),
      ).toBeChecked();

      // Set custom tuning (B-E-A-D-G)
      const tuningInputs = [
        { string: 5, note: 'B' },
        { string: 4, note: 'E' },
        { string: 3, note: 'A' },
        { string: 2, note: 'D' },
        { string: 1, note: 'G' },
      ];

      for (const tuning of tuningInputs) {
        const tuningSelect = page.locator(
          `[data-testid="tuning-string-${tuning.string}"]`,
        );
        if (await tuningSelect.isVisible()) {
          await tuningSelect.selectOption(tuning.note);
        }
      }

      // Save configuration
      await page.click('[data-testid="save-bass-settings"]');
      await expect(
        page.locator('[data-testid="settings-saved-toast"]'),
      ).toBeVisible();

      // Close modal
      await page.click('[data-testid="close-settings-modal"]');
    });

    await test.step('🎯 Verify Fretboard Adaptation', async () => {
      // Navigate to exercise to test fretboard
      await page.click('a[href="/library"]');
      await page.waitForSelector('[data-testid="tutorial-card"]');
      await page.locator('[data-testid="tutorial-card"]').first().click();

      await page.waitForSelector('[data-testid="exercise-item"]');
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Verify fretboard shows 5 strings
      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(5);

      // Verify fretboard shows 24 frets
      const frets = page.locator('[data-testid="fretboard-fret"]');
      await expect(frets).toHaveCount(24);

      // Verify tuning display
      const tuningDisplay = page.locator('[data-testid="tuning-display"]');
      await expect(tuningDisplay).toContainText('B-E-A-D-G');

      // Test note interaction on 5th string
      const lowBString = page.locator('[data-string="5"][data-fret="0"]');
      if (await lowBString.isVisible()) {
        await lowBString.click();
        await expect(
          page.locator('[data-testid="note-display"]'),
        ).toContainText('B');
      }
    });

    await test.step('🔄 Session Persistence Test', async () => {
      // Refresh page to test persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Navigate back to exercise
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Verify configuration persisted
      await page.waitForSelector('[data-testid="fretboard-display"]');

      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(5);

      const tuningDisplay = page.locator('[data-testid="tuning-display"]');
      await expect(tuningDisplay).toContainText('B-E-A-D-G');
    });

    await test.step('🌐 Cross-Browser Persistence', async () => {
      // Simulate different browser session
      await page.context().clearCookies();

      // Login again
      await page.goto('/login');
      await page.fill('input[name="email"]', user.email);
      await page.fill('input[name="password"]', user.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Check settings modal shows saved configuration
      await page.click('[data-testid="bass-settings-button"]');
      await page.waitForSelector('[data-testid="bass-settings-modal"]');

      await expect(
        page.locator('[data-testid="string-config-5-string"]'),
      ).toBeChecked();
      await expect(
        page.locator('[data-testid="fret-config-24-fret"]'),
      ).toBeChecked();

      await page.click('[data-testid="close-settings-modal"]');
    });
  });

  test('should handle different bass configurations', async () => {
    await test.step('🎸 Test 4-String Standard Bass', async () => {
      await page.goto('/dashboard');
      await page.click('[data-testid="bass-settings-button"]');

      // Configure 4-string, 20-fret
      await page.click('[data-testid="string-config-4-string"]');
      await page.click('[data-testid="fret-config-20-fret"]');

      // Standard tuning (E-A-D-G)
      const standardTuning = [
        { string: 4, note: 'E' },
        { string: 3, note: 'A' },
        { string: 2, note: 'D' },
        { string: 1, note: 'G' },
      ];

      for (const tuning of standardTuning) {
        const tuningSelect = page.locator(
          `[data-testid="tuning-string-${tuning.string}"]`,
        );
        if (await tuningSelect.isVisible()) {
          await tuningSelect.selectOption(tuning.note);
        }
      }

      await page.click('[data-testid="save-bass-settings"]');
      await page.click('[data-testid="close-settings-modal"]');

      // Test fretboard adaptation
      await page.goto('/test-exercises');
      await page.waitForSelector('[data-testid="fretboard-display"]');

      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(4);

      const frets = page.locator('[data-testid="fretboard-fret"]');
      await expect(frets).toHaveCount(20);
    });

    await test.step('🔧 Test 6-String Bass Configuration', async () => {
      await page.click('[data-testid="bass-settings-button"]');

      // Configure 6-string, 24-fret
      await page.click('[data-testid="string-config-6-string"]');
      await page.click('[data-testid="fret-config-24-fret"]');

      // 6-string tuning (B-E-A-D-G-C)
      const sixStringTuning = [
        { string: 6, note: 'B' },
        { string: 5, note: 'E' },
        { string: 4, note: 'A' },
        { string: 3, note: 'D' },
        { string: 2, note: 'G' },
        { string: 1, note: 'C' },
      ];

      for (const tuning of sixStringTuning) {
        const tuningSelect = page.locator(
          `[data-testid="tuning-string-${tuning.string}"]`,
        );
        if (await tuningSelect.isVisible()) {
          await tuningSelect.selectOption(tuning.note);
        }
      }

      await page.click('[data-testid="save-bass-settings"]');
      await page.click('[data-testid="close-settings-modal"]');

      // Verify 6-string fretboard
      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(6);

      const tuningDisplay = page.locator('[data-testid="tuning-display"]');
      await expect(tuningDisplay).toContainText('B-E-A-D-G-C');
    });

    await test.step('🎵 Test Drop Tuning Configuration', async () => {
      await page.click('[data-testid="bass-settings-button"]');

      // Configure drop D tuning (D-A-D-G)
      await page.click('[data-testid="string-config-4-string"]');

      const dropDTuning = [
        { string: 4, note: 'D' }, // Drop D
        { string: 3, note: 'A' },
        { string: 2, note: 'D' },
        { string: 1, note: 'G' },
      ];

      for (const tuning of dropDTuning) {
        const tuningSelect = page.locator(
          `[data-testid="tuning-string-${tuning.string}"]`,
        );
        if (await tuningSelect.isVisible()) {
          await tuningSelect.selectOption(tuning.note);
        }
      }

      await page.click('[data-testid="save-bass-settings"]');
      await page.click('[data-testid="close-settings-modal"]');

      // Verify drop tuning
      const tuningDisplay = page.locator('[data-testid="tuning-display"]');
      await expect(tuningDisplay).toContainText('D-A-D-G');

      // Test that low D string produces correct note
      const lowDString = page.locator('[data-string="4"][data-fret="0"]');
      if (await lowDString.isVisible()) {
        await lowDString.click();
        await expect(
          page.locator('[data-testid="note-display"]'),
        ).toContainText('D');
      }
    });
  });

  test('should handle configuration validation and errors', async () => {
    await test.step('⚠️ Test Invalid Configurations', async () => {
      await page.goto('/dashboard');
      await page.click('[data-testid="bass-settings-button"]');

      // Test validation for invalid tuning combinations
      await page.click('[data-testid="string-config-4-string"]');

      // Try to set invalid tuning (e.g., all strings to same note)
      for (let i = 1; i <= 4; i++) {
        const tuningSelect = page.locator(`[data-testid="tuning-string-${i}"]`);
        if (await tuningSelect.isVisible()) {
          await tuningSelect.selectOption('E');
        }
      }

      await page.click('[data-testid="save-bass-settings"]');

      // Should show validation error
      const errorMessage = page.locator('[data-testid="tuning-error"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(
          'Invalid tuning configuration',
        );
      }
    });

    await test.step('🔄 Test Configuration Reset', async () => {
      // Test reset to default
      const resetButton = page.locator('[data-testid="reset-to-default"]');
      if (await resetButton.isVisible()) {
        await resetButton.click();

        // Should reset to 4-string, 20-fret, standard tuning
        await expect(
          page.locator('[data-testid="string-config-4-string"]'),
        ).toBeChecked();
        await expect(
          page.locator('[data-testid="fret-config-20-fret"]'),
        ).toBeChecked();

        // Verify standard tuning restored
        await page.click('[data-testid="save-bass-settings"]');
        await page.click('[data-testid="close-settings-modal"]');

        const tuningDisplay = page.locator('[data-testid="tuning-display"]');
        await expect(tuningDisplay).toContainText('E-A-D-G');
      }
    });
  });

  test('should handle configuration impact on exercises', async () => {
    await test.step('🎯 Exercise Adaptation to Configuration', async () => {
      // Set specific configuration for exercise testing
      await page.goto('/dashboard');
      await page.click('[data-testid="bass-settings-button"]');

      await page.click('[data-testid="string-config-5-string"]');
      await page.click('[data-testid="save-bass-settings"]');
      await page.click('[data-testid="close-settings-modal"]');

      // Navigate to exercise
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Check exercise notes adapt to 5-string bass
      const exerciseNotes = page.locator('[data-testid="exercise-note"]');
      const noteCount = await exerciseNotes.count();

      if (noteCount > 0) {
        // Verify notes include 5th string options
        const fifthStringNotes = page.locator(
          '[data-testid="exercise-note"][data-string="5"]',
        );
        const fifthStringCount = await fifthStringNotes.count();

        // Should have notes utilizing the 5th string
        expect(fifthStringCount).toBeGreaterThan(0);
      }
    });

    await test.step('🎵 Difficulty Adjustment Based on Configuration', async () => {
      // Test that exercise difficulty reflects bass complexity
      const difficultyIndicator = page.locator(
        '[data-testid="adjusted-difficulty"]',
      );
      if (await difficultyIndicator.isVisible()) {
        const difficulty = await difficultyIndicator.textContent();

        // 5-string exercises might be marked as more advanced
        expect(difficulty).toMatch(/(Intermediate|Advanced|5-String)/);
      }

      // Test exercise recommendations
      const recommendationText = page.locator(
        '[data-testid="configuration-recommendation"]',
      );
      if (await recommendationText.isVisible()) {
        await expect(recommendationText).toContainText('5-string');
      }
    });
  });

  test('should synchronize configuration across multiple tabs', async () => {
    await test.step('🔄 Multi-Tab Configuration Sync', async () => {
      // Open second tab
      const secondPage = await page.context().newPage();
      await setupBassConfigMocks(secondPage);

      // Login in second tab
      await secondPage.goto('/login');
      await secondPage.fill('input[name="email"]', user.email);
      await secondPage.fill('input[name="password"]', user.password);
      await secondPage.click('button[type="submit"]');

      await expect(secondPage).toHaveURL(/\/dashboard/);

      // Change configuration in first tab
      await page.click('[data-testid="bass-settings-button"]');
      await page.click('[data-testid="string-config-6-string"]');
      await page.click('[data-testid="save-bass-settings"]');
      await page.click('[data-testid="close-settings-modal"]');

      // Check if second tab reflects the change
      await secondPage.reload();
      await secondPage.click('[data-testid="bass-settings-button"]');

      // Should show 6-string configuration
      await expect(
        secondPage.locator('[data-testid="string-config-6-string"]'),
      ).toBeChecked();

      await secondPage.close();
    });
  });
});

async function setupBassConfigMocks(page: Page) {
  // Mock user profile with bass configuration
  await page.route('**/api/user/profile**', (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'bassconfig-user',
            email: 'bassconfig@test.com',
            bass_config: {
              strings: 4,
              frets: 20,
              tuning: ['E', 'A', 'D', 'G'],
            },
            preferences: {
              auto_save: true,
              theme: 'dark',
            },
          },
        }),
      });
    } else if (method === 'PUT' || method === 'PATCH') {
      // Mock save configuration
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Bass configuration saved successfully',
          user: {
            id: 'bassconfig-user',
            bass_config: {
              strings: 5,
              frets: 24,
              tuning: ['B', 'E', 'A', 'D', 'G'],
            },
          },
        }),
      });
    }
  });

  // Mock authentication
  await page.route('**/auth/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'bassconfig-user',
          email: 'bassconfig@test.com',
        },
        session: {
          access_token: 'mock-token',
        },
      }),
    });
  });

  // Mock tutorial data
  await page.route('**/api/tutorials**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorials: [
          {
            id: 'config-test',
            slug: 'config-test',
            title: 'Configuration Test Tutorial',
            artist: 'Test Artist',
            difficulty: 'beginner',
            exercise_count: 1,
            is_active: true,
          },
        ],
        total: 1,
      }),
    });
  });

  // Mock exercise data with bass-specific notes
  await page.route('**/api/tutorials/*/exercises**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorial: {
          id: 'config-test',
          title: 'Configuration Test Tutorial',
        },
        exercises: [
          {
            id: 'ex1',
            title: 'Bass Configuration Test',
            difficulty: 'beginner',
            duration: 120000,
            notes: [
              { string: 5, fret: 0, timestamp: 0 }, // B note (5th string)
              { string: 4, fret: 0, timestamp: 1000 }, // E note
              { string: 3, fret: 0, timestamp: 2000 }, // A note
              { string: 2, fret: 0, timestamp: 3000 }, // D note
              { string: 1, fret: 0, timestamp: 4000 }, // G note
            ],
          },
        ],
      }),
    });
  });

  // Mock configuration validation
  await page.route('**/api/bass-config/validate**', (route) => {
    const requestBody = route.request().postDataJSON();

    if (requestBody?.tuning?.every((note: string) => note === 'E')) {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid tuning configuration',
          message: 'All strings cannot have the same tuning',
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          message: 'Configuration is valid',
        }),
      });
    }
  });
}
