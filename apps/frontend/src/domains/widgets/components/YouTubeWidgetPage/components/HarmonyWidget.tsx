'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { ChordSlotSelector } from './ChordSlotSelector';
import { ProfessionalKeyboardSelector } from './ProfessionalKeyboardSelector';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransport } from '@/domains/playback/hooks/useTransport';
import {
  ensureAudioContext,
  withAudioContext,
} from '@/domains/playback/utils/ensureAudioContext';
import { getPersistentAudioContext } from '@/domains/playback/utils/audioContext';
import type { MusicalPosition } from '@bassnotion/contracts/types/musical-time';
// PHASE 2: wamPluginSingleton removed - now using PluginManager for unified singleton management
import { GlobalSampleCache } from '@/domains/playback/modules/storage';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { usePatternSelector } from '@/domains/patterns/hooks/usePatternSelector';
import { Music2 } from 'lucide-react';
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

export function HarmonyWidget({
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
}: HarmonyWidgetProps) {
  // CRITICAL DEBUG: Log at TOP of render function
  console.log('🔍 [STATE-FLOW-4] HarmonyWidget RENDER (top of function):', {
    harmonyInstrument,
    harmonyInstrumentType: typeof harmonyInstrument,
    exerciseId: exercise?.id?.value,
    renderTimestamp: Date.now(),
  });

  const { correlationId, logger } = useCorrelation('HarmonyWidget');

  // Get live tempo from transport (like Drummer/Metronome)
  const transport = useTransport();
  // PERFORMANCE FIX: Only extract tempo value to prevent re-renders from transport object changes
  const transportTempo = transport.tempo;

  // Stabilize bpm to prevent callback recreation when value doesn't actually change
  const [bpm, setBpm] = useState(transportTempo);
  useEffect(() => {
    if (bpm !== transportTempo) {
      setBpm(transportTempo);
    }
  }, [transportTempo, bpm]);

  const [volume, setVolume] = useState(80);
  const [showPatternLibrary, setShowPatternLibrary] = useState(false);
  const [selectedProgression, setSelectedProgression] =
    useState('Jazz Standard');

  // CHECKPOINT 2: State initialization - log initial instrument value
  console.log('🔍 [CHECKPOINT-2] currentInstrument state initialization:', {
    harmonyInstrumentProp: harmonyInstrument,
    exerciseHarmonyInstrument: exercise?.harmonyInstrument,
    exerciseId: exercise?.id?.value,
    exerciseTitle: exercise?.title,
    willInitializeAs: harmonyInstrument || 'undefined'
  });

  // Initialize with harmonyInstrument prop if available, otherwise grand piano as the default
  const [currentInstrument, setCurrentInstrument] =
    useState<KeyboardInstrumentType | undefined>(
      harmonyInstrument as KeyboardInstrumentType | undefined
    );

  // CRITICAL: Store currentInstrument in a ref so createAudioNodeAttempt always reads the latest value
  const currentInstrumentRef = useRef<KeyboardInstrumentType | undefined>(currentInstrument);
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
  }, [harmonyInstrument, currentInstrument, isPlaying, isVisible, exercise?.id?.value]);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localCurrentChord, setLocalCurrentChord] = useState(currentChord);

  // Create a track for harmony
  const track = useTrack({
    trackId: 'harmony-widget-track',
    name: 'Harmony',
    type: 'harmony',
    debugMode: true,
  });

  // Use pattern selector hook if tutorialId is provided
  const patternSelector = tutorialId ? usePatternSelector({
    tutorialId,
    onPatternChange: (type, pattern) => {
      if (type === 'harmony' && pattern.midiData) {
        // Convert pattern library format to chord progression
        handlePatternLibraryChange(pattern);
      }
    }
  }) : null;

  // Track the plugin attached to our track
  const trackPluginRef = useRef<any>(null);

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

  // CHECKPOINT 3: useEffect instrument update - when harmonyInstrument prop changes
  useEffect(() => {
    console.log('🔍 [CHECKPOINT-3] harmonyInstrument prop useEffect triggered:', {
      harmonyInstrumentProp: harmonyInstrument,
      currentInstrumentState: currentInstrument,
      currentInstrumentRef: currentInstrumentRef.current,
      willUpdate: !!harmonyInstrument && harmonyInstrument !== currentInstrument,
      exerciseHarmonyInstrument: exercise?.harmonyInstrument,
    });

    if (harmonyInstrument && harmonyInstrument !== currentInstrument) {
      console.log('🔍 [CHECKPOINT-3-UPDATE] Calling setCurrentInstrument:', {
        from: currentInstrument,
        to: harmonyInstrument,
      });
      setCurrentInstrument(harmonyInstrument as KeyboardInstrumentType);
      console.log('🔍 [CHECKPOINT-3-AFTER] After setCurrentInstrument called (state update is async)');
    } else {
      console.log('🔍 [CHECKPOINT-3-SKIP] Not updating - no change needed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [harmonyInstrument]); // Only depend on prop, not currentInstrument state

  // CHECKPOINT 1: Exercise data arrival - log whenever exercise prop changes
  useEffect(() => {
    console.log('🔍 [CHECKPOINT-1] Exercise prop changed:', {
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
  }, [exercise?.id, exercise?.harmonyInstrument, exercise?.harmonyNotes?.length]);

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
      cc64Events: exercise?.harmonyControlChanges?.filter((cc: any) => cc.cc === 64).length || 0,
      cc64Sample: exercise?.harmonyControlChanges
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

  // Log initial component state
  useEffect(() => {
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
      logger.info('✅ Ready to use WAM plugin singleton');
    };

    checkPreloadedAndLoadClass();
  }, [pluginClassLoaded, wamPluginLoaded]); // Removed isMuted, volume - they should NOT trigger re-initialization

  // Extract audio node creation to a separate function so we can call it from retry
  const createAudioNodeAttempt = useCallback(async () => {
    console.log('🔍🔍🔍 [CREATE-ATTEMPT-ENTRY] createAudioNodeAttempt called', {
      isCreatingPluginRef: isCreatingPluginRef.current,
      hasKeyboardPlugin: !!keyboardPluginRef.current,
      wamPluginLoaded,
      willSkip: isCreatingPluginRef.current || !!keyboardPluginRef.current || wamPluginLoaded,
    });

    // Prevent multiple simultaneous creation attempts
    if (
      isCreatingPluginRef.current ||
      keyboardPluginRef.current ||
      wamPluginLoaded
    ) {
      console.log('🔍🔍🔍 [CREATE-ATTEMPT-SKIP] Skipping due to guard conditions');
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
    console.log('🔍🔍🔍 [CREATE-CHECKPOINT-1] Set isCreatingPluginRef to true');

    // Get audio context - prioritize persistent context
    // CRITICAL FIX: Skip AudioEngine.getContext() path (requires initialize() to be called first)
    // Go directly to getPersistentAudioContext() or fallbacks to allow plugin creation
    // even with suspended AudioContext (will auto-resume when user clicks Play)
    let context = getPersistentAudioContext();
    console.log('🔍🔍🔍 [CREATE-CHECKPOINT-2] Got persistent context:', {
      hasContext: !!context,
      contextState: context?.state,
    });

    // FALLBACK: If still no context, try window.__audioContext or create new one
    if (!context) {
      console.log('🔍🔍🔍 [CREATE-CHECKPOINT-9.5] No context yet, trying window fallbacks');

      // Try window.__audioContext (might be set by InitialSamplePreloader)
      if ((window as any).__audioContext) {
        context = (window as any).__audioContext;
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-9.6] Got context from window.__audioContext:', {
          hasContext: !!context,
          contextState: context?.state,
        });
      }
      // Try Tone.getContext() if available globally
      else if ((window as any).Tone && (window as any).Tone.getContext) {
        const toneContext = (window as any).Tone.getContext();
        context = toneContext?.rawContext || toneContext?._context || toneContext;
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-9.7] Got context from window.Tone.getContext():', {
          hasContext: !!context,
          contextState: context?.state,
        });
      }
      // Last resort: create a new AudioContext
      else if (typeof AudioContext !== 'undefined') {
        context = new AudioContext();
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-9.8] Created NEW AudioContext:', {
          hasContext: !!context,
          contextState: context?.state,
        });
        // Store it globally for reuse
        (window as any).__audioContext = context;
      }
    }

    // Check if context needs to be resumed
    console.log('🔍🔍🔍 [CREATE-CHECKPOINT-10] Checking if context exists:', {
      hasContext: !!context,
      contextState: context?.state,
      isAudioContext: context instanceof AudioContext,
    });

    // CRITICAL FIX: Allow plugin creation with suspended AudioContext
    // The browser's autoplay policy prevents AudioContext from starting without user gesture
    // We create the plugin now (with suspended context) and it will auto-resume when user clicks Play
    if (context && context.state === 'suspended') {
      console.log('🔍🔍🔍 [CREATE-CHECKPOINT-11] Context is suspended, will create plugin anyway (browser autoplay policy)');
      logger.info('🎹 HarmonyWidget: Audio context is suspended (autoplay policy), creating plugin anyway - will resume on Play');
      // DON'T call resume() here - it will fail due to autoplay policy
      // AudioContext will auto-resume when user clicks Play button
    }

    logger.info('🎹 HarmonyWidget: Got context:', context, {
      type: context?.constructor?.name,
      isAudioContext: context instanceof AudioContext,
      contextState: context?.state,
    });

    if (context && context instanceof AudioContext) {
      console.log('🔍🔍🔍 [CREATE-CHECKPOINT-13] Context is AudioContext, state:', context.state);
      // REMOVED: Early return for suspended context - allow plugin creation
      console.log('🔍🔍🔍 [CREATE-CHECKPOINT-15] Proceeding with plugin creation regardless of context state...');

      try {
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-16] In try block, reading currentInstrumentRef');

        // CHECKPOINT 6: Instrument resolution - read from all possible sources
        console.log('🔍 [CHECKPOINT-6] Instrument resolution from multiple sources:', {
          currentInstrumentRef: currentInstrumentRef.current,
          currentInstrumentState: currentInstrument,
          harmonyInstrumentProp: harmonyInstrument,
          exerciseHarmonyInstrument: exercise?.harmonyInstrument,
          exerciseId: exercise?.id?.value,
          exerciseTitle: exercise?.title,
        });

        // CRITICAL FIX: Read currentInstrument from ref to get the LATEST value
        // Using ref ensures we don't have stale closure issues
        const desiredInstrument = currentInstrumentRef.current as KeyboardInstrumentType | undefined;

        // CRITICAL DEBUG: Log what HarmonyWidget receives from props AND state
        console.log('🔍 [STATE-FLOW-4] HarmonyWidget createAudioNodeAttempt:', {
          harmonyInstrumentProp: harmonyInstrument,
          currentInstrumentState: currentInstrument,
          currentInstrumentRef: currentInstrumentRef.current,
          desiredInstrument,
          exerciseId: exercise?.id?.value,
          exerciseTitle: exercise?.title,
          exerciseHarmonyInstrument: exercise?.harmonyInstrument,
          hasExercise: !!exercise,
        });

        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-17] Checking if desiredInstrument exists:', {
          desiredInstrument,
          hasDesiredInstrument: !!desiredInstrument,
        });

        console.log('🔍 [CHECKPOINT-6-RESULT] Resolved instrument:', {
          desiredInstrument,
          willProceed: !!desiredInstrument,
          willReturnEarly: !desiredInstrument,
        });

        // CRITICAL: Don't create plugin until we have a valid instrument from exercise
        if (!desiredInstrument) {
          console.log('🔍🔍🔍 [CREATE-CHECKPOINT-18-RETURN] No desiredInstrument, returning early');
          console.log('🔍 [STATE-FLOW-5] No desiredInstrument, waiting...');
          console.log('🔍 [CHECKPOINT-6-EARLY-RETURN] Cannot proceed - no instrument specified from any source!');
          logger.warn('🎹 HarmonyWidget: No harmonyInstrument specified, waiting for exercise to load');
          isCreatingPluginRef.current = false;
          return;
        }
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-19] Has desiredInstrument, proceeding to singleton call');
        console.log('🔍 [CHECKPOINT-6-SUCCESS] Instrument resolved successfully:', desiredInstrument);

        console.log('🔍🔍🔍 [HARMONY-WIDGET] About to get WamKeyboard from PluginManager', {
          desiredInstrument,
          contextState: context.state,
        });
        logger.info(
          '🎹 HarmonyWidget: Requesting WamKeyboard from PluginManager with instrument:',
          desiredInstrument,
        );

        // PHASE 2 FIX: Use PluginManager instead of wamPluginSingleton
        // This unifies the two singleton systems and enables CC event routing
        const coreServices = (window as any).__globalCoreServices || (window as any).__coreServices;
        if (!coreServices) {
          throw new Error('CoreServices not available - cannot get PluginManager');
        }

        // DIAGNOSTIC: Check if CoreServices is initialized
        const isInitialized = coreServices.isReady?.();
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-19.5] CoreServices state:', {
          isInitialized,
          hasPluginManager: !!coreServices.getPluginManager,
        });

        // If CoreServices not initialized, initialize it now
        if (!isInitialized) {
          console.log('🔍🔍🔍 [CREATE-CHECKPOINT-19.6] CoreServices not initialized, initializing now...');
          logger.info('CoreServices not initialized, initializing to register plugins...');
          try {
            await coreServices.initialize();
            console.log('🔍🔍🔍 [CREATE-CHECKPOINT-19.7] CoreServices initialized successfully');
            logger.info('CoreServices initialized successfully');
          } catch (initError) {
            console.log('🔍🔍🔍 [CREATE-CHECKPOINT-19.8-ERROR] CoreServices initialization failed:', initError);
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
            console.log(`🔍🔍🔍 [CREATE-CHECKPOINT-20-MAX-RETRIES] Plugin not registered after ${MAX_RETRIES} attempts (${MAX_RETRIES * 100}ms)`);
            logger.error('WamKeyboard plugin not registered after maximum retries - giving up');
            isCreatingPluginRef.current = false;
            pluginCreationRetryCountRef.current = 0; // Reset for potential future attempts
            return;
          }

          console.log(`🔍🔍🔍 [CREATE-CHECKPOINT-20] Plugin not registered yet, will retry in 100ms (attempt ${currentRetries + 1}/${MAX_RETRIES})`);
          logger.info(`WamKeyboard plugin not registered yet, retrying in 100ms... (attempt ${currentRetries + 1}/${MAX_RETRIES})`);
          isCreatingPluginRef.current = false;
          pluginCreationRetryCountRef.current++;

          // Retry after a short delay to allow CoreServices to finish registering plugins
          setTimeout(() => {
            if (!wamPluginLoaded && !keyboardPluginRef.current) {
              logger.info('🎹 HarmonyWidget: Retrying plugin creation after registration delay');
              createAudioNodeAttempt();
            }
          }, 100);
          return;
        }

        // Reset retry counter on success
        pluginCreationRetryCountRef.current = 0;

        if (!keyboardPlugin) {
          console.log('🔍🔍🔍 [CREATE-CHECKPOINT-20.5] Plugin returned null');
          logger.error('WamKeyboardPlugin not found in PluginManager (returned null after successful getPlugin call)');
          isCreatingPluginRef.current = false;
          return;
        }

        // Ensure plugin is loaded and initialized
        if (keyboardPlugin.state === 'unloaded') {
          logger.info('Loading WamKeyboardPlugin...');
          await pluginManager.loadPlugin('wam-keyboard');
        }

        if (keyboardPlugin.state === 'loaded' || keyboardPlugin.state === 'inactive') {
          logger.info('Activating WamKeyboardPlugin...');
          await pluginManager.activatePlugin('wam-keyboard');
        }

        // Get the underlying WamKeyboard instance
        const plugin = keyboardPlugin.getWamKeyboard();
        if (!plugin) {
          logger.error('WamKeyboard instance not initialized in plugin wrapper');
          isCreatingPluginRef.current = false;
          return;
        }

        console.log('🔍🔍🔍 [HARMONY-WIDGET] Got WamKeyboard from PluginManager:', {
          hasPlugin: !!plugin,
          hasAudioNode: !!plugin?.audioNode,
          currentInstrument: plugin?.audioNode?.currentInstrument,
        });
        logger.info('🎹 HarmonyWidget: Got WamKeyboard from PluginManager:', plugin);

        // Store the plugin instance
        keyboardPluginRef.current = plugin;

        // The plugin should already have an audio node
        const audioNode = plugin.audioNode;
        logger.info('🎹 HarmonyWidget: Got audio node from plugin:', audioNode);

        // For now, connect directly to destination until proper track routing is implemented
        // The issue is that the track system expects specific plugin types and routing
        audioNode.connect(context.destination);
        logger.info('🎹 HarmonyWidget: Connected to audio destination');

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
          logger.info('🎹 HarmonyWidget: Loading desired instrument (mismatch detected)...', {
            from: loadedInstrument,
            to: desiredInstrument,
          });

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
          logger.info(
            '🎹 HarmonyWidget: Correct instrument already loaded',
            {
              instrument: loadedInstrument,
            },
          );

          // Ensure state matches loaded instrument
          if (currentInstrument !== loadedInstrument) {
            setCurrentInstrument(loadedInstrument as KeyboardInstrumentType);
          }
        }

        setWamPluginLoaded(true);
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
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-20] Successfully created plugin, resetting flag');
        isCreatingPluginRef.current = false;
      } catch (error) {
        console.log('🔍🔍🔍 [CREATE-CHECKPOINT-21-ERROR] Error in try block:', error);
        logger.error('❌ Failed to create WAM Keyboard plugin:', error);
        isCreatingPluginRef.current = false;
      }
    } else {
      console.log('🔍🔍🔍 [CREATE-CHECKPOINT-22-ELSE] Context not AudioContext or doesn\'t exist');
      logger.info('🎹 HarmonyWidget: AudioContext not ready yet', {
        hasContext: !!context,
        contextState: context?.state,
      });
      isCreatingPluginRef.current = false;
    }
  }, [track.isReady, wamPluginLoaded, pluginClassLoaded, currentInstrument, exercise]); // Added currentInstrument and exercise - needed for closure

  // CHECKPOINT 4: Plugin creation trigger - when all conditions met
  // CRITICAL FIX: Removed audioServicesReady check to allow plugin creation with suspended AudioContext
  useEffect(() => {
    console.log('🔍 [CHECKPOINT-4] Plugin creation trigger useEffect:', {
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
      allConditionsMet: typeof window !== 'undefined' && pluginClassLoaded && track.isReady && !wamPluginLoaded,
      willCallCreateAudioNodeAttempt: typeof window !== 'undefined' && pluginClassLoaded && track.isReady && !wamPluginLoaded,
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
      console.log('🔍 [CHECKPOINT-4-SKIP] Window undefined, skipping');
      return;
    }
    if (!pluginClassLoaded || !track.isReady || wamPluginLoaded) {
      console.log('🔍 [CHECKPOINT-4-SKIP] Conditions not met:', {
        pluginClassLoaded,
        trackIsReady: track.isReady,
        audioServicesReady,
        wamPluginLoaded,
        reason: !pluginClassLoaded ? 'plugin class not loaded' : !track.isReady ? 'track not ready' : 'plugin already loaded'
      });
      return;
    }

    console.log('🔍 [CHECKPOINT-4-PROCEED] All conditions met, calling createAudioNodeAttempt');

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
            console.log('🔍 [CLEANUP] Cleared events from keyboard plugin');
          }

          // CRITICAL: Clear the local ref so the next exercise will call singleton.getOrCreateKeyboardPlugin()
          // But DON'T call releasePlugin() - this keeps the plugin cached in the singleton!
          // The singleton will return the SAME plugin and call loadInstrument() to switch instruments
          keyboardPluginRef.current = null;

          // DON'T call wamPluginSingleton.releasePlugin() - this would delete it from the cache!
          // By not releasing, the plugin stays in GlobalSampleCache and can be reused

          logger.info('✅ HarmonyWidget local ref cleared (plugin kept in singleton cache for reuse)');
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

  // Handle volume changes
  useEffect(() => {
    if (keyboardPluginRef.current) {
      keyboardPluginRef.current.audioNode?.setParameterValues({
        volume: isMuted ? 0 : volume / 100,
      });
    }
  }, [volume, isMuted]);

  // Handle instrument changes - reload instrument when currentInstrument changes
  // CRITICAL FIX: Track the previous instrument to prevent redundant loadInstrument() calls on initial load
  const previousInstrumentRef = useRef<KeyboardInstrumentType | undefined>(undefined);

  useEffect(() => {
    console.log('🔍 [STATE-FLOW-7] reloadInstrument useEffect triggered:', {
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
        console.log('🔍 [STATE-FLOW-8] No currentInstrument, skipping');
        return;
      }

      // CRITICAL FIX: Skip if this is the initial load (plugin just created)
      // The instrument was already loaded in createAudioNodeAttempt via WamKeyboard.initialize()
      if (previousInstrumentRef.current === undefined && keyboardPluginRef.current?.audioNode) {
        console.log('🔍 [STATE-FLOW-8.5] Initial load detected - instrument already loaded in createAudioNodeAttempt, skipping redundant loadInstrument()');
        previousInstrumentRef.current = currentInstrument;
        return;
      }

      // CRITICAL FIX: Skip if instrument hasn't actually changed
      if (previousInstrumentRef.current === currentInstrument) {
        console.log('🔍 [STATE-FLOW-8.6] Instrument unchanged, skipping reload');
        return;
      }

      if (keyboardPluginRef.current?.audioNode) {
        // Plugin exists - just reload the instrument
        console.log('🔍 [STATE-FLOW-9] Plugin exists, reloading instrument:', currentInstrument);

        try {
          // Clear any existing events before switching instruments
          if (keyboardPluginRef.current.audioNode.clearEvents) {
            keyboardPluginRef.current.audioNode.clearEvents();
          }

          // Load the new instrument
          if (keyboardPluginRef.current.audioNode.loadInstrument) {
            console.log('🔍 [STATE-FLOW-10] Calling loadInstrument()...');
            await keyboardPluginRef.current.audioNode.loadInstrument(currentInstrument);
            console.log('✅ [STATE-FLOW-11] Successfully reloaded instrument:', currentInstrument);
            // Update the previous instrument tracker
            previousInstrumentRef.current = currentInstrument;
          }
        } catch (error) {
          console.error('❌ [STATE-FLOW-ERROR] Failed to reload instrument:', error);
        }
      } else if (track.isReady && audioServicesReady && !wamPluginLoaded) {
        // Plugin doesn't exist yet - create it with the new instrument
        // CRITICAL: Must wait for audioServicesReady before calling createAudioNodeAttempt()
        console.log('🔍 [STATE-FLOW-12] Creating plugin for new instrument:', currentInstrument);
        createAudioNodeAttempt();
        // Update the previous instrument tracker after creation
        previousInstrumentRef.current = currentInstrument;
      } else {
        console.log('🔍 [STATE-FLOW-13] Conditions not met for instrument loading:', {
          hasPlugin: !!keyboardPluginRef.current?.audioNode,
          trackIsReady: track.isReady,
          wamPluginLoaded,
          audioServicesReady,
          reason: !track.isReady ? 'track not ready' : !audioServicesReady ? 'audio services not ready' : wamPluginLoaded ? 'plugin already loaded' : 'unknown',
        });
      }
    };

    reloadInstrument();
  }, [currentInstrument, track.isReady, wamPluginLoaded, audioServicesReady, createAudioNodeAttempt]);

  // Listen for audio services ready event
  useEffect(() => {
    if (typeof window === 'undefined') return;

    logger.info('🎹 HarmonyWidget: Setting up audio service listeners...');

    // Check if services are already ready
    const globalServices =
      (window as any).__globalCoreServices || (window as any).__coreServices;
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

      // Force check if we can create plugin now
      if (!wamPluginLoaded && pluginClassLoaded && track.isReady) {
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

      // Force check if we can create plugin now
      if (!wamPluginLoaded && pluginClassLoaded && track.isReady) {
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
    const coreServices =
      (window as any).__coreServices || (window as any).__globalCoreServices;
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

    if (
      audioServicesReady &&
      track.isReady &&
      !wamPluginLoaded &&
      pluginClassLoaded
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
  // FAANG-STYLE SOLUTION: Use RegionProcessor for harmony scheduling (matches DrummerWidget architecture)
  const registerHarmonyWithRegionProcessor = useCallback(async () => {
    console.log('🎹🎹🎹 [HARMONY-WIDGET] registerHarmonyWithRegionProcessor CALLED');

    // CRITICAL DIAGNOSTIC: Log exercise data IMMEDIATELY (before any early returns)
    console.log('🔍 [HARMONY-WIDGET-DEBUG] Exercise data at function start:', {
      hasExercise: !!exercise,
      exerciseId: exercise?.id,
      exerciseTitle: exercise?.title,
      harmonyInstrument: exercise?.harmonyInstrument,
      harmonyInstrumentType: typeof exercise?.harmonyInstrument,
      harmonyInstrumentIsDefined: exercise?.harmonyInstrument !== undefined,
      harmonyInstrumentIsNull: exercise?.harmonyInstrument === null,
      harmonyNotesLength: exercise?.harmonyNotes?.length,
      exerciseKeys: exercise ? Object.keys(exercise) : [],
      exerciseConstructor: exercise?.constructor?.name
    });

    const plugin = keyboardPluginRef.current;
    if (!plugin || !plugin.audioNode) {
      console.error('❌ [HARMONY-WIDGET] No plugin or audioNode available', { hasPlugin: !!plugin, hasAudioNode: !!plugin?.audioNode });
      return;
    }
    console.log('✅ [HARMONY-WIDGET] Plugin and audioNode available');

    if (!exercise?.harmonyNotes || exercise.harmonyNotes.length === 0) {
      console.error('❌ [HARMONY-WIDGET] No harmony notes to register', {
        hasExercise: !!exercise,
        hasHarmonyNotes: !!exercise?.harmonyNotes,
        harmonyNotesLength: exercise?.harmonyNotes?.length
      });
      return;
    }
    console.log('✅ [HARMONY-WIDGET] Exercise has harmony notes:', exercise.harmonyNotes.length);

    console.log('🎹 [HARMONY-WIDGET] Registering harmony with RegionProcessor');

    // Get CoreServices and RegionProcessor
    const coreServices = (window as any).__coreServices || (window as any).__globalCoreServices;
    if (!coreServices) {
      console.error('❌ [HARMONY-WIDGET] No core services available');
      return;
    }
    console.log('✅ [HARMONY-WIDGET] Core services available');

    const regionProcessor = coreServices.getRegionProcessor?.();
    if (!regionProcessor) {
      console.error('❌ [HARMONY-WIDGET] No RegionProcessor available');
      return;
    }
    console.log('✅ [HARMONY-WIDGET] RegionProcessor available');

    // CRITICAL: Inject harmony buffers into RegionProcessor for direct scheduling
    // This enables instant stop functionality by tracking AudioBufferSourceNodes
    console.log('🔧 [HARMONY-WIDGET] Starting buffer injection...');
    try {
      const { GlobalSampleCache } = await import('@/domains/playback/modules/storage/cache/GlobalSampleCache.js');
      const sampleCache = GlobalSampleCache.getInstance();
      console.log('✅ [HARMONY-WIDGET] Got GlobalSampleCache instance');

      // CRITICAL: Get the instrument name BEFORE loading buffers
      // We need this to find the correct instrument-specific cache keys
      const instrument = exercise.harmonyInstrument || 'wurlitzer';

      // CRITICAL DIAGNOSTIC: Log exercise data to verify harmonyInstrument field
      console.log('🎹 [HARMONY-WIDGET] Exercise instrument detection:', {
        exerciseId: exercise.id,
        exerciseTitle: exercise.title,
        harmonyInstrument: exercise.harmonyInstrument,
        harmonyInstrumentType: typeof exercise.harmonyInstrument,
        harmonyInstrumentIsDefined: exercise.harmonyInstrument !== undefined,
        resolvedInstrument: instrument,
        exerciseKeys: Object.keys(exercise)
      });
      console.log('🎹 [HARMONY-WIDGET] Looking for instrument-specific buffers:', instrument);

      // First, let's see what's actually in the cache
      // Access the internal samples map to see all cached keys
      const allCachedKeys = Array.from((sampleCache as any).samples?.keys() || []);

      // CRITICAL FIX: Look for instrument-specific keys (e.g., 'wurlitzer-v3-C4')
      // instead of generic 'harmony-' keys (which no longer exist)
      const harmonyCachedKeys = allCachedKeys.filter(key => key.startsWith(`${instrument}-`));
      console.log('🔍 [HARMONY-WIDGET] All harmony keys in cache for', instrument, ':', harmonyCachedKeys);

      // CRITICAL: Check if ALL required notes for THIS exercise are cached
      // This prevents registering before IntersectionObserver finishes preloading
      const midiToNoteName = (midi: number): string => {
        const noteNames = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B'];
        const octave = Math.floor(midi / 12) - 1;
        const noteName = noteNames[midi % 12];
        return `${noteName}${octave}`;
      };

      const requiredNotes = exercise.harmonyNotes.map(note => midiToNoteName(note.pitch));
      const uniqueRequiredNotes = [...new Set(requiredNotes)];

      // Extract cached note names from cache keys (e.g., 'grandpiano-v1-C4' -> 'C4')
      const cachedNoteNames = new Set(
        harmonyCachedKeys.map(key => key.split('-').pop()).filter(Boolean)
      );

      const allSamplesCached = uniqueRequiredNotes.every(noteName => cachedNoteNames.has(noteName));

      if (!allSamplesCached) {
        const missingNotes = uniqueRequiredNotes.filter(note => !cachedNoteNames.has(note));
        console.warn('⚠️ [HARMONY-WIDGET] Samples not ready yet for exercise, skipping registration', {
          exerciseId: exercise.id,
          exerciseTitle: exercise.title,
          requiredNotes: uniqueRequiredNotes,
          cachedNotes: Array.from(cachedNoteNames),
          missingNotes,
          totalCachedKeys: harmonyCachedKeys.length
        });
        return; // Exit early, will retry when useEffect triggers again
      }

      console.log('✅ [HARMONY-WIDGET] All required samples cached, proceeding with registration', {
        requiredNotes: uniqueRequiredNotes,
        cachedKeys: harmonyCachedKeys.length
      });

      const harmonyBuffers = new Map<string, AudioBuffer>();

      // Instead of iterating all possible notes, iterate what's actually cached
      let buffersFound = 0;
      for (const cacheKey of harmonyCachedKeys) {
        const buffer = sampleCache.getCachedBuffer(cacheKey);
        if (buffer) {
          // Convert 'wurlitzer-v3-Cs4' to 'v3-Cs4' for RegionProcessor
          // Remove the instrument prefix to get the layer-note format
          const keyWithoutPrefix = cacheKey.replace(`${instrument}-`, '');
          harmonyBuffers.set(keyWithoutPrefix, buffer);
          buffersFound++;
          console.log(`✅ [HARMONY-WIDGET] Found buffer: ${cacheKey} → ${keyWithoutPrefix}`);
        }
      }

      if (buffersFound > 0) {
        // Get audioContext from AudioEngine (same way CoreServices does it)
        // This ensures we use the exact same audioContext for harmony as for drums/metronome
        const audioEngine = coreServices.getAudioEngine();
        const audioContext = await audioEngine.getContext();

        console.log('🎧 [HARMONY-WIDGET] AudioContext info:', {
          hasAudioEngine: !!audioEngine,
          hasAudioContext: !!audioContext,
          hasDestination: !!audioContext?.destination,
          destinationType: audioContext?.destination?.constructor?.name,
          state: audioContext?.state
        });

        if (audioContext?.destination) {
          // Load instrument config to get per-note velocity ranges
          // This tells RegionProcessor which velocity layer each note actually has
          // (instrument variable already defined above at line 1205)
          console.log('📖 [HARMONY-WIDGET] Loading instrument config:', instrument);

          let perNoteVelocityRanges: Record<string, any[]> | undefined;
          try {
            if (instrument === 'wurlitzer') {
              const wurlitzerConfig = await import('@/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json');
              perNoteVelocityRanges = wurlitzerConfig.default.perNoteVelocityRanges;
            } else if (instrument === 'grandpiano') {
              const grandPianoConfig = await import('@/domains/playback/data/instruments/piano/grand-piano.json');
              perNoteVelocityRanges = grandPianoConfig.default.perNoteVelocityRanges;
            } else if (instrument === 'rhodes') {
              const rhodesConfig = await import('@/domains/playback/data/instruments/rhodes/rhodes-piano.json');
              perNoteVelocityRanges = rhodesConfig.default.perNoteVelocityRanges;
            }

            console.log('✅ [HARMONY-WIDGET] Loaded per-note velocity ranges', {
              instrument,
              hasRanges: !!perNoteVelocityRanges,
              noteCount: perNoteVelocityRanges ? Object.keys(perNoteVelocityRanges).length : 0
            });
          } catch (error) {
            console.error('❌ [HARMONY-WIDGET] Failed to load instrument config', error);
          }

          regionProcessor.setHarmonyBuffers(harmonyBuffers, audioContext.destination, perNoteVelocityRanges, instrument);
          console.log('✅ [HARMONY-WIDGET] Harmony buffers injected into RegionProcessor', {
            instrument,
            buffersInjected: buffersFound,
            audioContextState: audioContext.state,
            hasVelocityRanges: !!perNoteVelocityRanges
          });

          // CRITICAL FIX: Switch WAM plugin instrument to match the exercise
          // This ensures only the correct instrument plays
          if (keyboardPluginRef.current?.audioNode && instrument !== currentInstrument) {
            console.log('🔄 [HARMONY-WIDGET] Switching WAM plugin instrument:', {
              from: currentInstrument,
              to: instrument,
              exerciseId: exercise.id
            });

            try {
              if (keyboardPluginRef.current.audioNode.loadInstrument) {
                await keyboardPluginRef.current.audioNode.loadInstrument(instrument);
                console.log('✅ [HARMONY-WIDGET] WAM plugin instrument switched to:', instrument);
                // Update state to match
                setCurrentInstrument(instrument);
              }
            } catch (error) {
              console.error('❌ [HARMONY-WIDGET] Failed to switch WAM plugin instrument:', error);
            }
          }
        } else {
          console.error('❌ [HARMONY-WIDGET] No audioContext.destination available');
        }
      } else {
        // CRITICAL FIX: Clear old buffers to prevent playing wrong instrument
        // When switching exercises, if new instrument's buffers aren't cached yet,
        // we must clear RegionProcessor's old buffers to avoid playing wrong instrument
        const audioEngine = coreServices.getAudioEngine();
        const audioContext = await audioEngine.getContext();
        if (audioContext?.destination) {
          regionProcessor.setHarmonyBuffers(new Map(), audioContext.destination, undefined, instrument);
          console.warn('⚠️ [HARMONY-WIDGET] No harmony buffers found in cache - cleared old buffers to prevent wrong instrument playing');
        } else {
          console.warn('⚠️ [HARMONY-WIDGET] No harmony buffers found in cache');
        }
      }
    } catch (error) {
      console.error('❌ [HARMONY-WIDGET] Failed to inject harmony buffers', error);
    }

    // Convert harmony notes to Region format
    // RegionProcessor now accepts objects for MIDI tick precision (480 PPQ)

    // CRITICAL: Find the earliest event position (note OR control change) to normalize MIDI start to 1:1:0
    // MIDI files may be recorded starting at measure 9, 17, etc.
    // CC events (like sustain pedal) often appear BEFORE the first note, so we must consider both!
    // We need to shift all positions so the first event starts at measure 0 (which represents bar 1 in 0-indexed calculation)

    // Collect all event positions (notes + control changes)
    const allEventPositions = [
      ...exercise.harmonyNotes.map((note) => note.position),
      ...(exercise.harmonyControlChanges || []).map((cc) => cc.position)
    ];

    // Find the earliest event (note OR control change)
    const firstEvent = allEventPositions.reduce<typeof allEventPositions[0] | null>((earliest, pos) => {
      if (!earliest) return pos;

      const earliestTotal = (earliest.measure * 16) + (earliest.beat * 4) + (earliest.subdivision || 0) + (earliest.tick || 0) / 480;
      const currentTotal = (pos.measure * 16) + (pos.beat * 4) + (pos.subdivision || 0) + (pos.tick || 0) / 480;

      return currentTotal < earliestTotal ? pos : earliest;
    }, null);

    // FIX: Use measure 0 (not 1) as target - parsePosition() uses 0-indexed calculation
    // measure: 0 → (0 * 4) + beat = correct timing for bar 1
    const measureOffset = firstEvent ? firstEvent.measure : 0; // Shift to start at measure 0 (bar 1)
    const beatOffset = firstEvent ? firstEvent.beat : 0;
    const subdivisionOffset = firstEvent ? firstEvent.subdivision || 0 : 0;
    const tickOffset = firstEvent ? firstEvent.tick || 0 : 0;

    console.log('🎼 [HARMONY-WIDGET] Normalizing MIDI to start at measure 0 (bar 1):', {
      firstEventOriginal: firstEvent,
      offsets: { measureOffset, beatOffset, subdivisionOffset, tickOffset },
      totalNotes: exercise.harmonyNotes.length,
      totalCCEvents: exercise.harmonyControlChanges?.length || 0,
      result: 'MIDI file start → measure 0 (bar 1 of exercise), all events shifted by offset',
    });

    const harmonyEvents = exercise.harmonyNotes.map((note: any, index: number) => {
      // Convert MIDI ticks to seconds using current tempo
      // Formula: durationSeconds = (durationTicks / 480) * (60 / bpm)
      // - 480 = MIDI PPQ (Pulses Per Quarter note) - STANDARD MIDI RESOLUTION
      // - 60 / bpm = seconds per quarter note
      // - durationTicks / 480 = number of quarter notes
      // - result = duration in seconds
      const durationSeconds = note.durationTicks
        ? (note.durationTicks / 480) * (60 / bpm)
        : 2; // Fallback to 2 seconds if durationTicks missing

      // DIAGNOSTIC: Log first 3 notes to verify BPM and duration calculation
      if (index < 3) {
        console.log(`[HARMONY DURATION DIAGNOSTIC] Note ${index + 1}:`, {
          durationTicks: note.durationTicks,
          bpm,
          calculation: `(${note.durationTicks} / 480) * (60 / ${bpm})`,
          durationSeconds,
          expectedAt69BPM: (note.durationTicks / 480) * (60 / 69),
        });
      }

      // PPQ DIAGNOSTIC: Verify position.tick and durationTicks are both at 480 PPQ
      if (index < 3) {
        console.log(`[PPQ DIAGNOSTIC] Note ${index + 1}:`, {
          positionTick: note.position.tick || 0,
          durationTicks: note.durationTicks,
          tickRatio: ((note.position.tick || 0) / (note.durationTicks || 1)).toFixed(2),
          expectedPPQ: 480,
          suspectedPPQ_ifDouble: 'If tick/duration ratio is ~2x expected, position.tick is at 960 PPQ',
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
        console.log(`[HARMONY WIDGET] Note ${index + 1} RAW DATA from database:`, {
          id: note.id,
          ticks: note.ticks,
          ticksType: typeof note.ticks,
          ticksUndefined: note.ticks === undefined,
          pitch: note.pitch,
          noteName: note.noteName,
          position: note.position,
          durationTicks: note.durationTicks,
          allKeys: Object.keys(note),
        });
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
        }
      };

      // DIAGNOSTIC: Verify ticks are being set correctly in event object
      if (index < 5 || index === 8) {
        console.log(`[HARMONY WIDGET] Note ${index + 1} EVENT OBJECT created:`, {
          noteName: note.noteName,
          absoluteTicksVariable: absoluteTicks,
          eventDataTicks: eventObject.data.ticks,
          areEqual: absoluteTicks === eventObject.data.ticks,
        });
      }

      return eventObject;
    });

    // Add control change events (sustain pedal, expression, etc.) if present
    const controlChangeEvents = (exercise.harmonyControlChanges || []).map((cc, index) => {
      // DIAGNOSTIC: Log CC64 absolute ticks from database
      if (cc.cc === 64 && index < 3) {
        console.log(`[HARMONY WIDGET] CC64 event ${index + 1} from database:`, {
          cc: cc.cc,
          value: cc.value,
          absoluteTicks: cc.ticks,
          position: cc.position,
        });
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
      if (rawPosition.measure < 0 || rawPosition.beat < 0 || rawPosition.subdivision < 0 || rawPosition.tick < 0) {
        console.warn('[CC64 CONVERSION] ⚠️ Negative position detected and clamped:', {
          ccNumber: cc.cc,
          ccValue: cc.value,
          originalPosition: cc.position,
          offsets: { measureOffset, beatOffset, subdivisionOffset, tickOffset },
          rawPosition,
          clampedPosition: adjustedPosition,
          explanation: 'CC event appeared before first note in MIDI file',
        });
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
        }
      };
    });

    // Combine note events and control change events
    const allHarmonyEvents = [...harmonyEvents, ...controlChangeEvents];

    // DIAGNOSTIC: Verify ticks are preserved in combined array
    const firstFewNotes = allHarmonyEvents.filter((e: any) => e.type === 'harmony-note').slice(0, 3);
    console.log('[HARMONY WIDGET] allHarmonyEvents - first 3 notes after combining:',
      firstFewNotes.map((e: any, i: number) => ({
        index: i + 1,
        noteName: e.data?.noteName,
        ticks: e.data?.ticks,
        position: e.position,
      }))
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
      bpm,
    });

    const harmonyRegion = {
      id: `harmony-region-${exercise.id?.value || 'default'}`,
      trackId: 'harmony-widget-track',
      startTime: 0,
      duration: (exercise.durationBeats || 32) * (60 / bpm),
      pattern: {
        id: `harmony-pattern-${exercise.id?.value || 'default'}`,
        name: 'Harmony Pattern',
        type: 'harmony',
        events: allHarmonyEvents, // Includes both notes and control changes
      }
    };

    // Register track with RegionProcessor
    // Use updateTracks if already running, registerTracks if not
    try {
      const trackData = [{
        id: 'harmony-widget-track',
        name: 'Harmony',
        instrumentType: 'harmony',
        exerciseId: exercise.id?.value, // For caching CC64 timeline and event schedule
        regions: [harmonyRegion],
        audioNode: plugin.audioNode,
      }];

      // Check if RegionProcessor is already running (play button was clicked before harmony was ready)
      const isRunning = (regionProcessor as any).isRunning;

      // FAANG FIX: Pass exercise metadata to RegionProcessor for early instrument detection
      const exerciseMetadata = {
        harmonyInstrument: exercise.harmonyInstrument || 'wurlitzer'
      };

      if (isRunning) {
        console.log('⚡ [HARMONY-WIDGET] RegionProcessor already running - using updateTracks()');
        regionProcessor.updateTracks(trackData, exerciseMetadata);
      } else {
        console.log('📝 [HARMONY-WIDGET] RegionProcessor not running yet - using registerTracks()');
        regionProcessor.registerTracks(trackData);
        // Also set instrument type early for registerTracks path
        (regionProcessor as any).currentHarmonyInstrument = exerciseMetadata.harmonyInstrument;
      }

      console.log('✅ [HARMONY-WIDGET] Harmony registered with RegionProcessor', {
        eventsCount: harmonyEvents.length,
        duration: harmonyRegion.duration,
        bpm,
        method: isRunning ? 'updateTracks' : 'registerTracks',
      });

      logger.info('🎹 Harmony registered with RegionProcessor', {
        noteCount: harmonyEvents.length,
        exerciseId: exercise.id?.value,
        bpm,
        isRunning,
      });
    } catch (error) {
      console.error('❌ [HARMONY-WIDGET] Failed to register harmony:', error);
      logger.error('Failed to register harmony with RegionProcessor', error as Error);
    }
  }, [exercise, bpm]); // Removed logger - it's only used for side effects, doesn't affect callback behavior

  // Schedule chord progression (fallback when no exercise harmony_notes)
  const scheduleProgression = useCallback(() => {
    const plugin = keyboardPluginRef.current;
    if (!plugin || !track.isPlaying) return;

    const selectedProg =
      chordProgressions[selectedProgression as keyof typeof chordProgressions];
    if (!selectedProg) return;

    const context = track.track?.audioContext;
    if (!context) return;

    // Get current transport time
    const currentTime = context.currentTime;
    const beatDuration = 60 / bpm; // Duration of one beat in seconds

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
  }, [selectedProgression, bpm, onNextChord]); // Removed track.isPlaying - it's checked inside the function, no need as dependency

  // CHECKPOINT 10: RegionProcessor registration - track when and why registration runs
  useEffect(() => {
    const timestamp = Date.now();
    const currentExercise = exerciseRef.current;
    const currentIsPlaying = isPlayingRef.current;

    console.log('🔍 [CHECKPOINT-10] Registration effect triggered:', {
      timestamp,
      currentInstrumentState: currentInstrument,
      currentInstrumentRef: currentInstrumentRef.current,
      exerciseHarmonyInstrument: currentExercise?.harmonyInstrument,
      exerciseId: currentExercise?.id?.value,
      exerciseTitle: currentExercise?.title,
    });

    console.log('🎹🎹🎹 [HARMONY-WIDGET] Registration effect triggered:', {
      timestamp,
      isPlaying: currentIsPlaying,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      hasPlugin: !!keyboardPluginRef.current,
      hasExercise: !!currentExercise,
      hasHarmonyNotes: !!currentExercise?.harmonyNotes,
      harmonyNotesCount: currentExercise?.harmonyNotes?.length || 0,
      exerciseId: currentExercise?.id?.value,
    });

    // CRITICAL FIX: Register harmony buffers when exercise changes, regardless of playing state
    // This ensures RegionProcessor always has the correct instrument's buffers loaded
    // We need to register in two scenarios:
    // 1. When exercise changes (to update buffers) - even if not playing
    // 2. When playback starts (to ensure buffers are ready)
    const shouldRegister = track.isReady && wamPluginLoaded && keyboardPluginRef.current &&
        currentExercise?.harmonyNotes && currentExercise.harmonyNotes.length > 0;

    console.log('🔍 [CHECKPOINT-10-CONDITIONS] Should register?', {
      shouldRegister,
      trackIsReady: track.isReady,
      wamPluginLoaded,
      hasKeyboardPlugin: !!keyboardPluginRef.current,
      hasHarmonyNotes: !!currentExercise?.harmonyNotes,
      harmonyNotesLength: currentExercise?.harmonyNotes?.length || 0,
    });

    if (shouldRegister) {
      console.log('🔍 [CHECKPOINT-10-WILL-REGISTER] All conditions met, calling registerHarmonyWithRegionProcessor');
      console.log('🔥🔥🔥 [HARMONY-WIDGET] ALL CONDITIONS MET - Registering harmony buffers!', {
        timestamp,
        exerciseId: currentExercise?.id,
        harmonyNotesCount: currentExercise.harmonyNotes.length,
        isPlaying: currentIsPlaying,
        reason: currentIsPlaying ? 'playback started' : 'exercise changed',
      });

      // Register harmony events and buffers for this exercise
      // This updates RegionProcessor with the correct instrument's buffers
      // Note: WamKeyboard automatically disconnects old instrument and connects new one
      registerHarmonyWithRegionProcessor();
    } else {
      const missingConditions = [];
      if (!track.isReady) missingConditions.push('track not ready');
      if (!wamPluginLoaded) missingConditions.push('plugin not loaded');
      if (!keyboardPluginRef.current) missingConditions.push('no plugin ref');
      if (!currentExercise?.harmonyNotes) missingConditions.push('no harmony notes');
      if (currentExercise?.harmonyNotes && currentExercise.harmonyNotes.length === 0) missingConditions.push('harmony notes empty');

      console.log('⏳ [HARMONY-WIDGET] Waiting for conditions:', missingConditions.join(', '));
    }
  }, [track.isReady, wamPluginLoaded, registerHarmonyWithRegionProcessor, exercise?.id]);
  // CRITICAL: Include exercise?.id to re-register when switching exercises

  // Effect to handle manual chord progression playback (legacy)
  useEffect(() => {
    if (isPlaying && track.isReady && wamPluginLoaded && keyboardPluginRef.current) {
      // Only use manual chord progression if no harmony notes in exercise
      if (!exercise?.harmonyNotes || exercise.harmonyNotes.length === 0) {
        console.log('⚠️ [HARMONY-WIDGET] NO HARMONY NOTES - Using chord progression');
        logger.info('🎹 Using manual chord progression for playback');
        scheduleProgression();
      }
    }

    // RegionProcessor handles stop automatically - no custom stop logic needed!
    // When stop is clicked, RegionProcessor.stop() cancels all scheduled sources
  }, [isPlaying, track.isReady, wamPluginLoaded, exercise, scheduleProgression, logger]);

  // Handle progression changes
  // Handle pattern change from pattern library
  const handlePatternLibraryChange = useCallback(async (libraryPattern: any) => {
    // Load MIDI file from URL
    if (libraryPattern.midiFileUrl) {
      try {
        logger.info('Loading harmony pattern from MIDI:', {
          name: libraryPattern.name,
          url: libraryPattern.midiFileUrl,
          correlationId
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
        logger.error('Failed to load harmony pattern:', error, { correlationId });
      }
    }
  }, [onProgressionChange, logger, correlationId]);

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
            onChange={setVolume}
            color="bg-blue-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
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
                  {/* Chord progression dots */}
                  <div className="flex gap-1">
                    {progression.slice(0, 4).map((chord, idx) => (
                      <div
                        key={idx}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium transition-all duration-200 ${
                          idx === localCurrentChord && isPlaying
                            ? 'bg-blue-400 text-white shadow-lg shadow-blue-400/50'
                            : 'bg-slate-700 text-slate-400'
                        }`}
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
                          onClick={() => setShowPatternLibrary(!showPatternLibrary)}
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
                          <span className="text-xs font-medium text-slate-300">Harmony Pattern Library</span>
                          <button
                            onClick={() => setShowPatternLibrary(false)}
                            className="text-xs text-slate-500 hover:text-slate-400"
                          >
                            ✕
                          </button>
                        </div>
                        {patternSelector.isLoading ? (
                          <div className="text-xs text-slate-500">Loading patterns...</div>
                        ) : (
                          <div className="space-y-1 max-h-32 overflow-y-auto">
                            {patternSelector.availableHarmonyPatterns.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => {
                                  patternSelector.selectHarmonyPattern(p);
                                  handlePatternLibraryChange(p);
                                  setShowPatternLibrary(false);
                                }}
                                className={`w-full text-left p-1.5 text-xs rounded hover:bg-slate-700 transition-colors ${
                                  patternSelector.selectedHarmonyPattern?.id === p.id
                                    ? 'bg-slate-700 text-blue-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span>{p.name}</span>
                                  {p.genre && (
                                    <span className="text-xs text-slate-500">{p.genre}</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Current Chord Display */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-slate-400 w-16">
                        Chords:
                      </span>
                      <div className="flex gap-1">
                        {progression.map((chord, idx) => (
                          <div
                            key={idx}
                            className={`w-8 h-6 rounded text-xs flex items-center justify-center font-medium transition-all duration-200 cursor-default ${
                              idx === localCurrentChord && isPlaying
                                ? 'bg-blue-400 text-white shadow-lg shadow-blue-400/50'
                                : 'bg-slate-700 text-slate-400'
                            }`}
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
}
