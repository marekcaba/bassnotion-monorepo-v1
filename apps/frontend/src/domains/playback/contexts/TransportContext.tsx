/**
 * TransportContext - Centralized Transport State Management
 *
 * Provides a single subscription layer to Transport events, shared across all
 * consuming components. Reduces event subscriptions from N×8 to 1×8 where N is
 * the number of components using transport.
 *
 * PERFORMANCE OPTIMIZATION (Dec 2024):
 * Split into two contexts to prevent 60Hz re-renders across all consumers:
 * - TransportStateContext: Slow-changing state (isPlaying, tempo, etc.)
 * - TransportPositionContext: Fast-changing position (60Hz updates)
 *
 * Components that don't need position should use useTransportState() to avoid
 * re-rendering at 60Hz.
 *
 * Benefits:
 * - Single EventBus subscription (8 events instead of 56+)
 * - Reduced position updates (60Hz instead of 420Hz across all components)
 * - Guaranteed state synchronization across all widgets
 * - Better React Strict Mode handling
 * - Easier debugging with centralized subscription point
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { serviceRegistry } from '../services/core/ServiceRegistry.js';
import {
  UnifiedTransport,
  TransportState,
  TransportPosition,
} from '../services/core/index.js';
import { EventBus } from '../services/core/EventBus.js';
import type { ServiceRegistry } from '../services/core/ServiceRegistry.js';
import type {
  TimeSignature,
  MusicalPosition,
} from '@bassnotion/contracts/types/musical-time';
import { getLogger } from '@/utils/logger.js';
import { WindowRegistry } from '../services/WindowRegistry.js';

const logger = getLogger('transport');

// ============================================================================
// SPLIT CONTEXT TYPES
// ============================================================================

/**
 * State context - contains slow-changing values
 * Components using only this won't re-render at 60Hz
 */
export interface TransportStateContextValue {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  tempo: number;
  timeSignature: TimeSignature;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  setTempo: (bpm: number) => Promise<void>;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  seekTo: (position: MusicalPosition | number) => Promise<void>;
  setLoop: (start: number, end: number) => Promise<void>;
  setExerciseDuration: (totalBars: number, beatsPerBar: number) => void;
  isLoopEnabled: boolean;
  servicesReady: boolean;
}

/**
 * Position context - contains fast-changing position (60Hz)
 * Only components that need position should subscribe
 */
export interface TransportPositionContextValue {
  position: TransportPosition;
}

// Legacy combined type for backward compatibility
export interface TransportContextValue extends TransportStateContextValue {
  position: TransportPosition;
}

// Create separate contexts
const TransportStateContext = createContext<TransportStateContextValue | undefined>(
  undefined,
);

const TransportPositionContext = createContext<TransportPositionContextValue | undefined>(
  undefined,
);

// Legacy combined context (for backward compatibility)
const TransportContext = createContext<TransportContextValue | undefined>(
  undefined,
);

// Provider props
export interface TransportProviderProps {
  children: React.ReactNode;
  registry?: ServiceRegistry;
}

/**
 * TransportProvider - Manages single Transport subscription
 *
 * Should be placed at the page/route level to wrap all components
 * that need transport state.
 */
