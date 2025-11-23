'use client';

/**
 * CoreServicesGate - Prevents rendering until CoreServices is ready
 *
 * ✅ BUG #1 FIX: Race Condition Prevention
 *
 * This component acts as a gate that suspends rendering of children
 * until CoreServices is fully initialized. This prevents race conditions
 * where components try to use CoreServices before it's ready.
 *
 * Usage:
 * ```tsx
 * <CoreServicesGate>
 *   <AudioEnabledComponent />
 * </CoreServicesGate>
 * ```
 */

import React from 'react';
import { useAudioServices } from '../providers/AudioProvider.js';

interface CoreServicesGateProps {
  children: React.ReactNode;
  /** Optional loading component to show while waiting */
  fallback?: React.ReactNode;
  /** Optional error component to show if initialization fails */
  errorFallback?: (error: Error) => React.ReactNode;
}

export function CoreServicesGate({
  children,
  fallback,
  errorFallback,
}: CoreServicesGateProps) {
  const { coreServicesReady, error, coreServices } = useAudioServices();

  // Show error if initialization failed
  if (error) {
    if (errorFallback) {
      return <>{errorFallback(error)}</>;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-red-600">
          Failed to initialize audio system: {error.message}
        </div>
      </div>
    );
  }

  // Show loading state while CoreServices initializes
  if (!coreServicesReady || !coreServices) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-muted-foreground">
          Initializing audio system...
        </div>
      </div>
    );
  }

  // CoreServices is ready - render children
  return <>{children}</>;
}

/**
 * Hook version for conditional rendering
 *
 * Usage:
 * ```tsx
 * const { isReady, error } = useCoreServicesReady();
 *
 * if (!isReady) return <Loading />;
 * if (error) return <Error error={error} />;
 *
 * return <AudioComponent />;
 * ```
 */
export function useCoreServicesReady() {
  const { coreServicesReady, error, coreServices } = useAudioServices();

  return {
    isReady: coreServicesReady && !!coreServices,
    error,
    coreServices,
  };
}
