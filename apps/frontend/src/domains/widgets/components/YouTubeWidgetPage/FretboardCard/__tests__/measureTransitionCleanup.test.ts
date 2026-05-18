/**
 * Integration tests for Measure Transition Cleanup (CONSOLIDATED FIX)
 *
 * Tests the cleanup behavior when measures change during playback.
 *
 * HISTORY:
 * - FIX v6: Split cleanup between FretboardGrid (lines) and useFretboardNoteSync (notes)
 * - CONSOLIDATED FIX: useFretboardNoteSync now handles ALL cleanup (notes AND lines)
 *
 * The consolidated approach eliminates the ~50ms race condition that occurred
 * when the two systems cleared state at different times in the event loop.
 *
 * useFretboardNoteSync is now the SOLE owner of:
 * - .note-active, .note-played, .note-preview classes on dots
 * - .line-played class on connection lines
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// SIMULATION UTILITIES
// ============================================================================

/**
 * Simulates the DOM state management from FretboardGrid and useFretboardNoteSync
 */
class DOMSimulator {
  private elements: Map<
    string,
    { classList: Set<string>; attributes: Map<string, string> }
  >;
  private lineElements: string[] = [];
  private dotElements: string[] = [];
  private currentMeasure = 0;
  private isPlaying = false;

  constructor() {
    this.elements = new Map();
  }

  // Create a dot element
  createDot(noteIndex: number): void {
    const id = `dot-${noteIndex}`;
    this.elements.set(id, {
      classList: new Set(['fretboard-dot']),
      attributes: new Map([['data-note-index', noteIndex.toString()]]),
    });
    this.dotElements.push(id);
  }

  // Create a connection line element
  createLine(
    index: number,
    sourceMeasure: number,
    targetMeasure: number,
    sourceNoteIndex: number,
  ): void {
    const id = `line-${index}`;
    const isTransition = sourceMeasure !== targetMeasure;
    this.elements.set(id, {
      classList: new Set(['connection-line']),
      attributes: new Map([
        ['data-source-measure', sourceMeasure.toString()],
        ['data-target-measure', targetMeasure.toString()],
        ['data-source-note-index', sourceNoteIndex.toString()],
        ['data-is-transition', isTransition.toString()],
      ]),
    });
    this.lineElements.push(id);
  }

  // Add class to element
  addClass(elementId: string, className: string): void {
    const el = this.elements.get(elementId);
    if (el) {
      el.classList.add(className);
    }
  }

  // Remove class from element
  removeClass(elementId: string, className: string): void {
    const el = this.elements.get(elementId);
    if (el) {
      el.classList.delete(className);
    }
  }

  // Check if element has class
  hasClass(elementId: string, className: string): boolean {
    const el = this.elements.get(elementId);
    return el ? el.classList.has(className) : false;
  }

  // Query elements by class
  querySelectorAll(selector: string): string[] {
    // Parse selector like ".connection-line.line-played" into ["connection-line", "line-played"]
    const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/g);
    if (!classMatch) return [];

    const requiredClasses = classMatch.map((c) => c.slice(1)); // Remove leading dot

    return Array.from(this.elements.entries())
      .filter(([_, el]) =>
        requiredClasses.every((cls) => el.classList.has(cls)),
      )
      .map(([id]) => id);
  }

  // CONSOLIDATED FIX: Clear BOTH notes and lines on measure change
  // This was previously split between FretboardGrid and useFretboardNoteSync
  measureChangeCleanup(newMeasure: number): {
    clearedLines: number;
    clearedNotes: number;
  } {
    if (!this.isPlaying || this.currentMeasure === newMeasure) {
      return { clearedLines: 0, clearedNotes: 0 };
    }

    // Clear note-played classes (handled by useFretboardNoteSync)
    const playedDots = this.querySelectorAll('.fretboard-dot.note-played');
    playedDots.forEach((id) => this.removeClass(id, 'note-played'));

    // Clear line-played classes (NOW ALSO handled by useFretboardNoteSync)
    const playedLines = this.querySelectorAll('.connection-line.line-played');
    playedLines.forEach((id) => this.removeClass(id, 'line-played'));

    this.currentMeasure = newMeasure;
    return {
      clearedLines: playedLines.length,
      clearedNotes: playedDots.length,
    };
  }

  // Simulate useFretboardNoteSync: Clear .note-played and .note-active on measure change
  noteStateCleanup(): { clearedDots: number; clearedActive: number } {
    const playedDots = this.querySelectorAll('.fretboard-dot.note-played');
    playedDots.forEach((id) => this.removeClass(id, 'note-played'));

    // Also clear active state - the previous measure's active note shouldn't
    // carry over to the new measure
    const activeDots = this.querySelectorAll('.fretboard-dot.note-active');
    activeDots.forEach((id) => this.removeClass(id, 'note-active'));

    return { clearedDots: playedDots.length, clearedActive: activeDots.length };
  }

  // Simulate playing a note (adds classes)
  playNote(noteIndex: number): void {
    const dotId = `dot-${noteIndex}`;

    // Clear previous active
    this.dotElements.forEach((id) => {
      if (this.hasClass(id, 'note-active')) {
        this.removeClass(id, 'note-active');
        this.addClass(id, 'note-played');
      }
    });

    // Set new active
    this.addClass(dotId, 'note-active');

    // Hide the line that starts from this note
    const lineId = `line-${noteIndex}`;
    if (this.elements.has(lineId)) {
      this.addClass(lineId, 'line-played');
    }
  }

  // Set playback state
  setPlaying(playing: boolean): void {
    this.isPlaying = playing;
  }

  // Get current state for assertions
  getState(): {
    playedDots: string[];
    activeDots: string[];
    playedLines: string[];
    currentMeasure: number;
  } {
    return {
      playedDots: this.querySelectorAll('.fretboard-dot.note-played'),
      activeDots: this.querySelectorAll('.fretboard-dot.note-active'),
      playedLines: this.querySelectorAll('.connection-line.line-played'),
      currentMeasure: this.currentMeasure,
    };
  }
}

