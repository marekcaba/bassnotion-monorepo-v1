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

// Detect webkit browsers and E2E testing environment
const isWebkit =
  typeof window !== 'undefined' &&
  (window.navigator.userAgent.includes('WebKit') ||
    window.navigator.userAgent.includes('Safari'));

const isE2ETesting =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    process.env.NODE_ENV === 'test' ||
    (window as any).__playwright);

// Disable devtools in webkit or E2E testing to prevent crashes
const shouldUseDevtools =
  !isWebkit && !isE2ETesting && process.env.NODE_ENV === 'development';

export const useAuthStore = create<AuthState>()(
  shouldUseDevtools
    ? devtools(
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
      )
    : (set) => ({
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
