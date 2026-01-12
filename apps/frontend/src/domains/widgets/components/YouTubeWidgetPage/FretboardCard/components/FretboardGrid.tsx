import React, {
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import type { ExerciseNote } from '@bassnotion/contracts';
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
import { getLineFinalOpacity } from '../utils/fretboardAnimation';
import { HorizontalLines } from './GridLines/HorizontalLines';
import { VerticalLines } from './GridLines/VerticalLines';
import { DiagonalLines } from './GridLines/DiagonalLines';
import { DotDropdownMenu } from './DotDropdownMenu';
import { useFretboardNoteSync } from '@/domains/widgets/hooks/useFretboardNoteSync';

// Feature flag for connection line color system - set to false to disable
const ENABLE_CROSSING_LINE_COLORS = true;

// PERFORMANCE FIX: Stable reference for default time signature
// Inline objects like { numerator: 4, denominator: 4 } create new references on every render,
// causing useMemo to think dependencies changed and rebuild the timeline thousands of times.
const DEFAULT_TIME_SIGNATURE = { numerator: 4, denominator: 4 } as const;

/** Function type for getting measure-based opacity for a note position */
export type GetMeasureOpacityFunction = (
  stringIndex: number,
  fret: Fret,
) => number;

/** Result of getMeasureHighlight function */
export interface MeasureHighlightResult {
  shouldHighlight: boolean;
  state: 'current' | 'next' | 'other';
  opacity: number;
}

/** Function type for getting measure-based highlight state for a note position
 * FLICKER FIX v14: Now accepts measure as parameter to avoid stale closure issues.
 * The caller passes the measure explicitly to ensure consistency with other calculations.
 */
export type GetMeasureHighlightFunction = (
  stringIndex: number,
  fret: Fret,
  measure: number,
) => MeasureHighlightResult;

/** Measure-aware connection with measure info for both endpoints */
export interface MeasureAwareConnection {
  pos1: { stringIndex: number; fret: Fret };
  pos2: { stringIndex: number; fret: Fret };
  measure1: number; // 0-based measure index
  measure2: number; // 0-based measure index
  sourceNoteIndex: number; // Index of the source note in exercise (for dot-to-dot line hiding)
}

/** Next note to play indicator (for yellow ring during playback) */
export interface NextNoteToPlay {
  stringIndex: number;
  fret: Fret;
  noteIndex: number;
}

interface FretboardGridProps {
  stringCount: StringCount;
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
  /** Optional function to get measure-based opacity for each note position during playback */
  getMeasureOpacity?: GetMeasureOpacityFunction;
  /** Optional function to get measure-based highlight state (green vs grey) for each note position */
  getMeasureHighlight?: GetMeasureHighlightFunction;
  /** CSS transition duration for measure opacity changes (e.g., "250ms") */
  measureOpacityTransition?: string;
  /** Measure-aware connections for accurate line highlighting during playback */
  measureAwareConnections?: MeasureAwareConnection[];
  /** Current measure (0-based) for connection visibility checking */
  currentMeasure0Based?: number;
  /** Next note to play indicator - shows yellow ring on the upcoming note during playback */
  nextNoteToPlay?: NextNoteToPlay | null;
  /** Exercise notes for determining played/unplayed state within current measure */
  exerciseNotes?: ExerciseNote[];
  /**
   * FLICKER FIX v6: Note-based current measure from useFretboardExercise.
   * This is the authoritative source for current measure during playback.
   * When provided, this takes precedence over deriving measure from nextNoteToPlay.
   * Undefined means "use fallback to currentMeasure0Based".
   */
  currentMeasureFromNote?: number;
  /**
   * Whether playback is currently active.
   * Used for direct DOM note synchronization via useFretboardNoteSync.
   */
  isPlaying?: boolean;
  /**
   * Current tempo in BPM.
   * Used for direct DOM note synchronization via useFretboardNoteSync.
   */
  tempo?: number;
  /**
   * Maximum fret number on the fretboard.
   * Used for direct DOM note synchronization via useFretboardNoteSync.
   */
  maxFrets?: number;
}

// PERFORMANCE FIX: Memoize FretboardGrid to prevent re-renders when props haven't changed
// The RAF loop triggers 60fps renders, but FretboardGrid only needs to re-render when
// actual visual data changes (measure, noteIndex, selectedDots, etc.)
export const FretboardGrid: React.FC<FretboardGridProps> = React.memo(({
  stringCount,
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
  getMeasureOpacity,
  getMeasureHighlight,
  measureOpacityTransition = '0ms', // TEMPORARY: Immediate transitions for debugging (was '250ms')
  measureAwareConnections,
  currentMeasure0Based = 0,
  nextNoteToPlay,
  exerciseNotes = [],
  currentMeasureFromNote: currentMeasureFromNoteProp,
  isPlaying = false,
  tempo = 120,
  maxFrets: maxFretsFromProps = 24,
}) => {
  // PERFORMANCE: Use ref for immediate scroll tracking + throttled state for fade opacity
  // - scrollLeftRef: Updated on every scroll event (no re-renders) - used by 3D overlay
  // - scrollLeftState: Updated every 100ms (throttled re-renders) - used for fade calculations
  // This gives smooth 3D overlay scrolling while keeping fade effects working
  const scrollLeftRef = useRef(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const scrollThrottleRef = useRef<NodeJS.Timeout | null>(null);

  // =============================================================================
  // MEASURE CHANGE RE-RENDER TRIGGER
  // =============================================================================
  // This state forces React to re-render when measure changes during playback.
  // Without this, connection lines would use stale measure values (from React's
  // ~20ms batched updates) while dots are updated at 60fps via direct DOM.
  //
  // The measureChangeCounter increments on each measure change detected by
  // useFretboardNoteSync (at 60fps), triggering immediate React re-render.
  // This ensures lines render with correct opacity based on current measure.
  // =============================================================================
  const [measureChangeCounter, setMeasureChangeCounter] = useState(0);

  // Memoized callback to avoid recreating function on each render
  // Uses functional update to avoid stale closure issues
  // Empty dependency array - the callback is stable and uses functional state update
  const handleMeasureChange = useCallback((newMeasure: number) => {
    setMeasureChangeCounter((prev) => {
      // Debug log only when enabled
      if ((window as any).__DEBUG_MEASURE_SYNC__ === true) {
        // eslint-disable-next-line no-console
        console.log(`🔄 [GRID] Measure change trigger: measure=${newMeasure} counter=${prev + 1}`);
      }
      return prev + 1;
    });
  }, []);

  // =============================================================================
  // CONNECTION LINE CLEANUP - NOW HANDLED BY useFretboardNoteSync
  // =============================================================================
  // Line cleanup on measure change is now consolidated in useFretboardNoteSync.
  // This eliminates the race condition where both systems tried to clear
  // .line-played classes at different times, causing ~50ms visual flicker.
  //
  // useFretboardNoteSync is now the SOLE owner of:
  // - .note-active, .note-played, .note-preview classes on dots
  // - .line-played class on connection lines
  //
  // This useEffect was removed as part of the animation collision fix.
  // =============================================================================

  // =============================================================================
  // DIAGNOSTIC: Check line DOM state AFTER render at measure 4
  // This verifies whether .line-played class is incorrectly persisting
  // NOTE: This diagnostic runs after the hook section where currentMeasureFromNote is defined.
  // It's placed here but references currentMeasureFromNote which is defined later.
  // We use a ref approach to capture the measure value at render time.
  // =============================================================================
  // Moved to after currentMeasureFromNote is defined (line ~355)

  // =============================================================================
  // DIRECT DOM NOTE SYNCHRONIZATION via useFretboardNoteSync
  // =============================================================================
  // This hook provides jitter-free note highlighting by:
  // 1. Pre-calculating note timeline at initialization
  // 2. Using binary search O(log n) for current note lookup
  // 3. Updating DOM directly via classList.toggle() - bypasses React!
  //
  // The registerNoteRef callback is used to register each note dot element
  // so the hook can toggle CSS classes (note-active, note-preview, note-played)
  // directly without React re-renders.
  // =============================================================================

  // Convert exerciseNotes to the format expected by useFretboardNoteSync
  // The hook uses its own ExerciseNoteInput interface to avoid import issues
  // The quantized timeline uses position data for timing, with duration as fallback
  const noteSyncNotes = useMemo(() => {
    return exerciseNotes.map((note) => ({
      string: note.string as 1 | 2 | 3 | 4 | 5 | 6,
      fret: note.fret,
      // Include duration string for MusicXML-based quantized timeline
      duration: note.duration,
      // durationTicks is passed for reference but not used for visual sync
      durationTicks: note.durationTicks,
      position: note.position,
    }));
  }, [exerciseNotes]);

  // Initialize the note sync hook
  // SINGLE SOURCE OF TRUTH: getCurrentMeasure() is THE authoritative source for current measure
  // Updated at 60fps by AtomicPlaybackClock, bypassing React's ~20ms state batching
  const { registerNoteRef, timeline, getCurrentMeasure } = useFretboardNoteSync({
    exerciseNotes: noteSyncNotes,
    tempo,
    stringCount,
    maxFrets: maxFretsFromProps,
    isPlaying,
    isVisible: true, // FretboardGrid is always visible when rendered
    timeSignature: DEFAULT_TIME_SIGNATURE, // Stable reference - avoids 3900+ timeline rebuilds
    countdownBeats: 4, // Default countdown, could be passed as prop if needed
    // REACT RE-RENDER TRIGGER: Force React to re-render on measure changes
    // This ensures connection lines update their opacity immediately when measure changes
    onMeasureChange: handleMeasureChange,
  });

  // =============================================================================
  // SINGLE SOURCE OF TRUTH: Current measure from useFretboardNoteSync (60fps)
  // =============================================================================
  // During playback, getCurrentMeasure() is THE authoritative source for current measure.
  // It's updated directly by AtomicPlaybackClock at 60fps, bypassing React's ~20ms batching.
  //
  // The old approach used currentMeasureFromNote from useFretboardExercise, which:
  // - Updates via React state (~20ms quantized)
  // - Can desync from the 60fps DOM updates in useFretboardNoteSync
  // - Causes animation flicker when React renders with stale measure
  //
  // Now we call getCurrentMeasure() at render time to get the latest value.
  // This ensures React renders are always consistent with the 60fps DOM state.
  //
  // FIX: Race condition where getCurrentMeasure() returns -1 during React re-renders
  // (because the 60fps loop hasn't updated the ref yet). Instead of falling back to
  // currentMeasureFromNoteProp ?? 0 (which causes measure 4 lines to hide), we keep
  // the last known good measure value in a ref.
  // =============================================================================
  const lastKnownMeasureRef = useRef<number>(currentMeasureFromNoteProp ?? 0);
  const syncMeasure = getCurrentMeasure();

  // Update ref when we have a valid measure during playback
  if (isPlaying && syncMeasure >= 0) {
    lastKnownMeasureRef.current = syncMeasure;
  } else if (!isPlaying) {
    // Reset to prop when not playing (for initial state / re-starting)
    lastKnownMeasureRef.current = currentMeasureFromNoteProp ?? 0;
  }

  // During playback: use syncMeasure if valid, otherwise use last known good value
  // When not playing: use prop for initial state
  const currentMeasureFromNote = isPlaying
    ? (syncMeasure >= 0 ? syncMeasure : lastKnownMeasureRef.current)
    : (currentMeasureFromNoteProp ?? 0);

  // Build a map from position key to note indices for registerNoteRef usage
  // This allows us to find which notes correspond to a fretboard position
  const positionToNoteIndexMap = useMemo(() => {
    const map = new Map<string, number[]>();

    if (!timeline || timeline.length === 0) {
      return map;
    }

    timeline.forEach((entry) => {
      const positionKey = `${entry.position.stringIndex},${entry.position.fret}`;
      const existing = map.get(positionKey) || [];
      existing.push(entry.noteIndex);
      map.set(positionKey, existing);
    });

    return map;
  }, [timeline]);

  // Build a map of ref callbacks for each position
  // This is memoized to provide stable ref callbacks that don't change on each render
  // Each position gets a single ref callback that registers all note indices at that position
  const positionRefCallbacks = useMemo(() => {
    const callbacks = new Map<string, (el: HTMLDivElement | null) => void>();

    positionToNoteIndexMap.forEach((noteIndices, positionKey) => {
      // Create a callback that registers this element for all note indices at this position
      callbacks.set(positionKey, (el: HTMLDivElement | null) => {
        noteIndices.forEach((noteIndex) => {
          registerNoteRef(noteIndex)(el);
        });
      });
    });

    return callbacks;
  }, [positionToNoteIndexMap, registerNoteRef]);

  // =============================================================================
  // DIAGNOSTIC: Check line DOM state AFTER render at measure 4
  // This verifies whether .line-played class is incorrectly persisting
  // =============================================================================
  useEffect(() => {
    // Only run diagnostic for measures 3-5 to catch the issue
    if (currentMeasureFromNote < 3 || currentMeasureFromNote > 5) return;

    const checkLineDOM = (label: string) => {
      const allLines = document.querySelectorAll('.connection-line');
      const playedLines = document.querySelectorAll('.connection-line.line-played');

      // Check each line's class and opacity
      const lineStates: string[] = [];
      allLines.forEach((line) => {
        const srcNote = line.getAttribute('data-source-note-index');
        const srcMeasure = line.getAttribute('data-source-measure');
        const tgtMeasure = line.getAttribute('data-target-measure');
        const hasPlayed = line.classList.contains('line-played');
        const computedOpacity = window.getComputedStyle(line).opacity;
        // Only log lines with issues (target in current/next measure window)
        const targetInWindow = parseInt(tgtMeasure || '-1', 10) >= currentMeasureFromNote &&
                               parseInt(tgtMeasure || '-1', 10) <= currentMeasureFromNote + 1;
        if (targetInWindow || hasPlayed) {
          lineStates.push(`src=${srcNote} m${srcMeasure}→${tgtMeasure} played=${hasPlayed} opacity=${computedOpacity}`);
        }
      });

      // eslint-disable-next-line no-console
      console.log(
        `🔎 [LINE-DOM] ${label} M${currentMeasureFromNote} | total=${allLines.length} | withLinePlayed=${playedLines.length}\n` +
        lineStates.map(s => `   ${s}`).join('\n')
      );
    };

    // Check immediately (sync)
    checkLineDOM('SYNC');

    // Check after microtask (React commit)
    queueMicrotask(() => checkLineDOM('MICRO'));

    // Check after frame (paint)
    requestAnimationFrame(() => checkLineDOM('RAF'));
  }, [currentMeasureFromNote, measureChangeCounter]);

  // =============================================================================
  // FLICKER DEBUG v12: Render count tracking (only increments, no logging overhead)
  // =============================================================================
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  // =============================================================================
  // FLICKER DEBUG v17: Render phase logging (GUARDED by debug flag)
  // =============================================================================
  // PERF FIX: All render-phase logging is now gated by debug flag to prevent
  // console.log overhead during normal playback. Enable with:
  // window.__DEBUG_GRID_RENDER__ = true
  // =============================================================================
  const debugGridRender = (window as any).__DEBUG_GRID_RENDER__ === true;
  const prevRenderMeasureRef = useRef<number>(-1);

  // Only log when measure changes during playback AND debug is enabled
  if (debugGridRender && nextNoteToPlay !== undefined && prevRenderMeasureRef.current !== currentMeasureFromNote) {
    console.log(
      `🟡 [GRID-RENDER-v17] #${renderCountRef.current} | ` +
        `measure: ${prevRenderMeasureRef.current}→${currentMeasureFromNote} | ` +
        `noteIdx=${nextNoteToPlay?.noteIndex ?? 'null'} | ` +
        `m0B=${currentMeasure0Based} | ` +
        `time=${performance.now().toFixed(0)}ms`,
    );
  }
  // Always track measure changes for reference comparison (no logging overhead)
  if (nextNoteToPlay !== undefined && prevRenderMeasureRef.current !== currentMeasureFromNote) {
    prevRenderMeasureRef.current = currentMeasureFromNote;
  }

  // FLICKER DEBUG v17: Track render count per measure (GUARDED by debug flag)
  const measureRenderCountRef = useRef<Map<number, number>>(new Map());
  if (debugGridRender && nextNoteToPlay !== undefined) {
    const count = measureRenderCountRef.current.get(currentMeasureFromNote) ?? 0;
    measureRenderCountRef.current.set(currentMeasureFromNote, count + 1);
    // Warn if this is a duplicate render at the same measure
    if (count > 5) { // Only warn after many renders to avoid spam
      console.log(
        `⚠️ [GRID-RENDER-v17] Many renders at measure ${currentMeasureFromNote}: #${count + 1}`,
      );
    }
  }

  // =============================================================================
  // FLICKER DEBUG v10: Track what's ACTUALLY being rendered
  // PERF FIX: All this debug tracking is now gated behind __DEBUG_RENDER_STATE__
  // Enable with: window.__DEBUG_RENDER_STATE__ = true
  // =============================================================================
  const prevRenderStateRef = useRef<{
    measure: number;
    noteIndex: number | null;
    highlightedPositions: string[];
  } | null>(null);

  // PERF FIX: Only run this expensive useEffect when debug mode is enabled
  // This effect builds and compares highlight state arrays which is expensive
  useEffect(() => {
    const debugRenderState = (window as any).__DEBUG_RENDER_STATE__ === true;

    // PERF FIX: Skip entirely if debug is disabled - saves significant overhead
    if (!debugRenderState) return;

    if (!nextNoteToPlay && !getMeasureHighlight) return;

    // Build list of currently highlighted positions WITH their full state
    const highlightedPositions: string[] = [];
    const allPositionStates: Array<{
      pos: string;
      highlight: { shouldHighlight: boolean; state: string; opacity: number };
      expectedState: 'current' | 'next' | 'other';
    }> = [];

    if (getMeasureHighlight && exerciseNotes.length > 0) {
      // Check each exercise note position
      const maxString = Math.max(...exerciseNotes.map((n) => n.string));
      exerciseNotes.forEach((note) => {
        let stringIndex: number;
        if (maxString <= 4) {
          stringIndex = 5 - note.string;
        } else if (maxString <= 5) {
          stringIndex = 5 - note.string;
        } else {
          stringIndex = 6 - note.string;
        }
        const fret: Fret = note.fret === 0 ? 'open' : note.fret;
        const noteMeasure = note.position?.measure ?? 0;

        // FLICKER FIX v14: Pass measure explicitly
        const highlight = getMeasureHighlight(stringIndex, fret, currentMeasureFromNote);

        // Compute what the expected state SHOULD be based on note's measure
        const expectedState: 'current' | 'next' | 'other' =
          noteMeasure === currentMeasureFromNote ? 'current' :
          noteMeasure === currentMeasureFromNote + 1 ? 'next' : 'other';

        allPositionStates.push({
          pos: `${stringIndex},${fret}`,
          highlight,
          expectedState,
        });

        if (highlight.shouldHighlight) {
          highlightedPositions.push(
            `${stringIndex},${fret}:${highlight.state}:${highlight.opacity}`,
          );
        }
      });
    }

    const currentState = {
      measure: currentMeasureFromNote,
      noteIndex: nextNoteToPlay?.noteIndex ?? null,
      highlightedPositions,
    };

    const prevState = prevRenderStateRef.current;

    // Check if anything changed
    if (prevState) {
      const measureChanged = prevState.measure !== currentState.measure;
      const noteChanged = prevState.noteIndex !== currentState.noteIndex;
      const highlightsChanged =
        JSON.stringify(prevState.highlightedPositions) !==
        JSON.stringify(currentState.highlightedPositions);

      if (measureChanged || noteChanged || highlightsChanged) {
        console.log(
          `🎨 [RENDER-STATE] ` +
            `measure: ${prevState.measure}→${currentState.measure} | ` +
            `noteIdx: ${prevState.noteIndex}→${currentState.noteIndex} | ` +
            `highlights: ${highlightsChanged ? 'CHANGED' : 'same'}`,
        );

        if (highlightsChanged) {
          // Find what positions were added/removed
          const prevSet = new Set(prevState.highlightedPositions);
          const currSet = new Set(currentState.highlightedPositions);
          const added = currentState.highlightedPositions.filter(
            (p) => !prevSet.has(p),
          );
          const removed = prevState.highlightedPositions.filter(
            (p) => !currSet.has(p),
          );

          if (added.length > 0) {
            console.log(`🎨 [RENDER-STATE]   + ADDED: ${added.join(', ')}`);
          }
          if (removed.length > 0) {
            console.log(`🎨 [RENDER-STATE]   - REMOVED: ${removed.join(', ')}`);
          }
        }

        // Check for MISMATCH between expected and actual state
        if (measureChanged) {
          console.log(`🔍 [RENDER-STATE] Full position analysis for measure ${currentState.measure}:`);
          const mismatches = allPositionStates.filter(
            (ps) => ps.highlight.shouldHighlight && ps.highlight.state !== ps.expectedState
          );
          if (mismatches.length > 0) {
            console.log(`⚠️ [RENDER-STATE] MISMATCHES FOUND:`);
            mismatches.forEach((m) => {
              console.log(
                `⚠️   ${m.pos}: actual=${m.highlight.state} expected=${m.expectedState} opacity=${m.highlight.opacity}`
              );
            });
          } else {
            console.log(`✅ [RENDER-STATE] No mismatches - all states correct`);
          }
        }
      }
    }

    prevRenderStateRef.current = currentState;
  }, [
    currentMeasureFromNote,
    nextNoteToPlay,
    getMeasureHighlight,
    exerciseNotes,
  ]);

  // Compute the "transition target dot" - first note of next measure connected by transition line
  // This dot should be highlighted in orange with 100% opacity as anticipation
  const transitionTargetDot = useMemo(() => {
    if (!measureAwareConnections || measureAwareConnections.length === 0) {
      return null;
    }

    const nextMeasure = currentMeasureFromNote + 1;

    // Find the first transition line (crosses measure boundary from current to next)
    for (const conn of measureAwareConnections) {
      const { pos2, measure1, measure2 } = conn;
      // Check if this is a transition from current measure to next measure
      if (measure1 === currentMeasureFromNote && measure2 === nextMeasure) {
        // pos2 is the first note of the next measure (transition target)
        return { stringIndex: pos2.stringIndex, fret: pos2.fret };
      }
    }

    return null;
  }, [measureAwareConnections, currentMeasureFromNote]);

  // Build a map of fretboard positions to their note indices in the current measure
  // This is used to determine if a note has been "played" (comes before nextNoteToPlay)
  // and should return to grey/default styling (unhighlighted, full opacity)
  const positionToNoteIndices = useMemo(() => {
    const map = new Map<string, number[]>();

    if (!exerciseNotes || exerciseNotes.length === 0) {
      return map;
    }

    // Determine the string count of the exercise by finding the max string number
    const maxString = Math.max(...exerciseNotes.map((n) => n.string));

    exerciseNotes.forEach((note, noteIndex) => {
      // Map exercise strings to fretboard string indices (same logic as useFretboardExercise)
      let stringIndex: number;

      if (maxString <= 4) {
        // 4-string bass: strings 1-4 map to G(4), D(3), A(2), E(1)
        stringIndex = 5 - note.string;
      } else if (maxString <= 5) {
        // 5-string bass: strings 1-5 map to G(4), D(3), A(2), E(1), B(0)
        stringIndex = 5 - note.string;
      } else {
        // 6-string bass: strings 1-6 map to C(5), G(4), D(3), A(2), E(1), B(0)
        stringIndex = 6 - note.string;
      }

      const fret: Fret = note.fret === 0 ? 'open' : note.fret;
      const positionKey = `${stringIndex},${fret}`;

      // Store note index for each position
      // Multiple notes at the same position have different indices
      const existing = map.get(positionKey) || [];
      existing.push(noteIndex);
      map.set(positionKey, existing);
    });

    return map;
  }, [exerciseNotes]);

  // =============================================================================
  // MEMOIZED CONNECTION LINE ELEMENTS
  // =============================================================================
  // This memoization prevents line flicker during measure transitions.
  // Previously, the line calculation ran inside an IIFE on every render,
  // causing React to recreate all line elements during rapid re-renders.
  // Now the lines are only recalculated when actual dependencies change.
  // =============================================================================
  const memoizedConnectionLines = useMemo(() => {
    // Constants for line position calculation (must match values in render)
    const STRING_SPACING = 32;
    const FRET_SPACING = 36;
    const DOT_RADIUS = 13;
    const FRET_OFFSET = 38;
    const CENTER_OFFSET = 15;

    // Use measure-aware connections if available, otherwise fall back to position-based
    const rawConnections =
      measureAwareConnections && measureAwareConnections.length > 0
        ? measureAwareConnections
        : findAllConnections(selectedDots).map((c, idx) => ({
            ...c,
            measure1: 0,
            measure2: 0,
            sourceNoteIndex: idx,
          }));

    if (rawConnections.length === 0) {
      return [];
    }

    // CONNECTION LINE PRIORITY SYSTEM:
    // Sort connections so that current measure lines are rendered LAST (on top in SVG)
    const nextMeasure = currentMeasureFromNote + 1;

    const getConnectionPriority = (
      conn: { measure1: number; measure2: number },
    ): number => {
      const { measure1, measure2 } = conn;
      const isTransition = measure1 !== measure2;

      if (isTransition) return 2; // Transition lines: medium priority
      if (measure1 === currentMeasureFromNote) return 3; // Current measure: highest (on top)
      if (measure1 === nextMeasure) return 1; // Next measure: low (behind)
      return 0; // Other measures: lowest (will be hidden)
    };

    const connections = [...rawConnections].sort(
      (a, b) => getConnectionPriority(a) - getConnectionPriority(b),
    );

    type LineData = {
      key: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      measure1: number;
      measure2: number;
      sourceNoteIndex: number;
      isTransitionLine: boolean;
      lineColor: string;
      sourcePositionKey: string;
      targetPositionKey: string;
    };

    const lineDataArray: LineData[] = [];

    connections.forEach(({ pos1, pos2, measure1, measure2, sourceNoteIndex }) => {
      // Calculate positions using same logic as render
      const absoluteVisualPosition1 = 5 - pos1.stringIndex;
      const absoluteVisualPosition2 = 5 - pos2.stringIndex;

      const x1 =
        pos1.fret === 'open'
          ? CENTER_OFFSET
          : CENTER_OFFSET + FRET_OFFSET + (pos1.fret - 1) * FRET_SPACING;
      const y1 = absoluteVisualPosition1 * STRING_SPACING;
      const x2 =
        pos2.fret === 'open'
          ? CENTER_OFFSET
          : CENTER_OFFSET + FRET_OFFSET + (pos2.fret - 1) * FRET_SPACING;
      const y2 = absoluteVisualPosition2 * STRING_SPACING;

      // Add DOT_RADIUS to get center positions
      const lineX1 = x1 + DOT_RADIUS;
      const lineY1 = y1 + DOT_RADIUS;
      const lineX2 = x2 + DOT_RADIUS;
      const lineY2 = y2 + DOT_RADIUS;

      const isTransitionLine = measure1 !== measure2;
      const targetMeasure = isTransitionLine ? measure2 : measure1;
      const isOrangeMeasureLine = targetMeasure % 2 === 1;
      const lineColor = isOrangeMeasureLine ? '#f97316' : '#22c55e';

      const sourcePositionKey = `${pos1.stringIndex}-${pos1.fret}`;
      const targetPositionKey = `${pos2.stringIndex}-${pos2.fret}`;

      lineDataArray.push({
        key: `connection-note-${sourceNoteIndex}`,
        x1: lineX1,
        y1: lineY1,
        x2: lineX2,
        y2: lineY2,
        measure1,
        measure2,
        sourceNoteIndex,
        isTransitionLine,
        lineColor,
        sourcePositionKey,
        targetPositionKey,
      });
    });

    // DEBUG: Log when memoization recalculates (should only happen on measure change)
    // Enable with: window.__DEBUG_LINE_MEMO__ = true
    if (typeof window !== 'undefined' && (window as any).__DEBUG_LINE_MEMO__ === true) {
      // eslint-disable-next-line no-console
      console.log(
        `📐 [LINE-MEMO] Recalculated! measure=${currentMeasureFromNote} | ` +
        `lines=${lineDataArray.length} | ` +
        `positions: ${lineDataArray.slice(0, 3).map(l => `(${l.x1.toFixed(0)},${l.y1.toFixed(0)})`).join(', ')}${lineDataArray.length > 3 ? '...' : ''}`
      );
    }

    return lineDataArray;
  }, [measureAwareConnections, selectedDots, currentMeasureFromNote]);

  // =============================================================================
  // REMOVED: isDotPlayedInCurrentMeasure and isDotInNextMeasure
  // =============================================================================
  // These helper functions were removed as part of the opacity system consolidation.
  // All played/active/opacity state is now handled by useFretboardNoteSync via CSS classes:
  // - .note-active: currently playing note
  // - .note-played: already played in current measure
  // - .note-current-measure: 100% opacity for current measure
  // - .note-next-measure: 30% opacity for next measure preview
  // =============================================================================

  const containerRef = useRef<HTMLDivElement>(null);
  // Dropdown menu state for each dot
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // PERFORMANCE: Listen to scroll events with THROTTLED state updates
  // - Ref is updated immediately (for 3D overlay smooth sync)
  // - State is updated every 100ms (for fade opacity calculations - reduces re-renders 10x)
  useEffect(() => {
    const handleScroll = () => {
      const scrollContainer = document.querySelector('.overflow-x-auto');
      if (scrollContainer) {
        const newScrollLeft = scrollContainer.scrollLeft;

        // IMMEDIATE: Update ref for 3D overlay (no re-render)
        scrollLeftRef.current = newScrollLeft;

        // THROTTLED: Update state for fade opacity (re-render every 100ms max)
        if (!scrollThrottleRef.current) {
          scrollThrottleRef.current = setTimeout(() => {
            setScrollLeftState(scrollLeftRef.current);
            scrollThrottleRef.current = null;
          }, 100); // 100ms = 10 updates/second max (was 60/second before)
        }
      }
    };

    const scrollContainer = document.querySelector('.overflow-x-auto');
    if (scrollContainer) {
      // PERFORMANCE: Use passive listener for better scroll performance
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

      // Initialize both ref and state
      const initialScroll = scrollContainer.scrollLeft;
      scrollLeftRef.current = initialScroll;
      setScrollLeftState(initialScroll);

      return () => {
        scrollContainer.removeEventListener('scroll', handleScroll);
        // Clear any pending throttle timeout
        if (scrollThrottleRef.current) {
          clearTimeout(scrollThrottleRef.current);
        }
      };
    }

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
  // PERFORMANCE: Uses throttled state (100ms updates) instead of per-scroll-event state
  // This reduces re-renders from 60/sec to 10/sec while keeping fade effect working
  const calculateFadeOpacity = (fret: Fret) => {
    const containerWidth = 568; // Viewport width (physical container)
    const fadeZoneWidth = 40; // Fade zone width for both sides
    const scrollLeft = scrollLeftState; // Read from throttled state for fade calculations

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

    // Get measure-based highlight state for this dot
    // This determines whether a selected dot should appear green (highlighted) or grey (not in current/next measure)
    // FLICKER FIX v14: Pass currentMeasureFromNote explicitly to avoid stale closure issues.
    // Previously, getMeasureHighlight captured measure in its closure, which could desync
    // from the currentMeasureFromNote prop during React's batched updates.
    const measureHighlight = getMeasureHighlight
      ? getMeasureHighlight(stringIndex, fret, currentMeasureFromNote)
      : { shouldHighlight: true, state: 'current' as const, opacity: 1.0 };

    // =============================================================================
    // UNIFIED OPACITY SYSTEM: useFretboardNoteSync handles ALL played/active states
    // =============================================================================
    // TWO-LAYER ARCHITECTURE: The "played" state is handled by useFretboardNoteSync via CSS classes:
    // - .note-active: currently playing note (yellow ring, 100% opacity)
    // - .note-played + .note-other-measure: already played → HIDDEN (0% opacity, grey canvas shows through)
    // - .note-current-measure: upcoming in current measure (100% opacity)
    // - .note-next-measure: preview for next measure (30% opacity)
    //
    // React's job is simplified:
    // - Determine if dot should show highlight color (green/orange) vs default grey
    // - Leave opacity control entirely to CSS classes
    // =============================================================================

    // A dot should visually appear as "highlighted" (green/orange background) if:
    // 1. It's selected in the exercise AND
    // 2. It's in the current or next measure (shouldHighlight is true)
    //
    // Note: The "played" state (grey background) is applied via CSS class by useFretboardNoteSync,
    // which overrides the green/orange background when .note-played is added.
    const shouldShowAsHighlighted =
      isSelected && measureHighlight.shouldHighlight;

    // =============================================================================
    // FLICKER DEBUG v16: COMPREHENSIVE logging for ALL selected dots
    // =============================================================================
    // Previous logging only captured specific dots. The flicker shows WRONG dots
    // being highlighted briefly, which could be ANY dot in the exercise.
    // Now we log EVERY selected dot's render state to catch the actual problem.
    //
    // Log format: position | measure state | visual state | computed values
    // This will show us exactly what's being rendered vs what should be rendered.
    //
    // Enable with: window.__DEBUG_ALL_DOTS__ = true  (logs every selected dot)
    // Or: window.__DEBUG_MEASURE_TRANSITIONS__ = true (logs only during measure changes)
    // =============================================================================

    // Check if this dot is the transition target (first note of next measure connected by transition line)
    // This dot should be highlighted with 100% opacity as anticipation
    const isTransitionTarget =
      transitionTargetDot &&
      transitionTargetDot.stringIndex === stringIndex &&
      transitionTargetDot.fret === fret;

    // Check if this dot is the NEXT NOTE TO PLAY (gets yellow ring indicator)
    // This moves through ALL notes during playback, not just transition targets
    const isNextNoteToPlay =
      nextNoteToPlay &&
      nextNoteToPlay.stringIndex === stringIndex &&
      nextNoteToPlay.fret === fret;

    // Determine the measure number for this dot (0-based) for color calculation
    // This is used to determine green vs orange background color
    const dotMeasure0Based =
      measureHighlight.state === 'current'
        ? currentMeasureFromNote
        : measureHighlight.state === 'next'
          ? currentMeasureFromNote + 1
          : -1;

    // Alternating colors based on measure:
    // Odd measures in 1-based (0, 2, 4... in 0-based) = Green
    // Even measures in 1-based (1, 3, 5... in 0-based) = Orange
    const isOrangeMeasure = dotMeasure0Based >= 0 && dotMeasure0Based % 2 === 1;

    // =============================================================================
    // FLICKER DEBUG v16: Log the ACTUAL CSS class being computed for this dot
    // =============================================================================
    // This is the FINAL computed visual state. If the flicker is caused by wrong
    // CSS classes being applied, we'll see it here.
    // Enable: window.__DEBUG_DOT_CSS__ = true
    const debugDotCss = (window as any).__DEBUG_DOT_CSS__ === true;

    // Determine dot styling
    const getDotClassName = () => {
      const neumorphicShadow =
        'shadow-[2px_2px_4px_rgba(0,0,0,0.4),-1px_-1px_3px_rgba(255,255,255,0.1)]';
      const neumorphicShadowPressed =
        'shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]';

      // FLICKER DEBUG v16: Log what CSS class we're about to return
      if (debugDotCss && isSelected) {
        const willBeGreen = shouldShowAsHighlighted && !isOrangeMeasure;
        const willBeOrange = shouldShowAsHighlighted && isOrangeMeasure;
        const willBeGrey = !shouldShowAsHighlighted && isSelected;
        console.log(
          `🎨 [DOT-CSS] ${stringIndex},${fret} @ m=${currentMeasureFromNote} | ` +
            `${willBeGreen ? 'GREEN' : willBeOrange ? 'ORANGE' : willBeGrey ? 'GREY' : 'DEFAULT'} | ` +
            `hlState=${measureHighlight.state} shouldHl=${shouldShowAsHighlighted}`,
        );
      }

      // Use shouldShowAsHighlighted instead of just isSelected
      // This makes dots appear grey when they're not in the current/next measure
      if (shouldShowAsHighlighted) {
        // YELLOW RING: DISABLED - Now handled by useFretboardNoteSync hook via direct DOM
        // The new system uses the 'note-active' CSS class for jitter-free updates
        // Old code was: isNextNoteToPlay ? ' ring-1 ring-yellow-400 ring-offset-1 ring-offset-transparent' : ''
        const nextNoteRing = '';

        // Alternating colors: green for odd measures (1, 3, 5...), orange for even measures (2, 4, 6...)
        if (isOrangeMeasure) {
          // Orange measure styling
          const multipleSelectionRing =
            hasMultipleSelections && !isNextNoteToPlay
              ? ' ring-1 ring-orange-300'
              : '';
          return `bg-orange-500 text-white ${neumorphicShadowPressed}${multipleSelectionRing}${nextNoteRing}`;
        } else {
          // Green measure styling
          const multipleSelectionRing =
            hasMultipleSelections && !isNextNoteToPlay
              ? ' ring-1 ring-green-300'
              : '';
          return `bg-green-500 text-black ${neumorphicShadowPressed}${multipleSelectionRing}${nextNoteRing}`;
        }
      } else if (isDraggedOverDot) {
        return `bg-blue-500 text-white border-2 border-blue-300 ${neumorphicShadow}`;
      } else if (isCurrentNoteAtPos) {
        // Static highlight only - animate-pulse removed to prevent collision with CSS transitions
        // CSS .note-active handles all playback-related animations via direct DOM in useFretboardNoteSync
        return `bg-orange-500 text-white ${neumorphicShadow} ring-2 ring-orange-300`;
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

    // Identify fret marker positions (3,5,7,9,12,15,17,19,21,24) for CSS targeting
    // This allows .note-played to return markers to slate-500 instead of slate-600
    const isFretMarker =
      fret !== 'open' && [3, 5, 7, 9, 12, 15, 17, 19, 21, 24].includes(fret);
    const fretMarkerClass = isFretMarker ? 'fret-marker' : '';

    // CRITICAL: Include 'fretboard-dot' class for DOM queries in clearAllPlayedStates() and updateMeasureOpacityClasses()
    // Without this class, those functions can't find any dots to update/clear
    const baseClassName =
      fret === 'open' || fret === 12
        ? `fretboard-dot cursor-pointer flex items-center justify-center text-sm font-semibold rounded-md absolute focus:outline-none ${fretMarkerClass}`
        : `fretboard-dot rounded-full cursor-pointer absolute flex items-center justify-center text-sm font-semibold focus:outline-none ${fretMarkerClass}`;

    const dotKey = `${stringIndex},${fret}`;
    const isDropdownOpen = openDropdown === dotKey;

    // Calculate fade opacity for this dot (edge fading based on scroll position)
    const fadeOpacity = calculateFadeOpacity(fret);

    // =============================================================================
    // CSS VARIABLE-BASED OPACITY SYSTEM
    // =============================================================================
    // Two CSS variables combine to create final opacity:
    //
    // 1. --fade-opacity (set here by React): Scroll-based edge fading (0-1)
    // 2. --measure-opacity (set by useFretboardNoteSync at 60fps): Measure-based (1 or 0.3)
    //
    // Final CSS opacity = calc(var(--fade-opacity) * var(--measure-opacity))
    //
    // This architecture:
    // - Eliminates collision between React inline styles and CSS !important
    // - Provides 60fps measure-based updates (bypasses React batching)
    // - Preserves scroll-based edge fading from React
    //
    // React's job is now:
    // - Render the dot with proper background color (green/orange based on measure)
    // - Set --fade-opacity CSS variable for edge fading
    // - Let CSS classes handle the final opacity calculation via calc()
    // =============================================================================

    // Calculate fade opacity for CSS variable
    // - fadeOpacity: edge fading based on scroll position (0-1)
    // - isBeingDragged: reduces opacity to 0.5 during drag
    const cssVarFadeOpacity = isBeingDragged
      ? 0.5 * fadeOpacity
      : fadeOpacity;

    // =============================================================================
    // DIRECT DOM NOTE SYNC: Get ref callback for this position
    // =============================================================================
    // If this position has exercise notes, we use the pre-memoized ref callback
    // that registers all note indices at this position. This allows
    // useFretboardNoteSync to toggle CSS classes directly on the DOM element,
    // bypassing React for jitter-free visual updates.
    // =============================================================================
    const positionKey = `${stringIndex},${fret}`;
    const refCallback = positionRefCallbacks.get(positionKey);

    // Z-INDEX LAYERING:
    // - Default dots (grey, not part of exercise): z-index 10
    // - Connection lines: z-index 15 (above default dots, below highlighted)
    // - Highlighted dots (green/orange exercise notes): z-index 20
    // - CSS classes override for special states:
    //   - .note-played: z-index 20
    //   - .note-preview: z-index 25
    //   - .note-active: z-index 30
    const dotZIndex = shouldShowAsHighlighted ? 20 : 10;

    const dotElement = (
      <div
        // If this position has exercise notes, register for DOM sync
        ref={refCallback}
        className={`${getDotClassName()} ${baseClassName}`}
        style={{
          left: x,
          top: y,
          width: DOT_SIZE,
          height: DOT_SIZE,
          zIndex: dotZIndex,
          // Disable interaction when dot is invisible
          pointerEvents: cssVarFadeOpacity > 0 ? 'auto' : 'none',
          // FLICKER FIX v8: Removed ALL transitions to eliminate flicker
          // This makes state changes instant instead of animated
          transition: 'none',
          // CSS VARIABLE OPACITY SYSTEM:
          // Set --fade-opacity for scroll-based edge fading
          // useFretboardNoteSync handles --measure-opacity via direct DOM at 60fps
          // Final opacity = calc(var(--fade-opacity) * var(--measure-opacity))
          ['--fade-opacity' as string]: cssVarFadeOpacity,
          // CRITICAL FIX: Do NOT set inline opacity for exercise dots!
          // Inline styles CANNOT be overridden by CSS !important.
          // For exercise dots (dots with note-* classes), the CSS calc() handles opacity.
          // For non-exercise dots, we still need this fallback.
          // Check if this dot is an exercise note - if so, DON'T set inline opacity
          ...(isExerciseNoteAtPos ? {} : { opacity: cssVarFadeOpacity }),
          transform: 'rotateX(0deg)',
          // Hide from screen readers and layout when invisible
          visibility: cssVarFadeOpacity === 0 ? 'hidden' : 'visible',
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
          <span className={`text-xs font-semibold select-none ${shouldShowAsHighlighted || isExerciseNoteAtPos ? 'text-black' : 'text-white'}`}>
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

            {/* Direct connection lines - z-index 15: above default dots (10), below highlighted dots (20+) */}
            <svg
              className="absolute pointer-events-none"
              style={{
                zIndex: 15,
                width: gridWidth,
                height: gridHeight,
              }}
            >
              {/* SVG Mask to cut out dot areas from lines - prevents opacity overlap */}
              <defs>
                <mask id="dot-cutout-mask">
                  {/* White background = visible, black shapes = cut out */}
                  <rect width="100%" height="100%" fill="white" />
                  {/* Cut out shapes at each selected dot position */}
                  {/* Open string and fret 12 use rounded rectangles, others use circles */}
                  {Array.from(selectedDots.keys()).map((posKey) => {
                    const [stringIdxStr, fretStr] = posKey.split(',');
                    const stringIdx = parseInt(stringIdxStr, 10);
                    const fret = fretStr === 'open' ? 'open' : parseInt(fretStr, 10);

                    // Calculate position (same as dot rendering)
                    const absoluteVisualPosition = 5 - stringIdx;
                    const dotCenterX = fret === 'open'
                      ? CENTER_OFFSET + DOT_RADIUS
                      : CENTER_OFFSET + FRET_OFFSET + (fret - 1) * FRET_SPACING + DOT_RADIUS;
                    const dotCenterY = absoluteVisualPosition * STRING_SPACING + DOT_RADIUS;

                    // Open string and fret 12 use rounded rectangles (rounded-md = 6px border-radius)
                    // Other frets use circles (rounded-full)
                    const isRoundedRect = fret === 'open' || fret === 12;

                    if (isRoundedRect) {
                      // Rounded rectangle: x,y is top-left corner, not center
                      return (
                        <rect
                          key={`mask-${posKey}`}
                          x={dotCenterX - DOT_RADIUS}
                          y={dotCenterY - DOT_RADIUS}
                          width={DOT_SIZE}
                          height={DOT_SIZE}
                          rx={6} // Matches Tailwind rounded-md (0.375rem = 6px)
                          ry={6}
                          fill="black"
                        />
                      );
                    }

                    // Regular frets use circles
                    return (
                      <circle
                        key={`mask-${posKey}`}
                        cx={dotCenterX}
                        cy={dotCenterY}
                        r={DOT_RADIUS}
                        fill="black"
                      />
                    );
                  })}
                </mask>
              </defs>
              {/* =============================================================================
                  MEMOIZED CONNECTION LINES
                  =============================================================================
                  Using pre-calculated line positions from memoizedConnectionLines.
                  This prevents React from recreating line elements on every render,
                  reducing flicker during measure transitions.
                  ============================================================================= */}
              <g mask="url(#dot-cutout-mask)" style={{ willChange: 'opacity' }}>
                {memoizedConnectionLines.map((lineData) => {
                  // Calculate fade opacity based on scroll position (dynamic)
                  // PERFORMANCE: Read from throttled state (100ms updates)
                  const containerWidth = 568;
                  const fadeZoneWidth = 40;
                  const currentScrollLeft = scrollLeftState;
                  const scaledLineX1 = lineData.x1 * zoomLevel;
                  const scaledLineX2 = lineData.x2 * zoomLevel;
                  const lineCenterX = (scaledLineX1 + scaledLineX2) / 2;
                  const viewportLeft = currentScrollLeft;
                  const viewportRight = currentScrollLeft + containerWidth;
                  const leftFadeEndX = viewportLeft + fadeZoneWidth;
                  const rightFadeStartX = viewportRight - fadeZoneWidth;

                  let lineFadeOpacity = 1;
                  if (currentScrollLeft > 0 && lineCenterX < leftFadeEndX) {
                    const fadeProgress = (leftFadeEndX - lineCenterX) / fadeZoneWidth;
                    lineFadeOpacity = Math.max(0, 1 - fadeProgress);
                  }
                  if (lineCenterX > rightFadeStartX) {
                    const fadeProgress = (lineCenterX - rightFadeStartX) / fadeZoneWidth;
                    lineFadeOpacity = Math.min(lineFadeOpacity, Math.max(0, 1 - fadeProgress));
                  }

                  // Get final opacity from centralized animation utility
                  const finalLineOpacity = getLineFinalOpacity(
                    lineData.measure1,
                    lineData.measure2,
                    currentMeasureFromNote,
                    lineFadeOpacity,
                  );

                  // Skip lines that should not be visible
                  if (finalLineOpacity === null || finalLineOpacity === 0) {
                    return null;
                  }

                  return (
                    <line
                      key={lineData.key}
                      x1={lineData.x1}
                      y1={lineData.y1}
                      x2={lineData.x2}
                      y2={lineData.y2}
                      stroke={lineData.lineColor}
                      strokeWidth="3"
                      strokeLinecap="round"
                      opacity={finalLineOpacity}
                      className="connection-line"
                      data-source-position={lineData.sourcePositionKey}
                      data-target-position={lineData.targetPositionKey}
                      data-source-note-index={lineData.sourceNoteIndex}
                      data-source-measure={lineData.measure1}
                      data-target-measure={lineData.measure2}
                      data-is-transition={lineData.isTransitionLine ? 'true' : 'false'}
                      style={{ transition: 'none' }}
                    />
                  );
                })}
              </g>
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
});
