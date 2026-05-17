'use client';

/**
 * DrumLaneRow Component
 *
 * A single row in the drum grid representing one drum type.
 * Contains the lane header (name, mute, solo) and all cells for that drum.
 */

import React, { memo, useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { DrumCell } from './DrumCell.js';
import type {
  DrumLaneRowProps,
  GridCellData,
  MusicalPosition,
} from './types.js';
import {
  gridToMusicalPosition,
  musicalToGridColumn,
  isBeatBoundary,
  isMeasureBoundary,
} from './utils/gridPositionUtils.js';
import { CELL_DIMENSIONS } from './constants.js';
import { useDrumEditorStore } from './hooks/useDrumEditorStore.js';

/**
 * DrumLaneRow - Memoized for performance
 */
export const DrumLaneRow = memo(function DrumLaneRow({
  lane,
  hits,
  selectedHitIds,
  totalColumns,
  resolution,
  zoomLevel,
  onCellClick,
  onCellRightClick,
  playheadColumn,
  onPreviewHit,
}: DrumLaneRowProps) {
  // Use useShallow for object selectors to prevent infinite loops
  const timeSignature = useDrumEditorStore(
    useShallow((state) => state.timeSignature),
  );

  // Calculate cell width based on zoom
  const cellWidth = Math.max(
    CELL_DIMENSIONS.minWidth,
    Math.min(
      CELL_DIMENSIONS.maxWidth,
      CELL_DIMENSIONS.minWidth * zoomLevel * 1.5,
    ),
  );

  // Pre-compute hits by column for O(1) lookup
  const hitsByColumn = useMemo(() => {
    const map = new Map<number, (typeof hits)[0]>();
    hits.forEach((hit) => {
      const col = musicalToGridColumn(hit.position, resolution, timeSignature);
      map.set(col, hit);
    });
    return map;
  }, [hits, resolution, timeSignature]);

  // Generate cell data for all columns
  const cells = useMemo(() => {
    const result: GridCellData[] = [];
    for (let col = 0; col < totalColumns; col++) {
      const musicalPosition = gridToMusicalPosition(
        { row: 0, col },
        resolution,
        timeSignature,
      );
      const hit = hitsByColumn.get(col) || null;

      result.push({
        position: { row: 0, col },
        musicalPosition,
        hit,
        isSelected: hit ? selectedHitIds.includes(hit.id) : false,
        isPlayhead: col === playheadColumn,
      });
    }
    return result;
  }, [
    totalColumns,
    resolution,
    timeSignature,
    hitsByColumn,
    selectedHitIds,
    playheadColumn,
  ]);

  // Handle cell click - also triggers preview sound
  const handleCellClick = useCallback(
    (position: MusicalPosition, existingHit: boolean) => {
      onCellClick(position);
      // Play preview sound when adding a hit (not when removing)
      if (!existingHit && onPreviewHit) {
        onPreviewHit();
      }
    },
    [onCellClick, onPreviewHit],
  );

  // Handle cell right-click
  const handleCellRightClick = useCallback(
    (hitId: string | null, position: MusicalPosition) => {
      onCellRightClick(hitId, position);
    },
    [onCellRightClick],
  );

  // Handle mute toggle - use getState() for stable reference
  const handleMuteToggle = useCallback(() => {
    useDrumEditorStore.getState().toggleLaneMute(lane.drum);
  }, [lane.drum]);

  if (lane.collapsed) {
    return (
      <div
        className="flex items-center h-4 bg-zinc-900 border-b border-zinc-700"
        style={{
          minWidth: `${CELL_DIMENSIONS.laneHeaderWidth + totalColumns * cellWidth}px`,
        }}
      >
        <div
          className="flex items-center px-2 text-xs text-zinc-500 truncate bg-zinc-950 sticky left-0 z-10"
          style={{ width: `${CELL_DIMENSIONS.laneHeaderWidth}px` }}
        >
          {lane.displayName} (collapsed)
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center bg-zinc-900 border-b border-zinc-800"
      style={{
        minWidth: `${CELL_DIMENSIONS.laneHeaderWidth + totalColumns * cellWidth}px`,
      }}
    >
      {/* Lane Header - sticky left so it stays visible during horizontal scroll */}
      <div
        className="flex items-center gap-1 px-2 bg-zinc-950 border-r border-zinc-700 shrink-0 sticky left-0 z-10"
        style={{
          width: `${CELL_DIMENSIONS.laneHeaderWidth}px`,
          height: `${CELL_DIMENSIONS.height}px`,
        }}
      >
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: lane.color }}
        />

        {/* Drum name */}
        <span
          className={`text-xs truncate flex-1 ${lane.muted ? 'text-zinc-500' : 'text-zinc-200'}`}
        >
          {lane.displayName}
        </span>

        {/* Mute button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 p-0"
          onClick={handleMuteToggle}
          title={lane.muted ? 'Unmute' : 'Mute'}
        >
          {lane.muted ? (
            <VolumeX className="h-3 w-3 text-red-400" />
          ) : (
            <Volume2 className="h-3 w-3 text-zinc-400" />
          )}
        </Button>
      </div>

      {/* Cells */}
      <div className="flex">
        {cells.map((cellData, index) => (
          <DrumCell
            key={index}
            data={cellData}
            color={lane.color}
            width={cellWidth}
            height={CELL_DIMENSIONS.height}
            isBeatBoundary={isBeatBoundary(index, resolution)}
            isMeasureBoundary={isMeasureBoundary(
              index,
              resolution,
              timeSignature,
            )}
            onClick={() =>
              handleCellClick(cellData.musicalPosition, !!cellData.hit)
            }
            onRightClick={() =>
              handleCellRightClick(
                cellData.hit?.id || null,
                cellData.musicalPosition,
              )
            }
          />
        ))}
      </div>
    </div>
  );
});

DrumLaneRow.displayName = 'DrumLaneRow';
