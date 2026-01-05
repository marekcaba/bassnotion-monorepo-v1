'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
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
  // TODO: Review non-null assertion - consider null safety
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
// Use useShallow to prevent re-renders when unrelated store values change
export const useAuth = () => {
  const state = useAuthStore(
    useShallow((s) => ({
      user: s.user,
      session: s.session,
      isLoading: s.isLoading,
      isInitialized: s.isInitialized,
      setUser: s.setUser,
      setSession: s.setSession,
      setLoading: s.setLoading,
      setInitialized: s.setInitialized,
      reset: s.reset,
    })),
  );

  return {
    ...state,
    // Computed properties for easier usage
    isAuthenticated: !!state.user && !!state.session,
    isReady: state.isInitialized,
    // Quick check - don't block if auth is still loading, assume not authenticated
    isAuthenticatedSync: !!state.user && !!state.session && state.isInitialized,
  };
};
