import React from 'react';
import type {
  Fret,
  DragStartHandler,
  DragEndHandler,
  DotClickHandler,
} from '../types/fretboardTypes';

interface FretboardDotProps {
  stringIndex: number;
  fret: Fret;
  x: number;
  y: number;
  isSelected: boolean;
  orderNumbers: number[];
  isExerciseNote: boolean;
  isCurrentNote: boolean;
  isDraggedOver: boolean;
  isBeingDragged: boolean;
  onDragStart: DragStartHandler;
  onDragEnd: DragEndHandler;
  onClick: DotClickHandler;
  stringName: string; // E.g., "E", "A", "D", "G", "B"
  /** Opacity based on measure-relative playback position (0-1). When undefined, defaults to 1. */
  measureOpacity?: number;
  // Note: opacityTransitionDuration removed - CSS classes handle all animation timing
  // via direct DOM manipulation in useFretboardNoteSync for jitter-free 60fps updates
}

export const FretboardDot: React.FC<FretboardDotProps> = ({
  stringIndex,
  fret,
  x,
  y,
  isSelected,
  orderNumbers,
  isExerciseNote,
  isCurrentNote,
  isDraggedOver,
  isBeingDragged,
  onDragStart,
  onDragEnd,
  onClick,
  stringName,
  measureOpacity,
}) => {
  const handleDragStart = (e: React.DragEvent) => {
    if (orderNumbers.length > 0) {
      onDragStart(e, stringIndex, fret);
    }
  };

  const handleClick = () => {
    onClick(stringIndex, fret);
  };

  // Determine dot appearance based on state - match original exactly
  const getDotClassName = () => {
    if (isSelected) {
      return 'bg-green-500 text-black';
    } else if (isDraggedOver) {
      return 'bg-blue-500 text-white border-2 border-blue-300';
    } else if (isCurrentNote) {
      // Static highlight only - CSS .note-active handles the yellow ring via direct DOM
      // Removed animate-pulse to prevent collision with CSS transitions
      return 'bg-orange-500 text-white shadow-lg ring-2 ring-orange-300';
    } else if (fret !== 'open' && [3, 5, 7, 9, 12].includes(fret)) {
      // Fret markers (3rd, 5th, 7th, 9th, 12th frets) - exact styling from original
      return 'bg-slate-500 hover:bg-blue-400 text-white';
    } else {
      // Default dot color - exact styling from original
      return 'bg-slate-600 hover:bg-blue-400 text-white';
    }
  };

  const isOpenString = fret === 'open';
  const baseClassName = isOpenString
    ? 'cursor-pointer flex items-center justify-center text-sm font-semibold rounded-md relative focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-800'
    : 'rounded-full cursor-pointer relative flex items-center justify-center text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:ring-offset-2 focus:ring-offset-slate-800';

  const dotSize = 26;

  // Calculate final opacity:
  // 1. measureOpacity controls visibility based on current playback measure (undefined = 1.0)
  // 2. isBeingDragged reduces opacity to 0.5 during drag operations
  // 3. If measureOpacity is 0, dot should be completely hidden
  const baseOpacity = measureOpacity ?? 1;
  const finalOpacity = isBeingDragged ? Math.min(baseOpacity, 0.5) : baseOpacity;

  // Build transition property - NO opacity transition to avoid collision with CSS classes
  // CSS classes (.note-active, .note-played, etc.) handle all playback-related animations
  // via direct DOM manipulation in useFretboardNoteSync for jitter-free 60fps updates
  // Only background-color transition remains for hover states
  const transition = 'background-color 0.15s ease-in-out';

  const dotStyle = {
    position: 'absolute' as const,
    left: x - dotSize / 2,
    top: y - dotSize / 2,
    width: dotSize,
    height: dotSize,
    zIndex: 20,
    pointerEvents: finalOpacity > 0 ? ('auto' as const) : ('none' as const), // Disable interaction when hidden
    transition,
    opacity: finalOpacity,
    transform: 'rotateX(0deg)', // Counter-rotation for better 3D effect
    // Hide from screen readers when invisible
    visibility: finalOpacity === 0 ? ('hidden' as const) : ('visible' as const),
  };

  return (
    <div
      className={`${getDotClassName()} ${baseClassName}`}
      style={dotStyle}
      draggable={isSelected}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onClick={handleClick}
      title={
        fret === 'open'
          ? `Open ${stringName} String`
          : `Fret ${fret} ${stringName} String${[3, 5, 7, 9, 12].includes(fret) ? ' (Fret Marker)' : ''}`
      }
      role="button"
      tabIndex={0}
      aria-pressed={isSelected}
      aria-label={`${stringName} string ${fret === 'open' ? 'open position' : `fret ${fret}`}${fret !== 'open' && [3, 5, 7, 9, 12].includes(fret) ? ', fret marker position' : ''}${
        isSelected ? `, selected as position ${orderNumbers.join(' and ')}` : ''
      }${isCurrentNote ? ', currently playing' : ''}${isExerciseNote ? ', part of exercise' : ''}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      {/* Display content based on state - only selected dots and open strings show content */}
      {isSelected && orderNumbers.length > 0 ? (
        // Selected dots show order numbers
        <span className="text-xs font-bold text-white">
          {orderNumbers.length === 1 ? orderNumbers[0] : orderNumbers.length}
        </span>
      ) : isCurrentNote ? (
        // Current note shows different symbol
        <span className="text-xs text-white">♫</span>
      ) : fret === 'open' ? (
        // Open string dots show string name when unselected
        <span className="text-xs font-semibold text-white">{stringName}</span>
      ) : // Regular unselected dots are empty (no content)
      null}
    </div>
  );
};
