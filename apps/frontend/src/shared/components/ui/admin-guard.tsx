'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';

interface AdminGuardProps {
  children: ReactNode;
  loginRedirect?: string;
  nonAdminRedirect?: string;
}

/**
 * Client-side route guard for /admin/* pages. Two checks:
 *
 *  1. Logged-in (else redirect to /login).
 *  2. profiles.role === 'admin' (else redirect to /).
 *
 * Uses the cached role from localStorage to render instantly for known
 * admins (no network round-trip on every nav), then verifies against the
 * live profile fetch in the background. This matches how the rest of the
 * app handles role display.
 *
 * This is defense in depth, not the security boundary — every admin
 * endpoint on the backend is gated by NestJS AdminGuard, which checks
 * profiles.role server-side. This component only stops a non-admin from
 * seeing the admin UI shell.
 */
export function AdminGuard({
  children,
  loginRedirect = '/login',
  nonAdminRedirect = '/',
}: AdminGuardProps) {
  const { isAuthenticated, isReady: authReady } = useAuth();
  const { profile, cachedRole, isHydrated, isLoading } = useUserProfile();
  const router = useRouter();

  // Resolved role: prefer the fresh value from the profile fetch; fall
  // back to the localStorage cache so the page renders instantly on nav.
  const resolvedRole = profile?.role ?? cachedRole;

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthenticated) {
      router.replace(loginRedirect);
      return;
    }
    if (!isHydrated) return;
    // Still loading the profile and no cached role to fall back on —
    // wait one more tick before redirecting so we don't bounce a real
    // admin whose profile hasn't arrived yet.
    if (isLoading && resolvedRole === null) return;
    if (resolvedRole !== 'admin') {
      router.replace(nonAdminRedirect);
    }
  }, [
    authReady,
    isAuthenticated,
    isHydrated,
    isLoading,
    resolvedRole,
    loginRedirect,
    nonAdminRedirect,
    router,
  ]);

  // Loading window: auth not ready, or signed-in but role still pending.
  const showSpinner =
    !authReady ||
    !isAuthenticated ||
    !isHydrated ||
    (isLoading && resolvedRole === null) ||
    resolvedRole !== 'admin';

  if (showSpinner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div
          className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-700"
          aria-label="Checking admin access"
        />
      </div>
    );
  }

  return <>{children}</>;
}
