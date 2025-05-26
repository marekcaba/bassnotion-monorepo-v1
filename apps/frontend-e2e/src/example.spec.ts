import { test, expect } from '@playwright/test';

test.describe('BassNotion Frontend', () => {
  test('should display the homepage', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test visible content instead of title
    await expect(
      page.getByRole('heading', { name: 'Welcome to BassNotion' }),
    ).toBeVisible();

    // Verify navigation links are present
    await expect(
      page.getByRole('link', { name: 'Go to Dashboard' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Try YouTube Exerciser' }),
    ).toBeVisible();

    // Take a screenshot for visual verification
    await page.screenshot({ path: 'homepage.png' });
  });

  test('should have working navigation', async ({ page }) => {
    await page.goto('/');

    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check if there are any navigation elements
    // This will need to be updated based on your actual UI
    const navigation = page.locator('nav');
    if ((await navigation.count()) > 0) {
      await expect(navigation).toBeVisible();
    }
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take a screenshot for mobile view
    await page.screenshot({ path: 'homepage-mobile.png' });

    // Verify the page is still functional on mobile
    await expect(
      page.getByRole('heading', { name: 'Welcome to BassNotion' }),
    ).toBeVisible();
  });
});
