/**
 * XState DevTools Integration - Phase 5
 *
 * This module provides comprehensive debugging tools for XState machines.
 * It integrates with @statelyai/inspect for visual state machine inspection
 * and provides utilities for logging, history tracking, and performance metrics.
 *
 * Features:
 * - Browser inspector integration (opens in new window/iframe)
 * - State transition logging with colored console output
 * - State history tracking with timing metrics
 * - Global window exposure for console debugging
 * - Performance timing for state transitions
 *
 * Usage:
 * 1. Import and call initXStateDevTools() in your app initialization
 * 2. Open browser console and run: window.__xstateInspect() to open inspector
 * 3. Or use the XStateDebugPanel component for quick access
 */

import { createBrowserInspector, type Inspector } from '@statelyai/inspect';
import type { AnyActorRef } from 'xstate';

// ============================================================================
// Configuration
// ============================================================================

export interface DevToolsConfig {
  /** Enable/disable devtools (defaults to development mode) */
  enabled?: boolean;
  /** Auto-start inspector on initialization */
  autoStart?: boolean;
  /** Use iframe instead of popup window */
  useIframe?: boolean;
  /** Iframe URL (if using iframe mode) */
  iframeUrl?: string;
  /** Log state transitions to console */
  logTransitions?: boolean;
  /** Enable state history tracking */
  trackHistory?: boolean;
  /** Max history entries to keep */
  maxHistoryEntries?: number;
}

const DEFAULT_CONFIG: Required<DevToolsConfig> = {
  enabled: process.env.NODE_ENV === 'development',
  autoStart: false,
  useIframe: false,
  iframeUrl: 'https://stately.ai/inspect',
  logTransitions: true,
  trackHistory: true,
  maxHistoryEntries: 200,
};

// ============================================================================
// DevTools State
// ============================================================================

let inspector: Inspector<unknown> | null = null;
let isInitialized = false;
let currentConfig: Required<DevToolsConfig> = { ...DEFAULT_CONFIG };

// Track registered actors for inspection
const registeredActors = new Map<string, AnyActorRef>();

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize XState DevTools
 *
 * Call this once during app initialization (typically in a provider or layout).
 * Only initializes in development mode by default.
 *
 * @param config - DevTools configuration options
 * @returns The inspector instance (or null if disabled/SSR)
 */
export function initXStateDevTools(
  config?: DevToolsConfig,
): Inspector<unknown> | null {
  currentConfig = { ...DEFAULT_CONFIG, ...config };

  if (!currentConfig.enabled || isInitialized) {
    if (isInitialized) {
      console.log('[XState DevTools] Already initialized');
    }
    return inspector;
  }

  if (typeof window === 'undefined') {
    console.log('[XState DevTools] SSR detected, skipping initialization');
    return null;
  }

  try {
    // Create the browser inspector
    inspector = createBrowserInspector({
      autoStart: currentConfig.autoStart,
    });

    // Expose globally for manual triggering
    (window as WindowWithXStateDevTools).__xstateInspector = inspector;
    (window as WindowWithXStateDevTools).__xstateInspect = () => {
      if (inspector) {
        console.log('[XState DevTools] Starting inspector...');
        inspector.start();
        return 'Inspector started - check for new window/tab';
      } else {
        console.warn('[XState DevTools] Inspector not initialized');
        return 'Inspector not initialized';
      }
    };

    isInitialized = true;

    console.log(
      '%c[XState DevTools]%c Initialized successfully',
      'color: #7c3aed; font-weight: bold',
      'color: inherit',
    );
    console.log(
      '%c[XState DevTools]%c Run window.__xstateInspect() to open the visual inspector',
      'color: #7c3aed; font-weight: bold',
      'color: #6b7280',
    );

    return inspector;
  } catch (error) {
    console.warn('[XState DevTools] Failed to initialize:', error);
    return null;
  }
}

/**
 * Get the inspector instance
 *
 * Returns the inspector for use with useMachine() options.
 *
 * @example
 * const [state, send] = useMachine(machine, {
 *   inspect: getInspector()?.inspect
 * });
 */
export function getInspector(): Inspector<unknown> | null {
  return inspector;
}

/**
 * Check if DevTools are initialized
 */
export function isDevToolsInitialized(): boolean {
  return isInitialized;
}

