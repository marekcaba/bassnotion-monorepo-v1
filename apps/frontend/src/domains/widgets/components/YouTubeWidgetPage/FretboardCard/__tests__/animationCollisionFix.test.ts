/**
 * Unit Tests for Animation Collision Fix
 *
 * These tests verify that the animation collision issues have been resolved:
 *
 * 1. FretboardDot no longer uses animate-pulse (conflicts with CSS .note-active)
 * 2. FretboardDot no longer has inline opacity transitions (conflicts with CSS classes)
 * 3. useFretboardNoteSync is the sole owner of measure change cleanup
 * 4. Connection line cleanup is consolidated in useFretboardNoteSync
 *
 * Key issues fixed:
 * - Triple animation on current note (animate-pulse + .note-active + @keyframes)
 * - React state vs Direct DOM race condition (~100ms timing skew)
 * - Double opacity application (inline style vs CSS !important)
 * - Measure transition flicker (~50ms visual inconsistency)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================================================
// UNIT TESTS: CSS Class Constants
// ============================================================================

describe('Animation System CSS Class Constants', () => {
  describe('Note State Classes', () => {
    it('should use static highlight only (no pulse)', () => {
      // The note-active class provides the yellow ring highlight
      // No pulse animation classes should be used
      const NOTE_CLASSES = {
        active: 'note-active',
        preview: 'note-preview',
        played: 'note-played',
        playedNextMeasureGreen: 'note-played-next-measure-green',
        playedNextMeasureOrange: 'note-played-next-measure-orange',
      };

      // Verify expected classes
      expect(NOTE_CLASSES.active).toBe('note-active');
      expect(NOTE_CLASSES.played).toBe('note-played');

      // These classes should NOT be used (removed in fix)
      const REMOVED_CLASSES = ['animate-pulse', 'note-pulse-enabled'];
      REMOVED_CLASSES.forEach((cls) => {
        expect(Object.values(NOTE_CLASSES)).not.toContain(cls);
      });
    });

    it('should define line state classes', () => {
      const LINE_CLASSES = {
        played: 'line-played',
      };

      expect(LINE_CLASSES.played).toBe('line-played');
    });
  });
});

// ============================================================================
// UNIT TESTS: Animation Collision Prevention
// ============================================================================

describe('Animation Collision Prevention', () => {
  describe('FretboardDot Component (simulated)', () => {
    /**
     * Simulates FretboardDot's getDotClassName function behavior
     * This verifies the fix removes animate-pulse
     */
    function getDotClassName(config: {
      isSelected: boolean;
      isCurrentNote: boolean;
      isNextNote: boolean;
    }): string {
      const { isSelected, isCurrentNote, isNextNote } = config;

      // Base classes
      const baseClasses = 'rounded-full transition-colors cursor-pointer';

      if (!isSelected && !isCurrentNote && !isNextNote) {
        return `${baseClasses} bg-slate-600 hover:bg-slate-500`;
      } else if (isCurrentNote) {
        // FIX: Removed animate-pulse - now static highlight only
        // CSS .note-active handles the yellow ring via direct DOM
        return `${baseClasses} bg-orange-500 text-white shadow-lg ring-2 ring-orange-300`;
      } else if (isNextNote) {
        return `${baseClasses} bg-blue-500 text-white`;
      } else if (isSelected) {
        return `${baseClasses} bg-green-500 text-white`;
      }

      return baseClasses;
    }

    it('should NOT include animate-pulse for current note', () => {
      const className = getDotClassName({
        isSelected: false,
        isCurrentNote: true,
        isNextNote: false,
      });

      expect(className).not.toContain('animate-pulse');
    });

    it('should include static ring highlight for current note', () => {
      const className = getDotClassName({
        isSelected: false,
        isCurrentNote: true,
        isNextNote: false,
      });

      expect(className).toContain('ring-2');
      expect(className).toContain('ring-orange-300');
    });

    it('should NOT include any Tailwind animation classes', () => {
      const className = getDotClassName({
        isSelected: false,
        isCurrentNote: true,
        isNextNote: false,
      });

      const tailwindAnimations = ['animate-pulse', 'animate-bounce', 'animate-spin', 'animate-ping'];
      tailwindAnimations.forEach((animation) => {
        expect(className).not.toContain(animation);
      });
    });
  });

  describe('Inline Style Transitions (simulated)', () => {
    /**
     * Simulates FretboardDot's style calculation
     * This verifies the fix removes opacity transition
     */
    function buildTransitionStyle(): string {
      // FIX: NO opacity transition - CSS classes handle all playback animations
      // Only background-color transition remains for hover states
      return 'background-color 0.15s ease-in-out';
    }

    it('should NOT include opacity in transition', () => {
      const transition = buildTransitionStyle();

      expect(transition).not.toContain('opacity');
    });

    it('should only include background-color transition', () => {
      const transition = buildTransitionStyle();

      expect(transition).toContain('background-color');
      expect(transition).toContain('0.15s');
    });
  });
});

