'use client';

import { useState } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { authService, AuthError } from '../../api/auth';

// Import the same error handling function used by other auth methods
function getAuthErrorMessage(error: AuthError): string {
  console.error('[Auth Debug] Original error:', {
    message: error.message,
    status: error.status,
    name: error.name,
  });

  // Handle specific error codes
  if (error.message?.includes('over_email_send_rate_limit')) {
    return 'Too many emails sent. Please wait a few minutes before trying again.';
  }

  if (error.message?.includes('email rate limit exceeded')) {
    return 'Email rate limit exceeded. Please try again in a few minutes.';
  }

  if (error.message?.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (error.message?.includes('Invalid email or password')) {
    return 'Invalid email or password. Please check your credentials and try again.';
  }

  if (error.message?.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link before signing in.';
  }

  if (error.message?.includes('User not found')) {
    return 'No account found with this email address. Please sign up first.';
  }

  if (
    error.message?.includes('Email already registered') ||
    error.message?.includes('User already registered')
  ) {
    return 'An account with this email already exists. Please sign in instead.';
  }

  if (error.message?.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (error.message?.includes('signup disabled')) {
    return 'New account registration is currently disabled. Please contact support.';
  }

  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  if (error.status === 422) {
    return 'Invalid input. Please check your email and password format.';
  }

  if (error.status === 400) {
    return 'Bad request. Please check your input and try again.';
  }

  // Return the original message for unknown errors
  return error.message || 'An unexpected error occurred. Please try again.';
}

export function MagicLinkSignIn() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [noAccountFound, setNoAccountFound] = useState(false);
  const { toast } = useToast();

  const handleMagicLink = async (createAccount = false) => {
    try {
      setIsLoading(true);

      const { error } = await authService.signInWithMagicLink(
        email,
        createAccount,
      );

      if (error) throw error;

      toast({
        title: 'Check your email',
        description: createAccount
          ? 'We sent you a magic link to create your account and sign in.'
          : 'We sent you a magic link to sign in.',
      });

      setNoAccountFound(false);
    } catch (error) {
      // Use the same error handling as other auth methods
      let userFriendlyMessage = 'Failed to send magic link';

      if (error instanceof AuthError) {
        userFriendlyMessage = getAuthErrorMessage(error);
      } else if (error instanceof Error) {
        // For non-AuthError instances, check if it's a rate limit error
        if (error.message.includes('email rate limit exceeded')) {
          userFriendlyMessage =
            'Email rate limit exceeded. Please try again in a few minutes.';
        } else if (error.message.includes('rate limit')) {
          userFriendlyMessage =
            'Too many requests. Please wait a moment and try again.';
        } else {
          userFriendlyMessage = error.message;
        }
      }

      toast({
        title: 'Error',
        description: userFriendlyMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setNoAccountFound(false);

      // First check if user exists
      const { exists, error: checkError } =
        await authService.checkUserExists(email);

      if (checkError) throw checkError;

      if (!exists) {
        // Show inline message for new user
        setNoAccountFound(true);
        return;
      }

      // Existing user - send magic link
      await handleMagicLink(false);
    } catch (error) {
      // Use the same error handling as other auth methods
      let userFriendlyMessage = 'Failed to check email';

      if (error instanceof AuthError) {
        userFriendlyMessage = getAuthErrorMessage(error);
      } else if (error instanceof Error) {
        userFriendlyMessage = error.message;
      }

      toast({
        title: 'Error',
        description: userFriendlyMessage,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col space-y-4">
      <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Processing...' : 'Continue with Magic Link'}
        </Button>
      </form>

      {noAccountFound && (
        <div className="mt-2 p-4 border rounded-lg bg-muted">
          <p className="text-sm mb-2">No account exists for {email}.</p>
          <Button
            onClick={() => handleMagicLink(true)}
            disabled={isLoading}
            variant="secondary"
            className="w-full"
          >
            Create New Account
          </Button>
        </div>
      )}

      <p className="text-sm text-muted-foreground text-center">
        We'll send you a magic link to sign in instantly.
      </p>
    </div>
  );
}
