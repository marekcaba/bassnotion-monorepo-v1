import { describe, test, beforeAll, afterAll, expect } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { testDb } from './database.js';

describe('Direct Authentication Tests (Supabase)', () => {
  let supabase: SupabaseClient;

  beforeAll(async () => {
    // Initialize Supabase client directly
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing required Supabase environment variables');
    }

    supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Reset test database
    await testDb.resetDatabase();
    console.log('✅ Direct Supabase tests ready');
  });

  afterAll(async () => {
    // Clean up
    await testDb.resetDatabase();
  });

  describe('User Registration', () => {
    test('should register user with email/password', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: 'direct-test@example.com',
        password: 'SecurePassword123!',
        options: {
          data: {
            display_name: 'Direct Test User',
          },
        },
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe('direct-test@example.com');
      expect(data.session).toBeDefined();
    });

    test('should reject weak passwords', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: 'weak-password@example.com',
        password: '123',
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain('password');
      expect(data.user).toBeNull();
    });

    test('should reject invalid email', async () => {
      const { data, error } = await supabase.auth.signUp({
        email: 'invalid-email',
        password: 'SecurePassword123!',
      });

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
    });
  });

  describe('User Authentication', () => {
    beforeAll(async () => {
      // Create test user
      await supabase.auth.signUp({
        email: 'auth-test@example.com',
        password: 'TestPassword123!',
        options: {
          data: {
            display_name: 'Auth Test User',
          },
        },
      });
    });

    test('should authenticate with valid credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'auth-test@example.com',
        password: 'TestPassword123!',
      });

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe('auth-test@example.com');
      expect(data.session?.access_token).toBeDefined();
    });

    test('should reject invalid credentials', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'auth-test@example.com',
        password: 'wrongpassword',
      });

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
      expect(data.session).toBeNull();
    });

    test('should reject non-existent user', async () => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: 'nonexistent@example.com',
        password: 'TestPassword123!',
      });

      expect(error).toBeDefined();
      expect(data.user).toBeNull();
    });
  });

  describe('Magic Link Authentication', () => {
    test('should send magic link', async () => {
      const { data, error } = await supabase.auth.signInWithOtp({
        email: 'magic-link@example.com',
        options: {
          shouldCreateUser: true,
        },
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();
      // In test environment, this should work without actual email
    });
  });

  describe('Password Management', () => {
    test('should send password reset email', async () => {
      const { data, error } = await supabase.auth.resetPasswordForEmail(
        'auth-test@example.com',
        {
          redirectTo: 'http://localhost:3000/auth/reset-password',
        },
      );

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });
  });

  describe('Session Management', () => {
    let session: any;

    beforeAll(async () => {
      // Sign in to get session
      const { data } = await supabase.auth.signInWithPassword({
        email: 'auth-test@example.com',
        password: 'TestPassword123!',
      });
      session = data.session;
    });

    test('should get current user with valid session', async () => {
      // Set the session
      await supabase.auth.setSession(session);

      const { data, error } = await supabase.auth.getUser();

      expect(error).toBeNull();
      expect(data.user).toBeDefined();
      expect(data.user?.email).toBe('auth-test@example.com');
    });

    test('should refresh session', async () => {
      const { data, error } = await supabase.auth.refreshSession({
        refresh_token: session.refresh_token,
      });

      expect(error).toBeNull();
      expect(data.session).toBeDefined();
      expect(data.session?.access_token).toBeDefined();
    });

    test('should sign out', async () => {
      const { error } = await supabase.auth.signOut();

      expect(error).toBeNull();

      // Verify user is signed out
      const { data } = await supabase.auth.getUser();
      expect(data.user).toBeNull();
    });
  });

  describe('OAuth Providers', () => {
    test('should generate Google OAuth URL', async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'http://localhost:3000/auth/callback',
        },
      });

      expect(error).toBeNull();
      expect(data.url).toBeDefined();
      expect(data.url).toContain('google');
    });
  });
});
