'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { LoginData } from '@bassnotion/contracts';
import { AuthErrorBoundary } from '@/shared/components/ErrorBoundary';

import { LoginForm } from '@/domains/user/components/auth';
import { MagicLinkSignIn } from '@/domains/user/components/auth/MagicLinkSignIn';
import { AnimatedLoginSwitcher } from '@/domains/user/components/auth/AnimatedLoginSwitcher';
import { authService } from '@/domains/user/api/auth';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { HomeNavbar } from '../_components/HomeNavbar';

function LoginPageContent() {
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const searchParams = useSearchParams();
  const message = searchParams.get('message');
  const reason = searchParams.get('reason');

  const { setUser, setSession, isAuthenticated, isReady } = useAuth();
  const { redirectAfterAuth, redirectToDashboard } = useAuthRedirect();
  const { toast } = useToast();
  const { logger } = useCorrelation('LoginPage');

  // Redirect authenticated users to dashboard (unless they were redirected here for a reason)
  useEffect(() => {
    // Skip redirect if user was sent here due to idle timeout or other explicit reasons
    if (reason === 'idle') {
      return;
    }

    // Wait for auth to be ready, then redirect if authenticated
    if (isReady && isAuthenticated) {
      logger.info('User already authenticated, redirecting to dashboard');
      redirectToDashboard();
    }
  }, [isReady, isAuthenticated, reason, redirectToDashboard, logger]);

  // Show messages from URL params (e.g., after registration)
  useEffect(() => {
    if (message === 'check-email') {
      toast({
        title: 'Check your email',
        description:
          'Please check your email and click the confirmation link before signing in.',
      });
    }
  }, [message, toast]);

  // Check if we should use backend API for testing
  const useBackendAuth = process.env.NEXT_PUBLIC_USE_BACKEND_AUTH === 'true';

  const handleSubmit = async (data: LoginData) => {
    try {
      setIsLoading(true);

      // Validate input data before sending
      if (!data.email || !data.password) {
        throw new Error('Email and password are required');
      }

      logger.info('[Login Debug] Using backend auth:', { useBackendAuth });
      logger.info('[Login Debug] Environment variable:', {
        value: process.env.NEXT_PUBLIC_USE_BACKEND_AUTH,
      });

      if (useBackendAuth) {
        // Use backend API for E2E testing
        logger.info('[Login Debug] Using backend authentication');
        const result = await authService.signInWithBackend(data);

        if (result.success) {
          // Redirect to dashboard for testing - no need for success toast
          navigateWithTransition('/app');
        } else {
          throw new Error(
            result.message || result.error?.message || 'Login failed',
          );
        }
      } else {
        // Use Supabase for production
        logger.info('[Login Debug] Using Supabase authentication');
        const authData = await authService.signIn(data);

        if (authData.user && authData.session) {
          setUser(authData.user);
          setSession(authData.session);

          // Redirect to dashboard - no need for success toast
          redirectAfterAuth(authData.user);
        } else {
          throw new Error('Authentication failed - no user data received');
        }
      }
    } catch (error) {
      let errorMessage = 'Failed to sign in. Please try again.';

      if (error instanceof Error) {
        // Use the enhanced error message from auth service
        errorMessage = error.message;
      }

      toast({
        title: 'Sign in failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleLoading(true);
      await authService.signInWithGoogle();
      // The page will be redirected by Supabase
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error
            ? error.message
            : 'Failed to sign in with Google',
        variant: 'destructive',
      });
      setIsGoogleLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(230 35% 10%) 40%, hsl(240 25% 5%) 100%)',
      }}
    >
      {/* Header with Logo - same as homepage */}
      <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
        <button
          onClick={() => navigateWithTransition('/')}
          className="cursor-pointer"
        >
          <Image
            src="/BASSICOLOGY BIG.png"
            alt="Bassicology"
            width={600}
            height={150}
            className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
            priority
          />
        </button>
      </header>

      {/* Navbar - use shared HomeNavbar component */}
      <HomeNavbar />

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Login Options */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6 shadow-sm">
            <AnimatedLoginSwitcher>
              {{
                password: (
                  <LoginForm
                    onSubmit={handleSubmit}
                    onGoogleSignIn={handleGoogleSignIn}
                    isLoading={isLoading}
                    isGoogleLoading={isGoogleLoading}
                  />
                ),
                magicLink: <MagicLinkSignIn />,
              }}
            </AnimatedLoginSwitcher>
          </div>

          {/* Register Link */}
          <div className="text-center">
            <p className="text-xs sm:text-sm text-gray-400">
              Don't have an account?{' '}
              <Button
                variant="link"
                className="p-0 h-auto text-xs sm:text-sm text-[#ffc700] hover:text-[#e6b300]"
                onClick={() => navigateWithTransition('/register')}
              >
                Create account
              </Button>
            </p>
          </div>

          {/* Back to Home */}
          <div className="text-center">
            <Button
              variant="ghost"
              className="text-xs sm:text-sm text-gray-400 hover:text-white"
              onClick={() => navigateWithTransition('/')}
            >
              ← Back to Home
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthErrorBoundary>
      <Suspense
        fallback={
          <div
            className="min-h-screen"
            style={{
              background:
                'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(230 35% 10%) 40%, hsl(240 25% 5%) 100%)',
            }}
          />
        }
      >
        <LoginPageContent />
      </Suspense>
    </AuthErrorBoundary>
  );
}
