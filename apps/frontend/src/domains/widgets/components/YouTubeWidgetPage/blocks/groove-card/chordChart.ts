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
