'use client';

/**
 * usePlaybackControl Hook
 *
 * Manages playback control logic for the GlobalControls component including:
 * - Play/stop button handling
 * - Sample and buffer readiness checks
 * - AudioContext initialization
 * - Track registration with PlaybackEngine
 * - Countdown and transport coordination
 *
 * This hook extracts the complex ~760 line handlePlayButtonClick function
 * from GlobalControls.tsx into a reusable, testable unit.
 */

import { useCallback, useRef, useState } from 'react';
import type { MusicalExercise as Exercise } from '@bassnotion/contracts';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority';
import { getLogger } from '@/utils/logger.js';
import {
  normalizeDrumTypeToBufferKey,
  getTone,
} from '../utils/drum-utilities.js';

const logger = getLogger('usePlaybackControl');

/**
 * Transport interface for playback control
 */
export interface PlaybackControlTransport {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  tempo: number;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  setTimeSignature: (numerator: number, denominator: number) => void;
  getTempo?: () => number;
}

/**
 * Track interface for playback control
 */
export interface PlaybackControlTrack {
  isInitialized: boolean;
  isReady: boolean;
  regions: any[];
  track?: {
    id: string;
    regions: any[];
  };
  clearRegions: () => void;
  addRegion: (region: any) => void;
}

/**
 * Countdown state interface
 */
export interface CountdownState {
  isCountingDown: boolean;
  currentBeat: number;
  totalBeats: number;
}

/**
 * Region processor interface
 */
export interface RegionProcessor {
  stop: () => void;
}

/**
 * Options for the usePlaybackControl hook
 */
export interface UsePlaybackControlOptions {
  /** Currently selected exercise */
  selectedExercise: Exercise | null | undefined;
  /** Transport context for playback control */
  transport: PlaybackControlTransport;
  /** Countdown state from useCountdown hook */
  countdownState: CountdownState;
  /** Cancel countdown function */
  cancelCountdown: () => void;
  /** Start countdown function */
  startCountdown: (
    bpm: number,
    audioContext: AudioContext,
    transport: any,
  ) => Promise<void>;
  /** Whether system is initialized */
  systemInitialized: boolean;
  /** Callback for play state changes */
  onPlayStateChange?: (isPlaying: boolean) => void;
  /** Metronome track ref */
  metronomeTrackRef: React.MutableRefObject<PlaybackControlTrack>;
  /** Drum track ref */
  drumTrackRef: React.MutableRefObject<PlaybackControlTrack>;
  /** Bass track ref */
  bassTrackRef: React.MutableRefObject<PlaybackControlTrack>;
  /** Region processor ref */
  regionProcessorRef: React.MutableRefObject<RegionProcessor | null>;
}

/**
 * Return type for the usePlaybackControl hook
 */
export interface UsePlaybackControlReturn {
  /** Handler for play/stop button click */
  handlePlayButtonClick: () => Promise<void>;
  /** Whether playback toggle is in progress */
  isTogglingPlayback: boolean;
  /**
   * Whether the play handler is currently waiting for samples (or bass
   * buffers) to finish loading. Used by the play button to show a single
   * spinner state instead of a stream of toasts.
   */
  isLoadingSamples: boolean;
  /**
   * If true, the last attempt to load bass buffers failed. Consumers
   * (e.g. BassLineWidget) can surface a non-blocking "bass unavailable"
   * indicator instead of relying on a transient toast.
   */
  bassFailedToLoad: boolean;
}

/**
 * Wait for samples to be ready with timeout
 */
async function waitForSamplesReady(timeoutMs = 10000): Promise<void> {
  if (typeof window === 'undefined') return;
  if (window.__samplesReady) return;

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for samples to load'));
    }, timeoutMs);

    const handleSamplesReady = () => {
      clearTimeout(timeout);
      window.removeEventListener('samplesReady', handleSamplesReady);
      resolve();
    };

    // Check if samples became ready while setting up listener
    if (window.__samplesReady) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    window.addEventListener('samplesReady', handleSamplesReady);
  });
}

