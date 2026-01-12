'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
// Import our new components
import { TutorialVideoCard } from './TutorialVideoCard';
// ExerciseSelector merged into GlobalControlsCard
import { FretboardCard, FRETBOARD_VIEW_PRESETS } from './FretboardCard';

import { FourWidgetsCard } from './components/FourWidgetsCard';
import { GlobalControlsCard } from './components/GlobalControlsCard';
import { SheetPlayerCard } from './components/SheetPlayerCard';
import { TeachingTakeawayCard } from './TeachingTakeawayCard';
import { TransportClock } from './components/TransportClock';
import { TimingDebugWindow } from './components/TimingDebugWindow';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useAudioFretboard } from '@/domains/widgets/hooks/useAudioFretboard';
import {
  TransportProvider,
  useTransportControls,
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
import { musicalTruth } from '@/domains/playback/modules/tempo/MusicalTruthAuthority.js';
// XState Phase 2: Shadow mode integration
import { usePageInitialization } from '@/domains/widgets/machines/index.js';
// UIZoneProvider and ThemeSwitcher are now applied at root layout level
// NextUI was removed - all components now use shadcn/ui
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

  // XState Phase 2: Shadow mode - page initialization state machine
  // This runs alongside the existing initialization logic for comparison
  const pageInit = usePageInitialization({
    tutorial: tutorialData ? {
      id: tutorialData.id,
      title: tutorialData.title,
      slug: tutorialSlug || '',
    } : undefined,
    exercises: exercises?.map(e => ({
      id: e.id,
      name: e.name || e.title || 'Untitled',
      tutorialId: tutorialData?.id || '',
    })),
    shadowMode: true, // Enable shadow mode logging
    autoDetectScroll: true,
  });

  // Log XState state for debugging (only on significant renders)
  if (youTubeWidgetPageContentRenderCount <= 5 || youTubeWidgetPageContentRenderCount % 20 === 0) {
    console.log('[XState Shadow] Page Init State:', {
      state: pageInit.state,
      progress: pageInit.loadingProgress,
      step: pageInit.loadingMessage,
      isReady: pageInit.isReady,
      isLoading: pageInit.isLoading,
      hasError: pageInit.hasError,
    });
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

  // PERFORMANCE FIX: Use useTransportControls to avoid re-renders on position updates (60Hz)
  // YouTubeWidgetPageContent only needs controls (start, stop, pause, seekTo, isPlaying),
  // not the rapidly-changing position. Position-dependent UI is in child components.
  const transport = useTransportControls();
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

  // DEBUG: XYZ rotation controls for 2D fretboard CSS transform
  // These rotate the 2D fretboard (and affect where 3D overlay appears)
  // CALIBRATED DEFAULT: 51° tilt provides optimal Guitar Hero-style view
  const [debugRotation, setDebugRotation] = React.useState({
    x: 51, // Calibrated tilt angle (was 39°)
    y: 0,
    z: 0,
  });

  // DEBUG: Hide 2D fretboard to see only the 3D overlay
  const [hide2DFretboard, setHide2DFretboard] = React.useState(true); // Default to hidden - use 3D overlay only

  // DEBUG: Hide 3D fretboard overlay
  const [hide3DFretboard, setHide3DFretboard] = React.useState(false);

  // DEBUG: 3D Overlay-specific controls for calibrating the Three.js scene
  // These control the 3D camera/scene independently from the 2D CSS transform
  // CALIBRATED DEFAULTS: These values align 3D overlay with 2D fretboard after string order fix
  const [overlay3DConfig, setOverlay3DConfig] = React.useState({
    rotationX: 0, // 3D scene rotation around X axis
    rotationY: 0, // 3D scene rotation around Y axis
    rotationZ: 0, // 3D scene rotation around Z axis
    offsetX: 25, // Horizontal offset in pixels (calibrated)
    offsetY: 3, // Vertical offset in pixels (calibrated)
    // Scene position controls (in pixels, matching CSS coordinate system)
    sceneX: 3, // Scene translation X (calibrated)
    sceneY: 0, // Scene translation Y - keep at 0 so rotation center matches CSS transform-origin: center center
    sceneZ: 174, // Scene translation Z (depth) (re-calibrated after string order fix - was 193)
    // Camera controls
    cameraDistance: 740, // Camera Z distance (calibrated)
    fovOffset: 0, // Fine-tune FOV (added to calculated value)
    // Transform origin (pivot point for rotations)
    originX: 284, // Center of 568px canvas
    originY: 136, // Calibrated Y origin
    // Content scale for fine-tuning 3D/2D size match
    contentScale: 1.30, // Scales the 3D content area uniformly (calibrated)
    // Independent X scale for fixing horizontal stretch (perspective distortion)
    contentScaleX: 0.959, // Scales only X axis (calibrated)
    // Independent Y scale for fixing vertical stretch (perspective distortion)
    contentScaleY: 0.949, // Scales only Y axis (calibrated)
    // Camera Y offset to adjust perspective vanishing point (affects top/bottom ratio)
    cameraY: 0, // Shifts camera up/down to match CSS perspective-origin
    // Perspective multiplier - scales how much the perspective effect applies when tilted
    // 1.0 = normal, <1.0 = less perspective (top/bottom more equal), >1.0 = more perspective
    perspectiveMultiplier: 0.98, // Calibrated
    // Top edge width scale - scales X width of dots near the top of fretboard
    // 1.0 = no change, <1.0 = narrower top edge, >1.0 = wider top edge
    topEdgeScale: 1.0,
    // Bottom edge width scale - scales X width of dots near the bottom of fretboard
    // 1.0 = no change, <1.0 = narrower bottom edge, >1.0 = wider bottom edge
    bottomEdgeScale: 1.0,
    // Positioning mode for how 3D dots are placed relative to tilt
    // 'flat' = original (dots at Z=0, scene rotation handles tilt)
    // 'tilted-plane' = dots placed ON tilted plane in 3D space
    // 'screen-space' = dots positioned to match CSS screen positions
    positioningMode: 'flat' as 'flat' | 'tilted-plane' | 'screen-space',
    // Tilt axis offset - slides content along the tilted plane axis
    // Positive = slide toward top (away from camera), Negative = slide toward bottom (toward camera)
    tiltAxisOffset: -23, // Calibrated for 3D dot alignment
    // Tilt axis X offset - slides content left/right on the tilted plane
    tiltAxisOffsetX: 448, // Calibrated
    // Edge fade zones (percentage of viewport width)
    leftFadeZone: 10, // Left edge fade (0-20%) - calibrated
    rightFadeZone: 10, // Right edge fade (0-20%) - calibrated
    // Fade edge angle - controls perspective convergence of fade edges toward vanishing point
    // 0 = vertical edges, higher values = more angled toward center
    fadeEdgeAngle: 0, // Degrees (0-45), 0° = vertical edges (calibrated)
    // Yellow active ring controls
    activeRingZOffset: -1, // Z offset of yellow ring relative to dot (in pixels)
    activeRingRadius: 13, // Outer radius of the yellow ring
    activeRingTubeRadius: 1.25, // Thickness of the ring tube
    // Active dot color (currently playing note)
    activeDotColor: '#16a34a', // green-600
    // Yellow ring color (active note indicator)
    activeRingColor: '#facc15', // yellow-400
    // Bloom post-processing controls (enabled by default)
    bloomEnabled: true,
    bloomIntensity: 0.0,
    bloomThreshold: 1.0,
    // Finger label positioning
    fingerLabelOffsetX: 0,
    fingerLabelOffsetY: -2,
  });

  // Adjust sceneX based on string count (4-string needs different positioning)
  // 4-string fretboard: sceneX = 20 (default for 4-string layout)
  // 5-string fretboard: sceneX = 3 (calibrated for 5-string layout)
  useEffect(() => {
    const targetSceneX = stringCount === 4 ? 20 : 3;
    setOverlay3DConfig((prev) => {
      if (prev.sceneX !== targetSceneX) {
        return { ...prev, sceneX: targetSceneX };
      }
      return prev;
    });
  }, [stringCount]);

  // Update debug panel (overlay3DConfig) when exercise preset changes
  // This ensures the debug panel sliders reflect the actual values being applied
  useEffect(() => {
    const exercise = widgetState.selectedExercise;
    const presetName = exercise?.fretboardViewConfig?.preset || 'default';
    const preset = FRETBOARD_VIEW_PRESETS[presetName as keyof typeof FRETBOARD_VIEW_PRESETS];

    console.log('[YOUTUBE-WIDGET] Preset change detected:', {
      exerciseId: exercise?.id,
      presetName,
      hasOverlay3D: !!preset?.overlay3D,
    });

    if (preset?.overlay3D) {
      // Apply preset's 3D overlay values to debug panel
      const o = preset.overlay3D;
      setOverlay3DConfig((prev) => ({
        ...prev,
        sceneX: o.sceneX,
        sceneY: o.sceneY,
        sceneZ: o.sceneZ,
        contentScale: o.scale,
        contentScaleX: o.scaleX,
        contentScaleY: o.scaleY,
        rotationX: o.rotX,
        rotationY: o.rotY,
        rotationZ: o.rotZ,
        offsetX: o.canvasOffsetX,
        offsetY: o.canvasOffsetY,
        cameraDistance: o.camDist,
        fovOffset: o.fov,
        cameraY: o.camY,
        perspectiveMultiplier: o.persp,
        originX: o.originX,
        originY: o.originY,
        tiltAxisOffset: o.tiltYOffset,
        tiltAxisOffsetX: o.tiltXOffset,
      }));
    } else if (presetName === 'default') {
      // Reset to default values when switching back to default preset
      setOverlay3DConfig((prev) => ({
        ...prev,
        sceneX: stringCount === 4 ? 20 : 3,
        sceneY: 0,
        sceneZ: 174,
        contentScale: 1.30,
        contentScaleX: 0.959,
        contentScaleY: 0.949,
        rotationX: 0,
        rotationY: 0,
        rotationZ: 0,
        offsetX: 25,
        offsetY: 3,
        cameraDistance: 740,
        fovOffset: 0,
        cameraY: 0,
        perspectiveMultiplier: 0.98,
        originX: 284,
        originY: 136,
        tiltAxisOffset: -23,
        tiltAxisOffsetX: 448,
      }));
    }
  }, [widgetState.selectedExercise?.id, widgetState.selectedExercise?.fretboardViewConfig?.preset, stringCount]);

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

  // PERF FIX: Memoize exercises array to prevent re-renders when reference changes but content is same
  // Only recompute when exercise IDs actually change (not on every parent render)
  const memoizedExercises = React.useMemo(() => {
    return exercises;
  }, [
    // Use a stable key based on exercise IDs and count
    // This ensures the array reference only changes when exercises actually change
    exercises?.length,
    exercises?.map(e => typeof e.id === 'object' ? e.id.value : e.id).join(','),
  ]);

  // FAANG Solution: Auto-select first exercise when exercises load (parent controls selection)
  // FIX: Removed 150ms setTimeout - FretboardCard handles selectedExerciseId changes reactively
  // The delay was causing widgets to mount with undefined exercise, triggering warnings
  useEffect(() => {
    console.log('🔍 [YOUTUBE-WIDGET] Auto-selection effect triggered:', {
      hasExercises: !!exercises,
      exerciseCount: exercises?.length || 0,
      selectedExerciseId,
      shouldAutoSelect:
        exercises && exercises.length > 0 && !selectedExerciseId,
    });

    if (exercises && exercises.length > 0 && !selectedExerciseId) {
      const firstExercise = exercises[0];
      if (firstExercise?.id) {
        console.log(
          '🎯 [YOUTUBE-WIDGET] Auto-selecting first exercise IMMEDIATELY:',
          {
            exerciseId: firstExercise.id,
            exerciseTitle: firstExercise.title,
            hasHarmonyNotes: !!firstExercise.harmonyNotes,
            harmonyInstrument: firstExercise.harmonyInstrument,
          },
        );

        const exerciseIdStr =
          typeof firstExercise.id === 'object'
            ? firstExercise.id.value
            : firstExercise.id;

        // Select immediately - no delay needed
        // FretboardCard and other widgets handle exercise prop changes reactively
        if (handleExerciseSelectRef.current) {
          handleExerciseSelectRef.current(exerciseIdStr);
        } else {
          // Fallback to direct state update if ref not ready yet
          console.warn(
            '⚠️ [YOUTUBE-WIDGET] handleExerciseSelectRef not ready, using direct state update',
          );
          setSelectedExerciseId(firstExercise.id);
          widgetStateRef.current.setSelectedExercise(firstExercise);
        }
      }
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
  const handleSetStringCount3D = useCallback(
    (count: number) => {
      setStringCount(count as 4 | 5 | 6);
    },
    [setStringCount],
  );

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
          hasDrumPattern: !!(exercise.drumPattern && exercise.drumPattern.length > 0),
          drumPatternHits: exercise.drumPattern?.length || 0,
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

          {/* 1. Tutorial Video Card - Title, Creator, Video, Description, Core Concept */}
          <TutorialVideoCard tutorialData={tutorialData} />

          {/* 2. Exercise Selector - Now integrated into GlobalControlsCard */}

          {/* DEBUG: 3D Overlay-specific Calibration Controls */}
          {false && (
            <div className="mb-4 p-4 bg-purple-900/30 rounded-lg border border-purple-700">
              <div className="text-xs font-mono text-purple-400 mb-3">
                🎮 DEBUG: 3D Overlay Scene Controls (Three.js)
              </div>

              {/* Row 1: XYZ Rotation */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-400 font-mono">
                    3D Rot X: {overlay3DConfig.rotationX}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={overlay3DConfig.rotationX}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        rotationX: Number(e.target.value),
                      }))
                    }
                    className="accent-red-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-green-400 font-mono">
                    3D Rot Y: {overlay3DConfig.rotationY}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={overlay3DConfig.rotationY}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        rotationY: Number(e.target.value),
                      }))
                    }
                    className="accent-green-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-blue-400 font-mono">
                    3D Rot Z: {overlay3DConfig.rotationZ}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={overlay3DConfig.rotationZ}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        rotationZ: Number(e.target.value),
                      }))
                    }
                    className="accent-blue-500"
                  />
                </div>
              </div>

              {/* Row 2: Canvas Offset X/Y (CSS positioning) */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-cyan-400 font-mono">
                    Canvas Offset X: {overlay3DConfig.offsetX}px
                  </label>
                  <input
                    type="range"
                    min="-1000"
                    max="500"
                    value={overlay3DConfig.offsetX}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        offsetX: Number(e.target.value),
                      }))
                    }
                    className="accent-cyan-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-pink-400 font-mono">
                    Canvas Offset Y: {overlay3DConfig.offsetY}px
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    value={overlay3DConfig.offsetY}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        offsetY: Number(e.target.value),
                      }))
                    }
                    className="accent-pink-500"
                  />
                </div>
              </div>

              {/* Row 4: Scene Position X/Y/Z (Three.js world coordinates) */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-300 font-mono">
                    Scene X: {overlay3DConfig.sceneX}px
                  </label>
                  <input
                    type="range"
                    min="-300"
                    max="300"
                    value={overlay3DConfig.sceneX}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        sceneX: Number(e.target.value),
                      }))
                    }
                    className="accent-red-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-green-300 font-mono">
                    Scene Y: {overlay3DConfig.sceneY}px
                  </label>
                  <input
                    type="range"
                    min="-300"
                    max="300"
                    value={overlay3DConfig.sceneY}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        sceneY: Number(e.target.value),
                      }))
                    }
                    className="accent-green-300"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-blue-300 font-mono">
                    Scene Z: {overlay3DConfig.sceneZ}px
                  </label>
                  <input
                    type="range"
                    min="-500"
                    max="500"
                    value={overlay3DConfig.sceneZ}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        sceneZ: Number(e.target.value),
                      }))
                    }
                    className="accent-blue-300"
                  />
                </div>
              </div>

              {/* Row 5: Camera Distance, FOV, Camera Y & Perspective Multiplier */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-violet-400 font-mono">
                    Cam Dist: {overlay3DConfig.cameraDistance}px
                  </label>
                  <input
                    type="range"
                    min="400"
                    max="3200"
                    step="10"
                    value={overlay3DConfig.cameraDistance}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        cameraDistance: Number(e.target.value),
                      }))
                    }
                    className="accent-violet-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-amber-400 font-mono">
                    FOV: {overlay3DConfig.fovOffset}°
                  </label>
                  <input
                    type="range"
                    min="-30"
                    max="30"
                    value={overlay3DConfig.fovOffset}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        fovOffset: Number(e.target.value),
                      }))
                    }
                    className="accent-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-indigo-400 font-mono">
                    Cam Y: {overlay3DConfig.cameraY}px
                  </label>
                  <input
                    type="range"
                    min="-200"
                    max="200"
                    value={overlay3DConfig.cameraY}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        cameraY: Number(e.target.value),
                      }))
                    }
                    className="accent-indigo-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-pink-400 font-mono">
                    Persp: {overlay3DConfig.perspectiveMultiplier.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="1.5"
                    step="0.01"
                    value={overlay3DConfig.perspectiveMultiplier}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        perspectiveMultiplier: Number(e.target.value),
                      }))
                    }
                    className="accent-pink-500"
                  />
                </div>
              </div>

              {/* Row 6: Transform Origin */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-teal-400 font-mono">
                    Origin X: {overlay3DConfig.originX}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="568"
                    value={overlay3DConfig.originX}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        originX: Number(e.target.value),
                      }))
                    }
                    className="accent-teal-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-rose-400 font-mono">
                    Origin Y: {overlay3DConfig.originY}px
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="290"
                    value={overlay3DConfig.originY}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        originY: Number(e.target.value),
                      }))
                    }
                    className="accent-rose-500"
                  />
                </div>
              </div>

              {/* Row 7: Content Scale (uniform), Scale X (horizontal), Scale Y (vertical) */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-lime-400 font-mono">
                    Scale: {overlay3DConfig.contentScale.toFixed(2)}x
                  </label>
                  <input
                    type="range"
                    min="0.8"
                    max="1.3"
                    step="0.01"
                    value={overlay3DConfig.contentScale}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        contentScale: Number(e.target.value),
                      }))
                    }
                    className="accent-lime-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-emerald-400 font-mono">
                    Scale X: {overlay3DConfig.contentScaleX.toFixed(3)}x
                  </label>
                  <input
                    type="range"
                    min="0.9"
                    max="1.1"
                    step="0.001"
                    value={overlay3DConfig.contentScaleX}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        contentScaleX: Number(e.target.value),
                      }))
                    }
                    className="accent-emerald-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-teal-400 font-mono">
                    Scale Y: {overlay3DConfig.contentScaleY.toFixed(3)}x
                  </label>
                  <input
                    type="range"
                    min="0.9"
                    max="1.1"
                    step="0.001"
                    value={overlay3DConfig.contentScaleY}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        contentScaleY: Number(e.target.value),
                      }))
                    }
                    className="accent-teal-500"
                  />
                </div>
              </div>

              {/* Row 8: Tilt Axis Offsets (slides along tilted plane - Y and X) */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-amber-400 font-mono">
                    Tilt Y Offset: {overlay3DConfig.tiltAxisOffset}px
                  </label>
                  <input
                    type="range"
                    min="-150"
                    max="150"
                    step="1"
                    value={overlay3DConfig.tiltAxisOffset}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        tiltAxisOffset: Number(e.target.value),
                      }))
                    }
                    className="accent-amber-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-orange-400 font-mono">
                    Tilt X Offset: {overlay3DConfig.tiltAxisOffsetX}px
                  </label>
                  <input
                    type="range"
                    min="-500"
                    max="500"
                    step="1"
                    value={overlay3DConfig.tiltAxisOffsetX}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        tiltAxisOffsetX: Number(e.target.value),
                      }))
                    }
                    className="accent-orange-500"
                  />
                </div>
              </div>

              {/* Row 9: Positioning Mode Toggle */}
              <div className="flex flex-wrap gap-2 items-center">
                <span className="text-xs text-gray-400 font-mono">Position Mode:</span>
                {(['flat', 'tilted-plane', 'screen-space'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        positioningMode: mode,
                      }))
                    }
                    className={`px-2 py-1 text-xs rounded ${
                      overlay3DConfig.positioningMode === mode
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <button
                onClick={() => {
                  setOverlay3DConfig({
                    rotationX: 0,
                    rotationY: 0,
                    rotationZ: 0,
                    offsetX: 0,
                    offsetY: 0,
                    sceneX: 0,
                    sceneY: 0, // Keep at 0 so rotation center matches CSS
                    sceneZ: 0,
                    cameraDistance: 800,
                    fovOffset: 0,
                    originX: 284,
                    originY: 145,
                    contentScale: 1.0,
                    contentScaleX: 1.0,
                    contentScaleY: 1.0,
                    cameraY: 0,
                    perspectiveMultiplier: 1.0,
                    topEdgeScale: 1.0,
                    bottomEdgeScale: 1.0,
                    positioningMode: 'screen-space',
                    tiltAxisOffset: 0,
                    tiltAxisOffsetX: 0,
                    leftFadeZone: 10,
                    rightFadeZone: 10,
                    fadeEdgeAngle: 0,
                  });
                }}
                className="px-3 py-1 text-xs bg-purple-700 hover:bg-purple-600 rounded"
              >
                Reset 3D Overlay
              </button>

              {/* Hide 2D Fretboard checkbox */}
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hide2DFretboard}
                  onChange={(e) => setHide2DFretboard(e.target.checked)}
                  className="w-4 h-4 accent-red-500"
                />
                Hide 2D Fretboard
              </label>

              {/* Hide 3D Fretboard checkbox */}
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hide3DFretboard}
                  onChange={(e) => setHide3DFretboard(e.target.checked)}
                  className="w-4 h-4 accent-blue-500"
                />
                Hide 3D Overlay
              </label>

              {/* Yellow Active Ring Controls */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-purple-700">
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-yellow-400 font-mono">
                    Ring Z Offset: {overlay3DConfig.activeRingZOffset}px
                  </label>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="0.5"
                    value={overlay3DConfig.activeRingZOffset}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        activeRingZOffset: Number(e.target.value),
                      }))
                    }
                    className="accent-yellow-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-yellow-400 font-mono">
                    Ring Radius: {overlay3DConfig.activeRingRadius}px
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    step="0.5"
                    value={overlay3DConfig.activeRingRadius}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        activeRingRadius: Number(e.target.value),
                      }))
                    }
                    className="accent-yellow-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-yellow-400 font-mono">
                    Ring Tube: {overlay3DConfig.activeRingTubeRadius}px
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="5"
                    step="0.25"
                    value={overlay3DConfig.activeRingTubeRadius}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        activeRingTubeRadius: Number(e.target.value),
                      }))
                    }
                    className="accent-yellow-500"
                  />
                </div>
              </div>

              {/* Color Pickers */}
              <div className="mt-4 pt-4 border-t border-purple-700 grid grid-cols-2 gap-4">
                {/* Active Dot Color Picker */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-green-400 font-mono">
                    Active Dot:
                  </label>
                  <input
                    type="color"
                    value={overlay3DConfig.activeDotColor}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        activeDotColor: e.target.value,
                      }))
                    }
                    className="w-10 h-8 cursor-pointer rounded border border-green-500"
                  />
                  <span className="text-xs text-zinc-400 font-mono">
                    {overlay3DConfig.activeDotColor}
                  </span>
                </div>

                {/* Active Ring Color Picker */}
                <div className="flex items-center gap-3">
                  <label className="text-xs text-yellow-400 font-mono">
                    Ring Color:
                  </label>
                  <input
                    type="color"
                    value={overlay3DConfig.activeRingColor}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        activeRingColor: e.target.value,
                      }))
                    }
                    className="w-10 h-8 cursor-pointer rounded border border-yellow-500"
                  />
                  <span className="text-xs text-zinc-400 font-mono">
                    {overlay3DConfig.activeRingColor}
                  </span>
                </div>
              </div>

              {/* Finger Label Position Controls */}
              <div className="mt-4 pt-4 border-t border-purple-700">
                <div className="text-xs font-mono text-cyan-400 mb-2">
                  🔢 Finger Label Offset
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-cyan-400 font-mono">
                      X: {overlay3DConfig.fingerLabelOffsetX ?? 0}
                    </label>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="1"
                      value={overlay3DConfig.fingerLabelOffsetX ?? 0}
                      onChange={(e) =>
                        setOverlay3DConfig((prev) => ({
                          ...prev,
                          fingerLabelOffsetX: Number(e.target.value),
                        }))
                      }
                      className="accent-cyan-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-cyan-400 font-mono">
                      Y: {overlay3DConfig.fingerLabelOffsetY ?? 0}
                    </label>
                    <input
                      type="range"
                      min="-20"
                      max="20"
                      step="1"
                      value={overlay3DConfig.fingerLabelOffsetY ?? 0}
                      onChange={(e) =>
                        setOverlay3DConfig((prev) => ({
                          ...prev,
                          fingerLabelOffsetY: Number(e.target.value),
                        }))
                      }
                      className="accent-cyan-500"
                    />
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* DEBUG: 3D Overlay XYZ Rotation Controls */}
          {false && (
            <div className="mb-4 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
              <div className="text-xs font-mono text-zinc-400 mb-3">
                🔧 DEBUG: 3D Overlay XYZ Rotation Controls
              </div>
              <div className="grid grid-cols-3 gap-4">
                {/* X Rotation (tilt forward/backward) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-red-400 font-mono">
                    X (Tilt): {debugRotation.x}°
                  </label>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={debugRotation.x}
                    onChange={(e) => {
                      const newX = Number(e.target.value);
                      setDebugRotation((prev) => ({ ...prev, x: newX }));
                    }}
                    className="accent-red-500"
                  />
                </div>
                {/* Y Rotation (spin left/right) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-green-400 font-mono">
                    Y (Spin): {debugRotation.y}°
                  </label>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    value={debugRotation.y}
                    onChange={(e) =>
                      setDebugRotation((prev) => ({
                        ...prev,
                        y: Number(e.target.value),
                      }))
                    }
                    className="accent-green-500"
                  />
                </div>
                {/* Z Rotation (roll) */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-blue-400 font-mono">
                    Z (Roll): {debugRotation.z}°
                  </label>
                  <input
                    type="range"
                    min="-90"
                    max="90"
                    value={debugRotation.z}
                    onChange={(e) =>
                      setDebugRotation((prev) => ({
                        ...prev,
                        z: Number(e.target.value),
                      }))
                    }
                    className="accent-blue-500"
                  />
                </div>
              </div>

              {/* Edge Fade Controls */}
              <div className="mt-4 pt-3 border-t border-zinc-700">
                <div className="text-xs text-zinc-500 mb-2">Edge Fade Zones</div>
                <div className="grid grid-cols-2 gap-4">
                  {/* Left Fade Zone */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-amber-400 font-mono">
                      Left Fade: {overlay3DConfig.leftFadeZone}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={overlay3DConfig.leftFadeZone}
                      onChange={(e) =>
                        setOverlay3DConfig((prev) => ({
                          ...prev,
                          leftFadeZone: Number(e.target.value),
                        }))
                      }
                      className="accent-amber-500"
                    />
                  </div>
                  {/* Right Fade Zone */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-purple-400 font-mono">
                      Right Fade: {overlay3DConfig.rightFadeZone}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="20"
                      value={overlay3DConfig.rightFadeZone}
                      onChange={(e) =>
                        setOverlay3DConfig((prev) => ({
                          ...prev,
                          rightFadeZone: Number(e.target.value),
                        }))
                      }
                      className="accent-purple-500"
                    />
                  </div>
                </div>
                {/* Fade Edge Angle - Controls perspective convergence of fade edges */}
                <div className="flex flex-col gap-1 mt-3">
                  <label className="text-xs text-cyan-400 font-mono">
                    Edge Angle: {overlay3DConfig.fadeEdgeAngle}° (0=vertical, higher=more perspective)
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="45"
                    step="1"
                    value={overlay3DConfig.fadeEdgeAngle}
                    onChange={(e) =>
                      setOverlay3DConfig((prev) => ({
                        ...prev,
                        fadeEdgeAngle: Number(e.target.value),
                      }))
                    }
                    className="accent-cyan-500"
                  />
                </div>
              </div>

              {/* Bloom Post-Processing Controls */}
              <div className="mt-4 pt-4 border-t border-purple-700">
                <div className="text-xs font-mono text-yellow-400 mb-2">
                  ✨ Bloom Post-Processing
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-yellow-400 font-mono">
                      Intensity: {overlay3DConfig.bloomIntensity?.toFixed(2) ?? '0.00'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={overlay3DConfig.bloomIntensity ?? 0}
                      onChange={(e) =>
                        setOverlay3DConfig((prev) => ({
                          ...prev,
                          bloomIntensity: Number(e.target.value),
                        }))
                      }
                      className="accent-yellow-500"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-orange-400 font-mono">
                      Threshold: {overlay3DConfig.bloomThreshold?.toFixed(2) ?? '1.00'}
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={overlay3DConfig.bloomThreshold ?? 1}
                      onChange={(e) =>
                        setOverlay3DConfig((prev) => ({
                          ...prev,
                          bloomThreshold: Number(e.target.value),
                        }))
                      }
                      className="accent-orange-500"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setDebugRotation({ x: 0, y: 0, z: 0 });
                }}
                className="mt-2 px-3 py-1 text-xs bg-zinc-700 hover:bg-zinc-600 rounded"
              >
                Reset to Flat
              </button>
            </div>
          )}

          {/* 4. Interactive Fretboard Card - Now without Exercise Selector */}
          <FretboardCard
            selectedDots3D={selectedDots}
            setSelectedDots3D={handleSetSelectedDots3D}
            stringCount3D={stringCount}
            setStringCount3D={handleSetStringCount3D}
            maxFrets={maxFrets}
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={memoizedExercises}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={handleExerciseSelect}
            debugRotation={debugRotation}
            overlay3DConfig={overlay3DConfig}
            hide2DFretboard={hide2DFretboard}
            hide3DFretboard={hide3DFretboard}
          />

          {/* 5. Global Playback Controls Card - Dedicated panel for global controls */}
          <GlobalControlsCard
            selectedExercise={widgetState.selectedExercise}
            exercises={memoizedExercises}
            onExerciseSelect={handleExerciseSelect}
            hasSelectedDots={selectedDots.size > 0}
            loopRegion={widgetState.loopRegion}
            isLoopEnabled={widgetState.isLoopEnabled}
            onPlayStateChange={handlePlayStateChange}
          />

          {/* 6. Four Widgets Card - 4 essential widgets (metronome, drums, bass, harmony) */}
          <FourWidgetsCard
            widgetState={widgetState}
            tutorialId={tutorialData?.id}
          />

          {/* 7. Sheet Player Card - Standalone sheet music display */}
          <SheetPlayerCard selectedExercise={widgetState.selectedExercise} />

          {/* 8. Transport Clock with Timeline Loop Strip */}
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

          {/* 9. Teaching Takeaway Card - Lesson summaries */}
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

  // ============================================================================
  // TEMPO INITIALIZATION FIX v2: Pre-seed MusicalTruthAuthority BEFORE render
  // ============================================================================
  // Problem: On hard reload, TransportContext's useState(() => musicalTruth.getBPM())
  // runs BEFORE the parent's useMemo can pre-seed the tempo. React initializes child
  // component state during the same render phase, so useMemo in parent is too late.
  //
  // Solution v2: Pre-seed IMMEDIATELY when exercises prop changes, using a ref to
  // track if we've already pre-seeded for this set of exercises. This happens
  // at the TOP of the render function, before any JSX is returned.
  // ============================================================================
  const hasPreseededRef = React.useRef(false);
  const lastExercisesRef = React.useRef<typeof exercises>(null);

  // Pre-seed SYNCHRONOUSLY at render time, BEFORE returning JSX
  // This must happen before TransportProvider's useState initializer runs
  if (exercises && exercises.length > 0 && exercises !== lastExercisesRef.current) {
    lastExercisesRef.current = exercises;
    const firstExercise = exercises[0];

    if (firstExercise?.bpm && firstExercise.bpm > 0) {
      // Only pre-seed if:
      // 1. User hasn't manually modified tempo
      // 2. Current BPM differs from exercise BPM (avoid redundant updates)
      const currentBpm = musicalTruth.getBPM();
      const userModified = musicalTruth.hasUserModifiedTempo();

      if (!userModified && currentBpm !== firstExercise.bpm) {
        console.log(`🎵 [TEMPO-PRESEED v2] Pre-seeding musicalTruth BEFORE TransportProvider mount`, {
          exerciseBpm: firstExercise.bpm,
          exerciseTitle: firstExercise.title,
          previousBpm: currentBpm,
          reason: 'exercises prop changed',
        });

        // Pre-seed musicalTruth with exercise BPM
        musicalTruth.setFromExercise({
          bpm: firstExercise.bpm,
          timeSignature: firstExercise.timeSignature || { numerator: 4, denominator: 4 },
          total_bars: firstExercise.total_bars,
          duration_beats: firstExercise.duration_beats,
        });

        hasPreseededRef.current = true;
      } else if (userModified) {
        console.log(`🎵 [TEMPO-PRESEED v2] Skipping - user has modified tempo`, {
          currentBpm,
          exerciseBpm: firstExercise.bpm,
        });
      }
    }
  }

  // UIZoneProvider is now at root layout level - no need to wrap here
  return (
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
  );
}
