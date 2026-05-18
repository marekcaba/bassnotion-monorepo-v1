/**
 * FretboardAnimation - Single source of truth for ALL fretboard animation logic
 *
 * =============================================================================
 * ARCHITECTURE: SINGLE SYSTEM FOR OPACITY (useFretboardNoteSync)
 * =============================================================================
 *
 * ALL opacity is now controlled by ONE system: useFretboardNoteSync
 * This eliminates the timing mismatch between React state (~20ms) and
 * direct DOM updates (60fps) that was causing opacity flicker.
 *
 * useFretboardNoteSync applies CSS classes at 60fps:
 * - .note-current-measure: 100% opacity (current measure notes)
 * - .note-next-measure-first: 100% opacity (FIRST note of next measure - transition target)
 * - .note-next-measure: 30% opacity (other notes in next measure preview)
 * - .note-active: currently playing (yellow ring, 100%)
 * - .note-played + .note-other-measure: already played → GREY (visible, same as non-exercise dots)
 * - .note-played-next-measure-*: played but exists in next (30% colored)
 *
 * React's job is now ONLY:
 * - Render dots with background color (green/orange based on measure)
 * - Apply edge fade opacity (scroll position)
 * - Register dot refs for useFretboardNoteSync to target
 *
 * =============================================================================
 * SINGLE-LAYER ARCHITECTURE - DOT VISIBILITY
 * =============================================================================
 *
 * All dots are in ONE layer. Notes from "other" measures are shown as GREY (visible).
 * Current/next measure notes are HIGHLIGHTED (green/orange).
 * This creates the visual effect of a static fretboard with exercise notes highlighted.
 *
 * | Condition                         | Opacity | Color        | CSS Class                    |
 * |-----------------------------------|---------|--------------|------------------------------|
 * | In current measure (not active)   | 100%    | Green/Orange | .note-current-measure        |
 * | FIRST note of next measure        | 100%    | Green/Orange | .note-next-measure-first     |
 * | Other notes in next measure       | 30%     | Green/Orange | .note-next-measure           |
 * | In other measure (grey)           | 100%    | Grey         | .note-other-measure          |
 * | Active note (currently playing)   | 100%    | Yellow ring  | .note-active                 |
 * | Played note (grey)                | 100%    | Grey         | .note-other-measure + .note-played |
 * | Played but exists in next measure | 30%     | Green/Orange | .note-played-next-measure-*  |
 *
 * KEY INSIGHT: When a note is played, setDotPlayed() switches it to
 * .note-other-measure, making it GREY (like non-exercise dots).
 *
 * =============================================================================
 * MULTI-NOTE POSITION HANDLING
 * =============================================================================
 *
 * The same fretboard position can appear in multiple measures. Since each position
 * has ONE DOM element but multiple note indices, we use BEST STATE WINS logic:
 *
 * Priority: current (100%) > next-first (100%) > next (30%) > other (100% grey)
 *
 * Example: Position (string 2, fret 5) appears in measures 0, 1, and 2
 * - At measure 0: note#0 is "current" → element shows at 100%
 * - At measure 1: note#0 is "other", note#4 is "current" → element shows at 100%
 * - At measure 2: note#0,#4 are "other", note#8 is "current" → element shows at 100%
 *
 * =============================================================================
 * MEASURE TRANSITION RULES
 * =============================================================================
 *
 * When measure changes (e.g., measure 0 → measure 1):
 * 1. useFretboardNoteSync detects measure change at 60fps
 * 2. Calls clearAllPlayedStates() to reset .note-played classes
 * 3. Calls updateMeasureOpacityClasses() to update .note-current-measure/.note-next-measure
 *
 * This is all handled in ONE place (useFretboardNoteSync), eliminating
 * the race condition that occurred when React and DOM updates competed.
 *
 * =============================================================================
 * LINE OPACITY RULES (SOURCE-PRIORITY VISIBILITY)
 * =============================================================================
 *
 * Lines are directional (source → target). Visibility rules:
 * - Show if TARGET is within the 2-measure window [current, next]
 * - OPACITY PRIORITY: If SOURCE is in current measure → 100% (transition lines)
 * - This ensures transition lines FROM current INTO next are fully visible
 * - Lines whose target is outside the window are hidden
 *
 * | Source (m1)  | Target (m2) | Opacity | Reason                              |
 * |--------------|-------------|---------|-------------------------------------|
 * | current      | current     | 100%    | Internal line in current measure    |
 * | current      | next        | 100%    | Transition line INTO preview        |
 * | next         | next        | 30%     | Internal line in preview measure    |
 * | past         | current     | 100%    | Line entering current from past     |
 * | past         | next        | 30%     | Line entering preview from past     |
 * | any          | outside     | 0%      | Target outside window (hidden)      |
 * | Source played|             | 0%      | CSS .line-played hides it           |
 *
 * =============================================================================
 * DEBUGGING TIPS
 * =============================================================================
 *
 * Enable debugging flags in browser console:
 *   window.__DEBUG_FRETBOARD_SYNC = true     - useFretboardNoteSync logs
 *   window.__DEBUG_ALL_DOTS__ = true         - All dot render states
 *   window.__DEBUG_LINE_LIFECYCLE__ = true   - Connection line state changes
 *
 * Common issues:
 * 1. "First measure dot shows 30% instead of 100%"
 *    - Check: Is updateMeasureOpacityClasses() being called on playback start?
 *    - Check: Are notes being registered via registerNoteRef()?
 *
 * 2. "Dot flickers between green and grey"
 *    - Check: Are CSS transitions disabled? (should be 'none' in fretboard-notes.css)
 *    - Check: Is there only ONE system controlling opacity (useFretboardNoteSync)?
 *
 * 3. "Played note doesn't turn grey"
 *    - Check: Is setDotPlayed() being called in useFretboardNoteSync?
 *    - Check: Does .note-other-measure CSS have grey background-color?
 *
 * =============================================================================
 *
 * This module handles:
 * - Dot visibility (which dots to show based on current measure)
 * - Dot opacity (100% current, 30% next, 0% others) - via CSS classes
 * - Line visibility (which lines to show based on current measure)
 * - Line opacity (100% if source OR target in current, 30% if both exclusively in next)
 * - Highlight states (active, played, preview)
 *
 * Design principles:
 * - Pure functions, no React dependencies
 * - Simple rules, easy to understand
 * - All animation decisions in one place
 * - CSS classes are the SINGLE SOURCE OF TRUTH for opacity
 */

