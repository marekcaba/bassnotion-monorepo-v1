'use client';

import { useState } from 'react';
import { useToast } from '@/shared/hooks/use-toast';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { authService } from '../../api/auth';

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
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to send magic link',
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
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to check email',
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
