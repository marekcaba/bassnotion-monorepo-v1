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
    if (isReady && !isAuthenticated) {
      navigateWithTransition(redirectTo);
    }
  }, [isReady, isAuthenticated, navigateWithTransition, redirectTo]);

  // If auth is still loading, show fallback or children
  if (!isReady) {
    return fallback || children;
  }

  // If definitely not authenticated, show fallback
  if (!isAuthenticated) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center">
            <h2 className="text-lg font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              Please log in to access this page.
            </p>
          </div>
        </div>
      )
    );
  }

  // User is authenticated, show protected content
  return <>{children}</>;
}
