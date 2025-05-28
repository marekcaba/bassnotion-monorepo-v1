'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LoginData } from '@bassnotion/contracts';

import { LoginForm } from '@/domains/user/components/auth';
import { authService, AuthError } from '@/domains/user/api/auth';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthRedirect } from '@/domains/user/hooks/use-auth-redirect';
import { Button } from '@/shared/components/ui/button';
import { useToast } from '@/shared/hooks/use-toast';

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
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

  const handleLogin = async (data: LoginData) => {
    setIsLoading(true);

    try {
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
    } catch (error) {
      console.error('Login error:', error);

      let errorMessage =
        'Failed to sign in. Please check your credentials and try again.';

      if (error instanceof AuthError) {
        errorMessage = error.message;

        // Provide more specific error messages for common cases
        if (error.message.includes('Invalid login credentials')) {
          errorMessage =
            'Invalid email or password. Please check your credentials and try again.';
        } else if (error.message.includes('Email not confirmed')) {
          errorMessage =
            'Please check your email and click the confirmation link before signing in.';
        }
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="mt-2 text-muted-foreground">
            Sign in to your BassNotion account
          </p>
        </div>

        {/* Login Form */}
        <div className="bg-card rounded-lg border p-6 shadow-sm">
          <LoginForm onSubmit={handleLogin} isLoading={isLoading} />
        </div>

        {/* Register Link */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Button variant="link" asChild className="p-0 h-auto">
              <Link
                href={`/register${returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : ''}`}
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
