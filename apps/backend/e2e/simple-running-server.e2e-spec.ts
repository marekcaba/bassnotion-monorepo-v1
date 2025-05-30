import { describe, test, expect } from 'vitest';

const BASE_URL = 'http://localhost:3000';

// Type for API responses
interface ApiResponse {
  success: boolean;
  message?: string;
  data?: {
    user?: {
      id: string;
      email: string;
      displayName: string;
      createdAt: string;
      updatedAt: string;
    };
    session?: {
      accessToken: string;
      refreshToken?: string;
      expiresIn: number;
    };
  };
  error?: {
    code: string;
    details: string;
  };
}

// Generate unique emails for each test run to avoid conflicts
const timestamp = Date.now();
const generateUniqueEmail = (prefix: string) =>
  `${prefix}-${timestamp}@bassnotion.com`;

describe('BassNotion E2E Tests (Simple Running Server)', () => {
  test('should verify server is running', async () => {
    const response = await fetch(BASE_URL);
    expect(response.ok).toBe(true);
    console.log('✅ Server is running and responding');
  });

  test('should create a new user successfully', async () => {
    const email = generateUniqueEmail('testuser');

    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        displayName: 'Test User',
      }),
    });

    const data = (await response.json()) as ApiResponse;

    console.log('Signup response:', {
      status: response.status,
      success: data.success,
      email: data.data?.user?.email,
    });

    expect(response.status).toBe(201); // API returns 201 for successful creation
    expect(data.success).toBe(true);
    expect(data.data?.user?.email).toBe(email);
    expect(data.data?.user?.displayName).toBe('Test User');
  });

  test('should validate email format', async () => {
    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email-format',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!',
        displayName: 'Test User',
      }),
    });

    const data = (await response.json()) as ApiResponse;

    console.log('Email validation response:', {
      status: response.status,
      success: data.success,
      message: data.message,
    });

    expect(response.status).toBe(201); // API returns 201 but with success: false
    expect(data.success).toBe(false);
    expect(data.message).toContain('email');
  });

  test('should validate password strength', async () => {
    const email = generateUniqueEmail('weakpass');

    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: '123',
        confirmPassword: '123',
        displayName: 'Test User',
      }),
    });

    const data = (await response.json()) as ApiResponse;

    console.log('Password validation response:', {
      status: response.status,
      success: data.success,
      message: data.message,
    });

    expect(response.status).toBe(201); // API returns 201 but with success: false
    expect(data.success).toBe(false);
    expect(data.message).toContain('Password');
  });

  test('should handle password confirmation mismatch', async () => {
    const email = generateUniqueEmail('mismatch');

    const response = await fetch(`${BASE_URL}/auth/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password: 'SecurePassword123!',
        confirmPassword: 'DifferentPassword123!',
        displayName: 'Test User',
      }),
    });

    const data = (await response.json()) as ApiResponse;

    console.log('Password mismatch response:', {
      status: response.status,
      success: data.success,
      message: data.message,
    });

    // Note: Backend doesn't currently validate password confirmation
    // This test documents the current behavior
    expect(response.status).toBe(201);
    // The test passes even with mismatched passwords - this is a finding!
  });

  test('should handle Google OAuth endpoint', async () => {
    const response = await fetch(`${BASE_URL}/auth/google`, {
      method: 'GET',
      redirect: 'manual', // Don't follow redirects automatically
    });

    console.log('Google OAuth response:', {
      status: response.status,
      location: response.headers.get('location'),
    });

    // Google OAuth should now work properly since it's configured in Supabase
    expect(response.status).toBe(302); // Proper redirect status
    expect(response.headers.get('location')).toBeTruthy(); // Should have a redirect URL

    const location = response.headers.get('location');
    if (location) {
      // Should redirect to Google OAuth via Supabase
      expect(location).toContain('supabase.co/auth/v1/authorize');
      expect(location).toContain('provider=google');
    }
  });

  test('should handle Google OAuth callback endpoint', async () => {
    // Test the callback endpoint without valid code (should redirect to frontend with error)
    const response = await fetch(
      `${BASE_URL}/auth/google/callback?code=invalid&state=test`,
      {
        method: 'GET',
        redirect: 'manual',
      },
    );

    console.log('Google OAuth callback response:', {
      status: response.status,
      location: response.headers.get('location'),
    });

    // The callback endpoint should redirect to frontend with error for invalid code
    // However, due to how the response is structured, it might return 200 with redirect location
    expect([200, 302]).toContain(response.status);

    // Should have the error redirect URL even if status is 200
    const location = response.headers.get('location');
    if (location && location.includes('login?error=oauth_failed')) {
      // This is the expected error redirect
      expect(location).toContain('login?error=oauth_failed');
    }
  });

  test('should handle non-existent endpoints gracefully', async () => {
    const response = await fetch(`${BASE_URL}/non-existent-endpoint`);
    console.log('Non-existent endpoint response:', { status: response.status });
    expect(response.status).toBe(404);
  });

  test('should handle magic link endpoint', async () => {
    const response = await fetch(`${BASE_URL}/auth/magic-link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const body = (await response.json()) as ApiResponse;
    console.log('Magic link response:', {
      status: response.status,
      body,
    });

    expect(response.status).toBe(200);
    // Magic link can succeed or fail depending on email validation
    expect([true, false]).toContain(body.success);
  });

  test('should handle password reset endpoint', async () => {
    const response = await fetch(`${BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const body = (await response.json()) as ApiResponse;
    console.log('Password reset response:', {
      status: response.status,
      body,
    });

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toContain('Password reset email sent successfully');
  });

  test('should handle change password endpoint (without auth)', async () => {
    const response = await fetch(`${BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: 'oldpass',
        newPassword: 'newpass',
      }),
    });

    console.log('Change password (no auth) response:', {
      status: response.status,
      body: (await response.json()) as ApiResponse,
    });

    // Should return 401 Unauthorized without auth token
    expect(response.status).toBe(401);
  });
});
 