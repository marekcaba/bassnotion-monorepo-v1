'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { User } from '@supabase/supabase-js';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface UseAuthRedirectOptions {
  defaultRedirect?: string;
  requireEmailConfirmation?: boolean;
}

export const useAuthRedirect = (options: UseAuthRedirectOptions = {}) => {
  const router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { defaultRedirect = '/dashboard', requireEmailConfirmation = true } =
    options;

  const redirectAfterAuth = useCallback(
    (user: User | null) => {
      if (!user) {
        navigateWithTransition('/login');
        return;
      }

      // Check if email confirmation is required and user hasn't confirmed
      if (requireEmailConfirmation && !user.email_confirmed_at) {
        navigateWithTransition('/verify-email');
        return;
      }

      // Always redirect to dashboard for simplicity with smooth transition
      navigateWithTransition(defaultRedirect);
    },
    [navigateWithTransition, defaultRedirect, requireEmailConfirmation],
  );

  const redirectToLogin = useCallback(() => {
    navigateWithTransition('/login');
  }, [navigateWithTransition]);

  const redirectToDashboard = useCallback(() => {
    navigateWithTransition(defaultRedirect);
  }, [navigateWithTransition, defaultRedirect]);

  return {
    redirectAfterAuth,
    redirectToLogin,
    redirectToDashboard,
  };
};
