'use client';

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { verboseLog } from '@/config/debug';
import Image from 'next/image';
import { FretboardCard, FRETBOARD_VIEW_PRESETS } from './FretboardCard';

import { FourWidgetsCard } from './components/FourWidgetsCard';
import { BassRegistrationHost } from './BassRegistrationHost';
import { HarmonyRegistrationHost } from './HarmonyRegistrationHost';
import { ExerciseSelectorCard } from './components/ExerciseSelectorCard';
import { ExerciseDescriptionCard } from './components/ExerciseDescriptionCard';
import { DynamicIsland } from './components/DynamicIsland';
import { SheetPlayerCard } from './components/SheetPlayerCard';
import type { CountdownState } from './GlobalControls/types.js';
import { TransportClock } from './components/TransportClock';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import {
  TransportProvider,
  useTransportControls,
} from '@/domains/playback/contexts/TransportContext';
import { Button } from '@/shared/components/ui/button';
import { Edit2, ArrowLeft, Sparkles } from 'lucide-react';
import { SyncProvider, useSyncContext } from '../base/SyncProvider';
import { widgetSyncService } from '../../services/WidgetSyncService';
import { UserIndicator } from '@/domains/user/components/UserIndicator';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { navigateToMarketing } from '@/lib/marketing-url';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';
import { getLogger } from '@/utils/logger.js';
// Debug utilities removed for production performance - use import when debugging:
// import { useObjectChangeTracker, useWhyDidYouUpdate } from '@/utils/debugUtils';
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
import { HomeNavbar } from '@/app/_components/HomeNavbar';
import { useActAwarePreload } from './hooks/useActAwarePreload';
import { SampleLoadingOverlay } from './components/SampleLoadingOverlay';
import { IOSSafariBanner } from './components/IOSSafariBanner';
import { GlobalControls } from './components/GlobalControls';
import { CountdownIndicator } from './GlobalControls/components/CountdownIndicator.js';
import { calculateDuration, getExerciseId } from './utils';
import { ensureAudioContextLightweight } from '@/domains/playback/utils/ensureAudioContext.js';
// Block system imports
import type { AnyBlock } from '@bassnotion/contracts';
import { BlockRenderer } from './blocks';
import { useCurrentBlock } from './hooks/useCurrentBlock';
import { deriveBlocksFromLegacy } from './utils/deriveBlocksFromLegacy';
// New progress system (PR 5 of 6 — replaces useBlockProgress, useActCompletion,
// usePracticeCompletions, useTutorialProgressActions).
import {
  useProgress,
  useCompleteBlock,
  useRecordPractice,
  toLegacyBlockProgress,
  toLegacyPracticeCompletions,
} from '@/domains/progress';

const logger = getLogger('youtube-widget');

interface YouTubeWidgetPageProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[]; // Exercise data from tutorial API
  initialExerciseId?: string; // Optional: pre-select a specific exercise (e.g., from favorites)
  /** Hide logo, navbar, back button, and user indicator (used inside /app layout) */
  hideChrome?: boolean;
}

