'use client';

/**
 * usePageInitialization - React hook for page initialization state machine
 *
 * Phase 5: Enhanced with DevTools integration
 *
 * This hook provides React integration for the page initialization state machine.
 * It runs alongside existing initialization code for comparison.
 *
 * Features:
 * - Full XState machine integration
 * - DevTools inspector connection for visual debugging
 * - State history tracking with timing metrics
 * - Auto scroll detection for lazy initialization
 * - Shadow mode comparison with real initialization flags
 */

import { useMachine } from '@xstate/react';
import { useEffect, useCallback, useMemo, useRef } from 'react';
import {
  pageInitializationMachine,
  type PageInitContext,
  type PageInitInput,
  type TutorialData,
  type ExerciseData,
} from './pageInitializationMachine.js';
import {
  getInspector,
  isDevToolsInitialized,
  createStateLogger,
  registerActor,
  unregisterActor,
  type StateHistoryTracker,
} from '../../playback/machines/devtools.js';

// ============================================================================
// Types
// ============================================================================

export interface UsePageInitializationOptions {
  tutorial?: TutorialData;
  exercises?: ExerciseData[];
  maxRetries?: number;
  /** Enable shadow mode logging */
  shadowMode?: boolean;
  /** Auto-detect scroll */
  autoDetectScroll?: boolean;
  /** Element selector for scroll detection */
  scrollTriggerSelector?: string;
  /** Enable DevTools inspector connection */
  enableInspector?: boolean;
  /** External state history tracker (from XStateDevToolsProvider) */
  historyTracker?: StateHistoryTracker | null;
}

export interface UsePageInitializationReturn {
  // State
  state: string;
  context: PageInitContext;

  // State checks
  isIdle: boolean;
  isPreInitializing: boolean;
  isDownloadingSamples: boolean;
  isAwaitingGesture: boolean;
  isInitializingAudio: boolean;
  isInjectingBuffers: boolean;
  isReady: boolean;
  isLoadingExercise: boolean;
  isError: boolean;
  isFailed: boolean;
  isDisposing: boolean;
  isDisposed: boolean;

  // Derived state
  isLoading: boolean;
  hasError: boolean;
  loadingProgress: number;
  loadingMessage: string;

  // Actions
  handleScrollDetected: () => void;
  handleUserGesture: () => void;
  handleExerciseSelect: (exerciseId: string) => void;
  handleRetry: () => void;
  handleDispose: () => void;
  setTutorialData: (tutorial: TutorialData, exercises: ExerciseData[]) => void;

  // For debugging
  send: ReturnType<typeof useMachine<typeof pageInitializationMachine>>[1];
  actorRef: ReturnType<typeof useMachine<typeof pageInitializationMachine>>[2];
}

// ============================================================================
// Constants
// ============================================================================

const MACHINE_NAME = 'PageInitMachine';
const logger = createStateLogger(MACHINE_NAME, '#2563eb');

// ============================================================================
// Hook Implementation
// ============================================================================

