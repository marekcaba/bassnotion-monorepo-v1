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

/**
 * Convert Supabase AuthError into user-friendly messages
 */
function getAuthErrorMessage(error: AuthError): string {
  // Handle specific error codes
  if (error.message?.includes('over_email_send_rate_limit')) {
    return 'Too many emails sent. Please wait a few minutes before trying again.';
  }

  if (error.message?.includes('email rate limit exceeded')) {
    return 'Email rate limit exceeded. Please try again in a few minutes.';
  }

  if (error.message?.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (error.message?.includes('Invalid email or password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (error.message?.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }

  if (error.message?.includes('User not found')) {
    return 'No account found with this email address. Please sign up first.';
  }

  if (
    error.message?.includes('Email already registered') ||
    error.message?.includes('User already registered')
  ) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (error.message?.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (error.message?.includes('signup disabled')) {
    return 'New account registration is currently disabled. Please contact support.';
  }

  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (error.status === 422) {
    return 'Invalid input. Please check your email and password format.';
  }

  if (error.status === 400) {
    return 'Bad request. Please check your input and try again.';
  }

  // Return the original message for unknown errors
  return error.message || 'An unexpected error occurred. Please try again.';
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
      console.log(
        '[Auth Debug] Calling backend signup API:',
        `${this.backendUrl}/auth/signup`,
      );

      const response = await fetch(`${this.backendUrl}/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[Auth Debug] Backend signup response:', {
        status: response.status,
        ok: response.ok,
        result,
      });
      console.log('[Auth Debug] Signup result details:', {
        success: result.success,
        message: result.message,
        user: result.user,
        session: result.session,
        error: result.error,
      });

      if (!response.ok || !result.success) {
        // Extract the specific error message from backend response
        let errorMessage = 'Registration failed';

        if (result.error?.details) {
          errorMessage = result.error.details;
        } else if (result.message) {
          errorMessage = result.message;
        }

        console.log(
          '[Auth Debug] Backend signup raw error message:',
          errorMessage,
        );

        // Convert raw error to user-friendly message using the same function as Supabase auth
        const mockAuthError = new AuthError(errorMessage, response.status);
        const userFriendlyMessage = getAuthErrorMessage(mockAuthError);

        console.log(
          '[Auth Debug] Backend signup user-friendly error message:',
          userFriendlyMessage,
        );
        throw new Error(userFriendlyMessage);
      }

      return result;
    } catch (error) {
      console.error('[Auth Debug] Backend registration error:', error);

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
      console.log(
        '[Auth Debug] Calling backend signin API:',
        `${this.backendUrl}/auth/signin`,
      );

      const response = await fetch(`${this.backendUrl}/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      console.log('[Auth Debug] Backend response:', {
        status: response.status,
        ok: response.ok,
        result,
      });
      console.log('[Auth Debug] Result details:', {
        success: result.success,
        message: result.message,
        user: result.user,
        session: result.session,
        error: result.error,
      });

      // Handle both HTTP errors and successful responses with success: false
      if (!response.ok || !result.success) {
        // Extract the specific error message from backend response
        let errorMessage = 'Login failed';

        if (result.error?.details) {
          errorMessage = result.error.details;
        } else if (result.message) {
          errorMessage = result.message;
        }

        console.log('[Auth Debug] Backend raw error message:', errorMessage);

        // Convert raw error to user-friendly message using the same function as Supabase auth
        const mockAuthError = new AuthError(errorMessage, response.status);
        const userFriendlyMessage = getAuthErrorMessage(mockAuthError);

        console.log(
          '[Auth Debug] Backend user-friendly error message:',
          userFriendlyMessage,
        );
        throw new Error(userFriendlyMessage);
      }

      return result;
    } catch (error) {
      console.error('[Auth Debug] Backend login error:', error);

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
      console.error('Sign out error:', error);
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
    } catch (error: any) {
      console.error('[Auth Debug] Unexpected error during Google sign-in:', {
        message: error?.message,
        name: error?.name,
        stack: error?.stack,
        code: error?.code,
        status: error?.status,
        isAuthError: error instanceof AuthError,
        errorType: typeof error,
        stringified: JSON.stringify(error),
        fullErrorObject: error,
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
      console.error('[Auth Debug] Password update error:', error);
      throw error;
    }
  }
}

export const authService = new AuthService();
export { AuthError };
