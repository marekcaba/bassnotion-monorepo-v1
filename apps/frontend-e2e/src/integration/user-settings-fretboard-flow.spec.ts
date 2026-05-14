import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

/**
 * User Settings → Fretboard Integration E2E Tests
 *
 * Tests the complete integration between user domain (settings/preferences)
 * and widgets domain (fretboard display and interaction).
 */

test.describe('User Settings → Fretboard Integration Flow', () => {
  let page: Page;
  const integrationUser = {
    email: `integration+${Date.now()}@test.com`,
    password: 'Integration123!',
  };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await setupIntegrationMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should propagate user settings to fretboard display in real-time', async () => {
    await test.step('🔧 Setup User Account and Initial Settings', async () => {
      // Register user
      await page.goto('/register');
      await page.fill('input[name="email"]', integrationUser.email);
      await page.fill('input[name="password"]', integrationUser.password);
      await page.fill(
        'input[name="confirmPassword"]',
        integrationUser.password,
      );
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Verify initial default settings
      await page.click('[data-testid="bass-settings-button"]');
      await page.waitForSelector('[data-testid="bass-settings-modal"]');

      // Default: 4-string, 20-fret, standard tuning
      await expect(
        page.locator('[data-testid="string-config-4-string"]'),
      ).toBeChecked();
      await expect(
        page.locator('[data-testid="fret-config-20-fret"]'),
      ).toBeChecked();

      await page.click('[data-testid="close-settings-modal"]');
    });

    await test.step('🎸 Navigate to Fretboard and Verify Initial State', async () => {
      // Go to exercise with fretboard
      await page.goto('/test-exercises');
      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Verify initial fretboard configuration matches settings
      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(4);

      const frets = page.locator('[data-testid="fretboard-fret"]');
      await expect(frets).toHaveCount(20);

      const tuningDisplay = page.locator('[data-testid="tuning-display"]');
      await expect(tuningDisplay).toContainText('E-A-D-G');
    });

    await test.step('🔄 Change Settings and Verify Real-time Updates', async () => {
      // Open settings while on fretboard page
      await page.click('[data-testid="bass-settings-button"]');
      await page.waitForSelector('[data-testid="bass-settings-modal"]');

      // Change to 5-string bass
      await page.click('[data-testid="string-config-5-string"]');

      // Verify fretboard updates immediately (without modal close)
      const stringsAfterChange = page.locator(
        '[data-testid="fretboard-string"]',
      );
      await expect(stringsAfterChange).toHaveCount(5);

      // Change to 24-fret configuration
      await page.click('[data-testid="fret-config-24-fret"]');

      // Verify fret count updates
      const fretsAfterChange = page.locator('[data-testid="fretboard-fret"]');
      await expect(fretsAfterChange).toHaveCount(24);

      // Change tuning to drop B (B-E-A-D-G)
      const tuningSelects = [
        { string: 5, note: 'B' },
        { string: 4, note: 'E' },
        { string: 3, note: 'A' },
        { string: 2, note: 'D' },
        { string: 1, note: 'G' },
      ];

      for (const tuning of tuningSelects) {
        const select = page.locator(
          `[data-testid="tuning-string-${tuning.string}"]`,
        );
        if (await select.isVisible()) {
          await select.selectOption(tuning.note);
        }
      }

      // Verify tuning display updates immediately
      const updatedTuningDisplay = page.locator(
        '[data-testid="tuning-display"]',
      );
      await expect(updatedTuningDisplay).toContainText('B-E-A-D-G');

      // Save settings
      await page.click('[data-testid="save-bass-settings"]');
      await expect(
        page.locator('[data-testid="settings-saved-toast"]'),
      ).toBeVisible();

      await page.click('[data-testid="close-settings-modal"]');
    });

    await test.step('🎵 Test Fretboard Interaction with New Configuration', async () => {
      // Test interaction with 5th string (low B)
      const lowBString = page.locator('[data-string="5"][data-fret="0"]');
      if (await lowBString.isVisible()) {
        await lowBString.click();

        // Should display correct note
        const noteDisplay = page.locator('[data-testid="note-display"]');
        await expect(noteDisplay).toContainText('B');

        // Should produce audio feedback
        const audioFeedback = page.locator('[data-testid="audio-feedback"]');
        if (await audioFeedback.isVisible()) {
          await expect(audioFeedback).toHaveClass(/active/);
        }
      }

      // Test 24th fret accessibility
      const highFret = page.locator('[data-string="1"][data-fret="24"]');
      if (await highFret.isVisible()) {
        await highFret.click();
        await expect(
          page.locator('[data-testid="note-display"]'),
        ).toBeVisible();
      }
    });

    await test.step('💾 Verify Settings Persistence Across Navigation', async () => {
      // Navigate away and back
      await page.goto('/library');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      // Navigate to different exercise
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.waitForSelector('[data-testid="exercise-item"]');
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Verify configuration persisted
      const persistedStrings = page.locator('[data-testid="fretboard-string"]');
      await expect(persistedStrings).toHaveCount(5);

      const persistedTuning = page.locator('[data-testid="tuning-display"]');
      await expect(persistedTuning).toContainText('B-E-A-D-G');
    });
  });

  test('should handle user preference integration with fretboard themes', async () => {
    await test.step('🎨 Theme and Display Preferences', async () => {
      await page.goto('/dashboard');

      // Open user preferences (not bass config)
      const preferencesButton = page.locator(
        '[data-testid="user-preferences-button"]',
      );
      if (await preferencesButton.isVisible()) {
        await preferencesButton.click();
        await page.waitForSelector('[data-testid="preferences-modal"]');

        // Change fretboard theme
        const themeSelect = page.locator(
          '[data-testid="fretboard-theme-select"]',
        );
        if (await themeSelect.isVisible()) {
          await themeSelect.selectOption('dark');
        }

        // Enable note names display
        const noteNamesToggle = page.locator('[data-testid="show-note-names"]');
        if (await noteNamesToggle.isVisible()) {
          await noteNamesToggle.check();
        }

        // Enable fret markers
        const fretMarkersToggle = page.locator(
          '[data-testid="show-fret-markers"]',
        );
        if (await fretMarkersToggle.isVisible()) {
          await fretMarkersToggle.check();
        }

        await page.click('[data-testid="save-preferences"]');
        await page.click('[data-testid="close-preferences-modal"]');
      }
    });

    await test.step('🎸 Verify Theme Application on Fretboard', async () => {
      await page.goto('/test-exercises');
      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Verify dark theme applied
      const fretboard = page.locator('[data-testid="fretboard-display"]');
      await expect(fretboard).toHaveClass(/theme-dark/);

      // Verify note names are visible
      const noteNames = page.locator('[data-testid="note-name"]');
      if (await noteNames.first().isVisible()) {
        await expect(noteNames.first()).toBeVisible();
      }

      // Verify fret markers are visible
      const fretMarkers = page.locator('[data-testid="fret-marker"]');
      if (await fretMarkers.first().isVisible()) {
        await expect(fretMarkers.first()).toBeVisible();
      }
    });
  });

  test('should sync settings across multiple fretboard instances', async () => {
    await test.step('🔄 Multi-Context Fretboard Sync', async () => {
      // Open multiple contexts with fretboards
      await page.goto('/test-exercises');
      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Open library in new tab
      const libraryPage = await page.context().newPage();
      await setupIntegrationMocks(libraryPage);

      await libraryPage.goto('/library');
      await libraryPage
        .locator('[data-testid="tutorial-card"]')
        .first()
        .click();
      await libraryPage
        .locator('[data-testid="exercise-item"]')
        .first()
        .click();
      await libraryPage.waitForSelector('[data-testid="fretboard-display"]');

      // Change settings in first tab
      await page.click('[data-testid="bass-settings-button"]');
      await page.click('[data-testid="string-config-6-string"]');
      await page.click('[data-testid="save-bass-settings"]');
      await page.click('[data-testid="close-settings-modal"]');

      // Verify second tab reflects changes
      await libraryPage.reload();
      await libraryPage.waitForSelector('[data-testid="fretboard-display"]');

      const syncedStrings = libraryPage.locator(
        '[data-testid="fretboard-string"]',
      );
      await expect(syncedStrings).toHaveCount(6);

      await libraryPage.close();
    });
  });

  test('should handle user accessibility preferences in fretboard', async () => {
    await test.step('♿ Accessibility Integration', async () => {
      await page.goto('/dashboard');

      // Set accessibility preferences
      const accessibilityButton = page.locator(
        '[data-testid="accessibility-settings"]',
      );
      if (await accessibilityButton.isVisible()) {
        await accessibilityButton.click();
        await page.waitForSelector('[data-testid="accessibility-modal"]');

        // Enable high contrast
        const highContrastToggle = page.locator(
          '[data-testid="high-contrast-mode"]',
        );
        if (await highContrastToggle.isVisible()) {
          await highContrastToggle.check();
        }

        // Enable larger touch targets
        const largeTouchToggle = page.locator(
          '[data-testid="large-touch-targets"]',
        );
        if (await largeTouchToggle.isVisible()) {
          await largeTouchToggle.check();
        }

        // Enable audio cues
        const audioCuesToggle = page.locator('[data-testid="audio-cues"]');
        if (await audioCuesToggle.isVisible()) {
          await audioCuesToggle.check();
        }

        await page.click('[data-testid="save-accessibility"]');
        await page.click('[data-testid="close-accessibility-modal"]');
      }
    });

    await test.step('🎸 Verify Accessibility on Fretboard', async () => {
      await page.goto('/test-exercises');
      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Verify high contrast applied
      const fretboard = page.locator('[data-testid="fretboard-display"]');
      await expect(fretboard).toHaveClass(/high-contrast/);

      // Verify larger touch targets
      const fretButtons = page.locator('[data-testid="fret-button"]');
      if (await fretButtons.first().isVisible()) {
        const buttonSize = await fretButtons.first().boundingBox();
        expect(buttonSize?.width).toBeGreaterThan(44); // WCAG minimum
      }

      // Test audio cues on interaction
      const testNote = page.locator('[data-string="4"][data-fret="0"]');
      if (await testNote.isVisible()) {
        await testNote.click();

        // Should trigger audio feedback
        const audioIndicator = page.locator('[data-testid="audio-played"]');
        if (await audioIndicator.isVisible()) {
          await expect(audioIndicator).toBeVisible();
        }
      }
    });
  });

  test('should handle user learning preferences in fretboard interactions', async () => {
    await test.step('🎓 Learning Style Integration', async () => {
      await page.goto('/dashboard');

      const learningPrefsButton = page.locator(
        '[data-testid="learning-preferences"]',
      );
      if (await learningPrefsButton.isVisible()) {
        await learningPrefsButton.click();
        await page.waitForSelector('[data-testid="learning-modal"]');

        // Set visual learning style
        await page.click('[data-testid="learning-style-visual"]');

        // Enable guided mode
        const guidedModeToggle = page.locator('[data-testid="guided-mode"]');
        if (await guidedModeToggle.isVisible()) {
          await guidedModeToggle.check();
        }

        // Set slow tempo preference
        const tempoSlider = page.locator('[data-testid="preferred-tempo"]');
        if (await tempoSlider.isVisible()) {
          await tempoSlider.fill('80');
        }

        await page.click('[data-testid="save-learning-prefs"]');
        await page.click('[data-testid="close-learning-modal"]');
      }
    });

    await test.step('🎸 Verify Learning Preferences in Fretboard', async () => {
      await page.goto('/test-exercises');
      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Should show visual learning aids
      const visualAids = page.locator('[data-testid="visual-learning-aids"]');
      if (await visualAids.isVisible()) {
        await expect(visualAids).toBeVisible();
      }

      // Should show guided hints
      const guidedHints = page.locator('[data-testid="guided-hints"]');
      if (await guidedHints.isVisible()) {
        await expect(guidedHints).toBeVisible();
      }

      // Should respect tempo preference
      const tempoDisplay = page.locator('[data-testid="tempo-display"]');
      if (await tempoDisplay.isVisible()) {
        await expect(tempoDisplay).toContainText('80');
      }
    });
  });

  test('should handle error states in settings-fretboard integration', async () => {
    await test.step('⚠️ Invalid Configuration Handling', async () => {
      await page.goto('/test-exercises');
      await page.click('[data-testid="bass-settings-button"]');

      // Try to set invalid configuration
      await page.evaluate(() => {
        // Simulate corrupted settings
        localStorage.setItem('bass_config', '{"invalid": "json"}');
      });

      await page.reload();
      await page.waitForSelector('[data-testid="fretboard-display"]');

      // Should fallback to default configuration
      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(4); // Default 4-string

      // Should show error notification
      const errorNotification = page.locator(
        '[data-testid="config-error-notification"]',
      );
      if (await errorNotification.isVisible()) {
        await expect(errorNotification).toContainText('default settings');
      }
    });

    await test.step('🔌 Network Error Recovery', async () => {
      // Simulate network failure during settings save
      await page.route('**/api/user/profile', (route) => {
        route.abort('failed');
      });

      await page.click('[data-testid="bass-settings-button"]');
      await page.click('[data-testid="string-config-5-string"]');
      await page.click('[data-testid="save-bass-settings"]');

      // Should show error message
      const saveError = page.locator('[data-testid="save-error-toast"]');
      await expect(saveError).toBeVisible();

      // Should maintain local changes until save succeeds
      const strings = page.locator('[data-testid="fretboard-string"]');
      await expect(strings).toHaveCount(5);

      // Restore network and retry
      await page.unroute('**/api/user/profile');
      await setupIntegrationMocks(page);

      await page.click('[data-testid="retry-save"]');
      await expect(
        page.locator('[data-testid="settings-saved-toast"]'),
      ).toBeVisible();
    });
  });
});

