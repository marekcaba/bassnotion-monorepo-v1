'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LoginData } from '@bassnotion/contracts';

import { LoginForm } from '@/domains/user/components/auth';
import { MagicLinkSignIn } from '@/domains/user/components/auth/MagicLinkSignIn';
import { authService } from '@/domains/user/api/auth';
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
  const searchParams = useSearchParams();
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

      // Validate input data before sending
      if (!data.email || !data.password) {
        throw new Error('Email and password are required');
      }

      console.log('[Login Debug] Using backend auth:', useBackendAuth);
      console.log(
        '[Login Debug] Environment variable:',
        process.env.NEXT_PUBLIC_USE_BACKEND_AUTH,
      );

      if (useBackendAuth) {
        // Use backend API for E2E testing
        console.log('[Login Debug] Using backend authentication');
        const result = await authService.signInWithBackend(data);

        if (result.success) {
          toast({
            title: 'Welcome back!',
            description: 'You have been signed in successfully.',
          });

          // Redirect to dashboard for testing
          router.push('/dashboard');
        } else {
          throw new Error(
            result.message || result.error?.message || 'Login failed',
          );
        }
      } else {
        // Use Supabase for production
        console.log('[Login Debug] Using Supabase authentication');
        const authData = await authService.signIn(data);

        if (authData.user && authData.session) {
          setUser(authData.user);
          setSession(authData.session);

          toast({
            title: 'Welcome back!',
            description: 'You have been signed in successfully.',
          });

          redirectAfterAuth(authData.user);
        } else {
          throw new Error('Authentication failed - no user data received');
        }
      }
    } catch (error) {
      console.error('[Login Debug] Full error object:', error);
      console.error(
        '[Login Debug] Error message:',
        error instanceof Error ? error.message : 'Unknown',
      );
      console.error(
        '[Login Debug] Error name:',
        error instanceof Error ? error.name : 'Unknown',
      );

      let errorMessage = 'Failed to sign in. Please try again.';

      if (error instanceof Error) {
        // Use the enhanced error message from auth service
        errorMessage = error.message;
      }

      console.log(
        '[Login Debug] Final error message shown to user:',
        errorMessage,
      );

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
                isLoading={isLoading}
                isGoogleLoading={isGoogleLoading}
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
              <Link href="/register">Create account</Link>
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