/**
 * Wait for bass buffers to be ready with timeout
 */
async function waitForBassBuffersReady(
  exerciseId: string | undefined,
  timeoutMs = 10000,
): Promise<void> {
  if (!exerciseId) return;
  if (WindowRegistry.getBassBuffersReady(exerciseId)) return;

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout waiting for bass buffers to load'));
    }, timeoutMs);

    const handleBassBuffersReady = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.exerciseId === exerciseId) {
        clearTimeout(timeout);
        window.removeEventListener('bassBuffersReady', handleBassBuffersReady);
        resolve();
      }
    };

    // Check if buffers became ready while setting up listener
    if (WindowRegistry.getBassBuffersReady(exerciseId)) {
      clearTimeout(timeout);
      resolve();
      return;
    }

    window.addEventListener('bassBuffersReady', handleBassBuffersReady);
  });
}

/**
 * Wait for the harmony track to be registered with PlaybackEngine.
 *
 * Harmony has its own slow async load chain (WamKeyboardPlugin →
 * WurlitzerVelocitySampler / GrandPianoVelocitySampler → useHarmonyRegistration
 * effect → playbackEngine.registerTrack). On a cold tutorial open it can lag
 * the bass/drums init by 1-3s. If the user clicks play before
 * `harmony-widget-track` exists in PlaybackEngine.getTracks(), the harmony
 * notes never get scheduled — playback silently runs without harmony.
 *
 * We poll the engine's track map every 50ms because there's no single
 * "harmony ready" event (registration happens deep in a widget hook). If
 * the exercise has no harmony notes, the caller should skip this entirely.
 */
