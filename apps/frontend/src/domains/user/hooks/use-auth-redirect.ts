'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import type { User } from '@supabase/supabase-js';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { supabase } from '@/infrastructure/supabase/client';

interface UseAuthRedirectOptions {
  defaultRedirect?: string;
  requireEmailConfirmation?: boolean;
  /** If true, checks assessment status and redirects to /assessment if not completed */
  checkAssessment?: boolean;
}

/**
 * Check if user has completed assessment
 * Returns true if completed, false if not, null if check failed
 */
async function checkAssessmentStatus(): Promise<boolean | null> {
  try {
    // Backend AuthGuard reads Bearer tokens from Authorization header, not
    // cookies — `credentials: 'include'` alone produces an unconditional 401.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      // No session yet — skip the call. Caller falls through to default
      // redirect, which is the same behavior as a returned null.
      return null;
    }

    const response = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/v1/assessment/status`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!response.ok) {
      console.warn('Failed to check assessment status:', response.status);
      return null;
    }

    const data = await response.json();
    return data.completed === true;
  } catch (err) {
    console.warn('Error checking assessment status:', err);
    return null;
  }
}

export const useAuthRedirect = (options: UseAuthRedirectOptions = {}) => {
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const {
    // Clean landing: the app host's '/' rewrites to /app (Backstage home).
    defaultRedirect = '/',
    requireEmailConfirmation = true,
    // Assessment is a suggestion, not a gate: after login users land on
    // the dashboard, which surfaces a prompt to take the assessment.
    // Opt in (checkAssessment: true) only where a hard redirect is wanted.
    checkAssessment = false,
  } = options;

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
    async (user: User | null) => {
      if (!user) {
        scheduleRedirect('/login');
        return;
      }

      // Check if email confirmation is required and user hasn't confirmed
      if (requireEmailConfirmation && !user.email_confirmed_at) {
        scheduleRedirect('/verify-email');
        return;
      }

      // Check if assessment is required and not completed
      if (checkAssessment) {
        const isAssessmentCompleted = await checkAssessmentStatus();

        // If assessment not completed (or check succeeded and returned false),
        // redirect to assessment
        if (isAssessmentCompleted === false) {
          scheduleRedirect('/assessment');
          return;
        }

        // If check failed (null), fall through to default redirect
        // This prevents blocking users if the API is down
      }

      // Redirect to dashboard or default route
      scheduleRedirect(defaultRedirect);
    },
    [
      scheduleRedirect,
      defaultRedirect,
      requireEmailConfirmation,
      checkAssessment,
    ],
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

  const redirectToAssessment = useCallback(() => {
    scheduleRedirect('/assessment');
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
    redirectToAssessment,
    scheduleRedirect,
  };
};