// =============================================================================
// TYPES
// =============================================================================

export interface Position {
  stringIndex: number;
  fret: number | 'open';
}

export interface DotAnimationState {
  shouldShow: boolean;
  opacity: number;
  isActive: boolean;
  isPlayed: boolean;
  isPreview: boolean;
  isHighlighted?: boolean; // true if dot should be colored (green/orange), false if hidden
}

export interface LineAnimationState {
  shouldShow: boolean;
  opacity: number;
}

export interface AnimationContext {
  currentMeasure: number;
  activeNoteIndex: number;
  playedNoteIndices: Set<number>;
  previewNoteIndex: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

// SINGLE-LAYER ARCHITECTURE:
// All dots are in one layer. Notes from "other" measures are shown as GREY (not hidden).
// Current/next measure notes are HIGHLIGHTED (green/orange).
// This creates the visual effect of a static fretboard with exercise notes highlighted.
export const OPACITY = {
  CURRENT_MEASURE: 1, // Highlighted green/orange - fully visible
  NEXT_MEASURE: 0.3, // Preview highlight at 30%
  OTHER_MEASURE: 1, // GREY (visible) - same as non-exercise dots
} as const;

export const CSS_CLASSES = {
  // Dot states - these are toggled directly on DOM elements for jitter-free updates
  DOT_ACTIVE: 'note-active',
  DOT_PLAYED: 'note-played',
  DOT_PREVIEW: 'note-preview',
  // Special states for notes that exist in next measure (show at 30% opacity)
  DOT_PLAYED_NEXT_MEASURE_GREEN: 'note-played-next-measure-green',
  DOT_PLAYED_NEXT_MEASURE_ORANGE: 'note-played-next-measure-orange',

  // Measure-based opacity classes (SINGLE SOURCE OF TRUTH for opacity)
  // Applied by useFretboardNoteSync at 60fps to control measure-based visibility
  // SINGLE-LAYER: All dots visible, current/next highlighted, others grey
  DOT_CURRENT_MEASURE: 'note-current-measure', // 100% opacity, highlighted (green/orange)
  DOT_NEXT_MEASURE: 'note-next-measure', // 30% opacity, highlighted (preview)
  DOT_NEXT_MEASURE_FIRST: 'note-next-measure-first', // 100% opacity, highlighted (transition target)
  DOT_OTHER_MEASURE: 'note-other-measure', // 100% opacity, GREY (visible as non-exercise dots)

  // Line states
  LINE_PLAYED: 'line-played',

  // Container classes for DOM queries
  CONNECTION_LINE: 'connection-line',
  FRETBOARD_DOT: 'fretboard-dot',
} as const;

/**
 * All dot CSS classes that represent ANIMATION states (active, played, preview)
 * Used for clearing animation state WITHOUT affecting measure-based opacity.
 *
 * IMPORTANT: This does NOT include measure opacity classes!
 * Measure classes (DOT_CURRENT_MEASURE, DOT_NEXT_MEASURE, etc.) are managed
 * ONLY by updateMeasureOpacityClasses() in useFretboardNoteSync.
 *
 * BUG FIX: Previously this array included measure classes, causing setDotPlayed/setDotActive
 * to strip .note-next-measure from preview notes, breaking the 30% opacity.
 */
export const ALL_DOT_STATE_CLASSES = [
  CSS_CLASSES.DOT_ACTIVE,
  CSS_CLASSES.DOT_PLAYED,
  CSS_CLASSES.DOT_PREVIEW,
  CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN,
  CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE,
] as const;

/**
 * All dot CSS classes that represent MEASURE-BASED opacity.
 * These are managed ONLY by updateMeasureOpacityClasses() and should NOT be
 * removed by animation state functions (setDotActive, setDotPlayed, etc.)
 */
export const ALL_MEASURE_OPACITY_CLASSES = [
  CSS_CLASSES.DOT_CURRENT_MEASURE,
  CSS_CLASSES.DOT_NEXT_MEASURE,
  CSS_CLASSES.DOT_NEXT_MEASURE_FIRST,
  CSS_CLASSES.DOT_OTHER_MEASURE,
] as const;

// =============================================================================
// DOT ANIMATION
// =============================================================================

/**
 * Calculate if a dot should be visible and its opacity based on measure
 *
 * SINGLE-LAYER ARCHITECTURE: All dots are visible.
 * - Current measure: highlighted (green/orange) at 100%
 * - Next measure: highlighted (green/orange) at 30% (preview)
 * - Other measures: GREY (visible) at 100%
 *
 * @param dotMeasure - The measure this dot belongs to (0-based)
 * @param currentMeasure - Current playback measure (0-based)
 * @returns shouldShow, opacity, and highlight state
 */
export function getDotVisibility(
  dotMeasure: number,
  currentMeasure: number,
): { shouldShow: boolean; opacity: number; isHighlighted: boolean } {
  const nextMeasure = currentMeasure + 1;

  if (dotMeasure === currentMeasure) {
    // Current measure - highlighted at 100%
    return {
      shouldShow: true,
      opacity: OPACITY.CURRENT_MEASURE,
      isHighlighted: true,
    };
  }

  if (dotMeasure === nextMeasure) {
    // Next measure - highlighted at 30% (preview)
    return {
      shouldShow: true,
      opacity: OPACITY.NEXT_MEASURE,
      isHighlighted: true,
    };
  }

  // Other measures - GREY (visible, not highlighted)
  return {
    shouldShow: true,
    opacity: OPACITY.OTHER_MEASURE,
    isHighlighted: false,
  };
}

/**
 * Get full animation state for a dot
 *
 * @param noteIndex - Index of the note in the exercise
 * @param noteMeasure - Measure the note belongs to (0-based)
 * @param context - Current animation context
 * @returns Full animation state for the dot
 */
export function getDotAnimationState(
  noteIndex: number,
  noteMeasure: number,
  context: AnimationContext,
): DotAnimationState {
  const { shouldShow, opacity, isHighlighted } = getDotVisibility(
    noteMeasure,
    context.currentMeasure,
  );

  return {
    shouldShow,
    opacity,
    isActive: noteIndex === context.activeNoteIndex,
    isPlayed: context.playedNoteIndices.has(noteIndex),
    isPreview: noteIndex === context.previewNoteIndex,
    isHighlighted,
  };
}

/**
 * Build CSS class string for a dot based on its animation state
 *
 * @param state - The dot's animation state
 * @returns Space-separated CSS class string
 */
export function getDotCssClasses(state: DotAnimationState): string {
  const classes: string[] = [];

  if (state.isActive) {
    classes.push(CSS_CLASSES.DOT_ACTIVE);
  }

  if (state.isPlayed) {
    classes.push(CSS_CLASSES.DOT_PLAYED);
  }

  if (state.isPreview) {
    classes.push(CSS_CLASSES.DOT_PREVIEW);
  }

  return classes.join(' ');
}

// =============================================================================
// LINE ANIMATION
// =============================================================================

/**
 * Calculate if a line should be visible and its opacity
 *
 * LINE VISIBILITY RULE:
 * - Lines are directional: measure1 (source) → measure2 (target)
 * - Show if TARGET (measure2) is within the 2-measure window [current, next]
 * - This ensures lines leading INTO visible measures are shown
 * - Lines leading OUT of the window (to measures beyond next) are hidden
 *
 * OPACITY RULE (SOURCE-PRIORITY):
 * - 100% if SOURCE (measure1) is in current measure (transition line INTO preview)
 * - 100% if TARGET (measure2) is in current measure (line leads to active note)
 * - 30% if BOTH source and target are in next measure only (internal preview lines)
 *
 * KEY INSIGHT: If the source is in the current measure, the line should be 100%
 * regardless of target. This makes transition lines INTO the preview visible,
 * guiding the player's eye from the current note to the upcoming note.
 *
 * @param measure1 - Measure of source endpoint (0-based)
 * @param measure2 - Measure of target endpoint (0-based)
 * @param currentMeasure - Current playback measure (0-based)
 * @returns Visibility and opacity for the line
 */
export function getLineVisibility(
  measure1: number,
  measure2: number,
  currentMeasure: number,
): LineAnimationState {
  const nextMeasure = currentMeasure + 1;

  const pos1InCurrent = measure1 === currentMeasure;
  const pos2InCurrent = measure2 === currentMeasure;
  const pos2InNext = measure2 === nextMeasure;

  // Show line if TARGET (measure2) is within the 2-measure window [current, next]
  const targetInWindow = pos2InCurrent || pos2InNext;

  if (!targetInWindow) {
    // Lines whose target is outside the window are hidden
    return { shouldShow: false, opacity: 0 };
  }

  // OPACITY RULE (SOURCE-PRIORITY):
  // - 100% if SOURCE is in current measure (includes transition lines current→next)
  // - 100% if TARGET is in current measure (line entering current from past)
  // - 30% only if both endpoints are exclusively in next measure (internal preview)
  const sourceInCurrent = pos1InCurrent;
  const targetInCurrent = pos2InCurrent;

  const opacity =
    sourceInCurrent || targetInCurrent
      ? OPACITY.CURRENT_MEASURE
      : OPACITY.NEXT_MEASURE;

  return { shouldShow: true, opacity };
}

/**
 * Calculate final line opacity combining measure visibility and scroll fade
 *
 * @param measure1 - Measure of first endpoint (0-based)
 * @param measure2 - Measure of second endpoint (0-based)
 * @param currentMeasure - Current playback measure (0-based)
 * @param scrollFadeOpacity - Opacity from scroll position (0-1)
 * @returns Final opacity (0-1) or null if line should not render
 */
export function getLineFinalOpacity(
  measure1: number,
  measure2: number,
  currentMeasure: number,
  scrollFadeOpacity = 1,
): number | null {
  const { shouldShow, opacity } = getLineVisibility(
    measure1,
    measure2,
    currentMeasure,
  );

  if (!shouldShow) {
    return null; // Don't render
  }

  const finalOpacity = opacity * scrollFadeOpacity;

  if (finalOpacity <= 0) {
    return null; // Don't render
  }

  return finalOpacity;
}

// =============================================================================
// DOM HELPERS
// =============================================================================

/**
 * Apply animation classes to a dot element
 *
 * @param element - The DOM element
 * @param state - Animation state to apply
 */
export function applyDotAnimationState(
  element: HTMLElement,
  state: DotAnimationState,
): void {
  element.classList.toggle(CSS_CLASSES.DOT_ACTIVE, state.isActive);
  element.classList.toggle(CSS_CLASSES.DOT_PLAYED, state.isPlayed);
  element.classList.toggle(CSS_CLASSES.DOT_PREVIEW, state.isPreview);
}

/**
 * Clear all animation state classes from a dot element
 *
 * @param element - The DOM element
 */
export function clearDotAnimationState(element: HTMLElement): void {
  ALL_DOT_STATE_CLASSES.forEach((cls) => {
    element.classList.remove(cls);
  });
}

/**
 * ULTRA DEBUG flag for helper functions
 * Enable in browser console: window.__ULTRA_DEBUG__ = true
 */
const isUltraDebugEnabled = () =>
  typeof window !== 'undefined' &&
  (window as unknown as { __ULTRA_DEBUG__?: boolean }).__ULTRA_DEBUG__;

/**
 * Set dot to ACTIVE state (currently playing note)
 * Removes all other states and adds active class
 *
 * @param element - The DOM element
 */
export function setDotActive(element: HTMLElement): void {
  // ULTRA DEBUG: Log before/after state
  if (isUltraDebugEnabled()) {
    const beforeClasses = element.className
      .split(' ')
      .filter((c) => c.startsWith('note-'))
      .join(',');
    const beforeOpacity = element.style.getPropertyValue('--measure-opacity');
    const beforeComputed = window.getComputedStyle(element).opacity;

    clearDotAnimationState(element);
    element.classList.add(CSS_CLASSES.DOT_ACTIVE);

    const afterClasses = element.className
      .split(' ')
      .filter((c) => c.startsWith('note-'))
      .join(',');
    const afterOpacity = element.style.getPropertyValue('--measure-opacity');
    const afterComputed = window.getComputedStyle(element).opacity;

    // eslint-disable-next-line no-console
    console.log(
      `⚡ [setDotActive] ${element.title || 'dot'}\n` +
        `   BEFORE: classes=[${beforeClasses}] --measure-opacity=${beforeOpacity} computed=${beforeComputed}\n` +
        `   AFTER:  classes=[${afterClasses}] --measure-opacity=${afterOpacity} computed=${afterComputed}`,
    );
  } else {
    clearDotAnimationState(element);
    element.classList.add(CSS_CLASSES.DOT_ACTIVE);
  }
}

/**
 * Set dot to PLAYED state (note has been played in current measure)
 * Used when the note position does NOT exist in next measure
 *
 * SINGLE-LAYER ARCHITECTURE: When a note is played, it becomes GREY.
 * This is done by:
 * 1. Removing the active/preview/highlight classes
 * 2. Removing the current-measure class
 * 3. Adding the other-measure class (which sets background-color to grey)
 *
 * @param element - The DOM element
 */
export function setDotPlayed(element: HTMLElement): void {
  // ULTRA DEBUG: Log before state
  const beforeClasses = isUltraDebugEnabled()
    ? element.className
        .split(' ')
        .filter((c) => c.startsWith('note-'))
        .join(',')
    : '';
  const beforeOpacity = isUltraDebugEnabled()
    ? element.style.getPropertyValue('--measure-opacity')
    : '';

  // Remove animation state classes
  element.classList.remove(CSS_CLASSES.DOT_ACTIVE);
  element.classList.remove(CSS_CLASSES.DOT_PREVIEW);
  element.classList.remove(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN);
  element.classList.remove(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE);

  // Remove current/next measure classes (played notes become "other measure" visually)
  element.classList.remove(CSS_CLASSES.DOT_CURRENT_MEASURE);
  element.classList.remove(CSS_CLASSES.DOT_NEXT_MEASURE);
  element.classList.remove(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST);

  // Add DOT_PLAYED for state tracking AND DOT_OTHER_MEASURE for grey color
  // Per design: played notes show as GREY (100% opacity, grey background)
  element.classList.add(CSS_CLASSES.DOT_PLAYED);
  element.classList.add(CSS_CLASSES.DOT_OTHER_MEASURE);

  // Set measure opacity to 1 (fully visible grey dot)
  element.style.setProperty('--measure-opacity', '1');

  // ULTRA DEBUG: Log after state
  if (isUltraDebugEnabled()) {
    const afterClasses = element.className
      .split(' ')
      .filter((c) => c.startsWith('note-'))
      .join(',');
    const afterOpacity = element.style.getPropertyValue('--measure-opacity');
    const afterComputed = window.getComputedStyle(element).opacity;
    // eslint-disable-next-line no-console
    console.log(
      `🔴 [setDotPlayed] ${element.title || 'dot'}\n` +
        `   BEFORE: classes=[${beforeClasses}] --measure-opacity=${beforeOpacity}\n` +
        `   AFTER:  classes=[${afterClasses}] --measure-opacity=${afterOpacity} computed=${afterComputed}`,
    );
  }
}

/**
 * Set dot to "played but exists in next measure" state
 * Shows at 30% opacity with appropriate measure color
 *
 * @param element - The DOM element
 * @param nextMeasure - The next measure number (0-based) to determine color
 */
export function setDotPlayedNextMeasure(
  element: HTMLElement,
  nextMeasure: number,
): void {
  // ULTRA DEBUG: Log before state
  const beforeClasses = isUltraDebugEnabled()
    ? element.className
        .split(' ')
        .filter((c) => c.startsWith('note-'))
        .join(',')
    : '';

  element.classList.remove(CSS_CLASSES.DOT_ACTIVE);
  element.classList.remove(CSS_CLASSES.DOT_PREVIEW);
  element.classList.remove(CSS_CLASSES.DOT_PLAYED);

  // Remove current/next measure classes (played note becomes "played-next" state)
  element.classList.remove(CSS_CLASSES.DOT_CURRENT_MEASURE);
  element.classList.remove(CSS_CLASSES.DOT_NEXT_MEASURE);
  element.classList.remove(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST);
  element.classList.remove(CSS_CLASSES.DOT_OTHER_MEASURE);

  // Color based on next measure: 0-based odd (1,3,5...) = orange, even (0,2,4...) = green
  const isNextMeasureOrange = nextMeasure % 2 === 1;

  if (isNextMeasureOrange) {
    element.classList.add(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE);
    element.classList.remove(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN);
  } else {
    element.classList.add(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN);
    element.classList.remove(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE);
  }

  // CRITICAL FIX: Set inline --measure-opacity to 0.3
  // Inline styles override CSS class variables, so we must explicitly set this
  // Otherwise, the previous --measure-opacity: 1 from updateMeasureOpacityClasses persists
  element.style.setProperty('--measure-opacity', '0.3');

  // ULTRA DEBUG: Log after state
  if (isUltraDebugEnabled()) {
    const afterClasses = element.className
      .split(' ')
      .filter((c) => c.startsWith('note-'))
      .join(',');
    const afterOpacity = element.style.getPropertyValue('--measure-opacity');
    const afterComputed = window.getComputedStyle(element).opacity;
    // eslint-disable-next-line no-console
    console.log(
      `🟠 [setDotPlayedNextMeasure] nextMeasure=${nextMeasure} ${element.title || 'dot'}\n` +
        `   BEFORE: classes=[${beforeClasses}]\n` +
        `   AFTER:  classes=[${afterClasses}] --measure-opacity=${afterOpacity} computed=${afterComputed}`,
    );
  }
}

/**
 * Set dot to PREVIEW state (next note to be played)
 *
 * @param element - The DOM element
 */
export function setDotPreview(element: HTMLElement): void {
  element.classList.add(CSS_CLASSES.DOT_PREVIEW);
}

/**
 * Remove preview state from a dot
 *
 * @param element - The DOM element
 */
export function clearDotPreview(element: HTMLElement): void {
  element.classList.remove(CSS_CLASSES.DOT_PREVIEW);
}

/**
 * Mark a line as played (hides it via CSS)
 *
 * @param element - The line DOM element
 */
export function markLineAsPlayed(element: HTMLElement): void {
  element.classList.add(CSS_CLASSES.LINE_PLAYED);
}

/**
 * Clear played state from a line
 *
 * @param element - The line DOM element
 */
export function clearLinePlayed(element: HTMLElement): void {
  element.classList.remove(CSS_CLASSES.LINE_PLAYED);
}

/**
 * Clear all played states from dots and lines in the document
 * Called on measure change to reset for new measure
 *
 * CRITICAL FIX: Clears measure-related classes from ALL fretboard dots, not just
 * dots that have "played" state. This is necessary because:
 * 1. updateMeasureOpacityClasses() adds DOT_OTHER_MEASURE to dots in "other" measures
 * 2. These dots don't have DOT_PLAYED, so the old query missed them
 * 3. On measure change, ALL measure-related classes must be reset
 *
 * Classes cleared from ALL dots:
 * - DOT_PLAYED (tracking state)
 * - DOT_PLAYED_NEXT_MEASURE_GREEN (30% opacity green preview)
 * - DOT_PLAYED_NEXT_MEASURE_ORANGE (30% opacity orange preview)
 * - DOT_CURRENT_MEASURE (100% opacity for current measure)
 * - DOT_NEXT_MEASURE (30% opacity for next measure)
 * - DOT_NEXT_MEASURE_FIRST (100% opacity for first note of next measure)
 * - DOT_OTHER_MEASURE (grey styling for other measures)
 * - LINE_PLAYED (hidden line state) - ONLY for lines NOT in previous measure
 *
 * This ensures notes are fully reset before updateMeasureOpacityClasses()
 * applies the correct new measure-based state.
 *
 * @param preservePreviousMeasure - If provided, lines whose source is in measures
 *        BEFORE this measure will stay hidden. This prevents flicker on measure change
 *        where clearAllPlayedStates would briefly show lines, then markLineAsPlayed
 *        would hide them again. Lines from previous measures should stay hidden because
 *        those notes have already been played.
 */
export function clearAllPlayedStates(preservePreviousMeasure?: number): {
  clearedDots: number;
  clearedLines: number;
} {
  // CRITICAL FIX: Query ALL fretboard dots, not just those with "played" classes
  // This ensures we clear DOT_OTHER_MEASURE from dots that were styled grey by
  // updateMeasureOpacityClasses() (not just by setDotPlayed())
  const allDots = document.querySelectorAll(`.${CSS_CLASSES.FRETBOARD_DOT}`);

  let clearedCount = 0;
  const ultraDebug = isUltraDebugEnabled();
  const clearedDetails: string[] = [];

  allDots.forEach((dot) => {
    // Check if this dot has ANY of the classes we need to clear
    const hasPlayedClass = dot.classList.contains(CSS_CLASSES.DOT_PLAYED);
    const hasPlayedNextGreen = dot.classList.contains(
      CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN,
    );
    const hasPlayedNextOrange = dot.classList.contains(
      CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE,
    );
    const hasCurrentMeasure = dot.classList.contains(
      CSS_CLASSES.DOT_CURRENT_MEASURE,
    );
    const hasNextMeasure = dot.classList.contains(CSS_CLASSES.DOT_NEXT_MEASURE);
    const hasNextMeasureFirst = dot.classList.contains(
      CSS_CLASSES.DOT_NEXT_MEASURE_FIRST,
    );
    const hasOtherMeasure = dot.classList.contains(
      CSS_CLASSES.DOT_OTHER_MEASURE,
    );

    const needsClearing =
      hasPlayedClass ||
      hasPlayedNextGreen ||
      hasPlayedNextOrange ||
      hasCurrentMeasure ||
      hasNextMeasure ||
      hasNextMeasureFirst ||
      hasOtherMeasure;

    if (needsClearing) {
      // ULTRA DEBUG: Record what we're clearing
      if (ultraDebug) {
        const beforeClasses = (dot as HTMLElement).className
          .split(' ')
          .filter((c) => c.startsWith('note-'))
          .join(',');
        const beforeOpacity = (dot as HTMLElement).style.getPropertyValue(
          '--measure-opacity',
        );
        clearedDetails.push(
          `${(dot as HTMLElement).title || 'dot'}: [${beforeClasses}] opacity=${beforeOpacity}`,
        );
      }

      // Remove ALL state classes for complete reset
      dot.classList.remove(CSS_CLASSES.DOT_PLAYED);
      dot.classList.remove(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_GREEN);
      dot.classList.remove(CSS_CLASSES.DOT_PLAYED_NEXT_MEASURE_ORANGE);
      dot.classList.remove(CSS_CLASSES.DOT_CURRENT_MEASURE);
      dot.classList.remove(CSS_CLASSES.DOT_NEXT_MEASURE);
      dot.classList.remove(CSS_CLASSES.DOT_NEXT_MEASURE_FIRST);
      dot.classList.remove(CSS_CLASSES.DOT_OTHER_MEASURE);

      // Remove the inline --measure-opacity CSS variable
      (dot as HTMLElement).style.removeProperty('--measure-opacity');

      clearedCount++;
    }
  });

  // Clear line played states
  // FLICKER FIX: If preservePreviousMeasure is set, only clear lines from CURRENT and FUTURE measures.
  // Lines from PREVIOUS measures should stay hidden - they connect already-played notes.
  const playedLines = document.querySelectorAll(
    `.${CSS_CLASSES.CONNECTION_LINE}.${CSS_CLASSES.LINE_PLAYED}`,
  );
  let clearedLineCount = 0;
  playedLines.forEach((line) => {
    // Check if we should preserve this line
    if (preservePreviousMeasure !== undefined) {
      const sourceMeasureAttr = line.getAttribute('data-source-measure');
      const sourceMeasure = sourceMeasureAttr
        ? parseInt(sourceMeasureAttr, 10)
        : -1;

      // Keep lines hidden if their source note is from a PREVIOUS measure
      // (measures 0 to preservePreviousMeasure-1)
      if (sourceMeasure >= 0 && sourceMeasure < preservePreviousMeasure) {
        // Don't clear - keep this line hidden
        return;
      }
    }

    // Clear this line's played state (make it visible again)
    line.classList.remove(CSS_CLASSES.LINE_PLAYED);
    clearedLineCount++;
  });

  // ULTRA DEBUG: Log what was cleared
  if (ultraDebug && clearedDetails.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `🧹 [clearAllPlayedStates] Cleared ${clearedCount} dots:\n` +
        clearedDetails.map((d) => `   ${d}`).join('\n'),
    );
  }

  return {
    clearedDots: clearedCount,
    clearedLines: clearedLineCount,
  };
}

/**
 * Reset all animation states (called when playback stops)
 */
export function resetAllAnimationStates(): void {
  // Clear active states
  const activeDots = document.querySelectorAll(
    `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_ACTIVE}`,
  );
  activeDots.forEach((dot) => {
    dot.classList.remove(CSS_CLASSES.DOT_ACTIVE);
  });

  // Clear preview states
  const previewDots = document.querySelectorAll(
    `.${CSS_CLASSES.FRETBOARD_DOT}.${CSS_CLASSES.DOT_PREVIEW}`,
  );
  previewDots.forEach((dot) => {
    dot.classList.remove(CSS_CLASSES.DOT_PREVIEW);
  });

  // Clear all played states
  clearAllPlayedStates();
}
