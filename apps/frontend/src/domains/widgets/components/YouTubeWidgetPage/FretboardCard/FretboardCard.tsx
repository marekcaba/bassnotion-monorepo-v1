'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Target } from 'lucide-react';
import { createStructuredLogger } from '@bassnotion/contracts';

const logger = createStructuredLogger('FretboardCard');
// Removed useExerciseSelection - parent manages exercise selection now
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
// import { useWidgetAudioRegistration } from '@/domains/widgets/hooks/useWidgetAudioRegistration'; // TODO: Fix - depends on deleted useWidgetSync
import { FretboardHeader } from './components/FretboardHeader';
import { ExerciseProgressBar } from './components/ExerciseProgressBar';
import { FretboardControls } from './components/FretboardControls';
import { FretboardModeControls } from './components/FretboardModeControls';
import { FretboardGrid } from './components/FretboardGrid';
import Fretboard3D from './components/Fretboard3D';
import { convertTo3DFormat } from './utils/formatConversion';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

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
  is3DMode?: boolean;
  onToggle3DMode?: () => void;
  // Shared state props from parent
  selectedDots3D?: Map<string, number[]>;
  setSelectedDots3D?: (selectedDots: Map<string, number[]>) => void;
  stringCount3D?: 4 | 5 | 6;
  setStringCount3D?: (count: 4 | 5 | 6) => void;
  cameraMode?: 'overview' | 'action';
  setCameraMode?: (mode: 'overview' | 'action') => void;
  maxFrets?: number;
  tiltAngle?: number;
  onMaxFretsChange?: (frets: number) => void;
  onTiltAngleChange?: (angle: number) => void;
  // Exercise-related props
  tutorialData?: any;
  tutorialSlug?: string;
  exercises?: any[];
  selectedExerciseId?: string | null; // Add this prop from parent
  onExerciseSelect?: (exerciseId: string) => void;
}