/**
 * Get current DevTools configuration
 */
export function getDevToolsConfig(): Readonly<Required<DevToolsConfig>> {
  return { ...currentConfig };
}

// ============================================================================
// Actor Registration (for manual inspection)
// ============================================================================

/**
 * Register an actor for inspection
 *
 * Use this to manually register actors that were created outside of useMachine.
 *
 * @param id - Unique identifier for the actor
 * @param actor - The XState actor reference
 */
export function registerActor(id: string, actor: AnyActorRef): void {
  registeredActors.set(id, actor);

  if (inspector && currentConfig.logTransitions) {
    console.log(
      `%c[XState DevTools]%c Actor registered: ${id}`,
      'color: #7c3aed; font-weight: bold',
      'color: inherit',
    );
  }
}

/**
 * Unregister an actor
 */
export function unregisterActor(id: string): void {
  registeredActors.delete(id);
}

/**
 * Get all registered actors
 */
export function getRegisteredActors(): Map<string, AnyActorRef> {
  return new Map(registeredActors);
}

// ============================================================================
// State Logging Utilities
// ============================================================================

/**
 * Create a logger for state machine transitions
 *
 * Provides formatted console output for debugging state machines
 * without the full inspector UI.
 *
 * @param machineName - Name to display in logs
 * @param color - CSS color for the machine name (default: purple)
 */
export function createStateLogger(machineName: string, color = '#7c3aed') {
  const prefix = `[${machineName}]`;
  const prefixStyle = `color: ${color}; font-weight: bold`;
  const normalStyle = 'color: inherit';

  return {
    /**
     * Log a state transition
     */
    logTransition: (from: string, to: string, event?: string) => {
      if (!currentConfig.logTransitions) return;

      const eventPart = event ? ` via ${event}` : '';
      console.log(
        `%c${prefix}%c ${from} → ${to}${eventPart}`,
        prefixStyle,
        normalStyle,
      );
    },

    /**
     * Log context changes
     */
    logContext: (context: Record<string, unknown>, label = 'Context') => {
      if (!currentConfig.logTransitions) return;

      console.log(`%c${prefix}%c ${label}:`, prefixStyle, normalStyle, context);
    },

    /**
     * Log an error
     */
    logError: (error: Error | string, step?: string) => {
      const errorMessage = error instanceof Error ? error.message : error;
      const stepPart = step ? ` in ${step}` : '';
      console.error(
        `%c${prefix}%c Error${stepPart}: ${errorMessage}`,
        'color: #dc2626; font-weight: bold',
        normalStyle,
      );
    },

    /**
     * Log an event being sent
     */
    logEvent: (event: string, data?: unknown) => {
      if (!currentConfig.logTransitions) return;

      console.log(
        `%c${prefix}%c Event: ${event}`,
        'color: #2563eb; font-weight: bold',
        normalStyle,
        data ?? '',
      );
    },

    /**
     * Log with custom severity
     */
    log: (
      message: string,
      data?: unknown,
      severity: 'info' | 'warn' | 'debug' = 'info',
    ) => {
      if (!currentConfig.logTransitions) return;

      const method =
        severity === 'warn'
          ? console.warn
          : severity === 'debug'
            ? console.debug
            : console.log;
      method(`%c${prefix}%c ${message}`, prefixStyle, normalStyle, data ?? '');
    },
  };
}

// ============================================================================
// State History Tracking
// ============================================================================

export interface StateHistoryEntry {
  timestamp: number;
  state: string;
  event?: string;
  context?: Record<string, unknown>;
  duration?: number; // Time spent in previous state (ms)
}

export interface StateHistoryTracker {
  record: (
    state: string,
    event?: string,
    context?: Record<string, unknown>,
  ) => void;
  getHistory: () => StateHistoryEntry[];
  getLastN: (n: number) => StateHistoryEntry[];
  clear: () => void;
  print: () => void;
  printFormatted: () => void;
  findState: (stateName: string) => StateHistoryEntry[];
  getStateTimings: () => Record<
    string,
    { totalTime: number; count: number; avgTime: number }
  >;
  getTransitionCount: () => number;
  exportJSON: () => string;
}

