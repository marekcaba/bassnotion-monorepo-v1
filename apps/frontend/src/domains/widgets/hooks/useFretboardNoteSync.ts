/**
 * useFretboardNoteSync - Direct DOM Note Synchronization for FretboardCard
 *
 * ## Problem This Solves
 *
 * The FretboardCard requires sub-16ms visual precision for note highlighting to feel
 * musically accurate. The previous React-state-based approach has ~30ms jitter due to:
 * 1. React's batched state updates
 * 2. Virtual DOM diffing overhead
 * 3. Fiber reconciliation timing unpredictability
 *
 * At fast tempos with sixteenth notes (140 BPM = 107ms per 16th), 30ms jitter = 28% error,
 * which is unacceptable for a music learning platform.
 *
 * ## Solution
 *
 * Bypass React entirely for note highlighting by:
 * 1. Pre-calculating a QUANTIZED note timeline with explicit rests at initialization
 * 2. Using binary search O(log n) to find the current entry on each clock tick
 * 3. Toggling CSS classes directly via classList API (no React re-render)
 *
 * ## Architecture
 *
 * ```
 *   AtomicPlaybackClock (RAF @ 60fps)
 *            │
 *            │ subscribe() callback with visualSeconds
 *            ▼
 *   useFretboardNoteSync hook
 *            │
 *            │ Binary search -> Find current entry (note or rest)
 *            │ classList.toggle() -> DIRECT DOM
 *            ▼
 *   FretboardDot elements (refs[])
 * ```
 *
 * ## Key Feature: Quantized Timeline with Rests
 *
 * The timeline now includes explicit REST entries between notes:
 * - Notes are quantized to 16th note grid (0.25 beats)
 * - Gaps between notes become rest entries
 * - During a REST, no note is highlighted (findNoteAtTime returns -1)
 * - This eliminates the overlapping note issue from raw MIDI tick data
 *
 * ## Usage
 *
 * ```tsx
 * const { registerNoteRef, timeline } = useFretboardNoteSync({
 *   exerciseNotes: exercise.notes,
 *   tempo: 120,
 *   stringCount: 4,
 *   maxFrets: 24,
 *   isPlaying: true,
 *   isVisible: true,
 * });
 *
 * // In FretboardGrid - register each note dot
 * <div
 *   ref={registerNoteRef(noteIndex)}
 *   className={getNoteClassName(noteIndex)}
 * />
 * ```
 */

import { useRef, useEffect, useCallback, useMemo } from 'react';
import {
  getAtomicPlaybackClock,
  type AtomicBeatState,
} from '@/domains/playback/services/core/AtomicPlaybackClock';
import { buildQuantizedTimeline } from '../utils/exerciseToMusicXML.js';
import type { Fret } from '../components/YouTubeWidgetPage/FretboardCard/types/fretboardTypes';
// Import centralized animation utilities - SINGLE SOURCE OF TRUTH for all fretboard animation
import {
  CSS_CLASSES,
  setDotActive,
  setDotPlayed,
  setDotPlayedNextMeasure,
  setDotPreview,
  clearDotPreview,
  clearDotAnimationState,
  markLineAsPlayed,
  clearAllPlayedStates,
} from '../components/YouTubeWidgetPage/FretboardCard/utils/fretboardAnimation.js';

// =============================================================================
// MEASURE-BASED OPACITY CLASSES
// =============================================================================
// These classes are applied to control INITIAL opacity of notes based on their
// measure relative to the current playback position.
// This is the SINGLE SOURCE OF TRUTH for measure-based opacity (replaces inline styles).
// The class names are defined in CSS_CLASSES (imported from fretboardAnimation.ts)
// and the CSS rules are in fretboard-notes.css.

// ============================================================================
// TYPES
// ============================================================================

/**
 * Time signature representation
 */
interface TimeSignature {
  numerator: number;
  denominator: number;
}

/**
 * Minimal ExerciseNote interface for this hook
 * We define our own to avoid lazy-loading issues with @bassnotion/contracts
 *
 * Note: The quantized timeline uses position data (measure, beat, tick) for timing.
 * durationTicks is no longer used for visual sync - the timeline calculates
 * visual durations based on gaps between notes (quantized to 16th notes).
 */
interface ExerciseNoteInput {
  string: 1 | 2 | 3 | 4 | 5 | 6;
  fret: number;
  /** Duration string for MusicXML export (e.g., "quarter", "eighth") */
  duration?: string;
  /** Duration in MIDI ticks - used for audio, NOT for visual timeline */
  durationTicks?: number;
  position?: {
    measure?: number;
    beat?: number;
    subdivision?: number;
    tick?: number;
  };
}

/**
 * A single entry in the pre-calculated note timeline
 * Extended from QuantizedTimelineEntry with fretboard position data
 *
 * Now includes explicit REST entries where type='rest' and noteIndex=-1
 */
export interface NoteTimelineEntry {
  /** Type of entry - 'note' shows highlight, 'rest' clears highlight */
  type: 'note' | 'rest';
  /** Exact audio clock time when entry starts (seconds) */
  startTime: number;
  /** Exact audio clock time when entry ends (seconds) */
  endTime: number;
  /** Fretboard position (only meaningful for notes, not rests) */
  position: {
    stringIndex: number;
    fret: Fret;
  };
  /** Index of this note in the exercise (-1 for rests) */
  noteIndex: number;
  /** Original note data reference (undefined for rests) */
  note?: ExerciseNoteInput;
  /** 0-based measure this entry belongs to */
  measure: number;
  /** Duration in quarter notes (quantized to 16th notes) */
  durationBeats: number;
}

/**
 * Configuration for the fretboard note sync hook
 */
export interface FretboardNoteSyncConfig {
  /** Exercise notes array from exercise data */
  exerciseNotes: ExerciseNoteInput[];
  /** Tempo in BPM */
  tempo: number;
  /** Number of strings on the fretboard (reserved for future use) */
  stringCount: 4 | 5 | 6;
  /** Maximum fret number (reserved for future use) */
  maxFrets: number;
  /** Whether playback is currently active */
  isPlaying: boolean;
  /** Whether the fretboard is visible (optimization to skip updates when hidden) */
  isVisible?: boolean;
  /** Time signature (defaults to 4/4) */
  timeSignature?: TimeSignature;
  /** Countdown beats before exercise starts (defaults to 4) */
  countdownBeats?: number;
  /**
   * Callback triggered when measure changes during playback.
   * Use this to force React re-renders for components that need to update
   * based on measure (e.g., connection lines that depend on measure for opacity).
   *
   * Called with the new measure number (0-based).
   */
  onMeasureChange?: (newMeasure: number) => void;
}

/**
 * Result from useFretboardNoteSync hook
 */
export interface FretboardNoteSyncResult {
  /**
   * Register a note element by its index
   * Returns a ref callback for use in JSX
   */
  registerNoteRef: (noteIndex: number) => (el: HTMLDivElement | null) => void;
  /**
   * Get the base CSS class name for a note (for initial render)
   * The hook will toggle additional state classes during playback
   */
  getNoteClassName: (noteIndex: number) => string;
  /**
   * Pre-calculated timeline of all notes with exact timing
   * Useful for debugging or external visualization
   */
  timeline: NoteTimelineEntry[];
  /**
   * Get the current active note index (for external use)
   */
  getCurrentNoteIndex: () => number;
  /**
   * Get the next note index (preview)
   */
  getNextNoteIndex: () => number;
  /**
   * SINGLE SOURCE OF TRUTH: Get the current measure (0-based) at 60fps
   *
   * This is THE authoritative source for current measure during playback.
   * It's updated directly by AtomicPlaybackClock at 60fps, bypassing React.
   * Use this instead of useFretboardExercise.currentMeasureFromNote to avoid
   * the ~20ms desync that causes animation flicker.
   *
   * Returns -1 during countdown or when no notes are active.
   */
  getCurrentMeasure: () => number;
}

// ============================================================================
// CSS CLASS CONSTANTS - Imported from centralized fretboardAnimation.ts
// ============================================================================
// NOTE: CSS_CLASSES, ALL_DOT_STATE_CLASSES, and all animation state functions
// are now imported from ../components/YouTubeWidgetPage/FretboardCard/utils/fretboardAnimation.js
// This is the SINGLE SOURCE OF TRUTH for all fretboard animation logic.

// ============================================================================
// DEBUG UTILITIES
// ============================================================================

/**
 * Debug flag - enable in browser console: window.__DEBUG_FRETBOARD_SYNC = true
 */
const isDebugEnabled = () =>
  typeof window !== 'undefined' &&
  (window as unknown as { __DEBUG_FRETBOARD_SYNC?: boolean })
    .__DEBUG_FRETBOARD_SYNC;

/**
 * ULTRA DEBUG: Enable this to log EVERY single DOM mutation and computed style
 * Enable in browser console: window.__ULTRA_DEBUG__ = true
 */
const isUltraDebugEnabled = () =>
  typeof window !== 'undefined' &&
  (window as unknown as { __ULTRA_DEBUG__?: boolean })
    .__ULTRA_DEBUG__;

/**
 * MUTATION OBSERVER: Track any external changes to fretboard dots
 * Call window.__START_MUTATION_WATCH__() to enable
 */
if (typeof window !== 'undefined') {
  let mutationObserver: MutationObserver | null = null;

  (window as any).__START_MUTATION_WATCH__ = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
          const el = mutation.target as HTMLElement;
          if (el.classList.contains('fretboard-dot')) {
            // eslint-disable-next-line no-console
            console.log(
              `🔬 [MUTATION] Dot class changed externally!\n` +
              `   Old: ${mutation.oldValue}\n` +
              `   New: ${el.className}\n` +
              `   Title: ${el.title || 'N/A'}`
            );
          }
        }
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const el = mutation.target as HTMLElement;
          if (el.classList.contains('fretboard-dot')) {
            // eslint-disable-next-line no-console
            console.log(
              `🔬 [MUTATION] Dot style changed!\n` +
              `   Style: ${el.getAttribute('style')}\n` +
              `   Computed opacity: ${window.getComputedStyle(el).opacity}\n` +
              `   Title: ${el.title || 'N/A'}`
            );
          }
        }
      });
    });

    document.querySelectorAll('.fretboard-dot:not(.fretboard-2d-hidden .fretboard-dot)').forEach((dot) => {
      mutationObserver!.observe(dot, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style'],
      });
    });

    // eslint-disable-next-line no-console
    console.log(`🔬 [MUTATION WATCH] Started watching ${document.querySelectorAll('.fretboard-dot:not(.fretboard-2d-hidden .fretboard-dot)').length} dots for external changes`);
  };

  (window as any).__STOP_MUTATION_WATCH__ = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
      // eslint-disable-next-line no-console
      console.log('🔬 [MUTATION WATCH] Stopped');
    }
  };

  // eslint-disable-next-line no-console
  console.log('🔬 Mutation watch available: __START_MUTATION_WATCH__() and __STOP_MUTATION_WATCH__()');
}

