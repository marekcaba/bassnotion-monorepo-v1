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

/** The gym's front-door copy (the centered "Six minutes." invitation). When
 *  present, DrillPlanScreen renders the front-door layout instead of the brick
 *  list: a quiet eyebrow, a giant serif headline, a coach line, the big amber
 *  CTA, a dimension caption, and (optional) a dimmed floor link beneath. The
 *  brick breakdown is intentionally HIDDEN — opening the gym shows only the
 *  rep, as loud as it can be (founder direction). */
export interface FrontDoor {
  /** Small mono eyebrow above the headline, e.g. "TODAY · STRING CROSSING". */
  eyebrow: string;
  /** The giant serif headline, e.g. "Six minutes." */
  headline: string;
  /** One coach sentence below the headline (italic). */
  coachLine?: string;
  /** Mono caption under the CTA, e.g. "2 + 2 + 2 MIN". */
  caption?: string;
  /** Optional dimmed floor link under the CTA (the 3-minute version). */
  floor?: { label: string; onClick: () => void };
}

interface DrillPlanScreenProps {
  /** Drill title (the tutorial title), e.g. "Today's drill". */
  title?: string;
  bricks: DrillBrick[];
  onStart: () => void;
  /** Inline mode: drop the full-height self-centering (min-h-[70vh] + center)
   *  so the card flows in a parent column (the gym stacks a status strip above
   *  it). Default false keeps the standalone drill-tutorial behavior. */
  inline?: boolean;
  /** Bare mode: drop this component's OWN card chrome (border/bg/rounded/padding)
   *  so it nests inside a parent panel — the gym merges stats + path + drill into
   *  one console card. Implies inline. Default false. */
  bare?: boolean;
  /** Front-door mode (the gym): render the centered "Six minutes." invitation
   *  (no brick list) instead of the plan card. Implies bare + inline. */
  frontDoor?: FrontDoor;
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
  bare = false,
  frontDoor,
}: DrillPlanScreenProps) {
  const minutes = estimateMinutes(bricks);

  // FRONT DOOR (the gym) — the rep, alone, as loud as it can be. Eyebrow +
  // giant serif headline + coach line + the big amber CTA + a dimension caption,
  // with an optional dimmed floor link. No brick breakdown (that lived in the
  // old plan card; the front door hides it — founder direction).
  if (frontDoor) {
    return (
      <div className="flex w-full flex-col items-center text-center">
        <p className="mb-4 font-mono text-[11px] uppercase tracking-[3px] text-[#7d786d]">
          {frontDoor.eyebrow}
        </p>
        <h1 className="mb-5 font-serif text-[clamp(38px,9vw,56px)] font-normal leading-none text-[#f5f2ea]">
          {frontDoor.headline}
        </h1>
        {frontDoor.coachLine && (
          <p className="mb-11 max-w-[26rem] text-[16px] italic leading-relaxed text-[#9a9488]">
            {frontDoor.coachLine}
          </p>
        )}
        <button
          type="button"
          onClick={onStart}
          className="flex w-full max-w-[26rem] items-center justify-center gap-3 rounded-[14px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-6 py-6 text-[20px] font-semibold text-[#3a2606] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_40px_rgba(232,164,74,0.35)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-white"
        >
          <Play className="size-5" fill="currentColor" />
          Start today&apos;s rep
        </button>
        {frontDoor.caption && (
          <p className="mt-4 max-w-[26rem] text-balance font-mono text-[11px] uppercase leading-relaxed tracking-[1.5px] text-[#605b52]">
            {frontDoor.caption}
          </p>
        )}
        {/* Secondary CTA — the 3-minute floor. A full-width button like the
            primary, but dimmed + outlined so it clearly sits beneath it. */}
        {frontDoor.floor && (
          <button
            type="button"
            onClick={frontDoor.floor.onClick}
            className="mt-3 w-full max-w-[26rem] rounded-[14px] border border-white/[0.07] bg-white/[0.02] px-6 py-3.5 text-sm text-[#7d786d] transition-colors hover:border-white/[0.12] hover:bg-white/[0.04] hover:text-[#9a9488]"
          >
            {frontDoor.floor.label}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={
        bare
          ? 'w-full text-white'
          : inline
            ? 'flex w-full justify-center px-4'
            : 'flex min-h-[70vh] w-full items-center justify-center px-4 py-10'
      }
    >
      <div
        className={
          bare
            ? 'w-full space-y-6 text-white'
            : 'w-full max-w-lg space-y-6 rounded-2xl border border-white/5 bg-[#100E0D] p-8 text-white'
        }
      >
        {bare ? (
          // Embedded in the gym console — match the /app SessionCard vocabulary
          // (left-aligned, mono micro-label, serif title, muted #5A5660 meta).
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
                Today&apos;s rep
              </p>
              <h2 className="font-serif text-[22px] leading-tight text-[#E8E4DD]">
                {title || "Today's rep"}
              </h2>
              {/* Value line, not an internal count (P1.4). No "bricks". */}
              <p className="mt-0.5 font-mono text-[11px] text-[#5A5660]">
                {minutes > 0 ? `~${minutes} min` : 'A few minutes'} · focused
                practice
              </p>
            </div>
          </header>
        ) : (
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
        )}

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

        {bare ? (
          // The amber gradient CTA from the /app SessionCard — solid amber,
          // near-black text, hover lift + glow.
          <button
            type="button"
            onClick={onStart}
            className="flex w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-4 py-3 text-sm font-semibold text-[#0C0B0F] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(232,164,74,0.3)]"
          >
            <Play className="size-4" fill="currentColor" />
            Start today&apos;s rep
          </button>
        ) : (
          <Button onClick={onStart} className="w-full text-white" size="lg">
            <Play className="mr-1.5 h-4 w-4" /> Start the drill
          </Button>
        )}
      </div>
    </div>
  );
}
