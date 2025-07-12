'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
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
        debugMode: true,
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
        />
      )}
    </SyncedWidget>
  );
}

let renderCount = 0;

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
}: FretboardCardContentProps & {
  is3DMode?: boolean;
  onToggle3DMode?: () => void;
  selectedDots3D?: Map<string, number[]>;
  setSelectedDots3D?: (selectedDots: Map<string, number[]>) => void;
  stringCount3D?: 4 | 5 | 6;
  setStringCount3D?: (count: 4 | 5 | 6) => void;
  cameraMode?: 'overview' | 'action';
  setCameraMode?: (mode: 'overview' | 'action') => void;
}) {
  // Zoom state - default to 100%
  const [zoomLevel, setZoomLevel] = useState(1.0);
  
  // Scroll container ref for auto-scroll functionality
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, scrollLeft: 0 });
  const [hasUserScrolled, setHasUserScrolled] = useState(false);
  
  // Debug: Track renders
  renderCount++;
  console.log('🔄 FretboardCardContent RENDER #', renderCount, 'hasUserScrolled:', hasUserScrolled);

  // Only reset scroll to 0 if user hasn't manually scrolled
  React.useEffect(() => {
    if (!hasUserScrolled && scrollContainerRef.current && !is3DMode) {
      console.log('🚨 FORCING SCROLL TO 0 - hasUserScrolled:', hasUserScrolled, 'is3DMode:', is3DMode);
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, [is3DMode, hasUserScrolled]);

  // Set initial scroll position on mount only
  React.useEffect(() => {
    if (scrollContainerRef.current && !is3DMode) {
      console.log('🏠 MOUNT: Setting scroll to 0');
      scrollContainerRef.current.scrollLeft = 0;
    }
  }, []); // Run only on mount
  // Use the main fretboard hook that combines all functionality
  const fretboard = useFretboard(syncProps);

  // Use shared state from parent, with defaults if not provided
  const sharedSelectedDots = selectedDots3D || new Map();
  const sharedSetSelectedDots =
    setSelectedDots3D ||
    ((dots: Map<string, number[]>) => {
      console.log('No setSelectedDots3D provided, dots:', dots);
    });
  const sharedStringCount = stringCount3D || 4;
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
    fretboard.exerciseData.exerciseNotes,
    fretboard.exerciseData.selectedExercise?.id,
    setSelectedDots3D,
    fretboard.exercise.convertExerciseNotesToSelectedDots,
    manualSelectionTracking.hasManuallyReset,
    manualSelectionTracking.hasManualSelections,
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
    if (!is3DMode && !hasUserScrolled && fretboard.exercise.audioIntegration.playbackPosition?.isPlaying) {
      const currentNote = fretboard.exercise.audioIntegration.playbackPosition.currentNote;
      if (currentNote && typeof currentNote.fret === 'number') {
        // Handle open string notes (fret 0) - don't scroll, just ensure we're at position 0
        if (currentNote.fret === 0) {
          if (scrollContainerRef.current && scrollContainerRef.current.scrollLeft > 0) {
            console.log('🎵 AUTO-SCROLL: Scrolling to 0 for open string note');
            scrollContainerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
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
            const fretX = CENTER_OFFSET + FRET_OFFSET + (currentNote.fret - 1) * FRET_SPACING;
            
            // Add some buffer so we scroll before the note goes out of view
            const buffer = 100;
            if (fretX < currentViewStart + buffer || fretX > currentViewEnd - buffer) {
              console.log('🎵 AUTO-SCROLL: Scrolling to fret', currentNote.fret);
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
    console.log('🐆 USER DRAG: Setting hasUserScrolled to true, scroll position:', scrollContainerRef.current.scrollLeft);
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
        {/* Unified Neumorphic Hero Panel */}
        <div className="bg-slate-800 rounded-2xl p-4 mb-4 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 relative">
          
          {/* 3D Mode Toggle Button - Top Right Corner (16px from edges) */}
          <button
            onClick={onToggle3DMode}
            className={`absolute top-4 right-4 px-4 py-2 rounded-full text-sm font-bold transition-all duration-200 z-10 text-black ${
              is3DMode
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
                : 'bg-gradient-to-r from-yellow-400 to-orange-500 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
            } hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-1px_-1px_3px_rgba(255,255,255,0.1)]`}
          >
            {is3DMode ? '2D Mode' : '3D Mode'}
          </button>
          
          {/* Header Section */}
          <div className="flex items-center justify-between mb-4">
            {/* Left Side - Sync Status & Title */}
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full shadow-[1px_1px_2px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)] ${
                  syncProps.isConnected ? 'bg-green-400' : 'bg-red-400'
                }`}
                role="img"
                aria-label={syncProps.isConnected ? 'Widget synchronized' : 'Widget sync error'}
                title={syncProps.isConnected ? 'Synced' : 'Sync error'}
              />
              <div>
                <h3 className="font-semibold text-sm text-white">
                  🎸 Interactive Fretboard
                </h3>
                <p className="text-xs text-slate-400">
                  {syncStatus} • {fretboard.checkHasSelectedDots() ? 'Notes Selected' : 'Ready'}
                </p>
              </div>
            </div>

            {/* Center - Playback Status */}
            {fretboard.exercise.audioIntegration.playbackPosition?.isPlaying && 
             fretboard.exercise.audioIntegration.playbackPosition.currentNote && (
              <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/20 rounded-lg border border-blue-500/30">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <div className="text-sm text-blue-300">
                  <span className="font-medium">
                    {fretboard.exercise.audioIntegration.playbackPosition.currentNote.note}
                    {fretboard.exercise.audioIntegration.playbackPosition.currentNote.octave}
                  </span>
                  <span className="ml-2 text-xs">
                    {Math.round(fretboard.exercise.audioIntegration.playbackPosition.progress * 100)}%
                  </span>
                </div>
              </div>
            )}

            {/* Right Side - Empty for 3D Mode Button positioning */}
            <div></div>
          </div>


          {/* Mode Controls Section */}
          <div className="flex items-center justify-between">
            {/* String Count Controls */}
            <div className="flex items-center gap-2">
              {[4, 5, 6].map((count) => (
                <button
                  key={count}
                  onClick={() => {
                    // Update both shared state and fretboard internal state
                    stringCountHandlers.handleStringCountChangeWithValidation(count as 4 | 5 | 6);
                    fretboard.state.handleStringCountChange(count as 4 | 5 | 6);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                    sharedStringCount === count
                      ? 'bg-blue-500 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                      : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                  }`}
                >
                  {count} String
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {fretboard.checkHasSelectedDots() && (
                <button
                  onClick={dotSelectionHandlers.handleUnifiedReset}
                  className="px-3 py-1 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/30 transition-all duration-200 border border-red-500/30"
                >
                  Reset
                </button>
              )}
              
              {is3DMode ? (
                /* 3D Mode: Camera Controls */
                <>
                  <button
                    onClick={() => sharedSetCameraMode('overview')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      sharedCameraMode === 'overview'
                        ? 'bg-slate-700 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => sharedSetCameraMode('action')}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      sharedCameraMode === 'action'
                        ? 'bg-slate-700 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                    }`}
                  >
                    Action
                  </button>
                </>
              ) : (
                /* 2D Mode: Tilt Controls */
                <>
                  <button
                    onClick={() => fretboard.handleTiltAngleChange(35)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      fretboard.tiltAngle === 35
                        ? 'bg-slate-700 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                    }`}
                  >
                    Default
                  </button>
                  <button
                    onClick={() => fretboard.handleTiltAngleChange(0)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium transition-all duration-200 ${
                      fretboard.tiltAngle === 0
                        ? 'bg-slate-700 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                        : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600/50'
                    }`}
                  >
                    Flat
                  </button>
                </>
              )}
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
                  stringCount={sharedStringCount as 4 | 5}
                  selectedDots={convertTo3DFormat(
                    sharedSelectedDots,
                    sharedStringCount,
                  )}
                  onDotClick={dotSelectionHandlers.handleDotClick3D}
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
              height: (sharedStringCount === 4 ? 200 : sharedStringCount === 5 ? 240 : 290) * zoomLevel,
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
                  console.log('🔍 REF: Set scroll to 0, hasUserScrolled:', hasUserScrolled);
                } else if (el && hasUserScrolled) {
                  console.log('🔍 REF: User has scrolled, NOT resetting position. Current:', el.scrollLeft);
                }
              }}
              className="overflow-x-auto overflow-y-hidden h-full"
              style={{
                cursor: isDragging ? 'grabbing' : 'grab',
                scrollbarWidth: 'none', // Firefox
                msOverflowStyle: 'none', // IE/Edge
                transform: `rotateX(${fretboard.tiltAngle}deg)`, // Apply tilt to scroll container
                transformStyle: 'preserve-3d',
                transformOrigin: 'center center',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onScroll={() => {
                // Mark that user has scrolled when any scroll event occurs
                if (scrollContainerRef.current && scrollContainerRef.current.scrollLeft > 0) {
                  console.log('📋 SCROLL EVENT: Position', scrollContainerRef.current.scrollLeft, 'setting hasUserScrolled to true');
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
              tiltAngle={fretboard.tiltAngle}
              frets={fretboard.frets}
              selectedDots={fretboard.selectedDots}
              draggedDot={fretboard.state.draggedDot}
              dragOverTarget={fretboard.state.dragOverTarget}
              isExerciseNote={fretboard.isExerciseNote}
              isCurrentNote={fretboard.isCurrentNote}
              onDragStart={(e, stringIndex, fret) => {
                const orders = fretboard.checkGetDotOrder(stringIndex, fret);
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
              onDotClick={dotSelectionHandlers.handleDotClick2D}
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