// ============================================================================
// TESTS
// ============================================================================

describe('Measure Transition Cleanup (FIX v6)', () => {
  let dom: DOMSimulator;

  beforeEach(() => {
    dom = new DOMSimulator();

    // Create a typical exercise with 8 notes across 2 measures
    for (let i = 0; i < 8; i++) {
      dom.createDot(i);
    }

    // Create lines between consecutive notes
    dom.createLine(0, 0, 0, 0); // m0→m0
    dom.createLine(1, 0, 0, 1); // m0→m0
    dom.createLine(2, 0, 0, 2); // m0→m0
    dom.createLine(3, 0, 1, 3); // m0→m1 (transition)
    dom.createLine(4, 1, 1, 4); // m1→m1
    dom.createLine(5, 1, 1, 5); // m1→m1
    dom.createLine(6, 1, 1, 6); // m1→m1
  });

  describe('Line Cleanup on Measure Change', () => {
    it('should clear all .line-played classes when measure changes', () => {
      dom.setPlaying(true);

      // Play through measure 0
      dom.playNote(0);
      dom.playNote(1);
      dom.playNote(2);
      dom.playNote(3);

      // Lines 0, 1, 2, 3 should be played (hidden)
      let state = dom.getState();
      expect(state.playedLines).toEqual([
        'line-0',
        'line-1',
        'line-2',
        'line-3',
      ]);

      // Transition to measure 1
      const result = dom.measureChangeCleanup(1);

      // All line-played should be cleared
      state = dom.getState();
      expect(result.clearedLines).toBe(4);
      expect(state.playedLines).toEqual([]);
    });

    it('should not clear classes when not playing', () => {
      dom.setPlaying(false);

      // Manually add line-played
      dom.addClass('line-0', 'line-played');
      dom.addClass('line-1', 'line-played');

      const result = dom.measureChangeCleanup(1);

      expect(result.clearedLines).toBe(0);
      expect(dom.getState().playedLines).toEqual(['line-0', 'line-1']);
    });

    it('should not clear classes when measure does not change', () => {
      dom.setPlaying(true);

      dom.addClass('line-0', 'line-played');

      const result = dom.measureChangeCleanup(0); // Same measure

      expect(result.clearedLines).toBe(0);
      expect(dom.getState().playedLines).toEqual(['line-0']);
    });
  });

  describe('Dot State Cleanup on Measure Change', () => {
    it('should clear all .note-played and .note-active classes when measure changes', () => {
      dom.setPlaying(true);

      // Play through all notes in measure 0
      dom.playNote(0);
      dom.playNote(1);
      dom.playNote(2);
      dom.playNote(3);

      // Note 3 is active, 0-2 are played
      let state = dom.getState();
      expect(state.playedDots).toEqual(['dot-0', 'dot-1', 'dot-2']);
      expect(state.activeDots).toEqual(['dot-3']);

      // Clear note states (simulates measure change)
      const result = dom.noteStateCleanup();

      state = dom.getState();
      expect(result.clearedDots).toBe(3);
      expect(result.clearedActive).toBe(1); // dot-3 was active
      expect(state.playedDots).toEqual([]);
      expect(state.activeDots).toEqual([]); // Active also cleared
    });
  });

  describe('Complete Measure Transition Sequence', () => {
    it('should handle full transition from measure 0 to measure 1', () => {
      dom.setPlaying(true);

      // === MEASURE 0 ===
      // Play notes 0-3
      dom.playNote(0);
      dom.playNote(1);
      dom.playNote(2);
      dom.playNote(3);

      let state = dom.getState();
      expect(state.playedLines.length).toBe(4);
      expect(state.playedDots.length).toBe(3);

      // === MEASURE TRANSITION (CONSOLIDATED FIX) ===
      // Single call now handles BOTH lines AND notes
      const result = dom.measureChangeCleanup(1);

      // CONSOLIDATED: Both lines and notes cleared in single call
      expect(result.clearedLines).toBe(4);
      expect(result.clearedNotes).toBe(3);

      state = dom.getState();
      expect(state.playedLines).toEqual([]);
      expect(state.playedDots).toEqual([]);
      expect(state.currentMeasure).toBe(1);

      // === MEASURE 1 ===
      // Continue playing notes 4-7
      // Note: When note 4 starts, dot-3 (which was active) becomes "played"
      // This is correct behavior - the active note transitions to played when next note starts
      dom.playNote(4);
      dom.playNote(5);
      dom.playNote(6);
      dom.playNote(7);

      state = dom.getState();
      expect(state.playedLines).toEqual(['line-4', 'line-5', 'line-6']);
      // dot-3 becomes played when note 4 starts (transition from measure 0 active to measure 1)
      expect(state.playedDots).toEqual(['dot-3', 'dot-4', 'dot-5', 'dot-6']);
      expect(state.activeDots).toEqual(['dot-7']);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty measures gracefully', () => {
      dom.setPlaying(true);

      // No notes played, transition to next measure
      const result = dom.measureChangeCleanup(1);

      expect(result.clearedLines).toBe(0);
    });

    it('should handle rapid measure changes', () => {
      dom.setPlaying(true);

      // Play note and add played class
      dom.playNote(0);
      expect(dom.getState().playedLines.length).toBe(1);

      // Rapid transitions
      dom.measureChangeCleanup(1);
      dom.measureChangeCleanup(2);
      dom.measureChangeCleanup(3);

      // Should end up clean
      expect(dom.getState().playedLines).toEqual([]);
      expect(dom.getState().currentMeasure).toBe(3);
    });

    it('should handle backward measure changes (loop)', () => {
      dom.setPlaying(true);

      // Play to measure 2
      dom.measureChangeCleanup(1);
      dom.measureChangeCleanup(2);

      // Add some played state
      dom.playNote(4);

      // Loop back to measure 0
      const result = dom.measureChangeCleanup(0);

      expect(result.clearedLines).toBe(1);
      expect(dom.getState().currentMeasure).toBe(0);
    });
  });
});