export function TransportProvider({
  children,
  registry,
}: TransportProviderProps) {
  const [state, setState] = useState<TransportState>('stopped');
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({
    numerator: 4,
    denominator: 4,
  });
  const [position, setPosition] = useState<TransportPosition>({
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
    seconds: 0,
  });
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [servicesReady, setServicesReady] = useState(false);

  const transportRef = useRef<UnifiedTransport | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const initRef = useRef(false);

  // Initialize transport and EventBus (runs once)
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    if (initRef.current) {
      return;
    }
    initRef.current = true;

    logger.info('[TransportContext] useEffect starting initialization...');

    // Track if initialization succeeded to stop polling
    let initSucceeded = false;

    const initializeTransport = (): boolean => {
      console.log('🔧 [TransportContext] initializeTransport() CALLED', {
        hasTransportRef: !!transportRef.current,
        hasEventBusRef: !!eventBusRef.current,
      });

      // Guard: already initialized - don't set state again
      if (transportRef.current && eventBusRef.current) {
        logger.debug('[TransportContext] Already initialized, skipping');
        return true;
      }

      try {
        // Try CoreServices first (new approach)
        const coreServices = WindowRegistry.getCoreServices();
        console.log('🔧 [TransportContext] CoreServices check:', { hasCoreServices: !!coreServices });
        if (coreServices) {
          transportRef.current = coreServices.getUnifiedTransport();
          eventBusRef.current = coreServices.getEventBus();
          console.log('🔧 [TransportContext] Got EventBus from CoreServices', {
            eventBusId: (eventBusRef.current as any)?._instanceId || 'no-id',
          });
          logger.info('[TransportContext] Got services from CoreServices');
        } else {
          // Fallback to registry
          const actualRegistry =
            registry || serviceRegistry || (window as any).__serviceRegistry;
          if (!actualRegistry) {
            logger.debug('[TransportContext] ServiceRegistry not found yet, waiting...');
            return false;
          }

          // Try to get services
          try {
            transportRef.current =
              actualRegistry.get<UnifiedTransport>('unifiedTransport');
          } catch (e) {
            logger.debug('[TransportContext] UnifiedTransport not available in registry yet');
            return false;
          }

          try {
            eventBusRef.current = actualRegistry.get<EventBus>('eventBus');
          } catch (e) {
            logger.debug('[TransportContext] EventBus not available in registry yet');
            return false;
          }
        }

        // Set initial state from transport
        if (transportRef.current) {
          const initialState = transportRef.current.getState();
          const initialTempo = transportRef.current.getTempo();
          const initialTimeSignature = transportRef.current.getTimeSignature();

          console.log('🔧 [TransportContext] Setting initial state from transport', {
            state: initialState,
            tempo: initialTempo,
            timeSignature: initialTimeSignature,
          });

          setState(initialState);
          setTempo(initialTempo);
          setTimeSignature(initialTimeSignature);

          // Get initial position
          try {
            const initialPosition = transportRef.current.getDisplayPosition();
            console.log('🔧 [TransportContext] Got initial position from transport', {
              position: `${initialPosition.bars}:${initialPosition.beats}:${initialPosition.sixteenths}`,
            });
            logger.info('[TransportContext] Got initial position from transport', {
              position: `${initialPosition.bars}:${initialPosition.beats}:${initialPosition.sixteenths}`,
            });
            setPosition(initialPosition);
          } catch (error) {
            // AudioEngine not fully initialized yet, use default position
            console.log('🔧 [TransportContext] Using default position (AudioEngine not ready)', error);
            logger.info('[TransportContext] Using default position (AudioEngine not ready)');
            setPosition({
              bars: 1,
              beats: 1,
              sixteenths: 0,
              ticks: 0,
              seconds: 0,
            });
          }

          setIsLoopEnabled(transportRef.current.isLoopEnabled());
        }

        // Mark services as ready
        setServicesReady(true);
        initSucceeded = true;
        logger.info('[TransportContext] Services initialized and ready');

        return true;
      } catch (err) {
        logger.error('[TransportContext] Failed to get transport services:', err);
        return false;
      }
    };

    // Try immediately
    const immediateResult = initializeTransport();

    if (!immediateResult) {
      logger.info('[TransportContext] Waiting for audioServicesReady event...');

      // Wait for audioServicesReady event
      const handleReady = () => {
        if (initSucceeded) return; // Already initialized
        logger.info('[TransportContext] Received audioServicesReady event');
        initializeTransport();
      };

      window.addEventListener('audioServicesReady', handleReady);

      // Polling fallback with proper guards to prevent infinite loops
      let pollCount = 0;
      const maxPolls = 20; // 10 seconds max
      const pollInterval = setInterval(() => {
        // Guard 1: Already succeeded
        if (initSucceeded || transportRef.current) {
          clearInterval(pollInterval);
          return;
        }

        pollCount++;

        // Guard 2: Max polls reached
        if (pollCount >= maxPolls) {
          logger.warn('[TransportContext] Polling timed out after 10 seconds');
          clearInterval(pollInterval);
          return;
        }

        const coreServices = WindowRegistry.getCoreServices();
        if (coreServices) {
          const pollResult = initializeTransport();
          if (pollResult) {
            logger.info('[TransportContext] Polling init succeeded');
            clearInterval(pollInterval);
          }
        }
      }, 500);

      return () => {
        window.removeEventListener('audioServicesReady', handleReady);
        clearInterval(pollInterval);
      };
    }
  }, [registry]);

  // Memoized event handlers to prevent recreation
  const handleStart = useCallback(() => {
    logger.debug('[TransportContext] Received transport:start event');
    setState('playing');
  }, []);

  const handleStop = useCallback(() => {
    logger.debug('[TransportContext] Received transport:stop event');
    setState('stopped');
  }, []);

  const handlePause = useCallback(() => {
    logger.debug('[TransportContext] Received transport:pause event');
    setState('paused');
  }, []);

  const handleResume = useCallback(() => {
    logger.debug('[TransportContext] Received transport:resume event');
    setState('playing');
  }, []);

  const handleTempoChange = useCallback((data: { tempo: number }) => {
    // [TEMPO-DEBUG] logs commented out after fix verification
    // console.log('[TEMPO-DEBUG] Step 9: TransportContext received tempo-change event', {...});
    logger.debug('[TransportContext] Received tempo change', { tempo: data.tempo });
    setTempo(data.tempo);
  }, []);

  const handleTimeSignatureChange = useCallback(
    (timeSignature: TimeSignature) => {
      logger.debug('[TransportContext] Received time signature change', timeSignature);
      setTimeSignature(timeSignature);
    },
    [],
  );

  const handlePositionUpdate = useCallback(
    (data: { position: TransportPosition }) => {
      // Position updates are already throttled at 60Hz by Transport
      // No additional throttling needed here

      // DIAGNOSTIC: Log position updates
      if (Math.random() < 0.05) { // 5% sample rate
        console.log('📍 [TransportContext] handlePositionUpdate received', {
          bars: data.position?.bars,
          beats: data.position?.beats,
          sixteenths: data.position?.sixteenths,
          timestamp: Date.now(),
        });
      }

      setPosition(data.position);
    },
    [],
  );

  const handleLoopToggle = useCallback((data: { enabled: boolean }) => {
    logger.debug('[TransportContext] Received loop toggle', { enabled: data.enabled });
    setIsLoopEnabled(data.enabled);
  }, []);

  // Subscribe to transport events (SINGLE subscription for all consumers)
  useEffect(() => {
    if (!eventBusRef.current || !transportRef.current) {
      logger.debug('[TransportContext] Waiting for EventBus and Transport...', {
        hasEventBus: !!eventBusRef.current,
        hasTransport: !!transportRef.current,
      });
      return;
    }

    const eventBus = eventBusRef.current;
    console.log('🔔 [TransportContext] Setting up EventBus subscription', {
      eventBusId: (eventBus as any)._instanceId || 'no-id',
      timestamp: Date.now(),
    });
    logger.info('[TransportContext] Setting up single EventBus subscription');

    // Subscribe to all 8 transport events (ONCE for entire app)
    const unsubscribeStart = eventBus.on('transport:start', handleStart);
    const unsubscribeStop = eventBus.on('transport:stop', handleStop);
    const unsubscribePause = eventBus.on('transport:pause', handlePause);
    const unsubscribeResume = eventBus.on('transport:resume', handleResume);
    const unsubscribeTempo = eventBus.on(
      'transport:tempo-change',
      handleTempoChange,
    );
    const unsubscribeTimeSignature = eventBus.on(
      'transport:time-signature-change',
      handleTimeSignatureChange,
    );
    const unsubscribePosition = eventBus.on(
      'transport:position-updated',
      handlePositionUpdate,
    );
    const unsubscribeLoop = eventBus.on(
      'transport:loop-change',
      handleLoopToggle,
    );

    // Add backup window event listener for force-stop
    const handleForceStop = (event: CustomEvent) => {
      logger.info('[TransportContext] Received transport-force-stop window event', event.detail);
      setState('stopped');
    };

    window.addEventListener('transport-force-stop', handleForceStop as EventListener);

    logger.info('[TransportContext] EventBus subscriptions established (8 total)');

    // Cleanup subscriptions and window listener
    return () => {
      logger.info('[TransportContext] Cleaning up EventBus subscriptions');
      unsubscribeStart();
      unsubscribeStop();
      unsubscribePause();
      unsubscribeResume();
      unsubscribeTempo();
      unsubscribeTimeSignature();
      unsubscribePosition();
      unsubscribeLoop();
      window.removeEventListener('transport-force-stop', handleForceStop as EventListener);
    };
  }, [
    servicesReady,
    handleStart,
    handleStop,
    handlePause,
    handleResume,
    handleTempoChange,
    handleTimeSignatureChange,
    handlePositionUpdate,
    handleLoopToggle,
  ]);

  // Transport control callbacks (memoized)
  const start = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }

    const currentState = transportRef.current.getState();
    if (currentState === 'paused') {
      await transportRef.current.resume();
    } else {
      await transportRef.current.start();
    }
  }, []);

  const stop = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.stop();
  }, []);

  const pause = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.pause();
  }, []);

  const setTempoValue = useCallback(async (bpm: number) => {
    // [TEMPO-DEBUG] logs commented out after fix verification
    // console.log('[TEMPO-DEBUG] Step 2: TransportContext.setTempoValue()', {...});

    if (!transportRef.current) {
      // console.warn('[TEMPO-DEBUG] Step 2 WARNING: Transport not ready!');
      logger.debug(`[TransportContext] Transport not ready yet, cannot set tempo to ${bpm}`);
      return;
    }

    await transportRef.current.setTempo(bpm);
  }, []);

  const setTimeSignatureValue = useCallback((ts: TimeSignature) => {
    if (!transportRef.current) {
      logger.debug(`[TransportContext] Transport not ready yet, cannot set time signature`);
      return;
    }
    transportRef.current.setTimeSignature(ts);
  }, []);

  const seekTo = useCallback(async (pos: MusicalPosition | number) => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.seekTo(pos);
  }, []);

  const setLoop = useCallback(async (start: number, end: number) => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.setLoop(start, end);
  }, []);

  const setExerciseDuration = useCallback(
    (totalBars: number, beatsPerBar: number) => {
      if (!transportRef.current) {
        // Defensive: Return early instead of throwing during initialization race
        logger.debug(
          '[TransportContext] Transport not ready yet, cannot set exercise duration',
        );
        return;
      }
      if (typeof transportRef.current.setExerciseDuration === 'function') {
        transportRef.current.setExerciseDuration(totalBars, beatsPerBar);
      } else {
        logger.warn(
          '[TransportContext] setExerciseDuration not available on transport instance',
        );
      }
    },
    [],
  );

  // Safe timeSignature with toString method
  const safeTimeSignature = useMemo(() => {
    const ts = timeSignature || { numerator: 4, denominator: 4 };

    const numValue = typeof ts.numerator === 'number' ? ts.numerator : (ts.numerator as any)?.numerator || 4;
    const denValue = typeof ts.denominator === 'number' ? ts.denominator : (ts.denominator as any)?.denominator || 4;

    const safe: TimeSignature & { toString(): string } = {
      numerator: numValue,
      denominator: denValue,
      toString: () => `${numValue}/${denValue}`,
    };

    return safe;
  }, [timeSignature]);

  // ============================================================================
  // SPLIT CONTEXT VALUES - Prevents 60Hz re-renders for non-position consumers
  // ============================================================================

  // State context - SLOW changing (only on play/stop/tempo changes)
  // Components using useTransportState() won't re-render at 60Hz
  const stateContextValue = useMemo<TransportStateContextValue>(
    () => ({
      isPlaying: state === 'playing',
      isPaused: state === 'paused',
      isStopped: state === 'stopped',
      tempo,
      timeSignature: safeTimeSignature,
      start,
      stop,
      pause,
      setTempo: setTempoValue,
      setTimeSignature: setTimeSignatureValue,
      seekTo,
      setLoop,
      setExerciseDuration,
      isLoopEnabled,
      servicesReady,
    }),
    [
      state,
      tempo,
      safeTimeSignature,
      start,
      stop,
      pause,
      setTempoValue,
      setTimeSignatureValue,
      seekTo,
      setLoop,
      setExerciseDuration,
      isLoopEnabled,
      servicesReady,
    ],
  );

  // Position context - FAST changing (60Hz during playback)
  // Only components that need position should use useTransportPosition()
  const positionContextValue = useMemo<TransportPositionContextValue>(
    () => ({ position }),
    [position],
  );

  // Legacy combined context for backward compatibility
  // WARNING: Using useTransportContext() will re-render at 60Hz!
  const contextValue = useMemo<TransportContextValue>(
    () => ({
      ...stateContextValue,
      position,
    }),
    [stateContextValue, position],
  );

  return (
    <TransportStateContext.Provider value={stateContextValue}>
      <TransportPositionContext.Provider value={positionContextValue}>
        <TransportContext.Provider value={contextValue}>
          {children}
        </TransportContext.Provider>
      </TransportPositionContext.Provider>
    </TransportStateContext.Provider>
  );
}

