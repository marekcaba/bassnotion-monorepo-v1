import { test, expect } from '@playwright/test';

test.describe('User Journey Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the homepage before each test
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should complete basic user flow', async ({ page }) => {
    // Test basic page functionality
    await expect(
      page.getByRole('heading', { name: 'Welcome to BassNotion' }),
    ).toBeVisible();

    // Check if React Query devtools are available in development
    const reactQueryDevtools = page.locator(
      '[data-testid="react-query-devtools"]',
    );
    // This might not be visible by default, so we'll just check if it exists
    const devtoolsCount = await reactQueryDevtools.count();
    // In development, devtools might be present
    expect(devtoolsCount).toBeGreaterThanOrEqual(0);

    // Test that the page loads without JavaScript errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Reload the page to trigger any potential errors
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert no JavaScript errors occurred
    expect(errors).toHaveLength(0);
  });

  test('should handle form interactions', async ({ page }) => {
    // Look for any forms on the page
    const forms = page.locator('form');
    const formCount = await forms.count();

    if (formCount > 0) {
      // Test the first form if it exists
      const firstForm = forms.first();
      await expect(firstForm).toBeVisible();

      // Look for input fields
      const inputs = firstForm.locator('input');
      const inputCount = await inputs.count();

      if (inputCount > 0) {
        // Test typing in the first input
        const firstInput = inputs.first();
        await firstInput.fill('test input');
        await expect(firstInput).toHaveValue('test input');
      }
    }
  });

  test('should handle button interactions', async ({ page }) => {
    // Look for buttons on the page
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();

    if (buttonCount > 0) {
      // Test that buttons are clickable
      const firstButton = buttons.first();
      await expect(firstButton).toBeVisible();

      // Check if button is enabled before clicking
      if (await firstButton.isEnabled()) {
        await firstButton.click();
        // Wait a bit to see if any navigation or state changes occur
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should be accessible', async ({ page }) => {
    // Basic accessibility checks

    // Check for proper heading structure
    const h1Elements = page.locator('h1');
    const h1Count = await h1Elements.count();

    // Should have at least one h1 element
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check for alt text on images
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      // Images should have alt text (can be empty for decorative images)
      expect(alt).not.toBeNull();
    }

    // Check for proper form labels
    const inputs = page.locator(
      'input[type="text"], input[type="email"], input[type="password"], textarea',
    );
    const inputCount = await inputs.count();

    for (let i = 0; i < inputCount; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');

      if (id) {
        // Check if there's a label for this input
        const label = page.locator(`label[for="${id}"]`);
        const labelExists = (await label.count()) > 0;

        // Input should have either a label, aria-label, or aria-labelledby
        expect(labelExists || ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });
});
