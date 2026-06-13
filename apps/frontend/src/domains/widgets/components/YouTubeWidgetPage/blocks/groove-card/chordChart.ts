/**
 * Chord-chart helpers — turn a sparse chord chart + a playhead phase into the
 * currently-sounding chord, and resolve a chord per (bar, slot) cell for the
 * admin grid / display row.
 *
 * The chart is SPARSE: an entry is placed only where the harmony CHANGES; the
 * chord holds until the next entry. Positions are bar (1-based) + eighth-note
 * slot (0..7, 4/4). All lookups walk the chart sorted by absolute slot and take
 * the last entry at or before the queried position.
 */

import {
  CHORD_SLOTS_PER_BAR,
  type ChordChart,
  type ChordChartEntry,
} from '@bassnotion/contracts';

/** Absolute eighth-note slot of an entry from the start of the groove (bar 1
 *  slot 0 = absolute 0). */
function absSlot(bar: number, slot: number): number {
  return (bar - 1) * CHORD_SLOTS_PER_BAR + slot;
}

/** The chart sorted by absolute position (stable, ignores malformed entries). */
export function sortedChart(chart: ChordChart | undefined): ChordChartEntry[] {
  if (!chart || chart.length === 0) return [];
  return [...chart]
    .filter(
      (e) =>
        Number.isFinite(e.bar) &&
        Number.isFinite(e.slot) &&
        typeof e.symbol === 'string' &&
        e.symbol.trim().length > 0,
    )
    .sort((a, b) => absSlot(a.bar, a.slot) - absSlot(b.bar, b.slot));
}

/**
 * The chord symbol sounding at a given absolute position (bar 1-based, slot
 * 0..7) — the last entry at or before it. Returns null when nothing is charted
 * at/ before that point (e.g. silence before the first chord).
 */
export function chordAt(
  chart: ChordChart | undefined,
  bar: number,
  slot: number,
): string | null {
  const entries = sortedChart(chart);
  if (entries.length === 0) return null;
  const target = absSlot(bar, slot);
  let active: string | null = null;
  for (const e of entries) {
    if (absSlot(e.bar, e.slot) <= target) active = e.symbol;
    else break;
  }
  return active;
}

/**
 * Convert a loop phase [0,1) into the current (bar, slot) the player is on.
 *
 * `barsInLoop` is the number of bars the phase spans — the FULL groove
 * normally, or the selected bar-range when a sub-loop is active. `barOffset` is
 * added so a sub-loop maps back onto absolute groove bars (startBar - 1).
 *
 * Returns bar 1-based, slot 0..7. Phase is clamped into [0,1).
 */
export function phaseToPosition(
  phase: number,
  barsInLoop: number,
  barOffset = 0,
): { bar: number; slot: number } {
  const p = Math.min(0.999999, Math.max(0, phase));
  const totalSlots = Math.max(1, barsInLoop) * CHORD_SLOTS_PER_BAR;
  const absoluteSlot = Math.floor(p * totalSlots);
  const bar = barOffset + Math.floor(absoluteSlot / CHORD_SLOTS_PER_BAR) + 1;
  const slot = absoluteSlot % CHORD_SLOTS_PER_BAR;
  return { bar, slot };
}

/**
 * Build a per-cell view of the chart for display/editing: for each bar
 * (1..lengthBars) and slot (0..7), the symbol AUTHORED at that exact cell
 * (null if none). This is the sparse grid the admin edits — NOT the
 * holding/inherited chord (use chordAt for "what's sounding").
 */
export function chartCellMap(
  chart: ChordChart | undefined,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const e of sortedChart(chart)) {
    map.set(`${e.bar}:${e.slot}`, e.symbol);
  }
  return map;
}

/** Cell key helper shared by the editor + display. */
export function cellKey(bar: number, slot: number): string {
  return `${bar}:${slot}`;
}

/** One chord change inside a bar, at its true sixteenth-slot position. The
 *  ribbon places it at (slot / CHORD_SLOTS_PER_BAR) of the bar's width, so a
 *  chord on the 2nd sixteenth of a beat sits just right of the beat, and two
 *  chords sharing a beat sit at their real, distinct positions. */
export interface BarChange {
  /** Sixteenth-note slot within the bar, 0..CHORD_SLOTS_PER_BAR-1. */
  slot: number;
  symbol: string;
}

/** What to draw for one bar of the ribbon.
 *  - `kind: 'repeat'` — the bar sustains the previous bar's chord with no change
 *    of its own → draw a single simile (repeat) mark, like a lead sheet. This is
 *    also how an ANTICIPATION reads: a chord struck late in the prior bar that
 *    rings into this one is ONE chord, so this bar shows "same again", not a
 *    second chord to switch to.
 *  - `kind: 'chords'` — the bar has at least one change → draw each bright chord
 *    symbol at its true sixteenth position; sustaining time stays empty.
 *  - `kind: 'empty'` — nothing charted yet (silence before the first chord). */
export type BarRender =
  | { kind: 'repeat' }
  | { kind: 'empty' }
  | { kind: 'chords'; changes: BarChange[] };

/**
 * What the bar ribbon should paint for a groove bar (1-based).
 *
 * A chord symbol appears at the EXACT sixteenth slot where it CHANGES (bright),
 * so chords on off-sixteenths (e.g. the 2nd sixteenth of a beat) and multiple
 * chords within one beat all show at their real positions — none dropped or
 * snapped. A bar that merely SUSTAINS the chord ringing into it — no change of
 * its own — renders a single SIMILE / repeat mark instead of any dim chord text
 * ("repeat the chord before"). That also collapses anticipations: a chord struck
 * late in the prior bar with an empty next bar is ONE chord, shown bright where
 * it's struck and then a repeat mark, never two chords to switch between.
 *
 * Pure function of the sparse chart; called per visible bar.
 */
export function barRender(
  chart: ChordChart | undefined,
  bar: number,
): BarRender {
  const entries = sortedChart(chart);
  if (entries.length === 0) return { kind: 'empty' };

  // Every authored change in this bar, at its true slot, in time order.
  const changes: BarChange[] = entries
    .filter((e) => e.bar === bar)
    .map((e) => ({ slot: e.slot, symbol: e.symbol }));

  if (changes.length > 0) return { kind: 'chords', changes };

  // No change in this bar. If a chord is ringing into it → repeat mark; if
  // nothing has been charted yet at this point → empty.
  const sounding = chordAt(chart, bar, 0);
  return sounding != null ? { kind: 'repeat' } : { kind: 'empty' };
}

/**
 * Declutter chords positioned at their true musical x so adjacent ones stay
 * READABLE. Each chord wants to sit at its natural x; walking left→right, if a
 * chord would start before the previous one's right edge + a minimum gap, it's
 * pushed right just enough. The FIRST chord keeps its exact position; only
 * crowded followers move, and a dense cluster may bleed slightly past the bar's
 * end (acceptable — see the product decision).
 *
 * Inputs are the chords' natural left x and estimated rendered width, in slot
 * order. Returns the placed left x for each, same order. Pure + testable.
 */
export function declutterChordX(
  chords: { naturalX: number; width: number }[],
  minGap: number,
): number[] {
  const out: number[] = [];
  let cursor = -Infinity; // min left x the next chord may take
  for (const c of chords) {
    const x = Math.max(c.naturalX, cursor);
    out.push(x);
    cursor = x + c.width + minGap;
  }
  return out;
}