/**
 * Debug flag for comprehensive line lifecycle tracking
 * Enable in browser console: window.__DEBUG_LINE_LIFECYCLE__ = true
 *
 * This will log EVERY line state change with full context:
 * - When a line is hidden (addClass 'line-played')
 * - When a line is restored (removeClass 'line-played')
 * - Current measure, note index, timestamp
 */
const isLineLifecycleDebugEnabled = () =>
  typeof window !== 'undefined' &&
  (window as unknown as { __DEBUG_LINE_LIFECYCLE__?: boolean })
    .__DEBUG_LINE_LIFECYCLE__;

/**
 * Log line state changes for debugging
 */
function logLineStateChange(
  action: 'HIDE' | 'RESTORE' | 'QUERY',
  context: {
    noteIndex?: number;
    lineSelector?: string;
    lineFound?: boolean;
    measure?: number;
    time?: number;
    reason?: string;
    linesAffected?: number;
    lineDetails?: string;
  }
): void {
  if (!isLineLifecycleDebugEnabled()) return;

  const emoji = action === 'HIDE' ? '🔴' : action === 'RESTORE' ? '🟢' : '🔍';
  const t = context.time !== undefined ? `t=${context.time.toFixed(3)}s` : '';
  const m = context.measure !== undefined ? `m=${context.measure}` : '';
  const n = context.noteIndex !== undefined ? `note#${context.noteIndex}` : '';

  // eslint-disable-next-line no-console, no-restricted-syntax
  console.log(
    `${emoji} [LINE-LIFECYCLE] ${action} | ${[m, n, t].filter(Boolean).join(' | ')} | ` +
    `${context.reason || ''} | ` +
    `selector="${context.lineSelector || 'N/A'}" found=${context.lineFound ?? 'N/A'} ` +
    `affected=${context.linesAffected ?? 1} ${context.lineDetails || ''}`
  );
}

// ============================================================================
// VISUAL DOM INSPECTOR - Enable with window.__INSPECT_DOTS__()
// ============================================================================

/**
 * Visual DOM Inspector - Call from browser console to see actual dot states
 *
 * Usage:
 *   window.__INSPECT_DOTS__()           - Snapshot of all dots
 *   window.__INSPECT_DOTS__(true)       - Start continuous monitoring (every 500ms)
 *   window.__INSPECT_DOTS__(false)      - Stop continuous monitoring
 *   window.__WATCH_DOT__('2,5')         - Watch a specific position continuously
 *
 * This helps find bugs that don't appear in console logs by showing
 * the ACTUAL computed styles and classes on DOM elements.
 */
if (typeof window !== 'undefined') {
  let inspectorInterval: ReturnType<typeof setInterval> | null = null;
  let watchedPosition: string | null = null;
  let watchInterval: ReturnType<typeof setInterval> | null = null;

  (window as any).__INSPECT_DOTS__ = (continuous?: boolean) => {
    // Stop existing interval if any
    if (inspectorInterval) {
      clearInterval(inspectorInterval);
      inspectorInterval = null;
    }

    const inspect = () => {
      const dots = document.querySelectorAll('.fretboard-dot:not(.fretboard-2d-hidden .fretboard-dot)');
      const summary = {
        total: dots.length,
        current: 0,
        nextFirst: 0,
        next: 0,
        other: 0,
        active: 0,
        played: 0,
        noMeasureClass: 0,
        issues: [] as string[],
      };

      const dotStates: Array<{
        position: string;
        classes: string;
        measureOpacity: string;
        computedOpacity: string;
        bgColor: string;
        issue?: string;
      }> = [];

      dots.forEach((dot) => {
        const classes = dot.className;
        const style = window.getComputedStyle(dot);
        const measureOpacity = (dot as HTMLElement).style.getPropertyValue('--measure-opacity') || 'not-set';
        const computedOpacity = style.opacity;
        const bgColor = style.backgroundColor;

        // Extract position from data attributes or infer from classes
        const position = (dot as HTMLElement).title?.match(/Fret (\d+).*String/)?.[1] || 'unknown';

        // Count states
        if (classes.includes('note-current-measure')) summary.current++;
        else if (classes.includes('note-next-measure-first')) summary.nextFirst++;
        else if (classes.includes('note-next-measure')) summary.next++;
        else if (classes.includes('note-other-measure')) summary.other++;
        else if (classes.includes('note-')) summary.noMeasureClass++; // Has note- class but no measure class

        if (classes.includes('note-active')) summary.active++;
        if (classes.includes('note-played')) summary.played++;

        // Detect issues
        let issue: string | undefined;

        // Issue 1: Has note-next-measure but opacity is not ~0.3
        if (classes.includes('note-next-measure') && !classes.includes('note-next-measure-first')) {
          const opacityNum = parseFloat(computedOpacity);
          if (opacityNum > 0.5) {
            issue = `OPACITY BUG: next-measure dot has ${computedOpacity} opacity (should be ~0.3)`;
            summary.issues.push(`${position}: ${issue}`);
          }
        }

        // Issue 2: Has measure class but --measure-opacity not set
        if (classes.includes('note-current-measure') || classes.includes('note-next-measure')) {
          if (measureOpacity === 'not-set') {
            issue = `CSS VAR MISSING: has measure class but --measure-opacity not set`;
            summary.issues.push(`${position}: ${issue}`);
          }
        }

        // Issue 3: Conflicting classes
        // FIX: Use word boundary regex to avoid substring matching
        // (e.g., 'note-next-measure-first'.includes('note-next-measure') is true but wrong)
        const measureClasses = ['note-current-measure', 'note-next-measure', 'note-next-measure-first', 'note-other-measure'];
        const classesArray = classes.split(' ');
        const activeMeasureClasses = measureClasses.filter(c => classesArray.includes(c));
        if (activeMeasureClasses.length > 1) {
          issue = `CONFLICTING CLASSES: ${activeMeasureClasses.join(', ')}`;
          summary.issues.push(`${position}: ${issue}`);
        }

        dotStates.push({
          position,
          classes: classes.split(' ').filter(c => c.startsWith('note-')).join(' '),
          measureOpacity,
          computedOpacity,
          bgColor: bgColor.includes('rgb') ? bgColor : 'unknown',
          issue,
        });
      });

      // eslint-disable-next-line no-console
      console.log('%c📊 DOT STATE SNAPSHOT', 'font-size: 14px; font-weight: bold; color: #4CAF50');
      // eslint-disable-next-line no-console
      console.log(`   Total: ${summary.total} | Current: ${summary.current} | NextFirst: ${summary.nextFirst} | Next: ${summary.next} | Other: ${summary.other}`);
      // eslint-disable-next-line no-console
      console.log(`   Active: ${summary.active} | Played: ${summary.played} | No measure class: ${summary.noMeasureClass}`);

      if (summary.issues.length > 0) {
        // eslint-disable-next-line no-console
        console.log('%c🚨 ISSUES DETECTED:', 'color: red; font-weight: bold');
        summary.issues.forEach(issue => {
          // eslint-disable-next-line no-console
          console.log(`   ${issue}`);
        });
      }

      // eslint-disable-next-line no-console
      console.table(dotStates.filter(d => d.classes.length > 0));

      return summary;
    };

    if (continuous === true) {
      // eslint-disable-next-line no-console
      console.log('🔄 Starting continuous dot inspection (every 500ms). Call __INSPECT_DOTS__(false) to stop.');
      inspectorInterval = setInterval(inspect, 500);
    } else if (continuous === false) {
      // eslint-disable-next-line no-console
      console.log('⏹️ Stopped continuous dot inspection.');
    }

    return inspect();
  };

  (window as any).__WATCH_DOT__ = (positionKey: string | null) => {
    // Stop existing watch
    if (watchInterval) {
      clearInterval(watchInterval);
      watchInterval = null;
    }

    if (positionKey === null) {
      watchedPosition = null;
      // eslint-disable-next-line no-console
      console.log('⏹️ Stopped watching dot.');
      return;
    }

    watchedPosition = positionKey;
    // eslint-disable-next-line no-console
    console.log(`👁️ Watching dot at position "${positionKey}" - logs will appear when state changes`);

    let lastState = '';

    watchInterval = setInterval(() => {
      const dots = document.querySelectorAll('.fretboard-dot:not(.fretboard-2d-hidden .fretboard-dot)');
      let foundDot: Element | null = null;

      dots.forEach((dot) => {
        const title = (dot as HTMLElement).title || '';
        if (title.includes(`Fret ${positionKey.split(',')[1]}`) || (dot as HTMLElement).dataset.position === positionKey) {
          foundDot = dot;
        }
      });

      if (!foundDot) return;

      const classes = (foundDot as HTMLElement).className.split(' ').filter((c: string) => c.startsWith('note-')).sort().join(' ');
      const measureOpacity = (foundDot as HTMLElement).style.getPropertyValue('--measure-opacity') || 'not-set';
      const computedOpacity = window.getComputedStyle(foundDot).opacity;

      const currentState = `${classes}|${measureOpacity}|${computedOpacity}`;

      if (currentState !== lastState) {
        lastState = currentState;
        // eslint-disable-next-line no-console
        console.log(
          `👁️ [${positionKey}] CHANGED: classes=[${classes}] --measure-opacity=${measureOpacity} computed=${computedOpacity}`
        );
      }
    }, 100);
  };

  // eslint-disable-next-line no-console
  console.log('🔧 Visual inspectors loaded: __INSPECT_DOTS__() and __WATCH_DOT__(position)');
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert ExerciseNote string number to fretboard stringIndex
 *
 * Exercise strings are 1-6 based (1=highest pitch string)
 * Fretboard indices depend on string count:
 * - 4-string: E(1), A(2), D(3), G(4) -> indices 1,2,3,4 in full layout
 * - 5-string: B(0), E(1), A(2), D(3), G(4) -> indices 0,1,2,3,4
 * - 6-string: B(0), E(1), A(2), D(3), G(4), C(5) -> indices 0,1,2,3,4,5
 */
function noteStringToFretboardIndex(
  noteString: number,
  maxString: number,
): number {
  if (maxString <= 4) {
    // 4-string bass: strings 1-4 map to indices 4,3,2,1 (G, D, A, E)
    return 5 - noteString;
  } else if (maxString <= 5) {
    // 5-string bass: strings 1-5 map to indices 4,3,2,1,0 (G, D, A, E, B)
    return 5 - noteString;
  } else {
    // 6-string bass: strings 1-6 map to indices 5,4,3,2,1,0 (C, G, D, A, E, B)
    return 6 - noteString;
  }
}

/**
 * Convert fret number to Fret type (0 = 'open')
 */
function toFret(fretNumber: number): Fret {
  return fretNumber === 0 ? 'open' : fretNumber;
}

/**
 * Binary search to find the NOTE at a given time (returns -1 for rests)
 *
 * The quantized timeline includes both NOTE and REST entries:
 * - During a NOTE entry: returns the note's index in the original exercise
 * - During a REST entry: returns -1 (no note should be highlighted)
 * - Before first entry or after last entry: returns -1
 *
 * This ensures the yellow highlight ring disappears during rests,
 * providing accurate visual feedback that matches the sheet music.
 *
 * @param timeline - Sorted array of timeline entries (notes AND rests)
 * @param time - Current time in seconds
 * @returns noteIndex of the active note, or -1 if no note is active (rest or outside timeline)
 */
export function findNoteAtTime(timeline: NoteTimelineEntry[], time: number): number {
  if (timeline.length === 0) return -1;

  const firstEntry = timeline[0];
  const lastEntry = timeline[timeline.length - 1];

  // Handle before first entry
  if (!firstEntry || !lastEntry) return -1;
  if (time < firstEntry.startTime) return -1;

  // Handle after last entry
  if (time >= lastEntry.endTime) return -1;

  // Binary search: find the entry whose time range contains the current time
  let left = 0;
  let right = timeline.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const entry = timeline[mid];

    if (!entry) {
      return -1;
    }

    if (entry.startTime <= time) {
      // This entry has started - it could be the active one
      result = mid;
      // But there might be a later entry that also started, check right half
      left = mid + 1;
    } else {
      // This entry hasn't started yet, check left half
      right = mid - 1;
    }
  }

  // Verify we're still within the entry's time range
  if (result >= 0) {
    const entry = timeline[result];
    if (entry && time >= entry.endTime) {
      // We're at or past this entry's end time
      // Check if there's a next entry that starts exactly at this time (back-to-back notes)
      const nextEntry = timeline[result + 1];

      // DIAGNOSTIC: Log when we're at a transition boundary for notes 3-7
      const entryNoteIdx = entry.type === 'note' ? entry.noteIndex : -1;
      const nextNoteIdx = nextEntry?.type === 'note' ? nextEntry.noteIndex : -1;
      if ((entryNoteIdx >= 3 && entryNoteIdx <= 7) || (nextNoteIdx >= 3 && nextNoteIdx <= 7)) {
        const gap = nextEntry ? nextEntry.startTime - entry.endTime : NaN;
        // eslint-disable-next-line no-console
        console.log(
          `[TRANSITION-BOUNDARY] t=${time.toFixed(6)}s | ` +
          `entry#${result}(idx=${entryNoteIdx}) end=${entry.endTime.toFixed(6)}s | ` +
          `next#${result+1}(idx=${nextNoteIdx}) start=${nextEntry?.startTime.toFixed(6) ?? 'N/A'}s | ` +
          `gap=${(gap * 1000).toFixed(3)}ms | ` +
          `time>=nextStart: ${nextEntry ? time >= nextEntry.startTime : 'N/A'}`
        );
      }

      if (nextEntry && time >= nextEntry.startTime && time < nextEntry.endTime) {
        // The next entry covers this time - use it instead
        if (nextEntry.type === 'rest') {
          return -1;
        }
        return nextEntry.noteIndex;
      }
      // No valid next entry - we're in a gap
      return -1;
    }

    // If this is a REST entry, return -1 (no note to highlight)
    if (entry && entry.type === 'rest') {
      return -1;
    }

    // It's a NOTE entry - return its noteIndex
    return entry?.noteIndex ?? -1;
  }

  return -1;
}