// Inner component that has access to sync context
function YouTubeWidgetPageContent({
  tutorialData,
  tutorialSlug,
  exercises,
  initialExerciseId,
  hideChrome = false,
}: YouTubeWidgetPageProps) {
  // XState Phase 2: Page initialization state machine — called for
  // its side effects (state transitions + lifecycle telemetry). The
  // returned machine handle isn't read here.
  usePageInitialization({
    tutorial: tutorialData
      ? {
          id: tutorialData.id,
          title: tutorialData.title,
          slug: tutorialSlug || '',
        }
      : undefined,
    exercises: exercises?.map((e) => ({
      id: e.id,
      name: e.name || e.title || 'Untitled',
      tutorialId: tutorialData?.id || '',
    })),
    shadowMode: false, // Disable shadow mode logging in production
    autoDetectScroll: true,
  });

  const widgetState = useWidgetPageState();
  const { emitGlobalEvent, syncState } = useSyncContext();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  // useAuth() is called for the side effect of subscribing to auth
  // changes — the isAuthenticated value isn't consumed in this file.
  useAuth();
  const { navigateWithTransition } = useViewTransitionRouter();
  const isAdmin = profile?.role === 'admin';

  // Unified progress hook — single source of truth for block + exercise
  // completion state. The backend computes unlock state and auto-cascades
  // exercise-block completion when all exercises hit the threshold.
  const { data: progressData } = useProgress(tutorialSlug, {
    enabled: !!profile?.id,
  });
  const completeBlockMutation = useCompleteBlock(tutorialSlug ?? '');
  const recordPracticeMutation = useRecordPractice(tutorialSlug ?? '');

  // Legacy-shape adapters so child components and existing prop interfaces
  // continue to work unchanged. Will be flattened in a future cleanup.
  const blockProgress = useMemo(
    () => toLegacyBlockProgress(progressData),
    [progressData],
  );
  const practiceCompletions = useMemo(
    () => toLegacyPracticeCompletions(progressData),
    [progressData],
  );

  // Imperative wrappers around the mutations to match the legacy call
  // signatures used throughout this component. Each kicks off a fire-and-
  // forget mutation; the server returns the new full state and TanStack
  // Query patches the cache in onSuccess.
  //
  // IMPORTANT: TanStack Query returns a NEW mutation result object on every
  // render. If we include the result object in a useCallback dep array, the
  // wrapper identity changes every render — which breaks downstream hooks
  // that depend on a stable callback (e.g. UnderstandVideoPlayer's
  // useEffect that calls onComplete). The mutate function itself is stable
  // per mutation instance, but accessing it via .mutate creates the same
  // problem. Solution: stash `mutate` in a ref that we update each render,
  // and have the wrappers read from the ref. This keeps the wrappers'
  // identity stable across renders.
  const completeBlockMutateRef = useRef(completeBlockMutation.mutate);
  completeBlockMutateRef.current = completeBlockMutation.mutate;
  const recordPracticeMutateRef = useRef(recordPracticeMutation.mutate);
  recordPracticeMutateRef.current = recordPracticeMutation.mutate;

  const markBlockComplete = useCallback(
    (blockId: string, data?: Record<string, unknown>) => {
      if (!tutorialSlug) return;
      completeBlockMutateRef.current({ blockId, data });
    },
    [tutorialSlug],
  );

  const incrementCompletion = useCallback(
    (exerciseId: string) => {
      if (!tutorialSlug) return;
      recordPracticeMutateRef.current({ exerciseId });
    },
    [tutorialSlug],
  );

  const updateTempo = useCallback(
    (exerciseId: string, tempoBpm: number) => {
      if (!tutorialSlug) return;
      recordPracticeMutateRef.current({ exerciseId, tempoBpm });
    },
    [tutorialSlug],
  );

  // markUnderstood: the legacy 3-stage flag has no equivalent in the new
  // block-based model. Block completion takes its place. Keep a no-op so
  // call sites compile until the call site itself is removed in a
  // follow-up cleanup. The "understand" block's own onComplete →
  // markBlockComplete handles the actual signal now.
  const markUnderstood = useCallback(() => {
    // intentionally empty — superseded by block-based completion
  }, []);

  // The progress query indicates hydration via TanStack Query's isPending.
  // Some legacy flows checked `isProgressHydrated` for "data ready" gating.
  const isProgressHydrated = progressData !== undefined;

  // FAANG Solution: Clear state management for preview mode
  // Only check sessionStorage, don't rely on referrer (unreliable)
  const [isPreviewingFromEdit, setIsPreviewingFromEdit] = React.useState(false);

  useEffect(() => {
    // Check if this specific tutorial is being previewed from edit mode
    const previewingSlug = sessionStorage.getItem('previewingFromEdit');
    setIsPreviewingFromEdit(previewingSlug === tutorialSlug);
  }, [tutorialSlug]);

  // Track previous tutorial ID to detect tutorial changes
  const prevTutorialIdRef = useRef<string | undefined>(undefined);

  // Track if initial act has been set (for progress-based navigation)
  const hasInitializedActRef = useRef(false);
  const hasSetCurrentActRef = useRef(false); // Separate guard for setCurrentAct call

  // CRITICAL: Cleanup state when switching between tutorials
  // This prevents stale state from previous tutorial affecting the new one
  useEffect(() => {
    const currentTutorialId = tutorialData?.id;

    // Skip on initial mount (prevTutorialIdRef is undefined)
    if (
      prevTutorialIdRef.current !== undefined &&
      prevTutorialIdRef.current !== currentTutorialId
    ) {
      logger.info('Tutorial changed, resetting state', {
        from: prevTutorialIdRef.current,
        to: currentTutorialId,
      });

      // 1. Reset widget page state (isPlaying, tempo, selectedExercise, etc.)
      widgetState.resetState();

      // 2. Reset WindowRegistry state for act preloading
      WindowRegistry.resetAct2PreloadState();
      WindowRegistry.clearBassBuffersReady();
      // ✅ FIX: Don't reset samplesReady - global samples (drums, metronome) stay loaded
      // Only exercise-specific bass buffers need reloading (handled by clearBassBuffersReady)
      // WindowRegistry.setSamplesReady(false); // ← REMOVED: Causes timeout on tutorial switch

      // 3. Reset MusicalTruthAuthority user tempo flag
      // This allows the new tutorial's exercise BPM to take precedence
      musicalTruth.resetUserModifiedTempo();

      // 4. Reset widget sync service state (clears exercise, playback state)
      // This triggers SYNC_STATE_RESET event so all widgets reset
      widgetSyncService.resetState();

      // 5. Clear cached harmony instruments to force reload with new exercise data
      GlobalSampleCache.clearInstrument('harmony-preloaded');

      // 6. FAANG FIX: Use centralized PlaybackEngine.switchExercise()
      // This clears ALL instrument buffers, track regions, and scheduled events
      // in a single coordinated call, preventing the "corrupted bass" bug where
      // old regions (MIDI notes) remain while new buffers are loaded.
      const coreServices = WindowRegistry.getCoreServices();
      if (coreServices) {
        const playbackEngine = coreServices.getPlaybackEngine?.();
        if (playbackEngine?.switchExercise) {
          // Use empty string to indicate "clearing for new tutorial" rather than specific exercise
          playbackEngine.switchExercise(currentTutorialId || '');
          logger.info(
            'Tutorial switch: PlaybackEngine.switchExercise() called',
          );
        }

        // 7. Reset WamKeyboardPlugin state (release all notes, reset instrument selection)
        // This ensures harmony doesn't carry over notes/state from previous tutorial
        const pluginManager = coreServices.getPluginManager?.();
        if (
          pluginManager &&
          typeof pluginManager.resetPluginState === 'function'
        ) {
          pluginManager.resetPluginState('wam-keyboard');
        }
      }

      // 8. Reset local UI state
      setSelectedDots(new Map());
      setCountdownState({
        isCountingDown: false,
        currentBeat: 0,
        totalBeats: 4,
      });
      setHasPassedUnderstand(false);
      setShowLoadingOverlay(false);

      // 9. Reset initial act flags so new tutorial can determine its starting act
      hasInitializedActRef.current = false;
      hasSetCurrentActRef.current = false;

      logger.info('Tutorial change cleanup complete');
    }

    prevTutorialIdRef.current = currentTutorialId;

    // CRITICAL: Cleanup on unmount (when navigating away from tutorial)
    // This runs when the component tree is destroyed on route change.
    // Next.js App Router fully remounts components on navigation, so we must
    // clean up tracks/buffers here to prevent old audio bleeding into new tutorial.
    return () => {
      logger.info(
        '[UNMOUNT-CLEANUP] YouTubeWidgetPage unmounting, clearing all tracks',
      );

      const coreServices = WindowRegistry.getCoreServices();
      const playbackEngine = coreServices?.getPlaybackEngine?.();

      if (playbackEngine) {
        // FAANG FIX: Use centralized switchExercise() for complete cleanup
        // This replaces the previous distributed cleanup (clearDrumTracks, clearHarmonyTracks, etc.)
        if (playbackEngine.switchExercise) {
          playbackEngine.switchExercise('unmount-cleanup');
          logger.info(
            '[UNMOUNT-CLEANUP] PlaybackEngine.switchExercise() called',
          );
        } else {
          // Fallback for backward compatibility
          playbackEngine.stop?.();
          logger.info('[UNMOUNT-CLEANUP] Stopped playback (fallback)');
        }
      }

      // Reset WamKeyboardPlugin state (sustain pedal, notes, instrument)
      if (coreServices) {
        const pluginManager = coreServices.getPluginManager?.();
        if (pluginManager?.resetPluginState) {
          pluginManager.resetPluginState('wam-keyboard');
          logger.info('[UNMOUNT-CLEANUP] Reset WamKeyboardPlugin state');
        }
      }

      // Clear GlobalSampleCache harmony instrument
      GlobalSampleCache.clearInstrument('harmony-preloaded');

      logger.info('[UNMOUNT-CLEANUP] Tutorial page cleanup complete');
    };
  }, [tutorialData?.id, widgetState.resetState]);

  // PERFORMANCE FIX: Use useTransportControls to avoid re-renders on position updates (60Hz)
  // YouTubeWidgetPageContent only needs controls (start, stop, pause, seekTo, isPlaying),
  // not the rapidly-changing position. Position-dependent UI is in child components.
  const transport = useTransportControls();
  const [selectedDots, setSelectedDots] = React.useState<Map<string, number[]>>(
    new Map(),
  );
  const [stringCount, setStringCountInternal] = React.useState<4 | 5 | 6>(4);
  const [maxFrets, setMaxFrets] = React.useState(25);

  // Countdown state for external rendering (between fretboard and controls)
  const [countdownState, setCountdownState] = React.useState<CountdownState>({
    isCountingDown: false,
    currentBeat: 0,
    totalBeats: 4,
  });

  // Memoized handler for countdown state changes
  const handleCountdownStateChange = React.useCallback(
    (state: CountdownState) => {
      setCountdownState(state);
    },
    [],
  );

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

  // DEBUG: XYZ rotation / visibility controls. State setters are
  // intentionally not wired into the UI (was a developer-tools panel
  // that's been removed). The values stay because they're read by
  // the fretboard rendering path; underscore-prefix the setters to
  // make the "tracked but no public toggle" status explicit.
  const [debugRotation, _setDebugRotation] = React.useState({
    x: 51, // Calibrated tilt angle (was 39°)
    y: 0,
    z: 0,
  });
  const [hide2DFretboard, _setHide2DFretboard] = React.useState(true);
  const [hide3DFretboard, _setHide3DFretboard] = React.useState(false);

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
    contentScale: 1.3, // Scales the 3D content area uniformly (calibrated)
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
    activeDotColor: '#3b82f6', // blue-500
    // Orange ring color (active note indicator)
    activeRingColor: '#f97316', // orange-500
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
    const preset =
      FRETBOARD_VIEW_PRESETS[presetName as keyof typeof FRETBOARD_VIEW_PRESETS];

    verboseLog('[YOUTUBE-WIDGET] Preset change detected:', {
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
        contentScale: 1.3,
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
  }, [
    widgetState.selectedExercise?.id,
    widgetState.selectedExercise?.fretboardViewConfig?.preset,
    stringCount,
  ]);

  // FAANG Solution: Lift selected exercise state to parent
  // Initialize with initialExerciseId if provided (e.g., from favorites navigation)
  const [selectedExerciseId, setSelectedExerciseId] = React.useState<
    string | null
  >(initialExerciseId || null);

  // Use refs to track previous values and prevent infinite loops
  const prevSelectedExerciseRef = useRef<any>(null);
  const prevTempoRef = useRef<number>(120);
  const prevVolumeRef = useRef<number>(80);

  // FIX: Store exercises in a ref to prevent callback recreation on data changes
  const exercisesRef = useRef(exercises);
  exercisesRef.current = exercises;

  // PERF FIX: Memoize exercises array to prevent re-renders when reference changes but content is same
  // Only recompute when exercise IDs actually change (not on every parent render)
  // CRITICAL: Use JSON.stringify for stable comparison - .map().join() recreates string every render
  const exerciseKey = React.useMemo(
    () =>
      exercises
        ?.map((e) => (typeof e.id === 'object' ? e.id.value : e.id))
        .join(',') ?? '',
    [exercises],
  );

  const memoizedExercises = React.useMemo(() => {
    return exercises;
  }, [exerciseKey]);

  // Track if we've already handled the initial exercise selection
  const initialExerciseHandledRef = useRef(false);

  // FAANG Solution: Auto-select exercise when exercises load (parent controls selection)
  // Priority: initialExerciseId (from favorites) > first exercise
  // FIX: Removed 150ms setTimeout - FretboardCard handles selectedExerciseId changes reactively
  useEffect(() => {
    verboseLog('🔍 [YOUTUBE-WIDGET] Auto-selection effect triggered:', {
      hasExercises: !!exercises,
      exerciseCount: exercises?.length || 0,
      selectedExerciseId,
      initialExerciseId,
      initialExerciseHandled: initialExerciseHandledRef.current,
    });

    if (!exercises || exercises.length === 0) return;

    // Helper to get exercise ID as string
    const getExerciseIdStr = (ex: any) =>
      typeof ex.id === 'object' ? ex.id.value : ex.id;

    // If we have an initialExerciseId and haven't handled it yet, select that exercise
    if (initialExerciseId && !initialExerciseHandledRef.current) {
      const targetExercise = exercises.find(
        (ex) => getExerciseIdStr(ex) === initialExerciseId,
      );

      if (targetExercise) {
        verboseLog(
          '🎯 [YOUTUBE-WIDGET] Selecting initial exercise from favorites:',
          {
            exerciseId: initialExerciseId,
            exerciseTitle: targetExercise.title,
          },
        );

        initialExerciseHandledRef.current = true;

        if (handleExerciseSelectRef.current) {
          handleExerciseSelectRef.current(initialExerciseId);
        } else {
          setSelectedExerciseId(initialExerciseId);
          widgetStateRef.current.setSelectedExercise(targetExercise);
        }
        return;
      }
    }

    // Fall back to first exercise if no selection yet
    if (!selectedExerciseId) {
      const firstExercise = exercises[0];
      if (firstExercise?.id) {
        verboseLog(
          '🎯 [YOUTUBE-WIDGET] Auto-selecting first exercise IMMEDIATELY:',
          {
            exerciseId: firstExercise.id,
            exerciseTitle: firstExercise.title,
            hasHarmonyNotes: !!firstExercise.harmonyNotes,
            harmonyInstrument: firstExercise.harmonyInstrument,
          },
        );

        const exerciseIdStr = getExerciseIdStr(firstExercise);

        if (handleExerciseSelectRef.current) {
          handleExerciseSelectRef.current(exerciseIdStr);
        } else {
          console.warn(
            '⚠️ [YOUTUBE-WIDGET] handleExerciseSelectRef not ready, using direct state update',
          );
          setSelectedExerciseId(firstExercise.id);
          widgetStateRef.current.setSelectedExercise(firstExercise);
        }
      }
    }
  }, [exercises, selectedExerciseId, initialExerciseId]);

  // Store widgetState methods in refs to avoid dependencies
  const widgetStateRef = useRef(widgetState);
  widgetStateRef.current = widgetState;

  // Track the currently-selected exerciseId in a ref so handleExerciseSelect
  // can detect actual switches without depending on the state value (which
  // would force the callback identity to change every render and re-trigger
  // all consumers).
  const selectedExerciseIdRef = useRef<string | null>(selectedExerciseId);
  selectedExerciseIdRef.current = selectedExerciseId;

  // Ref for handleExerciseSelect to avoid stale closure in auto-selection effect
  const handleExerciseSelectRef = useRef<(exerciseId: string) => void>(
    // eslint-disable-next-line @typescript-eslint/no-empty-function
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

  const handleSetSelectedDots3D = useCallback(
    (dots: Set<string> | Map<string, number[]>) => {
      // BUGFIX: Type mismatch - dots can be Set but selectedDots is Map
      // Convert Set to Map if needed (pre-existing bug exposed by progress-based navigation)
      if (dots instanceof Set) {
        // For now, ignore Set updates to prevent infinite loop
        // TODO: Proper Set → Map conversion if 3D fretboard feature is re-enabled
        return;
      }
      setSelectedDots(dots);
    },
    [setSelectedDots],
  ); // ✅ Fixed: Added setSelectedDots dependency (Zustand setter is stable)

  const handleExerciseSelect = useCallback(
    async (exerciseId: string) => {
      // Find the exercise from the exercises array using ref
      // Handle both string IDs and ExerciseId objects (value objects have .value property)
      const exercise = exercisesRef.current?.find((ex) => {
        const exIdStr =
          typeof ex.id === 'object' && ex.id !== null
            ? (ex.id as { value: string }).value
            : ex.id;
        return exIdStr === exerciseId;
      });

      verboseLog('🔍🔍🔍 [EXERCISE-SELECT-DEBUG] Raw exercise data:', {
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
          hasDrumPattern: !!(
            exercise.drumPattern && exercise.drumPattern.length > 0
          ),
          drumPatternHits: exercise.drumPattern?.length || 0,
          harmonyInstrument: exercise.harmonyInstrument,
        });

        // CRITICAL: Call PlaybackEngine.switchExercise() BEFORE updating state.
        //
        // Previously this only ran on tutorial UNMOUNT, so switching between
        // exercises WITHIN a tutorial (Ex.1 → Ex.2 → Ex.3) left the old
        // exercise's MIDI regions registered with their schedulers — the next
        // play() would re-schedule the OLD exercise's audio (bass, drums,
        // harmony from Ex.1) while the UI showed Ex.2 selected.
        //
        // switchExercise() clears bass/harmony/voice-cue schedulers, stops
        // drums/metronome (preserving their reusable buffers), empties all
        // track regions, clears scheduled Tone.Transport events, and emits
        // 'exercise:switched' so each widget hook resets its registration
        // state and re-registers fresh regions for the new exercise.
        //
        // Skip when selecting the same exercise (no-op) and on first selection
        // (when there's no prior exercise to clean up).
        // Read from ref so we don't need selectedExerciseId in the dep array.
        const prevExerciseId = selectedExerciseIdRef.current;
        const isActualSwitch =
          prevExerciseId !== null && prevExerciseId !== exerciseId;
        if (isActualSwitch) {
          const coreServices = WindowRegistry.getCoreServices();
          const playbackEngine = coreServices?.getPlaybackEngine?.();
          if (playbackEngine?.switchExercise) {
            playbackEngine.switchExercise(exerciseId);
          }
        }

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
          verboseLog('🔍 [EXERCISE-SELECT] Checking if samples need loading:', {
            exerciseId: exercise.id,
            instrument: exercise.harmonyInstrument,
            harmonyNotesCount: exercise.harmonyNotes.length,
            scrollHasTriggered,
          });

          // If scroll hasn't happened yet, skip loading - ScrollTriggerLoader handles it
          if (!scrollHasTriggered) {
            verboseLog(
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
            verboseLog(
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
                verboseLog('✅ [EXERCISE-SELECT] Samples loaded:', {
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
                verboseLog(
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
            verboseLog(
              '✅ [EXERCISE-SELECT] Samples already cached for:',
              exercise.harmonyInstrument,
            );
            logger.info('Samples already cached, skipping load:', {
              instrument: exercise.harmonyInstrument,
            });

            // CRITICAL FIX: Still emit the event so HarmonyWidget switches to correct instrument
            // Even when cached, we need to trigger re-registration with the new instrument's buffers
            verboseLog(
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

  // NOTE: handleDotClick and handleResetSelection used to live here for
  // the inline fretboard. The fretboard now owns its own selection
  // state through FretboardCard / useDotSelectionHandlers, so these
  // page-level handlers are no longer wired up.

  // Handle play state changes from GlobalControls
  const handlePlayStateChange = useCallback((isPlaying: boolean) => {
    verboseLog('🎵 [YOUTUBE-WIDGET] handlePlayStateChange called:', {
      isPlaying,
    });

    // Update widget state to match transport state
    if (isPlaying) {
      // Only toggle if currently not playing
      if (!widgetStateRef.current.state.isPlaying) {
        widgetStateRef.current.togglePlayback();
        verboseLog(
          '🎵 [YOUTUBE-WIDGET] Called widgetState.togglePlayback() to set isPlaying=true',
        );
      }
    } else {
      // Only toggle if currently playing
      if (widgetStateRef.current.state.isPlaying) {
        widgetStateRef.current.togglePlayback();
        verboseLog(
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

  // ===== Block-Based Layout: Refs & Hooks =====
  const snapContainerRef = useRef<HTMLDivElement>(null);
  const blockRefsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  const [hasPassedUnderstand, setHasPassedUnderstand] = useState(false);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(false);

  // Derive blocks from tutorial data, falling back to legacy act fields
  const blocks: AnyBlock[] = React.useMemo(() => {
    if (tutorialData?.blocks && tutorialData.blocks.length > 0) {
      return tutorialData.blocks;
    }
    if (tutorialData && memoizedExercises) {
      return deriveBlocksFromLegacy(tutorialData, memoizedExercises);
    }
    return [];
  }, [tutorialData, memoizedExercises]);

  // A drill is a tutorial of drill bricks (task / drill-tagged groove-card). It
  // has no video "Understand" gate, so the snap-scroll container must be
  // scrollable from the start — otherwise finishing the first brick can't scroll
  // to the next (the container is `overflow-hidden` until hasPassedUnderstand).
  const isDrill = React.useMemo(
    () =>
      blocks.some(
        (b) =>
          b.type === 'task' ||
          (b.type === 'groove-card' &&
            (!!(b.config as { role?: unknown }).role ||
              !!(b.config as { completionCriterion?: unknown })
                .completionCriterion)),
      ),
    [blocks],
  );
  React.useEffect(() => {
    if (isDrill) setHasPassedUnderstand(true);
  }, [isDrill]);

  const {
    currentBlockId,
    currentBlockIndex,
    scrollToBlock,
    setCurrentBlockId,
  } = useCurrentBlock({
    containerRef: snapContainerRef,
    blockRefs: blockRefsRef,
    blocks,
  });

  // blockProgress, markBlockComplete, isProgressHydrated are now defined
  // earlier in this component via the new useProgress hook. The old
  // useBlockProgress call has been removed.

  // Block-based initial navigation: always land on the FIRST block on mount.
  //
  // Previously we used getInitialBlock(blocks, blockProgress) to resume at
  // the first incomplete block. Returning users landed mid-tutorial without
  // context, which made every entry feel inconsistent. The new contract:
  // every tutorial entry starts at blocks[0] regardless of progress. The
  // user can still freely move to any block they've previously unlocked.
  //
  // Waits for isProgressHydrated so we know whether the user has any prior
  // progress in this tutorial (drives the scroll-gate decision).
  useEffect(() => {
    if (
      !hasInitializedActRef.current &&
      isProgressHydrated &&
      tutorialData?.id &&
      blocks.length > 0
    ) {
      const initialBlockId = blocks[0]?.id;

      // If the user has previously completed ANY block in this tutorial,
      // they've unlocked the snap-scroll container. Don't re-gate them at
      // Understand — let them freely move between sections they've already
      // opened. New users (no progress) stay gated until they finish the
      // first block, same as before.
      const hasAnyProgress = blocks.some((b) => blockProgress[b.id]?.completed);

      logger.info('[INITIAL-BLOCK] Landing on first block', {
        tutorialId: tutorialData.id,
        initialBlockId,
        blockCount: blocks.length,
        hasAnyProgress,
      });

      if (hasAnyProgress) {
        setHasPassedUnderstand(true);
      }

      // Snapshot the bricks ALREADY completed at mount (the baseline). The
      // auto-advance below must only fire for a brick completed AFRESH this
      // session — otherwise, on a REPLAY of an already-done rep (every brick
      // pre-completed), it cascades brick→brick and snaps the player to the last
      // one, so they can't re-experience the rep from the top. Captured once,
      // here, before any in-session completion lands.
      autoAdvanceBaselineRef.current = new Set(
        blocks.filter((b) => blockProgress[b.id]?.completed).map((b) => b.id),
      );

      if (initialBlockId && !hasSetCurrentActRef.current) {
        setCurrentBlockId(initialBlockId);
        hasSetCurrentActRef.current = true;
      }

      // Instant scroll on initial mount (no animation). Lands at top.
      if (initialBlockId) {
        requestAnimationFrame(() => {
          scrollToBlock(initialBlockId, { instant: true });
        });
      }

      hasInitializedActRef.current = true;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialData?.id, blocks.length, scrollToBlock, isProgressHydrated]);

  // Derive a legacy act name from the current block type (for preloading hook compatibility)
  const currentBlock = blocks.find((b) => b.id === currentBlockId);
  const currentActCompat =
    currentBlock?.type === 'video'
      ? ('understand' as const)
      : currentBlock?.type === 'groove'
        ? ('apply' as const)
        : ('practice' as const);

  // Act-aware preloading: starts loading samples immediately
  const { samplesReady, progress, forceLoad } = useActAwarePreload({
    exercises: memoizedExercises || [],
    tutorialId: tutorialData?.id,
    currentAct: currentActCompat,
  });

  // Auto-dismiss overlay and scroll to next block when samples are ready
  useEffect(() => {
    if (samplesReady && showLoadingOverlay) {
      // Small delay to show 100% before transitioning
      const timer = setTimeout(() => {
        setShowLoadingOverlay(false);
        setHasPassedUnderstand(true);
        requestAnimationFrame(() => {
          // Scroll to the next block after the current one (typically exercise block after video)
          const nextIndex = currentBlockIndex + 1;
          if (nextIndex < blocks.length) {
            scrollToBlock(blocks[nextIndex].id);
          }
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [
    samplesReady,
    showLoadingOverlay,
    scrollToBlock,
    currentBlockIndex,
    blocks,
  ]);

  // Scroll to next block (used by video block "I Got It" button and block completion)
  const scrollToNextBlock = useCallback(() => {
    const nextIndex = currentBlockIndex + 1;
    if (nextIndex < blocks.length) {
      scrollToBlock(blocks[nextIndex].id);
    }
  }, [currentBlockIndex, blocks, scrollToBlock]);

  // Drill bricks (task / drill-tagged groove-card) advance on completion. The
  // brick calls onComplete (which optimistically marks it done + unlocks the
  // next block) but does NOT scroll itself — scrolling synchronously races the
  // unlock re-render (the next section is `h-0`/unscrollable until unlocked) and
  // silently misses, stranding the student. Instead this effect watches for the
  // current brick becoming completed and scrolls THEN — after the unlock has
  // rendered — so a single click reliably advances. The ref guards against
  // re-firing for the same block.
  const lastAutoAdvancedRef = useRef<string | null>(null);
  // Bricks already completed when the player mounted (a prior day's reps on a
  // REPLAY). Auto-advance must skip these — see the capture in the init effect.
  const autoAdvanceBaselineRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const current = blocks[currentBlockIndex];
    if (!current) return;
    const isBrick =
      current.type === 'task' ||
      (current.type === 'groove-card' &&
        (!!(current.config as { role?: unknown }).role ||
          !!(current.config as { completionCriterion?: unknown })
            .completionCriterion));
    if (!isBrick) return;
    if (!blockProgress[current.id]?.completed) return;
    // Pre-completed at mount (replay) → don't cascade past it; let the player
    // move at their own pace from the top.
    if (autoAdvanceBaselineRef.current.has(current.id)) return;
    if (lastAutoAdvancedRef.current === current.id) return;
    const nextBlock = blocks[currentBlockIndex + 1];
    if (!nextBlock) return; // last brick → the drill frame shows the summary
    lastAutoAdvancedRef.current = current.id;
    // Unlock the snap container if this was the first completion.
    setHasPassedUnderstand(true);
    requestAnimationFrame(() => scrollToBlock(nextBlock.id));
  }, [blocks, currentBlockIndex, blockProgress, scrollToBlock]);

  // Gated block navigation: only scroll if the target block is unlocked.
  // A block is unlocked if it's the first block, OR all previous blocks are completed.
  const handleGatedBlockSelect = useCallback(
    (blockId: string) => {
      const targetIndex = blocks.findIndex((b) => b.id === blockId);
      if (targetIndex < 0) return;

      // First block is always accessible
      if (targetIndex === 0) {
        scrollToBlock(blockId);
        return;
      }

      // Check that every block before the target is completed
      const allPreviousCompleted = blocks
        .slice(0, targetIndex)
        .every((b) => blockProgress[b.id]?.completed);

      if (allPreviousCompleted) {
        scrollToBlock(blockId);
      }
    },
    [blocks, blockProgress, scrollToBlock],
  );

  // handleGotIt is currently unused — wired up via a different
  // handler chain after the "I Got It" button moved into a
  // subcomponent. Kept for the eventual rewire; prefix with _ to
  // silence no-unused-vars until then.
  const _handleGotIt = useCallback(async () => {
    // CRITICAL: Resume AudioContext on this user gesture!
    logger.info(
      '[HANDLE-GOT-IT] User clicked "I Got It" - resuming AudioContext',
    );
    try {
      await ensureAudioContextLightweight();
      logger.info('[HANDLE-GOT-IT] AudioContext resumed successfully');
    } catch (error) {
      logger.error('[HANDLE-GOT-IT] Failed to resume AudioContext:', error);
    }

    // Mark current block as complete in progress tracking
    if (currentBlockId) {
      markBlockComplete(currentBlockId);
    }
    markUnderstood();
    logger.info('[HANDLE-GOT-IT] Marked video block as complete');

    if (samplesReady) {
      logger.info('[HANDLE-GOT-IT] Samples ready, scrolling to next block');
      setHasPassedUnderstand(true);
      requestAnimationFrame(() => {
        scrollToNextBlock();
      });
    } else {
      logger.info('[HANDLE-GOT-IT] Samples not ready, showing overlay');
      setShowLoadingOverlay(true);
      forceLoad();
    }
  }, [
    samplesReady,
    scrollToNextBlock,
    forceLoad,
    markUnderstood,
    currentBlockId,
    markBlockComplete,
  ]);

  // Practice block completion state — derived from the server response.
  // The backend cascade-completes the exercise block when all exercises hit
  // the rep threshold (4), so we no longer need a client-side derivation
  // loop or an auto-markBlockComplete effect. The server already did it.
  const exerciseBlock = useMemo(
    () => blocks.find((b) => b.type === 'exercise'),
    [blocks],
  );
  const practiceComplete = !!(
    exerciseBlock && blockProgress[exerciseBlock.id]?.completed
  );

  // Practice progress counters — used by the Groove block UI to show
  // "completed X of Y exercises" before unlock.
  const practiceCounters = useMemo(() => {
    const exercises = memoizedExercises || [];
    const LOCKED = new Set(['advanced', 'hard', 'expert']);
    const REQUIRED = 4;
    const unlocked = exercises.filter((ex: any) => {
      const difficulty =
        typeof ex?.difficulty === 'string' ? ex.difficulty.toLowerCase() : '';
      return !LOCKED.has(difficulty);
    });
    const totalUnlocked = unlocked.length;
    const completedCount = unlocked.filter((ex: any) => {
      const exId =
        typeof ex.id === 'object' && ex.id !== null && 'value' in ex.id
          ? ex.id.value
          : ex.id;
      return (practiceCompletions[exId]?.count ?? 0) >= REQUIRED;
    }).length;
    return { totalUnlocked, completedCount };
  }, [memoizedExercises, practiceCompletions]);

  // Reward exercise lookup — the first "locked-difficulty" exercise, used
  // as the auto-select when the user enters the groove block. Pure
  // derivation from the exercises list; no progress data involved.
  const rewardExercise = useMemo(() => {
    const exercises = memoizedExercises || [];
    const LOCKED = new Set(['advanced', 'hard', 'expert']);
    return (
      exercises.find((ex: any) => {
        const difficulty =
          typeof ex?.difficulty === 'string' ? ex.difficulty.toLowerCase() : '';
        return LOCKED.has(difficulty);
      }) ?? null
    );
  }, [memoizedExercises]);

  // Auto-select groove exercise when entering a groove block after the
  // practice section is complete.
  useEffect(() => {
    if (currentBlock?.type === 'groove' && practiceComplete && rewardExercise) {
      const rewardId =
        typeof rewardExercise.id === 'object'
          ? rewardExercise.id.value
          : rewardExercise.id;
      if (rewardId && rewardId !== selectedExerciseId) {
        handleExerciseSelect(rewardId);
      }
    }
  }, [
    currentBlock?.type,
    practiceComplete,
    rewardExercise,
    selectedExerciseId,
    handleExerciseSelect,
  ]);

  // Inline playback controls — duration and practice-tracking handler for Act 2
  const exerciseDuration = React.useMemo(
    () => calculateDuration(widgetState.selectedExercise),
    [widgetState.selectedExercise],
  );

  const selectedExIdForTracking = React.useMemo(() => {
    if (!widgetState.selectedExercise) return null;
    return getExerciseId(widgetState.selectedExercise);
  }, [widgetState.selectedExercise]);

  const handlePlayStateChangeWithTracking = useCallback(
    (isPlaying: boolean) => {
      if (isPlaying && selectedExIdForTracking) {
        incrementCompletion(selectedExIdForTracking);
        // Record the tempo the user is practicing at
        const currentBpm = musicalTruth.getBPM();
        if (currentBpm > 0) {
          updateTempo(selectedExIdForTracking, Math.round(currentBpm));
        }
      }
      handlePlayStateChange(isPlaying);
    },
    [
      selectedExIdForTracking,
      handlePlayStateChange,
      incrementCompletion,
      updateTempo,
    ],
  );

  // Shared BottomPlaybackBar props — used by GrooveBlockView
  const bottomBarProps = React.useMemo(
    () => ({
      selectedExercise: widgetState.selectedExercise,
      exercises: memoizedExercises,
      onExerciseSelect: handleExerciseSelect,
      hasSelectedDots: selectedDots.size > 0,
      loopRegion: widgetState.loopRegion,
      isLoopEnabled: widgetState.isLoopEnabled,
      onToggleLoop: widgetState.toggleLoopEnabled,
      onPlayStateChange: handlePlayStateChange,
      countdownState,
      onCountdownStateChange: handleCountdownStateChange,
      practiceCompletions,
      onPracticeCompletion: incrementCompletion,
    }),
    [
      widgetState.selectedExercise,
      memoizedExercises,
      handleExerciseSelect,
      selectedDots.size,
      widgetState.loopRegion,
      widgetState.isLoopEnabled,
      widgetState.toggleLoopEnabled,
      handlePlayStateChange,
      countdownState,
      handleCountdownStateChange,
      practiceCompletions,
      incrementCompletion,
    ],
  );

  // Shared fretboard props — used by both exercise and groove blocks
  const fretboardElement = React.useMemo(
    () => (
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
    ),
    [
      selectedDots,
      handleSetSelectedDots3D,
      stringCount,
      handleSetStringCount3D,
      maxFrets,
      tutorialData,
      tutorialSlug,
      memoizedExercises,
      selectedExerciseId,
      handleExerciseSelect,
      debugRotation,
      overlay3DConfig,
      hide2DFretboard,
      hide3DFretboard,
    ],
  );

  return (
    <div className="h-dvh flex flex-col">
      {/* iOS Safari warning — non-blocking, dismissible per session */}
      <IOSSafariBanner />
      {/* Hidden: keeps bass buffers registered against the current exercise
          even when the groove block isn't mounted (e.g. understand/practice
          acts). Renders nothing. See BassRegistrationHost.tsx. */}
      <BassRegistrationHost
        exercise={widgetState.selectedExercise}
        volume={widgetState.state.volume.bass}
        isMuted={widgetState.state.muted.bass}
      />
      {/* Hidden: keeps harmony registered with PlaybackEngine against the
          current exercise even when the groove block isn't mounted (e.g.
          understand/practice acts). Scheduler-only — does NOT mount the WAM
          keyboard plugin. Renders nothing. See HarmonyRegistrationHost.tsx. */}
      <HarmonyRegistrationHost
        exercise={widgetState.selectedExercise}
        volume={widgetState.state.volume.harmony}
        isMuted={widgetState.state.muted.harmony}
        harmonyInstrument={widgetState.harmonyInstrument}
      />
      {!hideChrome && (
        <>
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
        </>
      )}

      {/* Dynamic Island — block navigation dock */}
      <DynamicIsland
        blocks={blocks}
        currentBlockId={currentBlockId}
        onBlockSelect={handleGatedBlockSelect}
        blockProgress={blockProgress}
        exercises={memoizedExercises}
        practiceCompletions={practiceCompletions}
        selectedExercise={widgetState.selectedExercise}
      />

      {/* Loading Overlay — shown when user clicks "I Got It" before samples ready */}
      <SampleLoadingOverlay
        isVisible={showLoadingOverlay}
        progress={progress}
      />

      {/* Block-Based Scroll-Snap Container */}
      <div
        ref={snapContainerRef}
        className={`flex-1 ${hasPassedUnderstand ? 'overflow-y-auto snap-y snap-mandatory' : 'overflow-hidden'}`}
      >
        {/* Admin chrome bar — floats above first block */}
        {!hideChrome && (
          <div className="absolute top-0 left-0 right-0 z-30 px-4 pt-2">
            <div className="mx-auto max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px]">
              <div className="flex justify-between items-center gap-3">
                <Button
                  onClick={() =>
                    navigateToMarketing('/library', navigateWithTransition)
                  }
                  variant="ghost"
                  size="sm"
                  className="text-white/70 hover:text-white p-2"
                  title="Back to Library"
                >
                  <ArrowLeft className="w-4 h-4" />
                </Button>
                <div className="flex items-center gap-3">
                  {isAdmin &&
                    (isPreviewingFromEdit ? (
                      <Button
                        onClick={() => {
                          navigateWithTransition(
                            `/admin/tutorials/${tutorialSlug}/edit`,
                          );
                        }}
                        className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                        size="sm"
                      >
                        <ArrowLeft className="w-4 h-4 mr-1" />
                        Back to Edit
                      </Button>
                    ) : (
                      <Button
                        onClick={() => {
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
            </div>
          </div>
        )}

        {/* ===== Dynamic Block Loop ===== */}
        {blocks.map((block, blockIndex) => {
          const isBlockActive = currentBlockId === block.id;
          const isBlockCompleted = !!blockProgress[block.id]?.completed;
          // REPLAY: this brick was already completed when the player mounted (a
          // prior day's rep). The brick should render FRESH (timer running, no
          // "Done" state) so the player can re-experience it — its done-state
          // then follows the IN-SESSION conquer, not the stale persisted one.
          // (Unlock-gating still uses the real isBlockCompleted above.)
          const wasPreCompleted = autoAdvanceBaselineRef.current.has(block.id);
          const hasNextBlock = blockIndex < blocks.length - 1;
          // A block is unlocked iff every block before it is completed
          // (block 0 is always unlocked). Same rule DynamicIsland uses
          // for greying out future tabs in the sidebar — and same rule
          // the backend enforces when validating block-complete writes.
          const isBlockUnlocked = blocks
            .slice(0, blockIndex)
            .every((b) => !!blockProgress[b.id]?.completed);

          // Locked blocks render an empty zero-height section. The DOM
          // node stays present (so refs/IntersectionObserver stay stable)
          // but the section has no scroll surface and isn't a snap-stop —
          // the user physically cannot scroll into a locked section. When
          // the previous block completes and this block transitions to
          // unlocked, the section expands to h-full snap-start during the
          // smooth scrollToNextBlock animation, so the layout change is
          // masked by the scroll.
          if (!isBlockUnlocked) {
            return (
              <section
                key={block.id}
                ref={(el) => {
                  if (el) blockRefsRef.current.set(block.id, el);
                  else blockRefsRef.current.delete(block.id);
                }}
                className="h-0 overflow-hidden"
                aria-hidden="true"
              />
            );
          }

          return (
            <section
              key={block.id}
              ref={(el) => {
                if (el) blockRefsRef.current.set(block.id, el);
                else blockRefsRef.current.delete(block.id);
              }}
              className="snap-start h-full"
            >
              {/* ---- Video Block ---- */}
              {block.type === 'video' && (
                <BlockRenderer
                  block={block}
                  isActive={isBlockActive}
                  isCompleted={isBlockCompleted}
                  onComplete={markBlockComplete}
                  onNext={scrollToNextBlock}
                  tutorialData={tutorialData}
                />
              )}

              {/* ---- Exercise Block ---- */}
              {block.type === 'exercise' && (
                <BlockRenderer
                  block={block}
                  isActive={isBlockActive}
                  isCompleted={isBlockCompleted}
                  onComplete={markBlockComplete}
                  onNext={scrollToNextBlock}
                >
                  {!memoizedExercises || memoizedExercises.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center px-6">
                      <div className="text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-slate-700/50 border-2 border-slate-600/50 flex items-center justify-center mx-auto">
                          <Sparkles className="w-10 h-10 text-slate-400" />
                        </div>
                        <div className="space-y-2">
                          <h2 className="text-2xl font-bold text-white">
                            Practice Exercises Coming Soon
                          </h2>
                          <p className="text-slate-400 text-base max-w-sm mx-auto">
                            Interactive exercises are being prepared for this
                            tutorial. Check back soon!
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <ExerciseDescriptionCard
                        selectedExercise={widgetState.selectedExercise}
                      />

                      {/* Fretboard */}
                      {fretboardElement}

                      {/* Countdown dots — above the controls card */}
                      {widgetState.selectedExercise && (
                        <div className="flex justify-center pb-2">
                          <CountdownIndicator
                            totalBeats={countdownState.totalBeats}
                            currentBeat={countdownState.currentBeat}
                            isCountingDown={countdownState.isCountingDown}
                          />
                        </div>
                      )}

                      {/* Exercise selector with global controls */}
                      <ExerciseSelectorCard
                        selectedExercise={widgetState.selectedExercise}
                        exercises={memoizedExercises}
                        onExerciseSelect={handleExerciseSelect}
                        practiceCompletions={practiceCompletions}
                        showDescription={false}
                        onUnlock={() => {
                          // Mark the exercise block as completed
                          markBlockComplete(block.id);
                          // Find the groove block and scroll to it
                          const grooveBlock = blocks.find(
                            (b) => b.type === 'groove',
                          );
                          if (grooveBlock) {
                            scrollToBlock(grooveBlock.id);
                          } else {
                            scrollToNextBlock();
                          }
                        }}
                        headerContent={
                          <GlobalControls
                            selectedExercise={widgetState.selectedExercise}
                            duration={exerciseDuration}
                            exercises={memoizedExercises}
                            onExerciseSelect={handleExerciseSelect}
                            hasSelectedDots={selectedDots.size > 0}
                            loopRegion={widgetState.loopRegion}
                            isLoopEnabled={widgetState.isLoopEnabled}
                            onToggleLoop={widgetState.toggleLoopEnabled}
                            onPlayStateChange={
                              handlePlayStateChangeWithTracking
                            }
                            onCountdownStateChange={handleCountdownStateChange}
                          />
                        }
                      />
                    </>
                  )}
                </BlockRenderer>
              )}

              {/* ---- Groove Block ---- */}
              {block.type === 'groove' && (
                <BlockRenderer
                  block={block}
                  isActive={isBlockActive}
                  isCompleted={isBlockCompleted}
                  onComplete={markBlockComplete}
                  onNext={scrollToNextBlock}
                  hasNextBlock={hasNextBlock}
                  isUnlocked={practiceComplete}
                  completedCount={practiceCounters.completedCount}
                  totalUnlocked={practiceCounters.totalUnlocked}
                  tutorialData={tutorialData}
                  rewardExercise={rewardExercise}
                  fretboardContent={fretboardElement}
                  widgetsContent={
                    <FourWidgetsCard
                      widgetState={widgetState}
                      tutorialId={tutorialData?.id}
                    />
                  }
                  sheetContent={
                    <SheetPlayerCard
                      selectedExercise={widgetState.selectedExercise}
                    />
                  }
                  transportContent={
                    <TransportClock
                      selectedExercise={widgetState.selectedExercise}
                      loopRegion={widgetState.loopRegion}
                      onLoopRegionChange={(region) =>
                        widgetState.setLoopRegion(region)
                      }
                      currentTime={widgetState.currentTime || 0}
                      onSeek={(position) => {
                        if (transport && transport.seekTo) {
                          transport.seekTo(position);
                          logger.info(`Seeking to position: ${position}s`);
                        }
                      }}
                    />
                  }
                  bottomBarProps={bottomBarProps}
                />
              )}

              {/* ---- Text, Celebration & Explain Blocks ---- */}
              {(block.type === 'text' ||
                block.type === 'celebration' ||
                block.type === 'explain' ||
                block.type === 'task') && (
                <BlockRenderer
                  block={block}
                  isActive={isBlockActive}
                  // On a REPLAY a pre-completed drill brick renders fresh (so the
                  // done-state follows the in-session conquer, not the stale one).
                  // Plain content blocks (text/celebration/explain) keep their
                  // real completion; only drill bricks (task) get the fresh start.
                  isCompleted={
                    block.type === 'task'
                      ? isBlockCompleted && !wasPreCompleted
                      : isBlockCompleted
                  }
                  onComplete={markBlockComplete}
                  onNext={scrollToNextBlock}
                />
              )}

              {/* ---- Groove Card Block (LAUNCH-02.5c) ---- */}
              {block.type === 'groove-card' && (
                <div className="flex h-full w-full items-center justify-center px-4 py-8">
                  <div className="w-full max-w-3xl">
                    <BlockRenderer
                      block={block}
                      isActive={isBlockActive}
                      // Replay: a pre-completed groove brick renders fresh (timer
                      // runs); its done-state then follows the in-session conquer.
                      isCompleted={isBlockCompleted && !wasPreCompleted}
                      onComplete={markBlockComplete}
                      onNext={scrollToNextBlock}
                    />
                  </div>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Outer component that provides sync context
export function YouTubeWidgetPage({
  tutorialData,
  tutorialSlug,
  exercises,
  initialExerciseId,
  hideChrome,
}: YouTubeWidgetPageProps) {
  // useCorrelation is called for the side effect of generating a
  // correlation ID and binding it to logs from this scope; the
  // returned values aren't consumed here (the inner component runs
  // its own correlation).
  useCorrelation('YouTubeWidgetPage');

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
  if (
    exercises &&
    exercises.length > 0 &&
    exercises !== lastExercisesRef.current
  ) {
    lastExercisesRef.current = exercises;
    const firstExercise = exercises[0];

    if (firstExercise?.bpm && firstExercise.bpm > 0) {
      // Only pre-seed if:
      // 1. User hasn't manually modified tempo
      // 2. Current BPM differs from exercise BPM (avoid redundant updates)
      const currentBpm = musicalTruth.getBPM();
      const userModified = musicalTruth.hasUserModifiedTempo();

      if (!userModified && currentBpm !== firstExercise.bpm) {
        verboseLog(
          `🎵 [TEMPO-PRESEED v2] Pre-seeding musicalTruth BEFORE TransportProvider mount`,
          {
            exerciseBpm: firstExercise.bpm,
            exerciseTitle: firstExercise.title,
            previousBpm: currentBpm,
            reason: 'exercises prop changed',
          },
        );

        // Pre-seed musicalTruth with exercise BPM
        musicalTruth.setFromExercise({
          bpm: firstExercise.bpm,
          timeSignature: firstExercise.timeSignature || {
            numerator: 4,
            denominator: 4,
          },
          total_bars: firstExercise.total_bars,
          duration_beats: firstExercise.duration_beats,
        });

        hasPreseededRef.current = true;
      } else if (userModified) {
        verboseLog(`🎵 [TEMPO-PRESEED v2] Skipping - user has modified tempo`, {
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
          initialExerciseId={initialExerciseId}
          hideChrome={hideChrome}
        />
      </SyncProvider>
    </TransportProvider>
  );
}
