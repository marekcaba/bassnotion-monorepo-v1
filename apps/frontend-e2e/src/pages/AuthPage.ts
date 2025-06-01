import { Page, expect } from '@playwright/test';

export class AuthPage {
  constructor(private page: Page) {}

  async goto(path: 'login' | 'register' | 'dashboard' = 'register') {
    // Mock session/auth endpoints to prevent loading state
    await this.mockSessionEndpoints();

    // The baseURL is configured in playwright.config.ts
    const url = new URL(path, 'http://localhost:3001');
    await this.page.goto(url.toString(), { waitUntil: 'networkidle' });

    // Wait for the page to finish loading and auth form to be ready
    // Only wait for forms on auth pages, not dashboard
    if (path === 'login' || path === 'register') {
      let attempts = 0;
      const maxAttempts = 3;

      while (attempts < maxAttempts) {
        try {
          // Try to wait for form with longer timeout per attempt for webkit compatibility
          await this.page
            .locator('form')
            .waitFor({ state: 'visible', timeout: 15000 });
          return; // Success - exit the retry loop
        } catch {
          attempts++;
          console.log(`Attempt ${attempts}/${maxAttempts}: Form not found`);

          // Check if page/browser is still available before proceeding
          if (this.page.isClosed()) {
            throw new Error('Browser page was closed during test execution');
          }

          let isLoading = false;
          try {
            isLoading = await this.page
              .locator('h2:has-text("Loading")')
              .isVisible({ timeout: 1000 }); // Short timeout to avoid hanging
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            console.log('Could not check loading state:', errorMessage);
            // If we can't check loading state, assume page is broken and fail fast
            throw new Error(
              `Page became unresponsive during loading check: ${errorMessage}`,
            );
          }

          if (isLoading && attempts < maxAttempts) {
            console.log('Loading detected, trying different approach...');

            if (attempts === 1) {
              // First retry: reload page and wait longer
              await this.page.reload({ waitUntil: 'networkidle' });
              await this.page.waitForTimeout(3000); // Extra wait for webkit
            } else if (attempts === 2) {
              // Second retry: clear storage and reload
              await this.page.context().clearCookies();
              await this.page.evaluate(() => {
                localStorage.clear();
                sessionStorage.clear();
              });
              await this.page.reload({ waitUntil: 'networkidle' });
              await this.page.waitForTimeout(5000); // Extra wait for webkit
            }
          } else if (attempts >= maxAttempts) {
            // Final attempt failed - throw error with more context
            const currentUrl = this.page.url();
            const pageContent = await this.page.textContent('body');
            throw new Error(
              `Failed to load auth form after ${maxAttempts} attempts. Page appears to be stuck in loading state.
              Current URL: ${currentUrl}
              Page contains Loading: ${pageContent?.includes('Loading')}
              Browser: ${this.page.context().browser()?.browserType().name()}`,
            );
          }
        }
      }
    }
  }

  async mockSessionEndpoints() {
    // Comprehensive mocking to force page load by blocking all API calls
    await this.page.route('**/api/**', (route) => {
      const url = route.request().url();
      console.log(`Mocking API request: ${url}`);

      // Mock all API requests with appropriate responses
      if (url.includes('/auth/') || url.includes('/user')) {
        route.fulfill({
          status: 401,
          body: JSON.stringify({
            success: false,
            error: { message: 'No session', code: 'NO_SESSION' },
          }),
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // Mock other API calls with empty success responses
        route.fulfill({
          status: 200,
          body: JSON.stringify({ success: true, data: null }),
          headers: { 'Content-Type': 'application/json' },
        });
      }
    });

    // Mock Supabase endpoints
    await this.page.route('**/auth/v1/**', (route) => {
      console.log(`Mocking Supabase request: ${route.request().url()}`);
      route.fulfill({
        status: 401,
        body: JSON.stringify({ error: 'No session' }),
        headers: { 'Content-Type': 'application/json' },
      });
    });

    // Mock any other external API calls that might cause loading
    await this.page.route('**/v1/**', (route) => {
      if (!route.request().url().includes('localhost:3001')) {
        console.log(`Mocking external request: ${route.request().url()}`);
        route.fulfill({
          status: 200,
          body: JSON.stringify({}),
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        route.continue();
      }
    });
  }

  async switchTab(tab: 'Login' | 'Registration') {
    await this.page.click(`[role="tab"]:has-text("${tab}")`);
    await expect(
      this.page.locator(`[role="tab"][aria-selected="true"]`),
    ).toHaveText(tab);
  }

  async fillLoginForm(email: string, password: string) {
    // Wait for form fields to be available before filling
    await expect(this.page.locator('input[name="email"]')).toBeVisible();
    await expect(this.page.locator('input[name="password"]')).toBeVisible();

    await this.page.fill('input[name="email"]', email);
    await this.page.fill('input[name="password"]', password);
  }

  async fillRegistrationForm(
    email: string,
    password: string,
    confirmPassword: string,
  ) {
    // Wait for form fields to be available before filling
    await expect(this.page.locator('input[name="email"]')).toBeVisible();
    await expect(this.page.locator('input[name="password"]')).toBeVisible();
    await expect(
      this.page.locator('input[name="confirmPassword"]'),
    ).toBeVisible();

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
    // Wait for potential loading to complete first
    try {
      await this.page.waitForLoadState('networkidle', { timeout: 5000 });
    } catch {
      // Continue if networkidle times out
    }

    // Check if we're stuck in loading state
    const isLoading = await this.page
      .locator('h2:has-text("Loading")')
      .isVisible();
    if (isLoading) {
      // If stuck loading, reload and try again
      await this.page.reload({ waitUntil: 'networkidle' });
      await this.page.waitForTimeout(2000); // Brief wait for redirect logic
    }

    await expect(this.page).toHaveURL(new RegExp(path), { timeout: 15000 });
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

    // Wait for the page to be fully loaded (not in loading state)
    await this.page.waitForLoadState('networkidle');

    // Wait for the form to be visible first
    await expect(this.page.locator('form')).toBeVisible({ timeout: 30000 });

    // Wait for the password input to be available
    const passwordInput = this.page.locator('input[name="password"]');
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    // Try XSS payload
    await passwordInput.fill(input);

    // Verify XSS wasn't executed
    const wasXssExecuted = await this.page.evaluate(
      () => (window as any).__xssDetected === true,
    );
    expect(wasXssExecuted).toBe(false);

    // Verify input is properly escaped
    await expect(passwordInput).toHaveValue(input);
    const value = await passwordInput.getAttribute('value');
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
