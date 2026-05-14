import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

/**
 * API Workflow Integration E2E Tests
 *
 * Tests complete API workflow integration across all domains,
 * verifying data flow, error handling, and state synchronization
 * between frontend domains and backend services.
 */

test.describe('API Workflow Integration', () => {
  let page: Page;
  const apiUser = {
    email: `apiworkflow+${Date.now()}@test.com`,
    password: 'ApiWorkflow123!',
  };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await setupAPIWorkflowMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should handle complete user journey API workflow', async () => {
    await test.step('🔐 Authentication API Flow', async () => {
      // Register user - tests user domain API
      await page.goto('/register');
      await page.fill('input[name="email"]', apiUser.email);
      await page.fill('input[name="password"]', apiUser.password);
      await page.fill('input[name="confirmPassword"]', apiUser.password);

      // Monitor network requests
      const registerRequest = page.waitForRequest('**/auth/register');
      await page.click('button[type="submit"]');

      const registerReq = await registerRequest;
      expect(registerReq.method()).toBe('POST');

      // Verify successful registration response
      await expect(page).toHaveURL(/\/dashboard/);

      // Test profile creation API call
      const profileRequest = page.waitForRequest('**/api/user/profile');
      await page.reload();

      const profileReq = await profileRequest;
      expect(profileReq.method()).toBe('GET');
    });

    await test.step('⚙️ User Settings API Integration', async () => {
      // Open bass settings - tests user domain settings API
      await page.click('[data-testid="bass-settings-button"]');
      await page.waitForSelector('[data-testid="bass-settings-modal"]');

      // Change configuration and monitor API call
      await page.click('[data-testid="string-config-5-string"]');
      await page.click('[data-testid="fret-config-24-fret"]');

      const settingsUpdateRequest = page.waitForRequest('**/api/user/profile');
      await page.click('[data-testid="save-bass-settings"]');

      const settingsReq = await settingsUpdateRequest;
      expect(settingsReq.method()).toBe('PUT');

      const requestData = settingsReq.postDataJSON();
      expect(requestData.bass_config.strings).toBe(5);
      expect(requestData.bass_config.frets).toBe(24);

      await expect(
        page.locator('[data-testid="settings-saved-toast"]'),
      ).toBeVisible();
      await page.click('[data-testid="close-settings-modal"]');
    });

    await test.step('📚 Tutorial Library API Flow', async () => {
      // Navigate to library - tests tutorial domain API
      await page.click('a[href="/library"]');

      const tutorialsRequest = page.waitForRequest('**/api/tutorials**');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      const tutorialsReq = await tutorialsRequest;
      expect(tutorialsReq.method()).toBe('GET');

      // Test filtering API
      const filteredRequest = page.waitForRequest(
        (req) =>
          req.url().includes('api/tutorials') &&
          req.url().includes('difficulty=beginner'),
      );
      await page.selectOption('[data-testid="difficulty-filter"]', 'beginner');

      const filteredReq = await filteredRequest;
      expect(filteredReq.url()).toContain('difficulty=beginner');

      // Select tutorial - tests tutorial detail API
      const tutorialDetailRequest = page.waitForRequest(
        '**/api/tutorials/*/exercises',
      );
      await page.locator('[data-testid="tutorial-card"]').first().click();

      const detailReq = await tutorialDetailRequest;
      expect(detailReq.method()).toBe('GET');
    });

    await test.step('🎵 Exercise Practice API Integration', async () => {
      // Start exercise - tests exercise domain API
      await page.waitForSelector('[data-testid="exercise-item"]');
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.waitForSelector('[data-testid="exercise-interface"]');

      // Start practice session - tests practice tracking API
      const sessionStartRequest = page.waitForRequest(
        '**/api/practice/sessions',
      );
      await page.click('[data-testid="play-button"]');

      const sessionReq = await sessionStartRequest;
      expect(sessionReq.method()).toBe('POST');

      const sessionData = sessionReq.postDataJSON();
      expect(sessionData.exercise_id).toBeDefined();
      expect(sessionData.start_time).toBeDefined();

      // Practice for a while
      await page.waitForTimeout(3000);

      // Complete exercise - tests completion API
      const completionRequest = page.waitForRequest(
        '**/api/exercises/*/complete',
      );
      await page.click('[data-testid="mark-complete-button"]');

      const completionReq = await completionRequest;
      expect(completionReq.method()).toBe('POST');

      const completionData = completionReq.postDataJSON();
      expect(completionData.practice_time).toBeGreaterThan(0);

      await expect(
        page.locator('[data-testid="completion-toast"]'),
      ).toBeVisible();
    });

    await test.step('📊 Progress Sync API Verification', async () => {
      // Navigate to dashboard - tests progress aggregation API
      await page.goto('/dashboard');

      const progressRequest = page.waitForRequest('**/api/user/progress');
      await page.waitForSelector('[data-testid="progress-stats"]');

      const progressReq = await progressRequest;
      expect(progressReq.method()).toBe('GET');

      // Verify progress data is displayed
      const exercisesCompleted = page.locator(
        '[data-testid="exercises-completed"]',
      );
      await expect(exercisesCompleted).toContainText('1');

      // Test analytics API integration
      const analyticsButton = page.locator('[data-testid="view-analytics"]');
      if (await analyticsButton.isVisible()) {
        const analyticsRequest = page.waitForRequest(
          '**/api/analytics/practice',
        );
        await analyticsButton.click();

        const analyticsReq = await analyticsRequest;
        expect(analyticsReq.method()).toBe('GET');
      }
    });
  });

  test('should handle API error scenarios gracefully', async () => {
    await test.step('🚫 Network Failure Handling', async () => {
      // Simulate network failure for tutorial loading
      await page.route('**/api/tutorials**', (route) => {
        route.abort('failed');
      });

      await page.goto('/library');

      // Should show error state
      const errorMessage = page.locator('[data-testid="library-error"]');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Unable to load tutorials');

      // Test retry functionality
      const retryButton = page.locator('[data-testid="retry-load-tutorials"]');
      if (await retryButton.isVisible()) {
        // Restore network for retry
        await page.unroute('**/api/tutorials**');
        await setupAPIWorkflowMocks(page);

        await retryButton.click();
        await page.waitForSelector('[data-testid="tutorial-card"]');
      }
    });

    await test.step('⚠️ API Response Error Handling', async () => {
      // Simulate 500 error for exercise completion
      await page.route('**/api/exercises/*/complete', (route) => {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Internal server error',
            message: 'Failed to save exercise progress',
          }),
        });
      });

      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(2000);
      await page.click('[data-testid="mark-complete-button"]');

      // Should show error notification
      const errorToast = page.locator('[data-testid="completion-error-toast"]');
      await expect(errorToast).toBeVisible();
      await expect(errorToast).toContainText('Failed to save progress');

      // Should offer retry option
      const retryCompletion = page.locator('[data-testid="retry-completion"]');
      if (await retryCompletion.isVisible()) {
        // Restore successful response
        await page.unroute('**/api/exercises/*/complete');
        await setupAPIWorkflowMocks(page);

        await retryCompletion.click();
        await expect(
          page.locator('[data-testid="completion-toast"]'),
        ).toBeVisible();
      }
    });

    await test.step('🔄 Offline Mode Handling', async () => {
      // Simulate offline mode
      await page.route('**/api/**', (route) => {
        route.abort('failed');
      });

      await page.goto('/library');

      // Should show offline indicator
      const offlineIndicator = page.locator(
        '[data-testid="offline-indicator"]',
      );
      if (await offlineIndicator.isVisible()) {
        await expect(offlineIndicator).toContainText("You're offline");
      }

      // Should cache previous data
      const cachedTutorials = page.locator('[data-testid="tutorial-card"]');
      if (await cachedTutorials.first().isVisible()) {
        await expect(cachedTutorials.first()).toBeVisible();

        // Should show cached indicator
        const cacheIndicator = page.locator(
          '[data-testid="cached-content-indicator"]',
        );
        if (await cacheIndicator.isVisible()) {
          await expect(cacheIndicator).toContainText('Cached');
        }
      }

      // Restore network
      await page.unroute('**/api/**');
      await setupAPIWorkflowMocks(page);

      // Should sync when back online
      await page.reload();
      const syncIndicator = page.locator('[data-testid="sync-indicator"]');
      if (await syncIndicator.isVisible()) {
        await expect(syncIndicator).toContainText('Synced');
      }
    });
  });

  test('should handle concurrent API operations', async () => {
    await test.step('🔄 Parallel API Requests', async () => {
      await page.goto('/dashboard');

      // Trigger multiple API calls simultaneously
      const requests = await Promise.all([
        page.waitForRequest('**/api/user/progress'),
        page.waitForRequest('**/api/tutorials**'),
        page.waitForRequest('**/api/user/profile'),
      ]);

      // Navigate to trigger all APIs
      await page.goto('/library');

      // Verify all requests completed
      for (const req of requests) {
        const response = await req.response();
        expect(response?.status()).toBeLessThan(400);
      }
    });

    await test.step('🎯 Race Condition Prevention', async () => {
      // Test rapid state changes
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Rapidly start and stop practice
      await page.click('[data-testid="play-button"]');
      await page.click('[data-testid="pause-button"]');
      await page.click('[data-testid="play-button"]');

      // Should handle rapid state changes gracefully
      const practiceTimer = page.locator('[data-testid="practice-timer"]');
      await expect(practiceTimer).toBeVisible();

      // Complete exercise
      await page.click('[data-testid="mark-complete-button"]');
      await expect(
        page.locator('[data-testid="completion-toast"]'),
      ).toBeVisible();
    });

    await test.step('🔐 Authentication State Sync', async () => {
      // Test authentication across multiple tabs
      const secondPage = await page.context().newPage();
      await setupAPIWorkflowMocks(secondPage);

      // Login in second tab
      await secondPage.goto('/login');
      await secondPage.fill('input[name="email"]', apiUser.email);
      await secondPage.fill('input[name="password"]', apiUser.password);
      await secondPage.click('button[type="submit"]');

      // Both pages should be authenticated
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      await expect(
        secondPage.locator('[data-testid="user-menu"]'),
      ).toBeVisible();

      // Logout from first tab
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');

      // Second tab should also logout
      await secondPage.reload();
      await expect(secondPage).toHaveURL(/\/login/);

      await secondPage.close();
    });
  });

  test('should handle API data consistency', async () => {
    await test.step('📊 Cross-Domain Data Consistency', async () => {
      // Complete exercise and verify data consistency across domains
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Complete exercise
      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(3000);
      await page.click('[data-testid="mark-complete-button"]');

      // Check user domain reflects completion
      await page.goto('/dashboard');
      const userProgress = page.locator('[data-testid="exercises-completed"]');
      await expect(userProgress).toContainText('1');

      // Check tutorial domain reflects completion
      await page.goto('/library');
      const tutorialProgress = page
        .locator('[data-testid="tutorial-card"]')
        .first()
        .locator('[data-testid="progress-badge"]');
      await expect(tutorialProgress).not.toContainText('0%');

      // Check analytics domain reflects completion
      await page.goto('/dashboard');
      const analyticsButton = page.locator('[data-testid="view-analytics"]');
      if (await analyticsButton.isVisible()) {
        await analyticsButton.click();

        const practiceStats = page.locator('[data-testid="practice-stats"]');
        await expect(practiceStats).toBeVisible();
      }
    });

    await test.step('🔄 Real-time Data Updates', async () => {
      // Test real-time updates across components
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();

      // Start another exercise
      const availableExercise = page
        .locator('[data-testid="exercise-item"]')
        .filter({ hasText: 'Available' })
        .first();

      if (await availableExercise.isVisible()) {
        await availableExercise.click();

        // Monitor progress updates
        const progressBar = page.locator('[data-testid="tutorial-progress"]');
        const initialProgress = await progressBar.textContent();

        await page.click('[data-testid="play-button"]');
        await page.waitForTimeout(2000);
        await page.click('[data-testid="mark-complete-button"]');

        // Progress should update immediately
        const updatedProgress = await progressBar.textContent();
        expect(updatedProgress).not.toBe(initialProgress);
      }
    });

    await test.step('💾 Data Persistence Verification', async () => {
      // Refresh and verify data persists
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Navigate to check persistence
      await page.goto('/dashboard');
      const persistedProgress = page.locator(
        '[data-testid="exercises-completed"]',
      );
      await expect(persistedProgress).toContainText('2'); // Two exercises completed

      // Check tutorial library persistence
      await page.goto('/library');
      const persistedTutorialProgress = page
        .locator('[data-testid="tutorial-card"]')
        .first()
        .locator('[data-testid="progress-badge"]');

      const progressText = await persistedTutorialProgress.textContent();
      expect(progressText).toMatch(/\d+%/);
      expect(progressText).not.toContain('0%');
    });
  });
});

