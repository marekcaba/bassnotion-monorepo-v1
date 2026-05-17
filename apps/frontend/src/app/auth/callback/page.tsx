'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/infrastructure/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

function isEmailConfirmation(
  searchParams: URLSearchParams | ReturnType<typeof useSearchParams>,
  user: { email_confirmed_at?: string | null } | null,
): boolean {
  // Supabase tags email-confirmation redirects with type=signup (or
  // email_confirmation on newer flows).
  const type = searchParams.get('type');
  if (type === 'signup' || type === 'email_confirmation') return true;

  // Fallback: if email was confirmed in the last 5 minutes, treat as
  // first-time confirmation (catches Supabase flow versions that drop
  // the type param).
  const confirmedAt = user?.email_confirmed_at;
  if (!confirmedAt) return false;
  const ageMs = Date.now() - new Date(confirmedAt).getTime();
  return ageMs >= 0 && ageMs < 5 * 60 * 1000;
}

function AuthCallbackContent() {
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setUser, setSession } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const { logger } = useCorrelation('AuthCallback');

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Debug: Log URL and search params
      logger.debug('[Auth Debug] Callback URL info:', {
        fullUrl: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });

      try {
        // First try to get the current session
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        logger.debug('[Auth Debug] Current session check:', {
          // TODO: Review non-null assertion - consider null safety
          hasSession: !!session,
          error: sessionError,
        });

        if (session) {
          // We already have a session, use it
          setUser(session.user);
          setSession(session);
          // Show a welcome toast when arriving via the email-confirmation link
          // so the user knows what just happened (vs silent auto-sign-in).
          if (isEmailConfirmation(searchParams, session.user)) {
            toast({
              title: 'Welcome to Bassicology!',
              description: 'Your email is confirmed.',
            });
          }
          redirectAfterAuth(session.user);
          return;
        }

        // If no session, try to exchange the code
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth errors
        if (error) {
          logger.error('[Auth Debug] OAuth error:', {
            error,
            description: errorDescription,
          });
          toast({
            title: 'Authentication Error',
            description: errorDescription || error,
            variant: 'destructive',
          });
          navigateWithTransition('/login');
          return;
        }

        // TODO: Review non-null assertion - consider null safety
        if (!code) {
          logger.error('[Auth Debug] No code found and no session available');
          toast({
            title: 'Error',
            description: 'Authentication failed. Please try again.',
            variant: 'destructive',
          });
          navigateWithTransition('/login');
          return;
        }

        logger.debug('[Auth Debug] Exchanging code for session...');
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          logger.error('[Auth Debug] Session exchange error:', exchangeError);
          throw exchangeError;
        }

        // TODO: Review non-null assertion - consider null safety
        if (!data.session || !data.user) {
          throw new Error('No session or user data received');
        }

        setUser(data.user);
        setSession(data.session);
        if (isEmailConfirmation(searchParams, data.user)) {
          toast({
            title: 'Welcome to Bassicology!',
            description: 'Your email is confirmed.',
          });
        }
        redirectAfterAuth(data.user);
      } catch (error) {
        logger.error('[Auth Debug] Callback handling error:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Authentication failed',
          variant: 'destructive',
        });
        navigateWithTransition('/login');
      }
    };

    handleAuthCallback();
  }, [
    navigateWithTransition,
    searchParams,
    toast,
    setUser,
    setSession,
    redirectAfterAuth,
    logger,
  ]);

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="text-center">
        <h2 className="text-lg font-semibold">Completing sign in...</h2>
        <p className="text-muted-foreground mt-2">
          Please wait while we verify your credentials.
        </p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen w-screen items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-semibold">Loading...</h2>
            <p className="text-muted-foreground mt-2">
              Please wait while we process your authentication.
            </p>
          </div>
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
