'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/infrastructure/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { setUser, setSession } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const returnTo = searchParams.get('returnTo');

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
          hasSession: !!session,
          error: sessionError,
        });

        if (session) {
          // We already have a session, use it
          setUser(session.user);
          setSession(session);
          toast({
            title: 'Success',
            description: 'You have been signed in successfully.',
          });
          redirectAfterAuth(session.user, returnTo || undefined);
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
          router.push('/login');
          return;
        }

        if (!code) {
          console.error('[Auth Debug] No code found and no session available');
          toast({
            title: 'Error',
            description: 'Authentication failed. Please try again.',
            variant: 'destructive',
          });
          router.push('/login');
          return;
        }

        console.debug('[Auth Debug] Exchanging code for session...');
        const { data, error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);

        if (exchangeError) {
          console.error('[Auth Debug] Session exchange error:', exchangeError);
          throw exchangeError;
        }

        if (!data.session || !data.user) {
          throw new Error('No session or user data received');
        }

        setUser(data.user);
        setSession(data.session);
        toast({
          title: 'Success',
          description: 'You have been signed in successfully.',
          variant: 'default',
        });
        redirectAfterAuth(data.user, returnTo || undefined);
      } catch (error) {
        console.error('[Auth Debug] Callback handling error:', error);
        toast({
          title: 'Error',
          description:
            error instanceof Error ? error.message : 'Authentication failed',
          variant: 'destructive',
        });
        router.push('/login');
      }
    };

    handleAuthCallback();
  }, [
    router,
    searchParams,
    toast,
    setUser,
    setSession,
    redirectAfterAuth,
    returnTo,
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