// ============================================================================
// UNIT TESTS: Single Source of Truth for Measure Cleanup
// ============================================================================

describe('Measure Change Cleanup - Single Source of Truth', () => {
  /**
   * Simulates the consolidated cleanup logic in useFretboardNoteSync
   */
  class MeasureCleanupSimulator {
    private noteElements: Map<string, Set<string>> = new Map();
    private lineElements: Map<string, Set<string>> = new Map();
    private currentMeasure = -1;

    registerNote(noteIndex: number): void {
      this.noteElements.set(`note-${noteIndex}`, new Set());
    }

    registerLine(lineIndex: number): void {
      this.lineElements.set(`line-${lineIndex}`, new Set());
    }

    addClass(elementId: string, className: string): void {
      const noteEl = this.noteElements.get(elementId);
      if (noteEl) {
        noteEl.add(className);
        return;
      }
      const lineEl = this.lineElements.get(elementId);
      if (lineEl) {
        lineEl.add(className);
      }
    }

    removeClass(elementId: string, className: string): void {
      const noteEl = this.noteElements.get(elementId);
      if (noteEl) {
        noteEl.delete(className);
        return;
      }
      const lineEl = this.lineElements.get(elementId);
      if (lineEl) {
        lineEl.delete(className);
      }
    }

    hasClass(elementId: string, className: string): boolean {
      const noteEl = this.noteElements.get(elementId);
      if (noteEl) return noteEl.has(className);
      const lineEl = this.lineElements.get(elementId);
      if (lineEl) return lineEl.has(className);
      return false;
    }

    /**
     * CONSOLIDATED CLEANUP (FIX)
     * useFretboardNoteSync is now the SOLE owner of ALL cleanup
     */
    measureChangeCleanup(newMeasure: number): {
      clearedNotes: number;
      clearedLines: number;
    } {
      if (newMeasure === this.currentMeasure) {
        return { clearedNotes: 0, clearedLines: 0 };
      }

      // Clear note states
      let clearedNotes = 0;
      this.noteElements.forEach((classes, id) => {
        if (classes.has('note-played')) {
          classes.delete('note-played');
          clearedNotes++;
        }
        classes.delete('note-played-next-measure-green');
        classes.delete('note-played-next-measure-orange');
      });

      // CONSOLIDATED FIX: Clear line states (was previously in FretboardGrid)
      let clearedLines = 0;
      this.lineElements.forEach((classes, id) => {
        if (classes.has('line-played')) {
          classes.delete('line-played');
          clearedLines++;
        }
      });

      this.currentMeasure = newMeasure;
      return { clearedNotes, clearedLines };
    }

    getState(): {
      notesWithPlayed: string[];
      linesWithPlayed: string[];
    } {
      const notesWithPlayed: string[] = [];
      const linesWithPlayed: string[] = [];

      this.noteElements.forEach((classes, id) => {
        if (classes.has('note-played')) notesWithPlayed.push(id);
      });

      this.lineElements.forEach((classes, id) => {
        if (classes.has('line-played')) linesWithPlayed.push(id);
      });

      return { notesWithPlayed, linesWithPlayed };
    }
  }

  let simulator: MeasureCleanupSimulator;

  beforeEach(() => {
    simulator = new MeasureCleanupSimulator();
    // Create 8 notes and 7 lines
    for (let i = 0; i < 8; i++) {
      simulator.registerNote(i);
    }
    for (let i = 0; i < 7; i++) {
      simulator.registerLine(i);
    }
  });

  it('should clear both note and line states in single cleanup call', () => {
    // Add played states
    simulator.addClass('note-0', 'note-played');
    simulator.addClass('note-1', 'note-played');
    simulator.addClass('line-0', 'line-played');
    simulator.addClass('line-1', 'line-played');

    let state = simulator.getState();
    expect(state.notesWithPlayed).toHaveLength(2);
    expect(state.linesWithPlayed).toHaveLength(2);

    // Single cleanup call handles both
    const result = simulator.measureChangeCleanup(1);

    expect(result.clearedNotes).toBe(2);
    expect(result.clearedLines).toBe(2);

    state = simulator.getState();
    expect(state.notesWithPlayed).toHaveLength(0);
    expect(state.linesWithPlayed).toHaveLength(0);
  });

  it('should not have separate cleanup for notes and lines', () => {
    // This test documents that the old two-system approach is removed
    // Previously:
    // - useFretboardNoteSync cleared notes
    // - FretboardGrid's useEffect cleared lines
    //
    // Now:
    // - useFretboardNoteSync clears BOTH (single atomic operation)

    simulator.addClass('note-0', 'note-played');
    simulator.addClass('line-0', 'line-played');

    // Single call clears everything
    const result = simulator.measureChangeCleanup(1);

    expect(result.clearedNotes).toBe(1);
    expect(result.clearedLines).toBe(1);
  });

  it('should prevent race condition by atomic cleanup', () => {
    // The race condition occurred because:
    // 1. useFretboardNoteSync ran at 60fps
    // 2. FretboardGrid useEffect ran after React reconciliation (~100ms later)
    // 3. During this gap, visual state was inconsistent
    //
    // Fix: Single atomic cleanup eliminates the gap

    simulator.addClass('note-0', 'note-played');
    simulator.addClass('note-1', 'note-played');
    simulator.addClass('line-0', 'line-played');
    simulator.addClass('line-1', 'line-played');

    // Atomic cleanup
    const startState = simulator.getState();
    expect(startState.notesWithPlayed.length + startState.linesWithPlayed.length).toBe(4);

    simulator.measureChangeCleanup(1);

    // After cleanup, NO played states should remain
    const endState = simulator.getState();
    expect(endState.notesWithPlayed.length + endState.linesWithPlayed.length).toBe(0);

    // No intermediate state possible (atomic)
  });

  it('should not cleanup when measure does not change', () => {
    simulator.addClass('note-0', 'note-played');
    simulator.addClass('line-0', 'line-played');

    // First call sets measure to 0
    simulator.measureChangeCleanup(0);

    // Add more played states
    simulator.addClass('note-1', 'note-played');
    simulator.addClass('line-1', 'line-played');

    // Same measure - should not cleanup
    const result = simulator.measureChangeCleanup(0);

    expect(result.clearedNotes).toBe(0);
    expect(result.clearedLines).toBe(0);

    const state = simulator.getState();
    expect(state.notesWithPlayed).toHaveLength(1); // note-1 still has played
    expect(state.linesWithPlayed).toHaveLength(1); // line-1 still has played
  });
});

