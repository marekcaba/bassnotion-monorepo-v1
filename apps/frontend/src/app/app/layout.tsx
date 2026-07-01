import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { HydrationBoundary } from '@tanstack/react-query';
import { prefetchAppShell } from '@/lib/server/prefetchAppShell';
import { readWelcomeCookie } from '@/lib/server/readWelcomeCookie';
import { AppClientLayout } from './AppClientLayout';
import { AuthStoreHydrator } from './AuthStoreHydrator';

/**
 * SERVER layout for the /app/* tree. Two jobs:
 *
 * 1. SEO: emit `noindex` on every app page — the member surface returns HTTP 200 to crawlers
 *    (client-side AuthGuard), so robots.txt alone is not enough. Root metadata sets index:true;
 *    the last segment to define `robots` wins, so this overrides it for /app/*. See
 *    docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 9).
 *
 * 2. SSR shell hydration (P3): server-verify the cookie session + prefetch the member's
 *    entitlement, then seed both into the client on first paint — AuthStoreHydrator flips
 *    isReady/isAuthenticated true (no auth-resolution flash) and HydrationBoundary hydrates the
 *    ['billing','access'] cache so useEntitlement resolves the real tier immediately (no
 *    flash-to-free). GENERIC across /app/* — nothing gym-specific here (the gym seeds its own
 *    doneTodayUtc route-locally; the today-rep POST mints, so it must never run in this shared
 *    layout — R11). prefetchAppShell never throws, so a hiccup degrades to today's behavior.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AppLayout({ children }: { children: ReactNode }) {
  const { serverAuthed, dehydratedState } = await prefetchAppShell();
  // Server-decide the welcome overlay from the bn-welcome cookie, so it's painted in the FIRST HTML
  // (no client-side "Backstage → overlay" flash). The client overlay clears the cookie → fires once.
  const showWelcome = await readWelcomeCookie();

  return (
    <HydrationBoundary state={dehydratedState}>
      <AuthStoreHydrator serverAuthed={serverAuthed} />
      <AppClientLayout showWelcome={showWelcome}>{children}</AppClientLayout>
    </HydrationBoundary>
  );
}
