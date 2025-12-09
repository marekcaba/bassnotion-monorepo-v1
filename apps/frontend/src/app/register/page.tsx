'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { RegistrationData } from '@bassnotion/contracts';

import { RegistrationForm } from '@/domains/user/components/auth';
import { authService } from '@/domains/user/api/auth';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { HomeNavbar } from '../_components/HomeNavbar';

function RegisterPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();
  const searchParams = useSearchParams();

  // Get pre-filled values from URL parameters (from failed login)
  const prefilledEmail = searchParams.get('email');
  const prefilledPassword = searchParams.get('password');

  const initialValues = {
    email: prefilledEmail || '',
    password: prefilledPassword || '',
    confirmPassword: prefilledPassword || '',
  };

  const { setUser, setSession } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const { toast } = useToast();
  const { logger } = useCorrelation('RegisterPage');

  // Check if we should use backend API for testing
  const useBackendAuth = process.env.NEXT_PUBLIC_USE_BACKEND_AUTH === 'true';

  const handleRegistration = async (data: RegistrationData) => {
    setIsLoading(true);

    try {
      if (useBackendAuth) {
        // Use backend API for E2E testing
        logger.info('[Register Debug] Using backend registration');
        const result = await authService.signUpWithBackend(data);
        logger.info('[Register Debug] Backend result:', result);

        if (result.success) {
          // Redirect to dashboard for testing - no need for success toast
          navigateWithTransition('/dashboard');
        } else {
          throw new Error(
            result.message || result.error?.message || 'Registration failed',
          );
        }
      } else {
        // Use Supabase for production
        const authData = await authService.signUp(data);

        if (authData.user && authData.session) {
          // User is immediately signed in
          setUser(authData.user);
          setSession(authData.session);

          // Redirect without success toast - user will see they're logged in
          redirectAfterAuth(authData.user);
        } else if (authData.user && !authData.session) {
          // User needs to confirm email - this toast is helpful
          toast({
            title: 'Account created!',
            description:
              'Please check your email to confirm your account before signing in.',
          });

          navigateWithTransition('/login?message=check-email');
        }
      }
    } catch (error) {
      logger.error('Registration error:', error);

      let errorMessage = 'Failed to create account. Please try again.';

      if (error instanceof Error) {
        errorMessage = error.message;
      }

      toast({
        title: 'Registration failed',
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
    <div className="min-h-screen bg-black">
      {/* Header with Logo - same as homepage */}
      <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
        <button onClick={() => navigateWithTransition('/')} className="cursor-pointer">
          <Image
            src="/BASSICOLOGY BIG.png"
            alt="Bassicology"
            width={600}
            height={150}
            className="w-[220px] sm:w-[320px] md:w-[400px] lg:w-[500px] xl:w-[600px] h-auto"
            priority
          />
        </button>
      </header>

      {/* Navbar - use shared HomeNavbar component */}
      <HomeNavbar />

      {/* Main Content */}
      <div className="flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          {/* Registration Form */}
          <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 sm:p-6 shadow-sm">
            <RegistrationForm
              onSubmit={handleRegistration}
              onGoogleSignIn={handleGoogleSignIn}
              isLoading={isLoading}
              isGoogleLoading={isGoogleLoading}
              initialValues={initialValues}
            />
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

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black" />
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
