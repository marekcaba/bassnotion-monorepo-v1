/**
 * Lines & Fills combo resolution.
 *
 * Each {@link BasslineVariant} is a pre-rendered full take of a (line, fill)
 * combination. The player offers TWO single-select controls:
 *
 *   • Lines — which bassline (the default, or "A" / "B" / …)
 *   • Fills — which fill (none, or "fill1" / "fill2" / …)
 *
 * The active stem is the variant whose `(lineId, fillId)` matches the current
 * selection. There is NO new DSP: once the combo resolves to a variant id, the
 * existing `setBassVariant(id)` swaps it on the next bar (see
 * `useGrooveCardPlayback`).
 *
 * Sentinels: the DEFAULT line and the NO-fill option are represented by a
 * variant with the corresponding tag *absent* (`lineId`/`fillId` undefined).
 * We normalise "absent" to these stable string keys so the UI can key rows and
 * compare selections without juggling `undefined`.
 */

import type { BasslineVariant } from '@bassnotion/contracts';

/** The default bassline (the groove's built-in `stems.bass`). A variant with no
 *  `lineId` belongs to this line. */
export const DEFAULT_LINE_ID = '__default__';
/** No fill selected. A variant with no `fillId` is the "None" fill option. */
export const NO_FILL_ID = '__none__';

export interface LineOption {
  /** Stable id (`DEFAULT_LINE_ID` for the built-in bass). */
  id: string;
  /** Display label for the Lines row. */
  label: string;
}

export interface FillOption {
  /** Stable id (`NO_FILL_ID` for "no fill"). */
  id: string;
  /** Display label for the Fills row. */
  label: string;
}

export interface LinesAndFillsModel {
  /** The Lines row, "Default" first, then each distinct line in first-seen
   *  order. */
  lines: LineOption[];
  /** The Fills row, "None" first, then each distinct fill in first-seen order.
   *  Empty (length 0) when the groove has no fills at all — callers hide the
   *  Fills row in that case. */
  fills: FillOption[];
}

/**
 * The line a variant belongs to. Three cases:
 *
 *  1. Explicit `lineId` → that line. Co-tagged takes ("B", "B+fill1") merge
 *     into ONE line that carries fills.
 *  2. No `lineId` but HAS a `fillId` → it's a fill OF THE DEFAULT LINE
 *     (`DEFAULT_LINE_ID`), so the built-in bass can carry fills. (This is how
 *     the admin authors a default-line fill: a cell tagged fillId-only.)
 *  3. Neither tag → its OWN line, keyed by id. This preserves the pre-Fills
 *     single-row card, where every (untagged) variant was its own swap cell.
 *
 * (The built-in `stems.bass` itself is the `DEFAULT_LINE_ID` line — selecting
 * it maps to the null/default variant.)
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
 * Derive the Lines + Fills rows from the groove's variant list.
 *
 * - The built-in bass is always the first Line ("Default", `DEFAULT_LINE_ID`);
 *   "None" is always the first Fill.
 * - Each distinct line key (see {@link lineKeyOf}) becomes a Line cell in
 *   first-seen order — so untagged legacy variants each get their own cell
 *   (backward-compatible), while explicitly co-tagged takes merge into one line.
 * - Each distinct `fillId` becomes a Fill cell. A groove with no fills yields an
 *   empty Fills list → the caller hides the row.
 * - A line's label prefers its no-fill take's title (so "B" reads as the author
 *   named the plain Bassline B, not "B + Fill 1"); a fill's label prefers its
 *   first take's title. Both fall back to the raw id.
 */
export function buildLinesAndFillsModel(
  variants: BasslineVariant[],
): LinesAndFillsModel {
  const lines: LineOption[] = [{ id: DEFAULT_LINE_ID, label: 'Default' }];
  const fills: FillOption[] = [{ id: NO_FILL_ID, label: 'None' }];
  const seenLines = new Set<string>([DEFAULT_LINE_ID]);
  const seenFills = new Set<string>([NO_FILL_ID]);

  for (const v of variants) {
    const lk = lineKeyOf(v);
    if (!seenLines.has(lk)) {
      seenLines.add(lk);
      // Prefer the line's no-fill take title; fall back to this variant's title.
      const base = variants.find(
        (x) => lineKeyOf(x) === lk && fillKeyOf(x) === NO_FILL_ID,
      );
      lines.push({ id: lk, label: base?.title ?? v.title });
    }
    const fk = fillKeyOf(v);
    if (fk !== NO_FILL_ID && !seenFills.has(fk)) {
      seenFills.add(fk);
      const base = variants.find((x) => fillKeyOf(x) === fk);
      fills.push({ id: fk, label: base?.title ?? v.title });
    }
  }

  // A groove with no fills at all → no Fills row (just the "None" sentinel,
  // which we collapse to an empty list so the caller hides the row).
  return { lines, fills: fills.length > 1 ? fills : [] };
}

/**
 * Resolve the variant id for a (line, fill) selection, or `null` for the
 * default bass (default line + no fill).
 *
 * Returns:
 *  - `null` when the selection is (DEFAULT_LINE, NO_FILL) → restore built-in bass.
 *  - the matching variant's id when an exact (line, fill) take exists.
 *  - `undefined` when no take exists for that combo (caller should ignore the
 *    change / keep the current selection — the author didn't export it).
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
 * (lineId, fillId) selection. `null` (default bass) maps to (default, none).
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
