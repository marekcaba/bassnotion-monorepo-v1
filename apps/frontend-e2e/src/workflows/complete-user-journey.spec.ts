import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

/**
 * Complete User Journey E2E Tests
 *
 * Tests the full user experience from registration to tutorial completion,
 * ensuring seamless integration across all domains.
 */

test.describe('Complete User Journey Workflow', () => {
  let page: Page;
  const testUser = {
    email: `user+journey${Date.now()}@test.com`,
    password: 'UserJourney123!',
    name: 'Journey Test User',
  };

  test.beforeAll(async ({ browser }) => {
    // Create a new page for the entire journey
    const context = await browser.newContext();
    page = await context.newPage();

    // Set up comprehensive API mocking for the journey
    await setupApiMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should complete full user journey: register → browse → learn → practice', async () => {
    await test.step('🎯 User Registration and Onboarding', async () => {
      // Navigate to registration
      await page.goto('/register');
      await page.waitForLoadState('networkidle');

      // Fill registration form
      await page.fill('input[name="email"]', testUser.email);
      await page.fill('input[name="password"]', testUser.password);
      await page.fill('input[name="confirmPassword"]', testUser.password);

      // Submit registration
      await page.click('button[type="submit"]');

      // Wait for success and redirect to dashboard
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });

      // Verify welcome message
      await expect(page.getByText('Welcome to BassNotion')).toBeVisible();

      // Check user indicator shows logged in state
      await expect(
        page.locator('[data-testid="user-indicator"]'),
      ).toContainText(testUser.email);
    });

    await test.step('🎵 Browse Tutorial Library', async () => {
      // Navigate to library
      await page.click('a[href="/library"]');
      await expect(page).toHaveURL('/library');

      // Wait for tutorials to load
      await page.waitForSelector('[data-testid="tutorial-card"]');

      // Verify library page elements
      await expect(
        page.getByRole('heading', { name: 'Tutorial Library' }),
      ).toBeVisible();

      // Check tutorial cards are displayed
      const tutorialCards = page.locator('[data-testid="tutorial-card"]');
      await expect(tutorialCards).toHaveCount(3); // Based on our mock data

      // Verify tutorial information
      const firstTutorial = tutorialCards.first();
      await expect(
        firstTutorial.locator('[data-testid="tutorial-title"]'),
      ).toContainText('Billie Jean');
      await expect(
        firstTutorial.locator('[data-testid="tutorial-artist"]'),
      ).toContainText('Michael Jackson');
      await expect(
        firstTutorial.locator('[data-testid="tutorial-difficulty"]'),
      ).toContainText('Beginner');
    });

    await test.step('🎸 Select and Enter Tutorial', async () => {
      // Click on first tutorial
      const firstTutorial = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      await firstTutorial.click();

      // Should navigate to tutorial detail page
      await expect(page).toHaveURL(/\/library\/billie-jean/);

      // Wait for tutorial detail page to load
      await page.waitForSelector('[data-testid="tutorial-detail"]');

      // Verify tutorial information
      await expect(
        page.getByRole('heading', { name: 'Billie Jean' }),
      ).toBeVisible();
      await expect(page.getByText('Michael Jackson')).toBeVisible();

      // Check exercises are listed
      await expect(page.locator('[data-testid="exercise-list"]')).toBeVisible();
      const exercises = page.locator('[data-testid="exercise-item"]');
      await expect(exercises).toHaveCount(2); // Based on mock data

      // Verify first exercise details
      const firstExercise = exercises.first();
      await expect(
        firstExercise.locator('[data-testid="exercise-title"]'),
      ).toContainText('Basic Pattern');
      await expect(
        firstExercise.locator('[data-testid="exercise-duration"]'),
      ).toContainText('2:00');
    });

    await test.step('🎯 Start Exercise Practice', async () => {
      // Click on first exercise to start practicing
      const firstExercise = page
        .locator('[data-testid="exercise-item"]')
        .first();
      await firstExercise.click();

      // Should open exercise interface
      await page.waitForSelector('[data-testid="exercise-interface"]');

      // Verify exercise interface elements
      await expect(
        page.locator('[data-testid="fretboard-display"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="playback-controls"]'),
      ).toBeVisible();
      await expect(
        page.locator('[data-testid="practice-timer"]'),
      ).toBeVisible();

      // Check creator info section
      await expect(page.locator('[data-testid="creator-info"]')).toBeVisible();
      await expect(page.getByText('Tutorial Creator')).toBeVisible();

      // Verify YouTube widget integration
      await expect(
        page.locator('[data-testid="youtube-widget"]'),
      ).toBeVisible();
    });

    await test.step('🎵 Practice Session Interaction', async () => {
      // Test playback controls
      const playButton = page.locator('[data-testid="play-button"]');
      await expect(playButton).toBeVisible();
      await playButton.click();

      // Verify play state changed
      await expect(page.locator('[data-testid="pause-button"]')).toBeVisible();

      // Test fretboard interaction
      const fretboardNote = page
        .locator('[data-string="4"][data-fret="3"]')
        .first();
      if (await fretboardNote.isVisible()) {
        await fretboardNote.click();

        // Should show note feedback
        await expect(
          page.locator('[data-testid="note-feedback"]'),
        ).toBeVisible();
      }

      // Test tempo control
      const tempoSlider = page.locator('[data-testid="tempo-slider"]');
      if (await tempoSlider.isVisible()) {
        await tempoSlider.fill('100');
        await expect(
          page.locator('[data-testid="tempo-display"]'),
        ).toContainText('100');
      }
    });

    await test.step('📊 Progress Tracking', async () => {
      // Simulate practice time
      await page.waitForTimeout(3000);

      // Check practice timer updates
      const practiceTimer = page.locator('[data-testid="practice-timer"]');
      const timerText = await practiceTimer.textContent();
      expect(timerText).toMatch(/\d+:\d+/); // Should show time format

      // Test progress saving
      const saveProgressButton = page.locator('[data-testid="save-progress"]');
      if (await saveProgressButton.isVisible()) {
        await saveProgressButton.click();

        // Should show save confirmation
        await expect(
          page.locator('[data-testid="progress-saved-toast"]'),
        ).toBeVisible();
      }
    });

    await test.step('🔄 Bass Configuration Persistence', async () => {
      // Open bass settings
      const settingsButton = page.locator(
        '[data-testid="bass-settings-button"]',
      );
      if (await settingsButton.isVisible()) {
        await settingsButton.click();

        // Wait for settings modal
        await page.waitForSelector('[data-testid="bass-settings-modal"]');

        // Change bass configuration
        await page.click('[data-testid="string-config-5-string"]');
        await page.click('[data-testid="fret-config-24-fret"]');

        // Save settings
        await page.click('[data-testid="save-bass-settings"]');

        // Verify settings saved toast
        await expect(
          page.locator('[data-testid="settings-saved-toast"]'),
        ).toBeVisible();

        // Close modal
        await page.click('[data-testid="close-settings-modal"]');
      }
    });

    await test.step('🏠 Return to Library and Verify State', async () => {
      // Navigate back to library
      await page.click('a[href="/library"]');
      await expect(page).toHaveURL('/library');

      // Verify user state persisted
      await expect(
        page.locator('[data-testid="user-indicator"]'),
      ).toContainText(testUser.email);

      // Check if practice progress is reflected
      const firstTutorial = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      const progressIndicator = firstTutorial.locator(
        '[data-testid="progress-indicator"]',
      );

      // Progress indicator should show some completion
      if (await progressIndicator.isVisible()) {
        const progressText = await progressIndicator.textContent();
        expect(progressText).toMatch(/\d+%/);
      }
    });

    await test.step('🔐 Session Persistence Test', async () => {
      // Refresh page to test session persistence
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be logged in
      await expect(
        page.locator('[data-testid="user-indicator"]'),
      ).toContainText(testUser.email);

      // Should still be on library page
      await expect(page).toHaveURL('/library');

      // Tutorial cards should still be visible
      await expect(page.locator('[data-testid="tutorial-card"]')).toHaveCount(
        3,
      );
    });

    await test.step('🚪 Logout Flow', async () => {
      // Open user menu
      await page.click('[data-testid="user-menu-trigger"]');

      // Click logout
      await page.click('[data-testid="logout-button"]');

      // Should redirect to homepage or login
      await expect(page).toHaveURL(/\/(login|$)/);

      // Should show logged out state
      await expect(
        page.locator('[data-testid="user-indicator"]'),
      ).toContainText('Not logged in');
    });
  });

  test('should handle interrupted journey gracefully', async () => {
    await test.step('🔄 Start Journey and Simulate Interruption', async () => {
      // Start registration
      await page.goto('/register');
      await page.fill('input[name="email"]', `interrupt${Date.now()}@test.com`);
      await page.fill('input[name="password"]', 'InterruptTest123!');

      // Submit and navigate to library
      await page.click('button[type="submit"]');
      await expect(page).toHaveURL(/\/dashboard/);

      // Go to library and start tutorial
      await page.click('a[href="/library"]');
      await page.waitForSelector('[data-testid="tutorial-card"]');
      await page.locator('[data-testid="tutorial-card"]').first().click();

      // Start exercise
      await page.waitForSelector('[data-testid="exercise-item"]');
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Simulate network interruption by clearing cookies
      await page.context().clearCookies();
    });

    await test.step('🔄 Recovery After Interruption', async () => {
      // Try to navigate - should handle auth gracefully
      await page.goto('/library');

      // Should either:
      // 1. Redirect to login with return URL
      // 2. Show login form
      // 3. Show error message
      const currentUrl = page.url();
      const hasLoginForm = await page
        .locator('input[name="password"]')
        .isVisible();
      const hasErrorMessage = await page.locator('[role="alert"]').isVisible();

      expect(
        currentUrl.includes('login') || hasLoginForm || hasErrorMessage,
      ).toBeTruthy();
    });
  });

  test('should handle cross-browser compatibility', async () => {
    await test.step('🌐 Cross-Browser Feature Test', async () => {
      // Test key features work across browsers
      await page.goto('/library');

      // Test localStorage/sessionStorage works
      await page.evaluate(() => {
        localStorage.setItem('test-key', 'test-value');
        sessionStorage.setItem('session-test', 'session-value');
      });

      const localStorageValue = await page.evaluate(() =>
        localStorage.getItem('test-key'),
      );
      const sessionStorageValue = await page.evaluate(() =>
        sessionStorage.getItem('session-test'),
      );

      expect(localStorageValue).toBe('test-value');
      expect(sessionStorageValue).toBe('session-value');

      // Test CSS Grid/Flexbox layout
      const tutorialGrid = page.locator('[data-testid="tutorial-grid"]');
      if (await tutorialGrid.isVisible()) {
        const gridDisplay = await tutorialGrid.evaluate(
          (el) => getComputedStyle(el).display,
        );
        expect(['grid', 'flex']).toContain(gridDisplay);
      }
    });
  });
});