/**
 * Create a state history tracker for debugging
 *
 * Tracks state transitions with timestamps and computes timing metrics.
 *
 * @param maxEntries - Maximum history entries to keep (default: 100)
 */
export function createStateHistoryTracker(
  maxEntries = currentConfig.maxHistoryEntries,
): StateHistoryTracker {
  const history: StateHistoryEntry[] = [];

  return {
    /**
     * Record a state transition
     */
    record: (
      state: string,
      event?: string,
      context?: Record<string, unknown>,
    ) => {
      if (!currentConfig.trackHistory) return;

      const now = Date.now();
      const lastEntry = history[history.length - 1];

      // Calculate duration of previous state
      const entry: StateHistoryEntry = {
        timestamp: now,
        state,
        event,
        context: context ? { ...context } : undefined,
      };

      // Add duration to previous entry
      if (lastEntry) {
        lastEntry.duration = now - lastEntry.timestamp;
      }

      history.push(entry);

      // Trim if over limit
      while (history.length > maxEntries) {
        history.shift();
      }
    },

    /**
     * Get all history entries
     */
    getHistory: () => [...history],

    /**
     * Get last N entries
     */
    getLastN: (n: number) => history.slice(-n),

    /**
     * Clear history
     */
    clear: () => {
      history.length = 0;
    },

    /**
     * Print history as table
     */
    print: () => {
      console.table(
        history.map((e) => ({
          time: new Date(e.timestamp).toISOString().split('T')[1],
          state: e.state,
          event: e.event || '-',
          duration: e.duration ? `${e.duration}ms` : '-',
        })),
      );
    },

    /**
     * Print formatted history with visual timeline
     */
    printFormatted: () => {
      console.log(
        '%c=== State History ===',
        'color: #7c3aed; font-weight: bold; font-size: 14px',
      );

      history.forEach((entry, i) => {
        const time = new Date(entry.timestamp)
          .toISOString()
          .split('T')[1]
          .slice(0, 12);
        const eventStr = entry.event ? ` (${entry.event})` : '';
        const durationStr = entry.duration ? ` [${entry.duration}ms]` : '';
        const arrow = i < history.length - 1 ? '↓' : '●';

        console.log(
          `%c${time}%c ${arrow} %c${entry.state}%c${eventStr}${durationStr}`,
          'color: #6b7280',
          'color: #7c3aed',
          'color: #2563eb; font-weight: bold',
          'color: inherit',
        );
      });

      console.log(
        '%c=====================',
        'color: #7c3aed; font-weight: bold',
      );
    },

    /**
     * Find all entries for a specific state
     */
    findState: (stateName: string) => {
      return history.filter((entry) => entry.state === stateName);
    },

    /**
     * Get timing statistics per state
     */
    getStateTimings: () => {
      const timings: Record<
        string,
        { totalTime: number; count: number; avgTime: number }
      > = {};

      for (const entry of history) {
        if (!entry.duration) continue;

        if (!timings[entry.state]) {
          timings[entry.state] = { totalTime: 0, count: 0, avgTime: 0 };
        }

        timings[entry.state].totalTime += entry.duration;
        timings[entry.state].count += 1;
        timings[entry.state].avgTime =
          timings[entry.state].totalTime / timings[entry.state].count;
      }

      return timings;
    },

    /**
     * Get total number of transitions recorded
     */
    getTransitionCount: () => history.length,

    /**
     * Export history as JSON string
     */
    exportJSON: () => JSON.stringify(history, null, 2),
  };
}

// ============================================================================
// Performance Metrics
// ============================================================================

export interface TransitionMetric {
  from: string;
  to: string;
  event: string;
  duration: number;
  timestamp: number;
}

/**
 * Create a transition timing collector
 *
 * Measures the time it takes for state transitions to complete.
 * Useful for identifying slow transitions or performance issues.
 */
