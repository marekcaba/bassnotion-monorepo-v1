'use client';

/**
 * DrumCell Component
 *
 * Individual clickable cell in the drum grid.
 * Displays hit state, velocity, selection, and playhead position.
 */

import React, { memo, useCallback } from 'react';
import type { DrumCellProps } from './types.js';

/**
 * Get velocity color intensity (darker = louder)
 */
function getVelocityOpacity(velocity: number): number {
  // Map 1-127 to 0.3-1.0 opacity range
  return 0.3 + (velocity / 127) * 0.7;
}

/**
 * DrumCell - Memoized for performance
 */
export const DrumCell = memo(function DrumCell({
  data,
  color,
  width,
  height,
  isBeatBoundary,
  isMeasureBoundary,
  onClick,
  onRightClick,
}: DrumCellProps) {
  const { hit, isSelected, isPlayhead } = data;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onClick();
    },
    [onClick]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onRightClick();
    },
    [onRightClick]
  );

  // Calculate background color based on state
  const getBgColor = () => {
    if (isPlayhead) {
      return 'rgba(59, 130, 246, 0.3)'; // Blue playhead
    }
    if (isMeasureBoundary) {
      return 'rgba(255, 255, 255, 0.08)';
    }
    if (isBeatBoundary) {
      return 'rgba(255, 255, 255, 0.04)';
    }
    return 'transparent';
  };

  // Calculate border style
  const getBorderStyle = () => {
    if (isMeasureBoundary) {
      return '1px solid rgba(255, 255, 255, 0.2)';
    }
    if (isBeatBoundary) {
      return '1px solid rgba(255, 255, 255, 0.1)';
    }
    return '1px solid rgba(255, 255, 255, 0.05)';
  };

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer transition-colors hover:bg-white/10"
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: getBgColor(),
        borderLeft: getBorderStyle(),
      }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      {/* Hit indicator */}
      {hit && (
        <div
          className="rounded-sm transition-all"
          style={{
            width: `${width - 4}px`,
            height: `${height - 6}px`,
            backgroundColor: color,
            opacity: getVelocityOpacity(hit.velocity),
            boxShadow: isSelected
              ? '0 0 0 2px rgba(255, 255, 255, 0.8)'
              : 'none',
          }}
        />
      )}

      {/* Selection overlay */}
      {isSelected && !hit && (
        <div
          className="absolute inset-1 rounded-sm border-2 border-dashed border-white/50"
        />
      )}
    </div>
  );
});

DrumCell.displayName = 'DrumCell';
