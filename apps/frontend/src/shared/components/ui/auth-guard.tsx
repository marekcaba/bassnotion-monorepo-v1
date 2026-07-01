'use client';

import { useEffect } from 'react';
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
  const { navigateWithTransition } = useViewTransitionRouter();

  useEffect(() => {
    // Only redirect when auth is ready and the user is definitely not authenticated.
    if (isReady && !isAuthenticated) {
      navigateWithTransition(redirectTo);
    }
  }, [isReady, isAuthenticated, navigateWithTransition, redirectTo]);

  // FALLBACK GATE (post-SSR). The PRIMARY logged-out gate is now the EDGE middleware, which
  // 307s an unauthenticated request to /login BEFORE any HTML ships (see middleware.ts — the
  // sb-bn cookie-presence check on /app*, /college*, APP_ROUTES). And the P3 auth-store seed
  // makes isReady/isAuthenticated true on first paint for a logged-in member, so `!isReady`
  // essentially never fires on a fresh load. This client guard therefore only catches the cases
  // the edge can't: a CLIENT-SIDE sign-out, a cross-tab logout, an expired-mid-session token, or
  // a preview deploy where the edge host-rules don't apply. In those cases the useEffect above
  // navigates away.
  //
  // While auth resolves OR during that brief redirect hop we render `fallback ?? children` (not a
  // spinner): the edge already handled the common logged-out load, so flashing a lone spinner for
  // the rare soft-nav redirect is noise. Rendering children for the sub-second redirect window is
  // harmless (the page's own data is auth-gated server-side + by the query `enabled` flags) and
  // avoids a jarring blank-spinner flash.
  if (!isReady || !isAuthenticated) {
    return <>{fallback ?? children}</>;
  }

  // Authenticated → protected content.
  return <>{children}</>;
}
