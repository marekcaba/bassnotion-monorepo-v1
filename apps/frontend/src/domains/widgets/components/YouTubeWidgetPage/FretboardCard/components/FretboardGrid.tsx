import React, { useState, useCallback, useEffect, useRef } from 'react';
import type {
  StringCount,
  Fret,
  SelectedDotsMap,
  DragOverTarget,
  DraggedDot,
  DragStartHandler,
  DragOverHandler,
  DragEnterHandler,
  DragLeaveHandler,
  DragDropHandler,
  DragEndHandler,
  DotClickHandler,
  IsExerciseNoteFunction,
  IsCurrentNoteFunction,
} from '../types/fretboardTypes';
import {
  isDotSelected,
  getDotOrder,
  findAllConnections,
} from '../utils/connectionDetection';
import { getDotPosition } from '../utils/fretboardGeometry';
import { HorizontalLines } from './GridLines/HorizontalLines';
import { VerticalLines } from './GridLines/VerticalLines';
import { DiagonalLines } from './GridLines/DiagonalLines';
import { DotDropdownMenu } from './DotDropdownMenu';

// Feature flag for connection line color system - set to false to disable
const ENABLE_CROSSING_LINE_COLORS = true;

interface FretboardGridProps {
  stringCount: StringCount;
  tiltAngle: number;
  frets: number[];
  selectedDots: SelectedDotsMap;
  draggedDot: DraggedDot | null;
  dragOverTarget: DragOverTarget | null;
  isExerciseNote: IsExerciseNoteFunction;
  isCurrentNote: IsCurrentNoteFunction;
  onDragStart: DragStartHandler;
  onDragOver: DragOverHandler;
  onDragEnter: DragEnterHandler;
  onDragLeave: DragLeaveHandler;
  onDrop: DragDropHandler;
  onDragEnd: DragEndHandler;
  onDotClick: DotClickHandler;
  onDotSecondSelection?: (stringIndex: number, fret: Fret) => void;
  onDotRemoval?: (stringIndex: number, fret: Fret) => void;
  zoomLevel?: number; // Add zoom level for fade calculations
  segmentFunctions: {
    getHorizontalSegments: (
      stringIndex: number,
    ) => Array<{ start: number; width: number }>;
    getVerticalSegments: (
      fret: number,
    ) => Array<{ start: number; height: number }>;
  };
  highlightingFunctions: any; // Complex type - keeping as any for now
}

