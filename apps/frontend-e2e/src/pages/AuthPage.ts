import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async goto(path: 'login' | 'register' | 'dashboard' = 'register') {
    // The baseURL is configured in playwright.config.ts
    const url = new URL(path, 'http://localhost:3001');
    await this.page.goto(url.toString(), { waitUntil: 'networkidle' });
  }

  async switchTab(tab: 'Login' | 'Registration') {
    await this.page.click(`[role="tab"]:has-text("${tab}")`);
    await expect(
      this.page.locator(`[role="tab"][aria-selected="true"]`),
    ).toHaveText(tab);
  }

  async fillLoginForm(email: string, password: string) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
  }

  async fillRegistrationForm(
    email: string,
    password: string,
    confirmPassword: string,
  ) {
    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
    await this.page.fill('input[name="confirmPassword"]', confirmPassword);
  }

  async submitForm(expectDisabled = false) {
    const submitButton = this.page.locator('button[type="submit"]');
    if (expectDisabled) {
      await expect(submitButton).toBeDisabled();
      return;
    }
    await expect(submitButton).toBeEnabled({ timeout: 5000 });
    await submitButton.click();
  }

  async verifyValidationError(message: string, isInlineError = true) {
    if (isInlineError) {
      // For inline validation messages (shown under form fields)
      const errorLocator = this.page.getByText(message, { exact: false });
      await expect(errorLocator).toBeVisible({ timeout: 10000 });
    } else {
      // For form submission errors (alerts/notifications)
      const errorLocator = this.page.locator(
        [
          `[role="alert"] >> text=${message}`,
          `[role="region"] >> text=${message}`,
          `.notification >> text=${message}`, // Common notification component
          `[role="status"] >> text=${message}`, // Toast notifications
        ].join(','),
      );
      await expect(errorLocator).toBeVisible({ timeout: 10000 });
    }
  }

  async verifyRegistrationSuccess() {
    // Wait for the success toast notification using the correct Radix UI selectors
    const successToast = this.page.locator('[data-radix-toast-title]', {
      hasText: 'Account created successfully!',
    });
    await expect(successToast).toBeVisible({ timeout: 10000 });

    // Verify we're redirected to the dashboard
    await this.verifyRedirect('/dashboard');
  }

  async verifyRedirect(path: string) {
    await expect(this.page).toHaveURL(new RegExp(path));
  }

  async mockAuthResponse(status: number, body: object) {
    await this.page.route('/api/auth/**', (route) => {
      route.fulfill({
        status,
        body: JSON.stringify(body),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });
  }

  async checkForJavaScriptErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on('pageerror', (error) => errors.push(error.message));
    return errors;
  }

  async verifyNoXSS(input: string) {
    // Set up XSS detection
    await this.page.evaluate(() => {
      (window as any).__xssDetected = false;
      window.alert = () => {
        (window as any).__xssDetected = true;
      };
    });

    // Try XSS payload
    await this.page.fill('input[name="password"]', input);

    // Verify XSS wasn't executed
    const wasXssExecuted = await this.page.evaluate(
      () => (window as any).__xssDetected === true,
    );
    expect(wasXssExecuted).toBe(false);

    // Verify input is properly escaped
    const inputElement = this.page.locator('input[name="password"]');
    await expect(inputElement).toHaveValue(input);
    const value = await inputElement.getAttribute('value');
    expect(value).toBe(input);
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `screenshots/${name}.png` });
  }

  async verifyResponsiveDesign() {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 }, // Desktop
      { width: 768, height: 1024 }, // Tablet
      { width: 375, height: 667 }, // Mobile
    ];

    for (const viewport of viewports) {
      await this.page.setViewportSize(viewport);
      await this.takeScreenshot(
        `auth-page-${viewport.width}x${viewport.height}`,
      );
      // Verify critical elements are visible
      await expect(this.page.locator('form')).toBeVisible();
      await expect(this.page.locator('button[type="submit"]')).toBeVisible();
    }
  }
}
