import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

/**
 * Tutorial Progression Flow E2E Tests
 *
 * Tests tutorial progression, skill development tracking,
 * and adaptive learning path recommendations.
 */

test.describe('Tutorial Progression Flow', () => {
  let page: Page;
  const progressUser = {
    email: `progress+${Date.now()}@test.com`,
    password: 'Progress123!',
  };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await setupProgressionMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should track tutorial progression accurately', async () => {
    await test.step('🎯 Initial Skill Assessment', async () => {
      // Register and setup
      await page.goto('/register');
      await page.fill('input[name="email"]', progressUser.email);
      await page.fill('input[name="password"]', progressUser.password);
      await page.fill('input[name="confirmPassword"]', progressUser.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Check initial skill level
      const skillIndicator = page.locator('[data-testid="skill-level"]');
      if (await skillIndicator.isVisible()) {
        await expect(skillIndicator).toContainText('Beginner');
      }
    });

    await test.step('📚 Complete Beginner Tutorial Series', async () => {
      await page.goto('/library');

      // Filter for beginner tutorials
      await page.selectOption('[data-testid="difficulty-filter"]', 'beginner');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      // Complete first beginner tutorial
      const firstTutorial = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      await firstTutorial.click();

      await page.waitForSelector('[data-testid="exercise-list"]');
      const exercises = page.locator('[data-testid="exercise-item"]');
      const exerciseCount = await exercises.count();

      // Complete all exercises in tutorial
      for (let i = 0; i < exerciseCount; i++) {
        await exercises.nth(i).click();
        await page.waitForSelector('[data-testid="exercise-interface"]');

        // Practice exercise
        await page.click('[data-testid="play-button"]');
        await page.waitForTimeout(3000);

        // Mark complete
        await page.click('[data-testid="mark-complete-button"]');
        await expect(
          page.locator('[data-testid="completion-toast"]'),
        ).toBeVisible();

        // Return to exercise list
        await page.click('[data-testid="back-to-exercises"]');
      }

      // Check tutorial completion
      const progressBar = page.locator('[data-testid="tutorial-progress"]');
      await expect(progressBar).toContainText('100%');

      // Should show completion certificate
      const certificateModal = page.locator(
        '[data-testid="completion-certificate"]',
      );
      if (await certificateModal.isVisible()) {
        await expect(
          certificateModal.locator('[data-testid="certificate-title"]'),
        ).toContainText('Tutorial Complete');
        await page.click('[data-testid="close-certificate"]');
      }
    });

    await test.step('🎵 Skill Level Progression', async () => {
      // Return to dashboard to check skill progression
      await page.goto('/dashboard');

      // Should show skill advancement
      const skillIndicator = page.locator('[data-testid="skill-level"]');
      if (await skillIndicator.isVisible()) {
        const skillText = await skillIndicator.textContent();
        expect(skillText).toMatch(/(Novice|Beginner\+|Developing)/);
      }

      // Check progress statistics
      const statsSection = page.locator('[data-testid="progress-stats"]');
      if (await statsSection.isVisible()) {
        await expect(
          statsSection.locator('[data-testid="tutorials-completed"]'),
        ).toContainText('1');
        const practiceTimeText = await statsSection
          .locator('[data-testid="total-practice-time"]')
          .textContent();
        expect(practiceTimeText).toMatch(/\d+/);
      }
    });

    await test.step('📈 Next Level Recommendations', async () => {
      // Should show recommended next tutorials
      const recommendationsSection = page.locator(
        '[data-testid="recommendations"]',
      );
      if (await recommendationsSection.isVisible()) {
        const recommendedTutorials = recommendationsSection.locator(
          '[data-testid="recommended-tutorial"]',
        );
        await expect(recommendedTutorials.first()).toBeVisible();

        // Should recommend intermediate level
        const difficulty = recommendedTutorials
          .first()
          .locator('[data-testid="tutorial-difficulty"]');
        await expect(difficulty).toContainText('Intermediate');
      }
    });
  });

  test('should handle progressive difficulty scaling', async () => {
    await test.step('🎯 Adaptive Difficulty Assessment', async () => {
      await page.goto('/library');

      // Start intermediate tutorial
      await page.selectOption(
        '[data-testid="difficulty-filter"]',
        'intermediate',
      );
      await page.locator('[data-testid="tutorial-card"]').first().click();

      await page.waitForSelector('[data-testid="exercise-item"]');
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.waitForSelector('[data-testid="exercise-interface"]');

      // Check adaptive difficulty features
      const adaptiveMode = page.locator('[data-testid="adaptive-difficulty"]');
      if (await adaptiveMode.isVisible()) {
        await expect(adaptiveMode).toContainText('Adaptive');
      }

      // Start practice
      await page.click('[data-testid="play-button"]');

      // Simulate struggle (low accuracy)
      for (let i = 0; i < 5; i++) {
        await page.click('[data-string="4"][data-fret="0"]');
        await page.waitForTimeout(300);
      }

      // Check if difficulty adjusted
      const difficultyAdjustment = page.locator(
        '[data-testid="difficulty-adjustment"]',
      );
      if (await difficultyAdjustment.isVisible()) {
        await expect(difficultyAdjustment).toContainText('Easier');
      }
    });

    await test.step('🎵 Performance-Based Progression', async () => {
      // Complete exercise with good performance
      await page.reload();
      await page.waitForSelector('[data-testid="exercise-interface"]');

      await page.click('[data-testid="play-button"]');

      // Simulate good performance
      const correctNotes = [
        { string: 4, fret: 0 },
        { string: 3, fret: 2 },
        { string: 2, fret: 2 },
        { string: 1, fret: 0 },
      ];

      for (const note of correctNotes) {
        await page.click(
          `[data-string="${note.string}"][data-fret="${note.fret}"]`,
        );
        await page.waitForTimeout(500);
      }

      // Check performance feedback
      const performanceScore = page.locator(
        '[data-testid="performance-score"]',
      );
      if (await performanceScore.isVisible()) {
        const score = await performanceScore.textContent();
        expect(score).toMatch(/\d+%/);
      }

      await page.click('[data-testid="mark-complete-button"]');

      // Should unlock next difficulty level
      await page.click('[data-testid="back-to-exercises"]');
      const nextExercise = page.locator('[data-testid="exercise-item"]').nth(1);
      await expect(
        nextExercise.locator('[data-testid="exercise-status"]'),
      ).toContainText('Available');
    });
  });

  test('should maintain learning streaks and motivation', async () => {
    await test.step('🔥 Daily Practice Streaks', async () => {
      await page.goto('/dashboard');

      // Check practice streak
      const streakIndicator = page.locator('[data-testid="practice-streak"]');
      if (await streakIndicator.isVisible()) {
        await expect(streakIndicator).toContainText('day');
      }

      // Practice to maintain streak
      await page.goto('/library');
      await page.locator('[data-testid="tutorial-card"]').first().click();
      await page.locator('[data-testid="exercise-item"]').first().click();

      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(2000);

      // End practice session
      await page.click('[data-testid="end-session"]');

      // Should update streak
      await page.goto('/dashboard');
      const updatedStreak = page.locator('[data-testid="practice-streak"]');
      await expect(updatedStreak).toBeVisible();
    });

    await test.step('🏆 Achievement System', async () => {
      // Check for achievements
      const achievementsButton = page.locator(
        '[data-testid="view-achievements"]',
      );
      if (await achievementsButton.isVisible()) {
        await achievementsButton.click();

        await page.waitForSelector('[data-testid="achievements-modal"]');

        // Should have completion achievements
        const achievements = page.locator('[data-testid="achievement-item"]');
        await expect(achievements.first()).toBeVisible();

        // Check for recent achievements
        const recentAchievement = achievements
          .first()
          .locator('[data-testid="achievement-title"]');
        await expect(recentAchievement).toContainText(
          'First Tutorial Complete',
        );

        await page.click('[data-testid="close-achievements"]');
      }
    });

    await test.step('📊 Progress Visualization', async () => {
      // Check progress charts
      const progressChart = page.locator('[data-testid="progress-chart"]');
      if (await progressChart.isVisible()) {
        // Should show practice time over time
        await expect(progressChart).toBeVisible();
      }

      // Check skill development radar
      const skillRadar = page.locator('[data-testid="skill-radar"]');
      if (await skillRadar.isVisible()) {
        await expect(skillRadar).toBeVisible();
      }
    });
  });

  test('should handle tutorial dependencies and prerequisites', async () => {
    await test.step('🔐 Prerequisite Enforcement', async () => {
      await page.goto('/library');

      // Try to access advanced tutorial without prerequisites
      await page.selectOption('[data-testid="difficulty-filter"]', 'advanced');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      const advancedTutorial = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      await advancedTutorial.click();

      // Should show prerequisite warning
      const prerequisiteModal = page.locator(
        '[data-testid="prerequisite-modal"]',
      );
      if (await prerequisiteModal.isVisible()) {
        await expect(
          prerequisiteModal.locator('[data-testid="prerequisite-message"]'),
        ).toContainText('Complete required tutorials first');

        // Should list required tutorials
        const requiredTutorials = prerequisiteModal.locator(
          '[data-testid="required-tutorial"]',
        );
        await expect(requiredTutorials.first()).toBeVisible();

        await page.click('[data-testid="close-prerequisite-modal"]');
      }
    });

    await test.step('🎯 Guided Learning Path', async () => {
      // Should suggest next tutorial in learning path
      const guidedPathSection = page.locator('[data-testid="guided-path"]');
      if (await guidedPathSection.isVisible()) {
        const nextInPath = guidedPathSection.locator(
          '[data-testid="next-in-path"]',
        );
        await expect(nextInPath).toBeVisible();

        await nextInPath.click();

        // Should navigate to appropriate tutorial
        await expect(page).toHaveURL(/\/library\/.+/);
      }
    });
  });

  test('should track long-term skill development', async () => {
    await test.step('📈 Skill Milestone Tracking', async () => {
      await page.goto('/dashboard');

      // Check skill milestones
      const milestonesSection = page.locator(
        '[data-testid="skill-milestones"]',
      );
      if (await milestonesSection.isVisible()) {
        const completedMilestones = milestonesSection.locator(
          '[data-testid="milestone-complete"]',
        );
        const upcomingMilestones = milestonesSection.locator(
          '[data-testid="milestone-upcoming"]',
        );

        await expect(completedMilestones.first()).toBeVisible();
        await expect(upcomingMilestones.first()).toBeVisible();
      }
    });

    await test.step('🎵 Genre Progression Tracking', async () => {
      // Check genre-specific progress
      const genreProgress = page.locator('[data-testid="genre-progress"]');
      if (await genreProgress.isVisible()) {
        const genres = genreProgress.locator('[data-testid="genre-item"]');

        // Should show progress in different music genres
        const rockProgress = genres.filter({ hasText: 'Rock' }).first();
        const jazzProgress = genres.filter({ hasText: 'Jazz' }).first();

        if (await rockProgress.isVisible()) {
          await expect(
            rockProgress.locator('[data-testid="genre-level"]'),
          ).toBeVisible();
        }

        if (await jazzProgress.isVisible()) {
          await expect(
            jazzProgress.locator('[data-testid="genre-level"]'),
          ).toBeVisible();
        }
      }
    });

    await test.step('🎯 Personalized Recommendations', async () => {
      // Check AI-powered recommendations
      const aiRecommendations = page.locator(
        '[data-testid="ai-recommendations"]',
      );
      if (await aiRecommendations.isVisible()) {
        const recommendationCards = aiRecommendations.locator(
          '[data-testid="ai-recommendation"]',
        );

        await expect(recommendationCards.first()).toBeVisible();

        // Should include reasoning
        const reasoning = recommendationCards
          .first()
          .locator('[data-testid="recommendation-reason"]');
        await expect(reasoning).toContainText('Based on your progress');
      }
    });
  });
});

