'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      session: null,
      isLoading: true,
      isInitialized: false,
      setUser: (user) => set({ user }),
      setSession: (session) => set({ session }),
      setLoading: (isLoading) => set({ isLoading }),
      setInitialized: (isInitialized) => set({ isInitialized }),
      reset: () =>
        set({
          user: null,
          session: null,
          isLoading: false,
          isInitialized: true,
        }),
    }),
    {
      name: 'auth-store',
    },
  ),
);

// Computed state selectors
export const useAuth = () => {
  const state = useAuthStore();

  return {
    ...state,
    isAuthenticated: !!(state.user && state.session),
    isReady: state.isInitialized && !state.isLoading,
  };
};
