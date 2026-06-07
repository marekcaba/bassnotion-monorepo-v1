'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { authService } from '../../api/auth';
import { useAuth } from '../../hooks/use-auth';
import { useIdleTimeout } from '../../hooks/use-idle-timeout';
import { IdleWarningDialog } from './IdleWarningDialog';
import { AuthErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/infrastructure/supabase/client';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { apiClient } from '@/lib/api-client';
import { isMockTestEnv } from '@/shared/utils/testEnv';

interface AuthProviderProps {
  children: React.ReactNode;
}

function AuthProviderContent({ children }: AuthProviderProps) {
  const { correlationId, logger } = useCorrelation('AuthProvider');
  const {
    setUser,
    setSession,
    setLoading,
    setInitialized,
    reset,
    isAuthenticated,
    isReady,
  } = useAuth();
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // Track the last authenticated user id so we can wipe the React Query cache
  // when the IDENTITY changes (sign-out, or sign-in as a DIFFERENT user). The
  // cache keys aren't user-scoped, so without this a new account can briefly
  // see the previous account's cached data (e.g. store "owned" products) until
  // a hard reload. Token refreshes keep the same id → no wipe.
  const lastUserIdRef = useRef<string | null>(null);
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  // Use ref to store resetIdleTimer to avoid circular dependency
  const resetIdleTimerRef = useRef<() => void>(() => {});

  // Memoize callbacks to prevent re-renders and avoid setState during render errors
  // See: CLAUDE.md "React Best Practices" - Always memoize event handlers passed as props
  const handleIdleLogout = useCallback(async () => {
    setShowIdleWarning(false);
    await authService.signOut();
    navigateWithTransition('/login?reason=idle');
    toast({
      title: 'Session Expired',
      description: 'You were logged out due to inactivity.',
      variant: 'destructive',
    });
  }, [navigateWithTransition, toast]);

  const handleIdleWarning = useCallback(() => {
    setShowIdleWarning(true);
  }, []);

  const handleExtendSession = useCallback(async () => {
    setShowIdleWarning(false);
    try {
      const { session } = await authService.refreshSession();
      if (session) {
        setSession(session);
        // Set the auth token for API calls
        if (session.access_token) {
          apiClient.setAuthToken(session.access_token);
        }
      }
      // Use ref to avoid circular dependency with useIdleTimeout
      resetIdleTimerRef.current();
    } catch (error) {
      logger.error('Failed to refresh session:', error);
      // Call logout logic inline to avoid circular dependency
      setShowIdleWarning(false);
      await authService.signOut();
      navigateWithTransition('/login?reason=idle');
      toast({
        title: 'Session Expired',
        description: 'You were logged out due to inactivity.',
        variant: 'destructive',
      });
    }
  }, [setSession, logger, navigateWithTransition, toast]);

  // Only enable idle timeout when auth is ready and user is authenticated
  // This prevents event listener overload during webkit startup
  const { resetIdleTimer } = useIdleTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes warning
    enabled: isReady && isAuthenticated, // Only enable when fully ready
    onIdle: handleIdleLogout,
    onWarning: handleIdleWarning,
  });

  // Keep ref updated with latest resetIdleTimer
  resetIdleTimerRef.current = resetIdleTimer;

  useEffect(() => {
    let mounted = true;
    let initTimeoutId: NodeJS.Timeout;

    // Opt-in mock-test mode (older specs that stub the whole backend).
    // Real-auth E2E tests do NOT set this, so they exercise the real flow.
    const isE2ETesting = isMockTestEnv();

    // Get initial session
    const initializeAuth = async () => {
      // TODO: Review non-null assertion - consider null safety
      if (!mounted) return;

      // For E2E testing, use immediate fallback to prevent crashes
      if (isE2ETesting) {
        logger.info('E2E testing detected: Using immediate fallback');
        // Add small delay to prevent race conditions
        await new Promise((resolve) => setTimeout(resolve, 100));
        setLoading(false);
        setInitialized(true);
        reset();
        return;
      }

      // Standard initialization for all browsers
      try {
        setLoading(true);

        // Reduced timeout protection - from 10s to 5s for faster UX
        const timeoutDuration = 5000;
        const timeoutPromise = new Promise<never>((_, reject) => {
          initTimeoutId = setTimeout(() => {
            reject(new Error('Auth initialization timeout'));
          }, timeoutDuration);
        });

        const authPromise = supabase.auth.getSession();

        const result = await Promise.race([authPromise, timeoutPromise]);
        const {
          data: { session },
        } = result;

        // Clear timeout if successful
        if (initTimeoutId) {
          clearTimeout(initTimeoutId);
        }

        // TODO: Review non-null assertion - consider null safety
        if (!mounted) return;

        if (session) {
          // Seed the identity ref on first load so the listener can detect a
          // later account-switch (and doesn't wipe the cache spuriously on the
          // first real event).
          lastUserIdRef.current = session.user?.id ?? null;
          setUser(session.user);
          setSession(session);
          // Set the auth token for API calls
          if (session.access_token) {
            apiClient.setAuthToken(session.access_token);
          }
        } else {
          reset();
          apiClient.clearAuthToken();
        }
      } catch (error) {
        logger.error('Error initializing auth:', error);

        // Clear timeout on error
        if (initTimeoutId) {
          clearTimeout(initTimeoutId);
        }

        if (mounted) {
          // On timeout or error, fallback to no session state
          reset();

          // Show user-friendly error for connection issues
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          if (
            errorMessage.includes('timeout') ||
            errorMessage.includes('network') ||
            errorMessage.includes('fetch')
          ) {
            // Don't show error toast for timeouts - just continue with app
            logger.info('Auth timeout detected - continuing without session');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    // Initialize auth
    initializeAuth();

    // Listen for auth state changes with error handling
    // Skip auth state listener only for E2E testing to prevent issues
    let subscription: any;
    // TODO: Review non-null assertion - consider null safety
    if (!isE2ETesting) {
      try {
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            // TODO: Review non-null assertion - consider null safety
            if (!mounted) return;

            logger.debug('Auth state change:', {
              event,
              user: session?.user?.email,
            });

            if (event === 'INITIAL_SESSION') {
              return; // Skip initial session as it's handled by initializeAuth
            }

            try {
              if (session) {
                // Wipe cached query data if a DIFFERENT user just signed in, so
                // one account never sees another's cached data (e.g. store
                // "owned" state). Same id (token refresh) → keep the cache.
                const newUserId = session.user?.id ?? null;
                if (
                  lastUserIdRef.current &&
                  lastUserIdRef.current !== newUserId
                ) {
                  queryClient.clear();
                }
                lastUserIdRef.current = newUserId;

                setUser(session.user);
                setSession(session);
                // Set the auth token for API calls
                if (session.access_token) {
                  apiClient.setAuthToken(session.access_token);
                }
              } else {
                // Signed out — clear cached query data so the next account
                // (or anonymous view) starts clean.
                if (lastUserIdRef.current) {
                  queryClient.clear();
                  lastUserIdRef.current = null;
                }
                reset();
                apiClient.clearAuthToken();
                setShowIdleWarning(false);
              }
            } catch (error) {
              logger.error(
                'Error in auth state change handler',
                error as Error,
                { correlationId },
              );
            }
          },
        );

        subscription = authSubscription;
      } catch (error) {
        logger.error('Error setting up auth state listener', error as Error, {
          correlationId,
        });
      }
    } else {
      logger.warn('E2E testing detected: Skipping auth state listener setup', {
        correlationId,
      });
    }

    return () => {
      mounted = false;
      if (initTimeoutId) {
        clearTimeout(initTimeoutId);
      }
      if (subscription) {
        try {
          subscription.unsubscribe();
        } catch (error) {
          logger.error(
            'Error unsubscribing from auth changes',
            error as Error,
            { correlationId },
          );
        }
      }
    };
  }, []); // Empty dependency array since we're handling cleanup properly

  // Don't render children until auth is initialized - CHANGE THIS to non-blocking
  // TODO: Review non-null assertion - consider null safety
  if (!isReady) {
    // Instead of blocking, render children immediately with auth state loading in background
    return (
      <>
        {children}
        <IdleWarningDialog
          isOpen={showIdleWarning}
          onExtendSession={handleExtendSession}
          onLogout={handleIdleLogout}
          countdownSeconds={300} // 5 minutes
        />
      </>
    );
  }

  return (
    <>
      {children}
      <IdleWarningDialog
        isOpen={showIdleWarning}
        onExtendSession={handleExtendSession}
        onLogout={handleIdleLogout}
        countdownSeconds={300} // 5 minutes
      />
    </>
  );
}

export function AuthProvider({ children }: AuthProviderProps) {
  return (
    <AuthErrorBoundary>
      <AuthProviderContent>{children}</AuthProviderContent>
    </AuthErrorBoundary>
  );
}
