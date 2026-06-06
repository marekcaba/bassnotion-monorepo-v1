import '@/shared/styles/globals.css';
import '@/utils/forceBrowserConsole'; // Force browser console logging
import '@/utils/initializeLogger'; // Initialize logger configuration
import { ReactNode } from 'react';
import { ReactQueryProvider } from '@/lib/react-query';
import { AuthProvider } from '@/domains/user/components/auth';
import { Toaster } from '@/shared/components/ui/toaster';
import { getLogger } from '@/utils/logger.js';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { AttributionProvider } from '@/shared/attribution/AttributionProvider';
import { isMockTestEnv, isWebkitBrowser } from '@/shared/utils/testEnv';
import { ThemedLayout } from './_components/ThemedLayout';
// Dev-only drum stretch tuning panel — self-gated (renders null unless
// ?drumadmin=1 or NEXT_PUBLIC_DRUM_ADMIN_PANEL=true), safe to mount at root.
import { DrumGapFillAdminPanel } from '@/domains/playback/components/DrumGapFillAdminPanel';

const logger = getLogger('app');

// AudioProvider is intentionally NOT mounted here.
// Audio is heavy (Tone.js, CoreServices, AudioContext, ~700-file playback domain)
// and only needed in routes that actually use it: /app, /library/[tutorialId],
// /admin/tutorials/[slug]/edit. Each of those mounts AudioProvider in its own layout.
// The marketing homepage (/) and auth pages stay lean.

import {
  courierPrime,
  inter,
  podiumSharp,
  bebasNeue,
  dmSans,
  dmMono,
  metadata,
} from './layout.constants';

export const generateMetadata = () => metadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link
          rel="icon"
          type="image/png"
          sizes="32x32"
          href="/favicon-32x32.png"
        />
        <link
          rel="icon"
          type="image/png"
          sizes="16x16"
          href="/favicon-16x16.png"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body
        className={`font-sans ${inter.variable} ${courierPrime.variable} ${podiumSharp.variable} ${bebasNeue.variable} ${dmSans.variable} ${dmMono.variable}`}
      >
        <ErrorBoundary>
          {/* Attribution spine: mints bn_anonymous_id + fires landing_view on
              every page (landing now, /app later). Renders nothing. */}
          <AttributionProvider />
          <AuthProviderWrapper>
            <ReactQueryProvider>
              <ThemedLayout>{children}</ThemedLayout>
            </ReactQueryProvider>
          </AuthProviderWrapper>
          <Toaster />
          {/* Dev-only drum stretch tuning panel. Renders null unless
              NEXT_PUBLIC_DRUM_ADMIN_PANEL=true or the URL has ?drumadmin=1.
              Mounted at the root so it's available on the waitlist homepage and
              every /app/* route (e.g. /app/tutorials/[slug]). */}
          <DrumGapFillAdminPanel />
        </ErrorBoundary>
      </body>
    </html>
  );
}

// Wrapper to handle webkit mock-test environments
function AuthProviderWrapper({ children }: { children: React.ReactNode }) {
  // In webkit under opt-in mock-test mode, bypass AuthProvider to prevent
  // crashes in older specs. Real-auth E2E tests don't set the flag, so
  // AuthProvider runs normally.
  if (isWebkitBrowser() && isMockTestEnv()) {
    logger.info('Webkit mock-test env detected: Bypassing AuthProvider');
    return <>{children}</>;
  }

  return <AuthProvider>{children}</AuthProvider>;
}
