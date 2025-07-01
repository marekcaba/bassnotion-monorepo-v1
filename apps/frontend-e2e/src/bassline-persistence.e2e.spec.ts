import { test, expect, Page } from '@playwright/test';

// Test data
const testBassline = {
  name: 'E2E Test Bassline',
  description: 'Created during end-to-end testing',
  notes: [
    { string: 4, fret: 3, timestamp: 0 },
    { string: 3, fret: 5, timestamp: 500 },
    { string: 2, fret: 7, timestamp: 1000 },
  ],
};

test.describe('Bassline Persistence E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application and ensure user is logged in
    await page.goto('/');
    
    // Mock authentication if needed
    await page.evaluate(() => {
      localStorage.setItem('auth-token', 'mock-jwt-token');
      localStorage.setItem('user-id', 'test-user-123');
    });
    
    // Navigate to the bassline creation page
    await page.goto('/test-exercises');
  });

  test.describe('Bassline Creation and Saving', () => {
    test('should create and save a new bassline successfully', async ({ page }) => {
      // Step 1: Create a bassline by adding notes
      await test.step('Create bassline notes', async () => {
        // Wait for the exercise interface to load
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Add notes to the bassline (simulate user interaction)
        for (const note of testBassline.notes) {
          await page.click(`[data-string="${note.string}"][data-fret="${note.fret}"]`);
          await page.waitForTimeout(100); // Small delay between notes
        }
        
        // Verify notes were added
        const noteElements = await page.locator('[data-testid="exercise-note"]').count();
        expect(noteElements).toBe(testBassline.notes.length);
      });

      // Step 2: Open save dialog
      await test.step('Open save dialog', async () => {
        await page.click('[data-testid="save-bassline-button"]');
        
        // Wait for save dialog to appear
        await page.waitForSelector('[data-testid="save-bassline-dialog"]');
        expect(await page.locator('[data-testid="save-bassline-dialog"]').isVisible()).toBe(true);
      });

      // Step 3: Fill in bassline details
      await test.step('Fill bassline details', async () => {
        // Fill in name
        await page.fill('[data-testid="bassline-name-input"]', testBassline.name);
        
        // Fill in description
        await page.fill('[data-testid="bassline-description-input"]', testBassline.description);
        
        // Select difficulty
        await page.selectOption('[data-testid="difficulty-select"]', 'beginner');
        
        // Add tags
        await page.fill('[data-testid="tag-input"]', 'e2e-test');
        await page.press('[data-testid="tag-input"]', 'Enter');
        
        // Verify tag was added
        expect(await page.locator('[data-testid="tag-badge"]').textContent()).toContain('e2e-test');
      });

      // Step 4: Save the bassline
      await test.step('Save bassline', async () => {
        const saveButton = page.locator('[data-testid="save-button"]');
        await expect(saveButton).toBeEnabled();
        
        // Mock the API response
        await page.route('**/api/user-basslines', async (route) => {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'bassline-e2e-test',
                name: testBassline.name,
                description: testBassline.description,
                notes: testBassline.notes,
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'beginner',
                  tags: ['e2e-test'],
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              message: 'Bassline saved successfully',
            }),
          });
        });
        
        await saveButton.click();
        
        // Wait for success message
        await page.waitForSelector('[data-testid="success-toast"]');
        expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('saved successfully');
        
        // Dialog should close
        await expect(page.locator('[data-testid="save-bassline-dialog"]')).not.toBeVisible();
      });

      // Step 5: Verify bassline appears in the saved list
      await test.step('Verify saved bassline appears in list', async () => {
        // Navigate to saved basslines section
        await page.click('[data-testid="saved-basslines-tab"]');
        
        // Mock the list API response
        await page.route('**/api/user-basslines*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines: [
                {
                  id: 'bassline-e2e-test',
                  name: testBassline.name,
                  description: testBassline.description,
                  notes: testBassline.notes,
                  metadata: {
                    tempo: 120,
                    timeSignature: '4/4',
                    key: 'C',
                    difficulty: 'beginner',
                    tags: ['e2e-test'],
                  },
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                },
              ],
              pagination: {
                page: 1,
                limit: 20,
                total: 1,
                totalPages: 1,
              },
            }),
          });
        });
        
        // Wait for basslines to load
        await page.waitForSelector('[data-testid="bassline-card"]');
        
        // Verify our bassline is in the list
        const basslineCard = page.locator('[data-testid="bassline-card"]').first();
        expect(await basslineCard.locator('[data-testid="bassline-name"]').textContent()).toBe(testBassline.name);
        expect(await basslineCard.locator('[data-testid="bassline-description"]').textContent()).toBe(testBassline.description);
      });
    });

    test('should handle save conflicts gracefully', async ({ page }) => {
      await test.step('Setup conflict scenario', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Add a note
        await page.click('[data-string="4"][data-fret="3"]');
        
        // Open save dialog
        await page.click('[data-testid="save-bassline-button"]');
        await page.waitForSelector('[data-testid="save-bassline-dialog"]');
        
        // Fill in name that will conflict
        await page.fill('[data-testid="bassline-name-input"]', 'Existing Bassline');
      });

      await test.step('Handle conflict response', async () => {
        // Mock conflict response
        await page.route('**/api/user-basslines', async (route) => {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              statusCode: 409,
              message: 'A bassline with this name already exists',
              error: 'Conflict',
            }),
          });
        });
        
        await page.click('[data-testid="save-button"]');
        
        // Wait for error message
        await page.waitForSelector('[data-testid="error-toast"]');
        expect(await page.locator('[data-testid="error-toast"]').textContent()).toContain('already exists');
        
        // Dialog should remain open
        expect(await page.locator('[data-testid="save-bassline-dialog"]').isVisible()).toBe(true);
        
        // Overwrite option should appear
        await page.waitForSelector('[data-testid="overwrite-checkbox"]');
        expect(await page.locator('[data-testid="overwrite-checkbox"]').isVisible()).toBe(true);
      });

      await test.step('Resolve conflict with overwrite', async () => {
        // Check overwrite option
        await page.check('[data-testid="overwrite-checkbox"]');
        
        // Mock successful overwrite response
        await page.route('**/api/user-basslines', async (route) => {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'bassline-overwritten',
                name: 'Existing Bassline',
                notes: [{ string: 4, fret: 3, timestamp: 0 }],
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'beginner',
                  tags: [],
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              message: 'Bassline saved successfully (overwritten)',
            }),
          });
        });
        
        await page.click('[data-testid="save-button"]');
        
        // Wait for success message
        await page.waitForSelector('[data-testid="success-toast"]');
        expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('saved successfully');
      });
    });

    test('should validate form inputs correctly', async ({ page }) => {
      await test.step('Test empty name validation', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Add a note
        await page.click('[data-string="4"][data-fret="3"]');
        
        // Open save dialog
        await page.click('[data-testid="save-bassline-button"]');
        await page.waitForSelector('[data-testid="save-bassline-dialog"]');
        
        // Try to save without name
        const saveButton = page.locator('[data-testid="save-button"]');
        await saveButton.click();
        
        // Should show validation error
        await page.waitForSelector('[data-testid="name-error"]');
        expect(await page.locator('[data-testid="name-error"]').textContent()).toContain('required');
        
        // Dialog should remain open
        expect(await page.locator('[data-testid="save-bassline-dialog"]').isVisible()).toBe(true);
      });

      await test.step('Test name length validation', async () => {
        // Test very long name
        const longName = 'a'.repeat(256);
        await page.fill('[data-testid="bassline-name-input"]', longName);
        
        // Input should truncate or show error
        const inputValue = await page.inputValue('[data-testid="bassline-name-input"]');
        expect(inputValue.length).toBeLessThanOrEqual(255);
      });

      await test.step('Test description length validation', async () => {
        // Fill valid name first
        await page.fill('[data-testid="bassline-name-input"]', 'Valid Name');
        
        // Test very long description
        const longDescription = 'a'.repeat(1001);
        await page.fill('[data-testid="bassline-description-input"]', longDescription);
        
        // Input should truncate or show error
        const inputValue = await page.inputValue('[data-testid="bassline-description-input"]');
        expect(inputValue.length).toBeLessThanOrEqual(1000);
      });
    });
  });

  test.describe('Auto-save Functionality', () => {
    test('should auto-save changes periodically', async ({ page }) => {
      await test.step('Setup auto-save monitoring', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Mock auto-save endpoint
        let autoSaveCallCount = 0;
        await page.route('**/api/user-basslines/auto-save', async (route) => {
          autoSaveCallCount++;
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              basslineId: `auto-save-${autoSaveCallCount}`,
              lastSaved: new Date().toISOString(),
              message: 'Auto-saved successfully',
            }),
          });
        });
        
        // Enable auto-save if not already enabled
        const autoSaveToggle = page.locator('[data-testid="auto-save-toggle"]');
        if (await autoSaveToggle.isVisible() && !(await autoSaveToggle.isChecked())) {
          await autoSaveToggle.check();
        }
      });

      await test.step('Trigger auto-save with changes', async () => {
        // Make changes to trigger auto-save
        for (let i = 0; i < 5; i++) {
          await page.click(`[data-string="4"][data-fret="${i + 1}"]`);
          await page.waitForTimeout(200); // Small delay between notes
        }
        
        // Wait for auto-save indicator
        await page.waitForSelector('[data-testid="auto-save-indicator"]', { timeout: 35000 }); // Auto-save typically happens within 30s
        
        // Verify auto-save status
        const autoSaveStatus = page.locator('[data-testid="auto-save-status"]');
        expect(await autoSaveStatus.textContent()).toContain('Auto-saved');
      });

      await test.step('Verify auto-save recovery', async () => {
        // Simulate page refresh (simulating crash/reload)
        await page.reload();
        
        // Mock recovery endpoint
        await page.route('**/api/user-basslines/auto-save/recovery', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'auto-save-recovery',
                name: 'Auto-saved Bassline',
                notes: [
                  { string: 4, fret: 1, timestamp: 0 },
                  { string: 4, fret: 2, timestamp: 200 },
                  { string: 4, fret: 3, timestamp: 400 },
                  { string: 4, fret: 4, timestamp: 600 },
                  { string: 4, fret: 5, timestamp: 800 },
                ],
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'beginner',
                  tags: [],
                },
                lastSaved: new Date().toISOString(),
              },
            }),
          });
        });
        
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Look for recovery notification
        await page.waitForSelector('[data-testid="recovery-notification"]');
        expect(await page.locator('[data-testid="recovery-notification"]').textContent()).toContain('recovered');
        
        // Verify notes were restored
        const noteElements = await page.locator('[data-testid="exercise-note"]').count();
        expect(noteElements).toBe(5);
      });
    });

    test('should handle auto-save conflicts', async ({ page }) => {
      await test.step('Setup conflict scenario', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Mock auto-save conflict response
        await page.route('**/api/user-basslines/auto-save', async (route) => {
          await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
              statusCode: 409,
              message: 'Auto-save conflict detected',
              error: 'Conflict',
            }),
          });
        });
        
        // Enable auto-save
        const autoSaveToggle = page.locator('[data-testid="auto-save-toggle"]');
        if (await autoSaveToggle.isVisible() && !(await autoSaveToggle.isChecked())) {
          await autoSaveToggle.check();
        }
      });

      await test.step('Trigger and handle conflict', async () => {
        // Make changes to trigger auto-save
        await page.click('[data-string="4"][data-fret="3"]');
        
        // Wait for conflict notification
        await page.waitForSelector('[data-testid="auto-save-conflict-notification"]', { timeout: 35000 });
        
        // Verify conflict handling options are presented
        expect(await page.locator('[data-testid="conflict-keep-local"]').isVisible()).toBe(true);
        expect(await page.locator('[data-testid="conflict-keep-remote"]').isVisible()).toBe(true);
        expect(await page.locator('[data-testid="conflict-merge"]').isVisible()).toBe(true);
      });
    });
  });

  test.describe('Bassline Management', () => {
    test('should load saved basslines successfully', async ({ page }) => {
      await test.step('Navigate to saved basslines', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        await page.click('[data-testid="saved-basslines-tab"]');
        
        // Mock list API with multiple basslines
        await page.route('**/api/user-basslines*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines: [
                {
                  id: 'bassline-1',
                  name: 'Rock Pattern',
                  description: 'Basic rock bassline',
                  notes: [{ string: 4, fret: 3, timestamp: 0 }],
                  metadata: {
                    tempo: 120,
                    timeSignature: '4/4',
                    key: 'C',
                    difficulty: 'beginner',
                    tags: ['rock'],
                  },
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
                {
                  id: 'bassline-2',
                  name: 'Jazz Walking',
                  description: 'Jazz walking bassline',
                  notes: [
                    { string: 3, fret: 5, timestamp: 0 },
                    { string: 4, fret: 7, timestamp: 250 },
                  ],
                  metadata: {
                    tempo: 100,
                    timeSignature: '4/4',
                    key: 'F',
                    difficulty: 'intermediate',
                    tags: ['jazz', 'walking'],
                  },
                  createdAt: '2024-01-02T00:00:00Z',
                  updatedAt: '2024-01-02T00:00:00Z',
                },
              ],
              pagination: {
                page: 1,
                limit: 20,
                total: 2,
                totalPages: 1,
              },
            }),
          });
        });
        
        await page.waitForSelector('[data-testid="bassline-list"]');
      });

      await test.step('Verify basslines display correctly', async () => {
        // Check that both basslines are displayed
        const basslineCards = page.locator('[data-testid="bassline-card"]');
        expect(await basslineCards.count()).toBe(2);
        
        // Verify first bassline details
        const firstCard = basslineCards.first();
        expect(await firstCard.locator('[data-testid="bassline-name"]').textContent()).toBe('Rock Pattern');
        expect(await firstCard.locator('[data-testid="bassline-difficulty"]').textContent()).toBe('Beginner');
        expect(await firstCard.locator('[data-testid="bassline-tempo"]').textContent()).toContain('120 BPM');
        
        // Verify tags
        const rockTag = firstCard.locator('[data-testid="bassline-tag"]').filter({ hasText: 'rock' });
        expect(await rockTag.isVisible()).toBe(true);
      });

      await test.step('Load a bassline', async () => {
        const firstCard = page.locator('[data-testid="bassline-card"]').first();
        const loadButton = firstCard.locator('[data-testid="load-bassline-button"]');
        
        await loadButton.click();
        
        // Wait for bassline to load in the exercise interface
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Verify the bassline was loaded
        const noteElements = await page.locator('[data-testid="exercise-note"]').count();
        expect(noteElements).toBe(1); // Rock Pattern has 1 note
        
        // Verify loading success notification
        await page.waitForSelector('[data-testid="success-toast"]');
        expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('loaded');
      });
    });

    test('should search and filter basslines', async ({ page }) => {
      await test.step('Setup basslines list', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        await page.click('[data-testid="saved-basslines-tab"]');
        
        // Mock comprehensive basslines list
        await page.route('**/api/user-basslines*', async (route) => {
          const url = new URL(route.request().url());
          const search = url.searchParams.get('search') || '';
          const difficulty = url.searchParams.get('difficulty') || '';
          
          let basslines = [
            {
              id: 'bassline-1',
              name: 'Rock Pattern',
              description: 'Basic rock bassline',
              metadata: { difficulty: 'beginner', tags: ['rock'] },
            },
            {
              id: 'bassline-2',
              name: 'Jazz Walking',
              description: 'Jazz walking bassline',
              metadata: { difficulty: 'intermediate', tags: ['jazz', 'walking'] },
            },
            {
              id: 'bassline-3',
              name: 'Funk Groove',
              description: 'Syncopated funk pattern',
              metadata: { difficulty: 'advanced', tags: ['funk', 'slap'] },
            },
          ];
          
          // Apply search filter
          if (search) {
            basslines = basslines.filter(b => 
              b.name.toLowerCase().includes(search.toLowerCase()) ||
              b.description.toLowerCase().includes(search.toLowerCase())
            );
          }
          
          // Apply difficulty filter
          if (difficulty && difficulty !== 'all') {
            basslines = basslines.filter(b => b.metadata.difficulty === difficulty);
          }
          
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines,
              pagination: {
                page: 1,
                limit: 20,
                total: basslines.length,
                totalPages: 1,
              },
            }),
          });
        });
        
        await page.waitForSelector('[data-testid="bassline-list"]');
      });

      await test.step('Test search functionality', async () => {
        // Search for "jazz"
        await page.fill('[data-testid="search-input"]', 'jazz');
        await page.press('[data-testid="search-input"]', 'Enter');
        
        // Wait for search results
        await page.waitForSelector('[data-testid="bassline-card"]');
        
        // Should only show jazz bassline
        const basslineCards = page.locator('[data-testid="bassline-card"]');
        expect(await basslineCards.count()).toBe(1);
        expect(await basslineCards.first().locator('[data-testid="bassline-name"]').textContent()).toBe('Jazz Walking');
      });

      await test.step('Test difficulty filter', async () => {
        // Clear search first
        await page.fill('[data-testid="search-input"]', '');
        await page.press('[data-testid="search-input"]', 'Enter');
        
        // Wait for all results to load
        await page.waitForSelector('[data-testid="bassline-card"]');
        expect(await page.locator('[data-testid="bassline-card"]').count()).toBe(3);
        
        // Filter by difficulty
        await page.selectOption('[data-testid="difficulty-filter"]', 'beginner');
        
        // Wait for filtered results
        await page.waitForTimeout(500);
        
        // Should only show beginner basslines
        const basslineCards = page.locator('[data-testid="bassline-card"]');
        expect(await basslineCards.count()).toBe(1);
        expect(await basslineCards.first().locator('[data-testid="bassline-name"]').textContent()).toBe('Rock Pattern');
      });

      await test.step('Test combined search and filter', async () => {
        // Search for "pattern" with beginner difficulty
        await page.fill('[data-testid="search-input"]', 'pattern');
        await page.selectOption('[data-testid="difficulty-filter"]', 'beginner');
        await page.press('[data-testid="search-input"]', 'Enter');
        
        // Should show Rock Pattern
        const basslineCards = page.locator('[data-testid="bassline-card"]');
        expect(await basslineCards.count()).toBe(1);
        expect(await basslineCards.first().locator('[data-testid="bassline-name"]').textContent()).toBe('Rock Pattern');
      });
    });

    test('should rename basslines successfully', async ({ page }) => {
      await test.step('Setup and open rename dialog', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        await page.click('[data-testid="saved-basslines-tab"]');
        
        // Mock single bassline
        await page.route('**/api/user-basslines*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines: [
                {
                  id: 'bassline-1',
                  name: 'Original Name',
                  description: 'Test bassline',
                  notes: [{ string: 4, fret: 3, timestamp: 0 }],
                  metadata: {
                    tempo: 120,
                    timeSignature: '4/4',
                    key: 'C',
                    difficulty: 'beginner',
                    tags: [],
                  },
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
              ],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            }),
          });
        });
        
        await page.waitForSelector('[data-testid="bassline-card"]');
        
        // Open context menu and click rename
        await page.click('[data-testid="bassline-menu-button"]');
        await page.click('[data-testid="rename-bassline-option"]');
        
        // Wait for rename dialog
        await page.waitForSelector('[data-testid="rename-dialog"]');
      });

      await test.step('Rename the bassline', async () => {
        // Mock rename API response
        await page.route('**/api/user-basslines/bassline-1/rename', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'bassline-1',
                name: 'New Bassline Name',
                description: 'Test bassline',
                notes: [{ string: 4, fret: 3, timestamp: 0 }],
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'beginner',
                  tags: [],
                },
                updatedAt: new Date().toISOString(),
              },
              message: 'Bassline renamed successfully',
            }),
          });
        });
        
        // Fill in new name
        await page.fill('[data-testid="new-name-input"]', 'New Bassline Name');
        
        // Click save
        await page.click('[data-testid="rename-save-button"]');
        
        // Wait for success message
        await page.waitForSelector('[data-testid="success-toast"]');
        expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('renamed');
        
        // Dialog should close
        await expect(page.locator('[data-testid="rename-dialog"]')).not.toBeVisible();
        
        // Verify name updated in the list
        expect(await page.locator('[data-testid="bassline-name"]').textContent()).toBe('New Bassline Name');
      });
    });

    test('should delete basslines with confirmation', async ({ page }) => {
      await test.step('Setup delete scenario', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        await page.click('[data-testid="saved-basslines-tab"]');
        
        // Mock basslines list
        await page.route('**/api/user-basslines*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines: [
                {
                  id: 'bassline-to-delete',
                  name: 'Bassline to Delete',
                  description: 'This will be deleted',
                  notes: [{ string: 4, fret: 3, timestamp: 0 }],
                  metadata: {
                    tempo: 120,
                    timeSignature: '4/4',
                    key: 'C',
                    difficulty: 'beginner',
                    tags: [],
                  },
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
              ],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            }),
          });
        });
        
        await page.waitForSelector('[data-testid="bassline-card"]');
        
        // Open context menu and click delete
        await page.click('[data-testid="bassline-menu-button"]');
        await page.click('[data-testid="delete-bassline-option"]');
        
        // Wait for confirmation dialog
        await page.waitForSelector('[data-testid="delete-confirmation-dialog"]');
      });

      await test.step('Confirm deletion', async () => {
        // Verify confirmation dialog content
        expect(await page.locator('[data-testid="delete-confirmation-text"]').textContent()).toContain('Bassline to Delete');
        expect(await page.locator('[data-testid="delete-confirmation-text"]').textContent()).toContain('permanently deleted');
        
        // Mock delete API response
        await page.route('**/api/user-basslines/bassline-to-delete', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              message: 'Bassline deleted successfully',
            }),
          });
        });
        
        // Mock updated list (empty after deletion)
        await page.route('**/api/user-basslines*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines: [],
              pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
            }),
          });
        });
        
        // Confirm deletion
        await page.click('[data-testid="confirm-delete-button"]');
        
        // Wait for success message
        await page.waitForSelector('[data-testid="success-toast"]');
        expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('deleted');
        
        // Dialog should close
        await expect(page.locator('[data-testid="delete-confirmation-dialog"]')).not.toBeVisible();
        
        // Bassline should be removed from list
        await page.waitForSelector('[data-testid="empty-state"]');
        expect(await page.locator('[data-testid="empty-state"]').textContent()).toContain('No basslines found');
      });
    });
  });

  test.describe('Performance and Reliability', () => {
    test('should handle large basslines efficiently', async ({ page }) => {
      await test.step('Create large bassline', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Create a bassline with many notes
        for (let i = 0; i < 100; i++) {
          const string = (i % 4) + 1;
          const fret = (i % 12) + 1;
          await page.click(`[data-string="${string}"][data-fret="${fret}"]`);
          
          // Add small delay every 10 notes to avoid overwhelming the interface
          if (i % 10 === 0) {
            await page.waitForTimeout(100);
          }
        }
        
        // Verify notes were added
        const noteElements = await page.locator('[data-testid="exercise-note"]').count();
        expect(noteElements).toBe(100);
      });

      await test.step('Save large bassline within performance limits', async () => {
        const startTime = Date.now();
        
        // Open save dialog
        await page.click('[data-testid="save-bassline-button"]');
        await page.waitForSelector('[data-testid="save-bassline-dialog"]');
        
        // Fill details
        await page.fill('[data-testid="bassline-name-input"]', 'Large Bassline');
        
        // Mock save response
        await page.route('**/api/user-basslines', async (route) => {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'large-bassline',
                name: 'Large Bassline',
                notes: Array.from({ length: 100 }, (_, i) => ({
                  id: `note-${i}`,
                  string: (i % 4) + 1,
                  fret: (i % 12) + 1,
                  timestamp: i * 100,
                })),
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'advanced',
                  tags: ['large'],
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              message: 'Large bassline saved successfully',
            }),
          });
        });
        
        // Save
        await page.click('[data-testid="save-button"]');
        
        // Wait for completion
        await page.waitForSelector('[data-testid="success-toast"]');
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        // Should complete within reasonable time (5 seconds for large bassline)
        expect(duration).toBeLessThan(5000);
      });
    });

    test('should handle network failures gracefully', async ({ page }) => {
      await test.step('Simulate network failure during save', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Add a note
        await page.click('[data-string="4"][data-fret="3"]');
        
        // Open save dialog
        await page.click('[data-testid="save-bassline-button"]');
        await page.waitForSelector('[data-testid="save-bassline-dialog"]');
        
        // Fill name
        await page.fill('[data-testid="bassline-name-input"]', 'Network Test');
        
        // Mock network failure
        await page.route('**/api/user-basslines', async (route) => {
          await route.abort('failed');
        });
        
        // Try to save
        await page.click('[data-testid="save-button"]');
        
        // Wait for error message
        await page.waitForSelector('[data-testid="error-toast"]');
        expect(await page.locator('[data-testid="error-toast"]').textContent()).toContain('network');
        
        // Dialog should remain open for retry
        expect(await page.locator('[data-testid="save-bassline-dialog"]').isVisible()).toBe(true);
      });

      await test.step('Retry after network recovery', async () => {
        // Mock successful response
        await page.route('**/api/user-basslines', async (route) => {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'network-recovery',
                name: 'Network Test',
                notes: [{ string: 4, fret: 3, timestamp: 0 }],
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'beginner',
                  tags: [],
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              message: 'Bassline saved successfully',
            }),
          });
        });
        
        // Retry save
        await page.click('[data-testid="save-button"]');
        
        // Should succeed this time
        await page.waitForSelector('[data-testid="success-toast"]');
        expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('saved successfully');
      });
    });

    test('should maintain data integrity across page refreshes', async ({ page }) => {
      await test.step('Create and save bassline', async () => {
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Create specific note pattern
        const notePattern = [
          { string: 4, fret: 3 },
          { string: 3, fret: 5 },
          { string: 2, fret: 7 },
          { string: 1, fret: 9 },
        ];
        
        for (const note of notePattern) {
          await page.click(`[data-string="${note.string}"][data-fret="${note.fret}"]`);
          await page.waitForTimeout(100);
        }
        
        // Save bassline
        await page.click('[data-testid="save-bassline-button"]');
        await page.waitForSelector('[data-testid="save-bassline-dialog"]');
        await page.fill('[data-testid="bassline-name-input"]', 'Integrity Test');
        
        // Mock save response
        await page.route('**/api/user-basslines', async (route) => {
          await route.fulfill({
            status: 201,
            contentType: 'application/json',
            body: JSON.stringify({
              bassline: {
                id: 'integrity-test',
                name: 'Integrity Test',
                notes: notePattern.map((note, i) => ({
                  id: `note-${i}`,
                  string: note.string,
                  fret: note.fret,
                  timestamp: i * 100,
                  note: 'C',
                  color: '#ff0000',
                  techniques: [],
                })),
                metadata: {
                  tempo: 120,
                  timeSignature: '4/4',
                  key: 'C',
                  difficulty: 'beginner',
                  tags: [],
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
              message: 'Bassline saved successfully',
            }),
          });
        });
        
        await page.click('[data-testid="save-button"]');
        await page.waitForSelector('[data-testid="success-toast"]');
      });

      await test.step('Refresh page and verify data integrity', async () => {
        // Refresh the page
        await page.reload();
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Navigate to saved basslines
        await page.click('[data-testid="saved-basslines-tab"]');
        
        // Mock list response
        await page.route('**/api/user-basslines*', async (route) => {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              basslines: [
                {
                  id: 'integrity-test',
                  name: 'Integrity Test',
                  notes: [
                    { id: 'note-0', string: 4, fret: 3, timestamp: 0, note: 'C', color: '#ff0000', techniques: [] },
                    { id: 'note-1', string: 3, fret: 5, timestamp: 100, note: 'C', color: '#ff0000', techniques: [] },
                    { id: 'note-2', string: 2, fret: 7, timestamp: 200, note: 'C', color: '#ff0000', techniques: [] },
                    { id: 'note-3', string: 1, fret: 9, timestamp: 300, note: 'C', color: '#ff0000', techniques: [] },
                  ],
                  metadata: {
                    tempo: 120,
                    timeSignature: '4/4',
                    key: 'C',
                    difficulty: 'beginner',
                    tags: [],
                  },
                  createdAt: '2024-01-01T00:00:00Z',
                  updatedAt: '2024-01-01T00:00:00Z',
                },
              ],
              pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            }),
          });
        });
        
        await page.waitForSelector('[data-testid="bassline-card"]');
        
        // Load the bassline
        await page.click('[data-testid="load-bassline-button"]');
        await page.waitForSelector('[data-testid="exercise-interface"]');
        
        // Verify all notes are present and correct
        const noteElements = await page.locator('[data-testid="exercise-note"]').count();
        expect(noteElements).toBe(4);
        
        // Verify specific note properties (if available in DOM)
        const firstNote = page.locator('[data-testid="exercise-note"]').first();
        expect(await firstNote.getAttribute('data-string')).toBe('4');
        expect(await firstNote.getAttribute('data-fret')).toBe('3');
      });
    });
  });
}); 