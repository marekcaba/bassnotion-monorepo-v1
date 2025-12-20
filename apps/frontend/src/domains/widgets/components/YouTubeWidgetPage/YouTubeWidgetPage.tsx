'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
// Import our new components
import { YouTubeVideoSection } from './YouTubeVideoSection';
import { TutorialInfoCard } from './TutorialInfoCard';
import { ExerciseSelector } from './ExerciseSelector';
import { FretboardCard } from './FretboardCard';
import Fretboard3D from './FretboardCard/components/Fretboard3D';

import { FourWidgetsCard } from './components/FourWidgetsCard';
import { GlobalControlsCard } from './components/GlobalControlsCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { TransportClock } from './components/TransportClock';
import { TimingDebugWindow } from './components/TimingDebugWindow';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useAudioFretboard } from '@/domains/widgets/hooks/useAudioFretboard';
import {
  TransportProvider,
  useTransportContext,
} from '@/domains/playback/contexts/TransportContext';
// REMOVED: useExerciseSelection import - not needed for tutorial pages
import { Button } from '@/shared/components/ui/button';
import { Play, Pause, Volume2, Settings, Edit2, ArrowLeft } from 'lucide-react';
import { SyncProvider, useSyncContext } from '../base/SyncProvider';
import { UserIndicator } from '@/domains/user/components/UserIndicator';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';
import { getLogger } from '@/utils/logger.js';
import { useObjectChangeTracker, useWhyDidYouUpdate } from '@/utils/debugUtils';
import type { Tutorial } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { getSamplePreloader } from '@/domains/playback/services/InitialSamplePreloader.js';
import { GlobalSampleCache } from '@/domains/playback/modules/storage/cache/GlobalSampleCache.js';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry.js';
// UIZoneProvider and ThemeSwitcher are now applied at root layout level
// Only NextUIZoneProvider is needed here for NextUI component support
import { NextUIZoneProvider } from '@/ui-libraries';
import { logSkeletonDebug } from '@/utils/skeletonDebug';
import { HomeNavbar } from '@/app/_components/HomeNavbar';

const logger = getLogger('youtube-widget');

interface YouTubeWidgetPageProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[]; // Exercise data from tutorial API
}

// Render counter for debugging
let youTubeWidgetPageContentRenderCount = 0;

// Track what's causing re-renders
let prevProps: any = {};

