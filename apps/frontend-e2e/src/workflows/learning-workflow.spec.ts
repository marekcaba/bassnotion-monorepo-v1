import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';

/**
 * Learning Workflow E2E Tests
 *
 * Tests the complete learning experience including tutorial progression,
 * exercise completion, skill development, and progress tracking.
 */

test.describe('Learning Workflow Tests', () => {
  let page: Page;
  const learner = {
    email: `learner+workflow${Date.now()}@test.com`,
    password: 'LearningFlow123!',
  };

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    await setupLearningMocks(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should complete progressive learning workflow', async () => {
    await test.step('🎓 Setup Learner Profile', async () => {
      // Login/Register as learner
      await page.goto('/register');
      await page.fill('input[name="email"]', learner.email);
      await page.fill('input[name="password"]', learner.password);
      await page.fill('input[name="confirmPassword"]', learner.password);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);

      // Set initial bass configuration
      const settingsButton = page.locator(
        '[data-testid="bass-settings-button"]',
      );
      if (await settingsButton.isVisible()) {
        await settingsButton.click();
        await page.waitForSelector('[data-testid="bass-settings-modal"]');

        // Configure for beginner (4-string, 20-fret)
        await page.click('[data-testid="string-config-4-string"]');
        await page.click('[data-testid="fret-config-20-fret"]');
        await page.click('[data-testid="save-bass-settings"]');

        await expect(
          page.locator('[data-testid="settings-saved-toast"]'),
        ).toBeVisible();
      }
    });

    await test.step('📚 Browse Learning Path', async () => {
      // Navigate to tutorial library
      await page.click('a[href="/library"]');
      await expect(page).toHaveURL('/library');

      // Check difficulty filtering
      await page.selectOption('[data-testid="difficulty-filter"]', 'beginner');
      await page.waitForSelector('[data-testid="tutorial-card"]');

      // Verify beginner tutorials are shown
      const tutorialCards = page.locator('[data-testid="tutorial-card"]');
      await expect(tutorialCards).toHaveCount(2); // Based on mock data

      // Select first beginner tutorial
      const firstTutorial = tutorialCards.first();
      await expect(
        firstTutorial.locator('[data-testid="tutorial-difficulty"]'),
      ).toContainText('Beginner');

      await firstTutorial.click();
      await expect(page).toHaveURL(/\/library\/beginner-basics/);
    });

    await test.step('🎯 Progressive Exercise Completion', async () => {
      // Should see exercise progression
      await page.waitForSelector('[data-testid="exercise-list"]');
      const exercises = page.locator('[data-testid="exercise-item"]');
      await expect(exercises).toHaveCount(3);

      // Exercise 1: Basic Fingering
      await test.step('Exercise 1: Basic Fingering', async () => {
        const exercise1 = exercises.nth(0);
        await expect(
          exercise1.locator('[data-testid="exercise-title"]'),
        ).toContainText('Basic Fingering');
        await expect(
          exercise1.locator('[data-testid="exercise-status"]'),
        ).toContainText('Start');

        await exercise1.click();
        await page.waitForSelector('[data-testid="exercise-interface"]');

        // Practice for minimum time
        await page.click('[data-testid="play-button"]');
        await page.waitForTimeout(5000); // 5 seconds practice

        // Complete exercise
        await page.click('[data-testid="mark-complete-button"]');
        await expect(
          page.locator('[data-testid="completion-toast"]'),
        ).toBeVisible();

        // Return to exercise list
        await page.click('[data-testid="back-to-exercises"]');

        // Verify exercise 1 is marked complete
        await expect(
          exercise1.locator('[data-testid="exercise-status"]'),
        ).toContainText('Complete');

        // Verify exercise 2 is now unlocked
        const exercise2 = exercises.nth(1);
        await expect(
          exercise2.locator('[data-testid="exercise-status"]'),
        ).toContainText('Start');
      });

      // Exercise 2: Simple Patterns
      await test.step('Exercise 2: Simple Patterns', async () => {
        const exercise2 = exercises.nth(1);
        await expect(
          exercise2.locator('[data-testid="exercise-title"]'),
        ).toContainText('Simple Patterns');

        await exercise2.click();
        await page.waitForSelector('[data-testid="exercise-interface"]');

        // More advanced practice with fretboard interaction
        await page.click('[data-testid="play-button"]');

        // Practice specific notes
        const fretboardNotes = [
          { string: 4, fret: 0 },
          { string: 4, fret: 2 },
          { string: 3, fret: 0 },
          { string: 3, fret: 2 },
        ];

        for (const note of fretboardNotes) {
          const noteElement = page.locator(
            `[data-string="${note.string}"][data-fret="${note.fret}"]`,
          );
          if (await noteElement.isVisible()) {
            await noteElement.click();
            await page.waitForTimeout(500);
          }
        }

        // Check practice accuracy
        const accuracyDisplay = page.locator(
          '[data-testid="practice-accuracy"]',
        );
        if (await accuracyDisplay.isVisible()) {
          const accuracy = await accuracyDisplay.textContent();
          expect(accuracy).toMatch(/\d+%/);
        }

        await page.click('[data-testid="mark-complete-button"]');
        await page.click('[data-testid="back-to-exercises"]');
      });

      // Exercise 3: Song Application
      await test.step('Exercise 3: Song Application', async () => {
        const exercise3 = exercises.nth(2);
        await expect(
          exercise3.locator('[data-testid="exercise-title"]'),
        ).toContainText('Song Application');

        await exercise3.click();
        await page.waitForSelector('[data-testid="exercise-interface"]');

        // Advanced features test
        await page.click('[data-testid="play-button"]');

        // Test tempo adjustment
        const tempoSlider = page.locator('[data-testid="tempo-slider"]');
        if (await tempoSlider.isVisible()) {
          await tempoSlider.fill('80'); // Slower tempo for learning
          await expect(
            page.locator('[data-testid="tempo-display"]'),
          ).toContainText('80');
        }

        // Test loop functionality
        const loopButton = page.locator('[data-testid="loop-button"]');
        if (await loopButton.isVisible()) {
          await loopButton.click();
          await expect(loopButton).toHaveClass(/active/);
        }

        // Practice with metronome
        const metronomeButton = page.locator(
          '[data-testid="metronome-button"]',
        );
        if (await metronomeButton.isVisible()) {
          await metronomeButton.click();
          await expect(
            page.locator('[data-testid="metronome-indicator"]'),
          ).toBeVisible();
        }

        await page.waitForTimeout(8000); // Extended practice
        await page.click('[data-testid="mark-complete-button"]');
        await page.click('[data-testid="back-to-exercises"]');
      });
    });

    await test.step('📊 Progress Assessment', async () => {
      // Check tutorial completion status
      const progressBar = page.locator('[data-testid="tutorial-progress"]');
      await expect(progressBar).toBeVisible();

      const progressText = await progressBar.textContent();
      expect(progressText).toContain('100%'); // All exercises completed

      // Check skill level progression
      const skillIndicator = page.locator('[data-testid="skill-level"]');
      if (await skillIndicator.isVisible()) {
        const skillLevel = await skillIndicator.textContent();
        expect(skillLevel).toMatch(/(Beginner|Novice)/);
      }

      // Verify certificates/achievements
      const achievementButton = page.locator(
        '[data-testid="view-achievements"]',
      );
      if (await achievementButton.isVisible()) {
        await achievementButton.click();

        await page.waitForSelector('[data-testid="achievement-modal"]');
        const achievements = page.locator('[data-testid="achievement-item"]');
        await expect(achievements.first()).toBeVisible();

        await page.click('[data-testid="close-achievements"]');
      }
    });

    await test.step('🎵 Next Level Recommendation', async () => {
      // Check for next tutorial recommendations
      const recommendationSection = page.locator(
        '[data-testid="next-recommendations"]',
      );
      if (await recommendationSection.isVisible()) {
        const nextTutorial = recommendationSection
          .locator('[data-testid="recommended-tutorial"]')
          .first();
        await expect(nextTutorial).toBeVisible();

        // Should recommend intermediate level
        await expect(
          nextTutorial.locator('[data-testid="tutorial-difficulty"]'),
        ).toContainText('Intermediate');
      }

      // Test navigation to next tutorial
      await page.click('a[href="/library"]');
      await page.selectOption(
        '[data-testid="difficulty-filter"]',
        'intermediate',
      );

      const intermediateTutorials = page.locator(
        '[data-testid="tutorial-card"]',
      );
      await expect(intermediateTutorials).toHaveCount(2);
    });
  });

  test('should handle practice session management', async () => {
    await test.step('🕐 Practice Session Tracking', async () => {
      await page.goto('/library/beginner-basics');
      await page.waitForSelector('[data-testid="exercise-item"]');

      // Start practice session
      await page.locator('[data-testid="exercise-item"]').first().click();
      await page.waitForSelector('[data-testid="exercise-interface"]');

      // Check session timer
      const sessionTimer = page.locator('[data-testid="session-timer"]');
      await expect(sessionTimer).toBeVisible();

      // Start practice
      await page.click('[data-testid="play-button"]');

      // Check timer updates
      await page.waitForTimeout(3000);
      const timerText = await sessionTimer.textContent();
      expect(timerText).toMatch(/\d+:\d+/);

      // Test pause/resume
      await page.click('[data-testid="pause-button"]');
      const pausedText = await sessionTimer.textContent();

      await page.waitForTimeout(1000);
      const stillPausedText = await sessionTimer.textContent();
      expect(stillPausedText).toBe(pausedText); // Should not change when paused

      await page.click('[data-testid="play-button"]');

      // Save practice session
      const saveSessionButton = page.locator('[data-testid="save-session"]');
      if (await saveSessionButton.isVisible()) {
        await saveSessionButton.click();
        await expect(
          page.locator('[data-testid="session-saved-toast"]'),
        ).toBeVisible();
      }
    });

    await test.step('📈 Practice Analytics', async () => {
      // Navigate to practice history/analytics
      const analyticsButton = page.locator('[data-testid="view-analytics"]');
      if (await analyticsButton.isVisible()) {
        await analyticsButton.click();

        await page.waitForSelector('[data-testid="analytics-dashboard"]');

        // Check practice statistics
        await expect(
          page.locator('[data-testid="total-practice-time"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="exercises-completed"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="accuracy-trends"]'),
        ).toBeVisible();

        // Check practice calendar
        const practiceCalendar = page.locator(
          '[data-testid="practice-calendar"]',
        );
        if (await practiceCalendar.isVisible()) {
          const todayCell = practiceCalendar.locator('[data-today="true"]');
          await expect(todayCell).toHaveClass(/has-practice/);
        }
      }
    });
  });

  test('should support different learning styles', async () => {
    await test.step('🎯 Visual Learning Mode', async () => {
      await page.goto('/library/beginner-basics');
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Enable visual learning aids
      const visualModeButton = page.locator('[data-testid="visual-mode"]');
      if (await visualModeButton.isVisible()) {
        await visualModeButton.click();

        // Check visual indicators
        await expect(page.locator('[data-testid="note-names"]')).toBeVisible();
        await expect(
          page.locator('[data-testid="finger-positions"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="fret-markers"]'),
        ).toBeVisible();
      }
    });

    await test.step('🎵 Audio Learning Mode', async () => {
      // Enable audio-focused learning
      const audioModeButton = page.locator('[data-testid="audio-mode"]');
      if (await audioModeButton.isVisible()) {
        await audioModeButton.click();

        // Check audio controls
        await expect(
          page.locator('[data-testid="audio-isolation"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="playback-speed"]'),
        ).toBeVisible();
        await expect(
          page.locator('[data-testid="loop-controls"]'),
        ).toBeVisible();
      }
    });

    await test.step('🤖 Adaptive Learning Mode', async () => {
      // Test adaptive difficulty
      const adaptiveButton = page.locator('[data-testid="adaptive-mode"]');
      if (await adaptiveButton.isVisible()) {
        await adaptiveButton.click();

        // Should adjust based on performance
        await page.click('[data-testid="play-button"]');

        // Simulate poor performance
        for (let i = 0; i < 5; i++) {
          await page.click('[data-string="4"][data-fret="0"]');
          await page.waitForTimeout(200);
        }

        // Check if difficulty adjusted
        const difficultyIndicator = page.locator(
          '[data-testid="current-difficulty"]',
        );
        if (await difficultyIndicator.isVisible()) {
          const difficulty = await difficultyIndicator.textContent();
          expect(difficulty).toMatch(/(Easier|Slower|Guided)/);
        }
      }
    });
  });

  test('should handle learning interruptions and resumption', async () => {
    await test.step('💾 Auto-save Learning Progress', async () => {
      await page.goto('/library/beginner-basics');
      await page.locator('[data-testid="exercise-item"]').first().click();

      // Start exercise
      await page.click('[data-testid="play-button"]');
      await page.waitForTimeout(3000);

      // Simulate browser close/refresh
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should offer to resume
      const resumeModal = page.locator('[data-testid="resume-practice-modal"]');
      if (await resumeModal.isVisible()) {
        await expect(
          resumeModal.locator('[data-testid="resume-text"]'),
        ).toContainText('Continue where you left off');

        await page.click('[data-testid="resume-practice"]');

        // Should restore practice state
        await expect(
          page.locator('[data-testid="exercise-interface"]'),
        ).toBeVisible();
      }
    });

    await test.step('🔄 Cross-Device Synchronization', async () => {
      // Simulate switching devices
      await page.goto('/library');

      // Check if progress synced
      const tutorialCard = page
        .locator('[data-testid="tutorial-card"]')
        .first();
      const progressIndicator = tutorialCard.locator(
        '[data-testid="progress-indicator"]',
      );

      if (await progressIndicator.isVisible()) {
        const progress = await progressIndicator.textContent();
        expect(progress).toMatch(/\d+%/);
      }
    });
  });
});