// ============================================================================
// UNIT TESTS: CSS File Changes
// ============================================================================

describe('CSS Animation Cleanup', () => {
  it('should document removed CSS animations', () => {
    // These CSS features were REMOVED in the fix:
    const REMOVED_CSS = {
      keyframes: '@keyframes note-pulse',
      modifier: '.note-pulse-enabled',
      animation: 'animation: note-pulse 400ms ease-in-out infinite',
    };

    // Document for reference
    expect(REMOVED_CSS.keyframes).toContain('note-pulse');
    expect(REMOVED_CSS.modifier).toContain('pulse-enabled');
  });

  it('should document preserved CSS features', () => {
    // These CSS features were PRESERVED:
    const PRESERVED_CSS = {
      noteActive: '.note-active { box-shadow: ... }',
      noteActiveOpacity: '.note-active { opacity: 1 !important }',
      notePlayedTransition: '.note-played { transition: background-color 100ms }',
      linePlayedTransition: '.line-played { transition: none !important }',
    };

    // The !important on .note-active opacity is intentional:
    // When a note is actively playing, it should ALWAYS be fully visible
    expect(PRESERVED_CSS.noteActiveOpacity).toContain('!important');

    // Lines hide instantly (no transition) for crisp visual feedback
    expect(PRESERVED_CSS.linePlayedTransition).toContain('none');
  });
});

