'use client';

/**
 * DrumGrid Component
 *
 * The main grid view containing all drum lanes.
 * Handles scrolling, zoom, and coordinates lane rendering.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { DrumLaneRow } from './DrumLaneRow.js';
import type { DrumGridProps, MusicalPosition, MidiDrumType, DrumLaneConfig } from './types.js';
import {
  useDrumEditorStore,
  selectTotalColumns,
} from './hooks/useDrumEditorStore.js';
import { CELL_DIMENSIONS, RESOLUTION_TO_CELLS_PER_BEAT, ZOOM_LIMITS } from './constants.js';
import { tickToColumn } from './utils/gridPositionUtils.js';

/**
 * Calculate distance between two touch points (for mobile touch screens)
 */
function getTouchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * GestureEvent type for Safari/WebKit gesture events
 */
interface GestureEvent extends UIEvent {
  scale: number;
  rotation: number;
}

/**
 * Generate time markers (measure numbers and beat indicators)
 * Now renders inside the scrollable area so it scrolls with the grid horizontally
 */
function TimeMarkers({
  totalColumns,
  resolution,
  timeSignature,
  zoomLevel,
}: {
  totalColumns: number;
  resolution: DrumGridProps['resolution'];
  timeSignature: { numerator: number; denominator: number };
  zoomLevel: number;
}) {
  const cellsPerBeat = RESOLUTION_TO_CELLS_PER_BEAT[resolution];
  const cellsPerMeasure = timeSignature.numerator * cellsPerBeat;

  const cellWidth = Math.max(
    CELL_DIMENSIONS.minWidth,
    Math.min(CELL_DIMENSIONS.maxWidth, CELL_DIMENSIONS.minWidth * zoomLevel * 1.5)
  );

  const markers = useMemo(() => {
    const result: { col: number; label: string; isMeasure: boolean }[] = [];

    for (let col = 0; col < totalColumns; col++) {
      const isMeasureStart = col % cellsPerMeasure === 0;
      const isBeatStart = col % cellsPerBeat === 0;

      if (isMeasureStart) {
        const measureNum = Math.floor(col / cellsPerMeasure) + 1;
        result.push({ col, label: `${measureNum}`, isMeasure: true });
      } else if (isBeatStart) {
        const beatInMeasure = Math.floor((col % cellsPerMeasure) / cellsPerBeat) + 1;
        result.push({ col, label: `.${beatInMeasure}`, isMeasure: false });
      }
    }

    return result;
  }, [totalColumns, cellsPerMeasure, cellsPerBeat]);

  return (
    <div
      className="flex bg-zinc-950 border-b border-zinc-700 sticky top-0 z-10"
      style={{ minWidth: `${CELL_DIMENSIONS.laneHeaderWidth + totalColumns * cellWidth}px` }}
    >
      {/* Sticky lane header spacer - stays fixed during horizontal scroll */}
      <div
        className="bg-zinc-950 border-r border-zinc-700 sticky left-0 z-20 shrink-0"
        style={{
          width: `${CELL_DIMENSIONS.laneHeaderWidth}px`,
          height: '24px',
        }}
      />
      {/* Time markers - scroll horizontally with the grid */}
      <div className="flex relative" style={{ width: `${totalColumns * cellWidth}px` }}>
        {markers.map((marker) => (
          <div
            key={marker.col}
            className={`flex items-center justify-start ${
              marker.isMeasure ? 'text-zinc-300 font-medium' : 'text-zinc-500'
            }`}
            style={{
              position: 'absolute',
              left: `${marker.col * cellWidth}px`,
              width: `${marker.isMeasure ? cellsPerBeat * cellWidth : cellWidth}px`,
              height: '24px',
              fontSize: marker.isMeasure ? '12px' : '10px',
              paddingLeft: '4px',
            }}
          >
            {marker.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * DrumGrid Component
 */
export function DrumGrid({
  bars,
  resolution,
  timeSignature,
  zoomLevel,
  snapEnabled: _snapEnabled,
  playheadTick,
  onPreviewHit,
}: DrumGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialPinchDistanceRef = useRef<number | null>(null);
  const initialZoomRef = useRef<number>(zoomLevel);

  // Store selectors - only select data, not actions
  // Use useShallow for array/object comparisons to prevent infinite loops
  const pattern = useDrumEditorStore(useShallow((state) => state.pattern));
  const selectedHitIds = useDrumEditorStore(useShallow((state) => state.selectedHitIds));
  // Get lanes and visibleLanes separately to avoid filter() creating new refs
  const lanes = useDrumEditorStore(useShallow((state) => state.lanes));
  const visibleLaneIds = useDrumEditorStore(useShallow((state) => state.visibleLanes));

  // Compute visible lane configs in useMemo to avoid re-filtering on every render
  const visibleLanes = useMemo<DrumLaneConfig[]>(
    () => lanes.filter((lane: DrumLaneConfig) => visibleLaneIds.includes(lane.drum)),
    [lanes, visibleLaneIds]
  );

  // Calculate total columns
  const totalColumns = useMemo(
    () => selectTotalColumns({ bars, gridResolution: resolution, timeSignature } as any),
    [bars, resolution, timeSignature]
  );

  // Calculate playhead column from tick
  const playheadColumn = useMemo(
    () => tickToColumn(playheadTick, resolution, timeSignature),
    [playheadTick, resolution, timeSignature]
  );

  // Group hits by drum type for efficient lookup
  const hitsByDrum = useMemo(() => {
    const map = new Map<MidiDrumType, typeof pattern>();
    pattern.forEach((hit) => {
      const existing = map.get(hit.drum) || [];
      existing.push(hit);
      map.set(hit.drum, existing);
    });
    return map;
  }, [pattern]);

  // Handle cell click - toggle hit (use getState() for stable reference)
  const handleCellClick = useCallback(
    (drum: MidiDrumType, position: MusicalPosition) => {
      useDrumEditorStore.getState().toggleHit(drum, position);
    },
    []
  );

  // Handle cell right-click - select or delete (use getState() for stable reference)
  const handleCellRightClick = useCallback(
    (hitId: string | null, _position: MusicalPosition) => {
      if (hitId) {
        const store = useDrumEditorStore.getState();
        // If there's a hit, select it (or remove if already selected)
        if (selectedHitIds.includes(hitId)) {
          store.removeHit(hitId);
        } else {
          store.selectHit(hitId);
        }
      }
    },
    [selectedHitIds]
  );

  // Pinch-to-zoom gesture handling
  // Supports: MacBook trackpad, Windows trackpad, and mobile touch screens
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Trackpad pinch (MacBook, Windows laptops) - fires wheel events with ctrlKey: true
    const handleWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;

      e.preventDefault();
      e.stopPropagation();

      const sensitivity = 0.005;
      const delta = -e.deltaY * sensitivity;
      const currentZoom = useDrumEditorStore.getState().zoomLevel;
      const newZoom = Math.max(
        ZOOM_LIMITS.min,
        Math.min(ZOOM_LIMITS.max, currentZoom * (1 + delta))
      );

      useDrumEditorStore.getState().setZoomLevel(newZoom);
    };

    // Safari/WebKit gesture events (more precise on Safari)
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
      initialZoomRef.current = useDrumEditorStore.getState().zoomLevel;
    };

    const handleGestureChange = (e: Event) => {
      e.preventDefault();
      const gestureEvent = e as GestureEvent;
      const newZoom = Math.max(
        ZOOM_LIMITS.min,
        Math.min(ZOOM_LIMITS.max, initialZoomRef.current * gestureEvent.scale)
      );
      useDrumEditorStore.getState().setZoomLevel(newZoom);
    };

    const handleGestureEnd = (e: Event) => {
      e.preventDefault();
    };

    // Touch screen pinch (mobile devices)
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2 && e.touches[0] && e.touches[1]) {
        initialPinchDistanceRef.current = getTouchDistance(e.touches[0], e.touches[1]);
        initialZoomRef.current = useDrumEditorStore.getState().zoomLevel;
        e.preventDefault();
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && e.touches[0] && e.touches[1] && initialPinchDistanceRef.current !== null) {
        const currentDistance = getTouchDistance(e.touches[0], e.touches[1]);
        const scale = currentDistance / initialPinchDistanceRef.current;
        const newZoom = Math.max(
          ZOOM_LIMITS.min,
          Math.min(ZOOM_LIMITS.max, initialZoomRef.current * scale)
        );
        useDrumEditorStore.getState().setZoomLevel(newZoom);
        e.preventDefault();
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        initialPinchDistanceRef.current = null;
      }
    };

    // Add event listeners - MUST use passive: false to allow preventDefault
    container.addEventListener('wheel', handleWheel, { passive: false });
    container.addEventListener('gesturestart', handleGestureStart);
    container.addEventListener('gesturechange', handleGestureChange);
    container.addEventListener('gestureend', handleGestureEnd);
    container.addEventListener('touchstart', handleTouchStart, { passive: false });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd);
    container.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('gesturestart', handleGestureStart);
      container.removeEventListener('gesturechange', handleGestureChange);
      container.removeEventListener('gestureend', handleGestureEnd);
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
      container.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, []);

  return (
    <div className="flex flex-col bg-zinc-900 rounded-lg overflow-hidden border border-zinc-700">
      {/* Scrollable grid area - includes time markers so they scroll horizontally with grid */}
      <div
        ref={scrollContainerRef}
        className="overflow-auto max-h-[400px]"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#52525b #27272a',
        }}
      >
        {/* Time markers header - sticky top, scrolls horizontally */}
        <TimeMarkers
          totalColumns={totalColumns}
          resolution={resolution}
          timeSignature={timeSignature}
          zoomLevel={zoomLevel}
        />

        {/* Lane rows */}
        {visibleLanes.map((lane) => (
          <DrumLaneRow
            key={lane.drum}
            lane={lane}
            hits={hitsByDrum.get(lane.drum) || []}
            selectedHitIds={selectedHitIds}
            totalColumns={totalColumns}
            resolution={resolution}
            zoomLevel={zoomLevel}
            onCellClick={(position) => handleCellClick(lane.drum, position)}
            onCellRightClick={(hitId, position) => handleCellRightClick(hitId, position)}
            playheadColumn={playheadColumn}
            onPreviewHit={onPreviewHit ? (velocity) => onPreviewHit(lane.drum, velocity) : undefined}
          />
        ))}
      </div>

      {/* Grid info footer */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-950 border-t border-zinc-700 text-xs text-zinc-400">
        <span>
          {bars} {bars === 1 ? 'bar' : 'bars'} • {timeSignature.numerator}/{timeSignature.denominator} • {resolution} grid
        </span>
        <span className="flex items-center gap-3">
          <span className="text-zinc-500">
            {Math.round(zoomLevel * 100)}%
          </span>
          <span>
            {pattern.length} {pattern.length === 1 ? 'hit' : 'hits'}
            {selectedHitIds.length > 0 && ` • ${selectedHitIds.length} selected`}
          </span>
        </span>
      </div>
    </div>
  );
}