export function usePageInitialization(
  options: UsePageInitializationOptions = {}
): UsePageInitializationReturn {
  const {
    tutorial,
    exercises,
    maxRetries = 3,
    shadowMode = true,
    autoDetectScroll = true,
    scrollTriggerSelector = '[data-page-init-trigger]',
    enableInspector = true,
    historyTracker,
  } = options;

  // Track if scroll detection has been triggered
  const scrollTriggeredRef = useRef(false);
  // Track previous state for transition logging
  const prevStateRef = useRef<string | null>(null);
  const actorIdRef = useRef<string>(`page-init-${Date.now()}`);

  // Create machine input
  const input: PageInitInput = useMemo(
    () => ({
      tutorial,
      exercises,
      maxRetries,
    }),
    [tutorial, exercises, maxRetries]
  );

  // Get inspector for DevTools connection
  const inspector = enableInspector && isDevToolsInitialized() ? getInspector() : null;

  // Create machine with input and optional inspector
  const [state, send, actorRef] = useMachine(pageInitializationMachine, {
    input,
    inspect: inspector?.inspect,
  });

  // Register actor with DevTools on mount
  useEffect(() => {
    if (actorRef && enableInspector && isDevToolsInitialized()) {
      registerActor(actorIdRef.current, actorRef);
      logger.log(`Actor registered: ${actorIdRef.current}`);
    }

    return () => {
      if (enableInspector && isDevToolsInitialized()) {
        unregisterActor(actorIdRef.current);
      }
    };
  }, [actorRef, enableInspector]);

  // Track state transitions and log to history
  useEffect(() => {
    const currentState = state.value as string;
    const prevState = prevStateRef.current;

    if (prevState && prevState !== currentState) {
      // Log transition
      logger.logTransition(prevState, currentState);

      // Record in history tracker if available
      if (historyTracker) {
        historyTracker.record(currentState, undefined, {
          progress: state.context.progress,
          step: state.context.currentStep,
          userGesture: state.context.userGestureReceived,
        });
      }

      // Also record in global window tracker if available
      if (typeof window !== 'undefined' && (window as WindowWithHistory).__xstatePageInitHistory) {
        (window as WindowWithHistory).__xstatePageInitHistory.record(
          currentState,
          undefined,
          {
            progress: state.context.progress,
            step: state.context.currentStep,
            userGesture: state.context.userGestureReceived,
          }
        );
      }
    }

    prevStateRef.current = currentState;
  }, [state, historyTracker]);

  // Shadow mode logging
  useEffect(() => {
    if (shadowMode) {
      console.log('[PageInit Shadow]', {
        state: state.value,
        progress: state.context.progress,
        step: state.context.currentStep,
        errors: state.context.errors.length,
        userGesture: state.context.userGestureReceived,
      });
    }
  }, [state, shadowMode]);

  // Auto-detect scroll
  useEffect(() => {
    if (!autoDetectScroll || !state.matches('idle') || scrollTriggeredRef.current) {
      return;
    }

    const handleScroll = () => {
      if (!scrollTriggeredRef.current) {
        scrollTriggeredRef.current = true;
        logger.logEvent('SCROLL_DETECTED');
        send({ type: 'SCROLL_DETECTED' });
      }
    };

    // Use IntersectionObserver for efficiency
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          handleScroll();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    // Observe the trigger element
    const triggerElement = document.querySelector(scrollTriggerSelector);
    if (triggerElement) {
      observer.observe(triggerElement);
    }

    // Fallback: scroll event
    const scrollHandler = () => {
      handleScroll();
    };
    window.addEventListener('scroll', scrollHandler, { once: true, passive: true });

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', scrollHandler);
    };
  }, [state, send, autoDetectScroll, scrollTriggerSelector]);

  // State checks
  const isIdle = state.matches('idle');
  const isPreInitializing = state.matches('preInitializing');
  const isDownloadingSamples = state.matches('downloadingSamples');
  const isAwaitingGesture = state.matches('awaitingUserGesture');
  const isInitializingAudio = state.matches('initializingAudio');
  const isInjectingBuffers = state.matches('injectingBuffers');
  const isReady = state.matches('ready');
  const isLoadingExercise = state.matches('loadingExercise');
  const isError = state.matches('error');
  const isFailed = state.matches('failed');
  const isDisposing = state.matches('disposing');
  const isDisposed = state.matches('disposed');

  // Derived state
  const isLoading =
    isPreInitializing ||
    isDownloadingSamples ||
    isInitializingAudio ||
    isInjectingBuffers ||
    isLoadingExercise;

  const hasError = isError || isFailed;

  const loadingProgress = state.context.progress;
  const loadingMessage = state.context.currentStep;

  // Action creators with event logging
  const handleScrollDetected = useCallback(() => {
    logger.logEvent('SCROLL_DETECTED');
    send({ type: 'SCROLL_DETECTED' });
  }, [send]);

  const handleUserGesture = useCallback(() => {
    logger.logEvent('USER_GESTURE');
    send({ type: 'USER_GESTURE' });
  }, [send]);

  const handleExerciseSelect = useCallback(
    (exerciseId: string) => {
      logger.logEvent('EXERCISE_SELECTED', { exerciseId });
      send({ type: 'EXERCISE_SELECTED', exerciseId });
    },
    [send]
  );

  const handleRetry = useCallback(() => {
    logger.logEvent('RETRY');
    send({ type: 'RETRY' });
  }, [send]);

  const handleDispose = useCallback(() => {
    logger.logEvent('DISPOSE');
    send({ type: 'DISPOSE' });
  }, [send]);

  const setTutorialData = useCallback(
    (tutorialData: TutorialData, exercisesData: ExerciseData[]) => {
      logger.logEvent('SET_TUTORIAL_DATA', { tutorialId: tutorialData?.id, exerciseCount: exercisesData?.length });
      send({ type: 'SET_TUTORIAL_DATA', tutorial: tutorialData, exercises: exercisesData });
    },
    [send]
  );

  return {
    // State
    state: state.value as string,
    context: state.context,

    // State checks
    isIdle,
    isPreInitializing,
    isDownloadingSamples,
    isAwaitingGesture,
    isInitializingAudio,
    isInjectingBuffers,
    isReady,
    isLoadingExercise,
    isError,
    isFailed,
    isDisposing,
    isDisposed,

    // Derived state
    isLoading,
    hasError,
    loadingProgress,
    loadingMessage,

    // Actions
    handleScrollDetected,
    handleUserGesture,
    handleExerciseSelect,
    handleRetry,
    handleDispose,
    setTutorialData,

    // For debugging
    send,
    actorRef,
  };
}