/**
 * Find the timeline entry (note OR rest) containing the current time
 *
 * Unlike findNoteAtTime which returns -1 for rests, this returns the actual
 * entry so we can access its measure field. This is critical for measure
 * change detection during REST periods.
 *
 * @param timeline - Sorted array of timeline entries (notes AND rests)
 * @param time - Current time in seconds
 * @returns The timeline entry containing this time, or null if outside timeline
 */
export function findEntryAtTime(
  timeline: NoteTimelineEntry[],
  time: number,
): NoteTimelineEntry | null {
  if (timeline.length === 0) return null;

  const firstEntry = timeline[0];
  const lastEntry = timeline[timeline.length - 1];

  // Handle before first entry
  if (!firstEntry || !lastEntry) return null;
  if (time < firstEntry.startTime) return null;

  // Handle after last entry
  if (time >= lastEntry.endTime) return null;

  // Binary search: find the entry whose time range contains the current time
  let left = 0;
  let right = timeline.length - 1;
  let result = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const entry = timeline[mid];

    if (!entry) {
      return null;
    }

    if (entry.startTime <= time) {
      // This entry has started - it could be the active one
      result = mid;
      // But there might be a later entry that also started, check right half
      left = mid + 1;
    } else {
      // This entry hasn't started yet, check left half
      right = mid - 1;
    }
  }

  // Verify we're still within the entry's time range
  if (result >= 0) {
    const entry = timeline[result];
    if (entry && time >= entry.endTime) {
      // We're at or past this entry's end time
      // Check if there's a next entry that starts exactly at this time (back-to-back)
      const nextEntry = timeline[result + 1];
      if (nextEntry && time >= nextEntry.startTime && time < nextEntry.endTime) {
        return nextEntry;
      }
      // No valid next entry - we're in a gap
      return null;
    }
    return entry ?? null;
  }

  return null;
}

/**
 * Find the next NOTE (not rest) after the current time (for preview)
 *
 * Skips over REST entries to find the next actual note that will be highlighted.
 * This is used for the "preview" indicator showing which note is coming up.
 *
 * @param timeline - Sorted array of timeline entries (notes AND rests)
 * @param time - Current time in seconds
 * @returns noteIndex of the next note, or -1 if none
 */
function findNextNoteAfterTime(
  timeline: NoteTimelineEntry[],
  time: number,
): number {
  if (timeline.length === 0) return -1;

  // Binary search for the first entry starting after this time
  let left = 0;
  let right = timeline.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    const entry = timeline[mid];
    if (entry && entry.startTime <= time) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  // Skip past any REST entries to find the next actual NOTE
  while (left < timeline.length) {
    const entry = timeline[left];
    if (entry && entry.type === 'note') {
      return entry.noteIndex;
    }
    left++;
  }

  return -1;
}

// ============================================================================
// TIMELINE BUILDER
// ============================================================================

/**
 * Build a quantized note timeline from exercise notes.
 *
 * This function uses the quantized timeline from exerciseToMusicXML.ts which:
 * 1. Quantizes all notes to a 16th note grid (0.25 beats)
 * 2. Inserts explicit REST entries in gaps between notes
 * 3. Ensures no overlapping entries - each entry ends when the next begins
 *
 * The resulting timeline is used for visual synchronization:
 * - During NOTE entries: highlight the corresponding fretboard position
 * - During REST entries: no highlight (findNoteAtTime returns -1)
 *
 * @param notes - Exercise notes array
 * @param tempo - BPM
 * @param timeSignature - Time signature (defaults to 4/4)
 * @param countdownBeats - Number of countdown beats before exercise starts
 * @returns Sorted array of timeline entries (notes AND rests)
 */
function buildNoteTimeline(
  notes: ExerciseNoteInput[],
  tempo: number,
  timeSignature: TimeSignature,
  countdownBeats: number,
): NoteTimelineEntry[] {
  if (notes.length === 0) return [];

  // Find max string number to determine bass type (for position conversion)
  const maxString = Math.max(...notes.map((n) => n.string));

  // Use the quantized timeline builder from exerciseToMusicXML
  // This handles measure organization, rest insertion, and quantization
  const quantizedTimeline = buildQuantizedTimeline({
    // Cast to ExerciseNote type - the function only uses position and duration fields
    // which our ExerciseNoteInput interface provides
    notes: notes as unknown as Parameters<typeof buildQuantizedTimeline>[0]['notes'],
    bpm: tempo,
    timeSignature,
    countdownBeats,
  });

  // Convert QuantizedTimelineEntry to NoteTimelineEntry with fretboard positions
  const timeline: NoteTimelineEntry[] = quantizedTimeline.map((entry) => {
    // For rests, use a placeholder position (won't be used for highlighting)
    let position: { stringIndex: number; fret: Fret } = { stringIndex: 0, fret: 0 };

    if (entry.type === 'note' && entry.note) {
      // Convert note string/fret to fretboard position
      // The note field on QuantizedTimelineEntry is ExerciseNote from contracts
      const noteString = (entry.note as unknown as ExerciseNoteInput).string;
      const noteFret = (entry.note as unknown as ExerciseNoteInput).fret;
      const stringIndex = noteStringToFretboardIndex(noteString, maxString);
      const fret = toFret(noteFret);
      position = { stringIndex, fret };
    }

    return {
      type: entry.type,
      startTime: entry.startTime,
      endTime: entry.endTime,
      position,
      noteIndex: entry.noteIndex,
      note: entry.type === 'note' ? (entry.note as unknown as ExerciseNoteInput) : undefined,
      measure: entry.measure,
      durationBeats: entry.durationBeats,
    };
  });

  return timeline;
}

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * Direct DOM note synchronization hook for FretboardCard
 *
 * Provides jitter-free note highlighting by:
 * 1. Pre-calculating note timeline on exercise change
 * 2. Using binary search to find current note (O(log n))
 * 3. Updating DOM directly via classList.toggle()
 *
 * @param config - Configuration including exercise notes and playback state
 * @returns Object with ref registration and timeline access
 */
