'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginData } from '@bassnotion/contracts';

import { LoginForm } from '@/domains/user/components/auth';
import { MagicLinkSignIn } from '@/domains/user/components/auth/MagicLinkSignIn';
import { authService } from '@/domains/user/api/auth';
import { AuthError } from '@supabase/supabase-js';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';

function LoginPageContent() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showCreateAccountButton, setShowCreateAccountButton] = useState(false);
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('returnTo');
  const message = searchParams.get('message');

  const { setUser, setSession } = useAuth();
  const { redirectAfterAuth } = useAuthRedirect();
  const { toast } = useToast();

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
      setShowCreateAccountButton(false); // Hide button on new attempt

      if (useBackendAuth) {
        // Use backend API for E2E testing
        const result = await authService.signInWithBackend(data);

        if (result.success) {
          toast({
            title: 'Welcome back!',
            description: 'You have been signed in successfully.',
          });

          // Redirect to dashboard for testing
          router.push('/dashboard');
        } else {
          throw new Error(result.error?.message || 'Login failed');
        }
      } else {
        // Use Supabase for production
        const authData = await authService.signIn(data);

        if (authData.user && authData.session) {
          setUser(authData.user);
          setSession(authData.session);

          toast({
            title: 'Welcome back!',
            description: 'You have been signed in successfully.',
          });

          redirectAfterAuth(authData.user, returnTo || undefined);
        }
      }
    } catch (error) {
      console.error('Login error:', error);

      let errorMessage =
        'Failed to sign in. Please check your credentials and try again.';
      let isInvalidCredentials = false;

      if (error instanceof Error) {
        errorMessage = error.message;

        // Provide more specific error messages for common cases
        if (error instanceof AuthError) {
          if (error.message.includes('Invalid login credentials')) {
            errorMessage =
              'Invalid email or password. Please check your credentials and try again.';
            isInvalidCredentials = true;
          } else if (error.message.includes('Email not confirmed')) {
            errorMessage =
              'Please check your email and click the confirmation link before signing in.';
          }
        }
      }

      // Show create account button only for invalid credentials
      if (isInvalidCredentials) {
        setShowCreateAccountButton(true);
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

  const handleCreateAccount = (data: LoginData) => {
    // Redirect to registration with pre-filled email and password
    const params = new URLSearchParams({
      email: data.email,
      password: data.password,
    });

    if (returnTo) {
      params.set('returnTo', returnTo);
    }

    router.push(`/register?${params.toString()}`);
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
        {/* Login Options */}
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <Tabs defaultValue="password" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="password">Password</TabsTrigger>
              <TabsTrigger value="magic-link">Magic Link</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <LoginForm
                onSubmit={handleSubmit}
                onGoogleSignIn={handleGoogleSignIn}
                onCreateAccount={handleCreateAccount}
                isLoading={isLoading}
                isGoogleLoading={isGoogleLoading}
                showCreateAccountButton={showCreateAccountButton}
              />
            </TabsContent>

            <TabsContent value="magic-link">
              <MagicLinkSignIn />
            </TabsContent>
          </Tabs>
        </div>

        {/* Register Link */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link
                href={`/register${
                  returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''
                }`}
              >
                Create account
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

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          Loading...
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
