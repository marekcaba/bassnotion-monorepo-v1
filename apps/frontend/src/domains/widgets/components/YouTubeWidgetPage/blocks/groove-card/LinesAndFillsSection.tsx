'use client';

/**
 * LinesAndFillsSection — the premium combo-bassline swap UI ("Lines & Fills").
 * Renders under the groove card as TWO single-select rows:
 *
 *   • Lines — pick a bassline (Default, or A / B / C …).
 *   • Fills — pick a fill (None, or fill1 / fill2 …). Hidden when the groove
 *     has no fills at all (then the card is just the original line swap).
 *
 * The active stem is the (line, fill) COMBO. Each row reports its new selection
 * to the parent (`onSelectLine` / `onSelectFill`); the parent resolves the
 * matching pre-rendered variant and swaps it in on the next bar (drums &
 * harmony keep playing). One bassline + at most one fill — never stacked.
 *
 * Gate (decided by the parent, passed as `locked`):
 *  - entitled member → cells are live; the active one is highlighted (amber).
 *  - locked (free / not-entitled) → premium cells show a lock; clicking fires
 *    the upgrade moment. The whole section still renders so the feature is
 *    DISCOVERABLE — the wall is the pitch, same as Dynamic Loop. (Default line +
 *    None fill are always free, so they never lock.)
 *
 * Visual language mirrors the exercise journey cells (rounded card, label,
 * selected ring) so the card feels of-a-piece. The active cell gets an amber
 * glow (vs the exercises' violet) to read as "playing now".
 */

import { Lock, Music, Sparkles } from 'lucide-react';
import type {
  FillOption,
  LineOption,
} from './linesAndFills';
import { DEFAULT_LINE_ID, NO_FILL_ID } from './linesAndFills';

export interface LinesAndFillsSectionProps {
  /** The Lines row ("Default" first, then each line). */
  lines: LineOption[];
  /** The Fills row ("None" first, then each fill). Empty → the row is hidden
   *  (groove has no fills). */
  fills: FillOption[];
  /** The currently selected line id (`DEFAULT_LINE_ID` for the built-in bass). */
  activeLineId: string;
  /** The currently selected fill id (`NO_FILL_ID` for no fill). */
  activeFillId: string;
  /** True when the feature is gated (free / not entitled). Premium cells show
   *  locked and clicks route to the upsell instead of swapping. */
  locked: boolean;
  /** Select a line. The parent gates this: when `locked`, a non-default line
   *  fires the upgrade moment instead of swapping. */
  onSelectLine: (lineId: string) => void;
  /** Select a fill. The parent gates this: when `locked`, a non-None fill fires
   *  the upgrade moment instead of swapping. */
  onSelectFill: (fillId: string) => void;
}

interface CellProps {
  label: string;
  active: boolean;
  /** This cell is a premium option (locks when the feature is gated). The free
   *  options (Default line, None fill) pass `false` so they never lock. */
  premium: boolean;
  locked: boolean;
  /** Icon shown when the cell is neither active nor locked. */
  idleIcon: 'line' | 'fill';
  onClick: () => void;
}

function VariantCell({
  label,
  active,
  premium,
  locked,
  idleIcon,
  onClick,
}: CellProps) {
  const showLock = premium && locked;
  const IdleIcon = idleIcon === 'fill' ? Sparkles : Music;
  return (
    <button
      type="button"
      onClick={onClick}
      title={showLock ? 'Lines & Fills — a member move' : label}
      className={`
        relative flex flex-col items-center justify-center gap-1.5
        w-[88px] shrink-0 px-3 py-3 rounded-xl
        transition-all duration-300 ease-out group
        focus:outline-none focus-visible:outline-none
        ${
          active && !showLock
            ? 'bg-amber-400/10 border border-amber-400/40 shadow-lg shadow-amber-500/10 scale-[1.05]'
            : showLock
              ? 'bg-white/[0.02] border border-slate-600/30 hover:border-slate-500/40'
              : 'bg-white/5 border border-white/10 hover:border-white/20 hover:scale-[1.02]'
        }
      `}
    >
      {/* Active glow */}
      <div
        className={`
          absolute inset-0 rounded-xl pointer-events-none
          bg-gradient-to-b from-amber-400/20 via-amber-500/10 to-transparent
          transition-opacity duration-300
          ${active && !showLock ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Icon */}
      <div className="relative flex items-center justify-center w-7 h-7">
        {showLock ? (
          <Lock className="w-4 h-4 text-slate-500" />
        ) : active ? (
          <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        ) : (
          <IdleIcon className="w-4 h-4 text-slate-400 group-hover:text-slate-300" />
        )}
      </div>

      {/* Label */}
      <span
        className={`
          text-[11px] font-semibold leading-none text-center
          ${
            active && !showLock
              ? 'text-amber-200'
              : showLock
                ? 'text-slate-500'
                : 'text-slate-300 group-hover:text-slate-200'
          }
        `}
      >
        {label}
      </span>
    </button>
  );
}

function Row({
  heading,
  options,
  activeId,
  freeId,
  idleIcon,
  locked,
  onSelect,
}: {
  heading: string;
  options: LineOption[] | FillOption[];
  activeId: string;
  /** The always-free option in this row (Default line / None fill). */
  freeId: string;
  idleIcon: 'line' | 'fill';
  locked: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {heading}
      </div>
      <div className="flex flex-wrap items-stretch gap-2">
        {options.map((opt) => (
          <VariantCell
            key={opt.id}
            label={opt.label}
            active={activeId === opt.id}
            premium={opt.id !== freeId}
            locked={locked}
            idleIcon={idleIcon}
            onClick={() => onSelect(opt.id)}
          />
        ))}
      </div>
    </div>
  );
}

export function LinesAndFillsSection({
  lines,
  fills,
  activeLineId,
  activeFillId,
  locked,
  onSelectLine,
  onSelectFill,
}: LinesAndFillsSectionProps) {
  // Nothing to swap → render nothing (parent also guards on variant count).
  if (lines.length <= 1 && fills.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/60 to-slate-900/40 p-4 backdrop-blur-xl">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Lines &amp; Fills
        </h3>
        {locked && (
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300/80">
            Members
          </span>
        )}
      </div>
      <p className="mb-3 text-[11px] text-slate-500">
        Swap the bassline and drop in fills mid-groove — drums &amp; harmony keep
        playing.
      </p>

      <div className="flex flex-col gap-4">
        {lines.length > 1 && (
          <Row
            heading="Lines"
            options={lines}
            activeId={activeLineId}
            freeId={DEFAULT_LINE_ID}
            idleIcon="line"
            locked={locked}
            onSelect={onSelectLine}
          />
        )}
        {fills.length > 0 && (
          <Row
            heading="Fills"
            options={fills}
            activeId={activeFillId}
            freeId={NO_FILL_ID}
            idleIcon="fill"
            locked={locked}
            onSelect={onSelectFill}
          />
        )}
      </div>
    </div>
  );
}