async function setupLearningMocks(page: Page) {
  // Mock progressive tutorial structure
  await page.route('**/api/tutorials**', (route) => {
    const url = route.request().url();

    if (url.includes('difficulty=beginner')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'beginner-basics',
              slug: 'beginner-basics',
              title: 'Bass Basics',
              artist: 'BassNotion Academy',
              difficulty: 'beginner',
              exercise_count: 3,
              is_active: true,
              progress_percentage: 0,
            },
            {
              id: 'first-songs',
              slug: 'first-songs',
              title: 'Your First Songs',
              artist: 'BassNotion Academy',
              difficulty: 'beginner',
              exercise_count: 4,
              is_active: true,
              progress_percentage: 0,
            },
          ],
          total: 2,
        }),
      });
    } else if (url.includes('difficulty=intermediate')) {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tutorials: [
            {
              id: 'rhythm-patterns',
              slug: 'rhythm-patterns',
              title: 'Rhythm Patterns',
              artist: 'BassNotion Academy',
              difficulty: 'intermediate',
              exercise_count: 5,
              is_active: true,
            },
            {
              id: 'walking-bass',
              slug: 'walking-bass',
              title: 'Walking Bass Lines',
              artist: 'BassNotion Academy',
              difficulty: 'intermediate',
              exercise_count: 6,
              is_active: true,
            },
          ],
          total: 2,
        }),
      });
    } else {
      route.continue();
    }
  });

  // Mock progressive exercises
  await page.route('**/api/tutorials/beginner-basics/exercises**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        tutorial: {
          id: 'beginner-basics',
          title: 'Bass Basics',
          difficulty: 'beginner',
        },
        exercises: [
          {
            id: 'ex1',
            title: 'Basic Fingering',
            difficulty: 'beginner',
            duration: 180000,
            bpm: 60,
            status: 'available',
            completion_percentage: 0,
          },
          {
            id: 'ex2',
            title: 'Simple Patterns',
            difficulty: 'beginner',
            duration: 240000,
            bpm: 70,
            status: 'locked',
            completion_percentage: 0,
          },
          {
            id: 'ex3',
            title: 'Song Application',
            difficulty: 'beginner',
            duration: 300000,
            bpm: 80,
            status: 'locked',
            completion_percentage: 0,
          },
        ],
      }),
    });
  });

  // Mock exercise completion
  await page.route('**/api/exercises/*/complete', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        message: 'Exercise completed successfully',
        completion: {
          exercise_id: route.request().url().split('/')[5],
          completed_at: new Date().toISOString(),
          score: 85,
          practice_time: 180,
        },
        nextExercise: {
          id: 'ex2',
          title: 'Simple Patterns',
          status: 'available',
        },
      }),
    });
  });

  // Mock practice session tracking
  await page.route('**/api/practice/sessions**', (route) => {
    route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        session: {
          id: 'session-123',
          exercise_id: 'ex1',
          start_time: new Date().toISOString(),
          duration: 180,
          accuracy: 78,
          notes_played: 45,
        },
      }),
    });
  });

  // Mock learning analytics
  await page.route('**/api/analytics/practice**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        stats: {
          total_practice_time: 1800, // 30 minutes
          exercises_completed: 3,
          average_accuracy: 82,
          practice_streak: 5,
          skill_level: 'Beginner',
        },
        calendar: {
          [new Date().toISOString().split('T')[0]]: {
            practice_time: 180,
            exercises: 1,
          },
        },
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
          id: 'learner-123',
          email: 'learner+workflow@test.com',
          skill_level: 'beginner',
          preferences: {
            learning_style: 'visual',
            practice_reminders: true,
          },
        },
      }),
    });
  });
}
