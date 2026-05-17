/**
 * useFretboardNoteSync Debug Utilities
 *
 * This module contains debug utilities for the fretboard note synchronization system.
 * Enable debugging in the browser console using the window flags documented below.
 *
 * ## Available Debug Flags
 *
 * - `window.__DEBUG_FRETBOARD_SYNC = true` - General sync debugging
 * - `window.__ULTRA_DEBUG__ = true` - Ultra verbose logging (every DOM mutation)
 * - `window.__DEBUG_LINE_LIFECYCLE__ = true` - Connection line state tracking
 *
 * ## Available Debug Functions
 *
 * - `window.__START_MUTATION_WATCH__()` - Start watching dot mutations
 * - `window.__STOP_MUTATION_WATCH__()` - Stop watching dot mutations
 * - `window.__INSPECT_DOTS__()` - Snapshot of all dot states
 * - `window.__INSPECT_DOTS__(true)` - Continuous monitoring (every 500ms)
 * - `window.__INSPECT_DOTS__(false)` - Stop continuous monitoring
 * - `window.__WATCH_DOT__('2,5')` - Watch a specific position continuously
 * - `window.__WATCH_DOT__(null)` - Stop watching specific position
 */

import { CSS_CLASSES } from '../components/YouTubeWidgetPage/FretboardCard/utils/fretboardAnimation.js';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Window type extensions for debug flags
 */
interface DebugWindow extends Window {
  __DEBUG_FRETBOARD_SYNC?: boolean;
  __ULTRA_DEBUG__?: boolean;
  __DEBUG_LINE_LIFECYCLE__?: boolean;
  __START_MUTATION_WATCH__?: () => void;
  __STOP_MUTATION_WATCH__?: () => void;
  __INSPECT_DOTS__?: (continuous?: boolean) => DotInspectorSummary;
  __WATCH_DOT__?: (positionKey: string | null) => void;
}

/**
 * Summary returned by the dot inspector
 */
interface DotInspectorSummary {
  total: number;
  current: number;
  nextFirst: number;
  next: number;
  other: number;
  active: number;
  played: number;
  noMeasureClass: number;
  issues: string[];
}

/**
 * Individual dot state for inspection
 */
interface DotState {
  position: string;
  classes: string;
  measureOpacity: string;
  computedOpacity: string;
  bgColor: string;
  issue?: string;
}

/**
 * Context for line state change logging
 */
export interface LineStateChangeContext {
  noteIndex?: number;
  lineSelector?: string;
  lineFound?: boolean;
  measure?: number;
  time?: number;
  reason?: string;
  linesAffected?: number;
  lineDetails?: string;
}

// =============================================================================
// DEBUG FLAG CHECKERS
// =============================================================================

/**
 * Debug flag - enable in browser console: window.__DEBUG_FRETBOARD_SYNC = true
 */
export function isDebugEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as DebugWindow).__DEBUG_FRETBOARD_SYNC
  );
}

/**
 * ULTRA DEBUG: Enable this to log EVERY single DOM mutation and computed style
 * Enable in browser console: window.__ULTRA_DEBUG__ = true
 */
export function isUltraDebugEnabled(): boolean {
  return (
    typeof window !== 'undefined' && !!(window as DebugWindow).__ULTRA_DEBUG__
  );
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
export function isLineLifecycleDebugEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!(window as DebugWindow).__DEBUG_LINE_LIFECYCLE__
  );
}

// =============================================================================
// LINE STATE CHANGE LOGGER
// =============================================================================

/**
 * Log line state changes for debugging
 */
export function logLineStateChange(
  action: 'HIDE' | 'RESTORE' | 'QUERY',
  context: LineStateChangeContext,
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
      `affected=${context.linesAffected ?? 1} ${context.lineDetails || ''}`,
  );
}

// =============================================================================
// WINDOW DEBUG UTILITIES SETUP
// =============================================================================

/**
 * Set up all window-level debug utilities
 * This function is called on module load (side effect)
 */