async function setupApiMocks(page: Page) {
  // Mock authentication endpoints
  await page.route('**/auth/**', (route) => {
    const url = route.request().url();

    if (url.includes('signup') || url.includes('register')) {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'user+journey@test.com',
            name: 'Journey Test User',
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token',
          },
        }),
      });
    } else if (url.includes('session')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'user-123',
            email: 'user+journey@test.com',
          },
        }),
      });
    } else {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unauthorized' }),
      });
    }
  });

  // Mock tutorials API
  await page.route('**/api/tutorials**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorials: [
          {
            id: 'billie-jean',
            slug: 'billie-jean',
            title: 'Billie Jean',
            artist: 'Michael Jackson',
            difficulty: 'beginner',
            exercise_count: 2,
            is_active: true,
            creator_name: 'Tutorial Creator',
            creator_channel_url: 'https://youtube.com/channel/UC123',
            thumbnail_url:
              'https://img.youtube.com/vi/ABC123/maxresdefault.jpg',
          },
          {
            id: 'another-one',
            slug: 'another-one',
            title: 'Another One Bites the Dust',
            artist: 'Queen',
            difficulty: 'intermediate',
            exercise_count: 3,
            is_active: true,
          },
          {
            id: 'come-together',
            slug: 'come-together',
            title: 'Come Together',
            artist: 'The Beatles',
            difficulty: 'advanced',
            exercise_count: 4,
            is_active: true,
          },
        ],
        total: 3,
      }),
    });
  });

  // Mock tutorial exercises API
  await page.route('**/api/tutorials/*/exercises**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorial: {
          id: 'billie-jean',
          title: 'Billie Jean',
          artist: 'Michael Jackson',
          difficulty: 'beginner',
        },
        exercises: [
          {
            id: 'ex1',
            title: 'Basic Pattern',
            difficulty: 'beginner',
            duration: 120000,
            bpm: 117,
            key: 'F#',
            is_active: true,
          },
          {
            id: 'ex2',
            title: 'Full Song',
            difficulty: 'beginner',
            duration: 294000,
            bpm: 117,
            key: 'F#',
            is_active: true,
          },
        ],
      }),
    });
  });

  // Mock user profile API
  await page.route('**/api/user/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'user-123',
          email: 'user+journey@test.com',
          bass_config: {
            strings: 4,
            frets: 20,
          },
          preferences: {
            theme: 'dark',
            auto_save: true,
          },
        },
      }),
    });
  });

  // Mock progress tracking API
  await page.route('**/api/progress/**', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Progress saved successfully',
        progress: {
          exercise_id: 'ex1',
          completion_percentage: 25,
          practice_time: 180,
        },
      }),
    });
  });

  // Mock creator stats API
  await page.route('**/api/creators/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          channelUrl: 'https://youtube.com/channel/UC123',
          creatorName: 'Tutorial Creator',
          subscriberCountFormatted: '50K',
          thumbnailUrl: 'https://yt3.ggpht.com/example.jpg',
        },
      }),
    });
  });
}