async function setupAPIWorkflowMocks(page: Page) {
  // Comprehensive API mocking for workflow testing
  let userState = {
    id: 'apiworkflow-user',
    email: 'apiworkflow@test.com',
    bass_config: { strings: 4, frets: 20, tuning: ['E', 'A', 'D', 'G'] },
    progress: { exercises_completed: 0, total_practice_time: 0 },
  };

  let practiceSession = null;
  let completedExercises = [];

  // Authentication endpoints
  await page.route('**/auth/**', (route) => {
    const method = route.request().method();

    if (method === 'POST' && route.request().url().includes('register')) {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: userState,
          session: { access_token: 'mock-token' },
        }),
      });
    } else if (method === 'POST' && route.request().url().includes('login')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: userState,
          session: { access_token: 'mock-token' },
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: userState }),
      });
    }
  });

  // User profile endpoints
  await page.route('**/api/user/profile**', (route) => {
    const method = route.request().method();

    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ user: userState }),
      });
    } else if (method === 'PUT' || method === 'PATCH') {
      const updates = route.request().postDataJSON();
      userState = { ...userState, ...updates };

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Profile updated',
          user: userState,
        }),
      });
    }
  });

  // Tutorial endpoints
  await page.route('**/api/tutorials**', (route) => {
    const url = route.request().url();

    if (url.includes('difficulty=beginner')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'workflow-tutorial-1',
              slug: 'workflow-tutorial-1',
              title: 'API Workflow Tutorial',
              difficulty: 'beginner',
              exercise_count: 3,
              progress_percentage: Math.round(
                (completedExercises.length / 3) * 100,
              ),
            },
          ],
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'workflow-tutorial-1',
              slug: 'workflow-tutorial-1',
              title: 'API Workflow Tutorial',
              difficulty: 'beginner',
              exercise_count: 3,
              progress_percentage: Math.round(
                (completedExercises.length / 3) * 100,
              ),
            },
          ],
        }),
      });
    }
  });

  // Exercise endpoints
  await page.route('**/api/tutorials/*/exercises**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorial: {
          id: 'workflow-tutorial-1',
          title: 'API Workflow Tutorial',
        },
        exercises: [
          {
            id: 'ex1',
            title: 'First Exercise',
            difficulty: 'beginner',
            duration: 180000,
            status: 'available',
            completed: completedExercises.includes('ex1'),
          },
          {
            id: 'ex2',
            title: 'Second Exercise',
            difficulty: 'beginner',
            duration: 240000,
            status: completedExercises.includes('ex1') ? 'available' : 'locked',
            completed: completedExercises.includes('ex2'),
          },
          {
            id: 'ex3',
            title: 'Third Exercise',
            difficulty: 'beginner',
            duration: 300000,
            status: completedExercises.includes('ex2') ? 'available' : 'locked',
            completed: completedExercises.includes('ex3'),
          },
        ],
      }),
    });
  });

  // Practice session endpoints
  await page.route('**/api/practice/sessions**', (route) => {
    const method = route.request().method();

    if (method === 'POST') {
      const sessionData = route.request().postDataJSON();
      practiceSession = {
        id: 'session-123',
        ...sessionData,
        start_time: new Date().toISOString(),
      };

      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ session: practiceSession }),
      });
    }
  });

  // Exercise completion endpoints
  await page.route('**/api/exercises/*/complete', (route) => {
    const exerciseId = route.request().url().split('/')[5];
    const completionData = route.request().postDataJSON();

    if (!completedExercises.includes(exerciseId)) {
      completedExercises.push(exerciseId);
      userState.progress.exercises_completed += 1;
      userState.progress.total_practice_time +=
        completionData?.practice_time || 180;
    }

    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Exercise completed',
        completion: {
          exercise_id: exerciseId,
          completed_at: new Date().toISOString(),
          score: 85,
          practice_time: completionData?.practice_time || 180,
        },
        tutorial_progress: {
          completion_percentage: Math.round(
            (completedExercises.length / 3) * 100,
          ),
          exercises_completed: completedExercises.length,
          total_exercises: 3,
        },
      }),
    });
  });

  // User progress endpoints
  await page.route('**/api/user/progress**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_progress: {
          exercises_completed: userState.progress.exercises_completed,
          total_practice_time: userState.progress.total_practice_time,
          tutorials_completed: completedExercises.length === 3 ? 1 : 0,
          skill_level: 'beginner',
        },
        recent_activity: completedExercises.map((exerciseId) => ({
          type: 'exercise_completion',
          exercise_id: exerciseId,
          timestamp: new Date().toISOString(),
        })),
      }),
    });
  });

  // Analytics endpoints
  await page.route('**/api/analytics/practice**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        practice_stats: {
          total_time: userState.progress.total_practice_time,
          exercises_completed: userState.progress.exercises_completed,
          completion_rate: userState.progress.exercises_completed > 0 ? 85 : 0,
          average_accuracy: 82,
        },
        practice_calendar: {
          [new Date().toISOString().split('T')[0]]: {
            practice_time: userState.progress.total_practice_time,
            exercises: userState.progress.exercises_completed,
          },
        },
      }),
    });
  });
}
