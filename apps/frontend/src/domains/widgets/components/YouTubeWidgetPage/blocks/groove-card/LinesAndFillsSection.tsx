'use client';

/**
 * LinesAndFillsSection — the premium bassline/fills swap UI ("Lines & Fills").
 *
 * Renders one GROUP per bassline (Bass A, Bass B, …), each showing the line cell
 * followed by ITS OWN fill cells, with a divider between lines. Fills belong to a
 * line and never cross — Bass B's fills only appear under Bass B. Tapping a line
 * plays it (no fill); tapping one of its fills plays that line+fill combo. The
 * parent resolves the matching pre-rendered take and swaps it on the next bar
 * (drums & harmony keep playing). One line + at most one of its fills active.
 *
 * Gate (decided by the parent, passed as `locked`):
 *  - entitled member → cells are live; the active one glows violet (matching
 *    the exercise journey cards, so the controls feel of-a-piece).
 *  - locked (free / not-entitled) → premium cells show a lock; clicking fires
 *    the upgrade moment. The whole section still renders so the feature is
 *    DISCOVERABLE — the wall is the pitch, same as Dynamic Loop. (The built-in
 *    Bass A with no fill is always free, so it never locks.)
 */

import { Lock, Music, Sparkles } from 'lucide-react';
import type { LineGroup } from './linesAndFills';
import { DEFAULT_LINE_ID, NO_FILL_ID } from './linesAndFills';

export interface LinesAndFillsSectionProps {
  /** One group per bassline (built-in Bass A first), each with its own fills. */
  groups: LineGroup[];
  /** The currently selected line id (`DEFAULT_LINE_ID` for the built-in bass). */
  activeLineId: string;
  /** The currently selected fill id (`NO_FILL_ID` for no fill). */
  activeFillId: string;
  /** True when the feature is gated (free / not entitled). Premium cells show
   *  locked and clicks route to the upsell instead of swapping. */
  locked: boolean;
  /** Select a (line, fill). The parent gates this: when `locked`, a premium
   *  selection fires the upgrade moment instead of swapping. */
  onSelect: (lineId: string, fillId: string) => void;
}

interface CellProps {
  label: string;
  active: boolean;
  /** This cell is a premium option (locks when the feature is gated). The
   *  built-in Bass A with no fill passes `false` so it never locks. */
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
        relative flex flex-col items-center gap-1.5
        w-[88px] shrink-0 px-3 py-3 rounded-xl
        transition-all duration-300 ease-out group
        focus:outline-none focus-visible:outline-none
        ${
          active && !showLock
            ? 'bg-white/5 border border-violet-400/30 shadow-lg shadow-violet-500/10 scale-[1.05]'
            : showLock
              ? 'bg-white/[0.02] border border-slate-600/30 hover:border-slate-500/40'
              : 'bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-md hover:shadow-black/10 hover:scale-[1.02]'
        }
      `}
    >
      {/* Active glow — matches the exercise journey cards (violet/purple). */}
      <div
        className={`
          absolute inset-0 rounded-xl pointer-events-none
          bg-gradient-to-b from-violet-500/20 via-purple-500/10 to-transparent
          transition-opacity duration-300
          ${active && !showLock ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Status icon — w-8 container to match the exercise cards. The icon stays
          the SAME whether the card is active or not (just recoloured violet when
          active); only the locked state swaps to a lock. */}
      <div className="relative flex items-center justify-center w-8 h-8">
        {showLock ? (
          <Lock className="w-4 h-4 text-slate-500" />
        ) : (
          <IdleIcon
            className={`w-5 h-5 ${
              active
                ? 'text-violet-300'
                : 'text-slate-400 group-hover:text-slate-300'
            }`}
          />
        )}
      </div>

      {/* Label — fixed two-line box so a short label ("Bass A") reserves the
          same height as a wrapping one ("B + Fill 1"), keeping every card (and
          every line group) the SAME height. */}
      <span
        className={`
          flex h-[26px] items-center justify-center text-center
          text-[11px] font-bold leading-[13px]
          ${
            active && !showLock
              ? 'text-violet-300'
              : showLock
                ? 'text-slate-500'
                : 'text-slate-400 group-hover:text-slate-300'
          }
        `}
      >
        {label}
      </span>

      {/* Bottom accent bar — mirrors the exercise card's difficulty bar (violet
          when active, neutral when idle, dimmed when locked). Gives the card the
          same vertical anatomy / height as the exercise journey cells. */}
      <div
        className={`mt-0.5 h-0.5 w-6 rounded-full transition-colors duration-300 ${
          showLock
            ? 'bg-slate-600/30'
            : active
              ? 'bg-violet-400 shadow-sm shadow-violet-400/40'
              : 'bg-slate-500/50 group-hover:bg-slate-400/60'
        }`}
      />
    </button>
  );
}

/** One bassline + its own fills. The line cell, then its fill cells. */
function LineGroupRow({
  group,
  activeLineId,
  activeFillId,
  locked,
  onSelect,
}: {
  group: LineGroup;
  activeLineId: string;
  activeFillId: string;
  locked: boolean;
  onSelect: (lineId: string, fillId: string) => void;
}) {
  const lineActive = activeLineId === group.id;
  // The built-in Bass A with no fill is the free baseline → never locks.
  const linePremium = group.id !== DEFAULT_LINE_ID;
  return (
    <div className="flex shrink-0 items-stretch gap-2">
      {/* The plain line (no fill) — always labelled by the bassline name, so the
          row needs no separate heading above it. */}
      <VariantCell
        label={group.label}
        active={lineActive && activeFillId === NO_FILL_ID}
        premium={linePremium}
        locked={locked}
        idleIcon="line"
        onClick={() => onSelect(group.id, NO_FILL_ID)}
      />
      {/* This line's own fills */}
      {group.fills.map((fill) => (
        <VariantCell
          key={fill.id}
          label={fill.label}
          active={lineActive && activeFillId === fill.id}
          premium
          locked={locked}
          idleIcon="fill"
          onClick={() => onSelect(group.id, fill.id)}
        />
      ))}
    </div>
  );
}

export function LinesAndFillsSection({
  groups,
  activeLineId,
  activeFillId,
  locked,
  onSelect,
}: LinesAndFillsSectionProps) {
  // Nothing beyond the built-in line to swap → render nothing (the parent also
  // guards on variant count).
  const hasContent =
    groups.length > 1 || groups.some((g) => g.fills.length > 0);
  if (!hasContent) return null;

  return (
    // Part of the groove-card frame (rendered in the shell's footer slot): a
    // top divider + card padding rather than a standalone panel, so it reads as
    // a section OF the card, not a separate box below it.
    <div className="border-t border-white/10 px-4 pb-4 pt-3">
      {locked && (
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-300/80">
            Members
          </span>
        </div>
      )}
      {/* One horizontal row: each line + its fills, divided by a vertical rule.
          Scrolls sideways if it overflows the card width. The `px-1`/`py-1`
          gutter gives the SELECTED card (which scales to 1.05) room to grow
          without its left/top edge being clipped by `overflow-x-auto`. */}
      <div className="flex items-stretch gap-3 overflow-x-auto px-1 py-1">
        {groups.map((group, i) => (
          <div key={group.id} className="flex shrink-0 items-stretch gap-3">
            {i > 0 && <div className="w-px self-stretch bg-white/10" />}
            <LineGroupRow
              group={group}
              activeLineId={activeLineId}
              activeFillId={activeFillId}
              locked={locked}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
