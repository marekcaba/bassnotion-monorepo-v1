/**
 * useAudioContext Hook - Event-Driven AudioContext State
 *
 * BUG #4 FIX: Replaces polling-based context detection with event-driven updates.
 *
 * This hook provides reactive AudioContext state management:
 * - Subscribes to AudioContextManager's global state change events
 * - Updates React state instantly when context state changes (0ms vs 500ms polling)
 * - Automatically unsubscribes on component unmount
 * - Provides convenient helpers like `isRunning` and `isSuspended`
 *
 * @example
 * ```tsx
 * function AudioComponent() {
 *   const { context, state, isRunning, isSuspended } = useAudioContext();
 *
 *   if (!isRunning) {
 *     return <button onClick={resumeContext}>Enable Audio</button>;
 *   }
 *
 *   return <AudioPlayer context={context} />;
 * }
 * ```
 */

import { useState, useEffect } from 'react';
import { AudioContextManager } from '../modules/audio-engine/core/AudioContextManager.js';
import type { AudioContextState } from '../modules/audio-engine/types/index.js';
import { createStructuredLogger } from '../modules/shared/index.js';

const logger = createStructuredLogger('useAudioContext');

export interface UseAudioContextReturn {
  /** The AudioContext instance (null if not yet created) */
  context: AudioContext | null;
  /** Current state: 'suspended' | 'running' | 'closed' */
  state: AudioContextState | null;
  /** Shorthand for state === 'running' */
  isRunning: boolean;
  /** Shorthand for state === 'suspended' */
  isSuspended: boolean;
  /** Shorthand for state === 'closed' */
  isClosed: boolean;
}

/**
 * Hook to get event-driven AudioContext state
 *
 * BUG #4 FIX: Replaces 500ms polling with instant event-driven updates.
 *
 * @returns AudioContext instance and current state
 */
export function useAudioContext(): UseAudioContextReturn {
  const [context, setContext] = useState<AudioContext | null>(null);
  const [state, setState] = useState<AudioContextState | null>(null);

  useEffect(() => {
    // Get AudioEngine from global CoreServices
    const coreServices = (window as any).__globalCoreServices;

    if (!coreServices) {
      logger.warn(
        'CoreServices not available yet - AudioContext state will be null',
      );
      return;
    }

    const audioEngine = coreServices.getAudioEngine();

    if (!audioEngine) {
      logger.warn(
        'AudioEngine not available yet - AudioContext state will be null',
      );
      return;
    }

    // Get initial context and state
    const initialContext = audioEngine.getContext();
    if (initialContext) {
      setContext(initialContext);
      setState(initialContext.state as AudioContextState);
      logger.debug('Initial AudioContext state', {
        state: initialContext.state,
      });
    }

    // BUG #4 FIX: Subscribe to global state changes (event-driven, not polling!)
    const unsubscribe = AudioContextManager.onGlobalStateChange(
      (newState: AudioContextState) => {
        logger.debug('AudioContext state changed (event-driven)', {
          oldState: state,
          newState,
        });
        setState(newState);

        // Update context reference if it changed
        const currentContext = audioEngine.getContext();
        if (currentContext !== context) {
          setContext(currentContext);
        }
      },
    );

    logger.info('Subscribed to AudioContext state changes');

    // Cleanup: Unsubscribe on unmount
    return () => {
      logger.info('Unsubscribed from AudioContext state changes');
      unsubscribe();
    };
  }, []); // Run once on mount

  return {
    context,
    state,
    isRunning: state === 'running',
    isSuspended: state === 'suspended',
    isClosed: state === 'closed',
  };
}
