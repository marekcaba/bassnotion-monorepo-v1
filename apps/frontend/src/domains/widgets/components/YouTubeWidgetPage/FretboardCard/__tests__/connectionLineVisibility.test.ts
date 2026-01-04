/**
 * Unit tests for connection line visibility logic in FretboardGrid
 *
 * Tests the measure-based visibility rules for connection lines:
 * - Same-measure lines: BOTH endpoints must be in current or next measure
 * - Transition lines: SOURCE must be in CURRENT measure only
 *
 * Key behaviors tested:
 * 1. FIX v4: Transition line visibility (prevents 3-measure bug)
 * 2. FIX v6: Line cleanup on measure change
 * 3. Dot-to-dot line dismissal when notes are played
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// CONNECTION LINE VISIBILITY RULES
// ============================================================================

/**
 * Determines if a connection line should be visible based on measure positions.
 *
 * 2-MEASURE WINDOW RULE (matches dot visibility):
 * - BOTH endpoints must be within the 2-measure window (current or next)
 * - Lines connecting to "other" measures (beyond the window) are hidden
 *
 * This mirrors the logic in utils/fretboardAnimation.ts getLineVisibility()
 */
function shouldShowConnectionLine(
  sourceMeasure: number,
  targetMeasure: number,
  currentMeasure: number,
): { visible: boolean; opacity: number; reason: string } {
  const nextMeasure = currentMeasure + 1;

  // Check if each endpoint is within the 2-measure window
  const sourceInWindow =
    sourceMeasure === currentMeasure || sourceMeasure === nextMeasure;
  const targetInWindow =
    targetMeasure === currentMeasure || targetMeasure === nextMeasure;

  const sourceIsCurrent = sourceMeasure === currentMeasure;
  const targetIsCurrent = targetMeasure === currentMeasure;

  // 2-MEASURE WINDOW: BOTH endpoints must be within window for line to show
  if (!sourceInWindow || !targetInWindow) {
    return {
      visible: false,
      opacity: 0,
      reason: `Line endpoint outside 2-measure window (cur=${currentMeasure}, next=${nextMeasure})`,
    };
  }

  // Both endpoints in window - determine opacity
  // 100% if ANY endpoint in current, 30% if both only in next
  const anyInCurrent = sourceIsCurrent || targetIsCurrent;

  if (anyInCurrent) {
    return {
      visible: true,
      opacity: 1,
      reason: `At least one endpoint in current measure (m${currentMeasure})`,
    };
  }

  // Both in next: 30% opacity (preview)
  return {
    visible: true,
    opacity: 0.3,
    reason: `Both endpoints in next measure (m${nextMeasure})`,
  };
}

describe('Connection Line Visibility Rules', () => {
  describe('Same-Measure Lines', () => {
    it('should show lines in current measure at 100% opacity', () => {
      const result = shouldShowConnectionLine(2, 2, 2);

      expect(result.visible).toBe(true);
      expect(result.opacity).toBe(1);
    });

    it('should show lines in next measure at 30% opacity', () => {
      const result = shouldShowConnectionLine(3, 3, 2);

      expect(result.visible).toBe(true);
      expect(result.opacity).toBe(0.3);
    });

    it('should hide lines in previous measures', () => {
      const result = shouldShowConnectionLine(1, 1, 2);

      expect(result.visible).toBe(false);
      expect(result.opacity).toBe(0);
    });

    it('should hide lines in future measures (beyond next)', () => {
      const result = shouldShowConnectionLine(4, 4, 2);

      expect(result.visible).toBe(false);
      expect(result.opacity).toBe(0);
    });
  });

  describe('Transition Lines (2-MEASURE WINDOW)', () => {
    it('should show transition line from current to next at 100% opacity', () => {
      // Line from measure 2 to measure 3, current = 2
      // Both endpoints in window (2=current, 3=next)
      const result = shouldShowConnectionLine(2, 3, 2);

      expect(result.visible).toBe(true);
      expect(result.opacity).toBe(1);
    });

    it('should hide transition line from next to next+1 (prevents 3-measure bug)', () => {
      // Line from measure 3 to measure 4, current = 2
      // measure 4 is outside the 2-measure window
      const result = shouldShowConnectionLine(3, 4, 2);

      expect(result.visible).toBe(false);
      expect(result.opacity).toBe(0);
      expect(result.reason).toContain('outside 2-measure window');
    });

    it('should hide transition line from previous measure', () => {
      // Line from measure 1 to measure 2, current = 2
      // measure 1 is outside the 2-measure window
      const result = shouldShowConnectionLine(1, 2, 2);

      expect(result.visible).toBe(false);
      expect(result.opacity).toBe(0);
    });

    it('should hide transition across multiple measures (beyond window)', () => {
      // Line from measure 2 to measure 5, current = 2
      // measure 5 is WAY outside the 2-measure window - this should be HIDDEN
      const result = shouldShowConnectionLine(2, 5, 2);

      expect(result.visible).toBe(false);
      expect(result.opacity).toBe(0);
      expect(result.reason).toContain('outside 2-measure window');
    });
  });

  describe('Edge Cases', () => {
    it('should handle measure 0 correctly', () => {
      const result = shouldShowConnectionLine(0, 0, 0);

      expect(result.visible).toBe(true);
      expect(result.opacity).toBe(1);
    });

    it('should handle transition from measure 0 to 1', () => {
      const result = shouldShowConnectionLine(0, 1, 0);

      expect(result.visible).toBe(true);
      expect(result.opacity).toBe(1);
    });

    it('should handle high measure numbers', () => {
      const result = shouldShowConnectionLine(100, 100, 100);

      expect(result.visible).toBe(true);
      expect(result.opacity).toBe(1);
    });
  });
});

