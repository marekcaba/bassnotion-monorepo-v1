'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { User } from '@supabase/supabase-js';

interface UseAuthRedirectOptions {
  defaultRedirect?: string;
  requireEmailConfirmation?: boolean;
}

export const useAuthRedirect = (options: UseAuthRedirectOptions = {}) => {
  const router = useRouter();
  const { defaultRedirect = '/dashboard', requireEmailConfirmation = true } =
    options;

  const redirectAfterAuth = useCallback(
    (user: User | null, returnTo?: string) => {
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if email confirmation is required and user hasn't confirmed
      if (requireEmailConfirmation && !user.email_confirmed_at) {
        router.push('/verify-email');
        return;
      }

      // Redirect to intended destination or default
      const destination = returnTo || defaultRedirect;
      router.push(destination);
    },
    [router, defaultRedirect, requireEmailConfirmation],
  );

  const redirectToLogin = useCallback(
    (returnTo?: string) => {
      const loginUrl = returnTo
        ? `/login?returnTo=${encodeURIComponent(returnTo)}`
        : '/login';
      router.push(loginUrl);
    },
    [router],
  );

  const redirectToDashboard = useCallback(() => {
    router.push(defaultRedirect);
  }, [router, defaultRedirect]);

  return {
    redirectAfterAuth,
    redirectToLogin,
    redirectToDashboard,
  };
};
