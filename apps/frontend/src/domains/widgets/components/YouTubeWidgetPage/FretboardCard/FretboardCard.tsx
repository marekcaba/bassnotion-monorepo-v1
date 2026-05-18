'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ZoneCard, ZoneCardContent } from '@/ui-libraries';
import { Target } from 'lucide-react';
import {
  createStructuredLogger,
  type FretboardViewConfig,
  type FretboardScrollMode,
} from '@bassnotion/contracts';
import { isVerboseDebugEnabled, verboseLog } from '@/config/debug';

const logger = createStructuredLogger('FretboardCard');

// =============================================================================
// GLOBAL CSS KEYFRAMES INJECTION
// =============================================================================
// Inject fadeIn keyframes at module load time to ensure they're available
// before any component tries to use them. This prevents race conditions
// where the animation might not be defined when the element mounts.
const FADE_IN_KEYFRAMES_ID = 'fretboard-fade-in-keyframes';

if (
  typeof document !== 'undefined' &&
  !document.getElementById(FADE_IN_KEYFRAMES_ID)
) {
  const style = document.createElement('style');
  style.id = FADE_IN_KEYFRAMES_ID;
  style.textContent = `
    @keyframes fretboardFadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// Fretboard view preset configurations
// Exported so YouTubeWidgetPage can update debug panel when preset changes
export const FRETBOARD_VIEW_PRESETS = {
  default: {
    scrollMode: 'follow' as FretboardScrollMode,
    zoomLevel: 1.15,
    initialFret: 0,
    visibleFretRange: null as { start: number; end: number } | null,
    // 3D overlay settings (default values)
    overlay3D: null as null | {
      sceneX: number;
      sceneY: number;
      sceneZ: number;
      scale: number;
      scaleX: number;
      scaleY: number;
      rotX: number;
      rotY: number;
      rotZ: number;
      canvasOffsetX: number;
      canvasOffsetY: number;
      camDist: number;
      fov: number;
      camY: number;
      persp: number;
      originX: number;
      originY: number;
      tiltYOffset: number;
      tiltXOffset: number;
    },
  },
  octave: {
    scrollMode: 'locked' as FretboardScrollMode,
    zoomLevel: 1.3, // Wider zoom for octave patterns
    initialFret: 0, // Start at fret 0 for octave view
    visibleFretRange: { start: 0, end: 13 },
    // 3D overlay settings from user's calibrated values
    overlay3D: {
      sceneX: 3,
      sceneY: 0,
      sceneZ: -151,
      scale: 1.3,
      scaleX: 0.959,
      scaleY: 0.949,
      rotX: 3,
      rotY: -33,
      rotZ: 0,
      canvasOffsetX: 25,
      canvasOffsetY: 3,
      camDist: 740,
      fov: -4,
      camY: 0,
      persp: 0.98,
      originX: 247,
      originY: 136,
      tiltYOffset: -39,
      tiltXOffset: 311,
    },
  },
};
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';
import type {
  FretboardCardContentProps,
  StringCount,
} from './types/fretboardTypes';
import { useFretboard } from './hooks/useFretboard';
import { useManualSelectionTracking } from './hooks/useManualSelectionTracking';
import { useExerciseLoader } from './hooks/useExerciseLoader';
import { useDotSynchronization } from './hooks/useDotSynchronization';
import { useDotSelectionHandlers } from './hooks/useDotSelectionHandlers';
import { useStringCountHandlers } from './hooks/useStringCountHandlers';
import { ExerciseProgressBar } from './components/ExerciseProgressBar';
import { FretboardControls } from './components/FretboardControls';
import { FretboardModeControls } from './components/FretboardModeControls';
import { FretboardGrid } from './components/FretboardGrid';
import { convertTo3DFormat } from './utils/formatConversion';
import {
  Ring3DOverlayCanvas,
  useRingOverlay,
  DEFAULT_RING_CONFIG,
} from './overlays';

import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useSnapshotTransition } from '@/shared/hooks/useSnapshotTransition';
import { logSkeletonDebug } from '@/utils/skeletonDebug';
import type { ExerciseNote } from '@bassnotion/contracts';

// =============================================================================
// FAANG ATOMIC TRANSITION TYPE
// =============================================================================
// Problem: Three independent useSnapshotTransition hooks (notes, tempo, overlay3D)
// can get out of sync during rapid exercise switching, causing stale data display.
//
// Solution: Combine all transition-sensitive data into a single atomic object.
// This ensures ALL data swaps together at the exact same moment during SWAP phase.
// =============================================================================
interface AtomicExerciseDisplayData {
  notes: ExerciseNote[];
  tempo: number;
  overlay3DConfig: FretboardCardProps['overlay3DConfig'] | null;
  // Include exercise ID for debugging
  exerciseId: string | undefined;
}

// Render counter for debugging
let fretboardCardRenderCount = 0;

/**
 * Interactive Fretboard Widget Component
 *
 * A comprehensive bass guitar fretboard visualization and interaction component that integrates
 * with the EPIC 3 widget synchronization system. Provides real-time audio feedback, exercise
 * integration, and seamless synchronization with other widgets.
 *
 * @component
 * @since Story 3.12
 *
 * @features
 * - 4/5 string bass guitar visualization
 * - Real-time audio playback with <50ms latency
 * - Exercise loading and progress tracking
 * - Widget synchronization (metronome, drummer, harmony)
 * - Drag & drop note reordering
 * - Keyboard accessibility (WCAG 2.1 compliant)
 * - 3D perspective controls with tilt adjustment
 *
 * @example
 * ```tsx
 * <FretboardCard />
 * ```
 *
 * @accessibility
 * - Full keyboard navigation (Tab, Enter, Space)
 * - Screen reader support with descriptive ARIA labels
 * - High contrast focus indicators
 * - Live region updates for playback status
 *
 * @performance
 * - Target: 60fps animations, <50ms audio latency
 * - Optimized re-rendering with React.memo and useCallback
 * - Efficient DOM updates for large exercise datasets
 *
 * @integration
 * - Subscribes to: PLAYBACK_STATE, TIMELINE_UPDATE, EXERCISE_CHANGE, TEMPO_CHANGE
 * - Emits: CUSTOM_BASSLINE events for widget synchronization
 * - Uses useAudioFretboard hook for consistent audio behavior
 */
interface FretboardCardProps {
  // Shared state props from parent
  selectedDots3D?: Map<string, number[]>;
  setSelectedDots3D?: (selectedDots: Map<string, number[]>) => void;
  stringCount3D?: 4 | 5 | 6;
  setStringCount3D?: (count: 4 | 5 | 6) => void;
  maxFrets?: number;
  onMaxFretsChange?: (frets: number) => void;
  // Exercise-related props
  tutorialData?: any;
  tutorialSlug?: string;
  exercises?: any[];
  selectedExerciseId?: string | null; // Add this prop from parent
  onExerciseSelect?: (exerciseId: string) => void;
  // DEBUG: XYZ rotation for 3D overlay calibration
  debugRotation?: { x: number; y: number; z: number };
  // DEBUG: 3D Overlay-specific calibration (Three.js scene controls)
  overlay3DConfig?: {
    rotationX: number;
    rotationY: number;
    rotationZ: number;
    scaleX: number;
    scaleY: number;
    offsetX: number;
    offsetY: number;
    sceneX: number;
    sceneY: number;
    sceneZ: number;
    cameraDistance: number;
    fovOffset: number;
    originX: number;
    originY: number;
    contentScale: number;
    positioningMode?: 'flat' | 'tilted-plane' | 'screen-space';
    tiltAxisOffset?: number; // Slides content along tilted plane Y axis
    tiltAxisOffsetX?: number; // Slides content along tilted plane X axis
    perspectiveMultiplier?: number; // CSS perspective multiplier for 3D/2D alignment
    // Bloom post-processing controls
    bloomEnabled?: boolean;
    bloomIntensity?: number;
    bloomThreshold?: number;
  };
  // DEBUG: Hide 2D fretboard to see only 3D overlay
  hide2DFretboard?: boolean;
  // DEBUG: Hide 3D overlay
  hide3DFretboard?: boolean;
}

export const FretboardCard = React.memo(
  function FretboardCard({
    selectedDots3D,
    setSelectedDots3D,
    stringCount3D,
    setStringCount3D,
    maxFrets = 25,
    onMaxFretsChange,
    tutorialData,
    tutorialSlug,
    exercises,
    selectedExerciseId,
    onExerciseSelect,
    debugRotation = { x: 51, y: 0, z: 0 }, // DEBUG: XYZ rotation for calibration (51° tilt default)
    overlay3DConfig = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 0.959,
      scaleY: 0.949,
      offsetX: 25,
      offsetY: 3,
      sceneX: 3,
      sceneY: 0,
      sceneZ: 193,
      cameraDistance: 740,
      fovOffset: 0,
      originX: 284,
      originY: 136,
      contentScale: 1.3,
      positioningMode: 'flat',
      tiltAxisOffset: -23,
      tiltAxisOffsetX: 448,
      perspectiveMultiplier: 0.98,
      leftFadeZone: 10,
      rightFadeZone: 10,
      fadeEdgeAngle: 0,
    }, // DEBUG: 3D overlay controls - calibrated defaults
    hide2DFretboard = true, // Hide 2D fretboard by default - use 3D overlay only
    hide3DFretboard = false, // DEBUG: Hide 3D overlay
  }: FretboardCardProps) {
    const { correlationId, logger } = useCorrelation('FretboardCard');
    // Find the selected exercise object from the exercises list
    // Note: ex.id is an ExerciseId value object, so we compare with its .value property
    const selectedExercise =
      exercises?.find((ex) => ex.id.value === selectedExerciseId) || null;

    return (
      <SyncedWidget
        widgetId="interactive-fretboard"
        widgetName="Interactive Fretboard"
        selectedExercise={selectedExercise} // Pass the exercise object to SyncedWidget
        syncOptions={{
          subscribeTo: [
            'PLAYBACK_STATE',
            'TIMELINE_UPDATE',
            'EXERCISE_CHANGE',
            'TEMPO_CHANGE',
          ],
        }}
      >
        {(syncProps: SyncedWidgetRenderProps) => (
          <FretboardCardContent
            syncProps={syncProps}
            selectedDots3D={selectedDots3D}
            setSelectedDots3D={setSelectedDots3D}
            stringCount3D={stringCount3D}
            setStringCount3D={setStringCount3D}
            maxFrets={maxFrets}
            onMaxFretsChange={onMaxFretsChange}
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={onExerciseSelect}
            debugRotation={debugRotation}
            overlay3DConfig={overlay3DConfig}
            hide2DFretboard={hide2DFretboard}
            hide3DFretboard={hide3DFretboard}
          />
        )}
      </SyncedWidget>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to identify what's causing re-renders
    const changes: string[] = [];

    if (prevProps.selectedDots3D !== nextProps.selectedDots3D)
      changes.push('selectedDots3D');
    if (prevProps.setSelectedDots3D !== nextProps.setSelectedDots3D)
      changes.push('setSelectedDots3D');
    if (prevProps.stringCount3D !== nextProps.stringCount3D)
      changes.push('stringCount3D');
    if (prevProps.setStringCount3D !== nextProps.setStringCount3D)
      changes.push('setStringCount3D');
    if (prevProps.maxFrets !== nextProps.maxFrets) changes.push('maxFrets');
    if (prevProps.tutorialData !== nextProps.tutorialData)
      changes.push('tutorialData');
    if (prevProps.tutorialSlug !== nextProps.tutorialSlug)
      changes.push('tutorialSlug');
    if (prevProps.exercises !== nextProps.exercises) changes.push('exercises');
    if (prevProps.selectedExerciseId !== nextProps.selectedExerciseId)
      changes.push('selectedExerciseId');
    if (prevProps.onExerciseSelect !== nextProps.onExerciseSelect)
      changes.push('onExerciseSelect');
    if (prevProps.debugRotation !== nextProps.debugRotation)
      changes.push('debugRotation');
    if (prevProps.overlay3DConfig !== nextProps.overlay3DConfig)
      changes.push('overlay3DConfig');
    if (prevProps.hide2DFretboard !== nextProps.hide2DFretboard)
      changes.push('hide2DFretboard');
    if (prevProps.hide3DFretboard !== nextProps.hide3DFretboard)
      changes.push('hide3DFretboard');

    const isEqual = changes.length === 0;

    if (!isEqual) {
      logger.info(
        `🎯 FretboardCard will re-render due to prop changes:`,
        changes,
        {
          count: ++fretboardCardRenderCount,
          timestamp: new Date().toISOString(),
        },
      );
    }

    return isEqual;
  },
);

let globalRenderCount = 0;

// CRITICAL FIX: Memoize FretboardCardContent to prevent re-renders from currentTime changes
const FretboardCardContent = React.memo(
  function FretboardCardContent({
    syncProps,
    selectedDots3D,
    setSelectedDots3D,
    stringCount3D,
    setStringCount3D,
    maxFrets = 25,
    onMaxFretsChange,
    tutorialData,
    tutorialSlug,
    exercises,
    selectedExerciseId,
    onExerciseSelect,
    debugRotation = { x: 51, y: 0, z: 0 }, // DEBUG: XYZ rotation for calibration (51° tilt default)
    overlay3DConfig = {
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 0.959,
      scaleY: 0.949,
      offsetX: 25,
      offsetY: 3,
      sceneX: 3,
      sceneY: 0,
      sceneZ: 193,
      cameraDistance: 740,
      fovOffset: 0,
      originX: 284,
      originY: 136,
      contentScale: 1.3,
      positioningMode: 'flat',
      tiltAxisOffset: -23,
      tiltAxisOffsetX: 448,
      perspectiveMultiplier: 0.98,
      leftFadeZone: 10,
      rightFadeZone: 10,
      fadeEdgeAngle: 0,
    }, // DEBUG: 3D overlay controls - calibrated defaults
    hide2DFretboard = true, // Hide 2D fretboard by default - use 3D overlay only
    hide3DFretboard = false, // DEBUG: Hide 3D overlay
  }: FretboardCardContentProps & {
    selectedDots3D?: Map<string, number[]>;
    setSelectedDots3D?: (selectedDots: Map<string, number[]>) => void;
    stringCount3D?: 4 | 5 | 6;
    setStringCount3D?: (count: 4 | 5 | 6) => void;
    maxFrets?: number;
    onMaxFretsChange?: (frets: number) => void;
    tutorialData?: any;
    tutorialSlug?: string;
    exercises?: any[];
    selectedExerciseId?: string | null;
    onExerciseSelect?: (exerciseId: string) => void;
    debugRotation?: { x: number; y: number; z: number }; // DEBUG: XYZ rotation for calibration
    overlay3DConfig?: {
      rotationX: number;
      rotationY: number;
      rotationZ: number;
      scaleX: number;
      scaleY: number;
      offsetX: number;
      offsetY: number;
      sceneX: number;
      sceneY: number;
      sceneZ: number;
      cameraDistance: number;
      fovOffset: number;
      originX: number;
      originY: number;
      contentScale: number;
      positioningMode?: 'flat' | 'tilted-plane' | 'screen-space';
      tiltAxisOffset?: number;
      tiltAxisOffsetX?: number;
      perspectiveMultiplier?: number;
      // Bloom controls
      bloomEnabled?: boolean;
      bloomIntensity?: number;
      bloomThreshold?: number;
    }; // DEBUG: 3D overlay controls
    hide2DFretboard?: boolean; // DEBUG: Hide 2D fretboard
    hide3DFretboard?: boolean; // DEBUG: Hide 3D overlay
  }) {
    // Enhanced debug logging to track render causes
    fretboardCardRenderCount++;

    // SKELETON-DEBUG: Log first 5 renders with timing (using shared baseline)
    logSkeletonDebug('🎸', 'FretboardCard', fretboardCardRenderCount, {
      hasExercises: !!exercises,
      exerciseCount: exercises?.length ?? 0,
      selectedExerciseId,
    });

    logger.info(
      `🎸 FretboardCardContent RENDER #${fretboardCardRenderCount}:`,
      {
        selectedExerciseId,
        exercisesCount: exercises?.length || 0,
        syncExerciseId: syncProps.selectedExercise?.id,
        isPlaying: syncProps.isPlaying,
        currentTime: syncProps.currentTime,
        timestamp: Date.now(),
        propsChanged: {
          stringCount3D,
          maxFrets,
        },
      },
    );

    globalRenderCount++;
    const renderStartTime = performance.now();

    // Track what changed between renders
    const prevPropsRef = useRef({
      syncActions: syncProps.sync?.actions,
      selectedExercise: syncProps.selectedExercise,
      isPlaying: syncProps.isPlaying,
      currentTime: syncProps.currentTime,
      tempo: syncProps.tempo,
      masterVolume: syncProps.masterVolume,
      exercisesLength: exercises?.length,
      selectedExerciseId,
    });

    const currentProps = {
      syncActions: syncProps.sync?.actions,
      selectedExercise: syncProps.selectedExercise,
      isPlaying: syncProps.isPlaying,
      currentTime: syncProps.currentTime,
      tempo: syncProps.tempo,
      masterVolume: syncProps.masterVolume,
      exercisesLength: exercises?.length,
      selectedExerciseId,
    };

    const changedProps: string[] = [];
    Object.keys(currentProps).forEach((key) => {
      const typedKey = key as keyof typeof currentProps;
      if (prevPropsRef.current[typedKey] !== currentProps[typedKey]) {
        changedProps.push(key);
      }
    });

    prevPropsRef.current = currentProps;

    logger.info(`🔴 FretboardCardContent render #${globalRenderCount}`, {
      timestamp: new Date().toISOString(),
      changedProps,
      exercisesCount: exercises?.length || 0,
      selectedExerciseIdProp: selectedExerciseId,
      selectedExerciseFromSync: syncProps.selectedExercise?.id,
      syncExists: !!syncProps.sync,
      syncActionsExists: !!syncProps.sync?.actions,
      isPlaying: syncProps.isPlaying,
      currentTime: syncProps.currentTime,
      renderStack: new Error().stack
        ?.split('\n')
        .slice(1, 5)
        .map((line) => line.trim()),
    });

    // Zoom state - default to 115%
    const [zoomLevel, setZoomLevel] = useState(1.15);

    // Scroll mode state - controls auto-scroll behavior during playback
    // 'follow' = camera follows current note, 'locked' = view stays fixed
    const [scrollMode, setScrollMode] = useState<FretboardScrollMode>('follow');

    // Effective overlay3D config - merges preset settings with per-exercise overrides
    // When octave preset is used, this will use the preset's 3D settings
    const [effectiveOverlay3DConfig, setEffectiveOverlay3DConfig] =
      useState(overlay3DConfig);

    // Sync effectiveOverlay3DConfig when overlay3DConfig prop changes (e.g., from debug controls)
    React.useEffect(() => {
      setEffectiveOverlay3DConfig(overlay3DConfig);
    }, [overlay3DConfig]);

    // Ring overlay state for Guitar Hero-style animated rings
    // This state controls whether the 3D ring overlay is shown in 2D mode
    // NOTE: Set to true for debugging/calibration of 3D canvas alignment
    const [showRingOverlay, setShowRingOverlay] = useState(true);
    const fretboardContainerRef = useRef<HTMLDivElement>(null);

    // =============================================================================
    // RESPONSIVE SCALING
    // =============================================================================
    // The fretboard renders at a fixed 568x290 base size internally.
    // We measure the available container width and apply CSS transform: scale()
    // so it fills up to 800px wide while preserving all internal pixel math.
    const FRETBOARD_BASE_WIDTH = 568;
    const FRETBOARD_BASE_HEIGHT = 290;
    const responsiveWrapperRef = useRef<HTMLDivElement>(null);
    const [responsiveScale, setResponsiveScale] = useState(1);

    useEffect(() => {
      const wrapper = responsiveWrapperRef.current;
      if (!wrapper) return;

      const updateScale = () => {
        const availableWidth = wrapper.clientWidth;
        const MAX_SCALED_WIDTH = 640;
        // Scale to fill available width, capped at 800px, never below 1
        const scale = Math.min(
          MAX_SCALED_WIDTH / FRETBOARD_BASE_WIDTH,
          Math.max(1, availableWidth / FRETBOARD_BASE_WIDTH),
        );
        setResponsiveScale(scale);
      };

      updateScale();

      const observer = new ResizeObserver(updateScale);
      observer.observe(wrapper);
      return () => observer.disconnect();
    }, []);

    // =============================================================================
    // INITIAL FRETBOARD REVEAL ON SCROLL
    // =============================================================================
    // The fretboard content is hidden until the user scrolls to the sentinel.
    // When revealed, it fades in with a zoom animation for a polished effect.
    // Subsequent exercise changes animate normally.
    const [isInitialRevealComplete, setIsInitialRevealComplete] =
      useState(false);
    const [showFretboardContent, setShowFretboardContent] = useState(false);
    const animationTriggerSentinelRef = useRef<HTMLDivElement>(null);

    // Track when the initial fade animation has completed (after CSS animation finishes)
    // We use CSS @keyframes animation for reliable fade-in, not state-driven transitions
    const [initialFadeComplete, setInitialFadeComplete] = useState(false);

    // DEBUG: Log state on every render (fadeOpacity is logged after it's defined below)

    // IntersectionObserver to detect when the sentinel comes into view
    useEffect(() => {
      // Skip if initial reveal is already complete
      if (isInitialRevealComplete) {
        if (isVerboseDebugEnabled())
          verboseLog(
            '[ZOOM-DEBUG] Initial reveal already complete, skipping observer',
          );
        return;
      }

      const sentinel = animationTriggerSentinelRef.current;
      if (isVerboseDebugEnabled())
        verboseLog(
          '[ZOOM-DEBUG] IntersectionObserver setup - sentinel:',
          sentinel,
        );
      if (!sentinel) {
        if (isVerboseDebugEnabled())
          verboseLog('[ZOOM-DEBUG] ❌ No sentinel element found!');
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (isVerboseDebugEnabled())
            verboseLog('[ZOOM-DEBUG] IntersectionObserver callback:', {
              isIntersecting: entry.isIntersecting,
              intersectionRatio: entry.intersectionRatio,
            });
          if (entry.isIntersecting) {
            if (isVerboseDebugEnabled())
              verboseLog(
                '[ZOOM-DEBUG] 🎯 Sentinel in view! Revealing fretboard content',
              );
            setShowFretboardContent(true);
            setIsInitialRevealComplete(true);
          }
        },
        {
          // Trigger as soon as the sentinel enters the viewport
          threshold: 0,
          rootMargin: '0px',
        },
      );

      observer.observe(sentinel);
      if (isVerboseDebugEnabled())
        verboseLog('[ZOOM-DEBUG] Observer started watching sentinel');

      return () => {
        if (isVerboseDebugEnabled())
          verboseLog('[ZOOM-DEBUG] Observer disconnected');
        observer.disconnect();
      };
    }, [isInitialRevealComplete]);

    // Mark fade animation as complete after the CSS animation finishes
    // We use CSS @keyframes animation for reliable fade-in, not state-driven transitions
    // NOTE: Using hardcoded 500ms here since fadeDuration is defined later in the component
    const INITIAL_FADE_DURATION = 1000;
    useEffect(() => {
      if (showFretboardContent && !initialFadeComplete) {
        if (isVerboseDebugEnabled())
          verboseLog('[ZOOM-DEBUG] 🌟 CSS fade-in animation started');

        // Mark the initial fade as complete after the CSS animation finishes
        // This allows subsequent exercise changes to use the snapshot transition opacity
        const timer = setTimeout(() => {
          if (isVerboseDebugEnabled())
            verboseLog('[ZOOM-DEBUG] ✅ Initial fade animation complete');
          setInitialFadeComplete(true);
        }, INITIAL_FADE_DURATION);

        return () => clearTimeout(timer);
      }
    }, [showFretboardContent, initialFadeComplete]);

    // Get ring overlay configuration with premium access check
    const ringOverlay = useRingOverlay({
      tutorialSlug,
      userPreferences: showRingOverlay ? { enabled: true } : { enabled: false },
    });

    // Scroll container ref for auto-scroll functionality
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });
    const [hasUserScrolled, setHasUserScrolled] = useState(false);
    // PERFORMANCE: Removed scrollLeft state - it was causing re-renders
    // The 3D overlay now reads scroll directly from scrollContainerRef via useFrame

    // Use prop exercises only (no global exercise selection hook)
    const exercisesList = exercises || [];
    const exerciseLoading = false; // No loading state needed from parent-managed selection
    const exerciseError = null; // No error state needed from parent-managed selection

    // Use prop value from parent instead of local state
    const effectiveSelectedExerciseId = selectedExerciseId || '';

    // PERFORMANCE FIX: Memoize all refs to prevent recreation
    const syncActionsRef = useRef(syncProps.sync?.actions);
    const exercisesListRef = useRef(exercisesList);
    const onExerciseSelectRef = useRef(onExerciseSelect);
    const selectedExerciseIdFromSync = syncProps.selectedExercise?.id;
    const selectedExerciseIdRef = useRef(selectedExerciseIdFromSync);

    // Update refs only when values actually change (stable assignment)
    React.useEffect(() => {
      syncActionsRef.current = syncProps.sync?.actions;
    }, [syncProps.sync?.actions]);

    React.useEffect(() => {
      exercisesListRef.current = exercisesList;
    }, [exercisesList]);

    React.useEffect(() => {
      onExerciseSelectRef.current = onExerciseSelect;
    }, [onExerciseSelect]);

    React.useEffect(() => {
      selectedExerciseIdRef.current = selectedExerciseIdFromSync;
    }, [selectedExerciseIdFromSync]);

    // Track callback recreation - should now be stable
    const callbackRecreationCount = useRef(0);

    const handleExerciseSelect = React.useCallback(
      (exerciseId: string) => {
        // Track callback stability
        callbackRecreationCount.current++;
        logger.info(
          `🔥 handleExerciseSelect call #${callbackRecreationCount.current}, exerciseId: ${exerciseId}`,
        );

        const exercise = exercisesListRef.current.find(
          (ex) => ex.id.value === exerciseId,
        );
        if (exercise) {
          // Check if this exercise is already selected by comparing with sync state
          const wasAlreadySelected =
            selectedExerciseIdRef.current === exerciseId;

          // Add a unique selection timestamp to track user clicks
          const timestamp = Date.now();
          const exerciseWithTimestamp = {
            ...exercise,
            _selectionTimestamp: timestamp,
          };

          // Parent manages selectedExerciseId, we just notify via callback
          onExerciseSelectRef.current?.(exerciseId);

          // Emit comprehensive sync events to configure all widgets
          const syncActions = syncActionsRef.current;
          if (syncActions?.emitEvent) {
            syncActions.emitEvent(
              'EXERCISE_CHANGE',
              {
                exercise,
                forceReload: wasAlreadySelected,
                clickTimestamp: timestamp,
              },
              'high',
            );
          } else {
            logger.warn(
              '🔸 Sync actions not available yet for EXERCISE_CHANGE',
            );
          }

          // Update tempo for metronome and global controls
          if (exercise.bpm && exercise.bpm > 0 && syncActions?.emitEvent) {
            syncActions.emitEvent(
              'TEMPO_CHANGE',
              {
                tempo: exercise.bpm,
                source: 'exercise-selector',
                reason: 'exercise-template',
              },
              'high',
            );
          }

          // Custom bassline pattern if available
          if (
            exercise.chord_progression &&
            Array.isArray(exercise.chord_progression) &&
            syncActions?.emitEvent
          ) {
            syncActions.emitEvent(
              'CUSTOM_BASSLINE',
              {
                chordProgression: exercise.chord_progression,
                key: exercise.key,
                source: 'exercise-selector',
                reason: 'exercise-template',
              },
              'normal',
            );
          }

          // Volume configuration for optimal practice
          if (syncActions?.emitEvent) {
            syncActions.emitEvent(
              'VOLUME_CHANGE',
              {
                masterVolume: 0.8,
                metronomeVolume: 0.7,
                source: 'exercise-selector',
                reason: 'exercise-template',
              },
              'low',
            );
          }
        }
      },
      [], // PERFORMANCE FIX: No dependencies - use refs instead
    );

    // REMOVED: Auto-selection logic moved to parent (YouTubeWidgetPage)
    // The parent component manages selectedExerciseId as the single source of truth
    // This prevents race conditions and ensures proper data flow

    // Debug: Log when selectedExerciseId changes
    useEffect(() => {
      logger.info(
        `🎯 FretboardCard: selectedExerciseId changed for render #${globalRenderCount}:`,
        {
          selectedExerciseId: effectiveSelectedExerciseId,
          exercisesLength: exercisesList.length,
          timestamp: new Date().toISOString(),
          renderNumber: globalRenderCount,
        },
      );
    }, [effectiveSelectedExerciseId, exercisesList.length]);

    // Only reset scroll to 0 if user hasn't manually scrolled
    React.useEffect(() => {
      if (!hasUserScrolled && scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }, [hasUserScrolled]);

    // Set initial scroll position on mount only
    React.useEffect(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }, []); // Run only on mount

    // Use shared state from parent, with defaults if not provided - MUST be declared before useFretboard
    const sharedSelectedDots = selectedDots3D || new Map();
    const sharedSetSelectedDots =
      setSelectedDots3D ||
      ((dots: Map<string, number[]>) => {
        logger.info('No setSelectedDots3D provided, dots:', dots);
      });
    // CRITICAL: Use ?? instead of || to properly handle 0 values and only default when undefined/null
    const sharedStringCount = stringCount3D ?? 4;

    // DEBUG: Track fretboard hook dependencies
    // NOTE: currentTime IS included in dependencies now to enable measure-based opacity updates
    // The arePropsEqual function throttles re-renders to every 100ms to balance performance
    const fretboardSyncProps = React.useMemo(() => {
      const props = {
        selectedExercise: syncProps.selectedExercise,
        isPlaying: syncProps.isPlaying,
        currentTime: syncProps.currentTime,
        tempo: syncProps.tempo,
        masterVolume: syncProps.masterVolume,
        sync: syncProps.sync, // For emitEvent functionality
      };
      logger.info(
        `🎯 FretboardCard: fretboardSyncProps memoized for render #${globalRenderCount}`,
        props,
      );
      return props;
    }, [
      syncProps.selectedExercise,
      syncProps.isPlaying,
      syncProps.currentTime, // Now included - arePropsEqual throttles to every 100ms
      syncProps.tempo,
      syncProps.masterVolume,
      syncProps.sync,
    ]);

    const fretboardConfig = React.useMemo(() => {
      const config = {
        stringCount: sharedStringCount,
        maxFrets: maxFrets,
      };
      logger.info(
        `🎯 FretboardCard: fretboardConfig memoized for render #${globalRenderCount}`,
        config,
      );
      return config;
    }, [sharedStringCount, maxFrets]);

    // Use the main fretboard hook that combines all functionality
    logger.info(
      `🎯 FretboardCard: calling useFretboard for render #${globalRenderCount}`,
    );
    const fretboard = useFretboard(fretboardSyncProps, fretboardConfig);
    logger.info(
      `🎯 FretboardCard: useFretboard returned for render #${globalRenderCount}`,
      {
        selectedDotsSize: fretboard.selectedDots.size,
        stringCount: fretboard.stringCount,
        hasExercise: fretboard.exerciseData.hasExercise,
      },
    );

    const sharedSetStringCount =
      setStringCount3D ||
      ((count: StringCount) => {
        logger.info('No setStringCount3D provided, count:', count);
      });

    // Manual selection tracking hook
    logger.info(
      `🎯 FretboardCard: calling useManualSelectionTracking for render #${globalRenderCount}`,
    );
    const manualSelectionTracking = useManualSelectionTracking();

    // =============================================================================
    // EXERCISE TRANSITION - FAANG Atomic Snapshot Pattern (Double Buffer)
    // =============================================================================
    // Problem: Three independent useSnapshotTransition hooks (notes, tempo, overlay3D)
    // can get out of sync during rapid exercise switching, causing stale data display.
    // For example: notes from exercise A displayed with tempo from exercise B.
    //
    // FAANG Solution: Combine ALL transition-sensitive data into a SINGLE atomic object.
    // This ensures notes, tempo, and overlay3D config swap together at the EXACT same
    // moment during the SWAP phase. No more transient mismatches between data sources.
    //
    // Timeline:
    //   User clicks → fade-out (OLD atomic data visible) → SWAP → fade-in (NEW atomic data visible)
    // =============================================================================
    const FADE_DURATION_MS = 500;

    // Create atomic source data object - all related data combined
    // useMemo ensures we only create a new object when constituent parts actually change
    const atomicSourceData = React.useMemo<AtomicExerciseDisplayData>(
      () => ({
        notes: fretboard.exerciseData.exerciseNotes,
        tempo: fretboard.exercise.tempo,
        overlay3DConfig: effectiveOverlay3DConfig ?? null,
        exerciseId: fretboard.exerciseData.selectedExercise?.id,
      }),
      [
        fretboard.exerciseData.exerciseNotes,
        fretboard.exercise.tempo,
        effectiveOverlay3DConfig,
        fretboard.exerciseData.selectedExercise?.id,
      ],
    );

    // SINGLE atomic transition for ALL exercise-related display data
    // This guarantees notes, tempo, and overlay3D config swap together atomically
    const {
      displayData: atomicDisplayData,
      opacity: fadeOpacity,
      fadeDuration,
      phase: transitionPhase,
    } = useSnapshotTransition(
      atomicSourceData,
      // CRITICAL: Use .value to get the string ID, not the ExerciseId object
      // Object references would always be different, breaking key comparison
      fretboard.exerciseData.selectedExercise?.id?.value,
      { fadeDuration: FADE_DURATION_MS, debug: false },
    );

    // Destructure for backward compatibility with existing code
    const displayNotes = atomicDisplayData.notes;
    const displayTempo = atomicDisplayData.tempo;
    // Convert null back to undefined for prop compatibility (optional prop expects undefined, not null)
    const displayOverlay3D = atomicDisplayData.overlay3DConfig ?? undefined;

    // =============================================================================
    // EFFECTIVE TRANSITION PHASE FOR ZOOM ANIMATION
    // DEBUG: Log state on every render (after fadeOpacity is defined)
    if (isVerboseDebugEnabled()) {
      verboseLog('[ZOOM-DEBUG] Render state:', {
        isInitialRevealComplete,
        showFretboardContent,
        initialFadeComplete,
        fadeOpacity,
        usingCSSAnimation: !initialFadeComplete,
        sentinelExists: !!animationTriggerSentinelRef.current,
      });
    }

    // =============================================================================
    // When fretboard is first revealed (showFretboardContent becomes true), we want
    // to trigger the zoom animation. We do this by forcing 'fading-in' phase temporarily.
    // After the zoom animation completes, we go back to normal phase pass-through.
    // Track when initial zoom animation is done (after 1700ms from reveal)
    const [initialZoomDone, setInitialZoomDone] = useState(false);
    const initialRevealDoneRef = useRef(false);

    // forceInitialZoom is true when:
    // - showFretboardContent is true (sentinel triggered)
    // - AND initial zoom animation hasn't completed yet
    // This is computed directly, not via useEffect, so it's available on first render
    const forceInitialZoom = showFretboardContent && !initialZoomDone;

    // Log the initial reveal
    useEffect(() => {
      if (showFretboardContent && !initialRevealDoneRef.current) {
        initialRevealDoneRef.current = true;
        if (isVerboseDebugEnabled()) {
          verboseLog(
            '[ZOOM-DEBUG] 🎬 Initial reveal - forceInitialZoom is now true',
          );
        }

        // Mark zoom animation as done after it completes (1500ms + buffer)
        const endTimer = setTimeout(() => {
          if (isVerboseDebugEnabled()) {
            verboseLog(
              '[ZOOM-DEBUG] ✅ Zoom animation complete - setting initialZoomDone',
            );
          }
          setInitialZoomDone(true);
        }, 1700);

        return () => {
          clearTimeout(endTimer);
        };
      }
    }, [showFretboardContent]);

    // Compute effective transition phase for the 3D overlay
    const effectiveTransitionPhase = React.useMemo(() => {
      // During initial reveal, force 'fading-in' to trigger zoom animation
      if (forceInitialZoom) {
        if (isVerboseDebugEnabled()) {
          verboseLog(
            '[ZOOM-DEBUG] effectiveTransitionPhase: FORCING fading-in for initial reveal',
          );
        }
        return 'fading-in' as const;
      }

      if (isVerboseDebugEnabled()) {
        verboseLog(
          '[ZOOM-DEBUG] effectiveTransitionPhase: passing through',
          transitionPhase,
        );
      }
      return transitionPhase;
    }, [forceInitialZoom, transitionPhase]);

    // Get selected exercise from sync props for GlobalControls
    const activeExercise = syncProps.selectedExercise;

    // Exercise loading hook
    logger.info(
      `🎯 FretboardCard: calling useExerciseLoader for render #${globalRenderCount}`,
    );
    const exerciseLoader = useExerciseLoader({
      syncProps,
      manualSelectionTracking,
      fretboardExercise: fretboard.exercise,
      onExerciseLoad: (exerciseDotsMap) => {
        logger.info(`🎯 FretboardCard: onExerciseLoad callback called`, {
          dotsMapSize: exerciseDotsMap.size,
        });
        // Update both 2D and 3D states
        fretboard.state.setSelectedDots(exerciseDotsMap);
        sharedSetSelectedDots(exerciseDotsMap);
        if (setSelectedDots3D) {
          setSelectedDots3D(exerciseDotsMap);
        }
      },
    });

    // Dot synchronization hook
    useDotSynchronization({
      localDots: fretboard.selectedDots,
      sharedDots: sharedSelectedDots,
      localStringCount: fretboard.stringCount,
      sharedStringCount,
      setLocalDots: fretboard.state.setSelectedDots,
      setSharedDots: sharedSetSelectedDots,
      setLocalStringCount: fretboard.state.handleStringCountChange,
      setSharedStringCount: sharedSetStringCount,
      setSelectionOrder: fretboard.state.setSelectionOrder,
      onUserManualSelection: manualSelectionTracking.markManualSelection,
    });

    // Dot selection handlers hook
    const dotSelectionHandlers = useDotSelectionHandlers({
      selectedDots: fretboard.selectedDots,
      sharedSelectedDots,
      draggedDot: fretboard.state.draggedDot,
      setSelectedDots: fretboard.state.setSelectedDots,
      sharedSetSelectedDots,
      setSelectionOrder: fretboard.state.setSelectionOrder,
      markManualReset: () => {
        manualSelectionTracking.markManualReset();
        exerciseLoader.markReset();
      },
      markManualSelection: manualSelectionTracking.markManualSelection,
      emitBasslineEvent: fretboard.exercise.emitBasslineEvent,
      clearExerciseTracking: exerciseLoader.clearExerciseTracking,
      handleDragEnd: fretboard.handleDragEnd,
    });

    // String count handlers hook for 3D mode
    const stringCountHandlers = useStringCountHandlers({
      currentStringCount: sharedStringCount,
      selectedDots: sharedSelectedDots,
      setStringCount: sharedSetStringCount,
    });

    // Auto-populate shared state when exercise loads (for 3D mode)
    React.useEffect(() => {
      logger.info(
        `🎯 FretboardCard: auto-populate useEffect triggered for render #${globalRenderCount}:`,
        {
          hasExercise: fretboard.exerciseData.hasExercise,
          exerciseNotesLength: fretboard.exerciseData.exerciseNotes.length,
          selectedExerciseId: fretboard.exerciseData.selectedExercise?.id,
          hasSetSelectedDots3D: !!setSelectedDots3D,
          hasManuallyReset: manualSelectionTracking.hasManuallyReset(),
          hasManualSelections: manualSelectionTracking.hasManualSelections(),
          timestamp: new Date().toISOString(),
          renderNumber: globalRenderCount,
        },
      );

      if (
        fretboard.exerciseData.hasExercise &&
        fretboard.exerciseData.exerciseNotes.length > 0 &&
        setSelectedDots3D &&
        !manualSelectionTracking.hasManuallyReset() &&
        !manualSelectionTracking.hasManualSelections()
      ) {
        logger.info(
          `🎯 FretboardCard: auto-populating 3D dots for render #${globalRenderCount}`,
        );
        const exerciseDotsMap =
          fretboard.exercise.convertExerciseNotesToSelectedDots(
            fretboard.exerciseData.exerciseNotes,
          );
        setSelectedDots3D(exerciseDotsMap);
      }
    }, [
      fretboard.exerciseData.hasExercise,
      fretboard.exerciseData.exerciseNotes.length,
      fretboard.exerciseData.selectedExercise?.id,
      setSelectedDots3D,
      // Removed unstable function references to prevent infinite loops
      // manualSelectionTracking functions are stable and don't need to be in dependencies
    ]);

    // Auto-scroll to center a specific fret in view
    const scrollToFret = React.useCallback((fret: number) => {
      if (!scrollContainerRef.current) return;

      const FRET_SPACING = 38;
      const FRET_OFFSET = 46;
      const CENTER_OFFSET = 15;
      const containerWidth = 568;

      // Calculate the X position of the fret
      const fretX = CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING;

      // Center the fret in the viewport
      const targetScrollLeft = fretX - containerWidth / 2;

      scrollContainerRef.current.scrollTo({
        left: Math.max(0, targetScrollLeft),
        behavior: 'smooth',
      });
    }, []);

    // Apply fretboard view config when exercise changes
    React.useEffect(() => {
      const exercise = syncProps.selectedExercise;
      if (!exercise) return;

      // DIAGNOSTIC: Log the exercise object structure to debug config retrieval
      verboseLog('🎸 [FRETBOARD-CONFIG-DEBUG] Exercise object:', {
        id: exercise.id,
        title: (exercise as any).title,
        // Check all possible property names
        fretboardViewConfig: (exercise as any).fretboardViewConfig,
        fretboard_view_config: (exercise as any).fretboard_view_config,
        _props: (exercise as any)._props,
        // Log all keys on the exercise object
        allKeys: Object.keys(exercise),
        // Check if it has the getter
        hasGetter:
          typeof Object.getOwnPropertyDescriptor(
            Object.getPrototypeOf(exercise),
            'fretboardViewConfig',
          )?.get === 'function',
      });

      // Get fretboard view config from exercise (handle both entity and raw DTO)
      const config =
        (exercise as any).fretboardViewConfig ||
        (exercise as any).fretboard_view_config;
      const preset = config?.preset || 'default';
      const presetConfig =
        FRETBOARD_VIEW_PRESETS[preset as keyof typeof FRETBOARD_VIEW_PRESETS] ||
        FRETBOARD_VIEW_PRESETS.default;

      verboseLog(`🎸 [FRETBOARD-CONFIG-DEBUG] Config detection:`, {
        configFound: !!config,
        configValue: config,
        detectedPreset: preset,
        willApplyOverlay3D: !!presetConfig.overlay3D,
      });

      logger.info(`🎸 Applying fretboard view config for exercise:`, {
        exerciseId: exercise.id,
        preset,
        zoomLevel: config?.zoomLevel ?? presetConfig.zoomLevel,
        scrollMode: config?.scrollMode ?? presetConfig.scrollMode,
        initialFret: config?.initialFret ?? presetConfig.initialFret,
        hasOverlay3D: !!presetConfig.overlay3D,
      });

      // Apply zoom level
      setZoomLevel(config?.zoomLevel ?? presetConfig.zoomLevel);

      // Apply scroll mode
      setScrollMode(config?.scrollMode ?? presetConfig.scrollMode);

      // Apply 3D overlay settings from preset
      if (presetConfig.overlay3D) {
        // Merge preset overlay3D values with existing overlay3DConfig
        // This preserves all properties (colors, bloom, fade zones, etc.) while only
        // overriding the specific position/scale/rotation values from the preset
        const presetOverlay = presetConfig.overlay3D;
        setEffectiveOverlay3DConfig((prev) => ({
          ...prev, // Keep all existing properties (colors, bloom, fade zones, etc.)
          rotationX: presetOverlay.rotX,
          rotationY: presetOverlay.rotY,
          rotationZ: presetOverlay.rotZ,
          contentScaleX: presetOverlay.scaleX,
          contentScaleY: presetOverlay.scaleY,
          offsetX: presetOverlay.canvasOffsetX,
          offsetY: presetOverlay.canvasOffsetY,
          sceneX: presetOverlay.sceneX,
          sceneY: presetOverlay.sceneY,
          sceneZ: presetOverlay.sceneZ,
          cameraDistance: presetOverlay.camDist,
          fovOffset: presetOverlay.fov,
          cameraY: presetOverlay.camY,
          originX: presetOverlay.originX,
          originY: presetOverlay.originY,
          contentScale: presetOverlay.scale,
          // Keep positioningMode as 'flat' - dots stay at Z=0, scene rotation handles tilt
          positioningMode: 'flat' as const,
          tiltAxisOffset: presetOverlay.tiltYOffset,
          tiltAxisOffsetX: presetOverlay.tiltXOffset,
          perspectiveMultiplier: presetOverlay.persp,
        }));
        logger.info(
          `🎸 Applied octave preset 3D overlay settings:`,
          presetOverlay,
        );
      } else {
        // Use default overlay config passed via props
        setEffectiveOverlay3DConfig(overlay3DConfig);
      }

      // Apply initial scroll position (only if not user-scrolled and has initialFret)
      const initialFret = config?.initialFret ?? presetConfig.initialFret;
      if (initialFret > 0) {
        // Reset hasUserScrolled for new exercise
        setHasUserScrolled(false);
        // Small delay to allow component to mount before scrolling
        setTimeout(() => {
          scrollToFret(initialFret);
        }, 100);
      } else {
        // Reset to start for default view
        setHasUserScrolled(false);
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
        }
      }
    }, [syncProps.selectedExercise?.id, scrollToFret, overlay3DConfig]);

    // Auto-scroll during playback to follow current note
    // Only active when: scrollMode is 'follow', user hasn't manually scrolled, and playback is active
    React.useEffect(() => {
      // Skip auto-scroll if mode is 'locked' - view stays fixed at initial position
      if (scrollMode === 'locked') {
        return;
      }

      if (
        !hasUserScrolled &&
        fretboard.exercise.audioIntegration.playbackPosition?.isPlaying
      ) {
        const currentNote =
          fretboard.exercise.audioIntegration.playbackPosition.currentNote;
        if (currentNote && typeof currentNote.fret === 'number') {
          // Handle open string notes (fret 0) - don't scroll, just ensure we're at position 0
          if (currentNote.fret === 0) {
            if (
              scrollContainerRef.current &&
              scrollContainerRef.current.scrollLeft > 0
            ) {
              scrollContainerRef.current.scrollTo({
                left: 0,
                behavior: 'smooth',
              });
            }
            return;
          }

          // Handle fretted notes (fret > 0)
          if (currentNote.fret > 0) {
            // Only scroll if the note is outside the current viewport
            if (scrollContainerRef.current) {
              const scrollLeft = scrollContainerRef.current.scrollLeft;
              const containerWidth = 568;
              const currentViewStart = scrollLeft;
              const currentViewEnd = scrollLeft + containerWidth;

              const FRET_SPACING = 38;
              const FRET_OFFSET = 46;
              const CENTER_OFFSET = 15;
              const fretX =
                CENTER_OFFSET +
                FRET_OFFSET +
                (currentNote.fret - 1) * FRET_SPACING;

              // Add some buffer so we scroll before the note goes out of view
              const buffer = 100;
              if (
                fretX < currentViewStart + buffer ||
                fretX > currentViewEnd - buffer
              ) {
                scrollToFret(currentNote.fret);
              }
            }
          }
        }
      }
    }, [
      scrollMode,
      hasUserScrolled,
      fretboard.exercise.audioIntegration.playbackPosition?.isPlaying,
      fretboard.exercise.audioIntegration.playbackPosition?.currentNote,
      scrollToFret,
    ]);

    // Determine sync status
    const syncStatus = syncProps.isConnected ? 'Synced' : 'Disconnected';

    // Horizontal scroll drag handlers
    const handleMouseDown = (e: React.MouseEvent) => {
      // Don't start scrolling if user is clicking on a dot or interactive element
      const target = e.target as HTMLElement;
      if (target.closest('[role="button"]') || target.closest('button')) {
        return;
      }

      if (!scrollContainerRef.current) return;
      setIsDragging(true);
      setDragStart({
        x: e.pageX,
        scrollLeft: scrollContainerRef.current.scrollLeft,
      });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
      if (!isDragging || !scrollContainerRef.current) return;
      e.preventDefault();
      const x = e.pageX;
      const walk = (x - dragStart.x) * 2; // Multiply by 2 for faster scrolling
      scrollContainerRef.current.scrollLeft = dragStart.scrollLeft - walk;

      // Mark that user has manually scrolled
      setHasUserScrolled(true);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    const handleMouseLeave = () => {
      setIsDragging(false);
    };

    // Drag handlers for dots (existing)
    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
    };

    // Log render completion time
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime;
    logger.info(
      `🔴 FretboardCardContent render #${globalRenderCount} COMPLETE`,
      {
        renderDurationMs: renderDuration.toFixed(2),
        timestamp: new Date().toISOString(),
      },
    );

    // PERFORMANCE FIX: Memoize callbacks passed to FretboardGrid to prevent re-renders
    // These inline functions were creating new references on every render, defeating React.memo
    const handleGridDragStart = React.useCallback(
      (e: React.DragEvent, stringIndex: number, fret: number | 'open') => {
        const orders = fretboard.checkGetDotOrder(stringIndex, fret);
        const order = orders.length > 0 ? orders[0] : 0;
        if (order !== undefined) {
          fretboard.handleDragStart(stringIndex, fret, order);
        }
      },
      [fretboard.checkGetDotOrder, fretboard.handleDragStart],
    );

    const handleGridDrop = React.useCallback(
      (
        e: React.DragEvent,
        targetStringIndex: number,
        targetFret: number | 'open',
      ) => {
        dotSelectionHandlers.handleDragDrop(targetStringIndex, targetFret);
      },
      [dotSelectionHandlers.handleDragDrop],
    );

    return (
      <ZoneCard className="zone-card bg-transparent border-transparent shadow-none overflow-visible">
        <ZoneCardContent className="p-0 overflow-visible">
          {/* Responsive scaling wrapper — measures available width, scales fretboard to fill */}
          <div
            ref={responsiveWrapperRef}
            className="w-full"
            style={{
              height: FRETBOARD_BASE_HEIGHT * responsiveScale,
              overflow: 'visible',
            }}
          >
            {/* Transparent Fretboard Container - scaled from 568px base to fill available width */}
            <div
              className="relative"
              style={{
                overflow: 'visible',
                transform: `scale(${responsiveScale})`,
                transformOrigin: 'top center',
              }}
            >
              {/* 2D Mode Fretboard - With zoom and horizontal scroll */}
              {/* Initially hidden until user scrolls to sentinel, then fades in with zoom animation */}
              <div
                ref={fretboardContainerRef}
                className="relative mx-auto"
                style={{
                  width: 568,
                  height: 290,
                  overflow: 'visible',
                  perspective: '800px',
                  // Visibility logic:
                  // - Before sentinel: completely hidden (visibility:hidden preserves layout)
                  // - After sentinel triggers showFretboardContent: visible with fade animation
                  visibility: showFretboardContent ? 'visible' : 'hidden',
                  // Opacity logic:
                  // - During initial reveal: CSS animation fades from 0 to 1
                  // - After initial fade complete: use fadeOpacity for subsequent exercise transitions
                  opacity: showFretboardContent
                    ? initialFadeComplete
                      ? fadeOpacity
                      : 0
                    : 0,
                  // Use CSS animation for initial reveal, then CSS transition for exercise changes
                  animation:
                    showFretboardContent && !initialFadeComplete
                      ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
                      : undefined,
                  transition: initialFadeComplete
                    ? `opacity ${fadeDuration}ms ease-out`
                    : undefined,
                }}
              >
                <div
                  ref={(el) => {
                    scrollContainerRef.current = el;
                    if (el && !hasUserScrolled) {
                      // Only set to 0 if user hasn't manually scrolled
                      el.scrollLeft = 0;
                    }
                  }}
                  className="overflow-x-auto overflow-y-hidden h-full flex items-center"
                  style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE/Edge
                    // DEBUG: Full XYZ rotation for 3D overlay calibration
                    transform: `rotateX(${debugRotation.x}deg) rotateY(${debugRotation.y}deg) rotateZ(${debugRotation.z}deg)`,
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center center',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onScroll={() => {
                    // Mark that user has scrolled when any scroll event occurs
                    // PERFORMANCE: Only track hasUserScrolled flag, no state updates for scroll position
                    if (
                      scrollContainerRef.current &&
                      scrollContainerRef.current.scrollLeft > 0
                    ) {
                      setHasUserScrolled(true);
                    }
                  }}
                >
                  <style jsx>{`
                    div::-webkit-scrollbar {
                      display: none; /* Chrome/Safari/Webkit */
                    }
                  `}</style>
                  {/* 2D Fretboard - CONDITIONALLY RENDERED when not hidden */}
                  {/* When hide2DFretboard is true, we don't render the FretboardGrid at all (not just hide with CSS) */}
                  {/* This prevents 2D elements from appearing in DOM inspector and improves performance */}
                  {!hide2DFretboard && (
                    <div
                      style={{
                        position: 'relative', // For absolute positioning of 3D overlay
                        width: 568 + 600, // Extra 600px allows scrolling to see all frets up to 24
                        height: 290, // Match fretboard container height for proper canvas sizing
                        transform: `scale(${zoomLevel})`,
                        transformOrigin: '0 0', // Start zoom from top-left (open strings position)
                        transition: 'transform 0.2s ease-out',
                      }}
                    >
                      <FretboardGrid
                        stringCount={sharedStringCount}
                        frets={fretboard.frets}
                        selectedDots={fretboard.selectedDots}
                        draggedDot={fretboard.state.draggedDot}
                        dragOverTarget={fretboard.state.dragOverTarget}
                        isExerciseNote={fretboard.isExerciseNote}
                        isCurrentNote={fretboard.isCurrentNote}
                        zoomLevel={zoomLevel}
                        onDragStart={handleGridDragStart}
                        onDragOver={handleDragOver}
                        onDragEnter={fretboard.handleDragEnter}
                        onDragLeave={fretboard.handleDragLeave}
                        onDrop={handleGridDrop}
                        onDragEnd={fretboard.handleDragEnd}
                        onDotClick={fretboard.handleDotClickWithAudio}
                        onDotSecondSelection={
                          dotSelectionHandlers.handleDotSecondSelection2D
                        }
                        onDotRemoval={dotSelectionHandlers.handleDotRemoval2D}
                        segmentFunctions={fretboard.segmentFunctions}
                        highlightingFunctions={fretboard.highlightingFunctions}
                        getMeasureOpacity={
                          fretboard.measureOpacity.getNoteOpacity
                        }
                        getMeasureHighlight={
                          fretboard.measureOpacity.getMeasureHighlight
                        }
                        measureOpacityTransition={
                          fretboard.measureOpacity.transitionDuration
                        }
                        measureAwareConnections={
                          fretboard.exercise.measureAwareConnections
                        }
                        currentMeasure0Based={
                          fretboard.exercise.currentMeasure0Based
                        }
                        nextNoteToPlay={fretboard.nextNoteToPlay}
                        exerciseNotes={displayNotes}
                        currentMeasureFromNote={
                          fretboard.exercise.currentMeasureFromNote
                        }
                        // Props for useFretboardNoteSync - direct DOM note synchronization
                        isPlaying={syncProps.isPlaying}
                        tempo={displayTempo}
                        maxFrets={maxFrets}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Guitar Hero-style 3D Ring Overlay - COMPLETELY OUTSIDE fretboard container
                to prevent clipping when rotated. Uses absolute positioning relative to parent.
                Has overflow:visible and no clipping boundaries.
                NOTE: Only render after showFretboardContent is true (sentinel reached) */}
              {showFretboardContent &&
                !hide3DFretboard &&
                ringOverlay.config.enabled && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: 568,
                      height: 290,
                      pointerEvents: 'none',
                      overflow: 'visible',
                      // NO clipping - allow 3D to extend in all directions
                      // Apply same opacity/animation as fretboard container for initial reveal fade
                      // CRITICAL: Set opacity to 0 during CSS animation, not undefined!
                      opacity: initialFadeComplete ? fadeOpacity : 0, // Start at 0 for CSS animation
                      animation: !initialFadeComplete
                        ? `fretboardFadeIn ${INITIAL_FADE_DURATION}ms ease-out forwards`
                        : undefined,
                      transition: initialFadeComplete
                        ? `opacity ${fadeDuration}ms ease-out`
                        : undefined,
                    }}
                  >
                    <Ring3DOverlayCanvas
                      fretboardRef={fretboardContainerRef}
                      exerciseNotes={displayNotes}
                      currentTime={syncProps.currentTime}
                      isPlaying={syncProps.isPlaying}
                      config={ringOverlay.config}
                      stringCount={sharedStringCount}
                      maxFrets={maxFrets}
                      countdownBeats={4}
                      tempo={displayTempo}
                      tiltAngle={debugRotation.x} // Use DEBUG panel X (Tilt) so 3D matches 2D CSS rotateX
                      overlay3DConfig={displayOverlay3D}
                      debugRotation={debugRotation}
                      // PERFORMANCE: Pass ref to scroll container instead of scroll value
                      // This allows Three.js to read scroll in useFrame without React re-renders
                      scrollContainerRef={scrollContainerRef}
                      // Exercise ID for detecting exercise changes (fade transitions)
                      exerciseId={selectedExerciseId}
                      // Exercise transition fade - controlled by snapshot transition
                      fadeOpacity={fadeOpacity}
                      fadeDuration={fadeDuration}
                      // Transition phase for camera zoom animation
                      transitionPhase={effectiveTransitionPhase}
                      // Initial reveal: trigger zoom animation immediately on mount
                      // This bypasses phase change detection to solve the race condition
                      triggerZoomOnMount={forceInitialZoom}
                    />
                  </div>
                )}

            </div>
          </div>
        </ZoneCardContent>
        {/* Sentinel element for triggering initial zoom animation when user scrolls to GlobalControls area */}
        <div
          ref={animationTriggerSentinelRef}
          aria-hidden="true"
          style={{ height: 1 }}
        />
      </ZoneCard>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Return true if props are equal (skip re-render), false if different (re-render)

    // Detailed prop change detection
    const changes: string[] = [];

    // Check each prop individually
    if (prevProps.selectedDots3D !== nextProps.selectedDots3D)
      changes.push('selectedDots3D');
    if (prevProps.stringCount3D !== nextProps.stringCount3D)
      changes.push('stringCount3D');
    if (prevProps.maxFrets !== nextProps.maxFrets) changes.push('maxFrets');
    // DEBUG: Check debugRotation for 3D overlay calibration
    if (
      prevProps.debugRotation?.x !== nextProps.debugRotation?.x ||
      prevProps.debugRotation?.y !== nextProps.debugRotation?.y ||
      prevProps.debugRotation?.z !== nextProps.debugRotation?.z
    )
      changes.push('debugRotation');
    if (prevProps.tutorialData !== nextProps.tutorialData)
      changes.push('tutorialData');
    if (prevProps.tutorialSlug !== nextProps.tutorialSlug)
      changes.push('tutorialSlug');
    if (prevProps.exercises !== nextProps.exercises) changes.push('exercises');
    if (prevProps.selectedExerciseId !== nextProps.selectedExerciseId)
      changes.push('selectedExerciseId');
    if (prevProps.onExerciseSelect !== nextProps.onExerciseSelect)
      changes.push('onExerciseSelect');
    if (prevProps.setSelectedDots3D !== nextProps.setSelectedDots3D)
      changes.push('setSelectedDots3D');
    if (prevProps.setStringCount3D !== nextProps.setStringCount3D)
      changes.push('setStringCount3D');
    if (prevProps.setCameraMode !== nextProps.setCameraMode)
      changes.push('setCameraMode');
    if (prevProps.onMaxFretsChange !== nextProps.onMaxFretsChange)
      changes.push('onMaxFretsChange');
    if (prevProps.onTiltAngleChange !== nextProps.onTiltAngleChange)
      changes.push('onTiltAngleChange');
    // DEBUG: Check overlay3DConfig for 3D overlay calibration
    if (prevProps.overlay3DConfig !== nextProps.overlay3DConfig)
      changes.push('overlay3DConfig');
    // DEBUG: Check hide2DFretboard for visibility toggle
    if (prevProps.hide2DFretboard !== nextProps.hide2DFretboard)
      changes.push('hide2DFretboard');
    // DEBUG: Check hide3DFretboard for visibility toggle
    if (prevProps.hide3DFretboard !== nextProps.hide3DFretboard)
      changes.push('hide3DFretboard');

    // Check syncProps (but ignore currentTime)
    if (
      prevProps.syncProps.selectedExercise !==
      nextProps.syncProps.selectedExercise
    )
      changes.push('syncProps.selectedExercise');
    if (prevProps.syncProps.isPlaying !== nextProps.syncProps.isPlaying)
      changes.push('syncProps.isPlaying');
    if (prevProps.syncProps.tempo !== nextProps.syncProps.tempo)
      changes.push('syncProps.tempo');
    if (prevProps.syncProps.masterVolume !== nextProps.syncProps.masterVolume)
      changes.push('syncProps.masterVolume');
    if (prevProps.syncProps.sync !== nextProps.syncProps.sync)
      changes.push('syncProps.sync');
    // Check currentTime for measure-based opacity updates
    // Only re-render if time has changed enough to potentially affect measure display
    // (approximately every 100ms to balance responsiveness with performance)
    const prevTime = prevProps.syncProps.currentTime || 0;
    const nextTime = nextProps.syncProps.currentTime || 0;
    if (Math.abs(nextTime - prevTime) > 100) {
      changes.push('syncProps.currentTime');
    }

    const isEqual = changes.length === 0;

    if (!isEqual) {
      logger.info(
        `🔥 FretboardCardContent will re-render due to prop changes:`,
        changes,
      );
    }

    return isEqual;
  },
);

