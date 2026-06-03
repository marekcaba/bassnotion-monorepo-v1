'use client';

/**
 * DrillSummaryScreen — the end-of-session recap. Shown once every drill brick
 * is complete. Reads each brick's completion payload (DrillCompletionData,
 * surfaced by Task 7) to show the outcome: conquered (with tier), completed
 * (met a time/loops/manual goal), or laid (advanced via the release valve).
 *
 * Pure presentational: the page resolves the brick list + per-brick result and
 * passes them in.
 */

import { Disc3, Timer, Trophy } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import type { DrillCompletionData } from '@bassnotion/contracts';
import type { DrillBrick } from '@/domains/drill/utils/drillBricks';

/** A brick paired with how it ended (null payload = completed, no detail). */
export interface DrillSummaryItem {
  brick: DrillBrick;
  result: DrillCompletionData | null;
}

interface DrillSummaryScreenProps {
  title?: string;
  items: DrillSummaryItem[];
  /** Run the same drill again (→ back to the plan). */
  onRestart: () => void;
  /** Leave the drill (e.g. back to /app). */
  onDone: () => void;
}

const TIER_LABEL: Record<string, string> = {
  bronze: '🥉 Bronze',
  silver: '🥈 Silver',
  gold: '🥇 Gold',
};

/** A short outcome chip + colour for one brick's result. */
function outcome(result: DrillCompletionData | null): {
  label: string;
  className: string;
} {
  const r = result?.result;
  if (r === 'conquered') {
    const tier = result?.achievedTier
      ? TIER_LABEL[result.achievedTier]
      : 'Conquered';
    return {
      label: tier ?? 'Conquered',
      className: 'bg-[#cd7f4d] text-black',
    };
  }
  if (r === 'released') {
    return {
      label: '↓ Laid',
      className: 'bg-white/10 text-white/60',
    };
  }
  // 'completed' or unknown → a plain win.
  return { label: '✓ Done', className: 'bg-[#E8A44A]/15 text-[#E8A44A]' };
}

export function DrillSummaryScreen({
  title,
  items,
  onRestart,
  onDone,
}: DrillSummaryScreenProps) {
  const conquered = items.filter(
    (i) => i.result?.result === 'conquered',
  ).length;
  const laid = items.filter((i) => i.result?.result === 'released').length;
  const done = items.length - conquered - laid;

  // A small headline tuned to how the session went.
  const headline =
    conquered === items.length && items.length > 0
      ? 'Clean sweep.'
      : conquered > 0
        ? 'Reps that count.'
        : 'Bricks laid.';

  const tally = [
    conquered > 0 ? `${conquered} conquered` : null,
    done > 0 ? `${done} done` : null,
    laid > 0 ? `${laid} laid` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-white/5 bg-[#100E0D] p-8 text-white">
        <header className="space-y-2 text-center">
          <div className="relative mx-auto grid h-14 w-14 place-items-center">
            <div className="absolute h-14 w-14 rounded-full bg-[#cd7f4d]/20" />
            <Trophy className="relative h-7 w-7 text-[#E8A44A]" />
          </div>
          <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
            Session complete
          </p>
          <h1 className="text-2xl font-semibold">{headline}</h1>
          {title && <p className="text-sm text-white/40">{title}</p>}
          {tally && <p className="text-sm text-white/60">{tally}</p>}
        </header>

        <ul className="space-y-2">
          {items.map(({ brick, result }) => {
            const o = outcome(result);
            return (
              <li
                key={brick.id}
                className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
              >
                {brick.kind === 'task' ? (
                  <Timer className="h-5 w-5 shrink-0 text-white/40" />
                ) : (
                  <Disc3 className="h-5 w-5 shrink-0 text-white/40" />
                )}
                <p className="min-w-0 flex-1 truncate font-medium">
                  {brick.title}
                </p>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${o.className}`}
                >
                  {o.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onRestart}
            className="flex-1 text-white"
          >
            Run it again
          </Button>
          <Button onClick={onDone} className="flex-1 text-white">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
