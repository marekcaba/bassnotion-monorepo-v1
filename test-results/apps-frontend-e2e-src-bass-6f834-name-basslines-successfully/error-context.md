# Test info

- Name: Bassline Persistence E2E Tests >> Bassline Management >> should rename basslines successfully
- Location: /Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/apps/frontend-e2e/src/bassline-persistence.e2e.spec.ts:624:5

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/", waiting until "load"

    at /Users/marekcaba/Documents/Projekty 2024/🟣 BassNotion/4. Cursor Project Folder/bassnotion-monorepo-v1/apps/frontend-e2e/src/bassline-persistence.e2e.spec.ts:17:16
```

# Test source

```ts
   1 | import { test, expect, Page } from '@playwright/test';
   2 |
   3 | // Test data
   4 | const testBassline = {
   5 |   name: 'E2E Test Bassline',
   6 |   description: 'Created during end-to-end testing',
   7 |   notes: [
   8 |     { string: 4, fret: 3, timestamp: 0 },
   9 |     { string: 3, fret: 5, timestamp: 500 },
   10 |     { string: 2, fret: 7, timestamp: 1000 },
   11 |   ],
   12 | };
   13 |
   14 | test.describe('Bassline Persistence E2E Tests', () => {
   15 |   test.beforeEach(async ({ page }) => {
   16 |     // Navigate to the application and ensure user is logged in
>  17 |     await page.goto('/');
      |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
   18 |     
   19 |     // Mock authentication if needed
   20 |     await page.evaluate(() => {
   21 |       localStorage.setItem('auth-token', 'mock-jwt-token');
   22 |       localStorage.setItem('user-id', 'test-user-123');
   23 |     });
   24 |     
   25 |     // Navigate to the bassline creation page
   26 |     await page.goto('/test-exercises');
   27 |   });
   28 |
   29 |   test.describe('Bassline Creation and Saving', () => {
   30 |     test('should create and save a new bassline successfully', async ({ page }) => {
   31 |       // Step 1: Create a bassline by adding notes
   32 |       await test.step('Create bassline notes', async () => {
   33 |         // Wait for the exercise interface to load
   34 |         await page.waitForSelector('[data-testid="exercise-interface"]');
   35 |         
   36 |         // Add notes to the bassline (simulate user interaction)
   37 |         for (const note of testBassline.notes) {
   38 |           await page.click(`[data-string="${note.string}"][data-fret="${note.fret}"]`);
   39 |           await page.waitForTimeout(100); // Small delay between notes
   40 |         }
   41 |         
   42 |         // Verify notes were added
   43 |         const noteElements = await page.locator('[data-testid="exercise-note"]').count();
   44 |         expect(noteElements).toBe(testBassline.notes.length);
   45 |       });
   46 |
   47 |       // Step 2: Open save dialog
   48 |       await test.step('Open save dialog', async () => {
   49 |         await page.click('[data-testid="save-bassline-button"]');
   50 |         
   51 |         // Wait for save dialog to appear
   52 |         await page.waitForSelector('[data-testid="save-bassline-dialog"]');
   53 |         expect(await page.locator('[data-testid="save-bassline-dialog"]').isVisible()).toBe(true);
   54 |       });
   55 |
   56 |       // Step 3: Fill in bassline details
   57 |       await test.step('Fill bassline details', async () => {
   58 |         // Fill in name
   59 |         await page.fill('[data-testid="bassline-name-input"]', testBassline.name);
   60 |         
   61 |         // Fill in description
   62 |         await page.fill('[data-testid="bassline-description-input"]', testBassline.description);
   63 |         
   64 |         // Select difficulty
   65 |         await page.selectOption('[data-testid="difficulty-select"]', 'beginner');
   66 |         
   67 |         // Add tags
   68 |         await page.fill('[data-testid="tag-input"]', 'e2e-test');
   69 |         await page.press('[data-testid="tag-input"]', 'Enter');
   70 |         
   71 |         // Verify tag was added
   72 |         expect(await page.locator('[data-testid="tag-badge"]').textContent()).toContain('e2e-test');
   73 |       });
   74 |
   75 |       // Step 4: Save the bassline
   76 |       await test.step('Save bassline', async () => {
   77 |         const saveButton = page.locator('[data-testid="save-button"]');
   78 |         await expect(saveButton).toBeEnabled();
   79 |         
   80 |         // Mock the API response
   81 |         await page.route('**/api/user-basslines', async (route) => {
   82 |           await route.fulfill({
   83 |             status: 201,
   84 |             contentType: 'application/json',
   85 |             body: JSON.stringify({
   86 |               bassline: {
   87 |                 id: 'bassline-e2e-test',
   88 |                 name: testBassline.name,
   89 |                 description: testBassline.description,
   90 |                 notes: testBassline.notes,
   91 |                 metadata: {
   92 |                   tempo: 120,
   93 |                   timeSignature: '4/4',
   94 |                   key: 'C',
   95 |                   difficulty: 'beginner',
   96 |                   tags: ['e2e-test'],
   97 |                 },
   98 |                 createdAt: new Date().toISOString(),
   99 |                 updatedAt: new Date().toISOString(),
  100 |               },
  101 |               message: 'Bassline saved successfully',
  102 |             }),
  103 |           });
  104 |         });
  105 |         
  106 |         await saveButton.click();
  107 |         
  108 |         // Wait for success message
  109 |         await page.waitForSelector('[data-testid="success-toast"]');
  110 |         expect(await page.locator('[data-testid="success-toast"]').textContent()).toContain('saved successfully');
  111 |         
  112 |         // Dialog should close
  113 |         await expect(page.locator('[data-testid="save-bassline-dialog"]')).not.toBeVisible();
  114 |       });
  115 |
  116 |       // Step 5: Verify bassline appears in the saved list
  117 |       await test.step('Verify saved bassline appears in list', async () => {
```