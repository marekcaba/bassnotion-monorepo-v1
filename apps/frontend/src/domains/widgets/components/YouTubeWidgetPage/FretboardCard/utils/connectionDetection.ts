import type {
  FretboardPosition,
  Connection,
  SelectedDotsMap,
  Fret,
} from '../types/fretboardTypes';

/**
 * Creates a position key string for the selectedDots map
 * @param stringIndex - The string index
 * @param fret - The fret number or 'open'
 * @returns Position key string
 */
export const createPositionKey = (stringIndex: number, fret: Fret): string => {
  return `${stringIndex},${fret}`;
};

/**
 * Parses a position key back to position coordinates
 * @param positionKey - The position key string
 * @returns FretboardPosition object
 */
export const parsePositionKey = (positionKey: string): FretboardPosition => {
  if (!positionKey.includes(',')) {
    // Fallback for invalid keys
    return { stringIndex: 0, fret: 0 };
  }
  const indexOfComma = positionKey.indexOf(',');
  const stringIndexStr = positionKey.substring(0, indexOfComma);
  const fretStr = positionKey.substring(indexOfComma + 1);
  if (!stringIndexStr || !fretStr) {
    // Fallback for invalid keys
    return { stringIndex: 0, fret: 0 };
  }
  const stringIndex = parseInt(stringIndexStr, 10);
  const fret: Fret = fretStr === 'open' ? 'open' : parseInt(fretStr, 10);
  return { stringIndex, fret };
};

/**
 * Gets all selected positions from the selectedDots map
 * @param selectedDots - Map of selected dots
 * @returns Array of FretboardPosition objects
 */
export const getSelectedPositions = (
  selectedDots: SelectedDotsMap,
): FretboardPosition[] => {
  return Array.from(selectedDots.keys()).map(parsePositionKey);
};

/**
 * Gets all selected positions sorted by selection order
 * @param selectedDots - Map of selected dots
 * @returns Array of FretboardPosition objects sorted by selection order
 */
export const getSelectedPositionsByOrder = (
  selectedDots: SelectedDotsMap,
): FretboardPosition[] => {
  // Create array of all position-order pairs for all selections including duplicates
  const allSelections: Array<{ position: FretboardPosition; order: number }> =
    [];

  Array.from(selectedDots.entries()).forEach(([key, orders]) => {
    const position = parsePositionKey(key);
    if (Array.isArray(orders) && orders.length > 0) {
      // Add each order as a separate entry - this handles multiple selections of the same dot
      orders.forEach((order) => {
        allSelections.push({ position, order });
      });
    }
  });

  // Sort by order (each selection appears in its proper sequential position)
  allSelections.sort((a, b) => a.order - b.order);

  // Return just the positions in the correct order
  return allSelections.map((item) => item.position);
};

/**
 * Finds connections between consecutive selected dots in selection order
 * @param selectedDots - Map of selected dots
 * @returns Array of connections only between consecutive dots
 */
export const findAllConnections = (
  selectedDots: SelectedDotsMap,
): Connection[] => {
  const sortedPositions = getSelectedPositionsByOrder(selectedDots);
  const connections: Connection[] = [];

  // Only connect consecutive dots in selection order (like the original)
  for (let i = 0; i < sortedPositions.length - 1; i++) {
    const pos1 = sortedPositions[i];
    const pos2 = sortedPositions[i + 1];

    // Ensure both positions are valid before checking connection
    if (pos1 && pos2) {
      connections.push({ pos1, pos2 });
    }
  }

  return connections;
};

/**
 * Checks if a specific dot is selected
 * @param stringIndex - The string index
 * @param fret - The fret number or 'open'
 * @param selectedDots - Map of selected dots
 * @returns True if dot is selected
 */
export const isDotSelected = (
  stringIndex: number,
  fret: Fret,
  selectedDots: SelectedDotsMap,
): boolean => {
  const positionKey = createPositionKey(stringIndex, fret);
  return selectedDots.has(positionKey);
};

/**
 * Gets the order numbers for a specific dot
 * @param stringIndex - The string index
 * @param fret - The fret number or 'open'
 * @param selectedDots - Map of selected dots
 * @returns Array of order numbers (empty if not selected)
 */
export const getDotOrder = (
  stringIndex: number,
  fret: Fret,
  selectedDots: SelectedDotsMap,
): number[] => {
  const positionKey = createPositionKey(stringIndex, fret);
  const orders = selectedDots.get(positionKey);

  // Ensure we always return an array
  if (Array.isArray(orders)) {
    return orders;
  } else if (typeof orders === 'number') {
    return [orders]; // Convert single number to array
  } else {
    return []; // Fallback to empty array
  }
};

/**
 * Adds a dot to the selected dots map
 * @param stringIndex - The string index
 * @param fret - The fret number or 'open'
 * @param order - The order number
 * @param selectedDots - Map of selected dots
 * @returns New selectedDots map
 */
export const addSelectedDot = (
  stringIndex: number,
  fret: Fret,
  order: number,
  selectedDots: SelectedDotsMap,
): SelectedDotsMap => {
  const newSelectedDots = new Map(selectedDots);
  const positionKey = createPositionKey(stringIndex, fret);
  const existingOrders = newSelectedDots.get(positionKey) || [];

  // Add the new order if it's not already present
  if (!existingOrders.includes(order)) {
    newSelectedDots.set(
      positionKey,
      [...existingOrders, order].sort((a, b) => a - b),
    );
  }

  return newSelectedDots;
};

