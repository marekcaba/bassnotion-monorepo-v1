import '@/shared/styles/globals.css';
import '@/utils/forceBrowserConsole'; // Force browser console logging
import '@/utils/initializeLogger'; // Initialize logger configuration
import { ReactNode } from 'react';
import { ReactQueryProvider } from '@/lib/react-query';
import { AuthProvider } from '@/domains/user/components/auth';
import { Toaster } from '@/shared/components/ui/toaster';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';
// Phase 1: Remove automatic preloading for better SEO and initial page load
// import { PreloadInitializer } from '@/domains/playback/components/PreloadInitializer';
import { getLogger } from '@/utils/logger.js';
import { AudioDebugPanel } from '@/shared/debug/AudioDebugger';
import { HealthStatus } from '@/shared/components/HealthStatus';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { isMockTestEnv, isWebkitBrowser } from '@/shared/utils/testEnv';
import { ThemedLayout } from './_components/ThemedLayout';
// Phase 5: XState DevTools for visual state machine debugging
import {
  XStateDevToolsProvider,
  XStateDebugPanel,
} from '@/domains/playback/machines';

const logger = getLogger('app');

// Story 3.18.3: Replaced initializeAudio import with AudioProvider component
// The AudioProvider handles all audio initialization with clean dependency injection

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
          {/* Phase 5: XState DevTools Provider wraps entire app for state debugging */}
          <XStateDevToolsProvider showStatus={true}>
            <AudioProvider>
              {/* Phase 1: PreloadInitializer removed - samples will load on user interaction */}
              <AuthProviderWrapper>
                <ReactQueryProvider>
                  <ThemedLayout>{children}</ThemedLayout>
                </ReactQueryProvider>
              </AuthProviderWrapper>
            </AudioProvider>
            <Toaster />
            <AudioDebugPanel />
            <HealthStatus />
            {/* Phase 5: XState Debug Panel - floating UI for quick debugging access */}
            <XStateDebugPanel position="bottom-left" keyboardShortcut="alt+x" />
          </XStateDevToolsProvider>
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