function setupWindowDebugUtilities(): void {
  if (typeof window === 'undefined') return;

  const debugWindow = window as DebugWindow;

  // -------------------------------------------------------------------------
  // MUTATION OBSERVER: Track any external changes to fretboard dots
  // -------------------------------------------------------------------------

  let mutationObserver: MutationObserver | null = null;

  debugWindow.__START_MUTATION_WATCH__ = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
    }

    mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'class'
        ) {
          const el = mutation.target as HTMLElement;
          if (el.classList.contains(CSS_CLASSES.FRETBOARD_DOT)) {
            // eslint-disable-next-line no-console
            console.log(
              `🔬 [MUTATION] Dot class changed externally!\n` +
                `   Old: ${mutation.oldValue}\n` +
                `   New: ${el.className}\n` +
                `   Title: ${el.title || 'N/A'}`,
            );
          }
        }
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'style'
        ) {
          const el = mutation.target as HTMLElement;
          if (el.classList.contains(CSS_CLASSES.FRETBOARD_DOT)) {
            // eslint-disable-next-line no-console
            console.log(
              `🔬 [MUTATION] Dot style changed!\n` +
                `   Style: ${el.getAttribute('style')}\n` +
                `   Computed opacity: ${window.getComputedStyle(el).opacity}\n` +
                `   Title: ${el.title || 'N/A'}`,
            );
          }
        }
      });
    });

    const dotSelector = `.${CSS_CLASSES.FRETBOARD_DOT}:not(.fretboard-2d-hidden .${CSS_CLASSES.FRETBOARD_DOT})`;
    const dots = document.querySelectorAll(dotSelector);

    dots.forEach((dot) => {
      mutationObserver!.observe(dot, {
        attributes: true,
        attributeOldValue: true,
        attributeFilter: ['class', 'style'],
      });
    });

    // eslint-disable-next-line no-console
    console.log(
      `🔬 [MUTATION WATCH] Started watching ${dots.length} dots for external changes`,
    );
  };

  debugWindow.__STOP_MUTATION_WATCH__ = () => {
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
      // eslint-disable-next-line no-console
      console.log('🔬 [MUTATION WATCH] Stopped');
    }
  };

  // eslint-disable-next-line no-console
  console.log(
    '🔬 Mutation watch available: __START_MUTATION_WATCH__() and __STOP_MUTATION_WATCH__()',
  );

  // -------------------------------------------------------------------------
  // VISUAL DOM INSPECTOR
  // -------------------------------------------------------------------------

  let inspectorInterval: ReturnType<typeof setInterval> | null = null;
  let watchInterval: ReturnType<typeof setInterval> | null = null;

  debugWindow.__INSPECT_DOTS__ = (
    continuous?: boolean,
  ): DotInspectorSummary => {
    // Stop existing interval if any
    if (inspectorInterval) {
      clearInterval(inspectorInterval);
      inspectorInterval = null;
    }

    const inspect = (): DotInspectorSummary => {
      const dotSelector = `.${CSS_CLASSES.FRETBOARD_DOT}:not(.fretboard-2d-hidden .${CSS_CLASSES.FRETBOARD_DOT})`;
      const dots = document.querySelectorAll(dotSelector);
      const summary: DotInspectorSummary = {
        total: dots.length,
        current: 0,
        nextFirst: 0,
        next: 0,
        other: 0,
        active: 0,
        played: 0,
        noMeasureClass: 0,
        issues: [],
      };

      const dotStates: DotState[] = [];

      dots.forEach((dot) => {
        const classes = dot.className;
        const style = window.getComputedStyle(dot);
        const measureOpacity =
          (dot as HTMLElement).style.getPropertyValue('--measure-opacity') ||
          'not-set';
        const computedOpacity = style.opacity;
        const bgColor = style.backgroundColor;

        // Extract position from data attributes or infer from classes
        const position =
          (dot as HTMLElement).title?.match(/Fret (\d+).*String/)?.[1] ||
          'unknown';

        // Count states
        if (classes.includes(CSS_CLASSES.DOT_CURRENT_MEASURE))
          summary.current++;
        else if (classes.includes(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST))
          summary.nextFirst++;
        else if (classes.includes(CSS_CLASSES.DOT_NEXT_MEASURE)) summary.next++;
        else if (classes.includes(CSS_CLASSES.DOT_OTHER_MEASURE))
          summary.other++;
        else if (classes.includes('note-')) summary.noMeasureClass++; // Has note- class but no measure class

        if (classes.includes(CSS_CLASSES.DOT_ACTIVE)) summary.active++;
        if (classes.includes(CSS_CLASSES.DOT_PLAYED)) summary.played++;

        // Detect issues
        let issue: string | undefined;

        // Issue 1: Has note-next-measure but opacity is not ~0.3
        if (
          classes.includes(CSS_CLASSES.DOT_NEXT_MEASURE) &&
          !classes.includes(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST)
        ) {
          const opacityNum = parseFloat(computedOpacity);
          if (opacityNum > 0.5) {
            issue = `OPACITY BUG: next-measure dot has ${computedOpacity} opacity (should be ~0.3)`;
            summary.issues.push(`${position}: ${issue}`);
          }
        }

        // Issue 2: Has measure class but --measure-opacity not set
        if (
          classes.includes(CSS_CLASSES.DOT_CURRENT_MEASURE) ||
          classes.includes(CSS_CLASSES.DOT_NEXT_MEASURE)
        ) {
          if (measureOpacity === 'not-set') {
            issue = `CSS VAR MISSING: has measure class but --measure-opacity not set`;
            summary.issues.push(`${position}: ${issue}`);
          }
        }

        // Issue 3: Conflicting classes
        // FIX: Use word boundary regex to avoid substring matching
        // (e.g., 'note-next-measure-first'.includes('note-next-measure') is true but wrong)
        const measureClasses = [
          CSS_CLASSES.DOT_CURRENT_MEASURE,
          CSS_CLASSES.DOT_NEXT_MEASURE,
          CSS_CLASSES.DOT_NEXT_MEASURE_FIRST,
          CSS_CLASSES.DOT_OTHER_MEASURE,
        ];
        const classesArray = classes.split(' ');
        const activeMeasureClasses = measureClasses.filter((c) =>
          classesArray.includes(c),
        );
        if (activeMeasureClasses.length > 1) {
          issue = `CONFLICTING CLASSES: ${activeMeasureClasses.join(', ')}`;
          summary.issues.push(`${position}: ${issue}`);
        }

        dotStates.push({
          position,
          classes: classes
            .split(' ')
            .filter((c) => c.startsWith('note-'))
            .join(' '),
          measureOpacity,
          computedOpacity,
          bgColor: bgColor.includes('rgb') ? bgColor : 'unknown',
          issue,
        });
      });

      // eslint-disable-next-line no-console
      console.log(
        '%c📊 DOT STATE SNAPSHOT',
        'font-size: 14px; font-weight: bold; color: #4CAF50',
      );
      // eslint-disable-next-line no-console
      console.log(
        `   Total: ${summary.total} | Current: ${summary.current} | NextFirst: ${summary.nextFirst} | Next: ${summary.next} | Other: ${summary.other}`,
      );
      // eslint-disable-next-line no-console
      console.log(
        `   Active: ${summary.active} | Played: ${summary.played} | No measure class: ${summary.noMeasureClass}`,
      );

      if (summary.issues.length > 0) {
        // eslint-disable-next-line no-console
        console.log('%c🚨 ISSUES DETECTED:', 'color: red; font-weight: bold');
        summary.issues.forEach((issue) => {
          // eslint-disable-next-line no-console
          console.log(`   ${issue}`);
        });
      }

      // eslint-disable-next-line no-console
      console.table(dotStates.filter((d) => d.classes.length > 0));

      return summary;
    };

    if (continuous === true) {
      // eslint-disable-next-line no-console
      console.log(
        '🔄 Starting continuous dot inspection (every 500ms). Call __INSPECT_DOTS__(false) to stop.',
      );
      inspectorInterval = setInterval(inspect, 500);
    } else if (continuous === false) {
      // eslint-disable-next-line no-console
      console.log('⏹️ Stopped continuous dot inspection.');
    }

    return inspect();
  };

  debugWindow.__WATCH_DOT__ = (positionKey: string | null) => {
    // Stop existing watch
    if (watchInterval) {
      clearInterval(watchInterval);
      watchInterval = null;
    }

    if (positionKey === null) {
      // eslint-disable-next-line no-console
      console.log('⏹️ Stopped watching dot.');
      return;
    }

    // eslint-disable-next-line no-console
    console.log(
      `👁️ Watching dot at position "${positionKey}" - logs will appear when state changes`,
    );

    let lastState = '';

    watchInterval = setInterval(() => {
      const dotSelector = `.${CSS_CLASSES.FRETBOARD_DOT}:not(.fretboard-2d-hidden .${CSS_CLASSES.FRETBOARD_DOT})`;
      const dots = document.querySelectorAll(dotSelector);
      let foundDot: Element | null = null;

      dots.forEach((dot) => {
        const title = (dot as HTMLElement).title || '';
        if (
          title.includes(`Fret ${positionKey.split(',')[1]}`) ||
          (dot as HTMLElement).dataset.position === positionKey
        ) {
          foundDot = dot;
        }
      });

      if (!foundDot) return;

      const classes = (foundDot as HTMLElement).className
        .split(' ')
        .filter((c: string) => c.startsWith('note-'))
        .sort()
        .join(' ');
      const measureOpacity =
        (foundDot as HTMLElement).style.getPropertyValue('--measure-opacity') ||
        'not-set';
      const computedOpacity = window.getComputedStyle(foundDot).opacity;

      const currentState = `${classes}|${measureOpacity}|${computedOpacity}`;

      if (currentState !== lastState) {
        lastState = currentState;
        // eslint-disable-next-line no-console
        console.log(
          `👁️ [${positionKey}] CHANGED: classes=[${classes}] --measure-opacity=${measureOpacity} computed=${computedOpacity}`,
        );
      }
    }, 100);
  };

  // eslint-disable-next-line no-console
  console.log(
    '🔧 Visual inspectors loaded: __INSPECT_DOTS__() and __WATCH_DOT__(position)',
  );
}

// =============================================================================
// MODULE INITIALIZATION
// =============================================================================

// Set up debug utilities on module load (side effect)
setupWindowDebugUtilities();
