'use client';

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import type { User, Session } from '@supabase/supabase-js';

import { isMockTestEnv, isWebkitBrowser } from '@/shared/utils/testEnv';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;
  // SSR seed (P3): the SERVER verified the cookie session (getServerAuth → getUser) before this
  // HTML shipped, so we KNOW the request is authenticated before the client's async getSession()
  // resolves. AuthStoreHydrator seeds this synchronously on first render → isReady/isAuthenticated
  // are true on FIRST PAINT for logged-in users, killing the auth-resolution flash. The real
  // getSession() a tick later fills in the full user/session objects for everything that needs them.
  serverAuthed: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setInitialized: (initialized: boolean) => void;
  setServerAuthed: (authed: boolean) => void;
  reset: () => void;
}

// Disable devtools in webkit or mock-test env to prevent crashes
const shouldUseDevtools =
  !isWebkitBrowser() &&
  !isMockTestEnv() &&
  process.env.NODE_ENV === 'development';

export const useAuthStore = create<AuthState>()(
  shouldUseDevtools
    ? devtools(
        (set) => ({
          user: null,
          session: null,
          isLoading: true,
          isInitialized: false,
          serverAuthed: false,
          setUser: (user) => set({ user }),
          setSession: (session) => set({ session }),
          setLoading: (isLoading) => set({ isLoading }),
          setInitialized: (isInitialized) => set({ isInitialized }),
          setServerAuthed: (serverAuthed) => set({ serverAuthed }),
          reset: () =>
            set({
              user: null,
              session: null,
              isLoading: false,
              isInitialized: true,
              // A real sign-out / no-session load MUST clear the SSR optimism, or a logged-out user
              // would keep reading as authed from a stale server seed.
              serverAuthed: false,
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
        serverAuthed: false,
        setUser: (user) => set({ user }),
        setSession: (session) => set({ session }),
        setLoading: (isLoading) => set({ isLoading }),
        setInitialized: (isInitialized) => set({ isInitialized }),
        setServerAuthed: (serverAuthed) => set({ serverAuthed }),
        reset: () =>
          set({
            user: null,
            session: null,
            isLoading: false,
            isInitialized: true,
            serverAuthed: false,
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
      serverAuthed: s.serverAuthed,
      setUser: s.setUser,
      setSession: s.setSession,
      setLoading: s.setLoading,
      setInitialized: s.setInitialized,
      setServerAuthed: s.setServerAuthed,
      reset: s.reset,
    })),
  );

  // SSR optimism (P3): the server already verified the cookie session, so treat the request as
  // authed + ready on first paint — before the client's async getSession() resolves — which is what
  // kills the auth-resolution flash. Both fold OUT the instant the real state lands (getSession sets
  // user+session; a logged-out load / sign-out calls reset() which clears serverAuthed), so this
  // only ever pulls the "authed" verdict EARLIER, never contradicts the final client truth.
  const isAuthenticated =
    (!!state.user && !!state.session) || state.serverAuthed;
  const isReady = state.isInitialized || state.serverAuthed;

  return {
    ...state,
    // Computed properties for easier usage
    isAuthenticated,
    isReady,
    // Quick check - don't block if auth is still loading, assume not authenticated
    isAuthenticatedSync: !!state.user && !!state.session && state.isInitialized,
  };
};
