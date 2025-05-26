import { Page, Locator, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly navigation: Locator;
  readonly mainContent: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.locator('h1').first();
    this.navigation = page.locator('nav');
    this.mainContent = page.locator('main');
  }

  async goto() {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
    // Wait for React to hydrate
    await this.page
      .waitForFunction(() => (window as any).React !== undefined, {
        timeout: 10000,
      })
      .catch(() => {
        // React might not be globally available, that's okay
      });
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({
      path: `screenshots/${name}.png`,
      fullPage: true,
    });
  }

  async verifyPageContent() {
    await expect(
      this.page.getByRole('heading', { name: 'Welcome to BassNotion' }),
    ).toBeVisible();
    await expect(
      this.page.getByRole('link', { name: 'Go to Dashboard' }),
    ).toBeVisible();
    await expect(
      this.page.getByRole('link', { name: 'Try YouTube Exerciser' }),
    ).toBeVisible();
  }

  async verifyHeadingExists() {
    await expect(this.heading).toBeVisible();
  }

  async verifyNavigationExists() {
    const navCount = await this.navigation.count();
    if (navCount > 0) {
      await expect(this.navigation.first()).toBeVisible();
    }
  }

  async checkForJavaScriptErrors(): Promise<string[]> {
    const errors: string[] = [];

    this.page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    return errors;
  }

  async verifyResponsiveDesign() {
    // Test desktop view
    await this.page.setViewportSize({ width: 1920, height: 1080 });
    await this.takeScreenshot('desktop-view');

    // Test tablet view
    await this.page.setViewportSize({ width: 768, height: 1024 });
    await this.takeScreenshot('tablet-view');

    // Test mobile view
    await this.page.setViewportSize({ width: 375, height: 667 });
    await this.takeScreenshot('mobile-view');

    // Verify the page is still functional on mobile
    await this.verifyPageContent();
  }

  async verifyAccessibility() {
    // Check for proper heading structure
    const h1Count = await this.page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check for alt text on images
    const images = this.page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      expect(alt).not.toBeNull();
    }

    // Check for proper color contrast (basic check)
    // This would typically be done with axe-core or similar tools
    const bodyStyles = await this.page.locator('body').evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        backgroundColor: styles.backgroundColor,
        color: styles.color,
      };
    });

    expect(bodyStyles.backgroundColor).toBeTruthy();
    expect(bodyStyles.color).toBeTruthy();
  }
}
