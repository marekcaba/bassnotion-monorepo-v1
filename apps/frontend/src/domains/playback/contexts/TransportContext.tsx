/**
 * TransportContext - Centralized Transport State Management
 *
 * Provides a single subscription layer to Transport events, shared across all
 * consuming components. Reduces event subscriptions from N×8 to 1×8 where N is
 * the number of components using transport.
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

// Context value type
export interface TransportContextValue {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  tempo: number;
  timeSignature: TimeSignature;
  position: TransportPosition;
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

// Create context with undefined default (requires provider)
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
    if (initRef.current) return;
    initRef.current = true;

    const initializeTransport = () => {
      try {
        // Try CoreServices first (new approach)
        const coreServices = WindowRegistry.getCoreServices();
        if (coreServices) {
          transportRef.current = coreServices.getUnifiedTransport();
          eventBusRef.current = coreServices.getEventBus();
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
          setState(transportRef.current.getState());
          setTempo(transportRef.current.getTempo());
          setTimeSignature(transportRef.current.getTimeSignature());

          // Get initial position
          try {
            const initialPosition = transportRef.current.getDisplayPosition();
            logger.info('[TransportContext] Got initial position from transport', {
              position: `${initialPosition.bars}:${initialPosition.beats}:${initialPosition.sixteenths}`,
            });
            setPosition(initialPosition);
          } catch (error) {
            // AudioEngine not fully initialized yet, use default position
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
        logger.info('[TransportContext] Services initialized and ready');

        return true;
      } catch (err) {
        logger.error('[TransportContext] Failed to get transport services:', err);
        return false;
      }
    };

    // Try immediately
    if (!initializeTransport()) {
      // Wait for audioServicesReady event
      const handleReady = () => {
        logger.info('[TransportContext] Received audioServicesReady event');
        initializeTransport();
      };

      window.addEventListener('audioServicesReady', handleReady);

      return () => {
        window.removeEventListener('audioServicesReady', handleReady);
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
    if (!transportRef.current) {
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
        throw new Error('Transport not available');
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

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<TransportContextValue>(
    () => ({
      isPlaying: state === 'playing',
      isPaused: state === 'paused',
      isStopped: state === 'stopped',
      tempo,
      timeSignature: safeTimeSignature,
      position,
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
      position,
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

  return (
    <TransportContext.Provider value={contextValue}>
      {children}
    </TransportContext.Provider>
  );
}

/**
 * Hook to access transport state and controls from context
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
 */
export function useTransport() {
  return useTransportContext();
}