/**
 * Removes a dot from the selected dots map
 * @param stringIndex - The string index
 * @param fret - The fret number or 'open'
 * @param selectedDots - Map of selected dots
 * @returns New selectedDots map
 */
export const removeSelectedDot = (
  stringIndex: number,
  fret: Fret,
  selectedDots: SelectedDotsMap,
): SelectedDotsMap => {
  const newSelectedDots = new Map(selectedDots);
  const positionKey = createPositionKey(stringIndex, fret);
  newSelectedDots.delete(positionKey);
  return newSelectedDots;
};

/**
 * Toggles a dot's selection state
 * @param stringIndex - The string index
 * @param fret - The fret number or 'open'
 * @param order - The order number
 * @param selectedDots - Map of selected dots
 * @returns New selectedDots map
 */
export const toggleSelectedDot = (
  stringIndex: number,
  fret: Fret,
  order: number,
  selectedDots: SelectedDotsMap,
): SelectedDotsMap => {
  const positionKey = createPositionKey(stringIndex, fret);

  if (selectedDots.has(positionKey)) {
    return removeSelectedDot(stringIndex, fret, selectedDots);
  } else {
    return addSelectedDot(stringIndex, fret, order, selectedDots);
  }
};

/**
 * Clears all selected dots
 * @returns Empty selectedDots map
 */
export const clearSelectedDots = (): SelectedDotsMap => {
  return new Map();
};

/**
 * Gets the total number of selected dots
 * @param selectedDots - Map of selected dots
 * @returns Total count of selected dots
 */
export const getSelectedDotsCount = (selectedDots: SelectedDotsMap): number => {
  return selectedDots.size;
};

/**
 * Checks if there are any selected dots
 * @param selectedDots - Map of selected dots
 * @returns True if any dots are selected
 */
export const hasSelectedDots = (selectedDots: SelectedDotsMap): boolean => {
  return selectedDots.size > 0;
};

/**
 * Checks if a connection line between two positions crosses any selected dot
 * @param pos1 - Start position
 * @param pos2 - End position
 * @param selectedDots - Map of selected dots
 * @param sortedPositions - Array of positions sorted by selection order
 * @returns True if the connection crosses any intermediate selected dot
 */
export const doesConnectionCrossAnyDot = (
  pos1: FretboardPosition,
  pos2: FretboardPosition,
  selectedDots: SelectedDotsMap,
  sortedPositions: FretboardPosition[],
): boolean => {
  // Check all selected dots to see if any lie on the line between pos1 and pos2
  // (excluding pos1 and pos2 themselves)
  const allSelectedPositions = getSelectedPositions(selectedDots);

  for (const dotPosition of allSelectedPositions) {
    // Skip if this is one of the endpoints
    if (
      (dotPosition.stringIndex === pos1.stringIndex &&
        dotPosition.fret === pos1.fret) ||
      (dotPosition.stringIndex === pos2.stringIndex &&
        dotPosition.fret === pos2.fret)
    ) {
      continue;
    }

    // Check if this dot lies on the line between pos1 and pos2
    if (isPointOnLine(pos1, pos2, dotPosition)) {
      return true;
    }
  }

  return false;
};

/**
 * Helper function to check if a point lies on the line between two other points
 * @param start - Start position
 * @param end - End position
 * @param point - Point to check
 * @returns True if point lies on the line between start and end
 */
const isPointOnLine = (
  start: FretboardPosition,
  end: FretboardPosition,
  point: FretboardPosition,
): boolean => {
  // Convert fret positions to numbers for calculation
  const startFret = start.fret === 'open' ? 0 : start.fret;
  const endFret = end.fret === 'open' ? 0 : end.fret;
  const pointFret = point.fret === 'open' ? 0 : point.fret;

  // Check if point is within the bounding box of the line
  const minString = Math.min(start.stringIndex, end.stringIndex);
  const maxString = Math.max(start.stringIndex, end.stringIndex);
  const minFret = Math.min(startFret, endFret);
  const maxFret = Math.max(startFret, endFret);

  if (
    point.stringIndex < minString ||
    point.stringIndex > maxString ||
    pointFret < minFret ||
    pointFret > maxFret
  ) {
    return false;
  }

  // For horizontal lines (same string)
  if (start.stringIndex === end.stringIndex) {
    return (
      point.stringIndex === start.stringIndex &&
      pointFret > minFret &&
      pointFret < maxFret
    );
  }

  // For vertical lines (same fret)
  if (startFret === endFret) {
    return (
      pointFret === startFret &&
      point.stringIndex > minString &&
      point.stringIndex < maxString
    );
  }

  // For diagonal lines, use the line equation
  // Calculate if point is collinear with start and end
  const dxLine = endFret - startFret;
  const dyLine = end.stringIndex - start.stringIndex;
  const dxPoint = pointFret - startFret;
  const dyPoint = point.stringIndex - start.stringIndex;

  // Check if the cross product is zero (points are collinear)
  return Math.abs(dxLine * dyPoint - dyLine * dxPoint) < 0.0001;
};