async function waitForHarmonyTrackReady(timeoutMs = 10000): Promise<void> {
  if (typeof window === 'undefined') return;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      const tracks = playbackEngine.getTracks?.();
      // Track key used by useHarmonyRegistration when calling registerTrack
      if (tracks?.has?.('harmony-widget-track')) {
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timeout waiting for harmony track to register');
}

/**
 * Show toast notification (dynamically imported)
 */
async function showToast(
  title: string,
  description: string,
  variant?: 'default' | 'destructive',
): Promise<void> {
  const { toast } = await import('@/shared/hooks/use-toast');
  toast({ title, description, variant });
}

/**
 * Create metronome region for an exercise
 */
function createMetronomeRegion(exercise: Exercise, trackId: string): any {
  const beatsPerBar = exercise.timeSignature?.numerator || 4;
  const totalBars = exercise.total_bars || 4;
  const totalBeats = exercise.duration_beats || totalBars * beatsPerBar;

  const events = [];
  for (let i = 0; i < totalBeats; i++) {
    const isAccent = i % beatsPerBar === 0;
    events.push({
      position: `0:${i}:0`,
      type: isAccent ? 'accent' : 'click',
      velocity: isAccent ? 0.9 : 0.7,
    });
  }

  return {
    id: 'metronome-region',
    trackId,
    name: 'Metronome',
    startTime: 0,
    duration: totalBeats,
    pattern: {
      id: 'metronome-pattern',
      name: 'Click Track',
      type: 'metronome',
      timeSignature: exercise.timeSignature || { numerator: 4, denominator: 4 },
      events,
    },
  };
}

/**
 * Create drum region for an exercise
 */
function createDrumRegion(exercise: Exercise, trackId: string): any {
  if (!exercise.drumPattern || !Array.isArray(exercise.drumPattern)) {
    return null;
  }

  const timeSignature = exercise.timeSignature || {
    numerator: 4,
    denominator: 4,
  };
  const beatsPerBar = timeSignature.numerator;

  const drumEvents = exercise.drumPattern.map((hit: any) => {
    const totalBeats =
      (hit.position.measure || 0) * beatsPerBar + (hit.position.beat || 0);

    const PPQ = 480;
    const tick =
      hit.position.tick ?? (hit.position.subdivision || 0) * (PPQ / 4);
    const sixteenthSubdivision = Math.floor((tick / PPQ) * 4);

    const normalizedDrum = normalizeDrumTypeToBufferKey(hit.drum || 'kick');
    return {
      position: `0:${totalBeats}:${sixteenthSubdivision}`,
      type: normalizedDrum,
      drum: normalizedDrum,
      velocity: hit.velocity ? hit.velocity / 127 : 0.7,
      midiNote: hit.midiNote,
    };
  });

  const maxMeasure = exercise.drumPattern.reduce(
    (max: number, hit: any) => Math.max(max, hit.position.measure || 0),
    0,
  );
  const patternMeasureCount = maxMeasure + 1;
  const loopCount = exercise.total_bars
    ? Math.ceil(exercise.total_bars / patternMeasureCount)
    : 1;

  return {
    id: `drum-region-${exercise.id}`,
    trackId,
    name: 'Drum Pattern',
    startTime: 0,
    duration: {
      bars: patternMeasureCount,
      beats: 0,
      sixteenths: 0,
      ticks: 0,
    },
    loopCount,
    muted: false,
    pattern: {
      id: `drum-pattern-${exercise.id}`,
      name: 'Drum Pattern',
      type: 'drum',
      timeSignature,
      events: drumEvents,
    },
  };
}

/**
 * Hook for managing playback control
 */
export function usePlaybackControl(
  options: UsePlaybackControlOptions,
): UsePlaybackControlReturn {
  const {
    selectedExercise,
    transport,
    countdownState,
    cancelCountdown,
    startCountdown,
    systemInitialized,
    onPlayStateChange,
    metronomeTrackRef,
    drumTrackRef,
    bassTrackRef,
    regionProcessorRef,
  } = options;

  const [isTogglingPlayback, setIsTogglingPlayback] = useState(false);
  // Visible to consumers so the play button can show a spinner instead of a
  // toast cascade while we wait for samples + bass buffers.
  const [isLoadingSamples, setIsLoadingSamples] = useState(false);
  // Sticky flag — bass loading failures used to fire a single toast that
  // disappeared in 5 seconds. Now the failure persists so BassLineWidget can
  // render a "bass unavailable" badge with a retry affordance.
  const [bassFailedToLoad, setBassFailedToLoad] = useState(false);

  const handlePlayButtonClick = useCallback(async () => {
    logger.debug('🎵 PLAY BUTTON CLICKED - usePlaybackControl handler');

    // CRITICAL: Prevent playback when no exercise is selected
    if (!selectedExercise) {
      logger.warn('⚠️ Cannot start playback: No exercise selected');
      await showToast(
        'No Exercise Selected',
        'Please select an exercise from the list above before starting playback.',
        'destructive',
      );
      return;
    }

    // Wait for samples + bass buffers if needed. The play button is now
    // visibly busy via isLoadingSamples (used by PlaybackControlsBar to
    // disable + spin the button), so we don't need progress toasts.
    const samplesNotReady =
      typeof window !== 'undefined' && !window.__samplesReady;
    const hasBassNotes = selectedExercise?.notes?.some(
      (note: any) => note.string >= 1 && note.string <= 5,
    );
    const bassNotReady =
      hasBassNotes && !WindowRegistry.getBassBuffersReady(selectedExercise?.id);

    // Harmony track readiness: the exercise has harmony content but the
    // widget hasn't yet registered the harmony track with PlaybackEngine
    // (slow Wurlitzer/GrandPiano sampler init can take 2-3s after
    // tutorial-mount). Without waiting, scheduleAllRegions() runs before
    // harmony track exists → no harmony notes get scheduled → silent harmony.
    const hasHarmonyNotes = (selectedExercise as any)?.harmonyNotes?.length > 0;
    let harmonyTrackNotReady = false;
    if (hasHarmonyNotes && typeof window !== 'undefined') {
      const playbackEngine =
        WindowRegistry.getCoreServices()?.getPlaybackEngine?.();
      harmonyTrackNotReady = !playbackEngine
        ?.getTracks?.()
        ?.has?.('harmony-widget-track');
    }

    if (samplesNotReady || bassNotReady || harmonyTrackNotReady) {
      setIsLoadingSamples(true);
    }

    if (samplesNotReady) {
      logger.warn('⚠️ Samples not ready yet, waiting...');
      try {
        await waitForSamplesReady();
        logger.info('✅ Samples ready, continuing with playback');
      } catch (error) {
        logger.error('❌ Failed to wait for samples:', error);
        setIsLoadingSamples(false);
        // Error toasts still matter — the user needs to know what failed
        // and that refresh is the recovery action.
        await showToast(
          'Loading Error',
          'Failed to load audio samples. Please refresh the page.',
          'destructive',
        );
        return;
      }
    } else {
      logger.debug('✅ Samples already ready, proceeding with playback');
    }

    if (bassNotReady) {
      logger.warn('⚠️ Bass buffers not ready yet, waiting...');
      try {
        await waitForBassBuffersReady(selectedExercise?.id);
        logger.info('✅ Bass buffers ready, continuing with playback');
        setBassFailedToLoad(false);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('bassicology:bass-recovered', {
              detail: { exerciseId: selectedExercise?.id },
            }),
          );
        }
      } catch (error) {
        logger.error('❌ Failed to wait for bass buffers:', error);
        // Mark sticky — the BassLineWidget surfaces this with an inline
        // retry instead of a transient toast that disappears in 5s.
        setBassFailedToLoad(true);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('bassicology:bass-failed', {
              detail: { exerciseId: selectedExercise?.id },
            }),
          );
        }
        // Don't return - continue with playback even without bass
      }
    } else if (hasBassNotes) {
      logger.debug('✅ Bass buffers already ready, proceeding with playback');
    }

    if (harmonyTrackNotReady) {
      logger.warn(
        '⚠️ Harmony track not yet registered with PlaybackEngine, waiting...',
      );
      try {
        await waitForHarmonyTrackReady();
        logger.info('✅ Harmony track ready, continuing with playback');
      } catch (error) {
        logger.error('❌ Harmony track not registered within timeout:', error);
        // Don't return — playback continues without harmony rather than
        // blocking the user. Same approach as bass-fail recovery.
      }
    } else if (hasHarmonyNotes) {
      logger.debug(
        '✅ Harmony track already registered, proceeding with playback',
      );
    }

    setIsLoadingSamples(false);

    logger.debug('🎵 Transport state:', {
      isPlaying: transport.isPlaying,
      isPaused: transport.isPaused,
      isStopped: transport.isStopped,
    });

    // Log current track regions
    logger.debug('🎵 Current track regions:', {
      metronomeRegions: metronomeTrackRef.current?.regions?.length || 0,
      drumRegions: drumTrackRef.current?.regions?.length || 0,
      hasDrumPattern: !!(
        selectedExercise?.drumPattern && selectedExercise.drumPattern.length > 0
      ),
      drumPatternHits: selectedExercise?.drumPattern?.length || 0,
      exerciseId: selectedExercise?.id,
    });

    // Allow stop even if toggling (emergency stop)
    const isStopRequest = transport.isPlaying || countdownState.isCountingDown;

    if (!isStopRequest && (isTogglingPlayback || !systemInitialized)) {
      logger.debug('System not ready or already toggling playback');
      return;
    }

    try {
      setIsTogglingPlayback(true);

      if (isStopRequest) {
        // Currently playing or counting down -> stop
        await handleStop();
      } else {
        // Not playing -> start
        await handleStart();
      }
    } catch (error: any) {
      logger.error('Error toggling playback:', error);
      setIsTogglingPlayback(false);
      throw error;
    } finally {
      // Ensure isTogglingPlayback is always reset with a small delay
      setTimeout(() => {
        setIsTogglingPlayback(false);
      }, 100);
    }

    /**
     * Handle stop request
     */
    async function handleStop() {
      logger.info('🎵 STOP BUTTON CLICKED', {
        isPlaying: transport.isPlaying,
        isCountingDown: countdownState.isCountingDown,
      });

      // Cancel any ongoing countdown
      if (countdownState.isCountingDown) {
        cancelCountdown();
        logger.debug('🎵 Cancelled countdown');
      }

      // Stop the region processor if available
      if (regionProcessorRef.current) {
        regionProcessorRef.current.stop();
        logger.debug('🎵 Stopped RegionProcessor');
      }

      try {
        await transport.stop();
        logger.info('🎵 STOP: Transport stopped successfully');

        // Notify widget state that playback stopped
        if (onPlayStateChange) {
          onPlayStateChange(false);
          logger.debug('🎵 Called onPlayStateChange(false)');
        }
      } catch (error) {
        logger.error('🎵 STOP: Failed to stop transport', error);
      }
    }

    /**
     * Handle start request
     */
    async function handleStart() {
      logger.debug('🎵 Starting playback with enhanced preloading');

      // Set time signature
      if (selectedExercise?.timeSignature) {
        transport.setTimeSignature(
          selectedExercise.timeSignature.numerator,
          selectedExercise.timeSignature.denominator,
        );
      } else {
        transport.setTimeSignature(4, 4);
      }

      // STEP 0: Set countdown offset in transport BEFORE starting anything
      const countdownTimeSignature = selectedExercise?.timeSignature || {
        numerator: 4,
        denominator: 4,
      };
      const coreServicesForCountdown = WindowRegistry.getCoreServices();

      if (coreServicesForCountdown) {
        try {
          const unifiedTransport =
            coreServicesForCountdown.getUnifiedTransport();
          if (
            unifiedTransport &&
            typeof unifiedTransport.setCountdownBeats === 'function'
          ) {
            console.log(
              '🎯 [COUNTDOWN FIX] Setting countdown BEFORE transport starts',
              {
                beats: countdownTimeSignature.numerator,
                timestamp: Date.now(),
              },
            );
            unifiedTransport.setCountdownBeats(
              countdownTimeSignature.numerator,
            );
          }
        } catch (error) {
          logger.error('Failed to set countdown beats', error);
        }
      }

      // STEP 1: Resume AudioContext (main user gesture requirement)
      logger.debug('🎵 Resuming AudioContext...');

      const Tone = await import('tone');

      if (Tone.context.state === 'suspended') {
        logger.debug('🎵 Tone context is suspended, starting...');
        await Tone.start();
        logger.debug('✅ Tone.start() completed');
      } else {
        logger.debug('🎵 Tone context already running:', Tone.context.state);
      }

      const { ensureAudioContext } =
        await import('@/domains/playback/utils/ensureAudioContext');
      await ensureAudioContext();
      logger.debug('✅ AudioContext resumed');

      // CRITICAL: Ensure CoreServices and AudioEventRouter are started
      const globalCoreServices = WindowRegistry.getCoreServices();
      if (globalCoreServices) {
        const isReady = globalCoreServices.isReady();
        logger.info('🎵 CoreServices status check', {
          isReady,
          willInitialize: !isReady,
          willStartOnly: isReady,
        });

        if (!isReady) {
          logger.debug(
            '🎵 CoreServices not ready, initializing and starting...',
          );
          await globalCoreServices.initialize();
          await globalCoreServices.start();
          logger.debug('✅ CoreServices initialized and started');
        } else {
          logger.debug('🎵 CoreServices already ready, just calling start()');
          await globalCoreServices.start();
          logger.debug('✅ CoreServices started');
        }
      }

      // STEP 2: Get PlaybackEngine from CoreServices
      const coreServicesRef = WindowRegistry.getCoreServices();
      let playbackEngine = null;

      if (coreServicesRef && coreServicesRef.getPlaybackEngine) {
        playbackEngine = coreServicesRef.getPlaybackEngine();
        logger.info(
          '✅ Using PlaybackEngine from CoreServices (has FAANG buffers)',
        );
      } else {
        logger.error(
          '❌ CRITICAL: CoreServices.getPlaybackEngine() not available!',
        );
        throw new Error(
          'CoreServices PlaybackEngine required for FAANG solution',
        );
      }

      // CRITICAL FIX: If metronome regions are empty, create them NOW
      const currentMetronomeTrack = metronomeTrackRef.current;
      const currentDrumTrack = drumTrackRef.current;

      if (
        (currentMetronomeTrack.track?.regions?.length || 0) === 0 &&
        selectedExercise
      ) {
        logger.info(
          '🎵 Metronome regions empty, creating them now with correct tempo:',
          selectedExercise.bpm,
        );

        currentMetronomeTrack.clearRegions();
        const metronomeRegion = createMetronomeRegion(
          selectedExercise,
          currentMetronomeTrack.track?.id || 'metronome',
        );
        currentMetronomeTrack.addRegion(metronomeRegion);
        logger.info(
          '🎵 Created metronome regions with',
          metronomeRegion.pattern.events.length,
          'events at',
          selectedExercise.bpm,
          'BPM',
        );
      }

      // CRITICAL FIX: If drum regions are empty but we have a drum pattern, create them NOW
      if (
        (currentDrumTrack.track?.regions?.length || 0) === 0 &&
        selectedExercise?.drumPattern &&
        Array.isArray(selectedExercise.drumPattern) &&
        selectedExercise.drumPattern.length > 0 &&
        currentDrumTrack.isInitialized
      ) {
        logger.info(
          '🎵 Drum regions empty but pattern exists, creating them now:',
          {
            hitCount: selectedExercise.drumPattern.length,
          },
        );

        currentDrumTrack.clearRegions();
        const drumRegion = createDrumRegion(
          selectedExercise,
          currentDrumTrack.track?.id || 'drums',
        );
        if (drumRegion) {
          currentDrumTrack.addRegion(drumRegion);
          logger.info(
            '🎵 Created drum regions with',
            drumRegion.pattern.events.length,
            'events, loopCount:',
            drumRegion.loopCount,
          );
        }
      }

      // Register tracks with PlaybackEngine
      const metronomeRegions = currentMetronomeTrack.track?.regions || [];
      const drumRegions = currentDrumTrack.track?.regions || [];
      const bassRegions = bassTrackRef.current.track?.regions || [];

      if (
        playbackEngine &&
        (metronomeRegions.length > 0 ||
          drumRegions.length > 0 ||
          bassRegions.length > 0)
      ) {
        const tracksToRegister = [];
        if (metronomeRegions.length > 0) {
          tracksToRegister.push({
            id: 'metronome',
            name: 'Metronome',
            regions: metronomeRegions,
            instrumentType: 'metronome',
          });
        }
        if (drumRegions.length > 0) {
          tracksToRegister.push({
            id: 'drums',
            name: 'Drums',
            regions: drumRegions,
            instrumentType: 'drums',
          });
        }
        if (bassRegions.length > 0) {
          tracksToRegister.push({
            id: 'bass-widget-track',
            name: 'Bass',
            regions: bassRegions,
            instrumentType: 'bass',
          });
        }

        if (tracksToRegister.length > 0) {
          playbackEngine.registerTracks(tracksToRegister);
          logger.debug(
            `🎵 Registered ${tracksToRegister.length} tracks with PlaybackEngine`,
          );
        }
      }

      // STEP 3: Set time signature BEFORE starting playback
      if (selectedExercise?.timeSignature) {
        transport.setTimeSignature(
          selectedExercise.timeSignature.numerator,
          selectedExercise.timeSignature.denominator,
        );
        logger.info(
          '🎵 Set time signature from exercise:',
          selectedExercise.timeSignature,
        );
      }

      // STEP 4: FAANG COUNTDOWN SOLUTION - Enable countdown offset
      const timeSignature = selectedExercise?.timeSignature || {
        numerator: 4,
        denominator: 4,
      };
      if (playbackEngine) {
        logger.info('🎵 Enabling FAANG countdown system');
        playbackEngine.enableCountdown(timeSignature);
        playbackEngine.addCountdownRegion(timeSignature);
        playbackEngine.addVoiceCountdownRegion(timeSignature);
      }

      // STEP 5: Set musical truth
      console.log(
        `🎵 [TEMPO-EXERCISE] usePlaybackControl calling musicalTruth.setFromExercise()`,
        {
          exerciseId: selectedExercise?.id,
          exerciseTitle: selectedExercise?.title,
          exerciseBpm: selectedExercise?.bpm,
          musicalTruthHasUserModifiedTempo: musicalTruth.hasUserModifiedTempo(),
          currentMusicalTruthBpm: musicalTruth.getBPM(),
        },
      );

      musicalTruth.setFromExercise(selectedExercise!);

      console.log(
        '✅ [MUSICAL TRUTH] Set from exercise - ALL systems synchronized:',
        {
          bpm: musicalTruth.getBPM(),
          timeSignature: musicalTruth.getTimeSignature(),
          durationBars: musicalTruth.getDurationBars(),
          countdownBars: musicalTruth.getCountdownBars(),
          totalBars: musicalTruth.getTotalBars(),
          totalBeats: musicalTruth.getTotalBeats(),
        },
      );

      // STEP 6: Start PlaybackEngine (only if in valid state)
      if (playbackEngine) {
        const engineState = playbackEngine.getState();
        if (engineState === 'ready' || engineState === 'stopped') {
          console.log(
            '[PLAYBACK-DIAGNOSTIC] Calling playbackEngine.start() now!',
          );
          playbackEngine.start();
          logger.debug('Started PlaybackEngine');
        } else if (engineState === 'playing') {
          logger.debug(
            'PlaybackEngine already playing, skipping duplicate start()',
          );
        } else {
          logger.warn(
            `PlaybackEngine in state "${engineState}", skipping start()`,
          );
        }
      }

      // STEP 7: Start visual countdown
      logger.info('🎵 Starting visual countdown');
      const ToneRef = getTone();
      const audioContext = ToneRef.context;
      // Read BPM directly from Tone.getTransport().bpm.value — the
      // authoritative source for live tempo (MusicalTruthAuthority writes
      // here). `transport.getTempo()` was returning a normalized 0..1 slider
      // value (0.3125 instead of 69), which made the visual countdown's
      // setInterval delay 60/0.3125 = 192s — so beats 2/3/4 never fired
      // within the user's playback window. getTransport() (instead of the
      // deprecated Tone.Transport const) is safe across setContext swaps.
      const currentBpm = ToneRef.getTransport().bpm.value;
      startCountdown(currentBpm, audioContext, null as any).catch((error) => {
        logger.error('❌ Visual countdown failed:', error);
      });

      // STEP 9: Start transport
      logger.info('🎵 [FLOW] About to call transport.start()');
      console.log('🎵 [FLOW] About to call transport.start()', {
        timestamp: Date.now(),
      });

      try {
        await transport.start();
        logger.info('🎵 [FLOW] transport.start() returned successfully');

        if (onPlayStateChange) {
          onPlayStateChange(true);
          logger.info(
            '🎵 Called onPlayStateChange(true) - widget state should update',
          );
        }
      } catch (error) {
        logger.error('🎵 [FLOW] transport.start() threw error:', error);
        throw error;
      }

      logger.info('🎵 ✅ Transport started successfully');
    }
  }, [
    selectedExercise,
    transport,
    countdownState.isCountingDown,
    cancelCountdown,
    startCountdown,
    isTogglingPlayback,
    systemInitialized,
    onPlayStateChange,
    metronomeTrackRef,
    drumTrackRef,
    bassTrackRef,
    regionProcessorRef,
  ]);

  return {
    handlePlayButtonClick,
    isTogglingPlayback,
    isLoadingSamples,
    bassFailedToLoad,
  };
}
