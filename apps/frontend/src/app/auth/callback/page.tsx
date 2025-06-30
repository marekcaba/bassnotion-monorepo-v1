'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/infrastructure/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

function AuthCallbackContent() {
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setUser, setSession } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();

  useEffect(() => {
    const handleAuthCallback = async () => {
      // Debug: Log URL and search params
      console.debug('[Auth Debug] Callback URL info:', {
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

        console.debug('[Auth Debug] Current session check:', {
          // TODO: Review non-null assertion - consider null safety
          hasSession: !!session,
          error: sessionError,
        });

        if (session) {
          // We already have a session, use it
          setUser(session.user);
          setSession(session);
          // Redirect without success toast - user will see they're logged in
          redirectAfterAuth(session.user);
          return;
        }

        // If no session, try to exchange the code
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');

        // Handle OAuth errors
        if (error) {
          console.error('[Auth Debug] OAuth error:', {
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
          console.error('[Auth Debug] No code found and no session available');
          toast({
            title: 'Error',
            description: 'Authentication failed. Please try again.',
            variant: 'destructive',
          });
          navigateWithTransition('/login');
          return;
        }

        console.debug('[Auth Debug] Exchanging code for session...');
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('[Auth Debug] Session exchange error:', exchangeError);
          throw exchangeError;
        }

        // TODO: Review non-null assertion - consider null safety
        if (!data.session || !data.user) {
          throw new Error('No session or user data received');
        }

        setUser(data.user);
        setSession(data.session);
        // Redirect without success toast - user will see they're logged in
        redirectAfterAuth(data.user);
      } catch (error) {
        console.error('[Auth Debug] Callback handling error:', error);
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