// Inner component that has access to sync context
function YouTubeWidgetPageContent({
  tutorialData,
  tutorialSlug,
  exercises,
}: YouTubeWidgetPageProps) {
  youTubeWidgetPageContentRenderCount++;

  // SKELETON-DEBUG: Log first 5 renders with timing (using shared baseline)
  logSkeletonDebug('🎬', 'YouTubeWidgetPageContent', youTubeWidgetPageContentRenderCount, {
    hasTutorialData: !!tutorialData,
    hasExercises: !!exercises,
    exerciseCount: exercises?.length ?? 0,
  });

  // Track prop changes
  const propChanges: string[] = [];
  if (prevProps.tutorialData !== tutorialData) propChanges.push('tutorialData');
  if (prevProps.tutorialSlug !== tutorialSlug) propChanges.push('tutorialSlug');
  if (prevProps.exercises !== exercises) propChanges.push('exercises');

  prevProps = { tutorialData, tutorialSlug, exercises };

  // Debug: Log component render for debugging re-render issues (only every 10th render)
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info(
      `🔄 YouTubeWidgetPageContent RENDER #${youTubeWidgetPageContentRenderCount}:`,
      {
        tutorialData: tutorialData?.title,
        tutorialSlug,
        exercisesCount: exercises?.length || 0,
        propChanges: propChanges.length > 0 ? propChanges : 'no prop changes',
        timestamp: new Date().toISOString(),
        stack: new Error().stack?.split('\n').slice(1, 4).join(' <- '),
      },
    );
  }

  // Only log hook calls every 10th render
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 HOOK CALLS - starting hook calls...');
  }

  const widgetState = useWidgetPageState();
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 widgetState returned:', {
      isPlaying: widgetState.isPlaying,
      tempo: widgetState.tempo,
      selectedExerciseId: widgetState.selectedExercise?.id,
      objectIdentity: widgetState === widgetState ? 'SAME' : 'DIFFERENT',
    });
  }

  const { emitGlobalEvent, syncState } = useSyncContext();
  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 syncContext returned:', {
      exerciseId: syncState.exercise?.selectedExercise?.id,
      isPlaying: syncState.playback?.isPlaying,
      tempo: syncState.playback?.tempo,
    });
  }

  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const { isAuthenticated } = useAuth();
  const { navigateWithTransition } = useViewTransitionRouter();
  const isAdmin = profile?.role === 'admin';

  // FAANG Solution: Clear state management for preview mode
  // Only check sessionStorage, don't rely on referrer (unreliable)
  const [isPreviewingFromEdit, setIsPreviewingFromEdit] = React.useState(false);

  useEffect(() => {
    // Check if this specific tutorial is being previewed from edit mode
    const previewingSlug = sessionStorage.getItem('previewingFromEdit');
    setIsPreviewingFromEdit(previewingSlug === tutorialSlug);
  }, [tutorialSlug]);

  if (youTubeWidgetPageContentRenderCount % 10 === 0) {
    logger.info('🔍 profile returned:', {
      hasProfile: !!profile,
      profileId: profile?.id,
      isAdmin,
    });
  }

  // Track object changes for debugging - but limit to avoid noise
  useObjectChangeTracker(
    'widgetState',
    widgetState,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );
  useObjectChangeTracker(
    'syncState',
    syncState,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );
  useObjectChangeTracker(
    'profile',
    profile,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );
  useObjectChangeTracker(
    'exercises',
    exercises,
    youTubeWidgetPageContentRenderCount % 10 === 0,
  );

  // Track SyncProvider context changes
  const prevSyncContextRef = useRef({ syncState, emitGlobalEvent, profile });
  useEffect(() => {
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      const changes: string[] = [];
      if (prevSyncContextRef.current.syncState !== syncState) {
        changes.push('syncState');
        // Deep compare to see what changed in syncState
        logger.info(`🔍 SyncState changes detected:`, {
          prevPlayback: prevSyncContextRef.current.syncState?.playback,
          newPlayback: syncState?.playback,
          playbackSame:
            prevSyncContextRef.current.syncState?.playback ===
            syncState?.playback,
          prevExercise: prevSyncContextRef.current.syncState?.exercise,
          newExercise: syncState?.exercise,
          exerciseSame:
            prevSyncContextRef.current.syncState?.exercise ===
            syncState?.exercise,
          prevUi: prevSyncContextRef.current.syncState?.ui,
          newUi: syncState?.ui,
          uiSame: prevSyncContextRef.current.syncState?.ui === syncState?.ui,
          prevTransport: prevSyncContextRef.current.syncState?.transport,
          newTransport: syncState?.transport,
          transportSame:
            prevSyncContextRef.current.syncState?.transport ===
            syncState?.transport,
        });
      }
      if (prevSyncContextRef.current.emitGlobalEvent !== emitGlobalEvent)
        changes.push('emitGlobalEvent');
      if (prevSyncContextRef.current.profile !== profile)
        changes.push('profile');

      if (changes.length > 0) {
        logger.info(
          `🔄 Context changes detected #${youTubeWidgetPageContentRenderCount}:`,
          changes,
        );
      }

      prevSyncContextRef.current = { syncState, emitGlobalEvent, profile };
    }
  });
  // REMOVED: globalExerciseSelection - causes circular updates
  // Tutorial pages should use local state only, not global exercise selection

  // Get transport for seek functionality
  const transport = useTransportContext();
  const [is3DMode, setIs3DMode] = React.useState(false);
  const [selectedDots, setSelectedDots] = React.useState<Map<string, number[]>>(
    new Map(),
  );
  const [stringCount, setStringCountInternal] = React.useState<4 | 5 | 6>(4);
  const [maxFrets, setMaxFrets] = React.useState(25);
  const [showTimingDebug, setShowTimingDebug] = React.useState(false);

  // Wrapped setStringCount to log every change
  const setStringCount = React.useCallback(
    (value: 4 | 5 | 6 | ((prev: 4 | 5 | 6) => 4 | 5 | 6)) => {
      setStringCountInternal((prevStringCount) => {
        const newValue =
          typeof value === 'function' ? value(prevStringCount) : value;
        return newValue;
      });
    },
    [],
  ); // Fixed: Empty dependency array - function is stable

  // Track why this component is re-rendering (only every 10th render)
  // Moved after playbackControls is defined
  useWhyDidYouUpdate('YouTubeWidgetPageContent', {
    tutorialData,
    tutorialSlug,
    exercises,
    widgetState,
    syncState,
    profile,
    emitGlobalEvent,
    transport,
  });

  // Track transport object specifically
  const prevTransportRef = useRef<any>(null);
  useEffect(() => {
    if (
      youTubeWidgetPageContentRenderCount % 10 === 0 ||
      prevTransportRef.current !== transport
    ) {
      logger.info(
        `🎮 Transport check #${youTubeWidgetPageContentRenderCount}:`,
        {
          sameReference: prevTransportRef.current === transport,
          hadPrevious: !!prevTransportRef.current,
          transportKeys: transport ? Object.keys(transport) : [],
          timestamp: Date.now(),
        },
      );

      if (prevTransportRef.current && transport) {
        // Check individual method references
        const methodChecks: Record<string, boolean> = {};
        Object.keys(transport).forEach((key) => {
          methodChecks[key] = prevTransportRef.current[key] === transport[key];
        });
        logger.info(`🎮 Method reference checks:`, methodChecks);
      }

      prevTransportRef.current = transport;
    }
  });

  // Load bass settings from user profile
  // OPTIMIZATION: Extract actual values to avoid re-running when profile object reference changes
  const bassStringCount = profile?.preferences?.bassConfiguration?.stringCount;
  const bassMaxFrets = profile?.preferences?.bassConfiguration?.maxFrets;

  useEffect(() => {
    if (
      !isProfileLoading &&
      bassStringCount !== undefined &&
      bassMaxFrets !== undefined
    ) {
      setStringCount(bassStringCount);
      setMaxFrets(bassMaxFrets);
    }
  }, [bassStringCount, bassMaxFrets, isProfileLoading]); // Depend on primitive values, not objects

  // Listen for bass settings changes from dashboard (still useful for real-time updates)
  useEffect(() => {
    const handleBassSettingsChange = (event: CustomEvent) => {
      const { stringCount: newStringCount, maxFrets: newMaxFrets } =
        event.detail;
      setStringCount(newStringCount);
      setMaxFrets(newMaxFrets);
      // Clear selection when changing string count to avoid invalid selections
      setSelectedDots(new Map());
    };

    window.addEventListener(
      'bass-settings-changed',
      handleBassSettingsChange as EventListener,
    );

    return () => {
      window.removeEventListener(
        'bass-settings-changed',
        handleBassSettingsChange as EventListener,
      );
    };
  }, []); // FIXED: Empty dependency array - listener should only be set up once
  const [tiltAngle, setTiltAngle] = React.useState(35);
  const [cameraDistance, _setCameraDistance] = React.useState(7);
  const [cameraMode, setCameraMode] = React.useState<'overview' | 'action'>(
    'overview',
  );

  // FAANG Solution: Lift selected exercise state to parent
  const [selectedExerciseId, setSelectedExerciseId] = React.useState<
    string | null
  >(null);

  // Use refs to track previous values and prevent infinite loops
  const prevSelectedExerciseRef = useRef<any>(null);
  const prevTempoRef = useRef<number>(120);
  const prevVolumeRef = useRef<number>(80);

  // Audio fretboard integration for 3D mode
  const { triggerNote } = useAudioFretboard({
    stringCount,
    autoPlayOnClick: true,
    exercise: widgetState.selectedExercise,
  });

  // FIX: Store exercises in a ref to prevent callback recreation on data changes
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;

  // FAANG Solution: Auto-select first exercise when exercises load (parent controls selection)
  useEffect(() => {
    console.log('🔍 [YOUTUBE-WIDGET] Auto-selection effect triggered:', {
      hasExercises: !!exercises,
      exerciseCount: exercises?.length || 0,
      selectedExerciseId,
      shouldAutoSelect:
        exercises && exercises.length > 0 && !selectedExerciseId,
    });

    if (exercises && exercises.length > 0 && !selectedExerciseId) {
      // CRITICAL FIX: Defer auto-selection with longer delay to avoid race condition
      const timeoutId = setTimeout(() => {
        const firstExercise = exercises[0];
        if (firstExercise?.id && !selectedExerciseId) {
          console.log(
            '🎯 [YOUTUBE-WIDGET] Auto-selecting first exercise via handleExerciseSelect:',
            {
              exerciseId: firstExercise.id,
              exerciseTitle: firstExercise.title,
              hasHarmonyNotes: !!firstExercise.harmonyNotes,
              harmonyInstrument: firstExercise.harmonyInstrument,
            },
          );
          // CRITICAL FIX: Use handleExerciseSelect instead of direct state updates
          // This ensures harmony-samples-loaded event is emitted for auto-selected exercises
          const exerciseIdStr =
            typeof firstExercise.id === 'object'
              ? firstExercise.id.value
              : firstExercise.id;

          if (handleExerciseSelectRef.current) {
            handleExerciseSelectRef.current(exerciseIdStr);
          } else {
            console.error(
              '❌ [YOUTUBE-WIDGET] handleExerciseSelectRef not ready!',
            );
            // Fallback to direct state update
            setSelectedExerciseId(firstExercise.id);
            requestAnimationFrame(() => {
              widgetStateRef.current.setSelectedExercise(firstExercise);
            });
          }
        }
      }, 150); // 150ms delay to let FretboardCard initialize first

      return () => clearTimeout(timeoutId);
    }
  }, [exercises, selectedExerciseId]); // Removed widgetState and globalExerciseSelection - using refs

  // Store widgetState methods in refs to avoid dependencies
  const widgetStateRef = useRef(widgetState);
  widgetStateRef.current = widgetState;

  // Ref for handleExerciseSelect to avoid stale closure in auto-selection effect
  const handleExerciseSelectRef = useRef<(exerciseId: string) => void>(
    () => {},
  );

  // REMOVED: globalExerciseSelectionRef - not needed without global selection

  // Memoize event handlers to prevent re-renders
  const handleToggle3DMode = useCallback(() => {
    setIs3DMode((prev) => !prev);
  }, []);

  const handleSetStringCount3D = useCallback(
    (count: number) => {
      setStringCount(count as 4 | 5 | 6);
    },
    [setStringCount],
  );

  const handleSetCameraMode = useCallback((mode: CameraMode) => {
    setCameraMode(mode);
  }, []);

  const handleSetSelectedDots3D = useCallback((dots: Set<string>) => {
    setSelectedDots(dots);
  }, []);

  const handleExerciseSelect = useCallback(
    async (exerciseId: string) => {
      // Find the exercise from the exercises array using ref
      // Handle both string IDs and ExerciseId objects
      const exercise = exercisesRef.current?.find((ex) => {
        const exIdStr =
          typeof ex.id === 'object' && ex.id !== null
            ? (ex.id as any).value
            : ex.id;
        return exIdStr === exerciseId;
      });

      console.log('🔍🔍🔍 [EXERCISE-SELECT-DEBUG] Raw exercise data:', {
        exerciseId,
        foundExercise: !!exercise,
        exerciseTitle: exercise?.title,
        harmonyInstrument: exercise?.harmonyInstrument,
        hasHarmonyInstrument: !!exercise?.harmonyInstrument,
        harmonyNotes: exercise?.harmonyNotes,
        hasHarmonyNotes: !!exercise?.harmonyNotes,
        harmonyNotesLength: exercise?.harmonyNotes?.length,
        harmonyNotesIsArray: Array.isArray(exercise?.harmonyNotes),
        condition1: !!exercise?.harmonyInstrument,
        condition2: !!exercise?.harmonyNotes,
        condition3: exercise?.harmonyNotes?.length > 0,
        allConditionsMet: !!(
          exercise?.harmonyInstrument &&
          exercise?.harmonyNotes &&
          exercise.harmonyNotes.length > 0
        ),
      });

      if (exercise) {
        logger.info('🎯 Exercise selected:', {
          id: exercise.id,
          title: exercise.title,
          bpm: exercise.bpm,
          duration: exercise.duration,
          duration_beats: exercise.duration_beats,
          timeSignature: exercise.timeSignature,
          hasDrumPattern: !!exercise.drum_pattern,
          drumPatternEnabled: exercise.drum_pattern?.enabled,
          drumPatternLength: exercise.drum_pattern?.pattern?.length,
          harmonyInstrument: exercise.harmonyInstrument,
        });

        // Update parent state (single source of truth)
        setSelectedExerciseId(exerciseId);

        // Update widget state with the selected exercise
        widgetStateRef.current.setSelectedExercise(exercise);

        // REMOVED: globalExerciseSelection update - causes circular updates
        // Only emit to sync context for widget synchronization
        emitGlobalEvent('exercise:selected', { exerciseId, exercise });

        // 🆕 SEO OPTIMIZATION: Defer sample loading to ScrollTriggerLoader
        // Auto-selection happens at T+150ms for fast page load, but sample loading is deferred
        // until user scrolls (handled by ScrollTriggerLoader.loadTutorialSamples).
        // This ensures fast initial page render for SEO while still loading samples before play.
        //
        // For SUBSEQUENT exercise selections (after scroll has occurred), we load immediately.
        const scrollHasTriggered = WindowRegistry.getSamplesReady();

        if (
          exercise.harmonyInstrument &&
          exercise.harmonyNotes &&
          exercise.harmonyNotes.length > 0
        ) {
          console.log(
            '🔍 [EXERCISE-SELECT] Checking if samples need loading:',
            {
              exerciseId: exercise.id,
              instrument: exercise.harmonyInstrument,
              harmonyNotesCount: exercise.harmonyNotes.length,
              scrollHasTriggered,
            },
          );

          // If scroll hasn't happened yet, skip loading - ScrollTriggerLoader handles it
          if (!scrollHasTriggered) {
            console.log(
              '⏳ [EXERCISE-SELECT] Scroll not triggered yet, deferring sample load to ScrollTriggerLoader',
            );
            // Don't load samples yet - ScrollTriggerLoader will handle it on scroll
            // This keeps initial page load fast for SEO
            return;
          }

          // Check if samples already cached for this instrument
          const sampleCache = GlobalSampleCache.getInstance();
          const testCacheKey = `${exercise.harmonyInstrument}-v3-C4`; // Representative sample
          const alreadyCached = sampleCache.getCachedBuffer(testCacheKey);

          if (!alreadyCached) {
            console.log(
              '📥 [EXERCISE-SELECT] Samples not cached, loading:',
              exercise.harmonyInstrument,
            );
            logger.info('Loading samples for new instrument:', {
              instrument: exercise.harmonyInstrument,
              exerciseId: exercise.id,
            });

            // Load samples in background (non-blocking)
            getSamplePreloader()
              .loadFullSamples(exercise)
              .then((result) => {
                console.log('✅ [EXERCISE-SELECT] Samples loaded:', {
                  instrument: exercise.harmonyInstrument,
                  loaded: result?.loaded ?? 'N/A',
                  total: result?.total ?? 'N/A',
                  success: result?.success ?? true,
                });
                logger.info('Samples loaded successfully for exercise:', {
                  instrument: exercise.harmonyInstrument,
                  result,
                });

                // CRITICAL FIX: Emit event to trigger HarmonyWidget re-registration
                // This ensures harmony track gets registered after samples finish loading
                console.log(
                  '📢 [EXERCISE-SELECT] Emitting samples-loaded event for HarmonyWidget',
                );
                // Emit via window for HarmonyWidget's window listener
                if (typeof window !== 'undefined') {
                  const event = new CustomEvent('harmony-samples-loaded', {
                    detail: {
                      exerciseId: exercise.id,
                      instrument: exercise.harmonyInstrument,
                      samplesLoaded: result?.loaded ?? true,
                    },
                  });
                  window.dispatchEvent(event);
                }
                // Also emit via sync context
                emitGlobalEvent('harmony-samples-loaded', {
                  exerciseId: exercise.id,
                  instrument: exercise.harmonyInstrument,
                  samplesLoaded: result?.loaded ?? true,
                });
              })
              .catch((error) => {
                console.error(
                  '❌ [EXERCISE-SELECT] Failed to load samples:',
                  error,
                );
                logger.error('Failed to load samples for exercise:', error);
              });
          } else {
            console.log(
              '✅ [EXERCISE-SELECT] Samples already cached for:',
              exercise.harmonyInstrument,
            );
            logger.info('Samples already cached, skipping load:', {
              instrument: exercise.harmonyInstrument,
            });

            // CRITICAL FIX: Still emit the event so HarmonyWidget switches to correct instrument
            // Even when cached, we need to trigger re-registration with the new instrument's buffers
            console.log(
              '📢 [EXERCISE-SELECT] Emitting samples-loaded event (cached) for HarmonyWidget',
            );
            // Emit via window for HarmonyWidget's window listener
            if (typeof window !== 'undefined') {
              const event = new CustomEvent('harmony-samples-loaded', {
                detail: {
                  exerciseId: exercise.id,
                  instrument: exercise.harmonyInstrument,
                  samplesLoaded: true,
                  fromCache: true,
                },
              });
              window.dispatchEvent(event);
            }
            // Also emit via sync context
            emitGlobalEvent('harmony-samples-loaded', {
              exerciseId: exercise.id,
              instrument: exercise.harmonyInstrument,
              samplesLoaded: true,
              fromCache: true,
            });
          }
        }
      }
    },
    [emitGlobalEvent], // Only depend on emitGlobalEvent
  );

  // Keep ref in sync with latest handleExerciseSelect
  handleExerciseSelectRef.current = handleExerciseSelect;

  const handleDotClick = useCallback(
    (stringIndex: number, fret: number | 'open') => {
      // Trigger audio using the shared hook (for 3D mode)
      triggerNote(stringIndex, fret);

      const key = `${stringIndex}-${fret}`;
      setSelectedDots((prev) => {
        const newMap = new Map(prev);
        if (newMap.has(key)) {
          newMap.delete(key);
        } else {
          newMap.set(key, [newMap.size + 1]);
        }
        return newMap;
      });
    },
    [triggerNote],
  );

  const handleResetSelection = useCallback(() => {
    setSelectedDots(new Map());
  }, []);

  const handleTiltAngleChange = useCallback((newTiltAngle: number) => {
    setTiltAngle(newTiltAngle);
  }, []);

  // Handle play state changes from GlobalControls
  const handlePlayStateChange = useCallback((isPlaying: boolean) => {
    console.log('🎵 [YOUTUBE-WIDGET] handlePlayStateChange called:', {
      isPlaying,
    });

    // Update widget state to match transport state
    if (isPlaying) {
      // Only toggle if currently not playing
      if (!widgetStateRef.current.state.isPlaying) {
        widgetStateRef.current.togglePlayback();
        console.log(
          '🎵 [YOUTUBE-WIDGET] Called widgetState.togglePlayback() to set isPlaying=true',
        );
      }
    } else {
      // Only toggle if currently playing
      if (widgetStateRef.current.state.isPlaying) {
        widgetStateRef.current.togglePlayback();
        console.log(
          '🎵 [YOUTUBE-WIDGET] Called widgetState.togglePlayback() to set isPlaying=false',
        );
      }
    }
  }, []);

  // Extract specific values from syncState to prevent excessive re-renders
  const selectedExercise = syncState.exercise.selectedExercise;
  const syncTempo = syncState.playback.tempo;
  const syncMasterVolume = syncState.ui.masterVolume;

  // Listen for exercise changes in sync state
  useEffect(() => {
    // Only log every 10th time to reduce noise
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      logger.info('🔥 useEffect [selectedExercise] triggered:', {
        selectedExercise: selectedExercise?.id,
        prevSelectedExercise: prevSelectedExerciseRef.current?.id,
        areEqual: selectedExercise === prevSelectedExerciseRef.current,
      });
    }

    if (
      selectedExercise &&
      selectedExercise !== prevSelectedExerciseRef.current
    ) {
      // Debug log (disabled to reduce console noise)
      // logger.info(
      //   '🎛️ Global Controls: Exercise changed in sync state:',
      //   selectedExercise,
      // );

      prevSelectedExerciseRef.current = selectedExercise;

      // Update global tempo if exercise has BPM
      if (
        selectedExercise.bpm &&
        selectedExercise.bpm > 0 &&
        selectedExercise.bpm !== prevTempoRef.current
      ) {
        // Debug log (disabled to reduce console noise)
        // logger.info(
        //   '🎛️ Global Controls: Updating tempo to:',
        //   selectedExercise.bpm,
        // );
        widgetStateRef.current.setTempo(selectedExercise.bpm);
        prevTempoRef.current = selectedExercise.bpm;
      }

      // Update selected exercise in widget state
      // COMMENTED OUT: This line causes infinite loop and blocks all clicks
      // widgetStateRef.current.setSelectedExercise(selectedExercise);
    }
  }, [selectedExercise]); // Removed widgetState - using ref

  // Listen for tempo changes in sync state
  useEffect(() => {
    // Only log every 10th time to reduce noise
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      logger.info('🔥 useEffect [syncTempo] triggered:', {
        syncTempo,
        prevTempo: prevTempoRef.current,
        widgetTempo: widgetState.tempo,
        condition1: !!syncTempo,
        condition2: syncTempo !== prevTempoRef.current,
        condition3: syncTempo !== widgetState.tempo,
      });
    }

    if (
      syncTempo &&
      syncTempo !== prevTempoRef.current &&
      syncTempo !== widgetState.tempo
    ) {
      widgetStateRef.current.setTempo(syncTempo);
      prevTempoRef.current = syncTempo;
    }
  }, [syncTempo, widgetState.tempo]); // Removed widgetState - using ref

  // Listen for volume changes in sync state
  useEffect(() => {
    const currentVolume = widgetState.state.volume.master / 100;

    // Only log every 10th time to reduce noise
    if (youTubeWidgetPageContentRenderCount % 10 === 0) {
      logger.info('🔥 useEffect [syncMasterVolume] triggered:', {
        syncMasterVolume,
        prevVolume: prevVolumeRef.current,
        currentVolume,
        widgetVolumeObject: widgetState.state.volume.master,
        condition1: !!syncMasterVolume,
        condition2: syncMasterVolume !== prevVolumeRef.current,
        condition3: syncMasterVolume !== currentVolume,
      });
    }

    if (
      syncMasterVolume &&
      syncMasterVolume !== prevVolumeRef.current &&
      syncMasterVolume !== currentVolume
    ) {
      // Debug log (disabled to reduce console noise)
      // logger.info(
      //   '🎛️ Global Controls: Master volume changed in sync state:',
      //   syncMasterVolume,
      // );
      widgetStateRef.current.setVolume(
        'master',
        Math.round(syncMasterVolume * 100),
      );
      prevVolumeRef.current = syncMasterVolume;
    }
  }, [syncMasterVolume, widgetState.state.volume.master]); // Only depend on the actual value, not the whole object

  // Initialize beat timing analyzer when playback starts
  React.useEffect(() => {
    // Use syncState.playback.isPlaying which comes from the actual transport
    const isTransportPlaying = syncState.playback.isPlaying;
    const currentTempo = widgetState.tempo || syncState.playback.tempo || 120;

    if (isTransportPlaying && currentTempo > 0) {
      // Reset analyzer to clear old data
      beatTimingAnalyzer.reset();
      // Start fresh with current tempo
      beatTimingAnalyzer.start(currentTempo);
      logger.debug(`BeatTimingAnalyzer started with tempo ${currentTempo}`);
    }
  }, [
    syncState.playback.isPlaying,
    widgetState.tempo,
    syncState.playback.tempo,
  ]);

  React.useEffect(() => {
    // Debug: Log mount/unmount
    // logger.info('🟢 YouTubeWidgetPageContent MOUNTED');

    // Don't start analyzer on mount - wait for playback to start
    // This prevents drift calculations from page load time

    return () => {
      // logger.info('🔴 YouTubeWidgetPageContent UNMOUNTED');
      // Keep analyzer data for debugging even after unmount
    };
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header with Logo - Same as home/library pages */}
      <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
        <button
          onClick={() => navigateWithTransition('/')}
          className="cursor-pointer"
        >
          <Image
            src="/BASSICOLOGY BIG.png"
            alt="Bassicology"
            width={600}
            height={150}
            className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
            priority
          />
        </button>
      </header>

      {/* Navbar */}
      <HomeNavbar />

      {/* Mobile-first central container */}
      <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <div className="space-y-4">
          {/* User Indicator and Admin Controls */}
          <div className="flex justify-between items-center gap-3">
            {/* Back to Library button on the left */}
            <Button
              onClick={() => navigateWithTransition('/library')}
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white p-2"
              title="Back to Library"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* Admin controls and user indicator on the right */}
            <div className="flex items-center gap-3">
              {isAdmin &&
                (isPreviewingFromEdit ? (
                  // Only show "Back to Edit" when actually previewing from edit mode
                  <Button
                    onClick={() => {
                      navigateWithTransition(
                        `/admin/tutorials/${tutorialSlug}/edit`,
                      );
                      // Don't remove from sessionStorage here - let the edit page handle it
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                    size="sm"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back to Edit
                  </Button>
                ) : (
                  // Normal view mode - show Edit button only
                  <Button
                    onClick={() => {
                      // Clear any stale preview state when starting a new edit
                      sessionStorage.removeItem('previewingFromEdit');
                      navigateWithTransition(
                        `/admin/tutorials/${tutorialSlug}/edit`,
                      );
                    }}
                    className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                    size="sm"
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                ))}
              <UserIndicator />
            </div>
          </div>

          {/* 1. YouTube Video Section - Standalone at the top */}
          <YouTubeVideoSection tutorialData={tutorialData} />

          {/* 2. Tutorial Info Card - Separate card with tutorial details */}
          <TutorialInfoCard tutorialData={tutorialData} />

          {/* 3. Exercise Selector - Now separated from Fretboard */}
          <ExerciseSelector
            exercises={exercises || []}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={handleExerciseSelect}
          />

          {/* 4. Transport Clock with Timeline Loop Strip */}
          <TransportClock
            selectedExercise={widgetState.selectedExercise}
            loopRegion={widgetState.loopRegion}
            onLoopRegionChange={(region) => widgetState.setLoopRegion(region)}
            currentTime={widgetState.currentTime || 0}
            onSeek={(position) => {
              // Handle seek through playback controls
              if (transport && transport.seekTo) {
                transport.seekTo(position);
                logger.info(`🎵 Seeking to position: ${position}s`);
              }
            }}
          />

          {/* 5. Interactive Fretboard Card - Now without Exercise Selector */}
          <FretboardCard
            is3DMode={is3DMode}
            onToggle3DMode={handleToggle3DMode}
            selectedDots3D={selectedDots}
            setSelectedDots3D={handleSetSelectedDots3D}
            stringCount3D={stringCount}
            setStringCount3D={handleSetStringCount3D}
            cameraMode={cameraMode}
            setCameraMode={handleSetCameraMode}
            maxFrets={maxFrets}
            tiltAngle={tiltAngle}
            onTiltAngleChange={handleTiltAngleChange}
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={handleExerciseSelect}
          />

          {/* 6. Global Playback Controls Card - Dedicated panel for global controls */}
          <GlobalControlsCard
            selectedExercise={widgetState.selectedExercise}
            exercises={exercises}
            is3DMode={is3DMode}
            tiltAngle={tiltAngle}
            hasSelectedDots={selectedDots.size > 0}
            cameraMode={cameraMode}
            onToggle3DMode={handleToggle3DMode}
            onTiltAngleChange={handleTiltAngleChange}
            onCameraModeChange={handleSetCameraMode}
            loopRegion={widgetState.loopRegion}
            isLoopEnabled={widgetState.isLoopEnabled}
            onPlayStateChange={handlePlayStateChange}
          />

          {/* 7. Four Widgets Card - 4 essential widgets */}
          <FourWidgetsCard
            widgetState={widgetState}
            tutorialId={tutorialData?.id}
          />

          {/* 8. Teaching Takeaway Card - Lesson summaries */}
          <TeachingTakeawayCard tutorialData={tutorialData} />

          {/* Debug: Timing analysis toggle */}
          <div className="text-center mt-4">
            <button
              onClick={() => setShowTimingDebug(!showTimingDebug)}
              className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors border border-slate-600"
            >
              {showTimingDebug ? '🔴 Hide' : '🟢 Show'} Timing Debug
            </button>
          </div>
        </div>
      </div>

      {/* Timing Debug Window */}
      <TimingDebugWindow
        isVisible={showTimingDebug}
        onClose={() => setShowTimingDebug(false)}
      />
    </div>
  );
}