// ============================================================================
// HOOKS - Use the appropriate hook based on what you need
// ============================================================================

/**
 * Hook to access transport STATE only (no position)
 *
 * USE THIS for components that don't need position updates!
 * This hook will NOT re-render at 60Hz during playback.
 *
 * Includes: isPlaying, isPaused, isStopped, tempo, timeSignature, controls
 * Excludes: position (use useTransportPosition for that)
 *
 * @throws Error if used outside TransportProvider
 */
export function useTransportState(): TransportStateContextValue {
  const context = useContext(TransportStateContext);

  if (context === undefined) {
    throw new Error(
      'useTransportState must be used within a TransportProvider. ' +
      'Wrap your component tree with <TransportProvider>...</TransportProvider>'
    );
  }

  return context;
}

/**
 * Hook to access transport POSITION only
 *
 * Use this when you ONLY need position and nothing else.
 * WARNING: This will re-render at 60Hz during playback!
 *
 * @throws Error if used outside TransportProvider
 */
export function useTransportPosition(): TransportPositionContextValue {
  const context = useContext(TransportPositionContext);

  if (context === undefined) {
    throw new Error(
      'useTransportPosition must be used within a TransportProvider. ' +
      'Wrap your component tree with <TransportProvider>...</TransportProvider>'
    );
  }

  return context;
}

/**
 * Hook to access ALL transport state and controls from context
 *
 * WARNING: This hook will re-render at 60Hz during playback because it
 * includes position! Consider using useTransportState() instead if you
 * don't need position updates.
 *
 * @throws Error if used outside TransportProvider
 */
export function useTransportContext(): TransportContextValue {
  const context = useContext(TransportContext);

  if (context === undefined) {
    throw new Error(
      'useTransportContext must be used within a TransportProvider. ' +
      'Wrap your component tree with <TransportProvider>...</TransportProvider>'
    );
  }

  return context;
}

/**
 * Hook variant that matches the old useTransport API exactly
 * This is for backward compatibility during migration
 *
 * WARNING: Re-renders at 60Hz! Use useTransportState() for better performance.
 */
export function useTransport() {
  return useTransportContext();
}
