/**
 * Lines & Fills resolution.
 *
 * A groove can ship alternate **basslines** (Bass A, Bass B, …) and, **owned by
 * each line**, its own **fills** (Bass A has its fills; Bass B has its own,
 * different fills — they never cross lines). Every option is a full pre-rendered
 * take swapped on the next bar via the patched signalsmith worklet — there is NO
 * new DSP: once a selection resolves to a variant id, `setBassVariant(id)` swaps
 * it (see `useGrooveCardPlayback`).
 *
 * The first/built-in bassline IS Bass A — it's the groove's own `stems.bass`,
 * not a separate upload. Internally it's keyed `DEFAULT_LINE_ID` and selecting it
 * with no fill restores the built-in bass (`setBassVariant(null)`). Its fills are
 * authored as variants tagged with a `fillId` but no `lineId`.
 *
 * Data: each {@link BasslineVariant} carries `(lineId?, fillId?)`. A line is the
 * set of variants sharing a line key; a fill is a variant within that line that
 * also has a `fillId`. The UI renders each line grouped with its own fills.
 */

import type { BasslineVariant } from '@bassnotion/contracts';

/** The built-in bassline (the groove's `stems.bass`) — "Bass A". */
export const DEFAULT_LINE_ID = '__default__';
/** No fill selected (playing the plain line). */
export const NO_FILL_ID = '__none__';

export interface FillOption {
  /** Stable id (`fillId`). */
  id: string;
  /** Display label. */
  label: string;
}

export interface LineGroup {
  /** Stable line id (`DEFAULT_LINE_ID` for the built-in Bass A). */
  id: string;
  /** Display label (the author's line name; defaults to "Bass A" for built-in). */
  label: string;
  /** This line's own fills (never shared with other lines). May be empty. */
  fills: FillOption[];
}

/**
 * The line a variant belongs to:
 *  1. explicit `lineId` → that line (co-tagged takes merge into one line);
 *  2. no `lineId` but a `fillId` → a fill of the built-in line (Bass A);
 *  3. neither tag → its own line, keyed by id (legacy untagged variants stay
 *     their own swap cell — backward-compatible with pre-Fills grooves).
 */
export function lineKeyOf(variant: BasslineVariant): string {
  if (variant.lineId) return variant.lineId;
  if (variant.fillId) return DEFAULT_LINE_ID;
  return variant.id;
}

/** Normalise a variant's fill tag (absent → no fill). */
export function fillKeyOf(variant: BasslineVariant): string {
  return variant.fillId ?? NO_FILL_ID;
}

/**
 * Drop a redundant leading line-name from a fill's title — "Bass B Fill 1" with
 * line "Bass B" → "Fill 1" (the fill card sits next to its line card, so the
 * prefix is obvious). Case-insensitive; tolerates a space / "-" / "·" / ":"
 * separator after the prefix. No-op when the title doesn't start with the line
 * name, or when stripping would leave it empty.
 */
export function stripLinePrefix(title: string, lineLabel: string): string {
  const t = title.trim();
  const p = lineLabel.trim();
  if (!p || t.toLowerCase().indexOf(p.toLowerCase()) !== 0) return t;
  const rest = t
    .slice(p.length)
    .replace(/^[\s\-·:]+/, '')
    .trim();
  return rest.length > 0 ? rest : t;
}

/**
 * Group the groove's variants into lines, each owning its own fills.
 *
 * - The built-in Bass A (`DEFAULT_LINE_ID`) is always the first group, even
 *   when the groove has no variants at all (so the card can still offer it).
 * - Then each distinct line key in first-seen order. A line's label prefers its
 *   no-fill take's title (so "Bass B" reads as authored, not "Bass B + Fill 1").
 * - Within a line, each distinct `fillId` becomes a fill, first-seen order,
 *   labelled by its take's title.
 */
export function buildLinesAndFillsGroups(
  variants: BasslineVariant[],
): LineGroup[] {
  const order: string[] = [DEFAULT_LINE_ID];
  const seen = new Set<string>([DEFAULT_LINE_ID]);
  for (const v of variants) {
    const lk = lineKeyOf(v);
    if (!seen.has(lk)) {
      seen.add(lk);
      order.push(lk);
    }
  }

  return order.map((lk) => {
    const inLine = variants.filter((v) => lineKeyOf(v) === lk);
    // Line label = the plain (no-fill) take's title. A fill take's title must
    // NEVER become the line label (the built-in Bass A has no base take, so it
    // falls back to "Bass A" rather than borrowing a fill's name).
    const base = inLine.find((v) => fillKeyOf(v) === NO_FILL_ID);
    const label = base?.title ?? (lk === DEFAULT_LINE_ID ? 'Bass A' : lk);

    const fills: FillOption[] = [];
    const seenFills = new Set<string>();
    for (const v of inLine) {
      const fk = fillKeyOf(v);
      if (fk !== NO_FILL_ID && !seenFills.has(fk)) {
        seenFills.add(fk);
        // Fill cells sit right beside their line cell, so strip a redundant
        // leading line-name prefix from the title ("Bass B Fill 1" → "Fill 1").
        fills.push({ id: fk, label: stripLinePrefix(v.title, label) });
      }
    }
    return { id: lk, label, fills };
  });
}

/**
 * Resolve the variant id for a (line, fill) selection.
 *  - `null` when the selection is (built-in Bass A, no fill) → restore stems.bass.
 *  - the matching variant's id when that exact (line, fill) take exists.
 *  - `undefined` when no take exists (caller ignores the change).
 */
export function resolveComboVariantId(
  variants: BasslineVariant[],
  lineId: string,
  fillId: string,
): string | null | undefined {
  if (lineId === DEFAULT_LINE_ID && fillId === NO_FILL_ID) return null;
  const match = variants.find(
    (v) => lineKeyOf(v) === lineId && fillKeyOf(v) === fillId,
  );
  return match?.id;
}

/**
 * Given the active variant id (from playback state), derive the current
 * (lineId, fillId) selection. `null` (built-in bass) maps to (Bass A, none).
 */
export function selectionForVariantId(
  variants: BasslineVariant[],
  activeVariantId: string | null,
): { lineId: string; fillId: string } {
  if (activeVariantId === null) {
    return { lineId: DEFAULT_LINE_ID, fillId: NO_FILL_ID };
  }
  const v = variants.find((x) => x.id === activeVariantId);
  if (!v) return { lineId: DEFAULT_LINE_ID, fillId: NO_FILL_ID };
  return { lineId: lineKeyOf(v), fillId: fillKeyOf(v) };
}
