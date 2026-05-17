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
import { musicalTruth } from '../modules/tempo/MusicalTruthAuthority.js';
import {
  usePlaybackMachine,
  useShadowComparison,
} from '../machines/usePlaybackMachine.js';

const logger = getLogger('transport');

// Enable/disable XState shadow mode integration
// Set to true to enable XState machine running in parallel for comparison
const XSTATE_SHADOW_MODE_ENABLED = true;

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
  // 🔧 FIX: Initialize tempo from musicalTruth (source of truth) instead of hardcoded 120
  const [tempo, setTempo] = useState(() => musicalTruth.getBPM());
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({
    numerator: 4,
    denominator: 4,
  });
  // Initialize with display format (1-based) - position 0:0:0 displays as 1:1:0
  const [position, setPosition] = useState<TransportPosition>({
    bars: 1,
    beats: 1,
    sixteenths: 0,
    ticks: 0,
    seconds: 0,
  });
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [servicesReady, setServicesReady] = useState(false);

  const transportRef = useRef<UnifiedTransport | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const initRef = useRef(false);

  // FLICKER FIX v10: Store playbackMachine in a ref to avoid handler recreation
  // The handlers use this ref instead of playbackMachine directly, preventing
  // the useEffect from re-running on every playbackMachine state change.
  // This eliminates the brief unsubscribe/resubscribe gap that caused visual flicker.
  const playbackMachineRef = useRef<typeof playbackMachine | null>(null);

  // ============================================================================
  // XSTATE SHADOW MODE INTEGRATION (Phase 3)
  // ============================================================================
  // The XState playbackMachine runs in parallel with the real PlaybackEngine.
  // It receives events mirroring what the real engine does, allowing us to:
  // 1. Validate state transitions
  // 2. Compare states for consistency
  // 3. Gradually migrate to XState as the primary state manager
  // ============================================================================

  // Initialize the XState playback machine in shadow mode
  const playbackMachine = usePlaybackMachine({
    eventBus: eventBusRef.current,
    instanceId: 'transport-context-shadow',
    shadowMode: XSTATE_SHADOW_MODE_ENABLED,
  });

  // FLICKER FIX v10: Keep ref in sync with playbackMachine
  // This allows handlers to access the latest machine state without re-creating
  playbackMachineRef.current = playbackMachine;

  // Map TransportState to XState-compatible state for comparison
  const mapTransportStateToXState = useCallback(
    (transportState: TransportState): string => {
      switch (transportState) {
        case 'playing':
          return 'playing';
        case 'paused':
          return 'paused';
        case 'stopped':
          return 'stopped';
        default:
          return 'idle';
      }
    },
    [],
  );

  // Shadow comparison: Log when XState and real transport states diverge
  useShadowComparison(
    playbackMachine.state,
    mapTransportStateToXState(state),
    XSTATE_SHADOW_MODE_ENABLED,
  );

  // Shadow mode state comparison logging
  const logShadowComparison = useCallback(
    (action: string, realState: TransportState, xstateState: string) => {
      if (!XSTATE_SHADOW_MODE_ENABLED) return;

      const mappedReal = mapTransportStateToXState(realState);

      // Account for XState intermediate/async states:
      // - 'starting' is between ready->playing (valid when real is 'playing')
      // - 'stopping' is between playing->stopped (valid when real is 'stopped')
      // - 'loading' is between idle->ready (valid when initializing)
      // - 'ready' can occur briefly when machine just finished loading or when nothing was playing
      const isMatch =
        mappedReal === xstateState ||
        // START: real='playing', xstate could be 'starting' (async scheduling) or 'ready' (just got event)
        (mappedReal === 'playing' &&
          (xstateState === 'starting' || xstateState === 'ready')) ||
        // STOP: real='stopped', xstate could be 'stopping' (async cleanup), 'playing' (just got event),
        // or 'ready' (stop called before playback started - nothing was playing)
        (mappedReal === 'stopped' &&
          (xstateState === 'stopping' ||
            xstateState === 'playing' ||
            xstateState === 'ready')) ||
        // Machine still loading
        xstateState === 'loading' ||
        // Machine in idle (not yet initialized)
        xstateState === 'idle';

      console.log(`[XState Shadow] ${action}`, {
        realTransportState: realState,
        xstateState: xstateState,
        statesMatch: isMatch,
        timestamp: Date.now(),
      });

      if (!isMatch) {
        console.warn(`[XState Shadow] State mismatch after ${action}!`, {
          expected: mappedReal,
          actual: xstateState,
        });
      }
    },
    [mapTransportStateToXState],
  );

  // Initialize transport and EventBus (runs once)
  useEffect(() => {
    // Prevent double initialization in React Strict Mode
    // IMPORTANT: Only skip if we already have a transport (successful init)
    // Previously, we set initRef.current = true before checking if init succeeded,
    // which caused a race condition where failed init attempts would prevent retries.
    if (initRef.current && transportRef.current) {
      logger.debug('[TransportContext] Already initialized, skipping');
      return;
    }

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
            registry || serviceRegistry || window.__serviceRegistry;
          if (!actualRegistry) {
            logger.debug(
              '[TransportContext] ServiceRegistry not found yet, waiting...',
            );
            return false;
          }

          // Try to get services
          try {
            transportRef.current =
              actualRegistry.get<UnifiedTransport>('unifiedTransport');
          } catch (e) {
            logger.debug(
              '[TransportContext] UnifiedTransport not available in registry yet',
            );
            return false;
          }

          try {
            eventBusRef.current = actualRegistry.get<EventBus>('eventBus');
          } catch (e) {
            logger.debug(
              '[TransportContext] EventBus not available in registry yet',
            );
            return false;
          }
        }

        // Set initial state from transport
        if (transportRef.current) {
          setState(transportRef.current.getState());

          // 🎵 TEMPO FIX v4: Don't overwrite musicalTruth tempo with transport's default (120)!
          // The transport adapter has a default tempo of 120, but musicalTruth may already
          // have the correct exercise tempo (e.g., 69) from TEMPO-PRESEED.
          // Instead of reading from transport, SYNC transport TO musicalTruth.
          const truthTempo = musicalTruth.getBPM();
          const transportTempo = transportRef.current.getTempo();

          console.log(`🎵 [TEMPO-FIX v4] Transport init - syncing tempo`, {
            truthTempo,
            transportTempo,
            willSetTransportTo: truthTempo,
          });

          // Set transport to match musicalTruth (source of truth)
          if (transportTempo !== truthTempo) {
            transportRef.current.setTempo(truthTempo);
          }
          // Keep React state in sync with musicalTruth (not transport)
          setTempo(truthTempo);

          setTimeSignature(transportRef.current.getTimeSignature());

          // Get initial position
          try {
            const initialPosition = transportRef.current.getDisplayPosition();
            logger.info(
              '[TransportContext] Got initial position from transport',
              {
                position: `${initialPosition.bars}:${initialPosition.beats}:${initialPosition.sixteenths}`,
              },
            );
            setPosition(initialPosition);
          } catch (error) {
            // AudioEngine not fully initialized yet, use default position
            logger.info(
              '[TransportContext] Using default position (AudioEngine not ready)',
            );
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

        // Mark services as ready and prevent future re-initialization
        setServicesReady(true);
        initRef.current = true; // Only set after successful init
        logger.info('[TransportContext] Services initialized and ready');

        return true;
      } catch (err) {
        logger.error(
          '[TransportContext] Failed to get transport services:',
          err,
        );
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

  // Subscribe to musicalTruth changes to sync tempo when exercise is selected
  // This ensures TransportContext updates when exercise BPM is set
  useEffect(() => {
    // TEMPO SYNC FIX v3: ALWAYS sync with musicalTruth on mount
    // The useState initializer runs during React's render phase, which may capture
    // a stale value (120 BPM) before the parent component's pre-seed runs.
    const currentTruthBpm = musicalTruth.getBPM();

    // ALWAYS log to help debug timing issues
    console.log(`🎵 [TEMPO-SYNC] TransportContext useEffect mount`, {
      musicalTruthBpm: currentTruthBpm,
    });

    // Force initial sync - use functional update to get current state
    setTempo((prevTempo) => {
      if (prevTempo !== currentTruthBpm) {
        console.log(
          `🎵 [TEMPO-SYNC] TransportContext forcing sync: ${prevTempo} -> ${currentTruthBpm}`,
        );
        return currentTruthBpm;
      }
      console.log(
        `🎵 [TEMPO-SYNC] TransportContext already in sync: ${prevTempo}`,
      );
      return prevTempo;
    });

    // Subscribe to future changes
    const unsubscribe = musicalTruth.subscribe((truth) => {
      console.log(
        `🎵 [TEMPO-SYNC] musicalTruth subscription fired: ${truth.bpm}`,
      );
      setTempo(truth.bpm);
    });

    return unsubscribe;
  }, []); // Empty deps - only run on mount

  // ============================================================================
  // XSTATE SHADOW MODE: Initialize machine when AudioContext becomes available
  // ============================================================================
  // Track if machine has been initialized to avoid duplicate initialization
  const machineInitializedRef = useRef(false);

  useEffect(() => {
    if (!XSTATE_SHADOW_MODE_ENABLED) return;

    const tryInitializeMachine = () => {
      if (machineInitializedRef.current) return; // Already initialized

      // Get AudioContext from CoreServices (the proper way)
      const coreServices = WindowRegistry.getCoreServices();
      if (!coreServices) {
        console.log('[XState Shadow] CoreServices not available yet');
        return;
      }

      // AudioEngine exposes getContext() after full initialization
      // IMPORTANT: Check isReady() BEFORE calling getContext() to avoid throwing
      const audioEngine = coreServices.getAudioEngine?.();
      if (!audioEngine?.isReady?.()) {
        console.log('[XState Shadow] AudioEngine not ready yet');
        return;
      }

      // Safe to call getContext() now that we've verified isReady()
      let audioContext: AudioContext | undefined;
      try {
        audioContext = audioEngine.getContext();
      } catch (error) {
        // AudioEngine may not be fully initialized yet
        console.log(
          '[XState Shadow] getContext() failed, waiting for initialization',
        );
        return;
      }
      const audioDestination = audioContext?.destination;

      // FLICKER FIX v10: Use ref to access machine
      const machine = playbackMachineRef.current;
      if (audioContext && audioDestination && machine) {
        console.log(
          '[XState Shadow] Initializing playback machine with AudioContext from CoreServices',
        );
        machine.initialize(audioContext, audioDestination);
        machineInitializedRef.current = true;

        // Sync initial tempo from musicalTruth
        const currentBpm = musicalTruth.getBPM();
        machine.setTempo(currentBpm);
        console.log('[XState Shadow] Initial tempo set to', currentBpm);
      } else {
        console.log(
          '[XState Shadow] AudioContext not ready yet (need user gesture)',
        );
      }
    };

    // Try immediately if services are ready
    if (servicesReady) {
      tryInitializeMachine();
    }

    // Also listen for audioServicesReady event (fires after user gesture creates AudioContext)
    const handleAudioReady = () => {
      console.log(
        '[XState Shadow] audioServicesReady event received, trying to initialize machine',
      );
      tryInitializeMachine();
    };

    window.addEventListener('audioServicesReady', handleAudioReady);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
    };
  }, [servicesReady]); // FLICKER FIX v10: Removed playbackMachine from dependencies

  // Memoized event handlers to prevent recreation

  // FLICKER FIX: Handler for playback:starting event (fires BEFORE transport:start)
  // This resets position to 0:0:0 (displays as 1:1:0) SYNCHRONOUSLY before any render
  // Prevents fretboard from briefly showing stale position when hitting PLAY
  const handlePlaybackStarting = useCallback((data: { position?: number }) => {
    console.log(
      '[TransportContext] 🎯 FLICKER FIX: Received playback:starting event',
      {
        position: data.position,
        timestamp: Date.now(),
      },
    );

    // Reset position to 0:0:0 (displays as 1:1:0 in UI)
    // This is the position at the START of playback, before any time has elapsed
    setPosition({
      bars: 1,
      beats: 1,
      sixteenths: 0,
      ticks: 0,
      seconds: 0,
    });

    // Also reset the lastPositionRef to prevent spurious "position jump" warnings
    lastPositionRef.current = null;

    logger.info(
      '[TransportContext] 🎯 FLICKER FIX: Position reset to 1:1:0 on playback:starting',
    );
  }, []);

  const handleStart = useCallback(() => {
    logger.debug('[TransportContext] Received transport:start event');

    // FLICKER FIX FALLBACK: Also reset position here in case playback:starting wasn't received
    // This ensures position is 0:0:0 (displays as 1:1:0) when state changes to 'playing'
    setPosition({
      bars: 1,
      beats: 1,
      sixteenths: 0,
      ticks: 0,
      seconds: 0,
    });

    setState('playing');

    // XSTATE SHADOW: Mirror the event to XState machine
    // Note: This may result in duplicate events if start() was called directly,
    // but XState handles idempotent transitions gracefully
    // FLICKER FIX v10: Use ref to avoid handler recreation on playbackMachine changes
    const machine = playbackMachineRef.current;
    if (XSTATE_SHADOW_MODE_ENABLED && machine?.canStart) {
      console.log('[XState Shadow] EventBus: transport:start -> START event');
      machine.start();
    }
  }, []);

  const handleStop = useCallback(() => {
    logger.debug('[TransportContext] Received transport:stop event');
    setState('stopped');

    // FIX: Reset lastPositionRef to prevent spurious "backwards position jump" warning
    // When stopping, the position resets to 1:1:0:0 which would otherwise trigger a
    // backwards jump warning from the previous playback position
    lastPositionRef.current = null;

    // XSTATE SHADOW: Mirror the event to XState machine
    // FLICKER FIX v10: Use ref to avoid handler recreation on playbackMachine changes
    const machine = playbackMachineRef.current;
    if (XSTATE_SHADOW_MODE_ENABLED && machine?.canStop) {
      console.log('[XState Shadow] EventBus: transport:stop -> STOP event');
      machine.stop();
    }
  }, []);

  const handlePause = useCallback(() => {
    logger.debug('[TransportContext] Received transport:pause event');
    setState('paused');

    // XSTATE SHADOW: Mirror the event to XState machine
    // FLICKER FIX v10: Use ref to avoid handler recreation on playbackMachine changes
    const machine = playbackMachineRef.current;
    if (XSTATE_SHADOW_MODE_ENABLED && machine?.canPause) {
      console.log('[XState Shadow] EventBus: transport:pause -> PAUSE event');
      machine.pause();
    }
  }, []);

  const handleResume = useCallback(() => {
    logger.debug('[TransportContext] Received transport:resume event');
    setState('playing');

    // XSTATE SHADOW: Mirror the event to XState machine
    // FLICKER FIX v10: Use ref to avoid handler recreation on playbackMachine changes
    const machine = playbackMachineRef.current;
    if (XSTATE_SHADOW_MODE_ENABLED && machine?.canResume) {
      console.log('[XState Shadow] EventBus: transport:resume -> RESUME event');
      machine.resume();
    }
  }, []);

  const handleTempoChange = useCallback((data: { tempo: number }) => {
    console.log(
      '🎵 [TEMPO DEBUG] TransportContext received tempo change event',
      {
        newTempo: data.tempo,
        timestamp: Date.now(),
      },
    );
    logger.debug('[TransportContext] Received tempo change', {
      tempo: data.tempo,
    });
    setTempo(data.tempo);

    // XSTATE SHADOW: Sync tempo to XState machine
    // FLICKER FIX v10: Use ref to avoid handler recreation on playbackMachine changes
    const machine = playbackMachineRef.current;
    if (XSTATE_SHADOW_MODE_ENABLED && machine) {
      console.log('[XState Shadow] EventBus: tempo change ->', data.tempo);
      machine.setTempo(data.tempo);
    }
  }, []);

  const handleTimeSignatureChange = useCallback(
    (timeSignature: TimeSignature) => {
      logger.debug(
        '[TransportContext] Received time signature change',
        timeSignature,
      );
      setTimeSignature(timeSignature);
    },
    [],
  );

  // Track last position for jitter detection
  const lastPositionRef = useRef<TransportPosition | null>(null);

  const handlePositionUpdate = useCallback(
    (data: {
      position: TransportPosition;
      seconds?: number;
      timestamp?: number;
    }) => {
      // Position updates are already throttled at 60Hz by Transport
      // No additional throttling needed here
      // IMPORTANT: Merge seconds from event data into position object
      // EventBus emits { position: {bars, beats...}, seconds: X } but TransportPosition expects seconds inside
      const pos: TransportPosition = {
        ...data.position,
        seconds: data.seconds ?? data.position.seconds ?? 0,
      };

      const lastPos = lastPositionRef.current;

      // DEBUG: Log position jumps (backwards in time)
      // NOTE: During countdown (negative bars), beats count DOWN using ceil() quantization,
      // which creates intentional backwards steps. These are filtered out below.
      if (lastPos) {
        const lastTotal =
          lastPos.bars * 1000 +
          lastPos.beats * 100 +
          lastPos.sixteenths * 10 +
          (lastPos.ticks || 0) / 48;
        const currentTotal =
          pos.bars * 1000 +
          pos.beats * 100 +
          pos.sixteenths * 10 +
          (pos.ticks || 0) / 48;

        // Skip warning during countdown period (negative bars) - backwards movement is expected
        // as beats count down from 4 to 1 with discrete quantization
        const isInCountdown = pos.bars < 0 || lastPos.bars < 0;

        if (currentTotal < lastTotal - 5 && !isInCountdown) {
          // Allow small jitter
          console.log(
            '[POSITION JUMP] ⚠️ Backwards position detected in TransportContext!',
            {
              from: `${lastPos.bars}:${lastPos.beats}:${lastPos.sixteenths}:${lastPos.ticks}`,
              to: `${pos.bars}:${pos.beats}:${pos.sixteenths}:${pos.ticks}`,
              delta: (currentTotal - lastTotal).toFixed(1),
            },
          );
        }
      }
      lastPositionRef.current = pos;

      setPosition(pos);
    },
    [],
  );

  const handleLoopToggle = useCallback((data: { enabled: boolean }) => {
    logger.debug('[TransportContext] Received loop toggle', {
      enabled: data.enabled,
    });
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

    // Subscribe to all transport events (ONCE for entire app)
    // 🎯 FLICKER FIX: Subscribe to playback:starting FIRST (fires before transport:start)
    // This ensures position is reset to 0:0:0 before any render sees stale position
    const unsubscribePlaybackStarting = eventBus.on(
      'playback:starting',
      handlePlaybackStarting,
    );
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
      logger.info(
        '[TransportContext] Received transport-force-stop window event',
        event.detail,
      );
      setState('stopped');
    };

    window.addEventListener(
      'transport-force-stop',
      handleForceStop as EventListener,
    );

    logger.info(
      '[TransportContext] EventBus subscriptions established (9 total, including playback:starting)',
    );

    // Cleanup subscriptions and window listener
    return () => {
      logger.info('[TransportContext] Cleaning up EventBus subscriptions');
      unsubscribePlaybackStarting();
      unsubscribeStart();
      unsubscribeStop();
      unsubscribePause();
      unsubscribeResume();
      unsubscribeTempo();
      unsubscribeTimeSignature();
      unsubscribePosition();
      unsubscribeLoop();
      window.removeEventListener(
        'transport-force-stop',
        handleForceStop as EventListener,
      );
    };
  }, [
    servicesReady,
    handlePlaybackStarting,
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
  // FLICKER FIX v10: Use playbackMachineRef to avoid unnecessary recreations
  const start = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }

    const machine = playbackMachineRef.current;
    const currentState = transportRef.current.getState();
    if (currentState === 'paused') {
      // XSTATE SHADOW: Send RESUME event before real transport action
      if (XSTATE_SHADOW_MODE_ENABLED && machine) {
        console.log(
          '[XState Shadow] Sending RESUME event (from start, was paused)',
        );
        machine.resume();
      }
      await transportRef.current.resume();
      // XSTATE SHADOW: Log comparison after action
      if (XSTATE_SHADOW_MODE_ENABLED && machine) {
        logShadowComparison('RESUME', 'playing', machine.state);
      }
    } else {
      // XSTATE SHADOW: Send START event before real transport action
      if (XSTATE_SHADOW_MODE_ENABLED && machine) {
        console.log('[XState Shadow] Sending START event');
        machine.start();
      }
      await transportRef.current.start();
      // XSTATE SHADOW: Log comparison after action
      if (XSTATE_SHADOW_MODE_ENABLED && machine) {
        logShadowComparison('START', 'playing', machine.state);
      }
    }
  }, [logShadowComparison]);

  const stop = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }

    const machine = playbackMachineRef.current;
    // XSTATE SHADOW: Send STOP event before real transport action
    if (XSTATE_SHADOW_MODE_ENABLED && machine) {
      console.log('[XState Shadow] Sending STOP event');
      machine.stop();
    }

    await transportRef.current.stop();

    // XSTATE SHADOW: Log comparison after action
    if (XSTATE_SHADOW_MODE_ENABLED && machine) {
      logShadowComparison('STOP', 'stopped', machine.state);
    }
  }, [logShadowComparison]);

  const pause = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }

    const machine = playbackMachineRef.current;
    // XSTATE SHADOW: Send PAUSE event before real transport action
    if (XSTATE_SHADOW_MODE_ENABLED && machine) {
      console.log('[XState Shadow] Sending PAUSE event');
      machine.pause();
    }

    await transportRef.current.pause();

    // XSTATE SHADOW: Log comparison after action
    if (XSTATE_SHADOW_MODE_ENABLED && machine) {
      logShadowComparison('PAUSE', 'paused', machine.state);
    }
  }, [logShadowComparison]);

  const setTempoValue = useCallback(async (bpm: number) => {
    // 🔍 TEMPO DIAGNOSTIC: Log entry point for tempo changes from UI
    const previousBpm = musicalTruth.getBPM();
    console.log(`🎵 [TEMPO-CONTEXT] TransportContext.setTempoValue() called`, {
      requestedBpm: bpm,
      previousMusicalTruthBpm: previousBpm,
    });

    // TEMPO FIX: Use MusicalTruthAuthority as the single source of truth!
    // This ensures ALL tempo changes go through the same code path:
    // 1. Updates musicalTruth.truth.bpm
    // 2. Writes to Tone.Transport.bpm.value
    // 3. Notifies all subscribers (including this context)
    //
    // Previously this called transportRef.current.setTempo(bpm) which
    // bypassed MusicalTruthAuthority and caused tempo inconsistencies.
    musicalTruth.setBPM(bpm);

    // XSTATE SHADOW: Sync tempo to XState machine
    // FLICKER FIX v10: Use ref to avoid handler recreation on playbackMachine changes
    const machine = playbackMachineRef.current;
    if (XSTATE_SHADOW_MODE_ENABLED && machine) {
      console.log('[XState Shadow] Setting tempo to', bpm);
      machine.setTempo(bpm);
    }

    logger.debug(
      `[TransportContext] Tempo set via MusicalTruthAuthority to ${bpm}`,
    );
  }, []);

  const setTimeSignatureValue = useCallback((ts: TimeSignature) => {
    if (!transportRef.current) {
      logger.debug(
        `[TransportContext] Transport not ready yet, cannot set time signature`,
      );
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
  // Handles both proper TimeSignature objects and legacy nested structures
  const safeTimeSignature = useMemo(() => {
    const ts = timeSignature || { numerator: 4, denominator: 4 };

    // Extract numerator - handle both number and nested object cases
    const numValue =
      typeof ts.numerator === 'number'
        ? ts.numerator
        : typeof ts.numerator === 'object' &&
            ts.numerator !== null &&
            'numerator' in ts.numerator
          ? (ts.numerator as { numerator: number }).numerator
          : 4;

    // Extract denominator - handle both number and nested object cases
    const denValue =
      typeof ts.denominator === 'number'
        ? ts.denominator
        : typeof ts.denominator === 'object' &&
            ts.denominator !== null &&
            'denominator' in ts.denominator
          ? (ts.denominator as { denominator: number }).denominator
          : 4;

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

  // PERFORMANCE OPTIMIZATION: Separate stable controls context
  // This context excludes position, so components using useTransportControls()
  // won't re-render on every position update (60Hz during playback)
  const controlsValue = useMemo<TransportControlsValue>(
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
      // NOTE: position is intentionally excluded to prevent 60Hz re-renders
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
      <TransportControlsContext.Provider value={controlsValue}>
        {children}
      </TransportControlsContext.Provider>
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
        'Wrap your component tree with <TransportProvider>...</TransportProvider>',
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

// ============================================================================
// PERFORMANCE OPTIMIZATION HOOKS
// ============================================================================

/**
 * Stable controls context value type - excludes rapidly-changing position
 * Use this for components that need transport controls but not position updates
 */
export interface TransportControlsValue {
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
 * Separate context for stable controls (no position updates)
 * This prevents components from re-rendering on every position update (60Hz)
 */
const TransportControlsContext = createContext<
  TransportControlsValue | undefined
>(undefined);

/**
 * Hook to access transport controls WITHOUT position updates
 *
 * USE THIS for components that need to control playback but don't need
 * real-time position tracking. This prevents 60Hz re-renders.
 *
 * For position tracking, use useTransportPosition() instead.
 *
 * @example
 * // Good - won't re-render on position updates
 * const { start, stop, isPlaying, tempo } = useTransportControls();
 *
 * // Bad - will re-render 60 times/second during playback
 * const { start, stop, isPlaying, tempo, position } = useTransportContext();
 */
export function useTransportControls(): TransportControlsValue {
  const context = useContext(TransportControlsContext);

  if (context === undefined) {
    throw new Error(
      'useTransportControls must be used within a TransportProvider. ' +
        'Wrap your component tree with <TransportProvider>...</TransportProvider>',
    );
  }

  return context;
}

/**
 * Hook to access only transport position updates
 * Use this in components that need position tracking, combined with useTransportControls
 * for other operations.
 */
export function useTransportPosition(): TransportPosition {
  const context = useContext(TransportContext);

  if (context === undefined) {
    throw new Error(
      'useTransportPosition must be used within a TransportProvider. ' +
        'Wrap your component tree with <TransportProvider>...</TransportProvider>',
    );
  }

  return context.position;
}