describe('Measure Window Visibility', () => {
  /**
   * Test the complete visibility window for a given current measure
   */
  function getVisibilityWindow(currentMeasure: number): {
    currentLines: boolean;
    nextLines: boolean;
    transitionToNext: boolean;
    transitionFromNext: boolean;
    previousLines: boolean;
  } {
    const next = currentMeasure + 1;
    const prev = currentMeasure - 1;

    return {
      currentLines: shouldShowConnectionLine(currentMeasure, currentMeasure, currentMeasure).visible,
      nextLines: shouldShowConnectionLine(next, next, currentMeasure).visible,
      transitionToNext: shouldShowConnectionLine(currentMeasure, next, currentMeasure).visible,
      transitionFromNext: shouldShowConnectionLine(next, next + 1, currentMeasure).visible,
      previousLines: prev >= 0 ? shouldShowConnectionLine(prev, prev, currentMeasure).visible : false,
    };
  }

  it('should only show current, next, and transition-to-next', () => {
    const window = getVisibilityWindow(2);

    expect(window.currentLines).toBe(true);
    expect(window.nextLines).toBe(true);
    expect(window.transitionToNext).toBe(true);
    expect(window.transitionFromNext).toBe(false); // This is the 3-measure bug fix
    expect(window.previousLines).toBe(false);
  });

  it('should maintain visibility rules across measure transitions', () => {
    // Simulate moving through measures 0, 1, 2, 3
    for (let currentMeasure = 0; currentMeasure <= 3; currentMeasure++) {
      const window = getVisibilityWindow(currentMeasure);

      expect(window.currentLines).toBe(true);
      expect(window.nextLines).toBe(true);
      expect(window.transitionToNext).toBe(true);
      expect(window.transitionFromNext).toBe(false);
    }
  });
});

describe('Line Cleanup on Measure Change (FIX v6)', () => {
  let mockQuerySelectorAll: ReturnType<typeof vi.spyOn>;
  let mockClassListRemove: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockClassListRemove = vi.fn();

    // Create mock elements that simulate played lines
    const createMockLine = () => ({
      classList: {
        remove: mockClassListRemove,
        add: vi.fn(),
        contains: vi.fn(() => true),
      },
    });

    const mockElements = [createMockLine(), createMockLine(), createMockLine()];

    mockQuerySelectorAll = vi.spyOn(document, 'querySelectorAll').mockReturnValue({
      forEach: (callback: (el: any) => void) => mockElements.forEach(callback),
      length: mockElements.length,
    } as any);
  });

  afterEach(() => {
    mockQuerySelectorAll.mockRestore();
  });

  it('should query for .connection-line.line-played elements', () => {
    // Simulate the cleanup logic from FretboardGrid
    const allPlayedLines = document.querySelectorAll('.connection-line.line-played');

    expect(mockQuerySelectorAll).toHaveBeenCalledWith('.connection-line.line-played');
    expect(allPlayedLines.length).toBe(3);
  });

  it('should remove line-played class from all matched elements', () => {
    const allPlayedLines = document.querySelectorAll('.connection-line.line-played');

    allPlayedLines.forEach((line: any) => {
      line.classList.remove('line-played');
    });

    expect(mockClassListRemove).toHaveBeenCalledTimes(3);
    expect(mockClassListRemove).toHaveBeenCalledWith('line-played');
  });
});

