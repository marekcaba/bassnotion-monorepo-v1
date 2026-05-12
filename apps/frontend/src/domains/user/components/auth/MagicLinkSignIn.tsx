'use client';

import { useState } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { authService, AuthError } from '../../api/auth';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

/**
 * Get user-friendly error message for auth errors.
 * SECURITY: All messages are intentionally generic to prevent email enumeration.
 * We never reveal whether an email exists in the system.
 */
function getAuthErrorMessage(
  error: AuthError,
  logger: ReturnType<typeof useCorrelation>['logger'],
): string {
  logger.error('[Auth Debug] Original error:', {
    message: error.message,
    status: error.status,
    name: error.name,
  });

  // Handle rate limit errors (safe to be specific about these)
  if (error.message?.includes('over_email_send_rate_limit')) {
    return 'Too many emails sent. Please wait a few minutes before trying again.';
  }

  if (error.message?.includes('email rate limit exceeded')) {
    return 'Email rate limit exceeded. Please try again in a few minutes.';
  }

  if (error.status === 429) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // SECURITY: Generic message for all credential-related errors
  // This prevents email enumeration by not revealing if email exists
  if (
    error.message?.includes('Invalid login credentials') ||
    error.message?.includes('Invalid email or password') ||
    error.message?.includes('User not found') ||
    error.message?.includes('Email not confirmed')
  ) {
    return 'Unable to process your request. Please check your email address and try again.';
  }

  // SECURITY: Generic message for registration-related errors
  // Don't reveal if email already exists
  if (
    error.message?.includes('Email already registered') ||
    error.message?.includes('User already registered')
  ) {
    return 'Unable to complete request. Please try signing in instead.';
  }

  if (error.message?.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.';
  }

  if (error.message?.includes('signup disabled')) {
    return 'New account registration is currently disabled. Please contact support.';
  }

  if (error.status === 422) {
    return 'Invalid input. Please check your email format.';
  }

  if (error.status === 400) {
    return 'Invalid request. Please check your input and try again.';
  }

  // Generic fallback - don't expose internal error details
  return 'An unexpected error occurred. Please try again.';
}

/**
 * MagicLinkSignIn Component
 *
 * SECURITY FIX: This component no longer checks if a user exists before sending
 * a magic link. Instead, it always attempts to send a magic link with
 * shouldCreateUser: true, which:
 * - Creates a new account if the email doesn't exist
 * - Sends a sign-in link if the email exists
 *
 * This prevents email enumeration attacks where attackers could determine
 * which emails are registered in the system.
 */
export function MagicLinkSignIn() {
  const { logger } = useCorrelation('MagicLinkSignIn');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setIsLoading(true);
      setEmailSent(false);

      // SECURITY: Always send magic link with shouldCreateUser: true
      // This way we don't reveal whether the account exists
      // - If account exists: sends sign-in link
      // - If account doesn't exist: creates account and sends link
      const { error } = await authService.signInWithMagicLink(email, true);

      if (error) throw error;

      // SECURITY: Use consistent messaging regardless of account state
      setEmailSent(true);
      toast({
        title: 'Check your email',
        description:
          'If this email is valid, we sent you a magic link. Click it to continue.',
      });
    } catch (error: unknown) {
      let userFriendlyMessage = 'Unable to process your request';

      const errorMessage = (error as { message?: string })?.message || '';
      const errorStatus = (error as { status?: number })?.status;

      // Check for rate limit errors first (safe to be specific)
      if (
        errorMessage.includes('email rate limit exceeded') ||
        errorMessage.includes('over_email_send_rate_limit') ||
        errorStatus === 429
      ) {
        userFriendlyMessage =
          'Too many requests. Please wait a few minutes and try again.';
      } else if (
        errorMessage.includes('rate limit') ||
        errorMessage.includes('too many')
      ) {
        userFriendlyMessage =
          'Too many requests. Please wait a moment and try again.';
      } else if (error instanceof AuthError) {
        userFriendlyMessage = getAuthErrorMessage(error, logger);
      }
      // SECURITY: Don't expose raw error messages to the user

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
            className="bg-zinc-800 border-zinc-700 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          type="submit"
          disabled={isLoading}
          className="bg-[#ffc700] text-black hover:bg-[#e6b300]"
        >
          {isLoading ? 'Processing...' : 'Continue with Magic Link'}
        </Button>
      </form>

      {emailSent && (
        <div className="mt-2 p-4 border border-green-700 rounded-lg bg-green-900/20">
          <p className="text-sm text-green-300">
            Check your email for a magic link. If you don't see it, check your
            spam folder.
          </p>
        </div>
      )}

      <p className="text-sm text-gray-400 text-center">
        We'll send you a magic link to sign in or create an account.
      </p>
    </div>
  );
}
