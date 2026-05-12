'use client';

import React, { useState, useRef, useCallback, useMemo } from 'react';
import type { Exercise, TimeSignature } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useLoopStripSync } from '@/domains/widgets/hooks/useBeatGridSync';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';

export interface LoopRegion {
  startMeasure: number;
  endMeasure: number;
  startBeat?: number; // 1-based beat within start measure
  endBeat?: number; // 1-based beat within end measure
}

export interface LoopGridStripProps {
  exercise?: Exercise;
  currentTime: number; // Current playback time in seconds
  duration: number; // Total exercise duration in seconds
  loopRegion?: LoopRegion | null; // Current loop region (controlled)
  onLoopRegionChange: (region: LoopRegion | null) => void;
  onSeek?: (position: number) => void; // Seek to position in seconds
  className?: string;
  /** Current tempo from transport - use this instead of exercise.bpm for accurate timing when user changes tempo */
  currentTempo?: number;
}

export interface MeasureData {
  index: number;
  startTime: number; // Start time in seconds
  endTime: number; // End time in seconds
  width: number; // Width as percentage of container
}

export function LoopGridStrip({
  exercise,
  currentTime,
  duration,
  loopRegion: loopRegionProp,
  onLoopRegionChange,
  onSeek,
  className = '',
  currentTempo,
}: LoopGridStripProps) {
  const { logger } = useCorrelation('LoopGridStrip');
  // Use prop value for loopRegion (controlled component)
  const loopRegion = loopRegionProp || null;
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragType, setDragType] = useState<
    'select' | 'resize-start' | 'resize-end' | 'move-region' | null
  >(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const lastUpdateRef = useRef<LoopRegion | null>(null);

  // Get beats per measure from exercise
  const beatsPerMeasure = exercise?.timeSignature?.numerator || 4;

  // Get transport controls (stable - no position re-renders)
  const transport = useTransportControls();
  const isPlaying = transport.isPlaying;

  // Calculate total beats for the loop strip
  const totalMeasures = exercise?.total_bars || 4;
  const totalBeats = totalMeasures * beatsPerMeasure;

  // 🚀 JITTER FIX: Direct DOM beat synchronization (bypasses React state)
  // This hook subscribes directly to AtomicPlaybackClock and updates DOM via classList.toggle()
  // instead of React state, eliminating jitter from React's batched updates.
  const { registerBeatIndicator } = useLoopStripSync({
    totalBeats,
    beatsPerMeasure,
    isPlaying,
    playedClass: 'bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.9)]',
    unplayedClass: 'bg-slate-500 shadow-[0_0_1px_rgba(0,0,0,0.8)]',
    isVisible: true,
  });

  // Helper to check if two regions are equal
  const areRegionsEqual = (
    a: LoopRegion | null,
    b: LoopRegion | null,
  ): boolean => {
    if (!a || !b) return a === b;
    return (
      a.startMeasure === b.startMeasure &&
      a.endMeasure === b.endMeasure &&
      (a.startBeat || 1) === (b.startBeat || 1) &&
      (a.endBeat || beatsPerMeasure) === (b.endBeat || beatsPerMeasure)
    );
  };

  // Calculate measures based on exercise metadata
  const measures = useMemo((): MeasureData[] => {
    if (!exercise) {
      // Default to 4 measures if no exercise
      const measureDuration = duration > 0 ? duration / 4000 : 1; // Convert ms to seconds
      return Array.from({ length: 4 }, (_, i) => ({
        index: i + 1,
        startTime: i * measureDuration,
        endTime: (i + 1) * measureDuration,
        width: 25, // 100% / 4 measures
      }));
    }

    // Get exercise metadata
    const timeSignature: TimeSignature = exercise.timeSignature || {
      numerator: 4,
      denominator: 4,
    };
    // TEMPO FIX: Use currentTempo (from transport) if provided, otherwise fall back to exercise.bpm
    // This ensures the loop strip updates when user changes tempo via slider
    const bpm = currentTempo || exercise.bpm || 120;
    const beatsPerMeasure = timeSignature.numerator;

    // Use total_bars directly (primary field - musicians think in bars!)
    const totalMeasures = exercise.total_bars || 4; // Default to 4 bars if not set

    // Calculate measure duration for timeline
    const beatsPerSecond = bpm / 60;
    const measureDurationInSeconds = beatsPerMeasure / beatsPerSecond;
    const measureWidth = 100 / totalMeasures; // Percentage width per measure

    return Array.from({ length: totalMeasures }, (_, i) => ({
      index: i + 1,
      startTime: i * measureDurationInSeconds,
      endTime: (i + 1) * measureDurationInSeconds,
      width: measureWidth,
    }));
  }, [
    exercise?.id,
    exercise?.total_bars,
    exercise?.bpm,
    exercise?.timeSignature,
    duration,
    currentTempo, // TEMPO FIX: Recalculate when tempo changes
  ]);

  // Calculate measure and beat from mouse position (discrete incremental)
  const getMeasureAndBeatFromPosition = useCallback(
    (clientX: number): { measure: number; beat: number } => {
      if (!stripRef.current) return { measure: 1, beat: 1 };

      const rect = stripRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, relativeX / rect.width));

      // Calculate which measure we're in (discrete/incremental)
      const totalBeats = measures.length * beatsPerMeasure;
      const beatPosition = percentage * totalBeats;
      const measure = Math.floor(beatPosition / beatsPerMeasure) + 1;
      const beat = Math.floor(beatPosition % beatsPerMeasure) + 1;

      return {
        measure: Math.max(1, Math.min(measures.length, measure)),
        beat: Math.max(1, Math.min(beatsPerMeasure, beat)),
      };
    },
    [measures.length, beatsPerMeasure],
  );

  // NOTE: playbackBeatPosition calculation removed - now using direct DOM via useLoopStripSync
  // The hook subscribes to AtomicPlaybackClock and updates beat indicators directly via classList.toggle()

  // Handle measure click
  const handleMeasureClick = useCallback(
    (measureIndex: number, event: React.MouseEvent) => {
      event.preventDefault();

      // If Alt/Cmd is held and onSeek is provided, seek to this position
      if ((event.altKey || event.metaKey) && onSeek) {
        const measure = measures[measureIndex - 1];
        if (measure) {
          onSeek(measure.startTime);
          logger.info(
            `🎵 Seeking to measure ${measureIndex} at ${measure.startTime}s`,
          );
        }
        return;
      }

      // Check if clicking on already selected measure(s) - clear if so
      if (
        loopRegion &&
        measureIndex >= loopRegion.startMeasure &&
        measureIndex <= loopRegion.endMeasure
      ) {
        // Clear selection
        onLoopRegionChange(null);
      } else {
        // Single measure selection
        const newRegion: LoopRegion = {
          startMeasure: measureIndex,
          endMeasure: measureIndex,
          startBeat: 1,
          endBeat: beatsPerMeasure,
        };
        onLoopRegionChange(newRegion);
      }
    },
    [loopRegion, onLoopRegionChange, beatsPerMeasure, onSeek, measures],
  );

  // Handle resize start
  const handleResizeStart = useCallback(
    (type: 'resize-start' | 'resize-end', event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragging(true);
      setDragType(type);
    },
    [],
  );

  // Handle region interaction (click to clear, drag to move)
  const handleRegionInteraction = useCallback(
    (event: React.MouseEvent) => {
      if (!loopRegion) return;

      event.preventDefault();
      event.stopPropagation();

      const rect = stripRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Store initial mouse position and time to differentiate click vs drag
      const startX = event.clientX;
      const startTime = Date.now();

      // Calculate the offset from the start of the region to the mouse position
      const relativeX = event.clientX - rect.left;
      const percentage = relativeX / rect.width;
      const totalBeats = measures.length * beatsPerMeasure;
      const clickBeatPosition = percentage * totalBeats;
      const regionStartBeat =
        (loopRegion.startMeasure - 1) * beatsPerMeasure +
        (loopRegion.startBeat || 1) -
        1;

      setDragOffset(clickBeatPosition - regionStartBeat);
      setIsDragging(true);
      setDragType('move-region');

      // Set up mouse up handler to detect click vs drag
      const handleMouseUp = (upEvent: MouseEvent) => {
        const endTime = Date.now();
        const deltaX = Math.abs(upEvent.clientX - startX);
        const deltaTime = endTime - startTime;

        // If it was a short click without much movement, clear the region
        if (deltaTime < 200 && deltaX < 5) {
          onLoopRegionChange(null);
        }

        // Clean up
        setIsDragging(false);
        setDragType(null);
        setDragOffset(0);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mouseup', handleMouseUp);
    },
    [loopRegion, measures.length, beatsPerMeasure, onLoopRegionChange],
  );

  // Handle resize drag (back to discrete incremental behavior)
  const handleResizeDrag = useCallback(
    (clientX: number) => {
      if (!loopRegion) return;

      if (dragType?.includes('resize')) {
        const { measure, beat } = getMeasureAndBeatFromPosition(clientX);

        if (dragType === 'resize-start') {
          // Resizing from start - ensure we don't go past the end
          const endPosition =
            (loopRegion.endMeasure - 1) * beatsPerMeasure +
            (loopRegion.endBeat || beatsPerMeasure);
          const newStartPosition = (measure - 1) * beatsPerMeasure + beat;

          if (newStartPosition <= endPosition) {
            const newRegion: LoopRegion = {
              startMeasure: measure,
              startBeat: beat,
              endMeasure: loopRegion.endMeasure,
              endBeat: loopRegion.endBeat || beatsPerMeasure,
            };
            // Only update if actually changed
            if (!areRegionsEqual(newRegion, lastUpdateRef.current)) {
              lastUpdateRef.current = newRegion;
              onLoopRegionChange(newRegion);
            }
          }
        } else if (dragType === 'resize-end') {
          // Resizing from end - ensure we don't go before the start
          const startPosition =
            (loopRegion.startMeasure - 1) * beatsPerMeasure +
            (loopRegion.startBeat || 1);
          const newEndPosition = (measure - 1) * beatsPerMeasure + beat;

          if (newEndPosition >= startPosition) {
            const newRegion: LoopRegion = {
              startMeasure: loopRegion.startMeasure,
              startBeat: loopRegion.startBeat || 1,
              endMeasure: measure,
              endBeat: beat,
            };
            // Only update if actually changed
            if (!areRegionsEqual(newRegion, lastUpdateRef.current)) {
              lastUpdateRef.current = newRegion;
              onLoopRegionChange(newRegion);
            }
          }
        }
      } else if (dragType === 'move-region') {
        // Moving the entire region
        const rect = stripRef.current?.getBoundingClientRect();
        if (!rect) return;

        const relativeX = clientX - rect.left;
        const percentage = relativeX / rect.width;
        const totalBeats = measures.length * beatsPerMeasure;
        const mouseBeatPosition = percentage * totalBeats;

        // Calculate new start position accounting for drag offset
        const newStartBeatPosition = mouseBeatPosition - dragOffset;
        const regionLength =
          (loopRegion.endMeasure - loopRegion.startMeasure) * beatsPerMeasure +
          (loopRegion.endBeat || beatsPerMeasure) -
          (loopRegion.startBeat || 1) +
          1;

        // Ensure region stays within bounds
        const clampedStartBeat = Math.max(
          0,
          Math.min(totalBeats - regionLength, newStartBeatPosition),
        );
        const clampedEndBeat = clampedStartBeat + regionLength - 1;

        // Convert back to measure.beat format
        const newStartMeasure =
          Math.floor(clampedStartBeat / beatsPerMeasure) + 1;
        const newStartBeat = Math.floor(clampedStartBeat % beatsPerMeasure) + 1;
        const newEndMeasure = Math.floor(clampedEndBeat / beatsPerMeasure) + 1;
        const newEndBeat = Math.floor(clampedEndBeat % beatsPerMeasure) + 1;

        const newRegion: LoopRegion = {
          startMeasure: newStartMeasure,
          startBeat: newStartBeat,
          endMeasure: newEndMeasure,
          endBeat: newEndBeat,
        };

        // Only update if actually changed
        if (!areRegionsEqual(newRegion, lastUpdateRef.current)) {
          lastUpdateRef.current = newRegion;
          onLoopRegionChange(newRegion);
        }
      }
    },
    [
      loopRegion,
      dragType,
      getMeasureAndBeatFromPosition,
      beatsPerMeasure,
      dragOffset,
      measures.length,
      onLoopRegionChange,
      areRegionsEqual,
    ],
  );

  // Handle selection drag start
  const handleSelectionDragStart = useCallback(
    (measureIndex: number, event: React.MouseEvent) => {
      event.preventDefault();
      setIsDragging(true);
      setDragStart(measureIndex);
      setDragType('select');
    },
    [],
  );

  // Handle drag over
  const handleDragOver = useCallback(
    (measureIndex: number) => {
      if (!isDragging) return;

      if (dragType === 'select' && dragStart !== null) {
        // Creating new selection
        const newRegion: LoopRegion = {
          startMeasure: Math.min(dragStart, measureIndex),
          endMeasure: Math.max(dragStart, measureIndex),
        };
        onLoopRegionChange(newRegion);
      } else if (dragType === 'resize-start' && loopRegion) {
        // Resizing from start
        const newRegion: LoopRegion = {
          startMeasure: Math.min(measureIndex, loopRegion.endMeasure),
          endMeasure: loopRegion.endMeasure,
        };
        onLoopRegionChange(newRegion);
      } else if (dragType === 'resize-end' && loopRegion) {
        // Resizing from end
        const newRegion: LoopRegion = {
          startMeasure: loopRegion.startMeasure,
          endMeasure: Math.max(measureIndex, loopRegion.startMeasure),
        };
        onLoopRegionChange(newRegion);
      }
    },
    [isDragging, dragType, dragStart, loopRegion, onLoopRegionChange],
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (isDragging && loopRegion) {
      onLoopRegionChange(loopRegion);
    }
    setIsDragging(false);
    setDragStart(null);
    setDragType(null);
    setDragOffset(0);
    lastUpdateRef.current = null; // Reset last update tracking
  }, [isDragging, loopRegion, onLoopRegionChange]);

  // Check if measure is selected (with beat-level precision)
  const isMeasureSelected = useCallback(
    (measureIndex: number): boolean => {
      if (!loopRegion) return false;

      // Calculate the start and end positions in beats
      const selectionStartBeat =
        (loopRegion.startMeasure - 1) * beatsPerMeasure +
        (loopRegion.startBeat || 1);
      const selectionEndBeat =
        (loopRegion.endMeasure - 1) * beatsPerMeasure +
        (loopRegion.endBeat || beatsPerMeasure);

      // Calculate this measure's beat range
      const measureStartBeat = (measureIndex - 1) * beatsPerMeasure + 1;
      const measureEndBeat = measureIndex * beatsPerMeasure;

      // Check if there's any overlap
      return !(
        measureEndBeat < selectionStartBeat ||
        measureStartBeat > selectionEndBeat
      );
    },
    [loopRegion, beatsPerMeasure],
  );

  // Global event listeners for dragging
  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      e.preventDefault();
      if (dragType?.includes('resize') || dragType === 'move-region') {
        handleResizeDrag(e.clientX);
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (
        (dragType?.includes('resize') || dragType === 'move-region') &&
        e.touches[0]
      ) {
        handleResizeDrag(e.touches[0].clientX);
      }
    };

    const handleMouseUp = () => {
      handleDragEnd();
    };

    const handleTouchEnd = () => {
      handleDragEnd();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, handleDragEnd, dragType, handleResizeDrag]);

  return (
    <div className={`relative w-full ${className}`}>
      {/* Container with padding for neumorphic shadows */}
      <div className="p-1">
        {/* Grid Strip - Enhanced neumorphic styling */}
        <div
          ref={stripRef}
          className="relative h-8 bg-slate-800 rounded-lg shadow-[3px_3px_6px_rgba(0,0,0,0.4),-1px_-1px_3px_rgba(255,255,255,0.03)] border border-slate-600/20 overflow-hidden"
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
        >
          {/* Measures */}
          <div className="absolute inset-0 flex">
            {measures.map((measure) => (
              <div
                key={measure.index}
                className={`relative border-r border-slate-600/30 cursor-pointer transition-all duration-150 select-none hover:bg-slate-600/20`}
                style={{ width: `${measure.width}%` }}
                title={
                  onSeek
                    ? `Click to set loop region. Alt/Cmd+Click to seek to measure ${measure.index}`
                    : `Click to set loop region`
                }
                onClick={(e) => handleMeasureClick(measure.index, e)}
                onMouseDown={(e) => handleSelectionDragStart(measure.index, e)}
                onMouseEnter={() => handleDragOver(measure.index)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  if (!touch) return;
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  handleSelectionDragStart(measure.index, mouseEvent as any);
                }}
              >
                {/* Measure number */}
                <div className="absolute top-1 left-1 text-xs text-slate-300 font-mono leading-none drop-shadow-sm">
                  {measure.index}
                </div>

                {/* Beat indicators with selection highlighting */}
                {/* 🚀 JITTER FIX: Direct DOM beat indicators via ref registration */}
                {/* The hook's classList.toggle() updates these divs directly, bypassing React */}
                <div className="absolute bottom-1 left-0 right-0 flex justify-evenly">
                  {Array.from({ length: beatsPerMeasure }, (_, i) => {
                    const beatNumber = i + 1;
                    const currentBeatPosition =
                      (measure.index - 1) * beatsPerMeasure + beatNumber;
                    const selectionStartBeat = loopRegion
                      ? (loopRegion.startMeasure - 1) * beatsPerMeasure +
                        (loopRegion.startBeat || 1)
                      : 0;
                    const selectionEndBeat = loopRegion
                      ? (loopRegion.endMeasure - 1) * beatsPerMeasure +
                        (loopRegion.endBeat || beatsPerMeasure)
                      : 0;
                    const isBeatSelected =
                      loopRegion &&
                      currentBeatPosition >= selectionStartBeat &&
                      currentBeatPosition <= selectionEndBeat;

                    // Selection highlighting (blue) is still React-based since it doesn't need
                    // real-time updates. The playback trail (yellow) is now direct DOM via hook.
                    return (
                      <div
                        key={i}
                        ref={(el) => registerBeatIndicator(measure.index, beatNumber, el)}
                        className={`w-1 h-1 rounded-full transition-colors duration-150 ${
                          isBeatSelected
                            ? 'bg-blue-400 shadow-[0_0_4px_rgba(59,130,246,0.9)]'
                            : 'bg-slate-500 shadow-[0_0_1px_rgba(0,0,0,0.8)]'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Loop Region Overlay */}
          {loopRegion && (
            <>
              {/* Background overlay positioned exactly between handles - draggable */}
              <div
                className="absolute top-0 bottom-0 bg-blue-400/20 border-l-2 border-r-2 border-blue-400 cursor-move hover:bg-blue-400/30 z-5 transition-all duration-150"
                onMouseDown={handleRegionInteraction}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  if (!touch) return;
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  handleRegionInteraction(mouseEvent as any);
                }}
                style={(() => {
                  // Calculate exact handle positions
                  const startBeatPosition =
                    (loopRegion.startMeasure - 1) * beatsPerMeasure +
                    (loopRegion.startBeat || 1) -
                    1;
                  const endBeatPosition =
                    (loopRegion.endMeasure - 1) * beatsPerMeasure +
                    (loopRegion.endBeat || beatsPerMeasure) -
                    1;
                  const totalBeats = measures.length * beatsPerMeasure;

                  // Position overlay exactly where handles are
                  const leftPercent = (startBeatPosition / totalBeats) * 100;
                  const rightPercent =
                    ((endBeatPosition + 1) / totalBeats) * 100;
                  const widthPercent = rightPercent - leftPercent;

                  return {
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                  };
                })()}
              />

              {/* Left resize handle */}
              <div
                className="absolute top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize hover:bg-blue-400 transition-colors duration-150 z-10 flex items-center justify-center"
                style={(() => {
                  // Use exact same calculation as overlay
                  const startBeatPosition =
                    (loopRegion.startMeasure - 1) * beatsPerMeasure +
                    (loopRegion.startBeat || 1) -
                    1;
                  const totalBeats = measures.length * beatsPerMeasure;
                  const leftPercent = (startBeatPosition / totalBeats) * 100;

                  return {
                    left: `${leftPercent}%`,
                    transform: 'translateX(-50%)',
                  };
                })()}
                onMouseDown={(e) => handleResizeStart('resize-start', e)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  if (!touch) return;
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  handleResizeStart('resize-start', mouseEvent as any);
                }}
              >
                <div className="w-0.5 h-4 bg-white rounded-full opacity-60" />
              </div>

              {/* Right resize handle */}
              <div
                className="absolute top-0 bottom-0 w-2 bg-blue-500 cursor-ew-resize hover:bg-blue-400 transition-colors duration-150 z-10 flex items-center justify-center"
                style={(() => {
                  // Use exact same calculation as overlay (end position)
                  const endBeatPosition =
                    (loopRegion.endMeasure - 1) * beatsPerMeasure +
                    (loopRegion.endBeat || beatsPerMeasure);
                  const totalBeats = measures.length * beatsPerMeasure;
                  const rightPercent = (endBeatPosition / totalBeats) * 100;

                  return {
                    left: `${rightPercent}%`,
                    transform: 'translateX(-50%)',
                  };
                })()}
                onMouseDown={(e) => handleResizeStart('resize-end', e)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  const touch = e.touches[0];
                  if (!touch) return;
                  const mouseEvent = new MouseEvent('mousedown', {
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  });
                  handleResizeStart('resize-end', mouseEvent as any);
                }}
              >
                <div className="w-0.5 h-4 bg-white rounded-full opacity-60" />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
