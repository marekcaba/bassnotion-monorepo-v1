/**
 * XStateDevToolsProvider - React provider for XState DevTools
 *
 * Phase 5: Provides app-level initialization for XState debugging tools.
 *
 * This provider:
 * - Initializes the browser inspector for visual state debugging
 * - Creates and exposes state history trackers globally
 * - Provides context for child components to access devtools config
 *
 * Usage:
 * Wrap your app (or relevant section) with this provider:
 *
 * ```tsx
 * <XStateDevToolsProvider>
 *   <App />
 * </XStateDevToolsProvider>
 * ```
 *
 * Then in browser console:
 * - window.__xstateInspect() - Opens visual inspector
 * - window.__xstatePlaybackHistory.print() - Shows playback state history
 * - window.__xstatePageInitHistory.printFormatted() - Shows page init history
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useMemo,
} from 'react';
import {
  initXStateDevTools,
  getInspector,
  isDevToolsInitialized,
  createStateHistoryTracker,
  type DevToolsConfig,
  type StateHistoryTracker,
  type Inspector,
} from './devtools.js';

// ============================================================================
// Types
// ============================================================================

export interface XStateDevToolsContextValue {
  /** Whether devtools are enabled */
  enabled: boolean;
  /** Whether devtools have been initialized */
  initialized: boolean;
  /** Get the inspector instance */
  inspector: Inspector<unknown> | null;
  /** Playback machine state history tracker */
  playbackHistory: StateHistoryTracker | null;
  /** Page initialization machine state history tracker */
  pageInitHistory: StateHistoryTracker | null;
  /** Open the visual inspector */
  openInspector: () => void;
}

export interface XStateDevToolsProviderProps {
  children: React.ReactNode;
  /** Configuration options */
  config?: DevToolsConfig;
  /** Show initialization status in console */
  showStatus?: boolean;
}

// ============================================================================
// Context
// ============================================================================

const XStateDevToolsContext = createContext<XStateDevToolsContextValue | null>(
  null,
);

// ============================================================================
// Provider Component
// ============================================================================

/**
 * XStateDevToolsProvider - Initializes and provides XState debugging tools
 *
 * Place this at the app root (e.g., in layout.tsx) to enable debugging.
 * Only active in development mode by default.
 */
export function XStateDevToolsProvider({
  children,
  config,
  showStatus = true,
}: XStateDevToolsProviderProps) {
  const [initialized, setInitialized] = useState(false);
  const playbackHistoryRef = useRef<StateHistoryTracker | null>(null);
  const pageInitHistoryRef = useRef<StateHistoryTracker | null>(null);

  // Determine if enabled (default: development mode)
  const enabled = config?.enabled ?? process.env.NODE_ENV === 'development';

  // Initialize devtools on mount
  useEffect(() => {
    if (!enabled) {
      if (showStatus) {
        console.log('[XState DevTools] Disabled (not in development mode)');
      }
      return;
    }

    // Skip if already initialized
    if (isDevToolsInitialized()) {
      setInitialized(true);
      return;
    }

    // Initialize the devtools
    const inspector = initXStateDevTools(config);

    if (inspector) {
      // Create state history trackers
      playbackHistoryRef.current = createStateHistoryTracker();
      pageInitHistoryRef.current = createStateHistoryTracker();

      // Expose history trackers globally for console debugging
      if (typeof window !== 'undefined') {
        (window as WindowWithXStateHistory).__xstatePlaybackHistory =
          playbackHistoryRef.current;
        (window as WindowWithXStateHistory).__xstatePageInitHistory =
          pageInitHistoryRef.current;
      }

      setInitialized(true);

      if (showStatus) {
        console.log(
          '%c[XState DevTools]%c Provider initialized. Available commands:',
          'color: #7c3aed; font-weight: bold',
          'color: inherit',
        );
        console.log(
          '  window.__xstateInspect()              - Open visual inspector',
        );
        console.log(
          '  window.__xstatePlaybackHistory.print() - Show playback history',
        );
        console.log(
          '  window.__xstatePageInitHistory.print() - Show page init history',
        );
        console.log(
          '  window.__xstateUtils.listActors()      - List registered actors',
        );
      }
    }

    // Cleanup on unmount (in development with StrictMode)
    return () => {
      // Note: We don't uninitialize devtools on unmount because they are
      // global state that persists across component lifecycles
    };
  }, [enabled, config, showStatus]);

  // Memoized context value
  const contextValue = useMemo<XStateDevToolsContextValue>(
    () => ({
      enabled,
      initialized,
      inspector: getInspector(),
      playbackHistory: playbackHistoryRef.current,
      pageInitHistory: pageInitHistoryRef.current,
      openInspector: () => {
        const inspector = getInspector();
        if (inspector) {
          inspector.start();
        } else {
          console.warn('[XState DevTools] Inspector not initialized');
        }
      },
    }),
    [enabled, initialized],
  );

  return (
    <XStateDevToolsContext.Provider value={contextValue}>
      {children}
    </XStateDevToolsContext.Provider>
  );
}

// ============================================================================
// Hook
// ============================================================================

/**
 * useXStateDevTools - Access XState devtools from any component
 *
 * @returns DevTools context value (or null if not within provider)
 *
 * @example
 * ```tsx
 * function DebugButton() {
 *   const devtools = useXStateDevTools();
 *   if (!devtools?.enabled) return null;
 *
 *   return <button onClick={devtools.openInspector}>Open Inspector</button>;
 * }
 * ```
 */
export function useXStateDevTools(): XStateDevToolsContextValue | null {
  return useContext(XStateDevToolsContext);
}

/**
 * useXStateDevToolsRequired - Access XState devtools (throws if not in provider)
 *
 * Use this when you need devtools to be available.
 */
export function useXStateDevToolsRequired(): XStateDevToolsContextValue {
  const context = useContext(XStateDevToolsContext);

  if (!context) {
    throw new Error(
      'useXStateDevToolsRequired must be used within XStateDevToolsProvider',
    );
  }

  return context;
}

// ============================================================================
// Window Type Extension
// ============================================================================

interface WindowWithXStateHistory extends Window {
  __xstatePlaybackHistory?: StateHistoryTracker;
  __xstatePageInitHistory?: StateHistoryTracker;
}

// ============================================================================
// Exports
// ============================================================================

export { XStateDevToolsContext };
