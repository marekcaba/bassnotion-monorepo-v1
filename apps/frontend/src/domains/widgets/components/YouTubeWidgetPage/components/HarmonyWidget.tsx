'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { ChordSlotSelector } from './ChordSlotSelector';
import { ProfessionalKeyboardSelector } from './ProfessionalKeyboardSelector';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportContext } from '@/domains/playback/contexts/TransportContext';
import {
  ensureAudioContext,
  withAudioContext,
} from '@/domains/playback/utils/ensureAudioContext';
import { getPersistentAudioContext, getOrCreatePersistentAudioContext } from '@/domains/playback/utils/audioContext';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
// PHASE 2: wamPluginSingleton removed - now using PluginManager for unified singleton management
import { GlobalSampleCache } from '@/domains/playback/modules/storage';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
import { usePatternSelector } from '@/domains/patterns/hooks/usePatternSelector';
import { Music2 } from 'lucide-react';
import { useSyncContext } from '../../base/SyncProvider';
import { useVisualBeat } from '@/domains/widgets/hooks/useVisualBeat';
import { useMeasureSync } from '@/domains/widgets/hooks/useBeatGridSync';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority.js';
import { DEFAULT_HARMONY_INSTRUMENT } from '@/domains/playback/constants';
// Dynamic import to avoid SSR issues
const KeyboardInstrument = {
  GRAND_PIANO: 'grandpiano',
  FENDER_RHODES: 'rhodes',
  WURLITZER: 'wurlitzer',
} as const;

type KeyboardInstrumentType =
  (typeof KeyboardInstrument)[keyof typeof KeyboardInstrument];

interface HarmonyWidgetProps {
  progression: string[];
  currentChord: number;
  isPlaying: boolean;
  isVisible: boolean;
  tutorialId?: string;
  harmonyInstrument?: 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad';
  exercise?: any; // Exercise entity with harmony_notes data
  onNextChord: () => void;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility?: () => void;
  onTogglePlay?: () => void;
  isAdminMode?: boolean;
  // Note: tempo removed - now using useTransport() hook like Drummer/Metronome
  /** Controlled volume (0-100). If provided, widget uses this instead of local state */
  volume?: number;
  /** Controlled mute state. If provided, widget uses this instead of local state */
  isMuted?: boolean;
  /** Callback when volume changes (for controlled mode) */
  onVolumeChange?: (volume: number) => void;
  /** Callback when mute state changes (for controlled mode) */
  onMuteToggle?: () => void;
}

// Professional chord progressions with musical timing
const chordProgressions = {
  'Jazz Standard': [
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
    { chord: 'CMaj7', duration: 1 },
    { chord: 'Am7', duration: 1 },
  ],
  'Blues in C': [
    { chord: 'C7', duration: 4 },
    { chord: 'F7', duration: 2 },
    { chord: 'C7', duration: 2 },
    { chord: 'G7', duration: 1 },
    { chord: 'F7', duration: 1 },
    { chord: 'C7', duration: 2 },
  ],
  'Pop Progression': [
    { chord: 'C', duration: 1 },
    { chord: 'G', duration: 1 },
    { chord: 'Am', duration: 1 },
    { chord: 'F', duration: 1 },
  ],
  'Modal Jazz': [
    { chord: 'Dm7', duration: 2 },
    { chord: 'Em7', duration: 2 },
    { chord: 'FMaj7', duration: 2 },
    { chord: 'G7', duration: 2 },
  ],
  'Bossa Nova': [
    { chord: 'CMaj7', duration: 2 },
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
    { chord: 'Em7', duration: 1 },
    { chord: 'A7', duration: 1 },
    { chord: 'Dm7', duration: 1 },
    { chord: 'G7', duration: 1 },
  ],
  'Funk Groove': [
    { chord: 'Dm7', duration: 2 },
    { chord: 'Dm7', duration: 2 },
    { chord: 'G7', duration: 2 },
    { chord: 'G7', duration: 2 },
  ],
};

