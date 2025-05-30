import { supabase } from '@/infrastructure/supabase/client';
import { RegistrationData, LoginData } from '@bassnotion/contracts';
import type { User, Session } from '@supabase/supabase-js';
import { AuthError } from '@supabase/supabase-js';

export interface AuthSuccessResponse {
  user: User;
  session: Session;
}

export interface BackendAuthResponse {
  success: boolean;
  message?: string;
  user?: any;
  session?: any;
  error?: {
    message: string;
    code: string;
  };
}

export class AuthService {
  private get backendUrl() {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }

  /**
   * Sign up using backend API (for E2E tests)
   */
  async signUpWithBackend(
    data: RegistrationData,
  ): Promise<BackendAuthResponse> {
    try {
      const response = await fetch(`${this.backendUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Registration failed');
      }

      return result;
    } catch (error) {
      console.error('[Auth Debug] Backend registration error:', error);
      throw error;
    }
  }

  /**
   * Sign in using backend API (for E2E tests)
   */
  async signInWithBackend(data: LoginData): Promise<BackendAuthResponse> {
    try {
      const response = await fetch(`${this.backendUrl}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Login failed');
      }

      return result;
    } catch (error) {
      console.error('[Auth Debug] Backend login error:', error);
      throw error;
    }
  }

  /**
   * Sign up a new user with email and password
   */
  async signUp(data: RegistrationData) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw error;
    }

    return authData;
  }

  /**
   * Sign in an existing user with email and password
   */
  async signIn(data: LoginData) {
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw error;
    }

    return authData;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw error;
    }
  }

  /**
   * Get the current session
   */
  async getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Get the current user
   */
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw error;
    }
    return data;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(
    callback: (event: string, session: Session | null) => void,
  ) {
    return supabase.auth.onAuthStateChange(callback);
  }

  /**
   * Refresh the current session
   */
  async refreshSession() {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) {
      throw error;
    }
    return data;
  }

  async signInWithGoogle() {
    try {
      const redirectUrl = `${window.location.origin}/auth/callback`;

      console.debug('[Auth Debug] Initiating Google sign-in...', {
        redirectUrl,
        currentUrl: window.location.href,
        origin: window.location.origin,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        console.error('[Auth Debug] Google sign-in error:', {
          code: error.status,
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        throw error;
      }

      console.debug('[Auth Debug] Google sign-in response:', {
        hasProvider: !!data.provider,
        hasUrl: !!data.url,
        url: data.url,
        provider: data.provider,
      });

      return data;
    } catch (error) {
      console.error('[Auth Debug] Unexpected error during Google sign-in:', {
        error,
        isAuthError: error instanceof AuthError,
      });

      if (error instanceof AuthError) {
        throw error;
      }
      throw new Error('An unexpected error occurred during Google sign-in');
    }
  }

  async checkUserExists(email: string) {
    try {
      const { data, error } = await supabase.rpc('check_user_exists', {
        email_input: email,
      });

      if (error) throw error;

      return { exists: !!data, error: null };
    } catch (error) {
      console.error('[Auth Debug] Check user exists error:', error);
      return { exists: false, error };
    }
  }

  async signInWithMagicLink(email: string, isNewUser = false) {
    try {
      console.debug('[Auth Debug] Sending magic link:', {
        email,
        isNewUser,
      });

      const { data, error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: isNewUser, // Only create if it's a new user
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('[Auth Debug] Magic link error:', error);
      if (error instanceof AuthError) {
        return { data: null, error };
      }
      throw error;
    }
  }

  async updatePassword(currentPassword: string, newPassword: string) {
    try {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('[Auth Debug] Password update error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
export { AuthError };
