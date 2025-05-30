import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import fetch from 'node-fetch';
import { testDb } from './database.js';

const BASE_URL = 'http://localhost:3000';
const API_BASE = `${BASE_URL}/api`;

describe('Authentication E2E Tests (Running Server)', () => {
  beforeAll(async () => {
    // Reset test database
    await testDb.resetDatabase();
    console.log('✅ Test database ready');

    // Wait for server to be ready
    await waitForServer();
    console.log('✅ Server is ready');
  });

  afterAll(async () => {
    // Clean up
    await testDb.resetDatabase();
  });

  describe('POST /auth/signup', () => {
    test('should create a new user successfully', async () => {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!',
          displayName: 'New User',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('newuser@example.com');
      expect(data.data.session.accessToken).toBeDefined();
    });

    test('should validate email format', async () => {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'invalid-email',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('email');
    });

    test('should validate password strength', async () => {
      const response = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: '123',
          confirmPassword: '123',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('password');
    });
  });

  describe('POST /auth/signin', () => {
    beforeAll(async () => {
      // Create test user
      await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'TestPassword123!',
          confirmPassword: 'TestPassword123!',
          displayName: 'Test User',
        }),
      });
    });

    test('should authenticate valid credentials', async () => {
      const response = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'TestPassword123!',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('testuser@example.com');
      expect(data.data.session.accessToken).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const response = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'wrongpassword',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error.message).toContain('credentials');
    });
  });

  describe('Authentication Features', () => {
    test('should handle Google OAuth redirect', async () => {
      const response = await fetch(`${API_BASE}/auth/google`, {
        method: 'GET',
        redirect: 'manual',
      });

      // Should redirect to Google OAuth
      expect(response.status).toBe(302);
      expect(response.headers.get('location')).toContain('google');
    });

    test('should handle password reset request', async () => {
      const response = await fetch(`${API_BASE}/auth/password-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('reset');
    });

    test('should handle magic link request', async () => {
      const response = await fetch(`${API_BASE}/auth/magic-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
        }),
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('magic link');
    });
  });

  describe('Protected Routes', () => {
    let accessToken: string;

    beforeAll(async () => {
      // Get access token
      const loginResponse = await fetch(`${API_BASE}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'testuser@example.com',
          password: 'TestPassword123!',
        }),
      });

      const loginData = await loginResponse.json();
      accessToken = loginData.data.session.accessToken;
    });

    test('should access protected route with valid token', async () => {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.email).toBe('testuser@example.com');
    });

    test('should reject protected route without token', async () => {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
      });

      expect(response.status).toBe(401);
    });
  });
});

async function waitForServer(maxAttempts = 30): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/health`, {
        method: 'GET',
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Server not ready yet
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error('Server did not start within expected time');
}
