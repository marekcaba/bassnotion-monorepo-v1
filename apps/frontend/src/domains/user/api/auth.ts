import { supabase } from '@/infrastructure/supabase/client';
import { RegistrationData, LoginData } from '@bassnotion/contracts';
import type { User, Session } from '@supabase/supabase-js';

export interface AuthSuccessResponse {
  user: User;
  session: Session;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class AuthService {
  /**
   * Sign up a new user with email and password
   */
  async signUp(data: RegistrationData) {
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error) {
      throw new AuthError(error.message, error.status?.toString());
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
      throw new AuthError(error.message, error.status?.toString());
    }

    return authData;
  }

  /**
   * Sign out the current user
   */
  async signOut(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new AuthError(error.message);
    }
  }

  /**
   * Get the current session
   */
  async getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new AuthError(error.message);
    }
    return data;
  }

  /**
   * Get the current user
   */
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      throw new AuthError(error.message);
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
      throw new AuthError(error.message);
    }
    return data;
  }
}

export const authService = new AuthService();
