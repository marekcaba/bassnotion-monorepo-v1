'use client';

/**
 * LinesAndFillsSection — the premium alternate-bassline swap row ("Lines &
 * Fills"). Renders under the groove card: a "Default" cell + one cell per
 * BasslineVariant. Clicking a cell swaps the active bassline (the parent's
 * `onSelect` drives `playback.setBassVariant` at the next loop seam).
 *
 * Gate (decided by the parent, passed as `locked`):
 *  - entitled member → cells are live; the active one is highlighted (amber).
 *  - locked (free / not-entitled) → cells show a lock; clicking fires the
 *    upgrade moment (the parent routes to the upsell popover or the funnel
 *    Sign-up reveal). The whole section still renders so the feature is
 *    DISCOVERABLE — the wall is the pitch, same as Dynamic Loop.
 *
 * Visual language mirrors the exercise journey cells (rounded card, label,
 * selected ring) so the card feels of-a-piece. The active cell gets an amber
 * glow (vs the exercises' violet) to read as "playing now".
 */

import { Lock, Music } from 'lucide-react';
import type { BasslineVariant } from '@bassnotion/contracts';

export interface LinesAndFillsSectionProps {
  /** The groove's premium bassline variants (from stems.bassVariants). */
  variants: BasslineVariant[];
  /** The currently active variant id, or null for the default bass. */
  activeVariantId: string | null;
  /** True when the feature is gated (free / not entitled). Cells show locked
   *  and clicks route to the upsell instead of swapping. */
  locked: boolean;
  /** Select a variant (id) or the default bass (null). The parent gates this:
   *  when `locked`, it fires the upgrade moment instead of swapping. */
  onSelect: (variantId: string | null) => void;
}

interface CellProps {
  label: string;
  active: boolean;
  locked: boolean;
  onClick: () => void;
}

function VariantCell({ label, active, locked, onClick }: CellProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={locked ? 'Swap basslines — a member move' : label}
      className={`
        relative flex flex-col items-center justify-center gap-1.5
        w-[88px] shrink-0 px-3 py-3 rounded-xl
        transition-all duration-300 ease-out group
        ${
          active && !locked
            ? 'bg-amber-400/10 border border-amber-400/40 shadow-lg shadow-amber-500/10 scale-[1.05]'
            : locked
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
          ${active && !locked ? 'opacity-100' : 'opacity-0'}
        `}
      />

      {/* Icon */}
      <div className="relative flex items-center justify-center w-7 h-7">
        {locked ? (
          <Lock className="w-4 h-4 text-slate-500" />
        ) : active ? (
          <div className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
        ) : (
          <Music className="w-4 h-4 text-slate-400 group-hover:text-slate-300" />
        )}
      </div>

      {/* Label */}
      <span
        className={`
          text-[11px] font-semibold leading-none text-center
          ${
            active && !locked
              ? 'text-amber-200'
              : locked
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

export function LinesAndFillsSection({
  variants,
  activeVariantId,
  locked,
  onSelect,
}: LinesAndFillsSectionProps) {
  if (variants.length === 0) return null;

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
        Swap the bassline mid-groove — drums &amp; harmony keep playing.
      </p>

      <div className="flex flex-wrap items-stretch gap-2">
        {/* Default bass — always the first option, selected when no variant. */}
        <VariantCell
          label="Default"
          active={activeVariantId === null}
          locked={false}
          onClick={() => onSelect(null)}
        />

        {variants.map((v) => (
          <VariantCell
            key={v.id}
            label={v.title}
            active={activeVariantId === v.id}
            locked={locked}
            onClick={() => onSelect(v.id)}
          />
        ))}
      </div>
    </div>
  );
}