// Outer component that provides sync context
// Add render counter for outer component
let youTubeWidgetPageRenderCount = 0;

export function YouTubeWidgetPage({
  tutorialData,
  tutorialSlug,
  exercises,
}: YouTubeWidgetPageProps) {
  const { correlationId, logger } = useCorrelation('YouTubeWidgetPage');
  youTubeWidgetPageRenderCount++;

  if (youTubeWidgetPageRenderCount % 10 === 0) {
    logger.info(
      `🔄 YouTubeWidgetPage (OUTER) RENDER #${youTubeWidgetPageRenderCount}`,
      {
        timestamp: Date.now(),
      },
    );
  }

  // Track why the outer component is re-rendering
  useWhyDidYouUpdate('YouTubeWidgetPage', {
    tutorialData,
    tutorialSlug,
    exercises,
  });

  // Log if parent is causing re-renders
  React.useEffect(() => {
    if (youTubeWidgetPageRenderCount % 10 === 0) {
      logger.info(
        `🔍 YouTubeWidgetPage (OUTER) investigating re-render #${youTubeWidgetPageRenderCount}`,
        {
          tutorialDataId: tutorialData?.id,
          exercisesLength: exercises?.length,
          timestamp: new Date().toISOString(),
          parentCaller: new Error().stack?.split('\n').slice(2, 5).join(' <- '),
        },
      );
    }
  });

  // UIZoneProvider is now at root layout level - no need to wrap here
  return (
    <NextUIZoneProvider>
      <TransportProvider>
        <SyncProvider
          debugMode={false} // Disable debug mode to reduce console noise
          monitoringInterval={30000} // 30 seconds - much less frequent to prevent re-render loops
          enableGlobalMonitoring={false} // CRITICAL FIX: Disable monitoring to prevent 1s re-render loop
        >
          <YouTubeWidgetPageContent
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
          />
        </SyncProvider>
      </TransportProvider>
    </NextUIZoneProvider>
  );
}
