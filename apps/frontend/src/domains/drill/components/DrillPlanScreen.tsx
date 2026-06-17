'use client';

/**
 * DrillPlanScreen — the opening "what's in today's drill" gate. Shown FIRST for
 * a drill tutorial; the bricks render only after the student taps Start. Lists
 * each brick with its goal ("Practice 5 min" / "Play 4×" / "Clean pass") so the
 * student knows the shape of the session before committing.
 *
 * Pure presentational: the page owns the phase (useDrillSession) and passes the
 * brick list + onStart.
 */

import { Disc3, Timer, Play } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  describeCriterion,
  type DrillBrick,
} from '@/domains/drill/utils/drillBricks';

interface DrillPlanScreenProps {
  /** Drill title (the tutorial title), e.g. "Today's drill". */
  title?: string;
  bricks: DrillBrick[];
  onStart: () => void;
  /** Inline mode: drop the full-height self-centering (min-h-[70vh] + center)
   *  so the card flows in a parent column (the gym stacks a status strip above
   *  it). Default false keeps the standalone drill-tutorial behavior. */
  inline?: boolean;
}

/** Rough total minutes, summing each brick's time target / timebox. */
function estimateMinutes(bricks: DrillBrick[]): number {
  return bricks.reduce((sum, b) => {
    if (b.criterion?.type === 'time' && b.criterion.target) {
      return sum + b.criterion.target;
    }
    return sum + (b.timeboxMinutes ?? 0);
  }, 0);
}

export function DrillPlanScreen({
  title,
  bricks,
  onStart,
  inline = false,
}: DrillPlanScreenProps) {
  const minutes = estimateMinutes(bricks);

  return (
    <div
      className={
        inline
          ? 'flex w-full justify-center px-4'
          : 'flex min-h-[70vh] w-full items-center justify-center px-4 py-10'
      }
    >
      <div className="w-full max-w-lg space-y-6 rounded-2xl border border-white/5 bg-[#100E0D] p-8 text-white">
        <header className="space-y-1 text-center">
          <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
            Today&apos;s drill
          </p>
          <h1 className="text-2xl font-semibold">
            {title || 'Practice session'}
          </h1>
          <p className="text-sm text-white/50">
            {bricks.length} {bricks.length === 1 ? 'brick' : 'bricks'}
            {minutes > 0 ? ` · ~${minutes} min` : ''}
          </p>
        </header>

        <ol className="space-y-2">
          {bricks.map((brick, i) => (
            <li
              key={brick.id}
              className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-3"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/5 font-mono text-sm text-white/60">
                {i + 1}
              </span>
              {brick.kind === 'task' ? (
                <Timer className="h-5 w-5 shrink-0 text-white/40" />
              ) : (
                <Disc3 className="h-5 w-5 shrink-0 text-white/40" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{brick.title}</p>
                {brick.subtitle && (
                  <p className="truncate text-xs text-white/40">
                    {brick.subtitle}
                  </p>
                )}
              </div>
              <span className="shrink-0 rounded-full bg-[#E8A44A]/10 px-2.5 py-1 text-xs text-[#E8A44A]">
                {describeCriterion(brick.criterion)}
              </span>
            </li>
          ))}
        </ol>

        <Button onClick={onStart} className="w-full text-white" size="lg">
          <Play className="mr-1.5 h-4 w-4" /> Start the drill
        </Button>
      </div>
    </div>
  );
}
