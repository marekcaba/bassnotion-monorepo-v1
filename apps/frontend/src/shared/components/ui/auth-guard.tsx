'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export function AuthGuard({
  children,
  fallback,
  redirectTo = '/login',
}: AuthGuardProps) {
  const { isAuthenticated, isReady } = useAuth();
  const _router = useRouter();
  const { navigateWithTransition } = useViewTransitionRouter();

  useEffect(() => {
    // Only redirect when auth is ready and user is definitely not authenticated
    // TODO: Review non-null assertion - consider null safety
    if (isReady && !isAuthenticated) {
      navigateWithTransition(redirectTo);
    }
  }, [isReady, isAuthenticated, navigateWithTransition, redirectTo]);

  // If auth is still loading, show fallback or children
  // TODO: Review non-null assertion - consider null safety
  if (!isReady) {
    return fallback || children;
  }

  // Not authenticated → the useEffect above is already navigating away.
  // Render a neutral spinner (not a scary "Access Denied" card) during that
  // brief redirect window. The store reports isReady=true the instant auth
  // state clears (signout, or a logged-out load of a protected route), so
  // showing an error-looking screen here just flashes alarming UI at a user
  // who is simply being redirected.
  if (!isAuthenticated) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div
            className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground"
            aria-label="Redirecting"
          />
        </div>
      )
    );
  }

  // User is authenticated, show protected content
  return <>{children}</>;
}
