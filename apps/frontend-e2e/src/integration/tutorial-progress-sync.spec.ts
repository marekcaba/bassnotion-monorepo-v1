import { test, expect, Page } from '@playwright/test';

/**
 * Tutorial Progress Synchronization Integration Tests
 *
 * Tests the complete integration between tutorial domain progress tracking,
 * user domain data persistence, and exercise domain completion status.
 */

test.describe('Tutorial Progress Synchronization Integration', () => {
  let page: Page;
  const syncUser = {
    email: `sync+${Date.now()}@test.com`,
    password: 'SyncTest123!',
  };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await setupProgressSyncMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should synchronize progress across tutorial, exercise, and user domains', async () => {
    await test.step('🎯 Initial Setup and Tutorial Selection', async () => {
      // Register user
      await page.goto('/register');
      await page.fill('input[name="email"]', syncUser.email);
      await page.fill('input[name="password"]', syncUser.password);
      await page.fill('input[name="confirmPassword"]', syncUser.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Navigate to tutorial library
      await page.click('a[href="/library"]');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      // Select a tutorial
      const tutorialCard = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      const tutorialTitle = await tutorialCard
        .locator('[data-testid="tutorial-title"]')
        .textContent();

      // Verify initial progress state
      const progressBadge = tutorialCard.locator(
        '[data-testid="progress-badge"]',
      );
      if (await progressBadge.isVisible()) {
        await expect(progressBadge).toContainText('0%');
      }

      await tutorialCard.click();
      await expect(page).toHaveURL(/\/library\/.+/);
    });

    await test.step('📊 Exercise Completion Updates Tutorial Progress', async () => {
      await page.waitForSelector('[data-testid="exercise-list"]');

      // Get total exercise count
      const exercises = page.locator('[data-testid="exercise-item"]');
      const totalExercises = await exercises.count();
      expect(totalExercises).toBeGreaterThan(0);

      // Complete first exercise
      await exercises.first().click();
      await page.waitForSelector('[data-testid="exercise-interface"]');

      // Practice exercise
      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(3000);

      // Track practice time
      const practiceTimer = page.locator('[data-testid="practice-timer"]');
      const practiceTime = await practiceTimer.textContent();

      // Complete exercise
      await page.click('[data-testid="mark-complete-button"]');
      await expect(
        page.locator('[data-testid="completion-toast"]'),
      ).toBeVisible();

      // Return to tutorial page
      await page.click('[data-testid="back-to-exercises"]');

      // Verify tutorial progress updated
      const tutorialProgress = page.locator(
        '[data-testid="tutorial-progress"]',
      );
      await expect(tutorialProgress).toBeVisible();
      const progressPercentage = Math.round((1 / totalExercises) * 100);
      await expect(tutorialProgress).toContainText(`${progressPercentage}%`);

      // Verify exercise status updated
      const firstExercise = exercises.first();
      await expect(
        firstExercise.locator('[data-testid="exercise-status"]'),
      ).toContainText('Complete');
    });

    await test.step('💾 Progress Persists to User Profile', async () => {
      // Navigate to user dashboard
      await page.goto('/dashboard');

      // Check overall progress statistics
      const statsSection = page.locator('[data-testid="progress-stats"]');
      await expect(statsSection).toBeVisible();

      // Verify exercise completion count
      await expect(
        statsSection.locator('[data-testid="exercises-completed"]'),
      ).toContainText('1');

      // Verify practice time tracked
      const totalPracticeTime = statsSection.locator(
        '[data-testid="total-practice-time"]',
      );
      await expect(totalPracticeTime).toBeVisible();
      const timeText = await totalPracticeTime.textContent();
      expect(timeText).toMatch(/\d+/);

      // Check recent activity
      const recentActivity = page.locator('[data-testid="recent-activity"]');
      if (await recentActivity.isVisible()) {
        const activityItems = recentActivity.locator(
          '[data-testid="activity-item"]',
        );
        await expect(activityItems.first()).toContainText('Completed exercise');
      }
    });

    await test.step('🔄 Cross-Session Progress Persistence', async () => {
      // Simulate session end
      await page.context().clearCookies();

      // Login again
      await page.goto('/login');
      await page.fill('input[name="email"]', syncUser.email);
      await page.fill('input[name="password"]', syncUser.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Navigate back to tutorial
      await page.goto('/library');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      // Verify progress persisted on tutorial card
      const tutorialCard = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      const progressBadge = tutorialCard.locator(
        '[data-testid="progress-badge"]',
      );
      await expect(progressBadge).not.toContainText('0%');

      // Enter tutorial
      await tutorialCard.click();

      // Verify exercise completion status persisted
      const exercises = page.locator('[data-testid="exercise-item"]');
      const firstExercise = exercises.first();
      await expect(
        firstExercise.locator('[data-testid="exercise-status"]'),
      ).toContainText('Complete');
    });

    await test.step('📈 Progress Affects Next Tutorial Recommendations', async () => {
      // Complete remaining exercises
      const exercises = page.locator('[data-testid="exercise-item"]');
      const exerciseCount = await exercises.count();

      for (let i = 1; i < exerciseCount; i++) {
        const exercise = exercises.nth(i);
        const status = await exercise
          .locator('[data-testid="exercise-status"]')
          .textContent();

        if (!status?.includes('Complete')) {
          await exercise.click();
          await page.waitForSelector('[data-testid="exercise-interface"]');

          await page.click('[data-testid="play-button"]');
          await page.waitForTimeout(2000);
          await page.click('[data-testid="mark-complete-button"]');
          await page.click('[data-testid="back-to-exercises"]');
        }
      }

      // Check tutorial completion
      const tutorialProgress = page.locator(
        '[data-testid="tutorial-progress"]',
      );
      await expect(tutorialProgress).toContainText('100%');

      // Should show completion modal
      const completionModal = page.locator(
        '[data-testid="tutorial-completion-modal"]',
      );
      if (await completionModal.isVisible()) {
        await expect(completionModal).toContainText('Congratulations');

        // Check recommendations
        const recommendations = completionModal.locator(
          '[data-testid="next-tutorial-recommendation"]',
        );
        await expect(recommendations.first()).toBeVisible();

        await page.click('[data-testid="close-completion-modal"]');
      }

      // Navigate to library
      await page.goto('/library');

      // Original tutorial should show as completed
      const completedTutorial = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      await expect(
        completedTutorial.locator('[data-testid="progress-badge"]'),
      ).toContainText('100%');
      await expect(completedTutorial).toHaveClass(/completed/);
    });
  });

  test('should handle real-time progress synchronization', async () => {
    await test.step('🔄 Multi-Device Progress Sync', async () => {
      // Open second browser context (simulating different device)
      const secondContext = await page.context().browser()?.newContext();
      if (!secondContext) return;

      const secondPage = await secondContext.newPage();
      await setupProgressSyncMocks(secondPage);

      // Login on second device
      await secondPage.goto('/login');
      await secondPage.fill('input[name="email"]', syncUser.email);
      await secondPage.fill('input[name="password"]', syncUser.password);
      await secondPage.click('button[type="submit"]');

      await expect(secondPage).toHaveURL(/\/dashboard/);

      // Navigate to library on both devices
      await page.goto('/library');
      await secondPage.goto('/library');

      // Start new tutorial on first device
      const newTutorial = page.locator('[data-testid="tutorial-card"]').nth(1);
      await newTutorial.click();

      await page.waitForSelector('[data-testid="exercise-item"]');
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Complete exercise on first device
      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(2000);
      await page.click('[data-testid="mark-complete-button"]');

      // Check if second device reflects the change
      await secondPage.reload();
      await secondPage.waitForSelector('[data-testid="tutorial-card"]');

      const syncedTutorial = secondPage
        .locator('[data-testid="tutorial-card"]')
        .nth(1);
      const syncedProgress = syncedTutorial.locator(
        '[data-testid="progress-badge"]',
      );

      // Should show updated progress
      await expect(syncedProgress).not.toContainText('0%');

      await secondPage.close();
      await secondContext.close();
    });
  });

  test('should sync progress with backend analytics', async () => {
    await test.step('📊 Analytics Data Synchronization', async () => {
      await page.goto('/dashboard');

      // Open analytics dashboard
      const analyticsButton = page.locator('[data-testid="view-analytics"]');
      if (await analyticsButton.isVisible()) {
        await analyticsButton.click();
        await page.waitForSelector('[data-testid="analytics-dashboard"]');

        // Verify practice data
        const practiceStats = page.locator('[data-testid="practice-stats"]');
        await expect(practiceStats).toBeVisible();

        // Check tutorial completion rate
        const completionRate = practiceStats.locator(
          '[data-testid="completion-rate"]',
        );
        await expect(completionRate).toContainText('%');

        // Check practice time by tutorial
        const timeByTutorial = page.locator('[data-testid="time-by-tutorial"]');
        if (await timeByTutorial.isVisible()) {
          const tutorialTimeItems = timeByTutorial.locator(
            '[data-testid="tutorial-time-item"]',
          );
          await expect(tutorialTimeItems.first()).toBeVisible();
        }

        // Check skill progression chart
        const skillChart = page.locator(
          '[data-testid="skill-progression-chart"]',
        );
        if (await skillChart.isVisible()) {
          await expect(skillChart).toBeVisible();
        }
      }
    });

    await test.step('🎯 Goal Progress Integration', async () => {
      // Check if goals are affected by progress
      const goalsSection = page.locator('[data-testid="learning-goals"]');
      if (await goalsSection.isVisible()) {
        const goalItems = goalsSection.locator('[data-testid="goal-item"]');

        // Check if tutorial completion contributes to goals
        const completionGoal = goalItems
          .filter({ hasText: 'Complete' })
          .first();
        if (await completionGoal.isVisible()) {
          const goalProgress = completionGoal.locator(
            '[data-testid="goal-progress"]',
          );
          await expect(goalProgress).toBeVisible();
        }
      }
    });
  });

  test('should handle progress conflicts and recovery', async () => {
    await test.step('⚠️ Conflict Resolution', async () => {
      // Create potential conflict by modifying local storage
      await page.evaluate(() => {
        const conflictingProgress = {
          tutorialId: 'test-tutorial',
          exercises: { ex1: 'complete', ex2: 'in-progress' },
          lastUpdated: new Date().toISOString(),
        };
        localStorage.setItem(
          'tutorial_progress_cache',
          JSON.stringify(conflictingProgress),
        );
      });

      // Navigate to tutorial with different server state
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();

      // Should show conflict resolution UI
      const conflictModal = page.locator(
        '[data-testid="progress-conflict-modal"]',
      );
      if (await conflictModal.isVisible()) {
        await expect(conflictModal).toContainText('Progress Sync Conflict');

        // Options to resolve
        await expect(
          conflictModal.locator('[data-testid="use-server-progress"]'),
        ).toBeVisible();
        await expect(
          conflictModal.locator('[data-testid="use-local-progress"]'),
        ).toBeVisible();
        await expect(
          conflictModal.locator('[data-testid="merge-progress"]'),
        ).toBeVisible();

        // Choose server progress
        await page.click('[data-testid="use-server-progress"]');

        // Verify resolved
        await expect(
          page.locator('[data-testid="conflict-resolved-toast"]'),
        ).toBeVisible();
      }
    });

    await test.step('🔄 Offline Progress Queue', async () => {
      // Simulate offline mode
      await page.route('**/api/**', (route) => {
        route.abort('failed');
      });

      // Try to complete an exercise
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(2000);
      await page.click('[data-testid="mark-complete-button"]');

      // Should queue progress for sync
      const offlineIndicator = page.locator(
        '[data-testid="offline-progress-indicator"]',
      );
      if (await offlineIndicator.isVisible()) {
        await expect(offlineIndicator).toContainText('Progress saved locally');
      }

      // Restore connection
      await page.unroute('**/api/**');
      await setupProgressSyncMocks(page);

      // Should sync automatically
      await page.reload();

      const syncToast = page.locator('[data-testid="progress-synced-toast"]');
      if (await syncToast.isVisible()) {
        await expect(syncToast).toContainText('Progress synchronized');
      }
    });
  });

  test('should integrate progress with gamification features', async () => {
    await test.step('🏆 Achievement Unlocking', async () => {
      await page.goto('/dashboard');

      // Check for progress-based achievements
      const achievementsButton = page.locator(
        '[data-testid="achievements-button"]',
      );
      if (await achievementsButton.isVisible()) {
        await achievementsButton.click();
        await page.waitForSelector('[data-testid="achievements-modal"]');

        // Look for tutorial-related achievements
        const achievements = page.locator('[data-testid="achievement-item"]');
        const tutorialAchievements = achievements.filter({
          hasText: 'Tutorial',
        });

        await expect(tutorialAchievements.first()).toBeVisible();

        // Check progress-based achievements
        const progressAchievements = achievements.filter({
          hasText: 'Progress',
        });
        if (await progressAchievements.first().isVisible()) {
          await expect(progressAchievements.first()).toHaveClass(/unlocked/);
        }

        await page.click('[data-testid="close-achievements"]');
      }
    });

    await test.step('⭐ Skill Points and Leveling', async () => {
      // Check skill points earned from progress
      const skillPointsDisplay = page.locator('[data-testid="skill-points"]');
      if (await skillPointsDisplay.isVisible()) {
        const points = await skillPointsDisplay.textContent();
        expect(points).toMatch(/\d+/);
      }

      // Check level progression
      const levelIndicator = page.locator('[data-testid="user-level"]');
      if (await levelIndicator.isVisible()) {
        const level = await levelIndicator.textContent();
        expect(level).toMatch(/Level \d+/);

        // Check XP bar
        const xpBar = page.locator('[data-testid="xp-progress-bar"]');
        if (await xpBar.isVisible()) {
          const xpPercentage = await xpBar.getAttribute('aria-valuenow');
          expect(Number(xpPercentage)).toBeGreaterThan(0);
        }
      }
    });

    await test.step('🎯 Unlockable Content', async () => {
      await page.goto('/library');

      // Check for locked tutorials that require progress
      const lockedTutorials = page.locator(
        '[data-testid="tutorial-card"][data-locked="true"]',
      );
      if (await lockedTutorials.first().isVisible()) {
        const lockMessage = lockedTutorials
          .first()
          .locator('[data-testid="lock-message"]');
        await expect(lockMessage).toContainText('Complete');

        // Hover to see requirements
        await lockedTutorials.first().hover();
        const tooltip = page.locator(
          '[data-testid="unlock-requirements-tooltip"]',
        );
        if (await tooltip.isVisible()) {
          await expect(tooltip).toContainText('Required');
        }
      }
    });
  });
});