export const FretboardCard = React.memo(
  function FretboardCard({
    is3DMode = false,
    onToggle3DMode,
    selectedDots3D,
    setSelectedDots3D,
    stringCount3D,
    setStringCount3D,
    cameraMode,
    setCameraMode,
    maxFrets = 25,
    tiltAngle = 35,
    onMaxFretsChange,
    onTiltAngleChange,
    tutorialData,
    tutorialSlug,
    exercises,
    selectedExerciseId,
    onExerciseSelect,
  }: FretboardCardProps) {
    const { correlationId, logger } = useCorrelation('FretboardCard');
    // Find the selected exercise object from the exercises list
    const selectedExercise =
      exercises?.find((ex) => ex.id === selectedExerciseId) || null;

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
            is3DMode={is3DMode}
            onToggle3DMode={onToggle3DMode}
            selectedDots3D={selectedDots3D}
            setSelectedDots3D={setSelectedDots3D}
            stringCount3D={stringCount3D}
            setStringCount3D={setStringCount3D}
            cameraMode={cameraMode}
            setCameraMode={setCameraMode}
            maxFrets={maxFrets}
            tiltAngle={tiltAngle}
            onMaxFretsChange={onMaxFretsChange}
            onTiltAngleChange={onTiltAngleChange}
            tutorialData={tutorialData}
            tutorialSlug={tutorialSlug}
            exercises={exercises}
            selectedExerciseId={selectedExerciseId}
            onExerciseSelect={onExerciseSelect}
          />
        )}
      </SyncedWidget>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to identify what's causing re-renders
    const changes: string[] = [];

    if (prevProps.is3DMode !== nextProps.is3DMode) changes.push('is3DMode');
    if (prevProps.onToggle3DMode !== nextProps.onToggle3DMode)
      changes.push('onToggle3DMode');
    if (prevProps.selectedDots3D !== nextProps.selectedDots3D)
      changes.push('selectedDots3D');
    if (prevProps.setSelectedDots3D !== nextProps.setSelectedDots3D)
      changes.push('setSelectedDots3D');
    if (prevProps.stringCount3D !== nextProps.stringCount3D)
      changes.push('stringCount3D');
    if (prevProps.setStringCount3D !== nextProps.setStringCount3D)
      changes.push('setStringCount3D');
    if (prevProps.cameraMode !== nextProps.cameraMode)
      changes.push('cameraMode');
    if (prevProps.setCameraMode !== nextProps.setCameraMode)
      changes.push('setCameraMode');
    if (prevProps.maxFrets !== nextProps.maxFrets) changes.push('maxFrets');
    if (prevProps.tiltAngle !== nextProps.tiltAngle) changes.push('tiltAngle');
    if (prevProps.onTiltAngleChange !== nextProps.onTiltAngleChange)
      changes.push('onTiltAngleChange');
    if (prevProps.tutorialData !== nextProps.tutorialData)
      changes.push('tutorialData');
    if (prevProps.tutorialSlug !== nextProps.tutorialSlug)
      changes.push('tutorialSlug');
    if (prevProps.exercises !== nextProps.exercises) changes.push('exercises');
    if (prevProps.selectedExerciseId !== nextProps.selectedExerciseId)
      changes.push('selectedExerciseId');
    if (prevProps.onExerciseSelect !== nextProps.onExerciseSelect)
      changes.push('onExerciseSelect');

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
    is3DMode = false,
    onToggle3DMode,
    selectedDots3D,
    setSelectedDots3D,
    stringCount3D,
    setStringCount3D,
    cameraMode,
    setCameraMode,
    maxFrets = 25,
    tiltAngle = 35,
    onMaxFretsChange,
    onTiltAngleChange,
    tutorialData,
    tutorialSlug,
    exercises,
    selectedExerciseId,
    onExerciseSelect,
  }: FretboardCardContentProps & {
    is3DMode?: boolean;
    onToggle3DMode?: () => void;
    selectedDots3D?: Map<string, number[]>;
    setSelectedDots3D?: (selectedDots: Map<string, number[]>) => void;
    stringCount3D?: 4 | 5 | 6;
    setStringCount3D?: (count: 4 | 5 | 6) => void;
    cameraMode?: 'overview' | 'action';
    setCameraMode?: (mode: 'overview' | 'action') => void;
    maxFrets?: number;
    tiltAngle?: number;
    onMaxFretsChange?: (frets: number) => void;
    onTiltAngleChange?: (angle: number) => void;
    tutorialData?: any;
    tutorialSlug?: string;
    exercises?: any[];
    selectedExerciseId?: string | null;
    onExerciseSelect?: (exerciseId: string) => void;
  }) {
    // Enhanced debug logging to track render causes
    fretboardCardRenderCount++;
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
          is3DMode,
          stringCount3D,
          maxFrets,
          tiltAngle,
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
      is3DMode,
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
      is3DMode,
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

    // Scroll container ref for auto-scroll functionality
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });
    const [hasUserScrolled, setHasUserScrolled] = useState(false);

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
          (ex) => ex.id === exerciseId,
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
      if (!hasUserScrolled && scrollContainerRef.current && !is3DMode) {
        scrollContainerRef.current.scrollLeft = 0;
      }
    }, [is3DMode, hasUserScrolled]);

    // Set initial scroll position on mount only
    React.useEffect(() => {
      if (scrollContainerRef.current && !is3DMode) {
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
    // CRITICAL FIX: Don't include currentTime in dependencies to prevent re-renders
    // currentTime changes constantly during playback (up to 60 times per second)
    const fretboardSyncProps = React.useMemo(() => {
      const props = {
        selectedExercise: syncProps.selectedExercise,
        isPlaying: syncProps.isPlaying,
        currentTime: syncProps.currentTime, // Still pass it, but don't depend on it
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
      // REMOVED: syncProps.currentTime - this changes constantly and causes re-renders
      syncProps.tempo,
      syncProps.masterVolume,
      syncProps.sync,
    ]);

    const fretboardConfig = React.useMemo(() => {
      const config = {
        stringCount: sharedStringCount,
        maxFrets: maxFrets,
        tiltAngle: tiltAngle,
      };
      logger.info(
        `🎯 FretboardCard: fretboardConfig memoized for render #${globalRenderCount}`,
        config,
      );
      return config;
    }, [sharedStringCount, maxFrets, tiltAngle]);

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
    const sharedCameraMode = cameraMode || 'overview';
    const sharedSetCameraMode =
      setCameraMode ||
      ((mode: 'overview' | 'action') => {
        logger.info('No setCameraMode provided, mode:', mode);
      });

    // Manual selection tracking hook
    logger.info(
      `🎯 FretboardCard: calling useManualSelectionTracking for render #${globalRenderCount}`,
    );
    const manualSelectionTracking = useManualSelectionTracking();

    // TODO: Fix audio registration - depends on deleted useWidgetSync
    // const audioRegistrationConfig = React.useMemo(
    //   () => ({
    //     widgetId: 'interactive-fretboard',
    //     widgetType: 'fretboard' as const,
    //     displayName: 'Interactive Fretboard Visualization',
    //     audioConfig: {
    //       id: 'interactive-fretboard',
    //       type: 'bass' as const,
    //       volume: 0.8, // Fretboard is primarily visual, lower volume
    //       pan: 0, // Center panning
    //       muted: false,
    //       solo: false,
    //     },
    //     requiresPreciseSync: true, // Fretboard needs precise sync for visual timing
    //     latencyTolerance: 16, // 16ms for 60fps smooth animations
    //     tempoSensitive: true,
    //     volumeSensitive: false, // Fretboard volume is not critical
    //     priority: 3, // Medium priority - visual feedback
    //     canBeSoloed: false, // Fretboard doesn't produce audio directly
    //     canBeMuted: false, // Always show fretboard
    //     autoRegister: false, // Disable auto-register to prevent re-registration loops
    //   }),
    //   [],
    // );

    // Audio registration for global playback synchronization (Story 3.14)
    // const { state: audioState, controls: audioControls } =
    //   useWidgetAudioRegistration(audioRegistrationConfig);

    // Temporary placeholders
    const audioState = { isRegistered: false, hasError: false };
    const audioControls = { register: () => {}, unregister: () => {} };

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
      is3DMode,
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
      triggerNote: fretboard.exercise.triggerNote,
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

    // Auto-scroll during playback to follow current note (only if user hasn't manually scrolled)
    React.useEffect(() => {
      if (
        !is3DMode &&
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
      is3DMode,
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

    return (
      <Card className="bg-transparent border-transparent shadow-none overflow-visible">
        <CardContent className="p-0 overflow-visible">
          {/* Transparent Fretboard Container */}
          <div className="relative">
            {/* Conditional fretboard rendering based on mode */}
            {is3DMode ? (
              /* 3D Mode Fretboard - No zoom container needed */
              <div
                className="flex justify-center items-center mx-auto"
                style={{
                  width: 568, // Full container width
                  height: 290,
                  overflow: 'visible',
                }}
              >
                <div
                  className="flex flex-col items-center py-2"
                  style={{
                    perspective: '1000px',
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <div
                    className="flex flex-col items-center relative"
                    style={{
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <Fretboard3D
                      stringCount={sharedStringCount as 4 | 5 | 6}
                      maxFrets={maxFrets}
                      selectedDots={convertTo3DFormat(
                        sharedSelectedDots,
                        sharedStringCount,
                      )}
                      onDotClick={(stringIndex, fret) => {
                        // Convert 3D format call to standard format for consistency
                        fretboard.handleDotClickWithAudio(stringIndex, fret);
                      }}
                      cameraDistance={7}
                      cameraMode={sharedCameraMode}
                      onCameraModeChange={sharedSetCameraMode}
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* 2D Mode Fretboard - With zoom and horizontal scroll */
              <div
                className="relative mx-auto"
                style={{
                  width: 568, // Full container width // Fixed viewport width
                  height: 290, // Fixed height same as 3D mode
                  overflow: 'visible', // Allow shadows to extend in all directions
                  perspective: '800px', // Add perspective here
                }}
              >
                <div
                  ref={(el) => {
                    scrollContainerRef.current = el;
                    if (el && !is3DMode && !hasUserScrolled) {
                      // Only set to 0 if user hasn't manually scrolled
                      el.scrollLeft = 0;
                    }
                  }}
                  className="overflow-x-auto overflow-y-hidden h-full flex items-center"
                  style={{
                    cursor: isDragging ? 'grabbing' : 'grab',
                    scrollbarWidth: 'none', // Firefox
                    msOverflowStyle: 'none', // IE/Edge
                    transform: `rotateX(${tiltAngle}deg)`, // Apply tilt to scroll container
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'center center',
                  }}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseLeave}
                  onScroll={() => {
                    // Mark that user has scrolled when any scroll event occurs
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
                  <div
                    style={{
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: '0 0', // Start zoom from top-left (open strings position)
                      transition: 'transform 0.2s ease-out',
                    }}
                  >
                    <FretboardGrid
                      stringCount={sharedStringCount}
                      tiltAngle={tiltAngle}
                      frets={fretboard.frets}
                      selectedDots={fretboard.selectedDots}
                      draggedDot={fretboard.state.draggedDot}
                      dragOverTarget={fretboard.state.dragOverTarget}
                      isExerciseNote={fretboard.isExerciseNote}
                      isCurrentNote={fretboard.isCurrentNote}
                      zoomLevel={zoomLevel}
                      onDragStart={(e, stringIndex, fret) => {
                        const orders = fretboard.checkGetDotOrder(
                          stringIndex,
                          fret,
                        );
                        const order = orders.length > 0 ? orders[0] : 0;
                        if (order !== undefined) {
                          fretboard.handleDragStart(stringIndex, fret, order);
                        }
                      }}
                      onDragOver={handleDragOver}
                      onDragEnter={fretboard.handleDragEnter}
                      onDragLeave={fretboard.handleDragLeave}
                      onDrop={(e, targetStringIndex, targetFret) => {
                        dotSelectionHandlers.handleDragDrop(
                          targetStringIndex,
                          targetFret,
                        );
                      }}
                      onDragEnd={fretboard.handleDragEnd}
                      onDotClick={fretboard.handleDotClickWithAudio}
                      onDotSecondSelection={
                        dotSelectionHandlers.handleDotSecondSelection2D
                      }
                      onDotRemoval={dotSelectionHandlers.handleDotRemoval2D}
                      segmentFunctions={fretboard.segmentFunctions}
                      highlightingFunctions={fretboard.highlightingFunctions}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Audio status display */}
            {fretboard.exercise.audioIntegration.audioError && (
              <div className="mt-4 p-2 bg-destructive/10 text-destructive text-sm rounded">
                Audio Error:
                {String(fretboard.exercise.audioIntegration.audioError)}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for React.memo
    // Return true if props are equal (skip re-render), false if different (re-render)

    // Detailed prop change detection
    const changes: string[] = [];

    // Check each prop individually
    if (prevProps.is3DMode !== nextProps.is3DMode) changes.push('is3DMode');
    if (prevProps.selectedDots3D !== nextProps.selectedDots3D)
      changes.push('selectedDots3D');
    if (prevProps.stringCount3D !== nextProps.stringCount3D)
      changes.push('stringCount3D');
    if (prevProps.cameraMode !== nextProps.cameraMode)
      changes.push('cameraMode');
    if (prevProps.maxFrets !== nextProps.maxFrets) changes.push('maxFrets');
    if (prevProps.tiltAngle !== nextProps.tiltAngle) changes.push('tiltAngle');
    if (prevProps.tutorialData !== nextProps.tutorialData)
      changes.push('tutorialData');
    if (prevProps.tutorialSlug !== nextProps.tutorialSlug)
      changes.push('tutorialSlug');
    if (prevProps.exercises !== nextProps.exercises) changes.push('exercises');
    if (prevProps.selectedExerciseId !== nextProps.selectedExerciseId)
      changes.push('selectedExerciseId');
    if (prevProps.onExerciseSelect !== nextProps.onExerciseSelect)
      changes.push('onExerciseSelect');
    if (prevProps.onToggle3DMode !== nextProps.onToggle3DMode)
      changes.push('onToggle3DMode');
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
    // IGNORE currentTime - it changes constantly

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