export function createTransitionTimer(machineName: string) {
  const metrics: TransitionMetric[] = [];
  let pendingTransition: {
    from: string;
    event: string;
    startTime: number;
  } | null = null;

  return {
    /**
     * Mark the start of a transition (call before sending event)
     */
    startTransition: (from: string, event: string) => {
      pendingTransition = {
        from,
        event,
        startTime: performance.now(),
      };
    },

    /**
     * Mark the end of a transition (call after state changes)
     */
    endTransition: (to: string) => {
      if (!pendingTransition) return;

      const duration = performance.now() - pendingTransition.startTime;
      const metric: TransitionMetric = {
        from: pendingTransition.from,
        to,
        event: pendingTransition.event,
        duration,
        timestamp: Date.now(),
      };

      metrics.push(metric);
      pendingTransition = null;

      // Log slow transitions (>100ms)
      if (duration > 100) {
        console.warn(
          `%c[${machineName}]%c Slow transition: ${metric.from} → ${metric.to} took ${duration.toFixed(2)}ms`,
          'color: #f59e0b; font-weight: bold',
          'color: inherit',
        );
      }
    },

    /**
     * Get all metrics
     */
    getMetrics: () => [...metrics],

    /**
     * Get average transition time per event type
     */
    getAverageByEvent: () => {
      const byEvent: Record<string, { total: number; count: number }> = {};

      for (const metric of metrics) {
        if (!byEvent[metric.event]) {
          byEvent[metric.event] = { total: 0, count: 0 };
        }
        byEvent[metric.event].total += metric.duration;
        byEvent[metric.event].count += 1;
      }

      const result: Record<string, number> = {};
      for (const [event, data] of Object.entries(byEvent)) {
        result[event] = data.total / data.count;
      }

      return result;
    },

    /**
     * Print performance summary
     */
    printSummary: () => {
      console.log(
        `%c[${machineName}] Performance Summary`,
        'color: #7c3aed; font-weight: bold; font-size: 14px',
      );

      const byEvent: Record<string, number[]> = {};
      for (const metric of metrics) {
        if (!byEvent[metric.event]) {
          byEvent[metric.event] = [];
        }
        byEvent[metric.event].push(metric.duration);
      }

      console.table(
        Object.entries(byEvent).map(([event, durations]) => ({
          event,
          count: durations.length,
          min: `${Math.min(...durations).toFixed(2)}ms`,
          max: `${Math.max(...durations).toFixed(2)}ms`,
          avg: `${(durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2)}ms`,
        })),
      );
    },

    /**
     * Clear metrics
     */
    clear: () => {
      metrics.length = 0;
      pendingTransition = null;
    },
  };
}

// ============================================================================
// TypeScript Declarations for Window Extensions
// ============================================================================

interface WindowWithXStateDevTools extends Window {
  __xstateInspector?: Inspector<unknown>;
  __xstateInspect?: () => string;
  __xstateUtils?: {
    initDevTools: typeof initXStateDevTools;
    getInspector: typeof getInspector;
    isInitialized: typeof isDevToolsInitialized;
    getConfig: typeof getDevToolsConfig;
    createStateLogger: typeof createStateLogger;
    createStateHistoryTracker: typeof createStateHistoryTracker;
    createTransitionTimer: typeof createTransitionTimer;
    getRegisteredActors: typeof getRegisteredActors;
    // Quick access methods
    openInspector: () => string;
    listActors: () => void;
  };
  __xstatePlaybackHistory?: StateHistoryTracker;
  __xstatePageInitHistory?: StateHistoryTracker;
}

// ============================================================================
// Global Exposure for Debugging
// ============================================================================

if (typeof window !== 'undefined') {
  // Expose utilities globally for console debugging
  (window as WindowWithXStateDevTools).__xstateUtils = {
    initDevTools: initXStateDevTools,
    getInspector,
    isInitialized: isDevToolsInitialized,
    getConfig: getDevToolsConfig,
    createStateLogger,
    createStateHistoryTracker,
    createTransitionTimer,
    getRegisteredActors,
    // Quick access methods
    openInspector: () => {
      if (inspector) {
        inspector.start();
        return 'Inspector opened';
      }
      return 'Inspector not initialized. Call window.__xstateUtils.initDevTools() first.';
    },
    listActors: () => {
      const actors = getRegisteredActors();
      if (actors.size === 0) {
        console.log('No actors registered');
        return;
      }
      console.log(
        `%cRegistered Actors (${actors.size}):`,
        'color: #7c3aed; font-weight: bold',
      );
      actors.forEach((actor, id) => {
        const snapshot = actor.getSnapshot();
        console.log(`  ${id}: ${JSON.stringify(snapshot.value)}`);
      });
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export { createBrowserInspector, type Inspector };
