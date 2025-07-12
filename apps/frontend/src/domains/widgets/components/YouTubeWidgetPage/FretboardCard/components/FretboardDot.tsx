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
      return 'bg-orange-500 text-white animate-pulse shadow-lg ring-2 ring-orange-300';
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
  const dotStyle = {
    position: 'absolute' as const,
    left: x - dotSize / 2,
    top: y - dotSize / 2,
    width: dotSize,
    height: dotSize,
    zIndex: 20,
    pointerEvents: 'auto' as const,
    transition: 'background-color 0.15s ease-in-out, opacity 0.15s ease-in-out',
    opacity: isBeingDragged ? 0.5 : 1,
    transform: 'rotateX(0deg)', // Counter-rotation for better 3D effect
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
