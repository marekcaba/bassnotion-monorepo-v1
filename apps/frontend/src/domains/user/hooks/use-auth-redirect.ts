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
    (user: User | null) => {
      if (!user) {
        router.push('/login');
        return;
      }

      // Check if email confirmation is required and user hasn't confirmed
      if (requireEmailConfirmation && !user.email_confirmed_at) {
        router.push('/verify-email');
        return;
      }

      // Always redirect to dashboard for simplicity
      router.push(defaultRedirect);
    },
    [router, defaultRedirect, requireEmailConfirmation],
  );

  const redirectToLogin = useCallback(() => {
    router.push('/login');
  }, [router]);

  const redirectToDashboard = useCallback(() => {
    router.push(defaultRedirect);
  }, [router, defaultRedirect]);

  return {
    redirectAfterAuth,
    redirectToLogin,
    redirectToDashboard,
  };
};