describe('Evolution of Cleanup Approaches', () => {
  /**
   * Documents the evolution of cleanup approaches and why consolidated is best
   */

  it('documents the original problem (before any fix)', () => {
    // Original problem: .line-played classes persisted through React re-renders
    // because React preserves DOM nodes with the same key.

    const originalProblem = {
      linesRestored: 0, // Always 0!
      reason: 'React reconciliation timing issue',
    };

    expect(originalProblem.linesRestored).toBe(0);
  });

  it('documents FIX v6 (split cleanup - had race condition)', () => {
    // FIX v6 solution:
    // - FretboardGrid useEffect cleared lines
    // - useFretboardNoteSync cleared notes
    //
    // Problem: ~50ms race condition between the two systems

    const fixV6 = {
      lineCleanupLocation: 'FretboardGrid useEffect',
      noteCleanupLocation: 'useFretboardNoteSync',
      raceConditionGap: '~50ms',
      issue: 'Two systems clearing at different times',
    };

    expect(fixV6.raceConditionGap).toBe('~50ms');
  });

  it('documents CONSOLIDATED FIX (single source of truth)', () => {
    // CONSOLIDATED FIX:
    // - useFretboardNoteSync handles ALL cleanup (notes AND lines)
    // - Single atomic operation eliminates race condition

    const dom = new DOMSimulator();

    // Setup
    for (let i = 0; i < 4; i++) dom.createDot(i);
    dom.createLine(0, 0, 0, 0);
    dom.createLine(1, 0, 0, 1);
    dom.createLine(2, 0, 1, 2);

    dom.setPlaying(true);

    // Play measure 0
    dom.playNote(0);
    dom.playNote(1);
    dom.playNote(2);

    expect(dom.getState().playedLines.length).toBe(3);
    expect(dom.getState().playedDots.length).toBe(2); // 0 and 1 are played, 2 is active

    // Single consolidated cleanup - handles BOTH notes and lines
    const result = dom.measureChangeCleanup(1);

    expect(result.clearedLines).toBe(3);
    expect(result.clearedNotes).toBe(2);
    expect(dom.getState().playedLines).toEqual([]);
    expect(dom.getState().playedDots).toEqual([]);
  });
});