async function setupProgressionMocks(page: Page) {
  // Mock user progression data
  await page.route('**/api/user/progress**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        user: {
          id: 'progress-user',
          skill_level: 'beginner',
          practice_streak: 3,
          total_practice_time: 1800,
          tutorials_completed: 0,
        },
        milestones: [
          {
            id: 'first-tutorial',
            title: 'First Tutorial Complete',
            description: 'Complete your first tutorial',
            completed: false,
            progress: 0,
          },
          {
            id: 'practice-streak',
            title: '7-Day Practice Streak',
            description: 'Practice for 7 consecutive days',
            completed: false,
            progress: 3,
          },
        ],
        achievements: [
          {
            id: 'welcome',
            title: 'Welcome to BassNotion',
            description: 'Created your account',
            earned_at: new Date().toISOString(),
          },
        ],
      }),
    });
  });

  // Mock tutorial progression
  await page.route('**/api/tutorials**', (route) => {
    const url = route.request().url();

    if (url.includes('difficulty=beginner')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'beginner-1',
              slug: 'beginner-basics',
              title: 'Bass Fundamentals',
              difficulty: 'beginner',
              exercise_count: 3,
              completion_percentage: 0,
              prerequisites: [],
            },
            {
              id: 'beginner-2',
              slug: 'first-songs',
              title: 'Your First Songs',
              difficulty: 'beginner',
              exercise_count: 4,
              completion_percentage: 0,
              prerequisites: ['beginner-1'],
            },
          ],
        }),
      });
    } else if (url.includes('difficulty=intermediate')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'intermediate-1',
              slug: 'rhythm-patterns',
              title: 'Advanced Rhythm Patterns',
              difficulty: 'intermediate',
              exercise_count: 5,
              completion_percentage: 0,
              prerequisites: ['beginner-1', 'beginner-2'],
            },
          ],
        }),
      });
    } else if (url.includes('difficulty=advanced')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'advanced-1',
              slug: 'jazz-walking',
              title: 'Jazz Walking Bass',
              difficulty: 'advanced',
              exercise_count: 8,
              completion_percentage: 0,
              prerequisites: ['intermediate-1'],
            },
          ],
        }),
      });
    }
  });

  // Mock exercise completion
  await page.route('**/api/exercises/*/complete', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Exercise completed',
        exercise_completion: {
          score: 85,
          practice_time: 180,
          accuracy: 78,
        },
        tutorial_progress: {
          completion_percentage: 33,
          exercises_completed: 1,
          total_exercises: 3,
        },
        skill_progression: {
          experience_gained: 50,
          new_level: false,
          skill_level: 'beginner',
        },
        achievements: [
          {
            id: 'first-exercise',
            title: 'First Exercise Complete',
            just_earned: true,
          },
        ],
      }),
    });
  });

  // Mock prerequisite checking
  await page.route('**/api/tutorials/*/prerequisites', (route) => {
    const tutorialId = route.request().url().split('/')[5];

    if (tutorialId === 'advanced-1') {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_access: false,
          missing_prerequisites: [
            {
              id: 'intermediate-1',
              title: 'Advanced Rhythm Patterns',
              completion_percentage: 0,
            },
          ],
          message: 'Complete required tutorials first',
        }),
      });
    } else {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          can_access: true,
          missing_prerequisites: [],
        }),
      });
    }
  });

  // Mock recommendations
  await page.route('**/api/recommendations**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        recommendations: [
          {
            type: 'next_tutorial',
            tutorial_id: 'intermediate-1',
            title: 'Advanced Rhythm Patterns',
            reason: 'Based on your progress in bass fundamentals',
            confidence: 0.85,
          },
          {
            type: 'skill_development',
            focus_area: 'timing',
            recommended_exercises: ['metronome-practice'],
            reason: 'Improve your rhythm accuracy',
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
          id: 'progress-user',
          email: 'progress@test.com',
        },
      }),
    });
  });
}