const HarmonyWidgetComponent = ({
  progression = ['CMaj7', 'Am7', 'Dm7', 'G7'], // Default progression
  currentChord = 0,
  isPlaying,
  isVisible,
  tutorialId,
  harmonyInstrument,
  exercise,
  onNextChord = () => {}, // Default no-op
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
  isAdminMode = false,
  volume: controlledVolume,
  isMuted: controlledMuted,
  onVolumeChange,
  onMuteToggle,
}: HarmonyWidgetProps) => {
  const { correlationId, logger } = useCorrelation('HarmonyWidget');

  // Get live tempo from transport (like Drummer/Metronome)
  const transport = useTransportContext();
  // PERFORMANCE FIX: Only extract tempo value to prevent re-renders from transport object changes
  const transportTempo = transport.tempo;

  // Stabilize bpm to prevent callback recreation when value doesn't actually change
  const [bpm, setBpm] = useState(transportTempo);
  useEffect(() => {
    if (bpm !== transportTempo) {
      setBpm(transportTempo);
    }
  }, [transportTempo, bpm]);

  // Support both controlled and uncontrolled modes for volume/mute
  const [localVolume, setLocalVolume] = useState(80);
  const [localMuted, setLocalMuted] = useState(false);

  // Use controlled values if provided, otherwise use local state
  const volume = controlledVolume !== undefined ? controlledVolume : localVolume;
  const isMuted = controlledMuted !== undefined ? controlledMuted : localMuted;

  // Handler that works in both controlled and uncontrolled modes
  const handleVolumeChange = useCallback((newVolume: number) => {
    if (onVolumeChange) {
      onVolumeChange(newVolume);
    } else {
      setLocalVolume(newVolume);
    }
  }, [onVolumeChange]);

  const handleMuteToggle = useCallback(() => {
    if (onMuteToggle) {
      onMuteToggle();
    } else {
      setLocalMuted(!localMuted);
    }
  }, [onMuteToggle, localMuted]);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  const [selectedProgression, setSelectedProgression] =
    useState('Jazz Standard');

  // Initialize with harmonyInstrument prop if available, otherwise grand piano as the default
  const [currentInstrument, setCurrentInstrument] = useState<
    KeyboardInstrumentType | undefined
  >(harmonyInstrument as KeyboardInstrumentType | undefined);

  // State initialization on mount
  useEffect(() => {
    // Component mounted
  }, []); // Empty deps = run once on mount

  // CRITICAL: Store currentInstrument in a ref so createAudioNodeAttempt always reads the latest value
  const currentInstrumentRef = useRef<KeyboardInstrumentType | undefined>(
    currentInstrument,
  );
  useEffect(() => {
    currentInstrumentRef.current = currentInstrument;
  }, [currentInstrument]);

  // PERFORMANCE FIX: Moved diagnostic log to useEffect to only log on meaningful changes
  // This prevents hundreds of logs during playback when component re-renders
  useEffect(() => {
    logger.info('🎹 HarmonyWidget state changed:', {
      harmonyInstrumentProp: harmonyInstrument,
      currentInstrumentState: currentInstrument,
      isPlaying,
      isVisible,
      hasExercise: !!exercise,
      exerciseId: exercise?.id?.value,
      hasHarmonyNotes: !!exercise?.harmonyNotes,
      harmonyNotesCount: exercise?.harmonyNotes?.length || 0,
    });
  }, [
    harmonyInstrument,
    currentInstrument,
    isPlaying,
    isVisible,
    exercise?.id?.value,
  ]);
  const [isExpanded, setIsExpanded] = useState(false);

  // Use jitter-free visual beat hook (RAF-based, not Tone.Draw-based)
  // This calculates beat position directly from AudioContext.currentTime
  // ensuring chord indicator timing is perfectly synchronized with audio
  const { beatIndex, measureIndex, isCountdown } = useVisualBeat(
    4, // beatsPerMeasure
    isPlaying,
    isVisible,
  );

  // 🚀 JITTER FIX: Direct DOM chord synchronization (bypasses React state)
  // This hook subscribes directly to AtomicPlaybackClock and updates DOM via classList.toggle()
  // instead of React state, eliminating jitter from React's batched updates.
  // Debug with: window.__DEBUG_DOM_TIMING = true
  const { registerChordIndicator } = useMeasureSync({
    chordCount: progression.length,
    isPlaying,
    activeClass: 'bg-blue-400 text-white shadow-lg shadow-blue-400/50',
    inactiveClass: 'bg-slate-700 text-slate-400',
    isVisible,
  });

  // Calculate current chord index from unified timing (kept for current chord display text)
  // Each measure shows a different chord (cycles through progression)
  const localCurrentChord = useMemo(() => {
    if (!isPlaying || progression.length === 0) return 0;
    return measureIndex % progression.length;
  }, [isPlaying, measureIndex, progression.length]);

  // Create a track for harmony
  const track = useTrack({
    trackId: 'harmony-widget-track',
    name: 'Harmony',
    type: 'harmony',
    debugMode: true,
  });

  // PERFORMANCE FIX: Extract track.isReady as a stable primitive
  // This prevents the registration effect from re-running when the track object changes
  const trackIsReady = track.isReady;

  // PERFORMANCE FIX: Calculate harmony note count as a stable number
  // Avoids recreating the callback when note array reference changes but content is same
  const harmonyNoteCount = useMemo(() => {
    return exercise?.harmonyNotes?.length || 0;
  }, [exercise?.harmonyNotes]);

  // Use pattern selector hook if tutorialId is provided
  const patternSelector = tutorialId
    ? usePatternSelector({
        tutorialId,
        onPatternChange: (type, pattern) => {
          if (type === 'harmony' && pattern.midiData) {
            // Convert pattern library format to chord progression
            handlePatternLibraryChange(pattern);
          }
        },
      })
    : null;

  // Get sync context for global event bus
  const syncContext = useSyncContext();
  const { subscribeToEvent } = syncContext || {};

  // State to track when samples are loaded (triggers re-registration)
  const [samplesLoadedTrigger, setSamplesLoadedTrigger] = useState(0);

  // Listen for harmony-samples-loaded event to re-trigger registration
  // Also listen for samplesReady and samplesPreloaded events from InitialSamplePreloader
  useEffect(() => {
    // Listen to window event (from ExerciseSelector)
    const handleWindowEvent = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log(
        '🎧 [HARMONY-WIDGET] Received harmony-samples-loaded event (window):',
        customEvent.detail,
      );
      // Increment trigger to force registration effect to re-run
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // Listen for samplesReady from ScrollTriggerLoader (handles initial load after scroll)
    // This ensures HarmonyWidget registers after ScrollTriggerLoader finishes loading
    const handleSamplesReady = () => {
      console.log(
        '🎧 [HARMONY-WIDGET] Received samplesReady event from ScrollTriggerLoader',
      );
      // Increment trigger to force registration effect to re-run
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    // TIMING FIX: Listen for samplesPreloaded event from InitialSamplePreloader
    // This event fires AFTER full exercise-specific samples are loaded (including harmony)
    // This fixes the race condition where HarmonyWidget tried to register before samples loaded
    const handleSamplesPreloaded = () => {
      console.log(
        '🎧 [HARMONY-WIDGET] Received samplesPreloaded event - full samples loaded!',
      );
      // Increment trigger to force registration effect to re-run with fully loaded samples
      setSamplesLoadedTrigger((prev) => prev + 1);
    };

    window.addEventListener('harmony-samples-loaded', handleWindowEvent);
    window.addEventListener('samplesReady', handleSamplesReady);
    window.addEventListener('samplesPreloaded', handleSamplesPreloaded);

    // Also listen to sync context event (from YouTubeWidgetPage if used)
    let unsubscribe: (() => void) | undefined;
    if (subscribeToEvent) {
      unsubscribe = subscribeToEvent(
        'harmony-samples-loaded',
        (payload: any) => {
          console.log(
            '🎧 [HARMONY-WIDGET] Received harmony-samples-loaded event (sync):',
            payload,
          );
          setSamplesLoadedTrigger((prev) => prev + 1);
        },
      );
    }

    return () => {
      window.removeEventListener('harmony-samples-loaded', handleWindowEvent);
      window.removeEventListener('samplesReady', handleSamplesReady);
      window.removeEventListener('samplesPreloaded', handleSamplesPreloaded);
      if (unsubscribe) unsubscribe();
    };
  }, [subscribeToEvent]);

  // Track the plugin attached to our track
  const trackPluginRef = useRef<any>(null);

  // PERFORMANCE FIX: Use refs to track if registration has been done for this exercise
  // This prevents multiple re-registrations due to unstable dependencies
  const lastRegisteredExerciseIdRef = useRef<string | null>(null);
  const isRegisteringRef = useRef(false);

  // Refs to stabilize registration effect dependencies
  const exerciseRef = useRef(exercise);
  const bpmRef = useRef(bpm);
  const isPlayingRef = useRef(isPlaying);
  const pluginCreationRetryCountRef = useRef(0); // Track retry attempts to prevent infinite loops

  // Keep refs in sync with props/state
  useEffect(() => {
    exerciseRef.current = exercise;
  }, [exercise]);

  useEffect(() => {
    bpmRef.current = bpm;
  }, [bpm]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Log track state changes
  useEffect(() => {
    logger.info('🎹 HarmonyWidget: Track state changed:', {
      isReady: track.isReady,
      trackId: track.track?.id,
      trackState: track.track?.state,
    });
  }, [track.isReady]);

  // Update instrument when harmonyInstrument prop changes
  useEffect(() => {
    if (harmonyInstrument && harmonyInstrument !== currentInstrument) {
      setCurrentInstrument(harmonyInstrument as KeyboardInstrumentType);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harmonyInstrument]); // Only depend on prop, not currentInstrument state

  // CHECKPOINT 1: Exercise data arrival - log whenever exercise prop changes
  useEffect(() => {
    logger.debug('🔍 [CHECKPOINT-1] Exercise prop changed', {
      hasExercise: !!exercise,
      exerciseId: exercise?.id?.value,
      exerciseTitle: exercise?.title,
      harmonyInstrument: exercise?.harmonyInstrument,
      harmonyInstrumentType: typeof exercise?.harmonyInstrument,
      hasHarmonyNotes: !!exercise?.harmonyNotes,
      harmonyNotesCount: exercise?.harmonyNotes?.length || 0,
      currentInstrumentState: currentInstrument,
      harmonyInstrumentProp: harmonyInstrument,
    });
  }, [
    exercise?.id,
    exercise?.harmonyInstrument,
    exercise?.harmonyNotes?.length,
  ]);

  // Log when exercise prop changes
  useEffect(() => {
    console.log('🎹 [HARMONY-WIDGET] Exercise prop changed:', {
      hasExercise: !!exercise,
      exerciseId: exercise?.id?.value,
      exerciseTitle: exercise?.title,
      hasHarmonyNotes: !!exercise?.harmonyNotes,
      harmonyNotesCount: exercise?.harmonyNotes?.length || 0,
      harmonyInstrument: exercise?.harmonyInstrument,
      // CC64 DIAGNOSTIC: Check if exercise has sustain pedal data
      hasHarmonyControlChanges: !!exercise?.harmonyControlChanges,
      controlChangesCount: exercise?.harmonyControlChanges?.length || 0,
      cc64Events:
        exercise?.harmonyControlChanges?.filter((cc: any) => cc.cc === 64)
          .length || 0,
      cc64Sample:
        exercise?.harmonyControlChanges
          ?.filter((cc: any) => cc.cc === 64)
          .slice(0, 3)
          .map((cc: any) => ({
            value: cc.value,
            state: cc.value >= 64 ? 'DOWN' : 'UP',
            measure: cc.position?.measure,
          })) || [],
    });
  }, [exercise]);

  // We don't need useWAMPlugin since we're loading manually
  // Just track if the plugin has been loaded
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);
  const [audioServicesReady, setAudioServicesReady] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reference to the actual plugin instance
  const keyboardPluginRef = useRef<any>(null);
  const lastScheduledTimeRef = useRef<number>(0);
  const currentPatternRef = useRef<any[]>([]);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isCreatingPluginRef = useRef<boolean>(false);

  // Lifecycle checkpoint and log initial component state
  useEffect(() => {
    lifecycle.checkpoint('HARMONY_WIDGET_MOUNTED');
    logger.info('🎹 HarmonyWidget: Component mounted with initial state:', {
      audioServicesReady,
      wamPluginLoaded,
      pluginClassLoaded,
      trackIsReady: track.isReady,
    });
  }, []);

  // Phase 1: Check for pre-loaded instrument first, then load plugin class
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pluginClassLoaded) return;

    const checkPreloadedAndLoadClass = async () => {
      logger.info('🎹 HarmonyWidget: Checking for pre-loaded instrument...');

      // Check if there's a pre-loaded harmony instrument
      const preloadedHarmony =
        GlobalSampleCache.getCachedInstrument('harmony-preloaded');
      if (preloadedHarmony) {
        logger.info('🎹 Found pre-loaded harmony instrument!', {
          hasAudioNode: !!preloadedHarmony.audioNode,
          audioNodeType: preloadedHarmony.audioNode?.constructor?.name,
          isConnected: preloadedHarmony.audioNode?.isConnected,
        });
      } else {
        logger.info('❌ NO pre-loaded harmony instrument found!');
        // Check cache stats
        const stats = GlobalSampleCache.getStats();
        logger.info('🎹 GlobalSampleCache stats:', stats);
        const instrumentNames = GlobalSampleCache.getCachedInstrumentNames();
        logger.info('🎹 Cached instrument names:', instrumentNames);
      }

      // The singleton will handle checking for pre-loaded instruments
      // We just need to mark that we're ready to create the plugin
      setPluginClassLoaded(true);
      lifecycle.checkpoint('HARMONY_PLUGIN_LOADING');
      logger.info('✅ Ready to use WAM plugin singleton');
    };

    checkPreloadedAndLoadClass();
  }, [pluginClassLoaded, wamPluginLoaded]); // Removed isMuted, volume - they should NOT trigger re-initialization

  // Extract audio node creation to a separate function so we can call it from retry
  const createAudioNodeAttempt = useCallback(async () => {
    logger.debug('🔍 [CREATE-ATTEMPT-ENTRY] createAudioNodeAttempt called', {
      isCreatingPluginRef: isCreatingPluginRef.current,
      hasKeyboardPlugin: !!keyboardPluginRef.current,
      wamPluginLoaded,
      willSkip:
        isCreatingPluginRef.current ||
        !!keyboardPluginRef.current ||
        wamPluginLoaded,
    });

    // Prevent multiple simultaneous creation attempts
    if (
      isCreatingPluginRef.current ||
      keyboardPluginRef.current ||
      wamPluginLoaded
    ) {
      logger.debug('🔍 [CREATE-ATTEMPT-SKIP] Skipping due to guard conditions');
      logger.info(
        '🎹 HarmonyWidget: Plugin creation already in progress or completed, skipping...',
      );
      return;
    }

    logger.info('🎹 HarmonyWidget: Attempting to create audio node...', {
      trackIsReady: track.isReady,
      wamPluginLoaded,
      pluginClassLoaded,
    });

    // Mark that we're creating a plugin
    isCreatingPluginRef.current = true;
    logger.debug('🔍 [CREATE-CHECKPOINT-1] Set isCreatingPluginRef to true');

    // Get audio context - MUST use the same context as PluginManager/CoreServices
    // ✅ CRITICAL FIX: Use CoreServices AudioContext to prevent "different audio context" errors
    // The PluginManager creates WamKeyboard with CoreServices.getAudioEngine().getContext()
    // So we MUST use the same context here when connecting nodes
    let context: AudioContext | null = null;

    const coreServices = WindowRegistry.getCoreServices();
    if (coreServices) {
      const audioEngine = coreServices.getAudioEngine();
      if (audioEngine && audioEngine.isReady()) {
        context = audioEngine.getContext();
        logger.debug('🔍 [CREATE-CHECKPOINT-2] Got context from AudioEngine', {
          hasContext: !!context,
          contextState: context?.state,
          sampleRate: context?.sampleRate,
        });
      }
    }

    // FALLBACK: If CoreServices not ready, use persistent context
    if (!context) {
      context = getPersistentAudioContext();
      logger.debug('🔍 [CREATE-CHECKPOINT-2-FALLBACK] Got persistent context', {
        hasContext: !!context,
        contextState: context?.state,
      });
    }

    // FALLBACK: If still no context, try window.__audioContext or create new one
    if (!context) {
      logger.debug(
        '🔍 [CREATE-CHECKPOINT-9.5] No context yet, trying window fallbacks',
      );

      // Try window.__audioContext (might be set by InitialSamplePreloader)
      if ((window as any).__audioContext) {
        context = (window as any).__audioContext;
        logger.debug(
          '🔍 [CREATE-CHECKPOINT-9.6] Got context from window.__audioContext',
          {
            hasContext: !!context,
            contextState: context?.state,
          },
        );
      }
      // Try Tone.getContext() if available globally
      else if ((window as any).Tone && (window as any).Tone.getContext) {
        const toneContext = (window as any).Tone.getContext();
        context =
          toneContext?.rawContext || toneContext?._context || toneContext;
        logger.debug(
          '🔍 [CREATE-CHECKPOINT-9.7] Got context from window.Tone.getContext()',
          {
            hasContext: !!context,
            contextState: context?.state,
          },
        );
      }
      // Last resort: use the singleton pattern to get or create AudioContext
      // This prevents multiple AudioContext warnings and ensures app-wide consistency
      else if (typeof AudioContext !== 'undefined') {
        // Note: getOrCreatePersistentAudioContext is async, so we use getPersistentAudioContext here
        // since this code path runs in a synchronous callback. The context may be null initially
        // but will be created on first user interaction via getOrCreatePersistentAudioContext.
        context = getPersistentAudioContext();
        if (!context) {
          logger.debug('🔍 [CREATE-CHECKPOINT-9.8] No persistent context available yet - will be created on user interaction');
        } else {
          logger.debug('🔍 [CREATE-CHECKPOINT-9.8] Got persistent AudioContext', {
            hasContext: !!context,
            contextState: context?.state,
          });
        }
      }
    }

    // Check if context needs to be resumed
    logger.debug('🔍 [CREATE-CHECKPOINT-10] Checking if context exists', {
      hasContext: !!context,
      contextState: context?.state,
      isAudioContext: context instanceof AudioContext,
    });

    lifecycle.checkpoint('PLUGIN_AUDIOCONTEXT_CHECK', {
      widget: 'harmony',
      contextState: context?.state || 'no-context',
    });

    // CRITICAL FIX: Allow plugin creation with suspended AudioContext
    // The browser's autoplay policy prevents AudioContext from starting without user gesture
    // We create the plugin now (with suspended context) and it will auto-resume when user clicks Play
    if (context && context.state === 'suspended') {
      logger.debug(
        '🔍 [CREATE-CHECKPOINT-11] Context is suspended, will create plugin anyway (browser autoplay policy)',
      );
      logger.info(
        '🎹 HarmonyWidget: Audio context is suspended (autoplay policy), creating plugin anyway - will resume on Play',
      );
      lifecycle.checkpoint('PLUGIN_CREATION_RETRY', {
        widget: 'harmony',
        reason: 'Proceeding despite suspended AudioContext (will resume on Play)',
        contextState: context.state,
      });
      // DON'T call resume() here - it will fail due to autoplay policy
      // AudioContext will auto-resume when user clicks Play button
    }

    logger.info('🎹 HarmonyWidget: Got context:', context, {
      type: context?.constructor?.name,
      isAudioContext: context instanceof AudioContext,
      contextState: context?.state,
    });

    if (context && context instanceof AudioContext) {
      logger.debug(
        '🔍 [CREATE-CHECKPOINT-13] Context is AudioContext, state',
        context.state,
      );
      // REMOVED: Early return for suspended context - allow plugin creation
      logger.debug(
        '🔍 [CREATE-CHECKPOINT-15] Proceeding with plugin creation regardless of context state',
      );

      try {
        logger.debug(
          '🔍 [CREATE-CHECKPOINT-16] In try block, reading currentInstrumentRef',
        );

        // CHECKPOINT 6: Instrument resolution - read from all possible sources
        logger.debug(
          '🔍 [CHECKPOINT-6] Instrument resolution from multiple sources',
          {
            currentInstrumentRef: currentInstrumentRef.current,
            currentInstrumentState: currentInstrument,
            harmonyInstrumentProp: harmonyInstrument,
            exerciseHarmonyInstrument: exercise?.harmonyInstrument,
            exerciseId: exercise?.id?.value,
            exerciseTitle: exercise?.title,
          },
        );

        // CRITICAL FIX: Read currentInstrument from ref to get the LATEST value
        // Using ref ensures we don't have stale closure issues
        const desiredInstrument = currentInstrumentRef.current as
          | KeyboardInstrumentType
          | undefined;

        // CRITICAL DEBUG: Log what HarmonyWidget receives from props AND state
        // console.log('🔍 [STATE-FLOW-4] HarmonyWidget createAudioNodeAttempt:', {
        //   harmonyInstrumentProp: harmonyInstrument,
        //   currentInstrumentState: currentInstrument,
        //   currentInstrumentRef: currentInstrumentRef.current,
        //   desiredInstrument,
        //   exerciseId: exercise?.id?.value,
        //   exerciseTitle: exercise?.title,
        //   exerciseHarmonyInstrument: exercise?.harmonyInstrument,
        //   hasExercise: !!exercise,
        // });

        logger.debug(
          '🔍 [CREATE-CHECKPOINT-17] Checking if desiredInstrument exists',
          {
            desiredInstrument,
            hasDesiredInstrument: !!desiredInstrument,
          },
        );

        logger.debug('🔍 [CHECKPOINT-6-RESULT] Resolved instrument', {
          desiredInstrument,
          willProceed: !!desiredInstrument,
          willReturnEarly: !desiredInstrument,
        });

        // CRITICAL: Don't create plugin until we have a valid instrument from exercise
        if (!desiredInstrument) {
          logger.debug(
            '🔍 [CREATE-CHECKPOINT-18-RETURN] No desiredInstrument, returning early',
          );
          logger.debug(
            '🔍 [CHECKPOINT-6-EARLY-RETURN] Cannot proceed - no instrument specified from any source',
          );
          logger.warn(
            '🎹 HarmonyWidget: No harmonyInstrument specified, waiting for exercise to load',
          );
          isCreatingPluginRef.current = false;
          return;
        }
        logger.debug(
          '🔍 [CREATE-CHECKPOINT-19] Has desiredInstrument, proceeding to singleton call',
        );
        logger.debug(
          '🔍 [CHECKPOINT-6-SUCCESS] Instrument resolved successfully',
          desiredInstrument,
        );

        logger.debug(
          '🔍 [HARMONY-WIDGET] About to get WamKeyboard from PluginManager',
          {
            desiredInstrument,
            contextState: context.state,
          },
        );
        logger.info(
          '🎹 HarmonyWidget: Requesting WamKeyboard from PluginManager with instrument:',
          desiredInstrument,
        );

        // PHASE 2 FIX: Use PluginManager instead of wamPluginSingleton
        // This unifies the two singleton systems and enables CC event routing
        // ✅ FIX: Use WindowRegistry instead of direct window access
        const coreServices = WindowRegistry.getCoreServices();
        if (!coreServices) {
          throw new Error(
            'CoreServices not available - cannot get PluginManager',
          );
        }

        // DIAGNOSTIC: Check if CoreServices is initialized
        const isInitialized = coreServices.isReady?.();
        logger.debug('🔍 [CREATE-CHECKPOINT-19.5] CoreServices state', {
          isInitialized,
          hasPluginManager: !!coreServices.getPluginManager,
        });

        // If CoreServices not initialized, initialize it now
        if (!isInitialized) {
          logger.debug(
            '🔍 [CREATE-CHECKPOINT-19.6] CoreServices not initialized, initializing now',
          );
          logger.info(
            'CoreServices not initialized, initializing to register plugins...',
          );
          try {
            await coreServices.initialize();
            logger.debug(
              '🔍 [CREATE-CHECKPOINT-19.7] CoreServices initialized successfully',
            );
            logger.info('CoreServices initialized successfully');
          } catch (initError) {
            logger.debug(
              '🔍 [CREATE-CHECKPOINT-19.8-ERROR] CoreServices initialization failed',
              initError,
            );
            logger.error('CoreServices initialization failed:', initError);
            isCreatingPluginRef.current = false;
            return;
          }
        }

        const pluginManager = coreServices.getPluginManager();
        if (!pluginManager) {
          throw new Error('PluginManager not available');
        }

        // Get WamKeyboardPlugin (wrapper) from PluginManager
        let keyboardPlugin = null;
        try {
          keyboardPlugin = pluginManager.getPlugin('wam-keyboard');
        } catch (error) {
          // Check retry limit (max 50 attempts = 5 seconds)
          const MAX_RETRIES = 50;
          const currentRetries = pluginCreationRetryCountRef.current;

          if (currentRetries >= MAX_RETRIES) {
            logger.debug(
              `🔍 [CREATE-CHECKPOINT-20-MAX-RETRIES] Plugin not registered after ${MAX_RETRIES} attempts (${MAX_RETRIES * 100}ms)`,
            );
            logger.error(
              'WamKeyboard plugin not registered after maximum retries - giving up',
            );
            isCreatingPluginRef.current = false;
            pluginCreationRetryCountRef.current = 0; // Reset for potential future attempts
            return;
          }

          logger.debug(
            `🔍 [CREATE-CHECKPOINT-20] Plugin not registered yet, will retry in 100ms (attempt ${currentRetries + 1}/${MAX_RETRIES})`,
          );
          logger.info(
            `WamKeyboard plugin not registered yet, retrying in 100ms... (attempt ${currentRetries + 1}/${MAX_RETRIES})`,
          );
          isCreatingPluginRef.current = false;
          pluginCreationRetryCountRef.current++;

          // Retry after a short delay to allow CoreServices to finish registering plugins
          setTimeout(() => {
            if (!wamPluginLoaded && !keyboardPluginRef.current) {
              logger.info(
                '🎹 HarmonyWidget: Retrying plugin creation after registration delay',
              );
              createAudioNodeAttempt();
            }
          }, 100);
          return;
        }

        // Reset retry counter on success
        pluginCreationRetryCountRef.current = 0;

        if (!keyboardPlugin) {
          logger.debug('🔍 [CREATE-CHECKPOINT-20.5] Plugin returned null');
          logger.error(
            'WamKeyboardPlugin not found in PluginManager (returned null after successful getPlugin call)',
          );
          isCreatingPluginRef.current = false;
          return;
        }

        // Ensure plugin is loaded and initialized
        if (keyboardPlugin.state === 'unloaded') {
          logger.info('Loading WamKeyboardPlugin...');
          await pluginManager.loadPlugin('wam-keyboard');
        }

        if (
          keyboardPlugin.state === 'loaded' ||
          keyboardPlugin.state === 'inactive'
        ) {
          logger.info('Activating WamKeyboardPlugin with instrument...', {
            desiredInstrument,
          });
          // CRITICAL FIX: Pass the desired instrument to activate() so it loads
          // the correct instrument from the start, avoiding the race condition
          // where grandpiano was loaded by default and then switched to wurlitzer
          await pluginManager.activatePlugin('wam-keyboard', {
            instrument: desiredInstrument,
          });
        }

        // Get the underlying WamKeyboard instance
        const plugin = keyboardPlugin.getWamKeyboard();
        if (!plugin) {
          logger.error(
            'WamKeyboard instance not initialized in plugin wrapper',
          );
          isCreatingPluginRef.current = false;
          return;
        }

        logger.debug('🔍 [HARMONY-WIDGET] Got WamKeyboard from PluginManager', {
          hasPlugin: !!plugin,
          hasAudioNode: !!plugin?.audioNode,
          currentInstrument: plugin?.audioNode?.currentInstrument,
        });
        logger.info(
          '🎹 HarmonyWidget: Got WamKeyboard from PluginManager:',
          plugin,
        );

        // Store the plugin instance
        keyboardPluginRef.current = plugin;

        // The plugin should already have an audio node
        const audioNode = plugin.audioNode;
        logger.info('🎹 HarmonyWidget: Got audio node from plugin:', audioNode);

        // Connect to master bus for proper mixing (with fallback to destination)
        try {
          const { Mixer } = await import('@/domains/playback/modules/tracks/mixing/Mixer.js');
          const mixer = Mixer.getInstance();
          const masterBusInput = mixer.getMasterBusInputAsAudioNode();
          if (masterBusInput) {
            audioNode.connect(masterBusInput);
            logger.info('🎹 HarmonyWidget: Connected to master bus for mixing');
          } else {
            audioNode.connect(context.destination);
            logger.info('🎹 HarmonyWidget: Connected to destination (master bus not ready)');
          }
        } catch (e) {
          // Fallback to direct destination if mixer not available
          audioNode.connect(context.destination);
          logger.info('🎹 HarmonyWidget: Connected to destination (mixer not available)');
        }

        // Check the gain node value
        if (audioNode.gainNode) {
          logger.info(
            '🎹 HarmonyWidget: Gain node value:',
            audioNode.gainNode.gain.value,
          );
        }

        // CRITICAL: Check what instrument is loaded and reload if needed!
        // desiredInstrument already calculated above when creating plugin
        const loadedInstrument = audioNode.currentInstrument;

        logger.info('🎹 HarmonyWidget: Checking loaded instrument vs desired', {
          loadedInstrument,
          desiredInstrument,
          currentInstrumentState: currentInstrument,
          harmonyInstrumentProp: harmonyInstrument,
          needsReload: loadedInstrument !== desiredInstrument,
        });

        if (loadedInstrument !== desiredInstrument) {
          logger.info(
            '🎹 HarmonyWidget: Loading desired instrument (mismatch detected)...',
            {
              from: loadedInstrument,
              to: desiredInstrument,
            },
          );

          // Clear events before switching
          if (audioNode.clearEvents) {
            audioNode.clearEvents();
          }

          await audioNode.loadInstrument(desiredInstrument);

          // Update state to match loaded instrument
          setCurrentInstrument(desiredInstrument);

          logger.info('✅ HarmonyWidget: Desired instrument loaded!', {
            instrument: desiredInstrument,
          });
        } else {
          logger.info('🎹 HarmonyWidget: Correct instrument already loaded', {
            instrument: loadedInstrument,
          });

          // Ensure state matches loaded instrument
          if (currentInstrument !== loadedInstrument) {
            setCurrentInstrument(loadedInstrument as KeyboardInstrumentType);
          }
        }

        setWamPluginLoaded(true);
        lifecycle.checkpoint('HARMONY_PLUGIN_LOADED', {
          instrument: loadedInstrument || 'unknown',
        });
        logger.info(
          '✅ WAM Keyboard plugin loaded and connected for HarmonyWidget',
        );

        // Set initial volume and ensure gain is not zero
        await audioNode.setParameterValues({
          volume: isMuted ? 0 : volume / 100,
        });

        // Force gain node to proper value if needed
        if (audioNode.gainNode && !isMuted) {
          audioNode.gainNode.gain.value = volume / 100;
          logger.info('🎹 HarmonyWidget: Set gain node to:', volume / 100);
        }

        // Successfully created, reset the flag
        logger.debug(
          '🔍 [CREATE-CHECKPOINT-20] Successfully created plugin, resetting flag',
        );
        isCreatingPluginRef.current = false;
      } catch (error) {
        logger.debug(
          '🔍 [CREATE-CHECKPOINT-21-ERROR] Error in try block',
          error,
        );
        logger.error('❌ Failed to create WAM Keyboard plugin:', error);
        isCreatingPluginRef.current = false;
      }
    } else {
      logger.debug(
        "🔍 [CREATE-CHECKPOINT-22-ELSE] Context not AudioContext or doesn't exist",
      );
      logger.info('🎹 HarmonyWidget: AudioContext not ready yet', {
        hasContext: !!context,
        contextState: context?.state,
      });
      isCreatingPluginRef.current = false;
    }
  }, [
    track.isReady,
    wamPluginLoaded,
    pluginClassLoaded,
    currentInstrument,
    exercise,
  ]); // Added currentInstrument and exercise - needed for closure

  // CHECKPOINT 4: Plugin creation trigger - when all conditions met
  // CRITICAL FIX: Removed audioServicesReady check to allow plugin creation with suspended AudioContext
  useEffect(() => {
    logger.debug('🔍 [CHECKPOINT-4] Plugin creation trigger useEffect', {
      windowAvailable: typeof window !== 'undefined',
      pluginClassLoaded,
      trackIsReady: track.isReady,
      audioServicesReady,
      wamPluginLoaded,
      hasPlugin: !!keyboardPluginRef.current,
      currentInstrumentState: currentInstrument,
      currentInstrumentRef: currentInstrumentRef.current,
      exerciseHarmonyInstrument: exercise?.harmonyInstrument,
      harmonyInstrumentProp: harmonyInstrument,
      allConditionsMet:
        typeof window !== 'undefined' &&
        pluginClassLoaded &&
        track.isReady &&
        !wamPluginLoaded,
      willCallCreateAudioNodeAttempt:
        typeof window !== 'undefined' &&
        pluginClassLoaded &&
        track.isReady &&
        !wamPluginLoaded,
    });

    logger.info('🎹 HarmonyWidget: Phase 2 effect check:', {
      window: typeof window !== 'undefined',
      pluginClassLoaded,
      trackIsReady: track.isReady,
      audioServicesReady,
      wamPluginLoaded,
      hasPlugin: !!keyboardPluginRef.current,
      shouldRun:
        typeof window !== 'undefined' &&
        pluginClassLoaded &&
        track.isReady &&
        !wamPluginLoaded,
    });

    if (typeof window === 'undefined') {
      logger.debug('🔍 [CHECKPOINT-4-SKIP] Window undefined, skipping');
      return;
    }
    // SEO OPTIMIZATION: Wait for scroll trigger before creating plugin
    // This prevents sample loading before user scrolls, keeping initial page load fast
    const samplesReady = WindowRegistry.getSamplesReady();

    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded || !samplesReady) {
      logger.debug('🔍 [CHECKPOINT-4-SKIP] Conditions not met', {
        pluginClassLoaded,
        trackIsReady: track.isReady,
        audioServicesReady,
        wamPluginLoaded,
        samplesReady,
        reason: !pluginClassLoaded
          ? 'plugin class not loaded'
          : !track.isReady
            ? 'track not ready'
            : !samplesReady
              ? 'samples not ready (waiting for scroll)'
              : 'plugin already loaded',
      });
      return;
    }

    logger.debug(
      '🔍 [CHECKPOINT-4-PROCEED] All conditions met, calling createAudioNodeAttempt',
    );

    // Add guard to prevent multiple instances
    if (keyboardPluginRef.current) {
      logger.info('🎹 HarmonyWidget: Plugin already loaded, skipping creation');
      return;
    }

    createAudioNodeAttempt();
  }, [
    track.isReady,
    wamPluginLoaded,
    pluginClassLoaded,
    createAudioNodeAttempt,
    samplesLoadedTrigger, // Re-run when samplesReady event fires (after scroll)
  ]);

  // Cleanup effect - dispose plugin when component unmounts
  useEffect(() => {
    return () => {
      logger.info('🎹 HarmonyWidget: Component unmounting, cleaning up...');

      // Reset the creation flag
      isCreatingPluginRef.current = false;

      // CRITICAL FIX: Clear the local ref but DON'T release from singleton!
      // This allows the singleton to keep the plugin alive and reuse it for the next exercise
      if (keyboardPluginRef.current) {
        try {
          // Clear scheduled events to stop playback
          if (keyboardPluginRef.current.audioNode) {
            keyboardPluginRef.current.audioNode.clearEvents();
            logger.debug('🔍 [CLEANUP] Cleared events from keyboard plugin');
          }

          // CRITICAL: Clear the local ref so the next exercise will call singleton.getOrCreateKeyboardPlugin()
          // But DON'T call releasePlugin() - this keeps the plugin cached in the singleton!
          // The singleton will return the SAME plugin and call loadInstrument() to switch instruments
          keyboardPluginRef.current = null;

          // DON'T call wamPluginSingleton.releasePlugin() - this would delete it from the cache!
          // By not releasing, the plugin stays in GlobalSampleCache and can be reused

          logger.info(
            '✅ HarmonyWidget local ref cleared (plugin kept in singleton cache for reuse)',
          );
        } catch (error) {
          logger.error('Error clearing HarmonyWidget:', error);
        }
      }

      // Clear any retry timeouts
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, []);

  // Handle volume changes - apply to both WAM plugin and PlaybackEngine
  useEffect(() => {
    const effectiveVolume = isMuted ? 0 : volume / 100;

    // Update WAM plugin volume (legacy path)
    if (keyboardPluginRef.current) {
      keyboardPluginRef.current.audioNode?.setParameterValues({
        volume: effectiveVolume,
      });
    }

    // Update PlaybackEngine harmony volume (new path)
    const coreServices = WindowRegistry.getCoreServices();
    const playbackEngine = coreServices?.getPlaybackEngine?.();
    if (playbackEngine) {
      playbackEngine.setInstrumentVolume('harmony', effectiveVolume);
      playbackEngine.setInstrumentMuted('harmony', isMuted);
      console.log('🔊 [HARMONY-WIDGET] Volume updated via PlaybackEngine:', { volume, isMuted, effectiveVolume });
    }
  }, [volume, isMuted]);

  // Handle instrument changes - reload instrument when currentInstrument changes
  // CRITICAL FIX: Track the previous instrument to prevent redundant loadInstrument() calls on initial load
  const previousInstrumentRef = useRef<KeyboardInstrumentType | undefined>(
    undefined,
  );

  useEffect(() => {
    console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] reloadInstrument useEffect triggered:', {
      currentInstrument,
      previousInstrument: previousInstrumentRef.current,
      hasPlugin: !!keyboardPluginRef.current?.audioNode,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      audioServicesReady,
    });

    const reloadInstrument = async () => {
      // Skip if no instrument specified yet
      if (!currentInstrument) {
        console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] No currentInstrument, skipping reload');
        return;
      }

      // CRITICAL FIX: Skip if this is the initial load (plugin just created)
      // The instrument was already loaded in createAudioNodeAttempt via WamKeyboard.initialize()
      if (
        previousInstrumentRef.current === undefined &&
        keyboardPluginRef.current?.audioNode
      ) {
        console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] Initial load detected - instrument already loaded, skipping redundant loadInstrument()');
        previousInstrumentRef.current = currentInstrument;
        return;
      }

      // CRITICAL FIX: Skip if instrument hasn't actually changed
      if (previousInstrumentRef.current === currentInstrument) {
        console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] Instrument unchanged, skipping reload');
        return;
      }

      if (keyboardPluginRef.current?.audioNode) {
        // Plugin exists - just reload the instrument
        console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] Plugin exists, calling loadInstrument():', {
          from: previousInstrumentRef.current,
          to: currentInstrument,
        });

        try {
          // Clear any existing events before switching instruments
          if (keyboardPluginRef.current.audioNode.clearEvents) {
            keyboardPluginRef.current.audioNode.clearEvents();
          }

          // Load the new instrument
          if (keyboardPluginRef.current.audioNode.loadInstrument) {
            console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] Calling audioNode.loadInstrument():', currentInstrument);
            await keyboardPluginRef.current.audioNode.loadInstrument(
              currentInstrument,
            );
            console.log('✅ [INSTRUMENT-SWITCH-DEBUG] Successfully loaded instrument:', currentInstrument);
            // Update the previous instrument tracker
            previousInstrumentRef.current = currentInstrument;
          }
        } catch (error) {
          console.error('❌ [INSTRUMENT-SWITCH-DEBUG] Failed to reload instrument:', error);
        }
      } else if (track.isReady && audioServicesReady && !wamPluginLoaded && WindowRegistry.getSamplesReady()) {
        // Plugin doesn't exist yet - create it with the new instrument
        // CRITICAL: Must wait for audioServicesReady AND samplesReady before calling createAudioNodeAttempt()
        console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] Creating plugin for new instrument:', currentInstrument);
        createAudioNodeAttempt();
        // Update the previous instrument tracker after creation
        previousInstrumentRef.current = currentInstrument;
      } else {
        console.log('🎹 [INSTRUMENT-SWITCH-DEBUG] Conditions not met for instrument loading:', {
          hasPlugin: !!keyboardPluginRef.current?.audioNode,
          trackIsReady: track.isReady,
          wamPluginLoaded,
          audioServicesReady,
          samplesReady: WindowRegistry.getSamplesReady(),
          reason: !track.isReady ? 'track not ready' : !audioServicesReady ? 'audio services not ready' : wamPluginLoaded ? 'plugin already loaded' : !WindowRegistry.getSamplesReady() ? 'samples not ready (waiting for scroll)' : 'unknown',
        });
      }
    };

    reloadInstrument();
  }, [
    currentInstrument,
    track.isReady,
    wamPluginLoaded,
    audioServicesReady,
    createAudioNodeAttempt,
  ]);

  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    logger.info('🎹 HarmonyWidget: Setting up audio service listeners...');

    // Check if services are already ready
    // ✅ FIX: Use WindowRegistry instead of direct window access
    const globalServices = WindowRegistry.getCoreServices();
    if (globalServices && globalServices.getAudioEngine) {
      try {
        const audioEngine = globalServices.getAudioEngine();
        if (audioEngine && audioEngine.isReady && audioEngine.isReady()) {
          logger.info('🎹 HarmonyWidget: Audio services already ready');
          setAudioServicesReady(true);

          // Check audio context state
          const context = audioEngine.getContext
            ? audioEngine.getContext()
            : null;
          if (context) {
            logger.info(
              '🎹 HarmonyWidget: Audio context state:',
              context.state,
            );
            if (context.state === 'suspended') {
              logger.info(
                '🎹 HarmonyWidget: Audio context is suspended, waiting for user gesture...',
              );
            }
          }
        }
      } catch (e) {
        logger.info('🎹 HarmonyWidget: Audio services not ready yet');
      }
    }

    const handleAudioReady = () => {
      logger.info('🎹 HarmonyWidget: Audio services ready event received');
      setAudioServicesReady(true);

      // Force check if we can create plugin now (also check samplesReady for SEO optimization)
      if (!wamPluginLoaded && pluginClassLoaded && track.isReady && WindowRegistry.getSamplesReady()) {
        logger.info(
          '🎹 HarmonyWidget: Audio ready, attempting to create plugin...',
        );
        createAudioNodeAttempt();
      }
    };

    const handleAudioContextStarted = () => {
      logger.info('🎹 HarmonyWidget: AudioContext started event received');
      setAudioServicesReady(true);
      // Trigger a retry by incrementing the counter
      setRetryCount((prev) => prev + 1);

      // Force check if we can create plugin now (also check samplesReady for SEO optimization)
      if (!wamPluginLoaded && pluginClassLoaded && track.isReady && WindowRegistry.getSamplesReady()) {
        logger.info(
          '🎹 HarmonyWidget: Audio context started, attempting to create plugin...',
        );
        createAudioNodeAttempt();
      }
    };

    window.addEventListener('audioServicesReady', handleAudioReady);
    window.addEventListener('audioContextStarted', handleAudioContextStarted);

    return () => {
      window.removeEventListener('audioServicesReady', handleAudioReady);
      window.removeEventListener(
        'audioContextStarted',
        handleAudioContextStarted,
      );
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [wamPluginLoaded]);

  // EventBus subscription for transport:stop (like Drummer/Metronome)
  useEffect(() => {
    // ✅ FIX: Use WindowRegistry instead of direct window access
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices || typeof coreServices.getEventBus !== 'function') {
      return;
    }

    const eventBus = coreServices.getEventBus();
    if (!eventBus) {
      return;
    }

    const handleTransportStop = () => {
      logger.debug('Transport stopped event received', { correlationId });

      // Clear scheduled events and stop playing notes
      if (keyboardPluginRef.current?.audioNode) {
        keyboardPluginRef.current.audioNode.clearEvents();

        if (keyboardPluginRef.current.audioNode.activeSampler?.releaseAll) {
          keyboardPluginRef.current.audioNode.activeSampler.releaseAll();
        }
      }
    };

    const unsubStop = eventBus.on('transport:stop', handleTransportStop);

    return () => {
      unsubStop();
    };
  }, [logger, correlationId]);

  // Retry plugin loading when audio services become ready
  useEffect(() => {
    logger.info('🎹 HarmonyWidget: Retry effect check:', {
      audioServicesReady,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      pluginClassLoaded,
      shouldRetry:
        audioServicesReady &&
        track.isReady &&
        !wamPluginLoaded &&
        pluginClassLoaded,
    });

    // SEO OPTIMIZATION: Also check samplesReady before creating plugin
    if (
      audioServicesReady &&
      track.isReady &&
      !wamPluginLoaded &&
      pluginClassLoaded &&
      WindowRegistry.getSamplesReady()
    ) {
      logger.info(
        '🎹 HarmonyWidget: Audio services ready, retrying plugin load...',
        {
          audioServicesReady,
          trackIsReady: track.isReady,
          wamPluginLoaded,
          pluginClassLoaded,
          hasPlugin: !!keyboardPluginRef.current,
        },
      );
      // Force a new attempt to create the audio node
      createAudioNodeAttempt();
    }
  }, [
    audioServicesReady,
    track.isReady,
    wamPluginLoaded,
    pluginClassLoaded,
    createAudioNodeAttempt,
    retryCount,
  ]);

  // Handle instrument changes - wrapped with audio context initialization
  const handleInstrumentChange = useCallback(
    withAudioContext(async (instrument: KeyboardInstrumentType) => {
      setCurrentInstrument(instrument);
      if (keyboardPluginRef.current) {
        const instrumentIndex =
          Object.values(KeyboardInstrument).indexOf(instrument);
        await keyboardPluginRef.current.audioNode?.setParameterValues({
          instrument: instrumentIndex,
        });
      }
    }),
    [],
  );

  // Test chord function - wrapped with audio context initialization
  const testChord = useCallback(
    withAudioContext(async () => {
      logger.info('🎹 testChord called:', {
        plugin: keyboardPluginRef.current,
        audioServicesReady,
        trackIsReady: track.isReady,
        wamPluginLoaded,
        pluginClassLoaded,
      });

      // Ensure audio services are ready
      if (!audioServicesReady) {
        logger.info(
          '🎹 Audio services not ready yet, waiting for audio context to start...',
        );
        // The withAudioContext wrapper should handle this, but let's make sure
      }

      // If plugin isn't loaded, try to use pre-loaded instrument first
      if (!keyboardPluginRef.current) {
        logger.info(
          '🎹 Plugin not loaded, checking for pre-loaded instrument...',
        );

        // Check for pre-loaded instrument
        const preloadedInstrument =
          GlobalSampleCache.getCachedInstrument('harmony-preloaded');
        if (preloadedInstrument && preloadedInstrument.audioNode) {
          logger.info(
            '🎹 ✅ Found pre-loaded harmony instrument! Using it for TEST.',
          );
          keyboardPluginRef.current = preloadedInstrument;
          setWamPluginLoaded(true);
          lifecycle.checkpoint('HARMONY_PLUGIN_LOADED', {
            instrument: 'preloaded',
          });

          // Ensure proper volume is set
          await preloadedInstrument.audioNode.setParameterValues({
            volume: isMuted ? 0 : volume / 100,
          });
        } else {
          // No pre-loaded instrument, check if we have cached URLs
          const testNote = 'Keyboards/grand-piano/v3/C4_v3.ogg';
          const cachedUrl = GlobalSampleCache.getCachedUrl(testNote);
          if (cachedUrl && cachedUrl.includes('supabase')) {
            logger.info(
              '🎹 ✅ Found cached URLs from Phase 2! Samples will load from cache.',
            );
          } else {
            logger.warn(
              '🎹 ⚠️ No cached URLs found. Samples will load fresh (6+ seconds).',
            );
          }

          // Try to create new instrument
          if (!wamPluginLoaded && pluginClassLoaded) {
            logger.info('🎹 Creating new instrument...');
            await createAudioNodeAttempt();

            // Wait a bit for the plugin to initialize
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      }

      if (keyboardPluginRef.current && keyboardPluginRef.current.audioNode) {
        const audioNode = keyboardPluginRef.current.audioNode;
        // Play a C major chord (C3, E3, G3) with staggered timing for a nice sound
        const notes = [
          { note: 60, velocity: 80 }, // C3
          { note: 64, velocity: 80 }, // E3
          { note: 67, velocity: 80 }, // G3
        ];

        const context = audioNode.context;
        const currentTime = context.currentTime;

        // Check Tone.js master volume
        const Tone = (window as any).Tone;
        if (Tone) {
          logger.info('🎹 Tone.js Master check:', {
            destinationVolume: Tone.Destination?.volume?.value,
            destinationMuted: Tone.Destination?.mute,
            masterVolume: Tone.Master?.volume?.value,
            masterMuted: Tone.Master?.mute,
            toneContext: Tone.context,
            toneContextState: Tone.context?.state,
            rawContext: Tone.context?.rawContext || Tone.context?._context,
          });

          // Ensure Tone.Destination is not muted
          if (Tone.Destination && Tone.Destination.mute) {
            logger.warn('🎹 WARNING: Tone.Destination is muted! Unmuting...');
            Tone.Destination.mute = false;
          }

          // Ensure volume is reasonable
          if (Tone.Destination?.volume && Tone.Destination.volume.value < -40) {
            logger.warn(
              '🎹 WARNING: Tone.Destination volume too low! Setting to 0dB',
            );
            Tone.Destination.volume.value = 0;
          }

          // CRITICAL: Ensure Tone.js is connected to the actual AudioContext destination
          const toneRawContext =
            Tone.context?.rawContext || Tone.context?._context || Tone.context;
          if (toneRawContext && toneRawContext !== context) {
            logger.error(
              '🎹 CRITICAL: Tone.js is using a different AudioContext!',
              {
                toneContext: toneRawContext,
                wamContext: context,
                same: toneRawContext === context,
              },
            );

            // This is the problem - Tone.js is not outputting to our AudioContext
            // We need to ensure the sampler connects properly
            logger.warn(
              '🎹 Audio contexts mismatch - this may cause no sound!',
            );

            // CRITICAL FIX: Connect Tone.Destination to the actual audio output
            logger.info('🎹 Attempting to fix audio routing...');
            try {
              // Get Tone's internal destination node
              const toneDestNode =
                Tone.Destination._internalChannels?.[0] ||
                Tone.Destination._volume ||
                Tone.Destination.input ||
                Tone.Destination;

              if (toneDestNode && context.destination) {
                // Try to get the native node
                let nativeNode = toneDestNode;
                if (toneDestNode._gainNode) {
                  nativeNode = toneDestNode._gainNode;
                } else if (toneDestNode.gain) {
                  nativeNode = toneDestNode;
                }

                // Disconnect and reconnect to proper destination
                try {
                  nativeNode.disconnect();
                } catch (e) {
                  // Already disconnected
                }

                nativeNode.connect(context.destination);
                logger.info(
                  '✅ FIXED: Connected Tone.Destination to actual audio output!',
                );

                // Also ensure Tone's master volume is reasonable
                if (Tone.Destination.volume) {
                  Tone.Destination.volume.value = 0; // 0dB = unity gain
                }
              }
            } catch (fixError) {
              logger.error('Failed to fix audio routing:', fixError);
            }
          }
        }

        logger.info('🎹 Audio context state:', {
          state: context.state,
          sampleRate: context.sampleRate,
          currentTime: currentTime,
          destination: context.destination,
          numberOfOutputs: audioNode.numberOfOutputs,
        });

        notes.forEach((noteData, index) => {
          // Stagger notes by 10ms for a more natural sound, with 50ms delay to ensure future scheduling
          const noteTime = currentTime + 0.05 + index * 0.01;
          audioNode.triggerNote(noteData.note, noteData.velocity, noteTime);
          logger.info(
            `🎹 Triggering note ${noteData.note} at time ${noteTime}`,
          );

          // Check if we can hear the audio by checking gain values
          if (audioNode.gainNode) {
            logger.info('🎹 Audio chain check:', {
              gainNodeValue: audioNode.gainNode.gain.value,
              contextDestination: context.destination,
              isMuted: isMuted,
              volumeSliderValue: volume,
              effectiveVolume: isMuted ? 0 : volume / 100,
            });
          }
        });

        logger.info('🎹 Test chord triggered');

        // Release notes after 1 second
        setTimeout(() => {
          notes.forEach((noteData) => {
            audioNode.releaseNote(noteData.note);
          });
        }, 1000);
      } else {
        logger.info('❌ Cannot play test chord - plugin not ready');
      }
    }),
    [wamPluginLoaded, pluginClassLoaded, createAudioNodeAttempt],
  );

  // Schedule harmony notes from exercise data
  // FAANG-STYLE SOLUTION: Use PlaybackEngine for harmony scheduling (matches DrummerWidget architecture)
  const registerHarmonyWithPlaybackEngine = useCallback(async () => {
    // PERFORMANCE FIX: Prevent multiple simultaneous registrations
    if (isRegisteringRef.current) {
      console.log('🎹 [HARMONY-WIDGET] Registration already in progress, skipping');
      return;
    }

    // PERFORMANCE FIX: Skip if already registered for this exercise + trigger combo
    const registrationKey = `${exercise?.id?.value || exercise?.id}-${samplesLoadedTrigger}`;
    if (lastRegisteredExerciseIdRef.current === registrationKey) {
      console.log('🎹 [HARMONY-WIDGET] Already registered for this exercise+trigger, skipping', {
        registrationKey,
      });
      return;
    }

    isRegisteringRef.current = true;

    const timestamp = new Date().toISOString();

    // 🎵 TEMPO FIX: Read BPM directly from MusicalTruthAuthority (the ONE source of truth)
    // Do NOT use the bpm state variable - it may be stale (initialized to 120 at component mount)
    const currentBpm = musicalTruth.getBPM();
    console.log(`🎵 [TEMPO] HarmonyWidget using BPM from musicalTruth: ${currentBpm}`);

    console.log(
      '🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithPlaybackEngine CALLED',
      {
        timestamp,
        currentBpm, // Log the actual BPM being used
        callStack: new Error().stack?.split('\n').slice(1, 4),
      },
    );

    // CRITICAL DIAGNOSTIC: Log exercise data IMMEDIATELY (before any early returns)
    logger.debug('🔍 [HARMONY-WIDGET-DEBUG] Exercise data at function start', {
      hasExercise: !!exercise,
      exerciseId: exercise?.id,
      exerciseTitle: exercise?.title,
      harmonyInstrument: exercise?.harmonyInstrument,
      harmonyInstrumentType: typeof exercise?.harmonyInstrument,
      harmonyInstrumentIsDefined: exercise?.harmonyInstrument !== undefined,
      harmonyInstrumentIsNull: exercise?.harmonyInstrument === null,
      harmonyNotesLength: exercise?.harmonyNotes?.length,
      exerciseKeys: exercise ? Object.keys(exercise) : [],
      exerciseConstructor: exercise?.constructor?.name,
    });

    const plugin = keyboardPluginRef.current;

    // NEW PLAYBACK ENGINE: Plugin is optional now - only needed for legacy manual chord progression
    // The new Scheduler handles harmony directly using buffers, not the WAM plugin
    if (!plugin || !plugin.audioNode) {
      console.warn(
        '⚠️ [HARMONY-WIDGET] No WAM plugin available - using Scheduler-only mode (buffers + PlaybackEngine)',
        {
          hasPlugin: !!plugin,
          hasAudioNode: !!plugin?.audioNode,
          usingNewPlaybackEngine: true,
        },
      );
    } else {
      console.log('✅ [HARMONY-WIDGET] Plugin and audioNode available');
    }

    if (!exercise?.harmonyNotes || exercise.harmonyNotes.length === 0) {
      console.error('❌ [HARMONY-WIDGET] No harmony notes to register', {
        hasExercise: !!exercise,
        hasHarmonyNotes: !!exercise?.harmonyNotes,
        harmonyNotesLength: exercise?.harmonyNotes?.length,
      });
      isRegisteringRef.current = false; // Reset flag before early return
      return;
    }
    console.log(
      '✅ [HARMONY-WIDGET] Exercise has harmony notes:',
      exercise.harmonyNotes.length,
    );

    console.log('🎹 [HARMONY-WIDGET] Registering harmony with PlaybackEngine');

    // Get CoreServices and PlaybackEngine
    // Phase 3.3: Use PlaybackEngine instead of RegionProcessor
    const coreServices = WindowRegistry.getCoreServices();
    if (!coreServices) {
      console.error('❌ [HARMONY-WIDGET] No core services available');
      isRegisteringRef.current = false; // Reset flag before early return
      return;
    }
    console.log('✅ [HARMONY-WIDGET] Core services available');

    const playbackEngine = coreServices.getPlaybackEngine();
    if (!playbackEngine) {
      console.error('❌ [HARMONY-WIDGET] No PlaybackEngine available');
      isRegisteringRef.current = false; // Reset flag before early return
      return;
    }
    console.log('✅ [HARMONY-WIDGET] PlaybackEngine available');

    // CRITICAL: Inject harmony buffers into PlaybackEngine for direct scheduling
    // This enables instant stop functionality by tracking AudioBufferSourceNodes
    console.log('🔧 [HARMONY-WIDGET] Starting buffer injection...');
    try {
      const { GlobalSampleCache } =
        await import('@/domains/playback/modules/storage/cache/GlobalSampleCache.js');
      const sampleCache = GlobalSampleCache.getInstance();
      console.log('✅ [HARMONY-WIDGET] Got GlobalSampleCache instance');

      // CRITICAL: Get the instrument name BEFORE loading buffers
      // We need this to find the correct instrument-specific cache keys
      // FIX: Use shared constant to ensure consistency with HarmonyPreloadStrategy
      const instrument = exercise.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT;

      // CRITICAL DIAGNOSTIC: Log exercise data to verify harmonyInstrument field
      console.log('🎹 [HARMONY-WIDGET] Exercise instrument detection:', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        harmonyInstrument: exercise.harmonyInstrument,
        harmonyInstrumentType: typeof exercise.harmonyInstrument,
        harmonyInstrumentIsDefined: exercise.harmonyInstrument !== undefined,
        resolvedInstrument: instrument,
        exerciseKeys: Object.keys(exercise),
      });
      console.log(
        '🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers:',
        instrument,
      );

      // CRITICAL FIX: Use proper public API to get all cached keys
      // Previously used private property access which only worked sometimes
      const allCachedKeys = sampleCache.getAllSampleKeys();
      const harmonyCachedKeys = allCachedKeys.filter((key: string) =>
        key.startsWith(`${instrument}-`),
      );

      // DEBUG: Check what type of buffers are in cache using public API
      const cachedBufferTypes: Record<string, string> = {};
      for (const key of harmonyCachedKeys.slice(0, 3)) {
        const hasDecodedBuffer = sampleCache.getCachedBuffer(key) !== undefined;
        const hasRawBuffer = (await sampleCache.getCachedRawBuffer(key)) !== undefined;
        cachedBufferTypes[key] = hasDecodedBuffer
          ? 'AudioBuffer'
          : hasRawBuffer
            ? 'ArrayBuffer'
            : 'none';
      }

      logger.debug('🔍 [HARMONY-WIDGET] Cache diagnostic for ' + instrument, {
        totalKeys: harmonyCachedKeys.length,
        keys: harmonyCachedKeys.slice(0, 5),
        bufferTypes: cachedBufferTypes,
      });

      // CRITICAL: Check if ALL required notes for THIS exercise are cached
      // This prevents registering before IntersectionObserver finishes preloading
      const midiToNoteName = (midi: number): string => {
        const noteNames = [
          'C',
          'Cs',
          'D',
          'Ds',
          'E',
          'F',
          'Fs',
          'G',
          'Gs',
          'A',
          'As',
          'B',
        ];
        const octave = Math.floor(midi / 12) - 1;
        const noteName = noteNames[midi % 12];
        return `${noteName}${octave}`;
      };

      // CRITICAL FIX: Apply octave shift to match preloader behavior
      // Wurlitzer samples are stored 1 octave lower to match Logic export
      const octaveShift = instrument === 'wurlitzer' ? 12 : 0;
      const requiredNotes = exercise.harmonyNotes.map((note) =>
        midiToNoteName(note.pitch - octaveShift),
      );
      const uniqueRequiredNotes = [...new Set(requiredNotes)];

      // Extract cached note names from cache keys (e.g., 'grandpiano-v1-C4' -> 'C4')
      const cachedNoteNames = new Set(
        harmonyCachedKeys.map((key) => key.split('-').pop()).filter(Boolean),
      );

      // CRITICAL FIX: Allow partial sample sets - HarmonySchedulerV2 has fallback logic
      // Changed from 100% requirement to 50% to handle missing samples gracefully
      const cachedCount = uniqueRequiredNotes.filter((noteName) =>
        cachedNoteNames.has(noteName),
      ).length;
      const coveragePercentage =
        (cachedCount / uniqueRequiredNotes.length) * 100;
      const minCoverageRequired = 50; // At least 50% of samples must be available

      if (coveragePercentage < minCoverageRequired) {
        const missingNotes = uniqueRequiredNotes.filter(
          (note) => !cachedNoteNames.has(note),
        );
        // TIMING FIX: This warning typically appears when samplesReady fires before full preload completes
        // Will automatically retry when samplesPreloaded event fires with fully loaded samples
        console.warn(
          '⚠️ [HARMONY-WIDGET] Insufficient samples - waiting for preload to complete',
          {
            exerciseId: exercise.id,
            exerciseTitle: exercise.title,
            requiredNotes: uniqueRequiredNotes.length,
            cachedNotes: cachedCount,
            coveragePercentage: coveragePercentage.toFixed(1) + '%',
            minRequired: minCoverageRequired + '%',
            missingNotes: missingNotes.slice(0, 5), // Limit to first 5 for readability
            totalCachedKeys: harmonyCachedKeys.length,
            hint: 'Will retry on samplesPreloaded event',
          },
        );
        // CRITICAL FIX: Reset registration flag so next attempt (after samplesPreloaded) can proceed
        isRegisteringRef.current = false;
        return; // Exit early, will retry when samplesPreloaded event fires
      }

      const missingNotes = uniqueRequiredNotes.filter(
        (note) => !cachedNoteNames.has(note),
      );
      if (missingNotes.length > 0) {
        console.log(
          '⚠️ [HARMONY-WIDGET] Proceeding with partial samples - scheduler will use fallbacks',
          {
            coveragePercentage: coveragePercentage.toFixed(1) + '%',
            cachedNotes: cachedCount,
            missingNotes,
          },
        );
      } else {
        console.log(
          '✅ [HARMONY-WIDGET] All required samples cached, proceeding with registration',
          {
            requiredNotes: uniqueRequiredNotes,
            cachedKeys: harmonyCachedKeys.length,
          },
        );
      }

      const harmonyBuffers = new Map<string, AudioBuffer>();

      // Get audioContext FIRST - we need it to decode raw ArrayBuffers
      // (same way CoreServices does it - ensures same context for all instruments)
      const audioEngine = coreServices.getAudioEngine();
      const audioContext = await audioEngine.getContext();

      // Instead of iterating all possible notes, iterate what's actually cached
      let buffersFound = 0;
      let buffersDecoded = 0;
      for (const cacheKey of harmonyCachedKeys) {
        // Step 1: Try to get decoded AudioBuffer first (fast path)
        let buffer = sampleCache.getCachedBuffer(cacheKey);

        // Step 2: If no decoded buffer, try raw ArrayBuffer and decode it
        // (HarmonyPreloadStrategy caches raw ArrayBuffers, not decoded AudioBuffers)
        if (!buffer && audioContext) {
          const rawBuffer = await sampleCache.getCachedRawBuffer(cacheKey);
          if (rawBuffer) {
            try {
              // Decode the raw ArrayBuffer using current AudioContext
              buffer = await audioContext.decodeAudioData(rawBuffer.slice(0));
              buffersDecoded++;

              // Cache the decoded buffer for next time (fast path)
              await sampleCache.cacheBuffer(cacheKey, buffer, {
                isContextCompatible: true,
              });
            } catch (decodeError) {
              console.error(`❌ [HARMONY-WIDGET] Failed to decode ${cacheKey}:`, decodeError);
            }
          }
        }

        if (buffer) {
          // Convert 'wurlitzer-v3-Cs4' to 'v3-Cs4' for PlaybackEngine
          // Remove the instrument prefix to get the layer-note format
          const keyWithoutPrefix = cacheKey.replace(`${instrument}-`, '');
          harmonyBuffers.set(keyWithoutPrefix, buffer);
          buffersFound++;

          // 🔍 DIAGNOSTIC: Log F note buffer details
          if (cacheKey.includes('-F') && !cacheKey.includes('-Fs')) {
            console.log(`🔍 [F-NOTE-WIDGET] ${cacheKey} → ${keyWithoutPrefix}: length=${buffer.length}, duration=${buffer.duration.toFixed(2)}s, sampleRate=${buffer.sampleRate}`);
          }
        }
      }

      console.log(`✅ [HARMONY-WIDGET] Buffer retrieval complete:`, {
        totalCacheKeys: harmonyCachedKeys.length,
        buffersFound,
        buffersDecoded,
        fromMemoryCache: buffersFound - buffersDecoded,
      });

      if (buffersFound > 0) {

        console.log('🎧 [HARMONY-WIDGET] AudioContext info:', {
          hasAudioEngine: !!audioEngine,
          hasAudioContext: !!audioContext,
          hasDestination: !!audioContext?.destination,
          destinationType: audioContext?.destination?.constructor?.name,
          state: audioContext?.state,
        });

        if (audioContext?.destination) {
          // Load instrument config to get per-note velocity ranges
          // This tells PlaybackEngine which velocity layer each note actually has
          // (instrument variable already defined above at line 1205)
          console.log(
            '📖 [HARMONY-WIDGET] Loading instrument config:',
            instrument,
          );

          let perNoteVelocityRanges: Record<string, any[]> | undefined;
          try {
            if (instrument === 'wurlitzer') {
              const wurlitzerConfig =
                await import('@/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json');
              perNoteVelocityRanges =
                wurlitzerConfig.default.perNoteVelocityRanges;
            } else if (instrument === 'grandpiano') {
              const grandPianoConfig =
                await import('@/domains/playback/data/instruments/piano/grand-piano.json');
              perNoteVelocityRanges =
                grandPianoConfig.default.perNoteVelocityRanges;
            } else if (instrument === 'rhodes') {
              const rhodesConfig =
                await import('@/domains/playback/data/instruments/rhodes/rhodes-piano.json');
              perNoteVelocityRanges =
                rhodesConfig.default.perNoteVelocityRanges;
            }

            console.log('✅ [HARMONY-WIDGET] Loaded per-note velocity ranges', {
              instrument,
              hasRanges: !!perNoteVelocityRanges,
              noteCount: perNoteVelocityRanges
                ? Object.keys(perNoteVelocityRanges).length
                : 0,
            });
          } catch (error) {
            console.error(
              '❌ [HARMONY-WIDGET] Failed to load instrument config',
              error,
            );
          }

          // Use instrument gain node for volume control, fallback to destination
          const harmonyGainNode = playbackEngine.getOrCreateInstrumentGainNode('harmony');
          const destination = harmonyGainNode || audioContext.destination;

          playbackEngine.setHarmonyBuffers(
            harmonyBuffers,
            destination,
            perNoteVelocityRanges,
            instrument,
          );

          // Apply initial volume/mute state
          const effectiveVolume = isMuted ? 0 : volume / 100;
          playbackEngine.setInstrumentVolume('harmony', effectiveVolume);
          playbackEngine.setInstrumentMuted('harmony', isMuted);
          console.log(
            '✅ [HARMONY-WIDGET] Harmony buffers injected into PlaybackEngine',
            {
              instrument,
              buffersInjected: buffersFound,
              audioContextState: audioContext.state,
              hasVelocityRanges: !!perNoteVelocityRanges,
            },
          );

          // CRITICAL FIX: Switch WAM plugin instrument to match the exercise
          // This ensures only the correct instrument plays
          if (
            keyboardPluginRef.current?.audioNode &&
            instrument !== currentInstrument
          ) {
            console.log(
              '🔄 [HARMONY-WIDGET] Switching WAM plugin instrument:',
              {
                from: currentInstrument,
                to: instrument,
                exerciseId: exercise.id,
              },
            );

            try {
              if (keyboardPluginRef.current.audioNode.loadInstrument) {
                await keyboardPluginRef.current.audioNode.loadInstrument(
                  instrument,
                );
                console.log(
                  '✅ [HARMONY-WIDGET] WAM plugin instrument switched to:',
                  instrument,
                );
                // Update state to match
                setCurrentInstrument(instrument);
              }
            } catch (error) {
              console.error(
                '❌ [HARMONY-WIDGET] Failed to switch WAM plugin instrument:',
                error,
              );
            }
          }
        } else {
          console.error(
            '❌ [HARMONY-WIDGET] No audioContext.destination available',
          );
        }
      } else {
        // CRITICAL FIX: Clear old buffers to prevent playing wrong instrument
        // When switching exercises, if new instrument's buffers aren't cached yet,
        // we must clear PlaybackEngine's old buffers to avoid playing wrong instrument
        const audioEngine = coreServices.getAudioEngine();
        const audioContext = await audioEngine.getContext();
        if (audioContext?.destination) {
          playbackEngine.setHarmonyBuffers(
            new Map(),
            audioContext.destination,
            undefined,
            instrument,
          );
          console.warn(
            '⚠️ [HARMONY-WIDGET] No harmony buffers found in cache - cleared old buffers to prevent wrong instrument playing',
          );
        } else {
          console.warn('⚠️ [HARMONY-WIDGET] No harmony buffers found in cache');
        }
      }
    } catch (error) {
      console.error(
        '❌ [HARMONY-WIDGET] Failed to inject harmony buffers',
        error,
      );
    }

    // Convert harmony notes to Region format
    // PlaybackEngine now accepts objects for MIDI tick precision (480 PPQ)

    // CRITICAL: Find the earliest event position (note OR control change) to normalize MIDI start to 1:1:0
    // MIDI files may be recorded starting at measure 9, 17, etc.
    // CC events (like sustain pedal) often appear BEFORE the first note, so we must consider both!
    // We need to shift all positions so the first event starts at measure 0 (which represents bar 1 in 0-indexed calculation)

    // Collect all event positions (notes + control changes)
    const allEventPositions = [
      ...exercise.harmonyNotes.map((note) => note.position),
      ...(exercise.harmonyControlChanges || []).map((cc) => cc.position),
    ];

    // Find the earliest event (note OR control change)
    const firstEvent = allEventPositions.reduce<
      (typeof allEventPositions)[0] | null
    >((earliest, pos) => {
      if (!earliest) return pos;

      const earliestTotal =
        earliest.measure * 16 +
        earliest.beat * 4 +
        (earliest.subdivision || 0) +
        (earliest.tick || 0) / 480;
      const currentTotal =
        pos.measure * 16 +
        pos.beat * 4 +
        (pos.subdivision || 0) +
        (pos.tick || 0) / 480;

      return currentTotal < earliestTotal ? pos : earliest;
    }, null);

    // FIX: Use measure 0 (not 1) as target - parsePosition() uses 0-indexed calculation
    // measure: 0 → (0 * 4) + beat = correct timing for bar 1
    const measureOffset = firstEvent ? firstEvent.measure : 0; // Shift to start at measure 0 (bar 1)
    const beatOffset = firstEvent ? firstEvent.beat : 0;
    const subdivisionOffset = firstEvent ? firstEvent.subdivision || 0 : 0;
    const tickOffset = firstEvent ? firstEvent.tick || 0 : 0;

    console.log(
      '🎼 [HARMONY-WIDGET] Normalizing MIDI to start at measure 0 (bar 1):',
      {
        firstEventOriginal: firstEvent,
        offsets: { measureOffset, beatOffset, subdivisionOffset, tickOffset },
        totalNotes: exercise.harmonyNotes.length,
        totalCCEvents: exercise.harmonyControlChanges?.length || 0,
        result:
          'MIDI file start → measure 0 (bar 1 of exercise), all events shifted by offset',
      },
    );

    // LOG: All notes from Supabase in order
    console.log('[HARMONY-FLOW] STEP 1 - Supabase notes:', exercise.harmonyNotes.slice(0, 10).map((n: any, i: number) => `${i+1}: ${n.noteName} (MIDI ${n.pitch}) ticks=${n.ticks}`));

    const harmonyEvents = exercise.harmonyNotes.map(
      (note: any, index: number) => {
        // Convert MIDI ticks to seconds using current tempo
        // Formula: durationSeconds = (durationTicks / 480) * (60 / currentBpm)
        // - 480 = MIDI PPQ (Pulses Per Quarter note) - STANDARD MIDI RESOLUTION
        // - 60 / currentBpm = seconds per quarter note
        // - durationTicks / 480 = number of quarter notes
        // - result = duration in seconds
        const durationSeconds = note.durationTicks
          ? (note.durationTicks / 480) * (60 / currentBpm)
          : 2; // Fallback to 2 seconds if durationTicks missing

        // DIAGNOSTIC: Log first 3 notes to verify BPM and duration calculation
        if (index < 3) {
          console.log(`[HARMONY DURATION DIAGNOSTIC] Note ${index + 1}:`, {
            durationTicks: note.durationTicks,
            currentBpm,
            calculation: `(${note.durationTicks} / 480) * (60 / ${currentBpm})`,
            durationSeconds,
            expectedAt69BPM: (note.durationTicks / 480) * (60 / 69),
          });
        }

        // PPQ DIAGNOSTIC: Verify position.tick and durationTicks are both at 480 PPQ
        if (index < 3) {
          console.log(`[PPQ DIAGNOSTIC] Note ${index + 1}:`, {
            positionTick: note.position.tick || 0,
            durationTicks: note.durationTicks,
            tickRatio: (
              (note.position.tick || 0) / (note.durationTicks || 1)
            ).toFixed(2),
            expectedPPQ: 480,
            suspectedPPQ_ifDouble:
              'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ',
            rawPosition: note.position,
            interpretation480PPQ: `tick ${note.position.tick} / 480 = ${((note.position.tick || 0) / 480).toFixed(3)} beats`,
            interpretation960PPQ: `tick ${note.position.tick} / 960 = ${((note.position.tick || 0) / 960).toFixed(3)} beats`,
          });
        }

        // 🚨 CRITICAL FIX: Use absolute ticks from database (calculated by backend MIDI parser)
        // The backend already calculated absolute ticks when parsing the MIDI file
        const absoluteTicks = note.ticks; // Use ticks directly from database

        // DIAGNOSTIC: Log note data to see if ticks field exists
        if (index < 5 || index === 8) {
          console.log(
            `[HARMONY WIDGET] Note ${index + 1} RAW DATA from database:`,
            {
              id: note.id,
              ticks: note.ticks,
              ticksType: typeof note.ticks,
              ticksUndefined: note.ticks === undefined,
              pitch: note.pitch,
              noteName: note.noteName,
              position: note.position,
              durationTicks: note.durationTicks,
              allKeys: Object.keys(note),
            },
          );
        }

        const eventObject = {
          position: {
            measure: note.position.measure - measureOffset,
            beat: note.position.beat - beatOffset,
            subdivision: (note.position.subdivision || 0) - subdivisionOffset,
            tick: (note.position.tick || 0) - tickOffset, // CRITICAL: Preserve MIDI tick precision (480 PPQ)
          },
          type: 'harmony-note',
          velocity: note.velocity / 127, // Normalize to 0-1
          duration: durationSeconds, // Use actual MIDI duration
          data: {
            pitch: note.pitch,
            noteName: note.noteName || '',
            midiNote: note.pitch,
            velocity: note.velocity, // Keep original 0-127 for logging
            ticks: absoluteTicks, // 🚨 FIX: Include absolute ticks for accurate timing
            durationTicks: note.durationTicks, // Include duration in ticks
            originalBpm: exercise.bpm, // 🚨 CRITICAL FIX: Include original MIDI file BPM for tick-to-time conversion
          },
        };

        // DIAGNOSTIC: Verify ticks are being set correctly in event object
        if (index < 5 || index === 8) {
          console.log(
            `[HARMONY WIDGET] Note ${index + 1} EVENT OBJECT created:`,
            {
              noteName: note.noteName,
              absoluteTicksVariable: absoluteTicks,
              eventDataTicks: eventObject.data.ticks,
              areEqual: absoluteTicks === eventObject.data.ticks,
            },
          );
        }

        return eventObject;
      },
    );

    // Add control change events (sustain pedal, expression, etc.) if present
    const controlChangeEvents = (exercise.harmonyControlChanges || []).map(
      (cc, index) => {
        // DIAGNOSTIC: Log CC64 absolute ticks from database
        if (cc.cc === 64 && index < 3) {
          console.log(
            `[HARMONY WIDGET] CC64 event ${index + 1} from database:`,
            {
              cc: cc.cc,
              value: cc.value,
              absoluteTicks: cc.ticks,
              position: cc.position,
            },
          );
        }

        // Calculate adjusted position (may be negative if CC event is before first note)
        const rawPosition = {
          measure: cc.position.measure - measureOffset,
          beat: cc.position.beat - beatOffset,
          subdivision: (cc.position.subdivision || 0) - subdivisionOffset,
          tick: (cc.position.tick || 0) - tickOffset,
        };

        // CRITICAL FIX: Clamp to prevent negative positions
        // CC events (like sustain pedal down) often appear BEFORE the first note
        // Negative positions would cause events to be scheduled incorrectly
        const adjustedPosition = {
          measure: Math.max(0, rawPosition.measure),
          beat: Math.max(0, rawPosition.beat),
          subdivision: Math.max(0, rawPosition.subdivision),
          tick: Math.max(0, rawPosition.tick),
        };

        // Warn if clamping occurred (indicates CC event was before first note)
        if (
          rawPosition.measure < 0 ||
          rawPosition.beat < 0 ||
          rawPosition.subdivision < 0 ||
          rawPosition.tick < 0
        ) {
          console.warn(
            '[CC64 CONVERSION] ⚠️ Negative position detected and clamped:',
            {
              ccNumber: cc.cc,
              ccValue: cc.value,
              originalPosition: cc.position,
              offsets: {
                measureOffset,
                beatOffset,
                subdivisionOffset,
                tickOffset,
              },
              rawPosition,
              clampedPosition: adjustedPosition,
              explanation: 'CC event appeared before first note in MIDI file',
            },
          );
        }

        return {
          position: adjustedPosition,
          type: 'harmony-control-change',
          velocity: 0, // Not used for CC events
          duration: 0, // Not used for CC events
          data: {
            cc: cc.cc, // CC number (64 = sustain pedal)
            value: cc.value, // CC value (0-127)
            ticks: cc.ticks, // 🚨 FIX: Include absolute ticks for accurate timing
            originalBpm: exercise.bpm, // 🚨 CRITICAL FIX: Include original MIDI file BPM for tick-to-time conversion
          },
        };
      },
    );

    // Combine note events and control change events
    const allHarmonyEvents = [...harmonyEvents, ...controlChangeEvents];

    // DIAGNOSTIC: Verify ticks are preserved in combined array
    const firstFewNotes = allHarmonyEvents
      .filter((e: any) => e.type === 'harmony-note')
      .slice(0, 3);
    console.log(
      '[HARMONY WIDGET] allHarmonyEvents - first 3 notes after combining:',
      firstFewNotes.map((e: any, i: number) => ({
        index: i + 1,
        noteName: e.data?.noteName,
        ticks: e.data?.ticks,
        position: e.position,
      })),
    );

    // Enhanced diagnostic logging for CC64 debugging
    const cc64Events = controlChangeEvents.filter((e: any) => e.data.cc === 64);
    console.log('🎛️ [HARMONY-WIDGET] Control changes and durations:', {
      noteCount: harmonyEvents.length,
      controlChangeCount: controlChangeEvents.length,
      totalEvents: allHarmonyEvents.length,
      sustainEvents: cc64Events.length,
      cc64Timeline: cc64Events.map((e: any) => ({
        position: `${e.position.measure}:${e.position.beat}:${e.position.subdivision}:${e.position.tick}`,
        value: e.data.value,
        pedalState: e.data.value >= 64 ? 'DOWN' : 'UP',
      })),
      sampleDurations: harmonyEvents.slice(0, 5).map((e: any) => ({
        note: e.data.noteName,
        durationSeconds: e.duration.toFixed(3),
      })),
      sampleControlChanges: controlChangeEvents.slice(0, 5).map((e: any) => ({
        cc: e.data.cc,
        value: e.data.value,
        position: e.position,
        type: e.type,
      })),
      currentBpm,
    });

    const harmonyRegion = {
      id: `harmony-region-${exercise.id?.value || 'default'}`,
      trackId: 'harmony-widget-track',
      startTime: 0,
      duration: (exercise.durationBeats || 32) * (60 / currentBpm),
      pattern: {
        id: `harmony-pattern-${exercise.id?.value || 'default'}`,
        name: 'Harmony Pattern',
        type: 'harmony',
        events: allHarmonyEvents, // Includes both notes and control changes
      },
    };

    // Register track with PlaybackEngine
    // Use updateTracks if already running, registerTracks if not
    try {
      const trackData = [
        {
          id: 'harmony-widget-track',
          name: 'Harmony',
          instrumentType: 'harmony',
          exerciseId: exercise.id?.value, // For caching CC64 timeline and event schedule
          regions: [harmonyRegion],
          audioNode: plugin?.audioNode, // Optional: only used for legacy manual chord progression mode
        },
      ];

      // Check if PlaybackEngine is already running (play button was clicked before harmony was ready)
      const isRunning = (playbackEngine as any).isRunning;

      // FAANG FIX: Pass exercise metadata to PlaybackEngine for early instrument detection
      // FIX: Use shared constant to ensure consistency with HarmonyPreloadStrategy
      const exerciseMetadata = {
        harmonyInstrument: exercise.harmonyInstrument || DEFAULT_HARMONY_INSTRUMENT,
      };

      console.log(
        '🚨🚨🚨 [TIMING-DIAGNOSTIC] About to register harmony track!',
        {
          timestamp: new Date().toISOString(),
          isRunning,
          method: isRunning ? 'updateTracks' : 'registerTracks',
          trackId: trackData[0].id,
          regionsCount: trackData[0].regions.length,
          eventsCount: allHarmonyEvents.length,
        },
      );

      if (isRunning) {
        console.log(
          '⚡ [HARMONY-WIDGET] PlaybackEngine already running - using updateTracks()',
        );
        playbackEngine.updateTracks(trackData, exerciseMetadata);
      } else {
        console.log(
          '📝 [HARMONY-WIDGET] PlaybackEngine not running yet - using registerTracks()',
        );
        playbackEngine.registerTracks(trackData);
        // Also set instrument type early for registerTracks path
        (playbackEngine as any).currentHarmonyInstrument =
          exerciseMetadata.harmonyInstrument;
      }

      console.log(
        '✅✅✅ [TIMING-DIAGNOSTIC] Harmony track registration completed!',
        {
          timestamp: new Date().toISOString(),
        },
      );

      console.log(
        '✅ [HARMONY-WIDGET] Harmony registered with PlaybackEngine',
        {
          eventsCount: harmonyEvents.length,
          duration: harmonyRegion.duration,
          currentBpm, // Using musicalTruth.getBPM() - the ONE source of truth
          method: isRunning ? 'updateTracks' : 'registerTracks',
        },
      );

      logger.info('🎹 Harmony registered with PlaybackEngine', {
        noteCount: harmonyEvents.length,
        exerciseId: exercise.id?.value,
        currentBpm, // Using musicalTruth.getBPM() - the ONE source of truth
        isRunning,
      });

      // PERFORMANCE FIX: Mark registration complete for this exercise+trigger
      lastRegisteredExerciseIdRef.current = `${exercise?.id?.value || exercise?.id}-${samplesLoadedTrigger}`;
    } catch (error) {
      console.error('❌ [HARMONY-WIDGET] Failed to register harmony:', error);
      logger.error(
        'Failed to register harmony with PlaybackEngine',
        error as Error,
      );
    } finally {
      isRegisteringRef.current = false;
    }
  }, [exercise?.id, samplesLoadedTrigger]); // PERFORMANCE FIX: Use stable exercise.id, not whole object

  // Schedule chord progression (fallback when no exercise harmony_notes)
  const scheduleProgression = useCallback(() => {
    const plugin = keyboardPluginRef.current;
    if (!plugin || !track.isPlaying) return;

    const selectedProg =
      chordProgressions[selectedProgression as keyof typeof chordProgressions];
    if (!selectedProg) return;

    const context = track.track?.audioContext;
    if (!context) return;

    // 🎵 TEMPO FIX: Read BPM directly from MusicalTruthAuthority (the ONE source of truth)
    const currentBpm = musicalTruth.getBPM();

    // Get current transport time
    const currentTime = context.currentTime;
    const beatDuration = 60 / currentBpm; // Duration of one beat in seconds

    // Clear any existing pattern
    currentPatternRef.current = [];

    // Schedule the progression
    let scheduleTime = currentTime + 0.1; // Small lookahead

    selectedProg.forEach((item) => {
      const chordDuration = item.duration * beatDuration;

      // Play the chord
      plugin.playChord(item.chord, 70, chordDuration - 0.05, 4); // Slightly shorter for note separation

      // Store pattern info
      currentPatternRef.current.push({
        chord: item.chord,
        time: scheduleTime,
        duration: chordDuration,
      });

      // Update current chord indicator
      setTimeout(
        () => {
          if (track.isPlaying) {
            onNextChord();
          }
        },
        (scheduleTime - currentTime) * 1000,
      );

      scheduleTime += chordDuration;
    });

    lastScheduledTimeRef.current = scheduleTime;
  }, [selectedProgression, onNextChord]); // TEMPO FIX: Removed bpm from deps - we now read directly from musicalTruth.getBPM()

  // CHECKPOINT 10: PlaybackEngine registration - track when and why registration runs
  // PERFORMANCE FIX: Use stable primitives (trackIsReady, harmonyNoteCount) instead of object references
  useEffect(() => {
    const timestamp = Date.now();
    const currentExercise = exerciseRef.current;
    const currentIsPlaying = isPlayingRef.current;

    logger.debug('🔍 [CHECKPOINT-10] Registration effect triggered', {
      timestamp,
      currentInstrumentState: currentInstrument,
      currentInstrumentRef: currentInstrumentRef.current,
      exerciseHarmonyInstrument: currentExercise?.harmonyInstrument,
      exerciseId: currentExercise?.id?.value,
      exerciseTitle: currentExercise?.title,
    });

    logger.info('🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered:', {
      timestamp,
      isPlaying: currentIsPlaying,
      trackIsReady,  // PERFORMANCE FIX: Use stable primitive
      wamPluginLoaded,
      hasPlugin: !!keyboardPluginRef.current,
      hasExercise: !!currentExercise,
      hasHarmonyNotes: harmonyNoteCount > 0,  // PERFORMANCE FIX: Use stable primitive
      harmonyNotesCount: harmonyNoteCount,  // PERFORMANCE FIX: Use stable primitive
      exerciseId: currentExercise?.id?.value,
      changedDependencies: {
        trackIsReady,  // PERFORMANCE FIX: Use stable primitive
        wamPluginLoaded,
        exerciseId: currentExercise?.id?.value,
      },
    });

    // CRITICAL FIX: Register harmony buffers when exercise changes, regardless of playing state
    // This ensures PlaybackEngine always has the correct instrument's buffers loaded
    // We need to register in two scenarios:
    // 1. When exercise changes (to update buffers) - even if not playing
    // 2. When playback starts (to ensure buffers are ready)
    //
    // NEW PLAYBACK ENGINE FIX: Don't wait for WAM plugin - the new Scheduler handles harmony directly
    // The WAM plugin is only needed for legacy manual chord progression mode
    // PERFORMANCE FIX: Use stable primitives instead of object references
    const shouldRegister = trackIsReady && harmonyNoteCount > 0;

    logger.debug('🔍 [CHECKPOINT-10-CONDITIONS] Should register', {
      shouldRegister,
      trackIsReady,  // PERFORMANCE FIX: Use stable primitive
      hasHarmonyNotes: harmonyNoteCount > 0,  // PERFORMANCE FIX: Use stable primitive
      harmonyNotesLength: harmonyNoteCount,  // PERFORMANCE FIX: Use stable primitive
      usingNewPlaybackEngine: true, // Using Scheduler directly, not WAM plugin
    });

    if (shouldRegister) {
      logger.debug(
        '🔍 [CHECKPOINT-10-WILL-REGISTER] All conditions met, calling registerHarmonyWithPlaybackEngine',
      );
      console.log(
        '🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers!',
        {
          timestamp,
          exerciseId: currentExercise?.id,
          harmonyNotesCount: harmonyNoteCount,  // PERFORMANCE FIX: Use stable primitive
          isPlaying: currentIsPlaying,
          reason: currentIsPlaying ? 'playback started' : 'exercise changed',
        },
      );

      // Register harmony events and buffers for this exercise
      // This updates PlaybackEngine with the correct instrument's buffers
      // Note: WamKeyboard automatically disconnects old instrument and connects new one
      registerHarmonyWithPlaybackEngine();
    } else {
      const missingConditions = [];
      if (!trackIsReady) missingConditions.push('track not ready');  // PERFORMANCE FIX: Use stable primitive
      if (harmonyNoteCount === 0) missingConditions.push('no harmony notes');  // PERFORMANCE FIX: Use stable primitive

      console.log(
        '⏳ [HARMONY-WIDGET] Waiting for conditions:',
        missingConditions.join(', '),
      );
    }
  }, [
    trackIsReady,           // PERFORMANCE FIX: stable boolean, not object reference
    harmonyNoteCount,       // PERFORMANCE FIX: stable number via useMemo
    wamPluginLoaded,
    registerHarmonyWithPlaybackEngine,
    exercise?.id,
    samplesLoadedTrigger,
  ]);
  // CRITICAL: Include exercise?.id to re-register when switching exercises
  // CRITICAL FIX: Include samplesLoadedTrigger to re-register when samples finish loading

  // Effect to handle manual chord progression playback (legacy)
  // PERFORMANCE FIX: Use stable primitives instead of object references
  useEffect(() => {
    if (
      isPlaying &&
      trackIsReady &&  // PERFORMANCE FIX: Use stable primitive
      wamPluginLoaded &&
      keyboardPluginRef.current
    ) {
      // Only use manual chord progression if no harmony notes in exercise
      // PERFORMANCE FIX: Use stable primitive harmonyNoteCount
      if (harmonyNoteCount === 0) {
        console.log(
          '⚠️ [HARMONY-WIDGET] NO HARMONY NOTES - Using chord progression',
        );
        logger.info('🎹 Using manual chord progression for playback');
        scheduleProgression();
      }
    }

    // PlaybackEngine handles stop automatically - no custom stop logic needed!
    // When stop is clicked, PlaybackEngine.stop() cancels all scheduled sources
  }, [
    isPlaying,
    trackIsReady,       // PERFORMANCE FIX: stable boolean, not object reference
    wamPluginLoaded,
    harmonyNoteCount,   // PERFORMANCE FIX: stable number via useMemo
    scheduleProgression,
    logger,
  ]);

  // Handle progression changes
  // Handle pattern change from pattern library
  const handlePatternLibraryChange = useCallback(
    async (libraryPattern: any) => {
      // Load MIDI file from URL
      if (libraryPattern.midiFileUrl) {
        try {
          logger.info('Loading harmony pattern from MIDI:', {
            name: libraryPattern.name,
            url: libraryPattern.midiFileUrl,
            correlationId,
          });

          // TODO: Load and parse MIDI file to extract chord events
          // const midiData = await loadMidiFile(libraryPattern.midiFileUrl);
          // const chordEvents = parseChordEvents(midiData);

          // For now, use a simple progression based on genre
          let chords: string[] = [];

          if (libraryPattern.genre === 'jazz') {
            chords = ['Dm7', 'G7', 'CMaj7', 'Am7'];
          } else if (libraryPattern.genre === 'pop') {
            chords = ['C', 'Am', 'F', 'G'];
          } else if (libraryPattern.genre === 'rock') {
            chords = ['C5', 'G5', 'A5', 'F5'];
          } else {
            chords = ['CMaj7', 'Am7', 'Dm7', 'G7'];
          }

          if (chords.length > 0) {
            onProgressionChange(chords);
          }
        } catch (error) {
          logger.error('Failed to load harmony pattern:', error, {
            correlationId,
          });
        }
      }
    },
    [onProgressionChange, logger, correlationId],
  );

  const handleProgressionChange = useCallback(
    (newProgression: string) => {
      setSelectedProgression(newProgression);
      const prog =
        chordProgressions[newProgression as keyof typeof chordProgressions];
      if (prog) {
        onProgressionChange(prog.map((item) => item.chord));
      }
    },
    [onProgressionChange],
  );

  // Component visibility
  if (!isVisible) return null;

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={handleVolumeChange}
            color="bg-blue-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
            defaultValue={80}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}
                  >
                    Harmony Track
                  </h3>
                  <p
                    className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}
                  >
                    {currentInstrument} | {selectedProgression}
                  </p>
                </div>

                <button
                  onClick={() => setIsExpanded(true)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* 🚀 JITTER FIX: Direct DOM chord indicators via ref registration */}
                  {/* The hook's classList.toggle() updates these divs directly, bypassing React */}
                  <div className="flex gap-1">
                    {progression.slice(0, 4).map((chord, idx) => (
                      <div
                        key={idx}
                        ref={(el) => registerChordIndicator(idx, el)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-200 bg-slate-700 text-slate-400"
                      >
                        {chord?.split('/')[0] || 'C'}
                      </div>
                    ))}
                  </div>
                  <span
                    className={`text-sm font-medium ${volume === 0 ? 'text-slate-600' : 'text-blue-400'}`}
                  >
                    {progression[localCurrentChord] || 'C'}
                  </span>
                </button>
              </>
            ) : (
              <div className="flex items-center gap-4 w-full">
                <div className="flex-1">
                  <div className="flex flex-col gap-2">
                    {/* Instrument Selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Sound:
                      </span>
                      <select
                        value={currentInstrument}
                        onChange={(e) =>
                          handleInstrumentChange(
                            e.target.value as KeyboardInstrumentType,
                          )
                        }
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.entries(KeyboardInstrument).map(
                          ([key, value]) => (
                            <option key={value} value={value}>
                              {key
                                .split('_')
                                .map(
                                  (word) =>
                                    word.charAt(0) +
                                    word.slice(1).toLowerCase(),
                                )
                                .join(' ')}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    {/* Progression Selector with Library Button */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 w-16">
                        Pattern:
                      </span>
                      <select
                        value={selectedProgression}
                        onChange={(e) =>
                          handleProgressionChange(e.target.value)
                        }
                        className="flex-1 bg-slate-700 text-white text-xs rounded px-2 py-1"
                      >
                        {Object.keys(chordProgressions).map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                      {/* Pattern Library Button */}
                      {tutorialId && (
                        <button
                          onClick={() =>
                            setShowPatternLibrary(!showPatternLibrary)
                          }
                          className="p-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                          title="Browse Pattern Library"
                        >
                          <Music2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Pattern Library Selector */}
                    {showPatternLibrary && patternSelector && (
                      <div className="p-2 bg-slate-800 rounded-lg border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-slate-300">
                            Harmony Pattern Library
                          </span>
                          <button
                            onClick={() => setShowPatternLibrary(false)}
                            className="text-xs text-slate-500 hover:text-slate-400"
                          >
                            ✕
                          </button>
                        </div>
                        {patternSelector.isLoading ? (
                          <div className="text-xs text-slate-500">
                            Loading patterns...
                          </div>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {patternSelector.availableHarmonyPatterns.map(
                              (p) => (
                                <button
                                  key={p.id}
                                  onClick={() => {
                                    patternSelector.selectHarmonyPattern(p);
                                    handlePatternLibraryChange(p);
                                    setShowPatternLibrary(false);
                                  }}
                                  className={`w-full text-left p-1.5 text-xs rounded hover:bg-slate-700 transition-colors ${
                                    patternSelector.selectedHarmonyPattern
                                      ?.id === p.id
                                      ? 'bg-slate-700 text-blue-400'
                                      : 'text-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <span>{p.name}</span>
                                    {p.genre && (
                                      <span className="text-xs text-slate-500">
                                        {p.genre}
                                      </span>
                                    )}
                                  </div>
                                </button>
                              ),
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 🚀 JITTER FIX: Current Chord Display with direct DOM updates */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 w-16">
                        Chords:
                      </span>
                      <div className="flex gap-1">
                        {progression.map((chord, idx) => (
                          <div
                            key={idx}
                            ref={(el) => registerChordIndicator(idx, el)}
                            className="w-8 h-6 rounded text-xs flex items-center justify-center font-medium transition-all duration-200 cursor-default bg-slate-700 text-slate-400"
                          >
                            {chord?.split('/')[0] || 'C'}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    onClick={testChord}
                    className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-500 transition-colors"
                    disabled={!track.isReady}
                  >
                    Test
                  </button>
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Play Control (if provided) */}
      {onTogglePlay && isExpanded && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={onTogglePlay}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={!track.isReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Phase 5.1: Wrap in React.memo to prevent unnecessary re-renders
export const HarmonyWidget = React.memo(HarmonyWidgetComponent);