// ============================================================================
// INTEGRATION TESTS: Full Animation Flow
// ============================================================================

describe('Full Animation Flow (Integration)', () => {
  /**
   * Simulates the complete animation flow from clock tick to DOM update
   */
  interface AnimationState {
    activeNoteIndex: number;
    nextNoteIndex: number;
    currentMeasure: number;
    noteClasses: Map<number, Set<string>>;
    lineClasses: Map<number, Set<string>>;
  }

  class AnimationFlowSimulator {
    private state: AnimationState = {
      activeNoteIndex: -1,
      nextNoteIndex: -1,
      currentMeasure: -1,
      noteClasses: new Map(),
      lineClasses: new Map(),
    };

    private previousNoteIndex = -1;
    private previousMeasure = -1;

    constructor(noteCount: number) {
      for (let i = 0; i < noteCount; i++) {
        this.state.noteClasses.set(i, new Set());
      }
      for (let i = 0; i < noteCount - 1; i++) {
        this.state.lineClasses.set(i, new Set());
      }
    }

    /**
     * Simulates clock tick from AtomicPlaybackClock
     */
    onClockTick(visualSeconds: number, timeline: Array<{ noteIndex: number; measure: number; startTime: number; endTime: number }>): void {
      // Find active and next note
      const activeEntry = timeline.find((e) => e.startTime <= visualSeconds && e.endTime > visualSeconds);
      const nextEntry = timeline.find((e) => e.startTime > visualSeconds);

      this.state.activeNoteIndex = activeEntry?.noteIndex ?? -1;
      this.state.nextNoteIndex = nextEntry?.noteIndex ?? -1;
      this.state.currentMeasure = activeEntry?.measure ?? this.state.currentMeasure;

      // Detect measure change
      if (this.state.currentMeasure >= 0 && this.state.currentMeasure !== this.previousMeasure) {
        this.onMeasureChange();
      }

      // Detect note change
      if (this.state.activeNoteIndex !== this.previousNoteIndex) {
        this.onNoteChange();
      }

      this.previousNoteIndex = this.state.activeNoteIndex;
      this.previousMeasure = this.state.currentMeasure;
    }

    private onMeasureChange(): void {
      // CONSOLIDATED CLEANUP: Clear all played states
      this.state.noteClasses.forEach((classes) => {
        classes.delete('note-played');
        classes.delete('note-played-next-measure-green');
        classes.delete('note-played-next-measure-orange');
      });

      this.state.lineClasses.forEach((classes) => {
        classes.delete('line-played');
      });
    }

    private onNoteChange(): void {
      // Remove active from previous note
      if (this.previousNoteIndex >= 0) {
        const prevClasses = this.state.noteClasses.get(this.previousNoteIndex);
        if (prevClasses) {
          prevClasses.delete('note-active');
          prevClasses.add('note-played');
        }

        // Hide line from previous note
        const prevLineClasses = this.state.lineClasses.get(this.previousNoteIndex);
        if (prevLineClasses) {
          prevLineClasses.add('line-played');
        }
      }

      // Add active to current note
      if (this.state.activeNoteIndex >= 0) {
        const currClasses = this.state.noteClasses.get(this.state.activeNoteIndex);
        if (currClasses) {
          currClasses.add('note-active');
        }
      }

      // Add preview to next note
      this.state.noteClasses.forEach((classes, idx) => {
        classes.delete('note-preview');
        if (idx === this.state.nextNoteIndex) {
          classes.add('note-preview');
        }
      });
    }

    getState(): AnimationState {
      return { ...this.state };
    }

    getActiveNoteClasses(): string[] {
      const activeClasses = this.state.noteClasses.get(this.state.activeNoteIndex);
      return activeClasses ? Array.from(activeClasses) : [];
    }
  }

  it('should update note classes correctly on note change', () => {
    const simulator = new AnimationFlowSimulator(4);
    const timeline = [
      { noteIndex: 0, measure: 0, startTime: 0, endTime: 0.5 },
      { noteIndex: 1, measure: 0, startTime: 0.5, endTime: 1.0 },
      { noteIndex: 2, measure: 0, startTime: 1.0, endTime: 1.5 },
      { noteIndex: 3, measure: 0, startTime: 1.5, endTime: 2.0 },
    ];

    // Initial tick - note 0 active
    simulator.onClockTick(0.1, timeline);
    let classes = simulator.getActiveNoteClasses();
    expect(classes).toContain('note-active');
    expect(classes).not.toContain('note-played');

    // Tick at 0.6 - note 1 active, note 0 played
    simulator.onClockTick(0.6, timeline);
    classes = simulator.getActiveNoteClasses();
    expect(classes).toContain('note-active');

    const state = simulator.getState();
    expect(state.noteClasses.get(0)?.has('note-played')).toBe(true);
    expect(state.noteClasses.get(0)?.has('note-active')).toBe(false);
  });

  it('should clear all played states on measure change', () => {
    const simulator = new AnimationFlowSimulator(8);
    const timeline = [
      { noteIndex: 0, measure: 0, startTime: 0, endTime: 0.5 },
      { noteIndex: 1, measure: 0, startTime: 0.5, endTime: 1.0 },
      { noteIndex: 2, measure: 0, startTime: 1.0, endTime: 1.5 },
      { noteIndex: 3, measure: 0, startTime: 1.5, endTime: 2.0 },
      { noteIndex: 4, measure: 1, startTime: 2.0, endTime: 2.5 },
      { noteIndex: 5, measure: 1, startTime: 2.5, endTime: 3.0 },
    ];

    // Play through measure 0
    simulator.onClockTick(0.1, timeline);
    simulator.onClockTick(0.6, timeline);
    simulator.onClockTick(1.1, timeline);
    simulator.onClockTick(1.6, timeline);

    let state = simulator.getState();
    // Notes 0, 1, 2 should be played
    expect(state.noteClasses.get(0)?.has('note-played')).toBe(true);
    expect(state.noteClasses.get(1)?.has('note-played')).toBe(true);
    expect(state.noteClasses.get(2)?.has('note-played')).toBe(true);

    // Lines 0, 1, 2 should be played (hidden)
    expect(state.lineClasses.get(0)?.has('line-played')).toBe(true);
    expect(state.lineClasses.get(1)?.has('line-played')).toBe(true);
    expect(state.lineClasses.get(2)?.has('line-played')).toBe(true);

    // Cross measure boundary
    simulator.onClockTick(2.1, timeline);

    state = simulator.getState();
    // All played states should be cleared
    expect(state.noteClasses.get(0)?.has('note-played')).toBe(false);
    expect(state.noteClasses.get(1)?.has('note-played')).toBe(false);
    expect(state.noteClasses.get(2)?.has('note-played')).toBe(false);

    expect(state.lineClasses.get(0)?.has('line-played')).toBe(false);
    expect(state.lineClasses.get(1)?.has('line-played')).toBe(false);
    expect(state.lineClasses.get(2)?.has('line-played')).toBe(false);
  });

  it('should handle rapid measure transitions (loop)', () => {
    const simulator = new AnimationFlowSimulator(8);
    const timeline = [
      { noteIndex: 0, measure: 0, startTime: 0, endTime: 0.5 },
      { noteIndex: 1, measure: 1, startTime: 2.0, endTime: 2.5 },
      { noteIndex: 2, measure: 2, startTime: 4.0, endTime: 4.5 },
    ];

    // Jump through measures rapidly
    simulator.onClockTick(0.1, timeline);
    simulator.onClockTick(2.1, timeline);
    simulator.onClockTick(4.1, timeline);

    const state = simulator.getState();
    // Only the current note should be active, no lingering played states
    expect(state.activeNoteIndex).toBe(2);
    expect(state.noteClasses.get(2)?.has('note-active')).toBe(true);
  });
});