export function useFretboardNoteSync(
  config: FretboardNoteSyncConfig,
): FretboardNoteSyncResult {
  const {
    exerciseNotes,
    tempo,
    stringCount: _stringCount, // Reserved for future use
    maxFrets: _maxFrets, // Reserved for future use
    isPlaying,
    isVisible = true,
    timeSignature = { numerator: 4, denominator: 4 },
    countdownBeats = 4,
    onMeasureChange,
  } = config;

  // ============================================================================
  // REFS - Mutable state that doesn't trigger re-renders
  // ============================================================================

  /**
   * Map of noteIndex -> DOM element reference
   * Using Map for O(1) lookup during DOM updates
   */
  const noteRefs = useRef<Map<number, HTMLDivElement>>(new Map());

  /**
   * Current active note index (-1 if none)
   * Updated directly by clock subscription, not via setState
   */
  const currentNoteIndexRef = useRef<number>(-1);

  /**
   * Next note index for preview (-1 if none)
   */
  const nextNoteIndexRef = useRef<number>(-1);

  /**
   * Previous active note index (for detecting changes)
   */
  const previousNoteIndexRef = useRef<number>(-1);

  /**
   * Previous measure (for detecting measure changes and clearing played state)
   * When measure changes, all note-played classes should be cleared
   */
  const previousMeasureRef = useRef<number>(-1);

  /**
   * SINGLE SOURCE OF TRUTH: Current measure (0-based) at 60fps
   *
   * This ref is updated directly by the AtomicPlaybackClock callback,
   * bypassing React's batched updates. It's THE authoritative source
   * for current measure during playback.
   *
   * FretboardGrid and other consumers should use getCurrentMeasure()
   * instead of useFretboardExercise.currentMeasureFromNote to avoid
   * the ~20ms desync that causes animation flicker.
   */
  const currentMeasureRef = useRef<number>(-1);

  /**
   * Track visibility without re-subscribing
   */
  const isVisibleRef = useRef(isVisible);
  useEffect(() => {
    isVisibleRef.current = isVisible;
  }, [isVisible]);

  /**
   * Store onMeasureChange callback in ref to avoid stale closure in 60fps loop
   */
  const onMeasureChangeRef = useRef(onMeasureChange);
  useEffect(() => {
    onMeasureChangeRef.current = onMeasureChange;
  }, [onMeasureChange]);

  /**
   * Track playing state without re-subscribing
   */
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // ============================================================================
  // TIMELINE CALCULATION - Memoized, only recalculates when exercise changes
  // ============================================================================

  /**
   * Pre-calculated quantized timeline with notes AND rests
   * This is the core optimization - calculated once, used every frame
   */
  const timeline = useMemo(() => {
    if (exerciseNotes.length === 0) return [];

    const built = buildNoteTimeline(
      exerciseNotes,
      tempo,
      timeSignature,
      countdownBeats,
    );

    // Count notes vs rests for summary
    const noteEntries = built.filter(e => e.type === 'note');
    const restEntries = built.filter(e => e.type === 'rest');
    const firstEntry = built[0];
    const lastEntry = built[built.length - 1];

    // ============================================================================
    // DIAGNOSTIC LOGGING - Timeline Build
    // Log the complete timeline data structure
    // ============================================================================
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(
      `📋 [TIMELINE-BUILD] ===== TIMELINE DATA =====\n` +
      `  Notes: ${noteEntries.length} | Rests: ${restEntries.length} | Total entries: ${built.length}\n` +
      `  Tempo: ${tempo} BPM | Time Sig: ${timeSignature.numerator}/${timeSignature.denominator}\n` +
      `  Countdown: ${countdownBeats} beats\n` +
      `  Duration: ${lastEntry ? (lastEntry.endTime - (firstEntry?.startTime ?? 0)).toFixed(2) : '0'}s`
    );

    // Log each entry in detail (ALWAYS - for debugging)
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(`📋 [TIMELINE-BUILD] ----- Entry Details -----`);
    built.forEach((entry, i) => {
      const duration = entry.endTime - entry.startTime;
      const durationMs = duration * 1000;
      if (entry.type === 'note' && entry.note) {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `  [${i}] NOTE idx=${entry.noteIndex} | ` +
          `str${entry.note.string}:fret${entry.note.fret} | ` +
          `m${entry.measure} | ` +
          `${entry.startTime.toFixed(3)}s → ${entry.endTime.toFixed(3)}s | ` +
          `dur=${duration.toFixed(3)}s (${durationMs.toFixed(0)}ms) = ${entry.durationBeats.toFixed(2)} beats`
        );
      } else {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `  [${i}] REST | m${entry.measure} | ` +
          `${entry.startTime.toFixed(3)}s → ${entry.endTime.toFixed(3)}s | ` +
          `dur=${duration.toFixed(3)}s (${durationMs.toFixed(0)}ms)`
        );
      }
    });
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(`📋 [TIMELINE-BUILD] ===== END TIMELINE =====`);

    return built;
  }, [exerciseNotes, tempo, timeSignature, countdownBeats]);

  /**
   * Store timeline in ref for access in subscription callback
   * (avoids stale closure issues)
   */
  const timelineRef = useRef(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  /**
   * Check if a note position exists in the next measure
   * Used to prevent adding .note-played when the same position should show as preview
   *
   * @param noteIndex - The index of the note being checked
   * @param currentMeasure - Current measure (0-based)
   * @returns true if the same position has a note in currentMeasure + 1
   */
  const positionExistsInNextMeasure = useCallback(
    (noteIndex: number, currentMeasure: number): boolean => {
      const currentTimeline = timelineRef.current;
      const nextMeasure = currentMeasure + 1;

      // Find the note entry for the given noteIndex
      const noteEntry = currentTimeline.find(
        (e) => e.type === 'note' && e.noteIndex === noteIndex
      );
      if (!noteEntry) return false;

      const { stringIndex, fret } = noteEntry.position;

      // Check if any note in the next measure has the same position
      return currentTimeline.some(
        (e) =>
          e.type === 'note' &&
          e.measure === nextMeasure &&
          e.position.stringIndex === stringIndex &&
          e.position.fret === fret
      );
    },
    []
  );

  /**
   * SINGLE SOURCE OF TRUTH: Update measure-based opacity classes for ALL notes
   *
   * This function is called on measure change to update opacity classes:
   * - Notes in current measure get .note-current-measure (100% opacity)
   * - Notes in next measure get .note-next-measure (30% opacity)
   * - Notes in other measures get .note-other-measure (0% opacity - HIDDEN)
   *
   * IMPORTANT: Multiple note indices can share the SAME DOM element (when the same
   * fretboard position appears in multiple measures). We must determine the BEST
   * visibility state for each element:
   * - If ANY note at this position is in current measure → show at 100%
   * - Else if ANY note at this position is in next measure → show at 30%
   * - Else ALL notes are in other measures → hide (0%)
   *
   * This replaces the React-based inline opacity calculation in FretboardGrid.
   *
   * @param newMeasure - The new current measure (0-based)
   */
  const updateMeasureOpacityClasses = useCallback((newMeasure: number) => {
    const currentTimeline = timelineRef.current;
    const nextMeasure = newMeasure + 1;

    // GRANULAR LOGGING: Track state counts for summary
    const stateCounts = { current: 0, nextFirst: 0, next: 0, other: 0 };
    const stateDetails: Array<{ noteIndices: number[]; state: string; opacity: string }> = [];

    // Summary log for measure change (always log for debugging)
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(
      `🎯 [MEASURE-OPACITY] START measure=${newMeasure} next=${nextMeasure} | ` +
      `registeredNotes=${noteRefs.current.size} | timeline=${currentTimeline.length} entries`
    );

    // Build a map of noteIndex -> measure for quick lookup
    const noteToMeasure = new Map<number, number>();
    currentTimeline.forEach((entry) => {
      if (entry.type === 'note') {
        noteToMeasure.set(entry.noteIndex, entry.measure);
      }
    });

    // Find the FIRST note in the next measure (by timeline order = chronological)
    // This note will get 100% opacity as the "transition target"
    let firstNoteIndexInNextMeasure = -1;
    // Also track ALL notes in next measure for diagnostic
    const allNotesInNextMeasure: Array<{ noteIndex: number; fret: number; string: number }> = [];
    for (const entry of currentTimeline) {
      if (entry.type === 'note' && entry.measure === nextMeasure) {
        if (firstNoteIndexInNextMeasure === -1) {
          firstNoteIndexInNextMeasure = entry.noteIndex;
        }
        if (entry.note) {
          allNotesInNextMeasure.push({
            noteIndex: entry.noteIndex,
            fret: entry.note.fret,
            string: entry.note.string,
          });
        }
      }
    }

    // DEBUG: Log which note is considered "first" in next measure
    if (allNotesInNextMeasure.length > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `   🎯 [NEXT-MEASURE-NOTES] firstNoteIndex=${firstNoteIndexInNextMeasure} | ` +
        `allNotesInNextMeasure: ${allNotesInNextMeasure.map(n => `#${n.noteIndex}(str${n.string}:fret${n.fret})`).join(', ')}`
      );
    }

    // DEBUG: Also log notes in current measure for comparison
    const allNotesInCurrentMeasure: Array<{ noteIndex: number; fret: number; string: number }> = [];
    for (const entry of currentTimeline) {
      if (entry.type === 'note' && entry.measure === newMeasure && entry.note) {
        allNotesInCurrentMeasure.push({
          noteIndex: entry.noteIndex,
          fret: entry.note.fret,
          string: entry.note.string,
        });
      }
    }
    if (allNotesInCurrentMeasure.length > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `   📍 [CURRENT-MEASURE-NOTES] measure=${newMeasure} | ` +
        `notes: ${allNotesInCurrentMeasure.map(n => `#${n.noteIndex}(str${n.string}:fret${n.fret})`).join(', ')}`
      );
    }

    // DEBUG: Find positions that appear in BOTH current and next measures
    const currentPositions = new Set(allNotesInCurrentMeasure.map(n => `${n.string}-${n.fret}`));
    const nextPositions = new Set(allNotesInNextMeasure.map(n => `${n.string}-${n.fret}`));
    const sharedPositions = Array.from(currentPositions).filter(pos => nextPositions.has(pos));
    if (sharedPositions.length > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `   ⚠️ [SHARED-POSITIONS] ${sharedPositions.length} positions appear in BOTH measures: ${sharedPositions.join(', ')}`
      );
    }

    // ==========================================================================
    // MULTI-NOTE POSITION FIX: Group note indices by DOM element
    // ==========================================================================
    // Multiple note indices can share the same DOM element (same fretboard position
    // appearing in multiple measures). We need to determine the BEST state for each
    // element, not just process them sequentially (which would cause the last one to win).
    //
    // Priority: current (100%) > next-first (100%) > next (30%) > other (0%)
    // ==========================================================================

    // Build a map of element -> all note indices for that element
    const elementToNoteIndices = new Map<HTMLElement, number[]>();
    noteRefs.current.forEach((element, noteIndex) => {
      const existing = elementToNoteIndices.get(element) || [];
      existing.push(noteIndex);
      elementToNoteIndices.set(element, existing);
    });

    // Process each unique element once, using the BEST state from all its notes
    elementToNoteIndices.forEach((noteIndices, element) => {
      // Determine the best state for this element based on all notes at this position
      let bestState: 'current' | 'next-first' | 'next' | 'other' = 'other';
      let bestNoteIndex = noteIndices[0];

      for (const noteIndex of noteIndices) {
        const noteMeasure = noteToMeasure.get(noteIndex);

        if (noteMeasure === undefined) {
          continue; // Skip notes not in timeline
        }

        const isCurrentMeasure = noteMeasure === newMeasure;
        const isNextMeasure = noteMeasure === nextMeasure;
        const isFirstNoteInNextMeasure = noteIndex === firstNoteIndexInNextMeasure;

        // Update best state if this note has higher priority
        if (isCurrentMeasure) {
          bestState = 'current';
          bestNoteIndex = noteIndex;
          break; // Current is highest priority, no need to check more
        } else if (isFirstNoteInNextMeasure) {
          // Note: bestState can never be 'current' here because we break above
          bestState = 'next-first';
          bestNoteIndex = noteIndex;
          // DEBUG: Log why this element got next-first
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `      🔍 [NEXT-FIRST-MATCH] noteIndex=${noteIndex} === firstNoteIndexInNextMeasure=${firstNoteIndexInNextMeasure} ` +
            `| noteMeasure=${noteMeasure} nextMeasure=${nextMeasure}`
          );
        } else if (isNextMeasure && bestState !== 'next-first') {
          bestState = 'next';
          bestNoteIndex = noteIndex;
          // DEBUG: Log why this element got next (30% preview)
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `      📐 [NEXT-MATCH] noteIndex=${noteIndex} in nextMeasure=${nextMeasure} | noteMeasure=${noteMeasure}`
          );
        }
        // 'other' is default, no update needed
      }

      // DEBUG: Log final state for elements with notes ONLY in next measure (not current)
      // If element has notes in BOTH current and next, 'current' state is CORRECT (current wins)
      const hasNoteInNext = noteIndices.some(idx => noteToMeasure.get(idx) === nextMeasure);
      const hasNoteInCurrent = noteIndices.some(idx => noteToMeasure.get(idx) === newMeasure);

      // Only flag as bug if element has notes in next but NOT in current, yet got wrong state
      if (hasNoteInNext && !hasNoteInCurrent && bestState !== 'next' && bestState !== 'next-first') {
        // TRUE BUG: Notes ONLY in next measure but got 'other' or 'current' state
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.error(
          `      🚨 [NEXT-ONLY-BUG] Notes ONLY in nextMeasure but got state='${bestState}' | ` +
          `noteIndices=[${noteIndices.join(',')}] | measures=[${noteIndices.map(idx => noteToMeasure.get(idx)).join(',')}]`
        );
      } else if (hasNoteInNext && hasNoteInCurrent && bestState === 'current') {
        // EXPECTED: Element has notes in both current and next - current wins (100% opacity)
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `      ✅ [CURRENT-WINS] Notes in both current(${newMeasure}) and next(${nextMeasure}) → showing as current | ` +
          `noteIndices=[${noteIndices.join(',')}]`
        );
      }

      // Apply classes based on best state
      const isCurrentMeasure = bestState === 'current';
      const isNextFirst = bestState === 'next-first';
      const isNextMeasure = bestState === 'next' || bestState === 'next-first';
      const isOtherMeasure = bestState === 'other';

      // DEBUG: Log ALL elements that get 100% opacity in preview measure
      // This catches both next-first (correct) and unexpected cases
      if (isNextFirst || (hasNoteInNext && !hasNoteInCurrent && bestState !== 'next')) {
        const noteMeasures = noteIndices.map(idx => noteToMeasure.get(idx));
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `   🔎 [100%-IN-NEXT] title="${element.title}" | bestState=${bestState} | ` +
          `noteIndices=[${noteIndices.join(',')}] | measures=[${noteMeasures.join(',')}] | ` +
          `firstNoteInNext=${firstNoteIndexInNextMeasure} | ` +
          `isNextFirst=${isNextFirst} | hasNoteInCurrent=${hasNoteInCurrent}`
        );
      }

      // Remove all measure classes AND animation state classes first, then apply the correct one
      // CRITICAL: Must also remove DOT_ACTIVE, otherwise elements with both .note-active
      // and .note-next-measure will get 100% opacity from the CSS rule .note-active.note-next-measure
      element.classList.remove(
        CSS_CLASSES.DOT_CURRENT_MEASURE,
        CSS_CLASSES.DOT_NEXT_MEASURE,
        CSS_CLASSES.DOT_NEXT_MEASURE_FIRST,
        CSS_CLASSES.DOT_OTHER_MEASURE,
        CSS_CLASSES.DOT_ACTIVE,
        CSS_CLASSES.DOT_PREVIEW,
        CSS_CLASSES.DOT_PLAYED
      );

      let addedClass = '';
      if (isCurrentMeasure) {
        element.classList.add(CSS_CLASSES.DOT_CURRENT_MEASURE);
        addedClass = CSS_CLASSES.DOT_CURRENT_MEASURE;
      } else if (isNextFirst) {
        element.classList.add(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST);
        addedClass = CSS_CLASSES.DOT_NEXT_MEASURE_FIRST;
      } else if (isNextMeasure) {
        element.classList.add(CSS_CLASSES.DOT_NEXT_MEASURE);
        addedClass = CSS_CLASSES.DOT_NEXT_MEASURE;
      } else if (isOtherMeasure) {
        element.classList.add(CSS_CLASSES.DOT_OTHER_MEASURE);
        addedClass = CSS_CLASSES.DOT_OTHER_MEASURE;
      }

      // Set CSS variable opacity based on best state
      // SINGLE-LAYER ARCHITECTURE - Measure-based opacity:
      // - Current measure: 100% opacity (highlighted green/orange)
      // - First note of next measure: 100% opacity (transition target, highlighted)
      // - Other notes in next measure: 30% opacity (preview)
      // - Other measures: 100% opacity (GREY - visible as non-exercise dots)
      let expectedOpacity: string;
      if (isCurrentMeasure || isNextFirst) {
        expectedOpacity = '1';
        stateCounts.current += isCurrentMeasure ? 1 : 0;
        stateCounts.nextFirst += isNextFirst ? 1 : 0;
      } else if (isNextMeasure) {
        expectedOpacity = '0.3';
        stateCounts.next++;
      } else {
        // Notes in OTHER measures are shown as GREY (visible, not hidden)
        // The .note-other-measure CSS class sets background-color to grey (slate-600)
        // and keeps opacity at 1 (fully visible)
        expectedOpacity = '1';
        stateCounts.other++;
      }
      element.style.setProperty('--measure-opacity', expectedOpacity);

      // GRANULAR LOG: Record this element's final state
      stateDetails.push({ noteIndices, state: bestState, opacity: expectedOpacity });

      // ==========================================================================
      // VALIDATION: Read back from DOM and log ONLY if there's a discrepancy
      // ==========================================================================
      // This is the key diagnostic - instead of logging everything, we only log
      // when the actual DOM state doesn't match what we just set.
      const actualOpacity = element.style.getPropertyValue('--measure-opacity');
      const actualClasses = element.className;
      const hasExpectedClass = actualClasses.includes(addedClass);

      // Check for discrepancies
      const opacityMismatch = actualOpacity !== expectedOpacity;
      const classMismatch = !hasExpectedClass;

      // Also check for stale classes (classes from wrong measure state)
      const hasStaleCurrentClass = !isCurrentMeasure && actualClasses.includes(CSS_CLASSES.DOT_CURRENT_MEASURE);
      const hasStaleNextClass = !isNextMeasure && !isNextFirst && actualClasses.includes(CSS_CLASSES.DOT_NEXT_MEASURE);
      const hasStaleNextFirstClass = !isNextFirst && actualClasses.includes(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST);
      const hasStaleOtherClass = !isOtherMeasure && actualClasses.includes(CSS_CLASSES.DOT_OTHER_MEASURE);
      const hasAnyStaleClass = hasStaleCurrentClass || hasStaleNextClass || hasStaleNextFirstClass || hasStaleOtherClass;

      if (opacityMismatch || classMismatch || hasAnyStaleClass) {
        const measuresAtPosition = noteIndices.map(idx => noteToMeasure.get(idx) ?? -1);
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.error(
          `🚨 [OPACITY-DISCREPANCY] noteIndices=[${noteIndices.join(',')}] measures=[${measuresAtPosition.join(',')}]\n` +
          `   Expected: state=${bestState} class=${addedClass} opacity=${expectedOpacity}\n` +
          `   Actual: classes="${actualClasses}" opacity="${actualOpacity}"\n` +
          `   Stale classes: current=${hasStaleCurrentClass} next=${hasStaleNextClass} nextFirst=${hasStaleNextFirstClass} other=${hasStaleOtherClass}`
        );
      }

      // ULTRA DEBUG: Log EVERY element with its computed opacity (not just discrepancies)
      // This helps find cases where the visual result doesn't match the expected state
      if (isUltraDebugEnabled()) {
        const computedStyle = window.getComputedStyle(element);
        const computedOpacity = computedStyle.opacity;
        const computedBg = computedStyle.backgroundColor;
        const measuresAtPosition = noteIndices.map(idx => noteToMeasure.get(idx) ?? -1);
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `🔎 [ULTRA] noteIndices=[${noteIndices.join(',')}] measures=[${measuresAtPosition.join(',')}] | ` +
          `state=${bestState} | ` +
          `--measure-opacity=${actualOpacity} | ` +
          `computedOpacity=${computedOpacity} | ` +
          `bg=${computedBg.slice(0, 30)} | ` +
          `classes=[${actualClasses.split(' ').filter(c => c.startsWith('note-')).join(',')}]`
        );
      }

      // Only log successful updates when verbose debug is enabled
      if (isDebugEnabled()) {
        const bestNoteMeasure = noteToMeasure.get(bestNoteIndex) ?? -1;
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `  element (noteIndices=[${noteIndices.join(',')}]) -> ${bestState.toUpperCase()} ` +
          `(bestNote#${bestNoteIndex} m=${bestNoteMeasure}, --measure-opacity: ${expectedOpacity})`
        );
      }
    });

    // GRANULAR SUMMARY LOG: What actually got set
    // eslint-disable-next-line no-console, no-restricted-syntax
    console.log(
      `🎯 [MEASURE-OPACITY] DONE measure=${newMeasure} | ` +
      `COUNTS: current=${stateCounts.current} nextFirst=${stateCounts.nextFirst} next=${stateCounts.next} other=${stateCounts.other} | ` +
      `TOTAL=${stateCounts.current + stateCounts.nextFirst + stateCounts.next + stateCounts.other}`
    );

    // Log elements getting 30% opacity (should be next measure except firstNoteInNextMeasure)
    const elementsAt30 = stateDetails.filter(d => d.opacity === '0.3');
    if (elementsAt30.length > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `   📊 Elements at 30% opacity (next measure): ${elementsAt30.length} elements | ` +
        `noteIndices: [${elementsAt30.map(e => e.noteIndices.join(',')).join('], [')}]`
      );
    }

    // Log elements at 100% that are in "next" category (should only be firstNoteInNextMeasure)
    const elementsAt100NextFirst = stateDetails.filter(d => d.state === 'next-first');
    if (elementsAt100NextFirst.length > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(
        `   📊 Elements at 100% (next-first): ${elementsAt100NextFirst.length} elements | ` +
        `noteIndices: [${elementsAt100NextFirst.map(e => e.noteIndices.join(',')).join('], [')}]`
      );
    }

    // ==========================================================================
    // DIAGNOSTIC: Check computed opacity for 30% elements IMMEDIATELY
    // This helps identify if CSS is not being applied correctly
    // ==========================================================================
    if (elementsAt30.length > 0 && isDebugEnabled()) {
      // Use requestAnimationFrame to ensure CSS has been applied
      requestAnimationFrame(() => {
        elementsAt30.forEach(({ noteIndices }) => {
          // Find the element for these notes
          const el = Array.from(noteRefs.current.entries()).find(
            ([idx]) => noteIndices.includes(idx)
          )?.[1];
          if (el) {
            const computedOpacity = window.getComputedStyle(el).opacity;
            const cssClasses = el.className.split(' ').filter(c => c.startsWith('note-')).join(', ');
            const measureOpacityVar = el.style.getPropertyValue('--measure-opacity');
            const fadeOpacityVar = el.style.getPropertyValue('--fade-opacity');
            const hasFretboardDotClass = el.classList.contains('fretboard-dot');
            // eslint-disable-next-line no-console, no-restricted-syntax
            console.log(
              `   🔍 [30%-VERIFY] noteIndices=[${noteIndices.join(',')}] | ` +
              `computedOpacity=${computedOpacity} (expect ~0.3) | ` +
              `--measure-opacity=${measureOpacityVar} | ` +
              `--fade-opacity=${fadeOpacityVar} | ` +
              `hasFretboardDotClass=${hasFretboardDotClass} | ` +
              `classes=[${cssClasses}]`
            );
            // Flag if computed opacity is wrong
            const parsed = parseFloat(computedOpacity);
            if (parsed > 0.5) {
              // eslint-disable-next-line no-console, no-restricted-syntax
              console.error(
                `   🚨 [30%-BUG!] Element should be ~30% but computed=${computedOpacity}! ` +
                `Check CSS cascade or inline styles!`
              );
            } else {
              // SUCCESS: The fix is working!
              // eslint-disable-next-line no-console, no-restricted-syntax
              console.log(
                `   ✅ [30%-FIX-WORKING] noteIndices=[${noteIndices.join(',')}] | ` +
                `computed=${computedOpacity} via .fretboard-dot CSS rule with --measure-opacity=${measureOpacityVar}`
              );
            }
          }
        });
      });

      // ==========================================================================
      // REACT RE-RENDER TEST: Check again after React might have re-rendered
      // This tests if the .fretboard-dot CSS rule persists the opacity
      // ==========================================================================
      setTimeout(() => {
        if (!isDebugEnabled()) return;
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(`\n   🔄 [POST-REACT-RENDER-CHECK] Verifying 30% opacity persists after ~100ms...`);
        elementsAt30.forEach(({ noteIndices }) => {
          const el = Array.from(noteRefs.current.entries()).find(
            ([idx]) => noteIndices.includes(idx)
          )?.[1];
          if (el) {
            const computedOpacity = window.getComputedStyle(el).opacity;
            const cssClasses = el.className.split(' ').filter(c => c.startsWith('note-')).join(', ');
            const measureOpacityVar = el.style.getPropertyValue('--measure-opacity');
            const parsed = parseFloat(computedOpacity);

            if (parsed > 0.5 && isDebugEnabled()) {
              // eslint-disable-next-line no-console, no-restricted-syntax
              console.log(
                `   🚨 [POST-REACT-BUG!] After ~100ms: noteIndices=[${noteIndices.join(',')}] | ` +
                `computed=${computedOpacity} (should be ~0.3) | ` +
                `--measure-opacity=${measureOpacityVar} | classes=[${cssClasses}] | ` +
                `REACT LIKELY OVERWROTE THE CLASSES!`
              );
            } else if (isDebugEnabled()) {
              // eslint-disable-next-line no-console, no-restricted-syntax
              console.log(
                `   ✅ [POST-REACT-OK] noteIndices=[${noteIndices.join(',')}] | ` +
                `computed=${computedOpacity} | --measure-opacity=${measureOpacityVar} persisted!`
              );
            }
          }
        });
      }, 100); // 100ms should be enough for React's batched updates
    }

    // CRITICAL: Check for elements in next measure that got 100% but shouldn't
    // (i.e., they are "next" but not "next-first", yet have opacity 1)
    const unexpectedAt100 = stateDetails.filter(d => d.state === 'next' && d.opacity === '1');
    if (unexpectedAt100.length > 0) {
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.error(
        `🚨 [BUG] Elements in NEXT measure have 100% opacity but should be 30%! | ` +
        `count=${unexpectedAt100.length} | noteIndices: [${unexpectedAt100.map(e => e.noteIndices.join(',')).join('], [')}]`
      );
    }

    // ==========================================================================
    // FINAL VALIDATION: Query ALL fretboard dots and check computed opacities
    // ==========================================================================
    // This is the nuclear option - check what the browser ACTUALLY computed
    // after all CSS cascade effects have been applied.
    // Only runs if ULTRA DEBUG is enabled to avoid performance impact.
    if (isUltraDebugEnabled()) {
      setTimeout(() => {
        // Wait a frame for CSS to fully apply
        const allDots = document.querySelectorAll('.fretboard-dot:not(.fretboard-2d-hidden .fretboard-dot)');
        const issues: string[] = [];

        allDots.forEach((dot) => {
          const el = dot as HTMLElement;
          const classes = el.className;
          const computedOpacity = parseFloat(window.getComputedStyle(el).opacity);
          const measureOpacity = el.style.getPropertyValue('--measure-opacity');
          const title = el.title || 'unknown';

          // Extract measure class state
          const hasCurrentMeasure = classes.includes('note-current-measure');
          const hasNextMeasureFirst = classes.includes('note-next-measure-first');
          const hasNextMeasure = classes.includes('note-next-measure') && !hasNextMeasureFirst;
          const hasOtherMeasure = classes.includes('note-other-measure');

          // Skip non-exercise dots (dots without any note-* classes)
          // These are fretboard dots that are NOT part of the exercise.
          // Their opacity is controlled by scroll fade (--fade-opacity), not measure opacity.
          // We only validate exercise dots that have measure-based opacity classes.
          const isExerciseDot = hasCurrentMeasure || hasNextMeasureFirst || hasNextMeasure || hasOtherMeasure;
          if (!isExerciseDot) {
            return; // Skip validation - this dot is controlled by scroll fade, not measure opacity
          }

          // Determine expected computed opacity based on class
          let expectedComputed = 1;
          let expectedState = 'unknown';
          if (hasCurrentMeasure) {
            expectedComputed = 1;
            expectedState = 'current';
          } else if (hasNextMeasureFirst) {
            expectedComputed = 1;
            expectedState = 'next-first';
          } else if (hasNextMeasure) {
            expectedComputed = 0.3;
            expectedState = 'next';
          } else if (hasOtherMeasure) {
            expectedComputed = 1; // Grey but visible
            expectedState = 'other';
          }

          // Flag if computed opacity is unexpected
          const tolerance = 0.05;
          if (Math.abs(computedOpacity - expectedComputed) > tolerance) {
            issues.push(
              `${title}: expected=${expectedComputed} (${expectedState}) but got=${computedOpacity} | ` +
              `--measure-opacity=${measureOpacity} | ` +
              `classes=[${classes.split(' ').filter(c => c.startsWith('note-')).join(',')}]`
            );
          }
        });

        if (issues.length > 0) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.error(
            `🔴 [FINAL-VALIDATION] ${issues.length} dots have wrong computed opacity:\n` +
            issues.map(i => `   ${i}`).join('\n')
          );
        } else {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(`✅ [FINAL-VALIDATION] All ${allDots.length} dots have correct computed opacity`);
        }
      }, 16); // Wait one frame (16ms)
    }
  }, []);

  // ============================================================================
  // REF REGISTRATION
  // ============================================================================

  /**
   * Register a note element by its index
   * Returns a ref callback function for use in JSX
   *
   * Usage: ref={registerNoteRef(noteIndex)}
   */
  const registerNoteRef = useCallback(
    (noteIndex: number) => (el: HTMLDivElement | null) => {
      if (el) {
        noteRefs.current.set(noteIndex, el);
      } else {
        noteRefs.current.delete(noteIndex);
      }
    },
    [],
  );

  // ============================================================================
  // CSS CLASS HELPERS
  // ============================================================================

  /**
   * Get the base CSS class name for a note
   * This is for initial render only - the hook will toggle state classes during playback
   */
  const getNoteClassName = useCallback((_noteIndex: number) => {
    // Base class - the active/preview states are toggled by the hook
    return '';
  }, []);

  /**
   * Get current note index (for external access)
   */
  const getCurrentNoteIndex = useCallback(
    () => currentNoteIndexRef.current,
    [],
  );

  /**
   * Get next note index (for external access)
   */
  const getNextNoteIndex = useCallback(() => nextNoteIndexRef.current, []);

  /**
   * SINGLE SOURCE OF TRUTH: Get current measure at 60fps
   *
   * This is THE authoritative source for current measure during playback.
   * Updated directly by AtomicPlaybackClock callback, bypassing React.
   * Use this instead of useFretboardExercise.currentMeasureFromNote
   * to avoid the ~20ms desync that causes animation flicker.
   *
   * @returns Current measure (0-based), or -1 during countdown/no notes
   */
  const getCurrentMeasure = useCallback(() => currentMeasureRef.current, []);

  // ============================================================================
  // DOM UPDATE FUNCTION
  // ============================================================================

  /**
   * Direct DOM update function - called by AtomicPlaybackClock on every beat change
   * This is the core of the jitter-free implementation
   *
   * @param state - Current beat state from AtomicPlaybackClock
   */
  const updateNoteHighlights = useCallback((state: AtomicBeatState) => {
    // Skip updates if not visible (optimization)
    if (!isVisibleRef.current) {
      return;
    }

    // Get current visual time in seconds
    const { visualSeconds, isCountdown } = state;

    // ============================================================================
    const currentTimeline = timelineRef.current;

    // During countdown OR before first note starts, show the FIRST note with yellow ring
    // This ensures consistency with other widgets (DrummerWidget, MetronomeWidget, LoopGridStrip)
    // which all show beat 0 highlighted during countdown
    // Note: currentTimeline is already declared above for logging
    const firstNoteEntry = currentTimeline.find(e => e.type === 'note');

    // Check if we're still before the first note starts
    // This handles both countdown AND the transition period after countdown ends
    // but before visualSeconds reaches the first note's startTime
    const isBeforeFirstNote = firstNoteEntry && visualSeconds < firstNoteEntry.startTime;

    if (isCountdown || isBeforeFirstNote) {
      // If there are notes, highlight the first one
      if (firstNoteEntry && firstNoteEntry.noteIndex !== undefined) {
        const firstNoteIndex = firstNoteEntry.noteIndex;

        // Only update if we're not already showing the first note
        if (previousNoteIndexRef.current !== firstNoteIndex) {
          // Clear previous note if any
          if (previousNoteIndexRef.current >= 0) {
            const prevElement = noteRefs.current.get(previousNoteIndexRef.current);
            if (prevElement) {
              clearDotAnimationState(prevElement);
            }
          }

          // Activate the first note with yellow ring
          const firstElement = noteRefs.current.get(firstNoteIndex);
          if (firstElement) {
            setDotActive(firstElement);
          }

          previousNoteIndexRef.current = firstNoteIndex;
          currentNoteIndexRef.current = firstNoteIndex;
          nextNoteIndexRef.current = firstNoteIndex + 1 < currentTimeline.length ? firstNoteIndex + 1 : -1;
        }
      }
      return;
    }

    // Find current and next notes using binary search
    const activeNoteIndex = findNoteAtTime(currentTimeline, visualSeconds);
    const nextIndex = findNextNoteAfterTime(currentTimeline, visualSeconds);

    // Update refs for external access
    currentNoteIndexRef.current = activeNoteIndex;
    nextNoteIndexRef.current = nextIndex;

    // Get current measure from the timeline entry (note OR rest) at current time
    // This is used to detect measure changes and clear played states
    //
    // FIX: Previously this only looked at notes, causing currentMeasure to be wrong
    // during REST periods. Now we use findEntryAtTime which returns the actual
    // entry (note or rest) containing the current time, so we always get the
    // correct measure even when in a rest.
    const currentEntry = findEntryAtTime(currentTimeline, visualSeconds);
    const currentMeasure = currentEntry?.measure ?? -1;

    // MEASURE CHANGE DETECTION: Clear all "played" states when measure changes
    // This ensures notes that were played in the previous measure don't stay dimmed
    // when we return to them in the next measure (for repeating patterns)
    //
    // FLICKER FIX: clearAllPlayedStates(currentMeasure) preserves lines from previous
    // measures. Lines connecting notes in measures 0 to (currentMeasure-1) stay hidden
    // because those notes have already been played. This prevents the brief flicker that
    // would occur if we cleared all lines then re-marked the last played note's line.
    let measureJustChanged = false; // Track for logging purposes

    if (currentMeasure >= 0 && currentMeasure !== previousMeasureRef.current) {
      measureJustChanged = true;

      // CONSOLIDATED FIX: Clear ALL played states on measure change
      // clearAllPlayedStates now handles ALL played-related classes:
      // - DOT_PLAYED, DOT_PLAYED_NEXT_MEASURE_GREEN, DOT_PLAYED_NEXT_MEASURE_ORANGE
      // - DOT_OTHER_MEASURE (grey styling added by setDotPlayed)
      // - LINE_PLAYED (only for lines in current and future measures)
      // This fully resets notes to their "never played" state, ready for fresh animation.
      // This is the SOLE owner of all measure change cleanup.
      //
      // FLICKER FIX: Pass currentMeasure to preserve lines from PREVIOUS measures.
      // Lines from measure 0 to (currentMeasure-1) stay hidden because they connect
      // already-played notes. Only lines from currentMeasure onwards get cleared.
      const { clearedDots, clearedLines } = clearAllPlayedStates(currentMeasure);

      // VALIDATION: Check that clearing actually worked
      // clearAllPlayedStates() should remove ALL measure-related and played-related classes
      const staleDotsAfterClear = document.querySelectorAll(
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_PLAYED}, ` +
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN}, ` +
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE}, ` +
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_CURRENT_MEASURE}, ` +
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_NEXT_MEASURE}, ` +
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_NEXT_MEASURE_FIRST}, ` +
        `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_OTHER_MEASURE}`
      );
      if (staleDotsAfterClear.length > 0) {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.error(
          `🚨 [CLEAR-FAILED] Measure ${previousMeasureRef.current}→${currentMeasure} | ` +
          `${staleDotsAfterClear.length} dots still have stale classes after clearAllPlayedStates!`
        );
      }

      // SINGLE SOURCE OF TRUTH: Update measure-based opacity classes
      // This replaces the React-based inline opacity calculation in FretboardGrid.
      // Now all opacity is controlled via CSS classes applied at 60fps.
      updateMeasureOpacityClasses(currentMeasure);

      previousMeasureRef.current = currentMeasure;

      // REACT RE-RENDER TRIGGER: Call onMeasureChange callback
      // This allows React components (like connection lines in FretboardGrid) to
      // re-render with the new measure value. Without this, lines would use stale
      // measure until React's next scheduled update (~20ms delay).
      if (onMeasureChangeRef.current) {
        onMeasureChangeRef.current(currentMeasure);
      }

      // FIX: updateMeasureOpacityClasses removes DOT_ACTIVE from all dots.
      // We need to re-apply the active state to the current note if it's still active.
      // This is especially important for the transition from countdown (-1) to measure 0,
      // where note 0 was already showing as active during countdown.
      if (previousNoteIndexRef.current >= 0) {
        const activeElement = noteRefs.current.get(previousNoteIndexRef.current);
        if (activeElement) {
          setDotActive(activeElement);
        }
      }
    }

    // SINGLE SOURCE OF TRUTH: Update currentMeasureRef at 60fps
    // This is THE authoritative source for current measure during playback.
    // FretboardGrid and other consumers should use getCurrentMeasure()
    // instead of React state to avoid ~20ms desync flicker.
    currentMeasureRef.current = currentMeasure;

    // Only update DOM if note changed (optimization)
    if (activeNoteIndex === previousNoteIndexRef.current) {
      // DIAGNOSTIC: Log if measure just changed but note didn't
      if (measureJustChanged) {
        // eslint-disable-next-line no-console
        console.log(
          `[MEASURE-NO-NOTE-CHANGE] m${currentMeasure} | activeNote=${activeNoteIndex} = prevNote | t=${visualSeconds.toFixed(3)}s`
        );
      }
      return;
    }

    // TIMING ACCURACY DIAGNOSTIC: Compare expected vs actual activation time
    // For notes 3-8, log when they become active vs when they SHOULD become active
    if (activeNoteIndex >= 3 && activeNoteIndex <= 8) {
      const newEntry = currentTimeline.find(
        (e) => e.type === 'note' && e.noteIndex === activeNoteIndex
      );
      if (newEntry) {
        const expectedStartTime = newEntry.startTime;
        const actualTime = visualSeconds;
        const delayMs = (actualTime - expectedStartTime) * 1000;
        // eslint-disable-next-line no-console
        console.log(
          `⏱️ [TIMING-ACCURACY] note#${activeNoteIndex} | ` +
          `expected=${expectedStartTime.toFixed(3)}s | ` +
          `actual=${actualTime.toFixed(3)}s | ` +
          `delay=${delayMs.toFixed(1)}ms | ` +
          `measure=${newEntry.measure}`
        );
      }
    }

    // Note transition logging - only when debug is enabled (too noisy otherwise)
    if (isDebugEnabled()) {
      const findTimelineEntry = (noteIdx: number): NoteTimelineEntry | null => {
        if (noteIdx < 0) return null;
        return currentTimeline.find(e => e.type === 'note' && e.noteIndex === noteIdx) ?? null;
      };

      const prevEntry = findTimelineEntry(previousNoteIndexRef.current);
      const newEntry = findTimelineEntry(activeNoteIndex);

      if (prevEntry && newEntry) {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `🎯 note#${previousNoteIndexRef.current}→#${activeNoteIndex} | ` +
          `${prevEntry.note?.string}:${prevEntry.note?.fret}→${newEntry.note?.string}:${newEntry.note?.fret} | ` +
          `t=${visualSeconds.toFixed(3)}s`
        );
      } else if (newEntry && !prevEntry) {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `🎯 START→note#${activeNoteIndex} str${newEntry.note?.string}:fret${newEntry.note?.fret} t=${visualSeconds.toFixed(3)}s`
        );
      } else if (prevEntry && !newEntry) {
        // eslint-disable-next-line no-console, no-restricted-syntax
        console.log(
          `🎯 note#${previousNoteIndexRef.current}→REST t=${visualSeconds.toFixed(3)}s`
        );
      }
    }

    // Remove active class from previous note and hide its outgoing connection lines
    if (previousNoteIndexRef.current >= 0) {
      const prevElement = noteRefs.current.get(previousNoteIndexRef.current);
      if (prevElement) {
        prevElement.classList.remove(CSS_CLASSES.DOT_ACTIVE);

        // FIX: Only add .note-played if this position does NOT exist in the next measure.
        // If the same position is used in the next measure, it should show as a 30% preview
        // (handled by React), not as grey played state.
        const prevNoteIndex = previousNoteIndexRef.current;

        // IMPORTANT: Get the measure from the PREVIOUS note, not the current active note.
        // When a note transitions from active to played, we need to check if the same
        // position exists in the NEXT measure relative to that note's measure.
        const prevNoteEntry = currentTimeline.find(
          (e) => e.type === 'note' && e.noteIndex === prevNoteIndex
        );
        const prevNoteMeasure = prevNoteEntry?.measure ?? -1;
        const shouldShowAsPlayed = prevNoteMeasure >= 0
          ? !positionExistsInNextMeasure(prevNoteIndex, prevNoteMeasure)
          : true; // Default to showing as played if we can't find the note

        if (shouldShowAsPlayed) {
          // Add played class for visual feedback (turns grey)
          // Use centralized helper function
          setDotPlayed(prevElement);
        } else {
          // Position exists in next measure - show at 30% opacity as preview
          // Use the NEXT measure's color (green for odd 0-based, orange for even 0-based)
          const nextMeasure = prevNoteMeasure + 1;
          // Use centralized helper function
          setDotPlayedNextMeasure(prevElement, nextMeasure);
        }

        // DOT-TO-DOT LINE DISMISSAL: Hide ALL connection lines whose source is this specific note
        // Use data-source-note-index to target exact lines, not all lines from same position
        // FIX: Use querySelectorAll instead of querySelector to hide ALL lines from this note
        // (a note can have multiple outgoing connections in theory)
        //
        // Find and hide ALL lines that start from this specific note
        const lineSelector = `.connection-line[data-source-note-index="${prevNoteIndex}"]`;
        const linesFromThisNote = document.querySelectorAll(lineSelector);

        // ALWAYS mark lines as played when their source note becomes played
        // Note: clearAllPlayedStates() runs BEFORE this code during measure changes,
        // removing .line-played from all lines. So we MUST re-add it here to keep
        // the line hidden. The original "flicker fix" was wrong - it skipped marking
        // which left lines visible after clearAllPlayedStates() removed their class.

        // Log query attempt
        logLineStateChange('QUERY', {
          noteIndex: prevNoteIndex,
          lineSelector,
          lineFound: linesFromThisNote.length > 0,
          linesAffected: linesFromThisNote.length,
          measure: currentMeasure,
          time: visualSeconds,
          reason: 'Looking for lines from played note',
        });

        // Hide ALL lines from this note using centralized helper
        linesFromThisNote.forEach((lineFromThisNote) => {
          markLineAsPlayed(lineFromThisNote as HTMLElement);

          // Get line details for debugging
          const sourceMeasure = lineFromThisNote.getAttribute('data-source-measure');
          const targetMeasure = lineFromThisNote.getAttribute('data-target-measure');
          const lineDetails = `line: m${sourceMeasure}→m${targetMeasure}`;

          logLineStateChange('HIDE', {
            noteIndex: prevNoteIndex,
            lineSelector,
            lineFound: true,
            measure: currentMeasure,
            time: visualSeconds,
            reason: 'Note became PLAYED, hiding outgoing line',
            lineDetails,
          });

          if (isDebugEnabled()) {
            // eslint-disable-next-line no-console, no-restricted-syntax
            console.log(
              `🔗 [NOTE-SYNC] Line hidden: noteIndex=${prevNoteIndex} | t=${visualSeconds.toFixed(3)}s`
            );
          }
        });
      }
    }

    // Add active class to current note using centralized helper
    if (activeNoteIndex >= 0) {
      const activeElement = noteRefs.current.get(activeNoteIndex);
      if (activeElement) {
        // Use centralized helper - clears all states and adds active
        setDotActive(activeElement);

        // DEBUG: Log when active class is added
        if (isDebugEnabled()) {
          const activeEntry = currentTimeline.find(
            (e) => e.type === 'note' && e.noteIndex === activeNoteIndex
          );
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.log(
            `🎯 [NOTE-SYNC] ACTIVE: noteIndex=${activeNoteIndex} | ` +
            `measure=${activeEntry?.measure} | ` +
            `pos=${activeEntry?.position.stringIndex}:${activeEntry?.position.fret} | ` +
            `classes=${activeElement.className}`
          );
        }
      } else {
        // DEBUG: Element not found
        if (isDebugEnabled()) {
          // eslint-disable-next-line no-console, no-restricted-syntax
          console.warn(
            `⚠️ [NOTE-SYNC] NO ELEMENT for activeNoteIndex=${activeNoteIndex}`
          );
        }
      }
    }

    // Update preview for next note (if different from active)
    // First, clear any existing preview that's not the new next
    noteRefs.current.forEach((element, index) => {
      if (index !== nextIndex && index !== activeNoteIndex) {
        clearDotPreview(element);
      }
    });

    // Add preview to next note (if exists and not currently active)
    if (nextIndex >= 0 && nextIndex !== activeNoteIndex) {
      const nextElement = noteRefs.current.get(nextIndex);
      if (nextElement) {
        setDotPreview(nextElement);
      }
    }

    // Update previous index tracker
    previousNoteIndexRef.current = activeNoteIndex;
  }, []);

  // ============================================================================
  // RESET FUNCTION
  // ============================================================================

  /**
   * Reset all note highlights to default state
   * Called when playback stops or exercise changes
   */
  const resetNoteHighlights = useCallback(() => {
    // Remove all state classes from all registered elements using centralized helper
    noteRefs.current.forEach((element) => {
      clearDotAnimationState(element);
      // Also remove measure-based opacity classes (including first note and other measure classes)
      element.classList.remove(
        CSS_CLASSES.DOT_CURRENT_MEASURE,
        CSS_CLASSES.DOT_NEXT_MEASURE,
        CSS_CLASSES.DOT_NEXT_MEASURE_FIRST,
        CSS_CLASSES.DOT_OTHER_MEASURE
      );
      // Reset CSS variable to default (fully visible)
      element.style.setProperty('--measure-opacity', '1');
    });

    // DOT-TO-DOT LINE DISMISSAL: Also reset all connection line played states
    // Use centralized helper for consistency
    const lineSelector = `.${CSS_CLASSES.CONNECTION_LINE}.${CSS_CLASSES.LINE_PLAYED}`;
    const allPlayedLines = document.querySelectorAll(lineSelector);

    logLineStateChange('RESTORE', {
      lineSelector,
      lineFound: allPlayedLines.length > 0,
      linesAffected: allPlayedLines.length,
      reason: 'RESET: Playback stopped, restoring all lines',
    });

    // Use centralized clearAllPlayedStates which handles both dots and lines
    clearAllPlayedStates();

    // Reset tracking refs
    currentNoteIndexRef.current = -1;
    nextNoteIndexRef.current = -1;
    previousNoteIndexRef.current = -1;
    previousMeasureRef.current = -1;
    currentMeasureRef.current = -1;

    if (isDebugEnabled()) {
      // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_FRETBOARD_SYNC
      console.log('[FRETBOARD_SYNC] Highlights reset (including measure classes)');
    }
  }, []);

  // ============================================================================
  // CLOCK SUBSCRIPTION
  // ============================================================================

  /**
   * Subscribe to AtomicPlaybackClock for timing updates
   * Only active when isPlaying is true
   */
  useEffect(() => {
    const clock = getAtomicPlaybackClock();

    // Only subscribe when playing
    if (!isPlaying) {
      resetNoteHighlights();
      return;
    }

    if (isDebugEnabled()) {
      // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_FRETBOARD_SYNC
      console.log('[FRETBOARD_SYNC] Subscribing to AtomicPlaybackClock');
    }

    // Subscribe to clock updates
    const unsubscribe = clock.subscribe(updateNoteHighlights);

    // If clock already has state, apply it immediately
    const currentState = clock.getCurrentState();
    if (currentState) {
      updateNoteHighlights(currentState);
    }

    // Cleanup on unmount or when playback stops
    return () => {
      unsubscribe();
      resetNoteHighlights();

      if (isDebugEnabled()) {
        // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_FRETBOARD_SYNC
        console.log('[FRETBOARD_SYNC] Unsubscribed from AtomicPlaybackClock');
      }
    };
  }, [isPlaying, updateNoteHighlights, resetNoteHighlights]);

  // ============================================================================
  // EXERCISE CHANGE CLEANUP
  // ============================================================================

  /**
   * Clear refs when exercise changes to prevent stale DOM references
   */
  useEffect(() => {
    // When exercise notes change, reset everything
    resetNoteHighlights();

    if (isDebugEnabled()) {
      // eslint-disable-next-line no-console, no-restricted-syntax -- Intentional debug logging controlled by window.__DEBUG_FRETBOARD_SYNC
      console.log('[FRETBOARD_SYNC] Exercise changed, refs cleared');
    }

    // Note: We don't clear noteRefs.current here because FretboardGrid
    // will re-register all refs as it re-renders with new notes
  }, [exerciseNotes, resetNoteHighlights]);

  // ============================================================================
  // INITIAL MEASURE OPACITY - Applied on page load (before playback)
  // ============================================================================

  /**
   * Apply initial measure opacity classes when notes are first registered.
   *
   * This fixes the bug where on page refresh, all preview measure notes show
   * at 100% opacity instead of just the first one at 100% and others at 30%.
   *
   * The effect uses a small delay to wait for FretboardGrid to register note refs,
   * then applies the correct measure-based opacity classes for the initial state
   * (before playback starts, measure 0 is current).
   */
  useEffect(() => {
    // Skip if no timeline or already playing (playback will handle it)
    if (timeline.length === 0 || isPlaying) {
      return;
    }

    // Wait a frame for FretboardGrid to register note refs
    // This ensures all note elements are available in noteRefs.current
    const timeoutId = setTimeout(() => {
      // Check if any notes have been registered
      if (noteRefs.current.size === 0) {
        return;
      }

      // Initial state: measure 0 is "current" (will be played first)
      const initialMeasure = 0;

      // Compact initial log
      // eslint-disable-next-line no-console, no-restricted-syntax
      console.log(`🎯 [INIT] Applying measure opacity | notes=${noteRefs.current.size}`);

      // Apply measure-based opacity classes for initial render
      updateMeasureOpacityClasses(initialMeasure);
    }, 50); // 50ms delay to ensure refs are registered

    return () => clearTimeout(timeoutId);
  }, [timeline, isPlaying, updateMeasureOpacityClasses]);

  // ============================================================================
  // RETURN VALUE
  // ============================================================================

  return {
    registerNoteRef,
    getNoteClassName,
    timeline,
    getCurrentNoteIndex,
    getNextNoteIndex,
    getCurrentMeasure,
  };
}

// ============================================================================
// CONVENIENCE HOOKS
// ============================================================================

/**
 * Get a position key string for a timeline entry
 * Useful for debugging and DOM element identification
 */
export function getPositionKey(entry: NoteTimelineEntry): string {
  return `${entry.position.stringIndex},${entry.position.fret}`;
}

/**
 * Check if two timeline entries are at the same fretboard position
 */
export function isSamePosition(
  a: NoteTimelineEntry,
  b: NoteTimelineEntry,
): boolean {
  return (
    a.position.stringIndex === b.position.stringIndex &&
    a.position.fret === b.position.fret
  );
}
