/**
 * AudioEnabledTutorial - Universal Audio Integration for Tutorial Pages
 * Enhanced Platform Audio Integration - Phase 2
 *
 * Wraps tutorial pages with full audio capabilities:
 * ✅ Same UnifiedTransport system as test pages
 * ✅ Progressive sample loading via ScrollTriggerLoader (in page.tsx)
 * ✅ Same professional timing/sync features
 * ✅ Same AudioContext management
 * ✅ PLUS existing widget synchronization
 *
 * Works with the unified progressive loading system for optimal performance.
 */

import React, { useEffect, useState, useRef } from 'react';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';
import { YouTubeWidgetPage } from './YouTubeWidgetPage';
import type { Tutorial } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';

// Simple logging function
const log = (message: string, data?: any) => {
  // Only log in debug mode
  if (process.env.NODE_ENV === 'development' && process.env.NEXT_PUBLIC_LOG_LEVEL === 'DEBUG') {
    console.debug(`[AudioEnabledTutorial] ${message}`, data);
  }
};

// Remove global log buffer - not needed in production

interface AudioEnabledTutorialProps {
  tutorialData: Tutorial;
  tutorialSlug: string;
  exercises: any[];
}

/**
 * Inner component that uses EXACT same direct polling as test-unified-transport
 * Bypasses AudioProvider to avoid React StrictMode issues
 */
function AudioEnabledTutorialContent({
  tutorialData,
  tutorialSlug,
  exercises,
}: AudioEnabledTutorialProps) {
  const { correlationId, logger } = useCorrelation(
    'AudioEnabledTutorialContent',
  );

  // Log component mount
  useEffect(() => {
    // Log instead of alert to avoid blocking
    setTimeout(() => {
      logger.debug('AudioEnabledTutorial mounted', { correlationId });
    }, 1000);
  }, []);

  // Debug logging only
  log('Rendering', { tutorialSlug });

  // Use refs for values that don't need to trigger re-renders
  const coreServicesRef = useRef<any>(null);
  const transportRef = useRef<any>(null);
  const isPollingRef = useRef(false);
  const mountedRef = useRef(true);
  const initLogRef = useRef<string[]>([]);

  // Minimal state - only what affects rendering
  const [audioInitialized, setAudioInitialized] = useState(false);

  const addLog = (message: string) => {
    // Use debug level for verbose logs
    logger.debug(message, { correlationId });
  };

  // Initialize core services - EXACT same pattern as test-unified-transport
  useEffect(() => {
    // FAILSAFE: Set initialized after timeout to prevent eternal loading
    const failsafeTimeout = setTimeout(() => {
      if (!audioInitialized) {
        addLog('⚠️ FAILSAFE: Force setting audioInitialized after 5 seconds');
        setAudioInitialized(true);
      }
    }, 5000);

    // Try to get CoreServices if available - Non-blocking async approach
    const checkServices = () => {
      let attempts = 0;
      const maxAttempts = 30;

      // Also listen for the audioServicesReady event
      const serviceReadyHandler = () => {
        addLog('🎉 audioServicesReady event fired!');
      };
      window.addEventListener('audioServicesReady', serviceReadyHandler);

      const pollForServices = () => {
        // Prevent multiple concurrent polls
        if (!mountedRef.current || isPollingRef.current) {
          return;
        }
        isPollingRef.current = true;
        // Debug what's available on window
        if (attempts === 0 || attempts % 5 === 0) {
          addLog(`🔍 Attempt ${attempts + 1}: Checking for CoreServices...`);
          addLog(
            `Global vars: WindowRegistry.getCoreServices()=${!!WindowRegistry.getCoreServices()}`,
          );
        }

        const services = WindowRegistry.getCoreServices();
        if (services) {
          coreServicesRef.current = services;

          try {
            const unifiedTransport = services.getUnifiedTransport();
            transportRef.current = unifiedTransport;

            addLog('✅ CoreServices detected and loaded');

            // Store references globally for debugging
            (window as any).__tutorialCoreServices = services;
            (window as any).__tutorialTransport = unifiedTransport;

            // Only update state once when ready
            if (mountedRef.current) {
              setAudioInitialized(true);
            }

            // Clean up
            window.removeEventListener(
              'audioServicesReady',
              serviceReadyHandler,
            );
            isPollingRef.current = false;
            return;
          } catch (error) {
            // Services not ready yet, continue polling
            if (attempts === 0) {
              addLog('⏳ Waiting for services to initialize...');
            }
          }
        }

        attempts++;
        isPollingRef.current = false;

        if (attempts < maxAttempts && mountedRef.current) {
          setTimeout(pollForServices, 100);
        } else {
          logger.warn(
            '⚠️ CoreServices not found after 30 attempts, proceeding anyway',
            { correlationId },
          );
          if (mountedRef.current) {
            setAudioInitialized(true);
          }
          // Clean up event listener
          window.removeEventListener('audioServicesReady', serviceReadyHandler);
        }
      };

      // Start polling (non-blocking)
      pollForServices();
    };

    // Enable non-blocking service check
    checkServices();

    // Also add console log to verify the component is mounting
    log('🎵 AudioEnabledTutorial mounted and initializing...');

    return () => {
      mountedRef.current = false;
      clearTimeout(failsafeTimeout);
    };
  }, []);

  // Track widget timing events - COMPLETELY DISABLED to prevent re-renders
  // This entire effect was causing state updates on every frame

  // Debug logging
  log('🔍 AudioEnabledTutorial render:', {
    audioInitialized,
    hasCoreServices:
      typeof window !== 'undefined' && !!WindowRegistry.getCoreServices(),
    coreServices: !!coreServicesRef.current,
  });

  // Only show loading state if CoreServices aren't even created yet
  if (!audioInitialized) {
    // Add debug info
    log('⚠️ Still showing loading screen, audioInitialized is false');

    // TEMPORARY FIX: Skip loading screen for debugging
    // return (
    //   <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
    //     <div className="text-center">
    //       <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
    //       <p className="text-white text-lg mb-2">Loading tutorial...</p>
    //       <p className="text-purple-300 text-sm">Initializing audio system</p>
    //       <p className="text-red-400 text-xs mt-4">If stuck here, audio init failed</p>
    //     </div>
    //   </div>
    // );
  }

  // Render tutorial with full audio integration
  return (
    <>
      {/* Tutorial content with full audio integration */}
      <YouTubeWidgetPage
        tutorialData={tutorialData}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </>
  );
}

/**
 * AudioEnabledTutorial - Main wrapper component
 *
 * Uses EXACT same structure as test-unified-transport:
 * 1. AudioProvider at top level (creates CoreServices)
 * 2. Content component inside (polls for CoreServices)
 * 3. Identical to TestUnifiedTransportPage structure
 */
export function AudioEnabledTutorial({
  tutorialData,
  tutorialSlug,
  exercises,
}: AudioEnabledTutorialProps) {
  const { correlationId, logger } = useCorrelation('AudioEnabledTutorial');
  return (
    <AudioProvider>
      <AudioEnabledTutorialContent
        tutorialData={tutorialData}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
      />
    </AudioProvider>
  );
}