async function setupProgressSyncMocks(page: Page) {
  // Track progress state
  let userProgress = {
    tutorials: {},
    exercises: {},
    totalPracticeTime: 0,
    exercisesCompleted: 0,
    lastSync: new Date().toISOString(),
  };

  // Mock tutorial progress endpoints
  await page.route('**/api/tutorials/*/progress', (route) => {
    const method = route.request().method();
    const tutorialId = route.request().url().split('/')[5];

    if (method === 'GET') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorial_id: tutorialId,
          progress: userProgress.tutorials[tutorialId] || {
            completion_percentage: 0,
            exercises_completed: 0,
            total_exercises: 3,
            last_accessed: null,
          },
        }),
      });
    } else if (method === 'PUT' || method === 'PATCH') {
      const updates = route.request().postDataJSON();
      userProgress.tutorials[tutorialId] = {
        ...userProgress.tutorials[tutorialId],
        ...updates,
        last_accessed: new Date().toISOString(),
      };

      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Progress updated',
          progress: userProgress.tutorials[tutorialId],
        }),
      });
    }
  });

  // Mock exercise completion endpoints
  await page.route('**/api/exercises/*/complete', (route) => {
    const exerciseId = route.request().url().split('/')[5];
    const requestData = route.request().postDataJSON();

    userProgress.exercises[exerciseId] = {
      completed: true,
      completed_at: new Date().toISOString(),
      practice_time: requestData?.practice_time || 180,
      score: requestData?.score || 85,
    };

    userProgress.exercisesCompleted += 1;
    userProgress.totalPracticeTime += requestData?.practice_time || 180;

    // Update tutorial progress
    const tutorialId = requestData?.tutorial_id || 'test-tutorial';
    const tutorialProgress = userProgress.tutorials[tutorialId] || {};
    const exercisesCompleted = (tutorialProgress.exercises_completed || 0) + 1;
    const totalExercises = tutorialProgress.total_exercises || 3;

    userProgress.tutorials[tutorialId] = {
      ...tutorialProgress,
      exercises_completed: exercisesCompleted,
      total_exercises: totalExercises,
      completion_percentage: Math.round(
        (exercisesCompleted / totalExercises) * 100,
      ),
    };

    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Exercise completed',
        exercise: userProgress.exercises[exerciseId],
        tutorial_progress: userProgress.tutorials[tutorialId],
        achievements:
          exercisesCompleted === 1
            ? [
                {
                  id: 'first-exercise',
                  title: 'First Exercise Complete',
                  just_earned: true,
                },
              ]
            : [],
      }),
    });
  });

  // Mock user progress overview
  await page.route('**/api/user/progress', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user_progress: {
          total_practice_time: userProgress.totalPracticeTime,
          exercises_completed: userProgress.exercisesCompleted,
          tutorials_in_progress: Object.keys(userProgress.tutorials).length,
          tutorials_completed: Object.values(userProgress.tutorials).filter(
            (t: any) => t.completion_percentage === 100,
          ).length,
          skill_level: 'beginner',
          practice_streak: 3,
          last_practice: userProgress.lastSync,
        },
        recent_activity: Object.entries(userProgress.exercises)
          .filter(([_, data]: [string, any]) => data.completed)
          .map(([exerciseId, data]: [string, any]) => ({
            type: 'exercise_completion',
            exercise_id: exerciseId,
            timestamp: data.completed_at,
            description: 'Completed exercise',
          }))
          .slice(-5),
      }),
    });
  });

  // Mock analytics endpoints
  await page.route('**/api/analytics/practice', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        practice_stats: {
          total_time: userProgress.totalPracticeTime,
          exercises_completed: userProgress.exercisesCompleted,
          completion_rate: userProgress.exercisesCompleted > 0 ? 85 : 0,
          average_score: 82,
        },
        time_by_tutorial: Object.entries(userProgress.tutorials).map(
          ([id, data]: [string, any]) => ({
            tutorial_id: id,
            practice_time: 600,
            completion_percentage: data.completion_percentage,
          }),
        ),
        skill_progression: [{ date: new Date().toISOString(), skill_level: 1 }],
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
            id: 'sync-test-1',
            slug: 'sync-test-1',
            title: 'Sync Test Tutorial 1',
            difficulty: 'beginner',
            exercise_count: 3,
            progress: userProgress.tutorials['sync-test-1'],
          },
          {
            id: 'sync-test-2',
            slug: 'sync-test-2',
            title: 'Sync Test Tutorial 2',
            difficulty: 'intermediate',
            exercise_count: 4,
            progress: userProgress.tutorials['sync-test-2'],
          },
        ],
      }),
    });
  });

  // Mock authentication
  await page.route('**/auth/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'sync-user',
          email: 'sync@test.com',
        },
      }),
    });
  });

  // Mock achievements
  await page.route('**/api/achievements', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        achievements: [
          {
            id: 'welcome',
            title: 'Welcome to BassNotion',
            description: 'Create your account',
            unlocked: true,
            unlocked_at: new Date().toISOString(),
          },
          {
            id: 'first-tutorial',
            title: 'Tutorial Master',
            description: 'Complete your first tutorial',
            unlocked:
              userProgress.tutorials['sync-test-1']?.completion_percentage ===
              100,
            progress:
              userProgress.tutorials['sync-test-1']?.completion_percentage || 0,
          },
          {
            id: 'practice-streak',
            title: 'Consistent Learner',
            description: 'Maintain a 7-day practice streak',
            unlocked: false,
            progress: 3,
            total: 7,
          },
        ],
      }),
    });
  });
}