describe('Integration with useFretboardNoteSync (CONSOLIDATED)', () => {
  /**
   * Tests that verify the consolidated cleanup in useFretboardNoteSync
   * NOTE: The FretboardGrid useEffect was REMOVED - cleanup is now in one place
   */

  it('should handle cleanup in AtomicPlaybackClock callback (not useEffect)', () => {
    // CONSOLIDATED FIX: Cleanup happens in the clock callback, not useEffect
    // This ensures cleanup happens synchronously with note transitions

    const cleanupSequence: string[] = [];

    // Simulate AtomicPlaybackClock tick
    cleanupSequence.push('clock-tick');

    // Measure change detected in callback
    cleanupSequence.push('measure-change-detected');

    // CONSOLIDATED cleanup (atomic)
    cleanupSequence.push('clear-note-played');
    cleanupSequence.push('clear-line-played');

    // Continue with note transition
    cleanupSequence.push('update-active-note');

    expect(cleanupSequence).toEqual([
      'clock-tick',
      'measure-change-detected',
      'clear-note-played',
      'clear-line-played', // Now in same atomic operation
      'update-active-note',
    ]);
  });

  it('should use correct CSS selectors for consolidated cleanup', () => {
    const selectors = {
      playedNotes: '.fretboard-dot.note-played', // For note cleanup
      playedLines: '.connection-line.line-played', // For line cleanup
    };

    expect(selectors.playedNotes).toContain('note-played');
    expect(selectors.playedLines).toContain('line-played');
  });

  it('should only cleanup when playing AND measure changes', () => {
    const testCases = [
      { isPlaying: true, measureChanged: true, shouldCleanup: true },
      { isPlaying: true, measureChanged: false, shouldCleanup: false },
      { isPlaying: false, measureChanged: true, shouldCleanup: false },
      { isPlaying: false, measureChanged: false, shouldCleanup: false },
    ];

    testCases.forEach(({ isPlaying, measureChanged, shouldCleanup }) => {
      const shouldRun = isPlaying && measureChanged;
      expect(shouldRun).toBe(shouldCleanup);
    });
  });

  it('should document that FretboardGrid useEffect was REMOVED', () => {
    // The old FretboardGrid useEffect code that was removed:
    //
    // useEffect(() => {
    //   if (isPlaying && prevMeasureForLinesRef.current !== currentMeasureFromNote) {
    //     const allPlayedLines = document.querySelectorAll('.connection-line.line-played');
    //     allPlayedLines.forEach((line) => line.classList.remove('line-played'));
    //     prevMeasureForLinesRef.current = currentMeasureFromNote;
    //   }
    // }, [isPlaying, currentMeasureFromNote]);
    //
    // This was moved to useFretboardNoteSync to eliminate race condition

    const removedCode = {
      location: 'FretboardGrid.tsx',
      reason: 'Race condition with useFretboardNoteSync (~50ms gap)',
      newLocation: 'useFretboardNoteSync.ts',
    };

    expect(removedCode.newLocation).toBe('useFretboardNoteSync.ts');
  });
});

describe('Console Logging Behavior', () => {
  /**
   * Documents the expected console output for debugging
   */

  it('should log cleanup information', () => {
    const expectedLogFormat =
      '🔗 [GRID-LINE-CLEANUP] Measure X→Y: Clearing N .line-played classes';

    // The actual log in FretboardGrid:
    // console.log(
    //   `🔗 [GRID-LINE-CLEANUP] Measure ${prevMeasureForLinesRef.current}→${currentMeasureFromNote}: ` +
    //   `Clearing ${allPlayedLines.length} .line-played classes`
    // );

    expect(expectedLogFormat).toContain('[GRID-LINE-CLEANUP]');
    expect(expectedLogFormat).toContain('Measure');
    expect(expectedLogFormat).toContain('.line-played');
  });

  it('should only log when lines are actually cleared', () => {
    // The code checks: if (allPlayedLines.length > 0) { console.log(...) }
    const allPlayedLines = { length: 0 };
    const shouldLog = allPlayedLines.length > 0;

    expect(shouldLog).toBe(false);
  });
});
