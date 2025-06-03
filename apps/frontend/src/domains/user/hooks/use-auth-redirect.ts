'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface UseAuthRedirectOptions {
  defaultRedirect?: string;
  requireEmailConfirmation?: boolean;
}

export const useAuthRedirect = (options: UseAuthRedirectOptions = {}) => {
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { defaultRedirect = '/dashboard', requireEmailConfirmation = true } =
    options;

  const pendingRedirectRef = useRef<{
    destination: string;
    delay: number;
  } | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Enhanced redirect that waits for auth state to settle
  const scheduleRedirect = useCallback(
    (destination: string, delay = 150) => {
      // Clear any pending redirect
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }

      pendingRedirectRef.current = { destination, delay };

      redirectTimeoutRef.current = setTimeout(() => {
        navigateWithTransition(destination);
        pendingRedirectRef.current = null;
      }, delay);
    },
    [navigateWithTransition],
  );

  const redirectAfterAuth = useCallback(
    (user: User | null) => {
      if (!user) {
        scheduleRedirect('/login');
        return;
      }

      // Check if email confirmation is required and user hasn't confirmed
      if (requireEmailConfirmation && !user.email_confirmed_at) {
        scheduleRedirect('/verify-email');
        return;
      }

      // Always redirect to dashboard for simplicity with smooth transition
      scheduleRedirect(defaultRedirect);
    },
    [scheduleRedirect, defaultRedirect, requireEmailConfirmation],
  );

  const redirectToLogin = useCallback(() => {
    scheduleRedirect('/login');
  }, [scheduleRedirect]);

  const redirectToDashboard = useCallback(() => {
    scheduleRedirect(defaultRedirect);
  }, [scheduleRedirect, defaultRedirect]);

  const redirectToHome = useCallback(() => {
    scheduleRedirect('/');
  }, [scheduleRedirect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  return {
    redirectAfterAuth,
    redirectToLogin,
    redirectToDashboard,
    redirectToHome,
    scheduleRedirect,
  };
};