// ============================================================================
// Loading Progress Component Helper
// ============================================================================

export interface LoadingProgressProps {
  progress: number;
  message: string;
  hasError: boolean;
  errorMessage?: string;
  canRetry: boolean;
  onRetry: () => void;
}

/**
 * Helper function to get loading progress props from the hook
 */
export function getLoadingProgressProps(
  hookReturn: UsePageInitializationReturn
): LoadingProgressProps {
  const lastError = hookReturn.context.errors[hookReturn.context.errors.length - 1];

  return {
    progress: hookReturn.loadingProgress,
    message: hookReturn.loadingMessage,
    hasError: hookReturn.hasError,
    errorMessage: lastError?.message,
    canRetry: lastError?.recoverable ?? false,
    onRetry: hookReturn.handleRetry,
  };
}

// ============================================================================
// Shadow Mode Comparison
// ============================================================================

/**
 * Compare XState initialization state with real initialization flags
 */
export function useShadowInitComparison(
  machineReady: boolean,
  realFlags: {
    toneLoaded?: boolean;
    coreServicesReady?: boolean;
    samplesReady?: boolean;
    transportReady?: boolean;
  },
  enabled = true
): void {
  useEffect(() => {
    if (!enabled) return;

    const realReady =
      (realFlags.toneLoaded ?? false) &&
      (realFlags.coreServicesReady ?? false) &&
      (realFlags.samplesReady ?? false) &&
      (realFlags.transportReady ?? false);

    if (machineReady !== realReady) {
      console.warn('[PageInit Shadow] Ready state mismatch!', {
        xstateReady: machineReady,
        realReady,
        realFlags,
      });
    }
  }, [machineReady, realFlags, enabled]);
}

// ============================================================================
// Window Type Extension
// ============================================================================

interface WindowWithHistory extends Window {
  __xstatePageInitHistory?: {
    record: (state: string, event?: string, context?: Record<string, unknown>) => void;
  };
}

// ============================================================================
// Exports
// ============================================================================

export type { TutorialData, ExerciseData, PageInitContext };
