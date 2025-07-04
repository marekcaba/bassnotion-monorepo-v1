'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';

export function FretboardCard() {
  // Generate 12 frets for each string
  const frets = Array.from({ length: 12 }, (_, i) => i + 1);

  // String picker state
  const [stringCount, setStringCount] = useState<4 | 5>(4);

  // Tilt angle state
  const [tiltAngle, setTiltAngle] = useState<number>(35);

  // Selected dots state - stores position keys with order numbers
  const [selectedDots, setSelectedDots] = useState<Map<string, number>>(
    new Map(),
  );
  const [selectionOrder, setSelectionOrder] = useState<number>(0);

  // Drag and drop state
  const [draggedDot, setDraggedDot] = useState<{
    stringIndex: number;
    fret: number | 'open';
    order: number;
  } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{
    stringIndex: number;
    fret: number | 'open';
  } | null>(null);

  // String configurations
  const stringConfigs = {
    4: ['G', 'D', 'A', 'E'],
    5: ['G', 'D', 'A', 'E', 'B'],
  };

  // Drag and drop handlers
  const handleDragStart = (
    e: React.DragEvent,
    stringIndex: number,
    fret: number | 'open',
  ) => {
    const positionKey = `string-${stringIndex}-${fret === 'open' ? 'open' : `fret-${fret}`}`;
    const order = selectedDots.get(positionKey);

    if (order !== undefined) {
      setDraggedDot({ stringIndex, fret, order });
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', positionKey);

      // Use a simplified approach - the browser's default drag image works fine
      // The visual feedback comes from the opacity change and drag-over effects
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (
    targetStringIndex: number,
    targetFret: number | 'open',
  ) => {
    // Only show drag over effect if target is empty
    const targetPositionKey = `string-${targetStringIndex}-${targetFret === 'open' ? 'open' : `fret-${targetFret}`}`;
    if (!selectedDots.has(targetPositionKey)) {
      setDragOverTarget({ stringIndex: targetStringIndex, fret: targetFret });
    }
  };

  const handleDragLeave = () => {
    setDragOverTarget(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    targetStringIndex: number,
    targetFret: number | 'open',
  ) => {
    e.preventDefault();

    if (!draggedDot) return;

    const targetPositionKey = `string-${targetStringIndex}-${targetFret === 'open' ? 'open' : `fret-${targetFret}`}`;

    // Don't allow dropping on an already selected dot
    if (selectedDots.has(targetPositionKey)) {
      setDraggedDot(null);
      return;
    }

    // Remove from old position and add to new position with same order
    const sourcePositionKey = `string-${draggedDot.stringIndex}-${draggedDot.fret === 'open' ? 'open' : `fret-${draggedDot.fret}`}`;

    setSelectedDots((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sourcePositionKey);
      newMap.set(targetPositionKey, draggedDot.order);
      return newMap;
    });

    setDraggedDot(null);
  };

  const handleDragEnd = () => {
    setDraggedDot(null);
    setDragOverTarget(null);
  };

  // Check if a dot is being dragged over
  const isDragOverTarget = (stringIndex: number, fret: number | 'open') => {
    return (
      dragOverTarget?.stringIndex === stringIndex &&
      dragOverTarget?.fret === fret
    );
  };

  // Check if a dot is currently being dragged
  const isDotBeingDragged = (stringIndex: number, fret: number | 'open') => {
    return draggedDot?.stringIndex === stringIndex && draggedDot?.fret === fret;
  };

  // Handle dot click - toggle selection with order tracking
  const handleDotClick = (stringIndex: number, fret: number | 'open') => {
    const positionKey = `string-${stringIndex}-${fret === 'open' ? 'open' : `fret-${fret}`}`;
    setSelectedDots((prev) => {
      const newMap = new Map(prev);
      if (newMap.has(positionKey)) {
        // Remove the dot and reorder remaining dots
        const removedOrder = newMap.get(positionKey)!;
        newMap.delete(positionKey);

        // Reorder all dots that came after the removed one
        for (const [key, order] of newMap.entries()) {
          if (order > removedOrder) {
            newMap.set(key, order - 1);
          }
        }

        // Update the selection order counter
        setSelectionOrder(Math.max(0, selectionOrder - 1));
      } else {
        // Add new dot with next order number
        const newOrder = selectionOrder + 1;
        newMap.set(positionKey, newOrder);
        setSelectionOrder(newOrder);
      }
      return newMap;
    });
  };

  // Check if a dot is selected
  const isDotSelected = (stringIndex: number, fret: number | 'open') => {
    const positionKey = `string-${stringIndex}-${fret === 'open' ? 'open' : `fret-${fret}`}`;
    return selectedDots.has(positionKey);
  };

  // Get the order number of a selected dot
  const getDotOrder = (stringIndex: number, fret: number | 'open') => {
    const positionKey = `string-${stringIndex}-${fret === 'open' ? 'open' : `fret-${fret}`}`;
    return selectedDots.get(positionKey);
  };

  // Reset all selected dots
  const resetSelection = () => {
    setSelectedDots(new Map());
    setSelectionOrder(0);
  };

  // Adjust tilt angle
  const increaseTilt = () => {
    setTiltAngle((prev) => prev + 5); // Unlimited upward tilt
  };

  const decreaseTilt = () => {
    setTiltAngle((prev) => prev - 5); // Unlimited downward tilt
  };

  const resetTiltToDefault = () => {
    setTiltAngle(35); // Reset to default 35 degrees
  };

  const setTiltToFlat = () => {
    setTiltAngle(0); // Set to flat view (0 degrees)
  };

  // Helper function to get dot position - matching exact grid positioning
  const getDotPosition = (stringIndex: number, fret: number | 'open') => {
    // Use the exact same spacing as the grid lines
    // Grid vertical lines: height = (stringCount - 1) * 42px with 42px spacing between strings
    const y = stringIndex * 42; // This matches the grid's vertical spacing calculation
    let x;

    if (fret === 'open') {
      // Open string center: 26px width / 2 = 13px from left edge
      x = 13;
    } else {
      // Grid uses 38px horizontal spacing between fret centers (from diagonal calculations)
      x = 46 + (fret - 1) * 38 + 13; // 46px offset + fret spacing + center
    }

    return { x, y };
  };

  // Helper function to check if two dots are directly connected
  const areDotsConnected = (
    pos1: { stringIndex: number; fret: number | 'open' },
    pos2: { stringIndex: number; fret: number | 'open' },
  ) => {
    const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
    const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

    // Same string (horizontal connection)
    if (pos1.stringIndex === pos2.stringIndex) {
      return true;
    }

    // Same fret (vertical connection)
    if (fret1 === fret2) {
      return true;
    }

    // Adjacent diagonal connection
    const stringDiff = Math.abs(pos1.stringIndex - pos2.stringIndex);
    const fretDiff = Math.abs(fret1 - fret2);
    if (stringDiff === 1 && fretDiff === 1) {
      return true;
    }

    // Long diagonal connection (2 frets, 1 string)
    if (stringDiff === 1 && fretDiff === 2) {
      return true;
    }

    // Vertical long diagonal connection (1 fret, 2 strings)
    if (stringDiff === 2 && fretDiff === 1) {
      return true;
    }

    // Long diagonal connection (2 frets, 2 strings)
    if (stringDiff === 2 && fretDiff === 2) {
      return true;
    }

    // Extra long diagonal connection (1 string, 3 frets)
    if (stringDiff === 1 && fretDiff === 3) {
      return true;
    }

    // Extra long diagonal connection (3 strings, 1 fret)
    if (stringDiff === 3 && fretDiff === 1) {
      return true;
    }

    // Extra long diagonal connection (3 frets, 3 strings)
    if (stringDiff === 3 && fretDiff === 3) {
      return true;
    }

    // Three-by-Two diagonal connection (3 strings, 2 frets)
    if (stringDiff === 3 && fretDiff === 2) {
      return true;
    }

    // Four-by-Two diagonal connection (2 strings, 4 frets)
    if (stringDiff === 2 && fretDiff === 4) {
      return true;
    }

    // Two-by-Three diagonal connection (2 strings, 3 frets)
    if (stringDiff === 2 && fretDiff === 3) {
      return true;
    }

    return false;
  };

  // Get connection line properties between two dots
  const getConnectionLine = (
    pos1: { stringIndex: number; fret: number | 'open' },
    pos2: { stringIndex: number; fret: number | 'open' },
  ) => {
    const dotPos1 = getDotPosition(pos1.stringIndex, pos1.fret);
    const dotPos2 = getDotPosition(pos2.stringIndex, pos2.fret);

    const deltaX = dotPos2.x - dotPos1.x;
    const deltaY = dotPos2.y - dotPos1.y;
    const length = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

    return {
      x: dotPos1.x,
      y: dotPos1.y,
      length,
      angle,
    };
  };

  // Get selected dots for highlighting connection
  const _getSelectedDotsForHighlight = () => {
    if (selectedDots.size !== 2) return null;

    const selectedPositions = Array.from(selectedDots.keys()).map((key) => {
      const parts = key.split('-');
      const stringIndex = parseInt(parts[1] || '0');
      const fret =
        parts[2] === 'open' ? ('open' as const) : parseInt(parts[3] || '0');
      return { stringIndex, fret };
    });

    if (selectedPositions.length !== 2) return null;

    const [pos1, pos2] = selectedPositions;

    if (pos1 && pos2 && areDotsConnected(pos1, pos2)) {
      return getConnectionLine(pos1, pos2);
    }

    return null;
  };

  // Get all selected positions for multi-dot highlighting
  const getAllSelectedPositions = () => {
    if (selectedDots.size < 2) return [];

    return Array.from(selectedDots.keys()).map((key) => {
      const parts = key.split('-');
      const stringIndex = parseInt(parts[1] || '0');
      const fret =
        parts[2] === 'open' ? ('open' as const) : parseInt(parts[3] || '0');
      return { stringIndex, fret, key };
    });
  };

  const allSelectedPositions = getAllSelectedPositions();

  // Get connections between consecutive selected dots in selection order
  const getAllConnections = () => {
    if (allSelectedPositions.length < 2) return [];

    const connections = [];

    // Sort positions by their selection order
    const sortedPositions = allSelectedPositions.sort((a, b) => {
      const orderA = selectedDots.get(a.key) || 0;
      const orderB = selectedDots.get(b.key) || 0;
      return orderA - orderB;
    });

    // Only connect consecutive dots in selection order
    for (let i = 0; i < sortedPositions.length - 1; i++) {
      const pos1 = sortedPositions[i];
      const pos2 = sortedPositions[i + 1];

      if (pos1 && pos2 && areDotsConnected(pos1, pos2)) {
        connections.push({ pos1, pos2 });
      }
    }

    return connections;
  };

  const allConnections = getAllConnections();

  // Helper functions for multi-segment highlighting
  const getHorizontalSegments = (stringIndex: number) => {
    const segments = [];

    // Find all horizontal connections on this string
    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      if (
        pos1.stringIndex === stringIndex &&
        pos2.stringIndex === stringIndex
      ) {
        const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
        const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;
        const minFret = Math.min(fret1, fret2);
        const maxFret = Math.max(fret1, fret2);

        const startX = minFret === 0 ? 13 : 46 + (minFret - 1) * 38 + 13;
        const endX = maxFret === 0 ? 13 : 46 + (maxFret - 1) * 38 + 13;

        segments.push({
          start: startX,
          width: endX - startX,
        });
      }
    }

    return segments;
  };

  const getVerticalSegments = (fret: number) => {
    const segments = [];

    // Find all vertical connections at this fret (including open strings at fret 0)
    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      if (fret1 === fret && fret2 === fret) {
        const minString = Math.min(pos1.stringIndex, pos2.stringIndex);
        const maxString = Math.max(pos1.stringIndex, pos2.stringIndex);

        segments.push({
          start: 13 + minString * 42,
          height: (maxString - minString) * 42,
        });
      }
    }

    return segments;
  };

  // Helper function to check if a specific grid line should be highlighted
  const shouldHighlightLine = (
    lineType: 'horizontal' | 'vertical' | 'diagonal',
    stringIndex: number,
    fret?: number,
    direction?: 'right' | 'left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      if (lineType === 'horizontal') {
        // Horizontal line on this string
        if (
          pos1.stringIndex === stringIndex &&
          pos2.stringIndex === stringIndex
        ) {
          return true;
        }
      }

      if (lineType === 'vertical') {
        // Vertical line at this fret
        if (fret1 === fret2 && fret1 === fret) {
          return true;
        }
      }

      if (lineType === 'diagonal' && fret !== undefined) {
        // Diagonal line from this position
        const currentFret = fret;
        const isPos1 =
          pos1.stringIndex === stringIndex && fret1 === currentFret;
        const isPos2 =
          pos2.stringIndex === stringIndex && fret2 === currentFret;

        if (isPos1) {
          // Check if this diagonal goes to pos2
          const targetString = pos2.stringIndex;
          const targetFret = fret2;

          if (direction === 'right') {
            // Only down-right diagonal (1 string down, 1 fret forward)
            if (
              targetString === stringIndex + 1 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'left') {
            // Only down-left diagonal (1 string down, 1 fret backward)
            if (
              targetString === stringIndex + 1 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          } else if (direction === 'up-right') {
            // Up-right diagonal (1 string up, 1 fret forward)
            if (
              targetString === stringIndex - 1 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'up-left') {
            // Up-left diagonal (1 string up, 1 fret backward)
            if (
              targetString === stringIndex - 1 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          }
        }

        if (isPos2) {
          // Check if this diagonal goes to pos1
          const targetString = pos1.stringIndex;
          const targetFret = fret1;

          if (direction === 'right') {
            // Only down-right diagonal (1 string down, 1 fret forward)
            if (
              targetString === stringIndex + 1 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'left') {
            // Only down-left diagonal (1 string down, 1 fret backward)
            if (
              targetString === stringIndex + 1 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          } else if (direction === 'up-right') {
            // Up-right diagonal (1 string up, 1 fret forward)
            if (
              targetString === stringIndex - 1 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'up-left') {
            // Up-left diagonal (1 string up, 1 fret backward)
            if (
              targetString === stringIndex - 1 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a long diagonal line should be highlighted
  const shouldHighlightLongDiagonal = (
    stringIndex: number,
    fret: number,
    direction: 'right' | 'left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Only draw from the position with lower string index to avoid double-drawing
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        // Check if this long diagonal goes to pos2
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'right') {
          // Long down-right diagonal (2 frets forward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'left') {
          // Long down-left diagonal (2 frets backward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }

      if (isPos2 && pos2.stringIndex < pos1.stringIndex) {
        // Check if this long diagonal goes to pos1
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'right') {
          // Long down-right diagonal (2 frets forward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'left') {
          // Long down-left diagonal (2 frets backward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }

      // Handle up directions - draw from the position with higher string index
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        // Check if this long diagonal goes to pos2
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // Long up-right diagonal (2 frets forward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Long up-left diagonal (2 frets backward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }

      if (isPos2 && pos2.stringIndex > pos1.stringIndex) {
        // Check if this long diagonal goes to pos1
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'up-right') {
          // Long up-right diagonal (2 frets forward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Long up-left diagonal (2 frets backward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a vertical long diagonal line should be highlighted
  const shouldHighlightVerticalLongDiagonal = (
    stringIndex: number,
    fret: number,
    direction: 'right' | 'left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const _isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Handle connections based on direction
      if (direction === 'right' || direction === 'left') {
        // Only draw from the position with lower string index to avoid double-drawing
        if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
          // Check if this vertical long diagonal goes to pos2
          const targetString = pos2.stringIndex;
          const targetFret = fret2;

          if (direction === 'right') {
            // Vertical long down-right diagonal (1 fret forward, 2 strings down)
            if (
              targetString === stringIndex + 2 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'left') {
            // Vertical long down-left diagonal (1 fret backward, 2 strings down)
            if (
              targetString === stringIndex + 2 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          }
        }

        // Also check the reverse direction for down connections (when current position is pos2)
        // Only needed when one position is an open string to handle the connection properly
        if (
          _isPos2 &&
          pos2.stringIndex < pos1.stringIndex &&
          (fret1 === 0 || fret2 === 0)
        ) {
          const targetString = pos1.stringIndex;
          const targetFret = fret1;

          if (direction === 'right') {
            // Vertical long down-right diagonal (1 fret forward, 2 strings down)
            if (
              targetString === stringIndex + 2 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'left') {
            // Vertical long down-left diagonal (1 fret backward, 2 strings down)
            if (
              targetString === stringIndex + 2 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          }
        }
      } else if (direction === 'up-right' || direction === 'up-left') {
        // Only draw from the position with higher string index to avoid double-drawing
        if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
          // Check if this vertical long diagonal goes to pos2
          const targetString = pos2.stringIndex;
          const targetFret = fret2;

          if (direction === 'up-right') {
            // Vertical long up-right diagonal (1 fret forward, 2 strings up)
            if (
              targetString === stringIndex - 2 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'up-left') {
            // Vertical long up-left diagonal (1 fret backward, 2 strings up)
            if (
              targetString === stringIndex - 2 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          }
        }

        // Also check the reverse direction for up connections (when current position is pos2)
        // Only needed when one position is an open string to handle the connection properly
        if (
          _isPos2 &&
          pos2.stringIndex > pos1.stringIndex &&
          (fret1 === 0 || fret2 === 0)
        ) {
          const targetString = pos1.stringIndex;
          const targetFret = fret1;

          if (direction === 'up-right') {
            // Vertical long up-right diagonal (1 fret forward, 2 strings up)
            if (
              targetString === stringIndex - 2 &&
              targetFret === currentFret + 1
            ) {
              return true;
            }
          } else if (direction === 'up-left') {
            // Vertical long up-left diagonal (1 fret backward, 2 strings up)
            if (
              targetString === stringIndex - 2 &&
              targetFret === currentFret - 1
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if an up diagonal line should be highlighted
  const shouldHighlightUpDiagonal = (
    stringIndex: number,
    fret: number,
    direction: 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // For up diagonals, only draw from the position with higher string index
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // Up-right diagonal (2 frets forward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Up-left diagonal (2 frets backward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for up connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex > pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'up-right') {
          // Up-right diagonal (2 frets forward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Up-left diagonal (2 frets backward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a down diagonal line should be highlighted (2 strings down, 2 frets)
  const shouldHighlightDownDiagonal = (
    stringIndex: number,
    fret: number,
    direction: 'down-right' | 'down-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // For down diagonals, only draw from the position with lower string index
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'down-right') {
          // Down-right diagonal (2 frets forward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // Down-left diagonal (2 frets backward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for down connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex < pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'down-right') {
          // Down-right diagonal (2 frets forward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret + 2
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // Down-left diagonal (2 frets backward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret - 2
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if an extra long diagonal line should be highlighted (1 string, 3 frets)
  const shouldHighlightExtraLongDiagonal = (
    stringIndex: number,
    fret: number,
    direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Draw from the position with lower string index for down connections
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'down-right') {
          // Extra long down-right diagonal (3 frets forward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // Extra long down-left diagonal (3 frets backward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Draw from the position with higher string index for up connections
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // Extra long up-right diagonal (3 frets forward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Extra long up-left diagonal (3 frets backward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for down connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex < pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'down-right') {
          // Extra long down-right diagonal (3 frets forward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // Extra long down-left diagonal (3 frets backward, 1 string down)
          if (
            targetString === stringIndex + 1 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for up connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex > pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'up-right') {
          // Extra long up-right diagonal (3 frets forward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // Extra long up-left diagonal (3 frets backward, 1 string up)
          if (
            targetString === stringIndex - 1 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a 3 strings, 1 fret diagonal line should be highlighted
  const shouldHighlight3String1FretDiagonal = (
    stringIndex: number,
    fret: number,
    direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Draw from the position with lower string index for down connections
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'down-right') {
          // 3 strings down, 1 fret forward
          if (
            targetString === stringIndex + 3 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 3 strings down, 1 fret backward
          if (
            targetString === stringIndex + 3 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for down connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex < pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'down-right') {
          // 3 strings down, 1 fret forward
          if (
            targetString === stringIndex + 3 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 3 strings down, 1 fret backward
          if (
            targetString === stringIndex + 3 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        }
      }

      // Draw from the position with higher string index for up connections
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // 3 strings up, 1 fret forward
          if (
            targetString === stringIndex - 3 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 3 strings up, 1 fret backward
          if (
            targetString === stringIndex - 3 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex > pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'up-right') {
          // 3 strings up, 1 fret forward
          if (
            targetString === stringIndex - 3 &&
            targetFret === currentFret + 1
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 3 strings up, 1 fret backward
          if (
            targetString === stringIndex - 3 &&
            targetFret === currentFret - 1
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a 3x3 diagonal line should be highlighted (3 strings, 3 frets)
  const shouldHighlight3x3Diagonal = (
    stringIndex: number,
    fret: number,
    direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const _isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Draw from the position with lower string index for down connections
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'down-right') {
          // 3x3 down-right diagonal (3 frets forward, 3 strings down)
          if (
            targetString === stringIndex + 3 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 3x3 down-left diagonal (3 frets backward, 3 strings down)
          if (
            targetString === stringIndex + 3 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Draw from the position with higher string index for up connections
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // 3x3 up-right diagonal (3 frets forward, 3 strings up)
          if (
            targetString === stringIndex - 3 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 3x3 up-left diagonal (3 frets backward, 3 strings up)
          if (
            targetString === stringIndex - 3 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a cross-fretboard diagonal line should be highlighted

  // Helper function to check if a basic cross-fretboard diagonal line should be highlighted
  const shouldHighlightBasicCrossFretboardDiagonal = (
    stringIndex: number,
    stringCount: 4 | 5,
    direction: 'down' | 'up',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      // Check for the specific cross-fretboard diagonal connections
      if (direction === 'down') {
        // From open top string to 2nd fret bottom string
        if (
          (pos1.stringIndex === 0 &&
            fret1 === 0 &&
            pos2.stringIndex === stringCount - 1 &&
            fret2 === 2) ||
          (pos2.stringIndex === 0 &&
            fret2 === 0 &&
            pos1.stringIndex === stringCount - 1 &&
            fret1 === 2)
        ) {
          return stringIndex === 0; // Only highlight from the top string
        }
      } else if (direction === 'up') {
        // From open bottom string to 2nd fret top string
        if (
          (pos1.stringIndex === stringCount - 1 &&
            fret1 === 0 &&
            pos2.stringIndex === 0 &&
            fret2 === 2) ||
          (pos2.stringIndex === stringCount - 1 &&
            fret2 === 0 &&
            pos1.stringIndex === 0 &&
            fret1 === 2)
        ) {
          return stringIndex === stringCount - 1; // Only highlight from the bottom string
        }
      }
    }

    return false;
  };

  const shouldHighlightBasicCrossFretboardDiagonalAnyFret = (
    stringIndex: number,
    fret: number,
    stringCount: 4 | 5,
    direction: 'down' | 'up',
    fretDirection?: 'forward' | 'backward',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Check for three-by-two diagonal connections (3 strings apart, 2 frets apart)
      const stringDiff = Math.abs(pos1.stringIndex - pos2.stringIndex);
      const fretDiff = Math.abs(fret1 - fret2);

      // Three-by-Two diagonal: 3 strings apart, 2 frets apart
      if (stringDiff === 3 && fretDiff === 2) {
        // Only draw from the actual starting position of the connection
        // Use a consistent rule: always draw from the position with the lower string index + lower fret
        const shouldDrawFromPos1 =
          pos1.stringIndex < pos2.stringIndex ||
          (pos1.stringIndex === pos2.stringIndex && fret1 < fret2);

        if (isPos1 && shouldDrawFromPos1) {
          const targetString = pos2.stringIndex;
          const targetFret = fret2;

          // Check if this matches the expected direction and fret direction
          if (direction === 'down' && targetString === stringIndex + 3) {
            if (fretDirection === 'forward' && targetFret === currentFret + 2) {
              return true;
            }
            if (
              fretDirection === 'backward' &&
              targetFret === currentFret - 2
            ) {
              return true;
            }
            if (
              !fretDirection &&
              (targetFret === currentFret + 2 || targetFret === currentFret - 2)
            ) {
              return true;
            }
          }

          if (direction === 'up' && targetString === stringIndex - 3) {
            if (fretDirection === 'forward' && targetFret === currentFret + 2) {
              return true;
            }
            if (
              fretDirection === 'backward' &&
              targetFret === currentFret - 2
            ) {
              return true;
            }
            if (
              !fretDirection &&
              (targetFret === currentFret + 2 || targetFret === currentFret - 2)
            ) {
              return true;
            }
          }
        }

        // Also draw from pos2 if it should be the starting position
        const shouldDrawFromPos2 =
          pos2.stringIndex < pos1.stringIndex ||
          (pos2.stringIndex === pos1.stringIndex && fret2 < fret1);

        if (isPos2 && shouldDrawFromPos2) {
          const targetString = pos1.stringIndex;
          const targetFret = fret1;

          // Check if this matches the expected direction and fret direction
          if (direction === 'down' && targetString === stringIndex + 3) {
            if (fretDirection === 'forward' && targetFret === currentFret + 2) {
              return true;
            }
            if (
              fretDirection === 'backward' &&
              targetFret === currentFret - 2
            ) {
              return true;
            }
            if (
              !fretDirection &&
              (targetFret === currentFret + 2 || targetFret === currentFret - 2)
            ) {
              return true;
            }
          }

          if (direction === 'up' && targetString === stringIndex - 3) {
            if (fretDirection === 'forward' && targetFret === currentFret + 2) {
              return true;
            }
            if (
              fretDirection === 'backward' &&
              targetFret === currentFret - 2
            ) {
              return true;
            }
            if (
              !fretDirection &&
              (targetFret === currentFret + 2 || targetFret === currentFret - 2)
            ) {
              return true;
            }
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a 4x2 diagonal line should be highlighted (2 strings, 4 frets)
  const shouldHighlight4x2Diagonal = (
    stringIndex: number,
    fret: number,
    direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Draw from the position with lower string index for down connections
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'down-right') {
          // 4x2 down-right diagonal (4 frets forward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret + 4
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 4x2 down-left diagonal (4 frets backward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret - 4
          ) {
            return true;
          }
        }
      }

      // Draw from the position with higher string index for up connections
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // 4x2 up-right diagonal (4 frets forward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret + 4
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 4x2 up-left diagonal (4 frets backward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret - 4
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for down connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex < pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'down-right') {
          // 4x2 down-right diagonal (4 frets forward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret + 4
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 4x2 down-left diagonal (4 frets backward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret - 4
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for up connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex > pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'up-right') {
          // 4x2 up-right diagonal (4 frets forward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret + 4
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 4x2 up-left diagonal (4 frets backward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret - 4
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // Helper function to check if a 2x3 diagonal line should be highlighted (2 strings, 3 frets)
  const shouldHighlight2x3Diagonal = (
    stringIndex: number,
    fret: number,
    direction: 'down-right' | 'down-left' | 'up-right' | 'up-left',
  ) => {
    if (allConnections.length === 0) return false;

    for (const connection of allConnections) {
      const { pos1, pos2 } = connection;
      const fret1 = pos1.fret === 'open' ? 0 : pos1.fret;
      const fret2 = pos2.fret === 'open' ? 0 : pos2.fret;

      const currentFret = fret;
      const isPos1 = pos1.stringIndex === stringIndex && fret1 === currentFret;
      const isPos2 = pos2.stringIndex === stringIndex && fret2 === currentFret;

      // Draw from the position with lower string index for down connections
      if (isPos1 && pos1.stringIndex < pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'down-right') {
          // 2x3 down-right diagonal (3 frets forward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 2x3 down-left diagonal (3 frets backward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Draw from the position with higher string index for up connections
      if (isPos1 && pos1.stringIndex > pos2.stringIndex) {
        const targetString = pos2.stringIndex;
        const targetFret = fret2;

        if (direction === 'up-right') {
          // 2x3 up-right diagonal (3 frets forward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 2x3 up-left diagonal (3 frets backward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for down connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex < pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'down-right') {
          // 2x3 down-right diagonal (3 frets forward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'down-left') {
          // 2x3 down-left diagonal (3 frets backward, 2 strings down)
          if (
            targetString === stringIndex + 2 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }

      // Also check the reverse direction for up connections (when current position is pos2)
      // Only needed when one position is an open string to handle the connection properly
      if (
        isPos2 &&
        pos2.stringIndex > pos1.stringIndex &&
        (fret1 === 0 || fret2 === 0)
      ) {
        const targetString = pos1.stringIndex;
        const targetFret = fret1;

        if (direction === 'up-right') {
          // 2x3 up-right diagonal (3 frets forward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret + 3
          ) {
            return true;
          }
        } else if (direction === 'up-left') {
          // 2x3 up-left diagonal (3 frets backward, 2 strings up)
          if (
            targetString === stringIndex - 2 &&
            targetFret === currentFret - 3
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  return (
    <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
      <CardContent className="p-4">
        {/* Header with Tilt Controls */}
        <div className="relative mb-4">
          <h3 className="text-xl font-semibold text-white text-center">
            Fretboard
          </h3>
          {/* Tilt Controls - Top Right */}
          <div className="absolute top-0 right-0 flex flex-col gap-1">
            <button
              onClick={increaseTilt}
              className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs flex items-center justify-center transition-colors"
              title={`Increase tilt (currently ${tiltAngle}°)`}
            >
              ↑
            </button>
            <button
              onClick={decreaseTilt}
              className="w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs flex items-center justify-center transition-colors"
              title={`Decrease tilt (currently ${tiltAngle}°)`}
            >
              ↓
            </button>
          </div>
        </div>

        {/* String Picker & Controls */}
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          {[4, 5].map((count) => (
            <button
              key={count}
              onClick={() => setStringCount(count as 4 | 5)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                stringCount === count
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {count} String
            </button>
          ))}
          <button
            onClick={resetSelection}
            className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-red-600 text-white hover:bg-red-500"
          >
            Reset
          </button>
          <button
            onClick={resetTiltToDefault}
            className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-green-600 text-white hover:bg-green-500"
            title="Reset tilt to default 35°"
          >
            Default
          </button>
          <button
            onClick={setTiltToFlat}
            className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-purple-600 text-white hover:bg-purple-500"
            title="Set tilt to flat view (0°)"
          >
            Flat
          </button>
        </div>

        {/* Fretboard with Dynamic String Count - 35deg tilt with hover fix */}
        <div
          className="space-y-3 flex flex-col items-center py-9"
          style={{ perspective: '1000px' }}
        >
          <div
            className="space-y-4 flex flex-col items-center relative"
            style={{
              transform: `rotateX(${tiltAngle}deg)`,
              transformStyle: 'preserve-3d',
              backfaceVisibility: 'visible',
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))',
            }}
          >
            {/* Strings and Dots with Integrated Grid Lines */}
            {stringConfigs[stringCount].map((stringName, stringIndex) => (
              <div
                key={`string-${stringIndex}`}
                className="flex items-center gap-3 relative"
              >
                {/* Horizontal String Line - Behind this string's dots */}
                {/* Always show the default line - now starting from open string center */}
                <div
                  className="absolute bg-white opacity-20 pointer-events-none"
                  style={{
                    height: '1px',
                    width: 'calc(100% - 13px)', // Full width minus half open string square
                    top: '50%',
                    left: '13px', // Start from open string center
                    transform: 'translateY(-50%)',
                    zIndex: 1,
                  }}
                />
                {/* Highlighted segments overlay when dots are connected */}
                {getHorizontalSegments(stringIndex).map((segment, index) => (
                  <div
                    key={`horizontal-${stringIndex}-${index}`}
                    className="absolute bg-green-500 opacity-100 pointer-events-none"
                    style={{
                      height: '2px',
                      width: `${segment.width}px`,
                      top: '50%',
                      left: `${segment.start}px`,
                      transform: 'translateY(-50%)',
                      zIndex: 15, // Below dots (which are z-20) but above default grid (z-1)
                      borderRadius: '2px',
                    }}
                  />
                ))}

                {/* Vertical Line for Open String - Only render for first string to avoid duplicates */}
                {stringIndex === 0 && (
                  <>
                    {/* Always show the default vertical line for open strings */}
                    <div
                      className="absolute bg-white opacity-20 pointer-events-none"
                      style={{
                        width: '1px',
                        height: `${(stringConfigs[stringCount].length - 1) * 42}px`, // Height from first to last string center
                        top: '13px', // Start from center of first string
                        left: '13px', // Center of open string
                        zIndex: 1,
                      }}
                    />
                    {/* Highlighted segments overlay for open string connections */}
                    {getVerticalSegments(0).map((segment, index) => (
                      <div
                        key={`vertical-open-${index}`}
                        className="absolute bg-green-500 opacity-100 pointer-events-none"
                        style={{
                          width: '2px',
                          height: `${segment.height}px`,
                          top: `${segment.start}px`,
                          left: '13px', // Center of open string
                          zIndex: 15, // Below dots (which are z-20) but above default grid (z-1)
                          borderRadius: '2px',
                        }}
                      />
                    ))}
                  </>
                )}

                {/* Open String Square */}
                <div
                  className={`${
                    isDotSelected(stringIndex, 'open')
                      ? 'bg-green-500 text-black'
                      : isDragOverTarget(stringIndex, 'open')
                        ? 'bg-blue-500 text-white border-2 border-blue-300'
                        : 'bg-slate-600 hover:bg-blue-400 text-white'
                  } cursor-pointer flex items-center justify-center text-sm font-semibold rounded-md relative`}
                  style={{
                    width: '26px',
                    height: '26px',
                    zIndex: 20,
                    pointerEvents: 'auto',
                    transition: 'background-color 0.15s ease-in-out',
                    opacity: isDotBeingDragged(stringIndex, 'open') ? 0.5 : 1,
                  }}
                  title={`Open ${stringName} String`}
                  onClick={() => handleDotClick(stringIndex, 'open')}
                  draggable={isDotSelected(stringIndex, 'open')}
                  onDragStart={(e) => handleDragStart(e, stringIndex, 'open')}
                  onDragOver={handleDragOver}
                  onDragEnter={() => handleDragEnter(stringIndex, 'open')}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, stringIndex, 'open')}
                  onDragEnd={handleDragEnd}
                >
                  {isDotSelected(stringIndex, 'open')
                    ? getDotOrder(stringIndex, 'open')
                    : stringName}
                </div>

                {/* Diagonal Lines from Open String */}
                {/* Down-Right diagonal from open string to first fret of next string */}
                {stringIndex < stringConfigs[stringCount].length - 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightLine('diagonal', stringIndex, 0, 'right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-15'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 42 + 38 * 38)}px`, // Diagonal distance: sqrt(vertical² + horizontal²)
                      height: shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42, 38) * (180 / Math.PI)}deg)`, // Precise angle using arctangent
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'right',
                      )
                        ? 15
                        : 1, // Below dots but above grid
                      borderRadius: shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Long Diagonal Lines from Open String - Down-Right (skip 1 fret) */}
                {stringIndex < stringConfigs[stringCount].length - 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightLongDiagonal(stringIndex, 0, 'right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 42 + 38 * 2 * (38 * 2))}px`, // Longer diagonal: sqrt(vertical² + (2*horizontal)²)
                      height: shouldHighlightLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42, 38 * 2) * (180 / Math.PI)}deg)`, // Angle for 2-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Vertical Long Diagonal Lines from Open String - Down-Right (skip 1 string) */}
                {stringIndex < stringConfigs[stringCount].length - 2 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 38)}px`, // Vertical long diagonal: sqrt((2*vertical)² + horizontal²)
                      height: shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 2, 38) * (180 / Math.PI)}deg)`, // Angle for 2-string jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Down Diagonal Lines from Open String - Down-Right (2 frets forward, 2 strings down) */}
                {stringIndex < stringConfigs[stringCount].length - 2 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightDownDiagonal(stringIndex, 0, 'down-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 2 * (38 * 2))}px`, // 2 strings + 2 frets diagonal distance
                      height: shouldHighlightDownDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 2, 38 * 2) * (180 / Math.PI)}deg)`, // Positive vertical for down, 2-string and 2-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightDownDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightDownDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Extra Long Diagonal Lines from Open String - Down-Right (3 frets forward, 1 string down) */}
                {stringIndex < stringConfigs[stringCount].length - 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 42 + 38 * 3 * (38 * 3))}px`, // Extra long diagonal: sqrt(vertical² + (3*horizontal)²)
                      height: shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42, 38 * 3) * (180 / Math.PI)}deg)`, // Angle for 3-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* 3 Strings 1 Fret Diagonal Lines from Open String - Down-Right (1 fret forward, 3 strings down) */}
                {stringIndex < stringConfigs[stringCount].length - 3 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 38)}px`, // 3 strings + 1 fret diagonal distance
                      height: shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 3, 38) * (180 / Math.PI)}deg)`, // Angle for 3-string and 1-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* 3x3 Diagonal Lines from Open String - Down-Right (3 frets forward, 3 strings down) */}
                {stringIndex < stringConfigs[stringCount].length - 3 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight3x3Diagonal(stringIndex, 0, 'down-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 3 * (38 * 3))}px`, // 3 strings + 3 frets diagonal distance
                      height: shouldHighlight3x3Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 3, 38 * 3) * (180 / Math.PI)}deg)`, // Angle for 3-string and 3-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight3x3Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight3x3Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Three-by-Two Diagonal Lines from Open String - Down-Right (2 frets forward, 3 strings down) */}
                {stringIndex < stringConfigs[stringCount].length - 3 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                        stringIndex,
                        0,
                        stringCount,
                        'down',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 2 * (38 * 2))}px`, // 3 strings + 2 frets diagonal distance
                      height: shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                        stringIndex,
                        0,
                        stringCount,
                        'down',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 3, 38 * 2) * (180 / Math.PI)}deg)`, // Angle for 3-string and 2-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                        stringIndex,
                        0,
                        stringCount,
                        'down',
                      )
                        ? 15
                        : 1,
                      borderRadius:
                        shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                          stringIndex,
                          0,
                          stringCount,
                          'down',
                        )
                          ? '2px'
                          : '0',
                    }}
                  />
                )}

                {/* Four-by-Two Diagonal Lines from Open String - Down-Right (4 frets forward, 2 strings down) */}
                {stringIndex < stringConfigs[stringCount].length - 2 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight4x2Diagonal(stringIndex, 0, 'down-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 4 * (38 * 4))}px`, // 2 strings + 4 frets diagonal distance
                      height: shouldHighlight4x2Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 2, 38 * 4) * (180 / Math.PI)}deg)`, // Angle for 2-string and 4-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight4x2Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight4x2Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Four-by-Two Diagonal Lines from Open String - Up-Right (4 frets forward, 2 strings up) */}
                {stringIndex > 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight4x2Diagonal(stringIndex, 0, 'up-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 4 * (38 * 4))}px`, // 2 strings + 4 frets diagonal distance
                      height: shouldHighlight4x2Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42 * 2, 38 * 4) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight4x2Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight4x2Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Two-by-Three Diagonal Lines from Open String - Down-Right (3 frets forward, 2 strings down) */}
                {stringIndex < stringConfigs[stringCount].length - 2 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight2x3Diagonal(stringIndex, 0, 'down-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 3 * (38 * 3))}px`, // 2 strings + 3 frets diagonal distance
                      height: shouldHighlight2x3Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 2, 38 * 3) * (180 / Math.PI)}deg)`, // Angle for 2-string and 3-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight2x3Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight2x3Diagonal(
                        stringIndex,
                        0,
                        'down-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Two-by-Three Diagonal Lines from Open String - Up-Right (3 frets forward, 2 strings up) */}
                {stringIndex > 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight2x3Diagonal(stringIndex, 0, 'up-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 3 * (38 * 3))}px`, // 2 strings + 3 frets diagonal distance
                      height: shouldHighlight2x3Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42 * 2, 38 * 3) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight2x3Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight2x3Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Up-Right Diagonal Lines from Open String (1 fret forward, 1 string up) */}
                {stringIndex > 0 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-15'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 42 + 38 * 38)}px`, // Diagonal distance: sqrt(vertical² + horizontal²)
                      height: shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42, 38) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightLine(
                        'diagonal',
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Long Diagonal Lines from Open String - Up-Right (2 frets forward, 1 string up) */}
                {stringIndex > 0 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightLongDiagonal(stringIndex, 0, 'up-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 42 + 38 * 2 * (38 * 2))}px`, // Longer diagonal: sqrt(vertical² + (2*horizontal)²)
                      height: shouldHighlightLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42, 38 * 2) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Vertical Long Diagonal Lines from Open String - Up-Right (1 fret forward, 2 strings up) */}
                {stringIndex > 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 38)}px`, // Vertical long diagonal: sqrt((2*vertical)² + horizontal²)
                      height: shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42 * 2, 38) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightVerticalLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Up Diagonal Lines from Open String - Up-Right (2 frets forward, 2 strings up) */}
                {stringIndex > 1 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightUpDiagonal(stringIndex, 0, 'up-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 2 * (38 * 2))}px`, // 2 strings + 2 frets diagonal distance
                      height: shouldHighlightUpDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42 * 2, 38 * 2) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightUpDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightUpDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Extra Long Diagonal Lines from Open String - Up-Right (3 frets forward, 1 string up) */}
                {stringIndex > 0 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 42 + 38 * 3 * (38 * 3))}px`, // Extra long diagonal: sqrt(vertical² + (3*horizontal)²)
                      height: shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42, 38 * 3) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightExtraLongDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* 3 Strings 1 Fret Diagonal Lines from Open String - Up-Right (1 fret forward, 3 strings up) */}
                {stringIndex > 2 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 38)}px`, // 3 strings + 1 fret diagonal distance
                      height: shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-(42 * 3), 38) * (180 / Math.PI)}deg)`, // Negative vertical for up, 3-string and 1-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight3String1FretDiagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* 3x3 Diagonal Lines from Open String - Up-Right (3 frets forward, 3 strings up) */}
                {stringIndex > 2 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlight3x3Diagonal(stringIndex, 0, 'up-right')
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-10'
                    }`}
                    style={{
                      width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 3 * (38 * 3))}px`, // 3 strings + 3 frets diagonal distance
                      height: shouldHighlight3x3Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-(42 * 3), 38 * 3) * (180 / Math.PI)}deg)`, // Negative vertical for up, 3-string and 3-fret jump
                      transformOrigin: '0 0',
                      zIndex: shouldHighlight3x3Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlight3x3Diagonal(
                        stringIndex,
                        0,
                        'up-right',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Basic Cross-Fretboard Diagonal Lines - Open String to 2nd Fret Opposite End */}

                {/* From Open G (top) to 2nd Fret E (bottom) - 4-string bass */}
                {stringIndex === 0 && stringCount === 4 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-15'
                    }`}
                    style={{
                      width: `${Math.sqrt((42 * 3) ** 2 + (38 * 2) ** 2)}px`, // 3 strings down, 2 frets forward
                      height: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 3, 38 * 2) * (180 / Math.PI)}deg)`,
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* From Open E (bottom) to 2nd Fret G (top) - 4-string bass */}
                {stringIndex === 3 && stringCount === 4 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-15'
                    }`}
                    style={{
                      width: `${Math.sqrt((42 * 3) ** 2 + (38 * 2) ** 2)}px`, // 3 strings up, 2 frets forward
                      height: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42 * 3, 38 * 2) * (180 / Math.PI)}deg)`, // Negative for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* From Open G (top) to 2nd Fret B (bottom) - 5-string bass */}
                {stringIndex === 0 && stringCount === 5 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-15'
                    }`}
                    style={{
                      width: `${Math.sqrt((42 * 4) ** 2 + (38 * 2) ** 2)}px`, // 4 strings down, 2 frets forward
                      height: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(42 * 4, 38 * 2) * (180 / Math.PI)}deg)`,
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'down',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* From Open B (bottom) to 2nd Fret G (top) - 5-string bass */}
                {stringIndex === 4 && stringCount === 5 && (
                  <div
                    className={`absolute pointer-events-none ${
                      shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? 'bg-green-500 opacity-100'
                        : 'bg-white opacity-15'
                    }`}
                    style={{
                      width: `${Math.sqrt((42 * 4) ** 2 + (38 * 2) ** 2)}px`, // 4 strings up, 2 frets forward
                      height: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? '2px'
                        : '1px',
                      top: '13px', // Center of open string
                      left: '13px', // Center of open string
                      transform: `rotate(${Math.atan2(-42 * 4, 38 * 2) * (180 / Math.PI)}deg)`, // Negative for up direction
                      transformOrigin: '0 0',
                      zIndex: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? 15
                        : 1,
                      borderRadius: shouldHighlightBasicCrossFretboardDiagonal(
                        stringIndex,
                        stringCount,
                        'up',
                      )
                        ? '2px'
                        : '0',
                    }}
                  />
                )}

                {/* Fret Dots with Vertical Lines */}
                <div className="flex items-center gap-3 relative">
                  {frets.map((fret, fretIndex) => (
                    <div
                      key={`string-${stringIndex}-fret-${fret}`}
                      className="relative"
                    >
                      {/* Vertical Fret Line - Only render for first string to avoid duplicates */}
                      {stringIndex === 0 && (
                        <>
                          {/* Always show the default vertical line */}
                          <div
                            className="absolute bg-white opacity-20 pointer-events-none"
                            style={{
                              width: '1px',
                              height: `${(stringConfigs[stringCount].length - 1) * 42}px`, // Height from first to last string center
                              top: '13px', // Start from center of first string
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 1,
                            }}
                          />
                          {/* Highlighted segments overlay when dots are connected */}
                          {getVerticalSegments(fret).map((segment, index) => (
                            <div
                              key={`vertical-${fret}-${index}`}
                              className="absolute bg-green-500 opacity-100 pointer-events-none"
                              style={{
                                width: '2px',
                                height: `${segment.height}px`,
                                top: `${segment.start}px`,
                                left: '50%',
                                transform: 'translateX(-50%)',
                                zIndex: 15, // Below dots (which are z-20) but above default grid (z-1)
                                borderRadius: '2px',
                              }}
                            />
                          ))}
                        </>
                      )}

                      {/* Diagonal Lines - Down-Right */}
                      {fretIndex < frets.length - 1 &&
                        stringIndex < stringConfigs[stringCount].length - 1 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-15'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 42 + 38 * 38)}px`, // Diagonal distance: sqrt(vertical² + horizontal²)
                              height: shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42, 38) * (180 / Math.PI)}deg)`, // Precise angle using arctangent
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? 15
                                : 1, // Below dots but above grid
                              borderRadius: shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Diagonal Lines - Down-Left */}
                      {fretIndex > 0 &&
                        stringIndex < stringConfigs[stringCount].length - 1 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-15'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 42 + 38 * 38)}px`, // Same diagonal distance
                              height: shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42, -38) * (180 / Math.PI)}deg)`, // Negative horizontal for left direction
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? 15
                                : 1, // Below dots but above grid
                              borderRadius: shouldHighlightLine(
                                'diagonal',
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Long Diagonal Lines - Down-Right (skip 1 fret) */}
                      {fretIndex < frets.length - 2 &&
                        stringIndex < stringConfigs[stringCount].length - 1 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 42 + 38 * 2 * (38 * 2))}px`, // Longer diagonal: sqrt(vertical² + (2*horizontal)²)
                              height: shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42, 38 * 2) * (180 / Math.PI)}deg)`, // Angle for 2-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Long Diagonal Lines - Down-Left (skip 1 fret) */}
                      {fretIndex > 1 &&
                        stringIndex < stringConfigs[stringCount].length - 1 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 42 + 38 * 2 * (38 * 2))}px`, // Same longer diagonal distance
                              height: shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42, -(38 * 2)) * (180 / Math.PI)}deg)`, // Negative for left direction, 2-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlightLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Vertical Long Diagonal Lines - Down-Right (skip 1 string) */}
                      {fretIndex < frets.length - 1 &&
                        stringIndex < stringConfigs[stringCount].length - 2 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 38)}px`, // Vertical long diagonal: sqrt((2*vertical)² + horizontal²)
                              height: shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 2, 38) * (180 / Math.PI)}deg)`, // Angle for 2-string jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'right',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Vertical Long Diagonal Lines - Down-Left (skip 1 string) */}
                      {fretIndex > 0 &&
                        stringIndex < stringConfigs[stringCount].length - 2 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 38)}px`, // Same vertical long diagonal distance
                              height: shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 2, -38) * (180 / Math.PI)}deg)`, // Negative for left direction, 2-string jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlightVerticalLongDiagonal(
                                stringIndex,
                                fret,
                                'left',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Vertical Long Diagonal Lines - Up-Right (1 fret forward, 2 strings up) */}
                      {fretIndex < frets.length - 1 && stringIndex > 1 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 38)}px`, // Vertical long diagonal: sqrt((2*vertical)² + horizontal²)
                            height: shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-42 * 2, 38) * (180 / Math.PI)}deg)`, // Negative vertical for up direction
                            transformOrigin: '0 0',
                            zIndex: shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* Vertical Long Diagonal Lines - Up-Left (1 fret backward, 2 strings up) */}
                      {fretIndex > 0 && stringIndex > 1 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 38)}px`, // Same vertical long diagonal distance
                            height: shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-42 * 2, -38) * (180 / Math.PI)}deg)`, // Negative vertical and horizontal for up-left direction
                            transformOrigin: '0 0',
                            zIndex: shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlightVerticalLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* Long Diagonal Lines - Up-Right (2 frets forward, 2 strings up) */}
                      {fretIndex < frets.length - 2 &&
                        stringIndex > 1 &&
                        shouldHighlightUpDiagonal(
                          stringIndex,
                          fret,
                          'up-right',
                        ) && (
                          <div
                            className="absolute pointer-events-none bg-green-500 opacity-100"
                            style={{
                              width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 2 * (38 * 2))}px`, // 2 strings + 2 frets diagonal distance
                              height: '2px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(-(42 * 2), 38 * 2) * (180 / Math.PI)}deg)`, // Negative vertical for up, 2-string and 2-fret jump
                              transformOrigin: '0 0',
                              zIndex: 15,
                              borderRadius: '2px',
                            }}
                          />
                        )}

                      {/* Long Diagonal Lines - Up-Left (2 frets backward, 2 strings up) */}
                      {fretIndex > 1 &&
                        stringIndex > 1 &&
                        shouldHighlightUpDiagonal(
                          stringIndex,
                          fret,
                          'up-left',
                        ) && (
                          <div
                            className="absolute pointer-events-none bg-green-500 opacity-100"
                            style={{
                              width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 2 * (38 * 2))}px`, // 2 strings + 2 frets diagonal distance
                              height: '2px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(-(42 * 2), -(38 * 2)) * (180 / Math.PI)}deg)`, // Negative vertical and horizontal for up-left, 2-string and 2-fret jump
                              transformOrigin: '0 0',
                              zIndex: 15,
                              borderRadius: '2px',
                            }}
                          />
                        )}

                      {/* Long Diagonal Lines - Down-Right (2 frets forward, 2 strings down) */}
                      {fretIndex < frets.length - 2 &&
                        stringIndex < stringConfigs[stringCount].length - 2 &&
                        shouldHighlightDownDiagonal(
                          stringIndex,
                          fret,
                          'down-right',
                        ) && (
                          <div
                            className="absolute pointer-events-none bg-green-500 opacity-100"
                            style={{
                              width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 2 * (38 * 2))}px`, // 2 strings + 2 frets diagonal distance
                              height: '2px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 2, 38 * 2) * (180 / Math.PI)}deg)`, // Positive vertical for down, 2-string and 2-fret jump
                              transformOrigin: '0 0',
                              zIndex: 15,
                              borderRadius: '2px',
                            }}
                          />
                        )}

                      {/* Long Diagonal Lines - Down-Left (2 frets backward, 2 strings down) */}
                      {fretIndex > 1 &&
                        stringIndex < stringConfigs[stringCount].length - 2 &&
                        shouldHighlightDownDiagonal(
                          stringIndex,
                          fret,
                          'down-left',
                        ) && (
                          <div
                            className="absolute pointer-events-none bg-green-500 opacity-100"
                            style={{
                              width: `${Math.sqrt(42 * 2 * (42 * 2) + 38 * 2 * (38 * 2))}px`, // 2 strings + 2 frets diagonal distance
                              height: '2px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 2, -(38 * 2)) * (180 / Math.PI)}deg)`, // Positive vertical for down, negative horizontal for left, 2-string and 2-fret jump
                              transformOrigin: '0 0',
                              zIndex: 15,
                              borderRadius: '2px',
                            }}
                          />
                        )}

                      {/* Extra Long Diagonal Lines - Down-Right (3 frets forward, 1 string down) */}
                      {fretIndex < frets.length - 3 &&
                        stringIndex < stringConfigs[stringCount].length - 1 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 42 + 38 * 3 * (38 * 3))}px`, // Extra long diagonal: sqrt(vertical² + (3*horizontal)²)
                              height: shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42, 38 * 3) * (180 / Math.PI)}deg)`, // Angle for 3-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Extra Long Diagonal Lines - Down-Left (3 frets backward, 1 string down) */}
                      {fretIndex > 2 &&
                        stringIndex < stringConfigs[stringCount].length - 1 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 42 + 38 * 3 * (38 * 3))}px`, // Same extra long diagonal distance
                              height: shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42, -(38 * 3)) * (180 / Math.PI)}deg)`, // Negative for left direction, 3-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlightExtraLongDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* Extra Long Diagonal Lines - Up-Right (3 frets forward, 1 string up) */}
                      {fretIndex < frets.length - 3 && stringIndex > 0 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 42 + 38 * 3 * (38 * 3))}px`, // Extra long diagonal: sqrt(vertical² + (3*horizontal)²)
                            height: shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-42, 38 * 3) * (180 / Math.PI)}deg)`, // Negative vertical for up, 3-fret jump
                            transformOrigin: '0 0',
                            zIndex: shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* Extra Long Diagonal Lines - Up-Left (3 frets backward, 1 string up) */}
                      {fretIndex > 2 && stringIndex > 0 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 42 + 38 * 3 * (38 * 3))}px`, // Same extra long diagonal distance
                            height: shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-42, -(38 * 3)) * (180 / Math.PI)}deg)`, // Negative vertical for up, negative horizontal for left, 3-fret jump
                            transformOrigin: '0 0',
                            zIndex: shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlightExtraLongDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* 3 Strings 1 Fret Diagonal Lines - Down-Right (1 fret forward, 3 strings down) */}
                      {fretIndex < frets.length - 1 &&
                        stringIndex < stringConfigs[stringCount].length - 3 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 38)}px`, // 3 strings + 1 fret diagonal distance
                              height: shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 3, 38) * (180 / Math.PI)}deg)`, // Angle for 3-string and 1-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* 3 Strings 1 Fret Diagonal Lines - Down-Left (1 fret backward, 3 strings down) */}
                      {fretIndex > 0 &&
                        stringIndex < stringConfigs[stringCount].length - 3 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 38)}px`, // Same 3 strings + 1 fret diagonal distance
                              height: shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 3, -38) * (180 / Math.PI)}deg)`, // Negative for left direction, 3-string and 1-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlight3String1FretDiagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* 3 Strings 1 Fret Diagonal Lines - Up-Right (1 fret forward, 3 strings up) */}
                      {fretIndex < frets.length - 1 && stringIndex >= 3 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 38)}px`, // 3 strings + 1 fret diagonal distance
                            height: shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-(42 * 3), 38) * (180 / Math.PI)}deg)`, // Negative vertical for up, 3-string and 1-fret jump
                            transformOrigin: '0 0',
                            zIndex: shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* 3 Strings 1 Fret Diagonal Lines - Up-Left (1 fret backward, 3 strings up) */}
                      {fretIndex > 0 && stringIndex >= 3 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 38)}px`, // Same 3 strings + 1 fret diagonal distance
                            height: shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-(42 * 3), -38) * (180 / Math.PI)}deg)`, // Negative vertical for up, negative horizontal for left, 3-string and 1-fret jump
                            transformOrigin: '0 0',
                            zIndex: shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlight3String1FretDiagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* 3x3 Diagonal Lines - Down-Right (3 frets forward, 3 strings down) */}
                      {fretIndex < frets.length - 3 &&
                        stringIndex < stringConfigs[stringCount].length - 3 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 3 * (38 * 3))}px`, // 3 strings + 3 frets diagonal distance
                              height: shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 3, 38 * 3) * (180 / Math.PI)}deg)`, // Angle for 3-string and 3-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-right',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* 3x3 Diagonal Lines - Down-Left (3 frets backward, 3 strings down) */}
                      {fretIndex >= 2 &&
                        stringIndex < stringConfigs[stringCount].length - 3 && (
                          <div
                            className={`absolute pointer-events-none ${
                              shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? 'bg-green-500 opacity-100'
                                : 'bg-white opacity-10'
                            }`}
                            style={{
                              width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 3 * (38 * 3))}px`, // Same 3x3 diagonal distance
                              height: shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? '2px'
                                : '1px',
                              top: '13px', // Center of current dot
                              left: '13px', // Center of current dot
                              transform: `rotate(${Math.atan2(42 * 3, -(38 * 3)) * (180 / Math.PI)}deg)`, // Negative for left direction, 3-string and 3-fret jump
                              transformOrigin: '0 0',
                              zIndex: shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? 15
                                : 1,
                              borderRadius: shouldHighlight3x3Diagonal(
                                stringIndex,
                                fret,
                                'down-left',
                              )
                                ? '2px'
                                : '0',
                            }}
                          />
                        )}

                      {/* 3x3 Diagonal Lines - Up-Right (3 frets forward, 3 strings up) */}
                      {fretIndex < frets.length - 3 && stringIndex >= 3 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 3 * (38 * 3))}px`, // 3 strings + 3 frets diagonal distance
                            height: shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-(42 * 3), 38 * 3) * (180 / Math.PI)}deg)`, // Negative vertical for up, 3-string and 3-fret jump
                            transformOrigin: '0 0',
                            zIndex: shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-right',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* 3x3 Diagonal Lines - Up-Left (3 frets backward, 3 strings up) */}
                      {fretIndex >= 2 && stringIndex >= 3 && (
                        <div
                          className={`absolute pointer-events-none ${
                            shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 'bg-green-500 opacity-100'
                              : 'bg-white opacity-10'
                          }`}
                          style={{
                            width: `${Math.sqrt(42 * 3 * (42 * 3) + 38 * 3 * (38 * 3))}px`, // Same 3x3 diagonal distance
                            height: shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '1px',
                            top: '13px', // Center of current dot
                            left: '13px', // Center of current dot
                            transform: `rotate(${Math.atan2(-(42 * 3), -(38 * 3)) * (180 / Math.PI)}deg)`, // Negative vertical for up, negative horizontal for left, 3-string and 3-fret jump
                            transformOrigin: '0 0',
                            zIndex: shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? 15
                              : 1,
                            borderRadius: shouldHighlight3x3Diagonal(
                              stringIndex,
                              fret,
                              'up-left',
                            )
                              ? '2px'
                              : '0',
                          }}
                        />
                      )}

                      {/* Basic Cross-Fretboard Diagonal Lines - 2 Frets Forward */}

                      {/* Three-by-Two Diagonal Lines (3 strings apart, 2 frets apart) */}

                      {/* Forward Direction: 2 frets forward */}
                      {fretIndex < frets.length - 2 && (
                        <>
                          {/* From any string to 3 strings down, 2 frets forward */}
                          {stringIndex <
                            stringConfigs[stringCount].length - 3 &&
                            shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                              stringIndex,
                              fret,
                              stringCount,
                              'down',
                              'forward',
                            ) && (
                              <div
                                className="absolute pointer-events-none bg-green-500 opacity-100"
                                style={{
                                  width: `${Math.sqrt((42 * 3) ** 2 + (38 * 2) ** 2)}px`, // 3 strings down, 2 frets forward
                                  height: '2px',
                                  top: '13px', // Center of current dot
                                  left: '13px', // Center of current dot
                                  transform: `rotate(${Math.atan2(42 * 3, 38 * 2) * (180 / Math.PI)}deg)`,
                                  transformOrigin: '0 0',
                                  zIndex: 15,
                                  borderRadius: '2px',
                                }}
                              />
                            )}

                          {/* From any string to 3 strings up, 2 frets forward */}
                          {stringIndex >= 3 &&
                            shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                              stringIndex,
                              fret,
                              stringCount,
                              'up',
                            ) && (
                              <div
                                className="absolute pointer-events-none bg-green-500 opacity-100"
                                style={{
                                  width: `${Math.sqrt((42 * 3) ** 2 + (38 * 2) ** 2)}px`, // 3 strings up, 2 frets forward
                                  height: '2px',
                                  top: '13px', // Center of current dot
                                  left: '13px', // Center of current dot
                                  transform: `rotate(${Math.atan2(-42 * 3, 38 * 2) * (180 / Math.PI)}deg)`, // Negative for up direction
                                  transformOrigin: '0 0',
                                  zIndex: 15,
                                  borderRadius: '2px',
                                }}
                              />
                            )}
                        </>
                      )}

                      {/* Backward Direction: 2 frets backward */}
                      {fretIndex >= 2 && (
                        <>
                          {/* From any string to 3 strings down, 2 frets backward */}
                          {stringIndex <
                            stringConfigs[stringCount].length - 3 &&
                            shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                              stringIndex,
                              fret,
                              stringCount,
                              'down',
                              'backward',
                            ) && (
                              <div
                                className="absolute pointer-events-none bg-green-500 opacity-100"
                                style={{
                                  width: `${Math.sqrt((42 * 3) ** 2 + (38 * 2) ** 2)}px`, // 3 strings down, 2 frets backward
                                  height: '2px',
                                  top: '13px', // Center of current dot
                                  left: '13px', // Center of current dot
                                  transform: `rotate(${Math.atan2(42 * 3, -(38 * 2)) * (180 / Math.PI)}deg)`, // Negative horizontal for backward
                                  transformOrigin: '0 0',
                                  zIndex: 15,
                                  borderRadius: '2px',
                                }}
                              />
                            )}

                          {/* From any string to 3 strings up, 2 frets backward */}
                          {stringIndex >= 3 &&
                            shouldHighlightBasicCrossFretboardDiagonalAnyFret(
                              stringIndex,
                              fret,
                              stringCount,
                              'up',
                              'backward',
                            ) && (
                              <div
                                className="absolute pointer-events-none bg-green-500 opacity-100"
                                style={{
                                  width: `${Math.sqrt((42 * 3) ** 2 + (38 * 2) ** 2)}px`, // 3 strings up, 2 frets backward
                                  height: '2px',
                                  top: '13px', // Center of current dot
                                  left: '13px', // Center of current dot
                                  transform: `rotate(${Math.atan2(-42 * 3, -(38 * 2)) * (180 / Math.PI)}deg)`, // Negative for up direction and backward
                                  transformOrigin: '0 0',
                                  zIndex: 15,
                                  borderRadius: '2px',
                                }}
                              />
                            )}
                        </>
                      )}

                      {/* Four-by-Two Diagonal Lines (2 strings apart, 4 frets apart) */}

                      {/* Forward Direction: 4 frets forward */}
                      {fretIndex < frets.length - 4 && (
                        <>
                          {/* From any string to 2 strings down, 4 frets forward */}
                          {stringIndex <
                            stringConfigs[stringCount].length - 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 4) ** 2)}px`, // 2 strings down, 4 frets forward
                                height: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(42 * 2, 38 * 4) * (180 / Math.PI)}deg)`,
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}

                          {/* From any string to 2 strings up, 4 frets forward */}
                          {stringIndex >= 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 4) ** 2)}px`, // 2 strings up, 4 frets forward
                                height: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(-42 * 2, 38 * 4) * (180 / Math.PI)}deg)`, // Negative for up direction
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}
                        </>
                      )}

                      {/* Backward Direction: 4 frets backward */}
                      {fretIndex >= 4 && (
                        <>
                          {/* From any string to 2 strings down, 4 frets backward */}
                          {stringIndex <
                            stringConfigs[stringCount].length - 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 4) ** 2)}px`, // 2 strings down, 4 frets backward
                                height: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(42 * 2, -(38 * 4)) * (180 / Math.PI)}deg)`, // Negative horizontal for backward
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}

                          {/* From any string to 2 strings up, 4 frets backward */}
                          {stringIndex >= 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 4) ** 2)}px`, // 2 strings up, 4 frets backward
                                height: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(-42 * 2, -(38 * 4)) * (180 / Math.PI)}deg)`, // Negative for up direction and backward
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight4x2Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}
                        </>
                      )}

                      {/* Two-by-Three Diagonal Lines (2 strings apart, 3 frets apart) */}

                      {/* Forward Direction: 3 frets forward */}
                      {fretIndex < frets.length - 3 && (
                        <>
                          {/* From any string to 2 strings down, 3 frets forward */}
                          {stringIndex <
                            stringConfigs[stringCount].length - 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 3) ** 2)}px`, // 2 strings down, 3 frets forward
                                height: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(42 * 2, 38 * 3) * (180 / Math.PI)}deg)`,
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-right',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}

                          {/* From any string to 2 strings up, 3 frets forward */}
                          {stringIndex >= 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 3) ** 2)}px`, // 2 strings up, 3 frets forward
                                height: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(-42 * 2, 38 * 3) * (180 / Math.PI)}deg)`, // Negative for up direction
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-right',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}
                        </>
                      )}

                      {/* Backward Direction: 3 frets backward */}
                      {fretIndex >= 3 && (
                        <>
                          {/* From any string to 2 strings down, 3 frets backward */}
                          {stringIndex <
                            stringConfigs[stringCount].length - 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 3) ** 2)}px`, // 2 strings down, 3 frets backward
                                height: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(42 * 2, -(38 * 3)) * (180 / Math.PI)}deg)`, // Negative horizontal for backward
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'down-left',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}

                          {/* From any string to 2 strings up, 3 frets backward */}
                          {stringIndex >= 2 && (
                            <div
                              className={`absolute pointer-events-none ${
                                shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? 'bg-green-500 opacity-100'
                                  : 'bg-white opacity-10'
                              }`}
                              style={{
                                width: `${Math.sqrt((42 * 2) ** 2 + (38 * 3) ** 2)}px`, // 2 strings up, 3 frets backward
                                height: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? '2px'
                                  : '1px',
                                top: '13px', // Center of current dot
                                left: '13px', // Center of current dot
                                transform: `rotate(${Math.atan2(-42 * 2, -(38 * 3)) * (180 / Math.PI)}deg)`, // Negative for up direction and backward
                                transformOrigin: '0 0',
                                zIndex: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? 15
                                  : 1,
                                borderRadius: shouldHighlight2x3Diagonal(
                                  stringIndex,
                                  fret,
                                  'up-left',
                                )
                                  ? '2px'
                                  : '0',
                              }}
                            />
                          )}
                        </>
                      )}

                      {/* Fret Dot */}
                      <div
                        className={`${
                          isDotSelected(stringIndex, fret)
                            ? 'bg-green-500 text-black'
                            : isDragOverTarget(stringIndex, fret)
                              ? 'bg-blue-500 text-white border-2 border-blue-300'
                              : [3, 5, 7, 9, 12].includes(fret)
                                ? 'bg-slate-500 hover:bg-blue-400 text-white'
                                : 'bg-slate-600 hover:bg-blue-400 text-white'
                        } rounded-full cursor-pointer relative flex items-center justify-center text-sm font-semibold`}
                        style={{
                          width: '26px',
                          height: '26px',
                          zIndex: 20,
                          pointerEvents: 'auto',
                          transform: 'rotateX(0deg)', // Counter-rotate to ensure proper hit detection
                          transformStyle: 'preserve-3d',
                          transition: 'background-color 0.15s ease-in-out',
                          opacity: isDotBeingDragged(stringIndex, fret)
                            ? 0.5
                            : 1,
                        }}
                        title={`String ${stringIndex + 1}, Fret ${fret}${[3, 5, 7, 9, 12].includes(fret) ? ' (Fret Marker)' : ''}`}
                        onClick={() => handleDotClick(stringIndex, fret)}
                        draggable={isDotSelected(stringIndex, fret)}
                        onDragStart={(e) =>
                          handleDragStart(e, stringIndex, fret)
                        }
                        onDragOver={handleDragOver}
                        onDragEnter={() => handleDragEnter(stringIndex, fret)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, stringIndex, fret)}
                        onDragEnd={handleDragEnd}
                      >
                        {isDotSelected(stringIndex, fret)
                          ? getDotOrder(stringIndex, fret)
                          : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
