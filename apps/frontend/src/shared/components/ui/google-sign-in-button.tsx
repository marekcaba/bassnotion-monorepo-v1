'use client';

import { Button } from './button';
import { Icons } from '@/shared/components/ui/icons';
import { cn } from '@/shared/utils';

interface GoogleSignInButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
}

export function GoogleSignInButton({
  className,
  isLoading = false,
  ...props
}: GoogleSignInButtonProps) {
  return (
    <Button
      variant="outline"
      type="button"
      disabled={isLoading}
      className={cn(
        'w-full bg-white text-black hover:bg-gray-50 dark:bg-gray-950 dark:text-white dark:hover:bg-gray-900',
        className,
      )}
      {...props}
    >
      {isLoading ? (
        <Icons.spinner className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Icons.google className="mr-2 h-4 w-4" />
      )}
      Sign in with Google
    </Button>
  );
}