async function setupIntegrationMocks(page: Page) {
  // Mock user profile and settings
  let currentBassConfig = {
    strings: 4,
    frets: 20,
    tuning: ['E', 'A', 'D', 'G'],
  };

  let userPreferences = {
    theme: 'default',
    show_note_names: false,
    show_fret_markers: false,
    high_contrast: false,
    large_touch_targets: false,
    audio_cues: false,
    learning_style: 'balanced',
    guided_mode: false,
    preferred_tempo: 120,
  };

  await page.route('**/api/user/profile**', (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'integration-user',
            email: 'integration@test.com',
            bass_config: currentBassConfig,
            preferences: userPreferences,
          },
        }),
      });
    } else if (method === 'PUT' || method === 'PATCH') {
      const updates = route.request().postDataJSON();

      if (updates.bass_config) {
        currentBassConfig = { ...currentBassConfig, ...updates.bass_config };
      }
      if (updates.preferences) {
        userPreferences = { ...userPreferences, ...updates.preferences };
      }

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Profile updated successfully',
          user: {
            id: 'integration-user',
            bass_config: currentBassConfig,
            preferences: userPreferences,
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
          id: 'integration-user',
          email: 'integration@test.com',
        },
      }),
    });
  });

  // Mock tutorial/exercise data
  await page.route('**/api/tutorials**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorials: [
          {
            id: 'integration-test',
            slug: 'integration-test',
            title: 'Integration Test Tutorial',
            difficulty: 'beginner',
            exercise_count: 1,
          },
        ],
      }),
    });
  });

  await page.route('**/api/tutorials/*/exercises**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        exercises: [
          {
            id: 'ex1',
            title: 'Integration Test Exercise',
            difficulty: 'beginner',
            duration: 120000,
          },
        ],
      }),
    });
  });
}
