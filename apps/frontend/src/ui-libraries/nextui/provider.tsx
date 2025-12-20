'use client';

/**
 * NextUI Provider Wrapper
 *
 * Provides NextUI context only when the NextUI library is active.
 * Lazy-loads NextUI to reduce bundle size when not in use.
 */

import React, { Suspense, lazy } from 'react';
import { useUIZoneSafe } from '@/shared/theming';

// Lazy load NextUI provider to reduce initial bundle
const NextUIProvider = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.NextUIProvider }))
);

interface NextUIZoneProviderProps {
  children: React.ReactNode;
}

/**
 * Wraps children with NextUI provider when NextUI library is active
 */
export function NextUIZoneProvider({ children }: NextUIZoneProviderProps) {
  const zone = useUIZoneSafe();

  // If not in a zone or not using NextUI, render children directly
  if (!zone || zone.config.library !== 'nextui') {
    return <>{children}</>;
  }

  return (
    <Suspense fallback={<>{children}</>}>
      <NextUIProvider>
        <div className="nextui-zone dark">{children}</div>
      </NextUIProvider>
    </Suspense>
  );
}
