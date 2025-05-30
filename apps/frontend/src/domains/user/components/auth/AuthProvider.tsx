'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '../../api/auth';
import { useAuth } from '../../hooks/use-auth';
import { useIdleTimeout } from '../../hooks/use-idle-timeout';
import { IdleWarningDialog } from './IdleWarningDialog';
import { useToast } from '@/shared/hooks/use-toast';
import { supabase } from '@/infrastructure/supabase/client';

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
  const router = useRouter();
  const { toast } = useToast();
  const [showIdleWarning, setShowIdleWarning] = useState(false);

  const handleIdleLogout = async () => {
    setShowIdleWarning(false);
    await authService.signOut();
    router.push('/login?reason=idle');
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

  const { resetIdleTimer } = useIdleTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 5 * 60 * 1000, // 5 minutes warning
    enabled: isAuthenticated,
    onIdle: handleIdleLogout,
    onWarning: handleIdleWarning,
  });

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const initializeAuth = async () => {
      if (!mounted) return;

      try {
        setLoading(true);
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session) {
          setUser(session.user);
          setSession(session);
          resetIdleTimer();
        } else {
          reset();
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (mounted) reset();
      } finally {
        if (mounted) {
          setLoading(false);
          setInitialized(true);
        }
      }
    };

    initializeAuth();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
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

      if (session) {
        setUser(session.user);
        setSession(session);
        resetIdleTimer();
      } else {
        reset();
        setShowIdleWarning(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Empty dependency array since we're handling cleanup properly

  // Don't render children until auth is initialized
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Loading...</h2>
          <p className="text-muted-foreground mt-2">
            Please wait while we initialize your session.
          </p>
        </div>
      </div>
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
