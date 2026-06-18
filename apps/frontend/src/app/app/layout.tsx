import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { AppClientLayout } from './AppClientLayout';

/**
 * SERVER layout for the /app/* tree. Beyond rendering the client shell its job is
 * to emit `noindex` on every app page: the member surface returns HTTP 200 to
 * crawlers (client-side AuthGuard), so robots.txt alone is not enough — this
 * metadata override marks the paid surface non-indexable. Root metadata sets
 * index:true; the last segment to define `robots` wins, so this overrides it for
 * /app/*. See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 9).
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppClientLayout>{children}</AppClientLayout>;
}