/**
 * Skeleton loading state for FretboardCard
 * Shows placeholder for fretboard visualization area
 */
export function FretboardCardSkeleton() {
  return (
    <ZoneCard className="zone-card bg-transparent border-transparent shadow-none overflow-visible">
      <ZoneCardContent className="p-0 overflow-visible">
        <div className="relative w-full" style={{ aspectRatio: '568 / 290' }}>
          {/* Fretboard Grid Skeleton with glassmorphism */}
          <div className="skeleton-glass w-full h-full rounded-xl">
            {/* String lines placeholder */}
            <div className="absolute inset-0 flex flex-col justify-evenly p-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-1 w-full rounded-full opacity-30"
                />
              ))}
            </div>
            {/* Fret markers placeholder */}
            <div className="absolute inset-0 flex justify-evenly items-center p-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
                <div
                  key={i}
                  className="skeleton-shimmer w-1 h-32 rounded-full opacity-20"
                />
              ))}
            </div>
            {/* Note dot placeholders */}
            <div className="absolute inset-0 flex flex-wrap gap-8 justify-center items-center p-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`skeleton-shimmer w-8 h-8 rounded-full skeleton-delay-${i}`}
                />
              ))}
            </div>
          </div>
        </div>
      </ZoneCardContent>
      <span className="sr-only">Loading fretboard visualization...</span>
    </ZoneCard>
  );
}