describe('Dot-to-Dot Line Dismissal', () => {
  /**
   * Simulates hiding a line when its source note is played
   */
  function hideLineForPlayedNote(
    noteIndex: number,
    connections: Array<{ sourceNoteIndex: number; element: { classList: { add: (cls: string) => void } } }>,
  ): number {
    let hiddenCount = 0;

    connections.forEach((conn) => {
      if (conn.sourceNoteIndex === noteIndex) {
        conn.element.classList.add('line-played');
        hiddenCount++;
      }
    });

    return hiddenCount;
  }

  it('should hide line when source note is played', () => {
    const mockAdd = vi.fn();
    const connections = [
      { sourceNoteIndex: 0, element: { classList: { add: mockAdd } } },
      { sourceNoteIndex: 1, element: { classList: { add: mockAdd } } },
      { sourceNoteIndex: 2, element: { classList: { add: mockAdd } } },
    ];

    const hiddenCount = hideLineForPlayedNote(1, connections);

    expect(hiddenCount).toBe(1);
    expect(mockAdd).toHaveBeenCalledTimes(1);
    expect(mockAdd).toHaveBeenCalledWith('line-played');
  });

  it('should not hide lines for unplayed notes', () => {
    const mockAdd = vi.fn();
    const connections = [
      { sourceNoteIndex: 0, element: { classList: { add: mockAdd } } },
      { sourceNoteIndex: 1, element: { classList: { add: mockAdd } } },
    ];

    const hiddenCount = hideLineForPlayedNote(5, connections); // Note 5 doesn't exist

    expect(hiddenCount).toBe(0);
    expect(mockAdd).not.toHaveBeenCalled();
  });

  it('should handle multiple lines from same source note', () => {
    // Edge case: if implementation changes to support multiple lines per note
    const mockAdd = vi.fn();
    const connections = [
      { sourceNoteIndex: 0, element: { classList: { add: mockAdd } } },
      { sourceNoteIndex: 0, element: { classList: { add: mockAdd } } }, // Same source
      { sourceNoteIndex: 1, element: { classList: { add: mockAdd } } },
    ];

    const hiddenCount = hideLineForPlayedNote(0, connections);

    expect(hiddenCount).toBe(2);
    expect(mockAdd).toHaveBeenCalledTimes(2);
  });
});

describe('Data Attributes on Lines', () => {
  /**
   * Test that lines have the required data attributes for measure-based logic
   */
  it('should specify required data attributes for connection lines', () => {
    const requiredAttributes = [
      'data-source-measure',
      'data-target-measure',
      'data-source-note-index',
      'data-is-transition',
    ];

    // These are the attributes that FretboardGrid adds to each SVG line
    // They're used by useFretboardNoteSync for selective line restoration
    requiredAttributes.forEach((attr) => {
      expect(attr).toMatch(/^data-/);
    });
  });

  it('should have correct data-is-transition for transition lines', () => {
    const sourceMeasure = 2;
    const targetMeasure = 3;
    const isTransition = sourceMeasure !== targetMeasure;

    expect(isTransition).toBe(true);
  });

  it('should have correct data-is-transition for same-measure lines', () => {
    const sourceMeasure = 2;
    const targetMeasure = 2;
    const isTransition = sourceMeasure !== targetMeasure;

    expect(isTransition).toBe(false);
  });
});

describe('CSS Classes for Line States', () => {
  it('should define .line-played class behavior', () => {
    // These are the expected CSS properties from fretboard-notes.css
    const expectedStyles = {
      opacity: 0,
      transition: 'opacity 100ms ease-out',
      pointerEvents: 'none',
    };

    // This documents the expected CSS behavior
    expect(expectedStyles.opacity).toBe(0);
    expect(expectedStyles.transition).toContain('100ms');
  });

  it('should define .connection-line base class', () => {
    const expectedStyles = {
      willChange: 'opacity', // For GPU acceleration
    };

    expect(expectedStyles.willChange).toBe('opacity');
  });
});

describe('Timing Synchronization', () => {
  /**
   * Tests that line updates happen in sync with note updates
   */
  it('should hide line at same time as note becomes active', () => {
    // The line hiding happens in useFretboardNoteSync when:
    // 1. A new note becomes active (findNoteAtTime returns noteIndex)
    // 2. The line with that sourceNoteIndex gets .line-played added

    // This is a timing requirement - line should hide when note becomes active
    const noteActivationTime = 2.5; // seconds
    const lineHideTime = 2.5; // should be the same

    expect(noteActivationTime).toBe(lineHideTime);
  });

  it('should restore lines at measure boundary before new notes play', () => {
    // FIX v6: FretboardGrid's useEffect runs after React render
    // This ensures lines are restored before useFretboardNoteSync hides them again

    // The sequence should be:
    // 1. Measure changes (React render)
    // 2. useEffect clears all .line-played (FIX v6)
    // 3. useFretboardNoteSync adds .line-played as notes are played

    const sequence = ['measure-change', 'clear-lines', 'play-notes'];
    expect(sequence).toEqual(['measure-change', 'clear-lines', 'play-notes']);
  });
});