export const FretboardGrid: React.FC<FretboardGridProps> = ({
  stringCount,
  tiltAngle,
  frets,
  selectedDots,
  draggedDot,
  dragOverTarget,
  isExerciseNote,
  isCurrentNote,
  onDragStart,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onDrop,
  onDragEnd,
  onDotClick,
  onDotSecondSelection,
  onDotRemoval,
  zoomLevel = 1.0,
  segmentFunctions,
  highlightingFunctions,
}) => {
  // Scroll position state for fade calculation
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  // Dropdown menu state for each dot
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Listen to scroll events from parent container
  useEffect(() => {
    const handleScroll = () => {
      // Find the scroll container (parent of this grid)
      const scrollContainer = document.querySelector('.overflow-x-auto');
      if (scrollContainer) {
        setScrollLeft(scrollContainer.scrollLeft);
      }
    };

    const scrollContainer = document.querySelector('.overflow-x-auto');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);

      // Initialize scroll position state (position is managed by parent component)
      setScrollLeft(scrollContainer.scrollLeft);

      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
      };
    }

    // Return empty cleanup function when no scroll container is found
    return () => {};
  }, []);

  // Handle second selection (add another note to the same dot)
  const handleAddSecondNote = useCallback(
    (stringIndex: number, fret: Fret) => {
      if (onDotSecondSelection) {
        onDotSecondSelection(stringIndex, fret);
      }
      setOpenDropdown(null); // Close dropdown
    },
    [onDotSecondSelection],
  );

  // Handle note removal
  const handleRemoveNote = useCallback(
    (stringIndex: number, fret: Fret) => {
      if (onDotRemoval) {
        onDotRemoval(stringIndex, fret);
      }
      setOpenDropdown(null); // Close dropdown
    },
    [onDotRemoval],
  );

  // Handle enhanced dot click (with dropdown logic)
  const handleEnhancedDotClick = useCallback(
    (stringIndex: number, fret: Fret, event: React.MouseEvent) => {
      const isSelected = isDotSelected(stringIndex, fret, selectedDots);

      if (isSelected) {
        // If dot is already selected, show dropdown menu
        const dotKey = `${stringIndex},${fret}`;
        setOpenDropdown(dotKey);
      } else {
        // If dot is not selected, proceed with normal selection
        onDotClick(stringIndex, fret);
      }
    },
    [selectedDots, onDotClick],
  );

  // Always use the full 6-string configuration, but hide strings based on stringCount
  const fullStringConfig = ['B', 'E', 'A', 'D', 'G', 'C']; // B(0), E(1), A(2), D(3), G(4), C(5)

  // Determine which strings to show based on string count
  const getVisibleStrings = (stringCount: StringCount) => {
    switch (stringCount) {
      case 4:
        return fullStringConfig.slice(1, 5); // Show E, A, D, G (indices 1-4 from full config)
      case 5:
        return fullStringConfig.slice(0, 5); // Show B, E, A, D, G (indices 0-4 from full config)
      case 6:
        return fullStringConfig; // Show all strings (indices 0-5 from full config)
      default:
        return fullStringConfig.slice(1, 5); // Default to 4-string
    }
  };

  // Get the starting index offset for the current string count
  const getStringIndexOffset = (stringCount: StringCount) => {
    switch (stringCount) {
      case 4:
        return 1; // Skip B string, start from E(1)
      case 5:
        return 0; // Start from B(0)
      case 6:
        return 0; // Start from B(0)
      default:
        return 1; // Default to 4-string
    }
  };

  // Grid constants - exact original measurements
  const STRING_SPACING = 32; // px between string centers
  const FRET_SPACING = 36; // px between fret centers
  const DOT_SIZE = 26; // px diameter
  const DOT_RADIUS = 13; // px radius
  const FRET_OFFSET = 38; // px from open string to first fret center - reduced gap
  const CENTER_OFFSET = 15; // px minimal offset for open strings visibility

  // Calculate exact grid positions
  const getStringY = (stringIndex: number) => stringIndex * STRING_SPACING;
  const getFretX = (fret: Fret) =>
    fret === 'open'
      ? CENTER_OFFSET
      : CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING;
  const getOpenStringX = () => CENTER_OFFSET;

  const visibleStrings = getVisibleStrings(stringCount);
  const stringIndexOffset = getStringIndexOffset(stringCount);

  // Use all frets for scrollable view (no filtering)
  const visibleFrets = frets;

  // Get the highest fret number for grid width calculation
  const maxFretNumber = Math.max(...frets);

  // Calculate Y positions for the visible string range using the same logic as dots
  // Get the actual visual positions of the first and last visible strings
  const firstStringIndex = stringIndexOffset; // First visible string's absolute index
  const lastStringIndex = stringIndexOffset + visibleStrings.length - 1; // Last visible string's absolute index

  const topVisibleStringPosition = 5 - lastStringIndex; // Top string (lowest visual position number)
  const bottomVisibleStringPosition = 5 - firstStringIndex; // Bottom string (highest visual position number)

  const topVisibleStringY = getStringY(topVisibleStringPosition); // Top string Y coordinate
  const bottomVisibleStringY = getStringY(bottomVisibleStringPosition); // Bottom string Y coordinate
  const visibleStringSpan = bottomVisibleStringY - topVisibleStringY; // Height span of visible strings

  // Grid dimensions - calculate based on actual max fret count with extra space to show last fret fully
  const gridWidth =
    CENTER_OFFSET +
    FRET_OFFSET +
    (maxFretNumber - 1) * FRET_SPACING +
    DOT_RADIUS +
    40; // Extra 40px padding beyond last fret
  const visibleStringHeight = (stringCount - 1) * STRING_SPACING + DOT_SIZE; // Height for visible strings only
  const gridHeight = 5 * STRING_SPACING + DOT_SIZE + 10; // Extra 10px bottom padding for shadows

  // Helper functions
  const isDotBeingDragged = (stringIndex: number, fret: Fret) => {
    return draggedDot?.stringIndex === stringIndex && draggedDot?.fret === fret;
  };

  const isDraggedOver = (stringIndex: number, fret: Fret) => {
    return (
      dragOverTarget?.stringIndex === stringIndex &&
      dragOverTarget?.fret === fret
    );
  };

  // Calculate fade opacity based on dot position relative to viewport
  const calculateFadeOpacity = (fret: Fret) => {
    const containerWidth = 568; // Viewport width (physical container)
    const fadeZoneWidth = 40; // Fade zone width for both sides

    // Calculate dot X position (including dot radius for accurate edge detection)
    // Scale the dot position to match the zoom level
    const rawDotX =
      fret === 'open'
        ? getOpenStringX() + DOT_RADIUS
        : getFretX(fret) + DOT_RADIUS;
    const dotX = rawDotX * zoomLevel;

    // Calculate visible area boundaries (scaled by zoom)
    const viewportLeft = scrollLeft;
    const viewportRight = scrollLeft + containerWidth;
    const leftFadeEndX = viewportLeft + fadeZoneWidth; // Left fade zone (only when scrolled)
    const rightFadeStartX = viewportRight - fadeZoneWidth; // Right fade zone

    // If dot is completely outside viewport, hide it
    const scaledDotSize = DOT_SIZE * zoomLevel;
    if (
      dotX < viewportLeft - scaledDotSize ||
      dotX > viewportRight + scaledDotSize
    ) {
      return 0;
    }

    // Left side fade - only apply when user has scrolled (scrollLeft > 0)
    if (scrollLeft > 0 && dotX < leftFadeEndX) {
      const fadeProgress = (leftFadeEndX - dotX) / fadeZoneWidth;
      return Math.max(0, 1 - fadeProgress);
    }

    // Right side fade - always apply
    if (dotX > rightFadeStartX) {
      const fadeProgress = (dotX - rightFadeStartX) / fadeZoneWidth;
      return Math.max(0, 1 - fadeProgress);
    }

    // Normal visibility for dots not in fade zones
    return 1;
  };

  // Render a dot with absolute positioning
  const renderDot = (
    logicalStringIndex: number,
    fret: Fret,
    stringName: string,
    visualStringIndex?: number,
  ) => {
    const stringIndex = logicalStringIndex; // Use logical index for exercise note matching and dot storage
    const positionIndex =
      visualStringIndex !== undefined ? visualStringIndex : logicalStringIndex; // Use visual index for positioning

    const isSelected = isDotSelected(stringIndex, fret, selectedDots);
    const orderNumbers = getDotOrder(stringIndex, fret, selectedDots);
    const isExerciseNoteAtPos = isExerciseNote(stringIndex, fret);
    const isCurrentNoteAtPos = isCurrentNote(stringIndex, fret);
    const isBeingDragged = isDotBeingDragged(stringIndex, fret);
    const isDraggedOverDot = isDraggedOver(stringIndex, fret);

    // Calculate absolute position
    const x = fret === 'open' ? getOpenStringX() : getFretX(fret);
    const y = getStringY(positionIndex); // Use visual index for Y positioning

    // Check if this dot has multiple selections
    const hasMultipleSelections = isSelected && orderNumbers.length > 1;

    // Determine dot styling
    const getDotClassName = () => {
      const neumorphicShadow =
        'shadow-[2px_2px_4px_rgba(0,0,0,0.4),-1px_-1px_3px_rgba(255,255,255,0.1)]';
      const neumorphicShadowPressed =
        'shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]';

      if (isSelected) {
        // If dot has multiple selections, add orange ring
        const multipleSelectionRing = hasMultipleSelections
          ? ' ring-1 ring-orange-500'
          : '';
        return `bg-green-500 text-black ${neumorphicShadowPressed}${multipleSelectionRing}`;
      } else if (isDraggedOverDot) {
        return `bg-blue-500 text-white border-2 border-blue-300 ${neumorphicShadow}`;
      } else if (isCurrentNoteAtPos) {
        return `bg-orange-500 text-white animate-pulse ${neumorphicShadow} ring-2 ring-orange-300`;
      } else if (
        fret !== 'open' &&
        fret !== 12 &&
        [3, 5, 7, 9, 15, 17, 19, 21, 24].includes(fret)
      ) {
        return `bg-slate-500 hover:bg-blue-400 text-white ${neumorphicShadow} hover:${neumorphicShadowPressed}`;
      } else if (fret === 12) {
        return `bg-slate-500/80 hover:bg-blue-400 text-white ${neumorphicShadow} hover:${neumorphicShadowPressed}`;
      } else {
        return `bg-slate-600 hover:bg-blue-400 text-white ${neumorphicShadow} hover:${neumorphicShadowPressed}`;
      }
    };

    const baseClassName =
      fret === 'open' || fret === 12
        ? 'cursor-pointer flex items-center justify-center text-sm font-semibold rounded-md absolute focus:outline-none'
        : 'rounded-full cursor-pointer absolute flex items-center justify-center text-sm font-semibold focus:outline-none';

    const dotKey = `${stringIndex},${fret}`;
    const isDropdownOpen = openDropdown === dotKey;

    // Calculate fade opacity for this dot
    const fadeOpacity = calculateFadeOpacity(fret);
    const finalOpacity = isBeingDragged ? 0.5 * fadeOpacity : fadeOpacity;

    const dotElement = (
      <div
        className={`${getDotClassName()} ${baseClassName}`}
        style={{
          left: x,
          top: y,
          width: DOT_SIZE,
          height: DOT_SIZE,
          zIndex: 20,
          pointerEvents: 'auto',
          transition:
            'background-color 0.15s ease-in-out, opacity 0.3s ease-out',
          opacity: finalOpacity,
          transform: 'rotateX(0deg)',
        }}
        title={
          fret === 'open'
            ? `Open ${stringName} String`
            : `Fret ${fret} ${stringName} String${[3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fret) ? ' (Fret Marker)' : ''}`
        }
        role="button"
        tabIndex={0}
        aria-pressed={isSelected}
        aria-label={`${stringName} string ${fret === 'open' ? 'open position' : `fret ${fret}`}${fret !== 'open' && [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fret) ? ', fret marker position' : ''}${
          isSelected
            ? `, selected as position ${orderNumbers.join(' and ')}`
            : ''
        }${isCurrentNoteAtPos ? ', currently playing' : ''}${isExerciseNoteAtPos ? ', part of exercise' : ''}`}
        draggable={isSelected}
        onDragStart={(e) => isSelected && onDragStart(e, stringIndex, fret)}
        onDragOver={onDragOver}
        onDragEnter={() => onDragEnter(stringIndex, fret)}
        onDragLeave={onDragLeave}
        onDrop={(e) => onDrop(e, stringIndex, fret)}
        onDragEnd={onDragEnd}
        onClick={(e) => handleEnhancedDotClick(stringIndex, fret, e)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onDotClick(stringIndex, fret);
          }
        }}
      >
        {/* Display content based on state */}
        {isSelected && orderNumbers.length > 0 && orderNumbers.includes(1) ? (
          <span className="text-xs font-bold text-black">1</span>
        ) : isCurrentNoteAtPos ? (
          <span className="text-xs text-white">♫</span>
        ) : fret === 'open' ? (
          <span className="text-xs font-semibold text-white select-none">
            {stringName}
          </span>
        ) : fret === 12 ? (
          <span className="text-xs font-semibold text-white select-none opacity-50">
            {stringName}
          </span>
        ) : null}
      </div>
    );

    // If the dot is selected, wrap it in a dropdown menu
    if (isSelected) {
      return (
        <DotDropdownMenu
          key={`dot-${stringIndex}-${fret}`}
          isOpen={isDropdownOpen}
          onOpenChange={(open) => {
            setOpenDropdown(open ? dotKey : null);
          }}
          onAddSecondNote={() => handleAddSecondNote(stringIndex, fret)}
          onRemoveNote={() => handleRemoveNote(stringIndex, fret)}
        >
          {dotElement}
        </DotDropdownMenu>
      );
    }

    // If not selected, return the dot element directly
    return <div key={`dot-${stringIndex}-${fret}`}>{dotElement}</div>;
  };

  return (
    <div className="relative">
      {/* Screen reader instructions */}
      <div id="fretboard-instructions" className="sr-only">
        Use mouse or keyboard to select fretboard positions. Press Tab to
        navigate between positions, Enter or Space to select. Selected positions
        can be dragged to reorder them.
        {Object.values(selectedDots).length > 0 &&
          ' Currently practicing an exercise. Purple notes indicate exercise positions.'}
      </div>

      {/* Perspective wrapper */}
      <div
        className="space-y-3 flex flex-col items-start"
        style={{ perspective: '1000px' }}
        aria-describedby="fretboard-instructions"
      >
        {/* 3D container - tilt removed, will be applied to viewport */}
        <div
          className="space-y-4 flex flex-col items-start relative"
          style={{
            transformStyle: 'preserve-3d',
            backfaceVisibility: 'visible',
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
          }}
        >
          {/* Single coordinate system container */}
          <div
            className="relative"
            style={{
              width: gridWidth,
              height: gridHeight,
              // Adjust vertical offset to center visible strings only
              transform: stringCount === 5 ? 'translateY(-16px)' : 'none', // Move up by half string spacing for 5-string (16px = 32px/2)
            }}
          >
            {/* Horizontal grid lines */}
            {visibleStrings.map((stringName, visualIndex) => {
              // Use consistent string indices from the full configuration
              const absoluteStringIndex = stringIndexOffset + visualIndex; // Absolute index in full config

              // CRITICAL FIX: Use absolute visual position based on the full 6-string layout
              const absoluteVisualPosition = 5 - absoluteStringIndex; // 5 - index gives: B=5, E=4, A=3, D=2, G=1, C=0
              const y = getStringY(absoluteVisualPosition); // Use absolute visual position for Y coordinate
              const segments: any[] = []; // Disable old highlighting system

              return (
                <React.Fragment key={`horizontal-${absoluteStringIndex}`}>
                  {/* Base horizontal line */}
                  <div
                    className="absolute bg-white opacity-5 pointer-events-none"
                    style={{
                      left: getOpenStringX() + DOT_RADIUS, // Start at center of open string dots
                      top: y + DOT_RADIUS,
                      width: gridWidth - (getOpenStringX() + DOT_RADIUS), // Adjust width accordingly
                      height: 1,
                      zIndex: 1,
                    }}
                  />

                  {/* Highlighted segments */}
                  {segments.map((segment, segmentIndex) => (
                    <div
                      key={`hsegment-${absoluteStringIndex}-${segmentIndex}`}
                      className="absolute bg-green-500 opacity-100 pointer-events-none"
                      style={{
                        left: segment.start + DOT_RADIUS,
                        top: y + DOT_RADIUS - 2,
                        width: segment.width,
                        height: 4,
                        zIndex: 15,
                        borderRadius: '2px',
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            })}

            {/* Vertical grid lines */}
            {/* Open string vertical line */}
            <div
              className="absolute bg-white opacity-5 pointer-events-none"
              style={{
                left: getOpenStringX() + DOT_RADIUS,
                top: topVisibleStringY + DOT_RADIUS,
                width: 1,
                height: visibleStringSpan,
                zIndex: 1,
              }}
            />

            {/* Fret vertical lines */}
            {visibleFrets.map((fret) => {
              const x = getFretX(fret);
              const segments: any[] = []; // Disable old highlighting system

              return (
                <React.Fragment key={`vertical-${fret}`}>
                  {/* Base vertical line */}
                  <div
                    className="absolute bg-white opacity-5 pointer-events-none"
                    style={{
                      left: x + DOT_RADIUS,
                      top: topVisibleStringY + DOT_RADIUS,
                      width: 1,
                      height: visibleStringSpan,
                      zIndex: 1,
                    }}
                  />

                  {/* Highlighted segments */}
                  {segments.map((segment, segmentIndex) => (
                    <div
                      key={`vsegment-${fret}-${segmentIndex}`}
                      className="absolute bg-green-500 opacity-100 pointer-events-none"
                      style={{
                        left: x + DOT_RADIUS - 2,
                        top: Math.max(
                          topVisibleStringY + DOT_RADIUS,
                          segment.start + DOT_RADIUS,
                        ),
                        width: 4,
                        height: Math.min(segment.height, visibleStringSpan),
                        zIndex: 15,
                        borderRadius: '2px',
                      }}
                    />
                  ))}
                </React.Fragment>
              );
            })}

            {/* Diagonal lines - disabled to use direct connection lines instead */}

            {/* Direct connection lines */}
            <svg
              className="absolute pointer-events-none"
              style={{
                zIndex: 20,
                width: gridWidth,
                height: gridHeight,
              }}
            >
              {(() => {
                const connections = findAllConnections(selectedDots);
                const connectionElements: React.ReactElement[] = [];

                connections.forEach(({ pos1, pos2 }, index) => {
                  // pos1.stringIndex and pos2.stringIndex are logical indices in the full 6-string config
                  // Convert to absolute visual positions (same logic as above)
                  const absoluteVisualPosition1 = 5 - pos1.stringIndex; // 5 - index gives: B=5, E=4, A=3, D=2, G=1, C=0
                  const absoluteVisualPosition2 = 5 - pos2.stringIndex; // 5 - index gives: B=5, E=4, A=3, D=2, G=1, C=0

                  // Get top-left corner positions
                  const x1 =
                    pos1.fret === 'open'
                      ? CENTER_OFFSET
                      : CENTER_OFFSET +
                        FRET_OFFSET +
                        (pos1.fret - 1) * FRET_SPACING;
                  const y1 = absoluteVisualPosition1 * STRING_SPACING; // Use absolute visual position for Y position
                  const x2 =
                    pos2.fret === 'open'
                      ? CENTER_OFFSET
                      : CENTER_OFFSET +
                        FRET_OFFSET +
                        (pos2.fret - 1) * FRET_SPACING;
                  const y2 = absoluteVisualPosition2 * STRING_SPACING; // Use absolute visual position for Y position

                  // Add DOT_RADIUS to get center positions
                  const lineX1 = x1 + DOT_RADIUS;
                  const lineY1 = y1 + DOT_RADIUS;
                  const lineX2 = x2 + DOT_RADIUS;
                  const lineY2 = y2 + DOT_RADIUS;

                  // All lines are green, connecting notes in sequence
                  const lineColor = '#10b981'; // Green

                  // Connection lines should not fade with dots to avoid visual chaos
                  // Only fade lines when the line itself extends into fade zones
                  const calculateLineFadeOpacity = () => {
                    const containerWidth = 568; // Viewport width (physical container)
                    const fadeZoneWidth = 40; // Fade zone width for both sides

                    // Scale line positions to match zoom level
                    const scaledLineX1 = lineX1 * zoomLevel;
                    const scaledLineX2 = lineX2 * zoomLevel;

                    // Calculate visible area boundaries
                    const viewportLeft = scrollLeft;
                    const viewportRight = scrollLeft + containerWidth;
                    const leftFadeEndX = viewportLeft + fadeZoneWidth;
                    const rightFadeStartX = viewportRight - fadeZoneWidth;

                    // Get the center point of the line for fade calculation
                    const lineCenterX = (scaledLineX1 + scaledLineX2) / 2;

                    let fadeOpacity = 1;

                    // Only fade the line if its CENTER is in a fade zone
                    // This prevents visible dots from appearing disconnected

                    // Left side fade - only apply when user has scrolled
                    if (scrollLeft > 0 && lineCenterX < leftFadeEndX) {
                      const fadeProgress =
                        (leftFadeEndX - lineCenterX) / fadeZoneWidth;
                      fadeOpacity = Math.min(
                        fadeOpacity,
                        Math.max(0, 1 - fadeProgress),
                      );
                    }

                    // Right side fade - always apply
                    if (lineCenterX > rightFadeStartX) {
                      const fadeProgress =
                        (lineCenterX - rightFadeStartX) / fadeZoneWidth;
                      fadeOpacity = Math.min(
                        fadeOpacity,
                        Math.max(0, 1 - fadeProgress),
                      );
                    }

                    return fadeOpacity;
                  };

                  const lineFadeOpacity = calculateLineFadeOpacity();

                  // Add the line element
                  connectionElements.push(
                    <line
                      key={`connection-${index}`}
                      x1={lineX1}
                      y1={lineY1}
                      x2={lineX2}
                      y2={lineY2}
                      stroke={lineColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity={lineFadeOpacity}
                    />,
                  );
                });

                return connectionElements;
              })()}
            </svg>

            {/* Dots - all using same coordinate system */}
            {visibleStrings.map((stringName, visualIndex) => {
              // Use consistent string indices from the full configuration
              const absoluteStringIndex = stringIndexOffset + visualIndex; // Absolute index in full config

              // CRITICAL FIX: Use absolute visual position based on the full 6-string layout
              // This ensures strings stay at the same Y coordinate regardless of string count
              const absoluteVisualPosition = 5 - absoluteStringIndex; // 5 - index gives: B=5, E=4, A=3, D=2, G=1, C=0

              return (
                <React.Fragment key={`dots-${absoluteStringIndex}`}>
                  {/* Open string dot */}
                  {renderDot(
                    absoluteStringIndex,
                    'open',
                    stringName,
                    absoluteVisualPosition,
                  )}

                  {/* Fret dots */}
                  {visibleFrets.map((fret) =>
                    renderDot(
                      absoluteStringIndex,
                      fret,
                      stringName,
                      absoluteVisualPosition,
                    ),
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
