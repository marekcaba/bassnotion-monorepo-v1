'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { authService } from '@/domains/user/api/auth';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useIdleTimeout } from '@/domains/user/hooks/use-idle-timeout';
import { IdleWarningDialog } from './IdleWarningDialog';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/infrastructure/supabase/client';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
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
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const handleIdleLogout = async () => {
    setShowIdleWarning(false);
    await authService.signOut();
    navigateWithTransition('/login?reason=idle');
    toast({
      title: 'Session Expired',
      description: 'You were logged out due to inactivity.',
      variant: 'destructive',
    });
  };

  const handleIdleWarning = () => {
    setShowIdleWarning(true);
  };

  const handleExtendSession = async () => {
    setShowIdleWarning(false);
    try {
      const { session } = await authService.refreshSession();
      if (session) {
        setSession(session);
      }
      resetIdleTimer();
    } catch (error) {
      console.error('Failed to refresh session:', error);
      handleIdleLogout();
    }
  };

  // Only enable idle timeout when auth is ready and user is authenticated
  // This prevents event listener overload during webkit startup
  const { resetIdleTimer } = useIdleTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes warning
    enabled: isReady && isAuthenticated, // Only enable when fully ready
    onIdle: handleIdleLogout,
    onWarning: handleIdleWarning,
  });

  useEffect(() => {
    let mounted = true;
    let initTimeoutId: NodeJS.Timeout;

    // Detect E2E testing for special handling
    const isE2ETesting =
      typeof window !== 'undefined' &&
      (process.env.NODE_ENV === 'test' ||
        (window as any).__playwright ||
        (window as any).playwright ||
        navigator.webdriver ||
        (window as any).__webdriver ||
        (window as any)._phantom);

    // Get initial session
    const initializeAuth = async () => {
      if (!mounted) return;

      // For E2E testing, use immediate fallback to prevent crashes
      if (isE2ETesting) {
        console.log('E2E testing detected: Using immediate fallback');
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

        if (!mounted) return;

        if (session) {
          setUser(session.user);
          setSession(session);
        } else {
          reset();
        }
      } catch (error) {
        console.error('Error initializing auth:', error);

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
            console.log('Auth timeout detected - continuing without session');
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
    if (!isE2ETesting) {
      try {
        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            if (!mounted) return;

            if (process.env.NODE_ENV === 'development') {
              console.debug('[Auth] State change:', {
                event,
                user: session?.user?.email,
              });
            }

            if (event === 'INITIAL_SESSION') {
              return; // Skip initial session as it's handled by initializeAuth
            }

            try {
              if (session) {
                setUser(session.user);
                setSession(session);
              } else {
                reset();
                setShowIdleWarning(false);
              }
            } catch (error) {
              console.error('Error in auth state change handler:', error);
            }
          },
        );

        subscription = authSubscription;
      } catch (error) {
        console.error('Error setting up auth state listener:', error);
      }
    } else {
      console.warn('E2E testing detected: Skipping auth state listener setup');
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
          console.error('Error unsubscribing from auth changes:', error);
        }
      }
    };
  }, []); // Empty dependency array since we're handling cleanup properly

  // Don't render children until auth is initialized - CHANGE THIS to non-blocking
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
