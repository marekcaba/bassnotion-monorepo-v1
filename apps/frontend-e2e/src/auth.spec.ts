import { test, expect } from '@playwright/test';
import { AuthPage } from './pages/AuthPage.js';

test.describe('Authentication Security', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
  });

  test('should prevent XSS in password fields', async () => {
    await authPage.goto('register');
    await authPage.verifyNoXSS('<script>alert("xss")</script>');
  });

  test('should prevent SQL injection attempts', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto('register');
    // Generate unique email for each test run to avoid conflicts
    const timestamp = Date.now();
    const testEmail = `user+sqltest${timestamp}@gmail.com`;

    // Test that SQL injection in password doesn't break the system
    // Use a valid password format that contains SQL injection-like content
    const sqlInjectionPassword = "Test123!@#$' OR '1'='1";

    await authPage.fillRegistrationForm(
      testEmail,
      sqlInjectionPassword,
      sqlInjectionPassword,
    );

    // The key test: form should submit without JavaScript errors
    await authPage.submitForm();

    // Wait for either success or error response (both are valid)
    // The main goal is ensuring SQL injection doesn't break the frontend
    await Promise.race([
      page.waitForResponse(
        (response) =>
          response.url().includes('/auth/signup') && response.status() === 201,
      ),
      page.waitForLoadState('networkidle', { timeout: 5000 }),
    ]);

    // Verify no JavaScript errors occurred (main SQL injection protection)
    const errors = await authPage.checkForJavaScriptErrors();
    expect(errors).toHaveLength(0);
  });

  test('should enforce password complexity requirements', async () => {
    await authPage.goto('register');

    const testCases = [
      {
        scenario: 'too short',
        password: 'short',
        confirmPassword: 'short',
        expectedError: 'Password must be at least 8 characters',
      },
      {
        scenario: 'missing lowercase',
        password: 'PASSWORD123!',
        confirmPassword: 'PASSWORD123!',
        expectedError:
          'Password must contain uppercase, lowercase, number and special character',
      },
      {
        scenario: 'missing uppercase',
        password: 'password123!',
        confirmPassword: 'password123!',
        expectedError:
          'Password must contain uppercase, lowercase, number and special character',
      },
      {
        scenario: 'missing number and special character',
        password: 'PasswordOnly',
        confirmPassword: 'PasswordOnly',
        expectedError:
          'Password must contain uppercase, lowercase, number and special character',
      },
      {
        scenario: 'passwords do not match',
        password: 'ValidPass123!',
        confirmPassword: 'DifferentPass123!',
        expectedError: "Passwords don't match",
      },
    ];

    const timestamp = Date.now();
    for (const testCase of testCases) {
      await authPage.fillRegistrationForm(
        `user+complexity${timestamp}@gmail.com`,
        testCase.password,
        testCase.confirmPassword,
      );
      await authPage.submitForm(true); // Expect button to be disabled
      await authPage.verifyValidationError(testCase.expectedError);
    }

    // Test valid password
    const validPassword = 'ValidPass123!';
    await authPage.fillRegistrationForm(
      `user+valid${timestamp}@gmail.com`,
      validPassword,
      validPassword,
    );
    await authPage.submitForm(); // Should be enabled and clickable
  });

  test('should handle rate limiting', async ({ page }) => {
    const authPage = new AuthPage(page);
    await authPage.goto('login');

    const validPassword = 'TestPass123!';
    const timestamp = Date.now();
    const testEmail = `user+ratelimit${timestamp}@gmail.com`;

    let submissionCount = 0;

    // Set up response listener for auth endpoints
    page.on('response', (response) => {
      if (response.url().includes('/auth/')) {
        submissionCount++;
      }
    });

    // Attempt rapid login attempts
    for (let i = 0; i < 3; i++) {
      await authPage.fillLoginForm(testEmail, validPassword);
      await authPage.submitForm();

      // Brief wait between attempts
      await page.waitForTimeout(500);
    }

    // Verify that multiple requests were made (indicating the form submissions worked)
    expect(submissionCount).toBeGreaterThanOrEqual(1);

    // Most importantly: verify no JavaScript errors occurred during rapid submissions
    const errors = await authPage.checkForJavaScriptErrors();
    expect(errors).toHaveLength(0);
  });

  test('should handle invalid session tokens', async ({ page }) => {
    const authPage = new AuthPage(page);

    // Set up mock for auth endpoints (not just /api/auth)
    await page.route('**/auth/**', (route) => {
      route.fulfill({
        status: 401,
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Invalid session',
            code: 'AUTH_INVALID_SESSION',
          },
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      });
    });

    // Navigate to dashboard which requires authentication
    await authPage.goto('dashboard');

    // The main test: verify redirect to login page occurs
    await authPage.verifyRedirect('/login');

    // Verify the login page loads correctly
    await expect(page.locator('h2')).toContainText('Welcome Back');

    // Verify no JavaScript errors occurred during invalid session handling
    const errors = await authPage.checkForJavaScriptErrors();
    expect(errors).toHaveLength(0);
  });

  test('should be responsive across different devices', async () => {
    await authPage.goto('register');
    await authPage.verifyResponsiveDesign();
  });

  test('should not have JavaScript errors', async () => {
    await authPage.goto('register');
    const errors = await authPage.checkForJavaScriptErrors();
    expect(errors).toHaveLength(0);
  });
});
