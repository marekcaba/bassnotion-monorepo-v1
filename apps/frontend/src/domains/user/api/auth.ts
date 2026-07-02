import { supabase } from '@/infrastructure/supabase/client';
import { markJustLoggedIn } from '@/domains/user/components/auth/justLoggedIn';
import {
  RegistrationData,
  LoginData,
  createStructuredLogger,
} from '@bassnotion/contracts';
import type { User, Session } from '@supabase/supabase-js';
import { AuthError } from '@supabase/supabase-js';
import { apiClient } from '@/lib/api-client';

const logger = createStructuredLogger('AuthService');

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

/**
 * Convert Supabase AuthError into user-friendly messages.
 *
 * SECURITY: All credential-related messages are intentionally generic to prevent
 * email enumeration attacks. We never reveal whether an email exists in the system.
 */
function getAuthErrorMessage(error: AuthError): string {
  // Handle rate limit errors (safe to be specific about these)
  if (error.message?.includes('over_email_send_rate_limit')) {
    return 'Too many emails sent. Please wait a few minutes before trying again.';
  }

  if (error.message?.includes('email rate limit exceeded')) {
    return 'Email rate limit exceeded. Please try again in a few minutes.';
  }

  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // SECURITY: Generic message for all credential-related errors
  // This prevents email enumeration by not revealing if email exists
  if (
    error.message?.includes('Invalid login credentials') ||
    error.message?.includes('Invalid email or password') ||
    error.message?.includes('User not found') ||
    error.message?.includes('Email not confirmed')
  ) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  // SECURITY: Generic message for registration-related errors
  // Don't reveal if email already exists - use same message for both cases
  if (
    error.message?.includes('Email already registered') ||
    error.message?.includes('User already registered')
  ) {
    return 'Unable to create account. Please try signing in instead.';
  }

  if (error.message?.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (error.message?.includes('signup disabled')) {
    return 'New account registration is currently disabled. Please contact support.';
  }

  if (error.status === 422) {
    return 'Invalid input. Please check your email and password format.';
  }

  if (error.status === 400) {
    return 'Invalid request. Please check your input and try again.';
  }

  // Generic fallback - don't expose internal error details
  return 'An unexpected error occurred. Please try again.';
}

export class AuthService {
  private get backendUrl() {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  }

  /**
   * Check whether the email's domain accepts mail (has MX records).
   * Returns true if valid OR if the check couldn't be performed (fail-open) —
   * the goal is catching obvious typos like `user@gogle.com`, not blocking
   * legitimate signups when our DNS check itself is broken.
   */
  async validateEmailDomain(email: string): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.backendUrl}/auth/validate-email-domain`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        },
      );
      if (!response.ok) return true; // fail-open on backend error
      const result = (await response.json()) as { valid: boolean };
      return result.valid;
    } catch {
      return true; // fail-open on network error
    }
  }

  /**
   * Sign up using backend API (for E2E tests)
   */
  async signUpWithBackend(
    data: RegistrationData,
  ): Promise<BackendAuthResponse> {
    try {
      logger.debug('Calling backend signup API', {
        url: `${this.backendUrl}/auth/signup`,
      });

      const response = await fetch(`${this.backendUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      logger.debug('Backend signup response', {
        status: response.status,
        ok: response.ok,
        result,
      });
      logger.debug('Signup result details', {
        success: result.success,
        message: result.message,
        user: result.user,
        session: result.session,
        error: result.error,
      });

      // TODO: Review non-null assertion - consider null safety
      if (!response.ok || !result.success) {
        // Extract the specific error message from backend response
        let errorMessage = 'Registration failed';

        if (result.error?.details) {
          errorMessage = result.error.details;
        } else if (result.message) {
          errorMessage = result.message;
        }

        logger.debug('Backend signup raw error message', {
          errorMessage,
        });

        // Convert raw error to user-friendly message using the same function as Supabase auth
        const mockAuthError = new AuthError(errorMessage, response.status);
        const userFriendlyMessage = getAuthErrorMessage(mockAuthError);

        logger.debug('Backend signup user-friendly error message', {
          userFriendlyMessage,
        });
        throw new Error(userFriendlyMessage);
      }

      return result;
    } catch (error) {
      logger.error('Backend registration error', error as Error);

      // If it's a network error or other issue, provide a more specific message
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          'Unable to connect to authentication server. Please try again.',
        );
      }

      throw error;
    }
  }

  /**
   * Sign in using backend API (for E2E tests)
   */
  async signInWithBackend(data: LoginData): Promise<BackendAuthResponse> {
    try {
      logger.debug('Calling backend signin API', {
        url: `${this.backendUrl}/auth/signin`,
      });

      const response = await fetch(`${this.backendUrl}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      logger.debug('Backend response:', {
        status: response.status,
        ok: response.ok,
        result,
      });
      logger.debug('Result details:', {
        success: result.success,
        message: result.message,
        user: result.user,
        session: result.session,
        error: result.error,
      });

      // Handle both HTTP errors and successful responses with success: false
      if (!response.ok || !result?.success) {
        // Extract the specific error message from backend response
        let errorMessage = 'Login failed';

        if (result.error?.details) {
          errorMessage = result.error.details;
        } else if (result.message) {
          errorMessage = result.message;
        }

        logger.debug('Backend raw error message', { errorMessage });

        // Convert raw error to user-friendly message using the same function as Supabase auth
        const mockAuthError = new AuthError(errorMessage, response.status);
        const userFriendlyMessage = getAuthErrorMessage(mockAuthError);

        logger.debug('Backend user-friendly error message', {
          userFriendlyMessage,
        });
        throw new Error(userFriendlyMessage);
      }

      return result;
    } catch (error) {
      logger.error('Backend login error:', error as Error);

      // If it's a network error or other issue, provide a more specific message
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error(
          'Unable to connect to authentication server. Please try again.',
        );
      }

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
      options: {
        // Route the confirmation link through our callback page so it can
        // detect the `type=signup` param and show the welcome toast.
        // Without this, Supabase falls back to Site URL (`/`) and our
        // callback never runs.
        emailRedirectTo:
          typeof window !== 'undefined'
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    });

    if (error) {
      const userFriendlyMessage = getAuthErrorMessage(error);
      const enhancedError = new AuthError(userFriendlyMessage, error.status);
      enhancedError.name = error.name;
      throw enhancedError;
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
      const userFriendlyMessage = getAuthErrorMessage(error);
      const enhancedError = new AuthError(userFriendlyMessage, error.status);
      enhancedError.name = error.name;
      throw enhancedError;
    }

    return authData;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      logger.error('Sign out error:', error as Error);
      throw error;
    }
    // Clear the auth token from API client
    apiClient.clearAuthToken();
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

  async signInWithGoogle(dest?: string | null) {
    try {
      // Mark the fresh login NOW (client) — the OAuth code exchange happens server-side, so no
      // client JS runs between Google and Backstage. sessionStorage persists through the round-trip;
      // the /app welcome overlay consumes it once on landing.
      markJustLoggedIn();
      // Post-login destination (a validated ?redirect= path) rides along as `next` on the callback
      // URL. Google preserves the redirectTo path + its query, so the server /auth/callback route
      // reads `next`, re-validates it, and 307s there instead of the default Backstage landing.
      const callback = new URL('/auth/callback', window.location.origin);
      if (dest) callback.searchParams.set('next', dest);
      const redirectUrl = callback.toString();

      logger.debug('Initiating Google sign-in...', {
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
        logger.error('Google sign-in error:', new Error('See details'), {
          code: error.status,
          message: error.message,
          name: error.name,
          stack: error.stack,
        });
        throw error;
      }

      logger.debug('Google sign-in response', {
        // TODO: Review non-null assertion - consider null safety
        hasProvider: !!data.provider,
        // TODO: Review non-null assertion - consider null safety
        hasUrl: !!data.url,
        url: data.url,
        provider: data.provider,
      });

      return data;
    } catch (error: any) {
      logger.error(
        'Unexpected error during Google sign-in:',
        new Error('See details'),
        {
          message: error?.message,
          name: error?.name,
          stack: error?.stack,
          code: error?.code,
          status: error?.status,
          isAuthError: error instanceof AuthError,
          errorType: typeof error,
          stringified: JSON.stringify(error),
          fullErrorObject: error,
        },
      );

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

      // TODO: Review non-null assertion - consider null safety
      return { exists: !!data, error: null };
    } catch (error) {
      logger.error('Check user exists error:', error as Error);
      return { exists: false, error };
    }
  }

  async signInWithMagicLink(email: string, isNewUser = false) {
    try {
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
      logger.error('Password update error:', error as Error);
      throw error;
    }
  }
}

export const authService = new AuthService();
export { AuthError };
