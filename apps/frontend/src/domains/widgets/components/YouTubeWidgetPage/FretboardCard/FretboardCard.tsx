'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Clock, Target, Music, CheckCircle, Loader2 } from 'lucide-react';
import { useExerciseSelection } from '../../../hooks/useExerciseSelection';
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
  onExerciseSelect?: (exerciseId: string) => void;
}

export function FretboardCard({
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
  onExerciseSelect,
}: FretboardCardProps) {
  return (
    <SyncedWidget
      widgetId="interactive-fretboard"
      widgetName="Interactive Fretboard"
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
          onExerciseSelect={onExerciseSelect}
        />
      )}
    </SyncedWidget>
  );
}

// Helper function to format duration from milliseconds to mm:ss
function formatDuration(durationMs: number): string {
  const minutes = Math.floor(durationMs / (1000 * 60));
  const seconds = Math.floor((durationMs % (1000 * 60)) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

const difficultyConfig = {
  beginner: {
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    label: 'Beginner',
  },
  intermediate: {
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    label: 'Intermediate',
  },
  advanced: {
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    label: 'Advanced',
  },
} as const;

// Helper function to get difficulty config with fallback
function getDifficultyConfig(difficulty: any) {
  const normalizedDifficulty = difficulty?.toLowerCase();
  if (normalizedDifficulty in difficultyConfig) {
    return difficultyConfig[
      normalizedDifficulty as keyof typeof difficultyConfig
    ];
  }
  // Fallback for unknown difficulties
  return {
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    label: 'Unknown',
  };
}

const renderCount = 0;

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
  onExerciseSelect?: (exerciseId: string) => void;
}) {
  // Zoom state - default to 115%
  const [zoomLevel, setZoomLevel] = useState(1.15);

  // Scroll container ref for auto-scroll functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });
  const [hasUserScrolled, setHasUserScrolled] = useState(false);

  // Exercise selection logic
  const {
    exercises: fallbackExercises,
    isLoading: exerciseLoading,
    error: exerciseError,
    selectExercise,
  } = useExerciseSelection();

  // Prefer prop exercises (from tutorial) over fallback exercises
  const exercisesList =
    exercises && exercises.length > 0 ? exercises : fallbackExercises;

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const handleExerciseSelect = React.useCallback(
    (exerciseId: string) => {
      const exercise = exercisesList.find((ex) => ex.id === exerciseId);
      if (exercise) {
        // Check if this exercise is already selected by comparing with sync state
        const wasAlreadySelected =
          syncProps.selectedExercise?.id === exerciseId;

        // Add a unique selection timestamp to track user clicks
        const timestamp = Date.now();
        const exerciseWithTimestamp = {
          ...exercise,
          _selectionTimestamp: timestamp,
        };

        setSelectedExerciseId(exerciseId);
        selectExercise(exerciseWithTimestamp);
        onExerciseSelect?.(exerciseId);

        // Emit comprehensive sync events to configure all widgets
        syncProps.sync.actions.emitEvent(
          'EXERCISE_CHANGE',
          {
            exercise,
            forceReload: wasAlreadySelected,
            clickTimestamp: timestamp,
          },
          'high',
        );

        // Update tempo for metronome and global controls
        if (exercise.bpm && exercise.bpm > 0) {
          syncProps.sync.actions.emitEvent(
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
          Array.isArray(exercise.chord_progression)
        ) {
          syncProps.sync.actions.emitEvent(
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
        syncProps.sync.actions.emitEvent(
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
    },
    [
      exercisesList,
      syncProps.selectedExercise?.id,
      syncProps.sync.actions,
      selectExercise,
      onExerciseSelect,
    ],
  );

  // Auto-select first exercise when exercises load
  useEffect(() => {
    if (exercisesList.length > 0 && !selectedExerciseId) {
      const firstExercise = exercisesList[0];
      if (firstExercise && firstExercise.id) {
        handleExerciseSelect(firstExercise.id);
      }
    }
  }, [exercisesList.length, selectedExerciseId, handleExerciseSelect]);

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
      console.log('No setSelectedDots3D provided, dots:', dots);
    });
  const sharedStringCount = stringCount3D || 4;

  // Use the main fretboard hook that combines all functionality
  const fretboard = useFretboard(syncProps, {
    stringCount: sharedStringCount,
    maxFrets: maxFrets,
    tiltAngle: tiltAngle,
  });

  const sharedSetStringCount =
    setStringCount3D ||
    ((count: StringCount) => {
      console.log('No setStringCount3D provided, count:', count);
    });
  const sharedCameraMode = cameraMode || 'overview';
  const sharedSetCameraMode =
    setCameraMode ||
    ((mode: 'overview' | 'action') => {
      console.log('No setCameraMode provided, mode:', mode);
    });

  // Manual selection tracking hook
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
  const exerciseLoader = useExerciseLoader({
    syncProps,
    manualSelectionTracking,
    fretboardExercise: fretboard.exercise,
    onExerciseLoad: (exerciseDotsMap) => {
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
    if (
      fretboard.exerciseData.hasExercise &&
      fretboard.exerciseData.exerciseNotes.length > 0 &&
      setSelectedDots3D &&
      !manualSelectionTracking.hasManuallyReset() &&
      !manualSelectionTracking.hasManualSelections()
    ) {
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

  return (
    <Card className="bg-transparent border-transparent shadow-none overflow-visible">
      <CardContent className="p-0 overflow-visible">
        {/* Neumorphic Dark Theme Exercise Panel */}
        <div className="bg-slate-800 rounded-2xl p-6 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 relative">
          {/* Exercise Selector Section with Circular Design */}
          <div className="mb-8">
            <div className="flex items-center justify-center mb-6">
              <div className="relative">
                {/* Outer ring */}
                <div className="w-16 h-16 rounded-full bg-slate-700 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.1)] flex items-center justify-center">
                  {/* Inner circle */}
                  <div className="w-10 h-10 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] flex items-center justify-center">
                    {/* Orange indicator dot */}
                    <div className="w-2 h-2 rounded-full bg-orange-500 shadow-[1px_1px_2px_rgba(0,0,0,0.4)]" />
                  </div>
                </div>
                {/* Title below circle */}
                <div className="text-center mt-4">
                  <h3 className="font-semibold text-sm text-white">
                    Exercise Selector
                  </h3>
                  <p className="text-xs text-slate-400">
                    Choose practice exercise
                  </p>
                </div>
              </div>
            </div>

            {/* Exercise List with Dark Neumorphic Cards */}
            <div className="space-y-3">
              {exerciseLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                  <span className="ml-2 text-xs text-slate-400">
                    Loading...
                  </span>
                </div>
              )}
              {exerciseError && (
                <div className="text-center py-6">
                  <p className="text-xs text-red-400">{exerciseError}</p>
                </div>
              )}
              {!exerciseLoading &&
                !exerciseError &&
                exercisesList
                  .filter((exercise) => exercise?.id && exercise?.title)
                  .map((exercise, index) => (
                    <div
                      key={exercise.id}
                      className={`relative p-4 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedExerciseId === exercise.id
                          ? 'bg-orange-500/20 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.1)] border border-orange-500/30'
                          : 'bg-slate-700/50 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
                      }`}
                      onClick={() => handleExerciseSelect(exercise.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="text-xs font-bold text-orange-400">
                              #{index + 1}
                            </span>
                            <h4 className="font-medium text-sm text-white truncate">
                              {exercise.title}
                            </h4>
                            {selectedExerciseId === exercise.id && (
                              <CheckCircle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                            )}
                          </div>

                          <div className="flex items-center gap-4 text-xs text-slate-400">
                            <div className="flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              <span>{formatDuration(exercise.duration)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Music className="w-3 h-3" />
                              <span>{exercise.bpm} BPM</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span>Key: {exercise.key}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                            getDifficultyConfig(exercise.difficulty).color
                          } shadow-[2px_2px_4px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)]`}
                        >
                          {getDifficultyConfig(exercise.difficulty).label}
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          </div>
        </div>

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
      </CardContent>
    </Card>
  );
}
