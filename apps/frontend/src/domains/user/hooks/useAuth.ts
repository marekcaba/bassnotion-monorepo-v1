import {
  AuthChangeEvent,
  AuthError,
  Session,
  User,
} from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { supabase } from '@/infrastructure/supabase/client';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: AuthError | null;
  session: Session | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    error: null,
    session: null,
  });

  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          setState((prev) => ({ ...prev, error, isLoading: false }));
          return;
        }

        setState((prev) => ({
          ...prev,
          user: session?.user ?? null,
          session: session ?? null,
          isLoading: false,
        }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          error: err as AuthError,
          isLoading: false,
        }));
      }
    };

    void initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        setState((prev) => ({
          ...prev,
          user: session?.user ?? null,
          session: session ?? null,
          isLoading: false,
          error: null,
        }));
      },
    );

    return () => subscription.unsubscribe();
  }, []);

  return state;
}
