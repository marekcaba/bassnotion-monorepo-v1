'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RegistrationData } from '@bassnotion/contracts';

import { RegistrationForm } from '@/domains/user/components/auth';
import { authService } from '@/domains/user/api/auth';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';

function RegisterPageContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');

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

  // Check if we should use backend API for testing
  const useBackendAuth = process.env.NEXT_PUBLIC_USE_BACKEND_AUTH === 'true';

  const handleRegistration = async (data: RegistrationData) => {
    setIsLoading(true);

    try {
      if (useBackendAuth) {
        // Use backend API for E2E testing
        const result = await authService.signUpWithBackend(data);

        if (result.success) {
          toast({
            title: 'Account created successfully!',
            description:
              'Welcome to BassNotion. Your account has been created.',
          });

          // Redirect to dashboard for testing
          router.push('/dashboard');
        } else {
          throw new Error(result.error?.message || 'Registration failed');
        }
      } else {
        // Use Supabase for production
        const authData = await authService.signUp(data);

        if (authData.user && authData.session) {
          // User is immediately signed in
          setUser(authData.user);
          setSession(authData.session);

          toast({
            title: 'Account created successfully!',
            description: 'Welcome to BassNotion. You are now signed in.',
          });

          redirectAfterAuth(authData.user, returnTo || undefined);
        } else if (authData.user && !authData.session) {
          // User needs to confirm email
          toast({
            title: 'Account created!',
            description:
              'Please check your email to confirm your account before signing in.',
          });

          router.push('/login?message=check-email');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);

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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Join BassNotion</h1>
          <p className="mt-2 text-muted-foreground">
            {prefilledEmail
              ? 'Complete your account creation'
              : 'Create your account to start your bass learning journey'}
          </p>
        </div>

        {/* Registration Form */}
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <RegistrationForm
            onSubmit={handleRegistration}
            onGoogleSignIn={handleGoogleSignIn}
            isLoading={isLoading}
            isGoogleLoading={isGoogleLoading}
            initialValues={initialValues}
          />
        </div>

        {/* Login Link */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link
                href={`/login${
                  returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
                }`}
              >
                Sign in
              </Link>
            </Button>
          </p>
        </div>

        {/* Back to Home */}
        <div className="text-center">
          <Button variant="ghost" asChild>
            <Link href="/">← Back to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}
