'use client';

import React from 'react';
import type {
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
  TopicProgress,
  EnrollableGoal,
} from '@bassnotion/contracts';
import Link from 'next/link';
import { TutorialPageSkeleton } from '@/domains/widgets/components/YouTubeWidgetPage/TutorialPageSkeleton';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { DrillSessionFrame } from '@/domains/drill/components/DrillSessionFrame';
import { useGymSession } from '@/domains/training-engine/hooks/useGymSession';
import { useRepResultSync } from '@/domains/training-engine/hooks/useRepResultSync';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useStreak } from '@/domains/drill/hooks/useStreak';

/**
 * Scoped keyframes for the gym's one-shot staggered entrance (CSS-only — no
 * motion lib). `gym-rise` fades+lifts; `gym-dN` stagger the masthead → path →
 * drill → options. Respects prefers-reduced-motion.
 */
function GymStyles() {
  return (
    <style jsx global>{`
      @keyframes gymRise {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      .gym-rise {
        animation: gymRise 0.55s cubic-bezier(0.2, 0.7, 0.2, 1) both;
      }
      .gym-d1 {
        animation-delay: 0.04s;
      }
      .gym-d2 {
        animation-delay: 0.12s;
      }
      .gym-d3 {
        animation-delay: 0.2s;
      }
      .gym-d4 {
        animation-delay: 0.28s;
      }
      @media (prefers-reduced-motion: reduce) {
        .gym-rise {
          animation: none;
        }
      }
    `}</style>
  );
}

/**
 * Per-level skill colors — the SAME palette as the /app SessionCard tags
 * (NodeMatrix LEVEL_COLORS). Each gym topic is colored by its current stage
 * level, so the path reads with the app's colorful skill-tag identity.
 */
const LEVEL_COLORS: Record<number, { base: string; glow: string }> = {
  1: { base: '#E8A44A', glow: 'rgba(232,164,74,0.25)' }, // orange
  2: { base: '#5B8DEF', glow: 'rgba(91,141,239,0.25)' }, // blue
  3: { base: '#6BCF8E', glow: 'rgba(107,207,142,0.25)' }, // green
  4: { base: '#C77DFF', glow: 'rgba(199,125,255,0.25)' }, // purple
  5: { base: '#FF7EB3', glow: 'rgba(255,126,179,0.25)' }, // pink
};
function colorForLevel(level: number): { base: string; glow: string } {
  return LEVEL_COLORS[Math.min(Math.max(1, level), 5)] ?? LEVEL_COLORS[1];
}

/**
 * /app/gym — the daily-rep entry point (Bass Gym Training Engine, Phase 3).
 *
 * Flow: useGymSession lists/enrolls + plans today's rep → returns the reserved
 * virtual-tutorial slug → useTutorialExercises loads that minted tutorial →
 * DrillSessionFrame runs it (plan → run → summary), exactly like an authored
 * drill. The engine's bricks ride the existing, untouched executor (spec §7a).
 *
 * Auth-gated by the /app layout's AuthGuard (inherited — no extra guard here).
 */
/**
 * One-time placement step (spec §5): the player sets the tempo they can play
 * cleanly today; the climb starts there. Dark theme to match the app shell.
 */
function GymPlacement({
  onStart,
}: {
  onStart: (startTempoBpm: number) => void;
}) {
  const [tempo, setTempo] = React.useState(80);
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
      <GymStyles />
      <div className="gym-rise gym-d1 relative w-full max-w-md overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318] text-center">
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />
        <div className="space-y-6 p-8">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
            Find your start
          </p>
          <h1 className="font-serif text-[26px] leading-tight text-[#E8E4DD]">
            What tempo can you play clean?
          </h1>
          <p className="text-sm leading-relaxed text-[#8A8690]">
            Push it to the fastest you can hold relaxed and clean. The coach
            brackets each day’s rep around this — you can always ease off.
          </p>
          <div className="space-y-3">
            <div className="font-mono text-6xl tabular-nums leading-none text-[#E8A44A] [text-shadow:0_0_28px_rgba(232,164,74,0.35)]">
              {tempo}
              <span className="ml-1 align-top text-lg text-[#8A8690]">BPM</span>
            </div>
            <input
              type="range"
              min={50}
              max={180}
              step={2}
              value={tempo}
              onChange={(e) => setTempo(Number(e.target.value))}
              className="w-full accent-[#E8A44A]"
            />
            <div className="flex justify-between font-mono text-[10px] tracking-widest text-[#8A8690]/60">
              <span>50</span>
              <span>180</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onStart(tempo)}
            className="w-full rounded-[9px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-4 py-3 text-sm font-semibold text-[#0C0B0F] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(232,164,74,0.3)]"
          >
            Start at {tempo} BPM
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Goal picker — "set up your goal for the month". The first step for a member
 * with no active enrollment: choose which goal to climb this period. Each card
 * shows the goal's pitch + a content summary (topics · reps, or target BPM).
 * Picking advances to tempo placement, which enrolls in the chosen goal.
 */
function GymGoalPicker({
  goals,
  onChoose,
}: {
  goals: EnrollableGoal[];
  onChoose: (slug: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-10 md:py-12">
      <GymStyles />
      <div className="gym-rise gym-d1 mb-6">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
          Set up your month
        </p>
        <h1 className="mt-1.5 font-serif text-[28px] leading-tight text-[#E8E4DD]">
          Choose your goal
        </h1>
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-[#8A8690]">
          Pick what you’ll climb this month. The coach builds your daily rep
          around it.
        </p>
      </div>

      {goals.length === 0 ? (
        <p className="gym-rise gym-d2 rounded-[14px] border border-white/[0.06] bg-[#141318] p-8 text-center text-sm text-[#8A8690]">
          No goals are available yet. Check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((g, i) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => onChoose(g.slug)}
              className="gym-rise group relative block w-full overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318] p-[22px] text-left transition-all hover:-translate-y-0.5 hover:border-[#E8A44A]/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              style={{ animationDelay: `${0.1 + i * 0.07}s` }}
            >
              <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-0 transition-opacity group-hover:opacity-40" />
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-serif text-[20px] leading-tight text-[#E8E4DD] transition-colors group-hover:text-[#E8A44A]">
                  {g.title}
                </h2>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[1px] text-[#5A5660]">
                  {g.topicCount > 0
                    ? `${g.topicCount} topics · ${g.totalQuota} reps`
                    : g.targetTempoBpm
                      ? `${g.targetTempoBpm} BPM`
                      : g.type}
                </span>
              </div>
              {g.description && (
                <p className="mt-2 text-sm leading-[1.45] text-[#8A8690]">
                  {g.description}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The membership wall — the gym is part of the monthly membership product, so a
 * non-member sees this instead of the gym (the backend enforces it too; this is
 * the friendly front door, not the only gate). Goal = your goal for the month;
 * it's bound to the membership period. Links to /pricing to join.
 */
function GymMembershipWall() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center px-4">
      <GymStyles />
      <div className="gym-rise gym-d1 relative w-full max-w-md overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318] text-center">
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />
        <div className="space-y-5 p-8">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
            The Bass Gym
          </p>
          <h1 className="font-serif text-[26px] leading-tight text-[#E8E4DD]">
            Your goal for the month lives in the membership
          </h1>
          <p className="text-sm leading-relaxed text-[#8A8690]">
            Membership gives you a coach-built daily rep — a 6-minute goal that
            climbs with you for the month, then resets fresh.
          </p>
          <Link
            href="/pricing"
            className="inline-flex w-full items-center justify-center rounded-[9px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-4 py-3 text-sm font-semibold text-[#0C0B0F] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(232,164,74,0.3)]"
          >
            See membership
          </Link>
        </div>
      </div>
    </div>
  );
}


/**
 * The content-ladder PATH (epic §3 Build B) — the ~3-4 TOPIC quota meters the
 * student fills toward the goal. One row per topic ("Hold the Engine 3/12"); the
 * goal is done when every row is full. Internal "stages" are NEVER surfaced —
 * the student only sees the quota fill (founder decision §4: the future depends
 * on their pace, so we show present state, not a future timeline). Rendered as
 * CONTEXT below the drill hero; absent on single-focal SPEED goals
 * (topicProgress is null).
 *
 * Viz: a horizontal row of DOTS — one bold dot per rep, filled left→right.
 * Filled = solid amber; empty = dark disc. The dots size down as the quota grows
 * (a flex row, capped diameter) so 4–12 reps all sit on one line and topics line
 * up. A done topic's title + count go amber with a check.
 */

/** A single topic's quota as a row of dots — one per rep, filling left→right.
 *  Filled = solid amber; empty = dark disc. Flex row with a capped dot size so a
 *  quota of 4 shows fat dots and 12 shows smaller ones, both on one line.
 *  Staggered fill, left to right. */
function QuotaMeter({
  logged,
  quota,
  color,
}: {
  logged: number;
  quota: number;
  /** The topic's skill color (filled dots + glow). */
  color: { base: string; glow: string };
}) {
  const filled = Math.min(logged, quota);
  const n = Math.max(1, quota);
  return (
    <div className="flex w-full items-center gap-[clamp(3px,1.5%,7px)]" aria-hidden>
      {Array.from({ length: n }).map((_, i) => {
        const isOn = i < filled;
        return (
          <span
            key={i}
            className="aspect-square min-w-0 flex-1 rounded-full transition-all duration-500"
            style={{
              transitionDelay: `${i * 45}ms`,
              maxWidth: 16,
              background: isOn ? color.base : 'rgba(255,255,255,0.06)',
              boxShadow: isOn ? `0 0 6px ${color.glow}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/** The path — a clean list of per-topic quota meters with a leading status dot,
 *  topic title, and an NN/NN mono count. NO card chrome of its own (it nests
 *  inside the console card, divided from the drill above by a hairline). */
function GymTopicProgress({ topics }: { topics: TopicProgress[] }) {
  const done = topics.filter((t) => t.isComplete).length;
  const allDone = done === topics.length && topics.length > 0;

  return (
    <div className="px-[22px] pb-[22px] pt-[18px]">
      {/* Section header: micro-label + a tiny "N/N topics" readout, mirroring
          the SessionCard label vocabulary. */}
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
          {allDone ? 'Goal — complete' : 'Your path'}
        </p>
        <p className="font-mono text-[10px] tabular-nums tracking-[1px] text-[#5A5660]">
          <span className={allDone ? 'text-[#E8A44A]' : 'text-[#8A8690]'}>
            {done}
          </span>
          <span> / {topics.length} topics</span>
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {topics.map((t, i) => {
          const shown = Math.min(t.repsLogged, t.repQuota);
          // Each topic gets a DISTINCT skill color by its position (the /app
          // SessionCard palette), so the 3–4 topics are always visually distinct
          // — like the home tags — not all the same (they'd share stage-1 color).
          const c = colorForLevel(i + 1);
          return (
            <div key={t.topicId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  {/* Colored tag pill — the SessionCard tag treatment, tinted to
                      the topic's skill color. */}
                  <span
                    className="shrink-0 rounded-full border px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.5px]"
                    style={{
                      color: c.base,
                      borderColor: c.glow,
                      background: `${c.base}14`,
                    }}
                    title={t.title}
                  >
                    {t.title}
                  </span>
                  {t.isComplete && (
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3 shrink-0 fill-none stroke-[3]"
                      style={{ stroke: c.base }}
                      aria-hidden
                    >
                      <polyline points="4,12 10,18 20,6" />
                    </svg>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums">
                  {/* P0.3: single-digit-min (3/10), not 00/10 — leading zeros
                      read as a clock/glitch. */}
                  <span style={{ color: t.isComplete ? c.base : '#E8E4DD' }}>
                    {shown}
                  </span>
                  <span className="text-[#5A5660]">/{t.repQuota}</span>
                </span>
              </div>
              <QuotaMeter
                logged={t.repsLogged}
                quota={t.repQuota}
                color={c}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = [
  'Sundays',
  'Mondays',
  'Tuesdays',
  'Wednesdays',
  'Thursdays',
  'Fridays',
  'Saturdays',
];

const TIER_MEDAL: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
};

/**
 * Day-30 month-in-review (Treadmill epic Story 6) — the journey recap shown at
 * graduation: level then→now, the practice pattern, reps/grooves conquered, the
 * streak. "Always a win." Rendered above the fork.
 */
function GymMonthInReview({ review }: { review: MonthInReview }) {
  const {
    startTempoBpm,
    currentTempoBpm,
    gainedBpm,
    daysPracticed,
    windowDays,
    practicedDays,
    strongestWeekday,
    totalReps,
    conqueredReps,
    grooves,
    streakDays,
    ceilingDays,
    freezeTokens,
  } = review;

  const practicedSet = new Set(practicedDays);

  return (
    <div className="mx-auto mb-4 w-full max-w-2xl space-y-5 rounded-2xl border border-white/10 bg-[#100E0D] p-6 text-white">
      <header className="text-center">
        <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
          Your month
        </p>
        <h2 className="mt-1 text-2xl font-semibold">
          {gainedBpm != null && gainedBpm > 0
            ? `You picked up ${gainedBpm} BPM.`
            : 'A month in the pocket.'}
        </h2>
      </header>

      {/* Stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Then → now"
          value={`${startTempoBpm ?? '—'} → ${currentTempoBpm ?? '—'}`}
          sub="BPM"
        />
        <Stat
          label="Showed up"
          value={`${daysPracticed} / ${windowDays}`}
          sub="days"
        />
        <Stat label="Reps" value={`${totalReps}`} sub={`${conqueredReps} conquered`} />
        <Stat
          label="Streak"
          value={`${streakDays}`}
          sub={`${ceilingDays} full-focus`}
        />
      </div>

      {/* Practice pattern: a 30-dot calendar + strongest weekday */}
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-white/40">
          Practice pattern
          {strongestWeekday != null && (
            <span className="ml-2 normal-case text-white/60">
              · strongest on {WEEKDAY_LABELS[strongestWeekday]}
            </span>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: windowDays }).map((_, i) => {
            // Oldest → newest, left to right. We don't have per-dot dates mapped
            // to slots, so colour by COUNT density: fill the first `daysPracticed`
            // dots. (A precise date-mapped calendar is a later polish.)
            const filled = i < daysPracticed;
            return (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-sm ${
                  filled ? 'bg-[#E8A44A]' : 'bg-white/10'
                }`}
                aria-hidden
              />
            );
          })}
        </div>
        {practicedSet.size > 0 && (
          <p className="text-[10px] text-white/30">
            {practicedSet.size} distinct days logged.
          </p>
        )}
      </div>

      {/* Grooves conquered */}
      {grooves.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wide text-white/40">
            Grooves conquered
          </p>
          <ul className="space-y-1.5">
            {grooves.map((g, i) => (
              <li
                key={`${g.title}-${i}`}
                className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm"
              >
                <span className="font-medium">{g.title}</span>
                <span className="text-white/60">
                  {g.bestTier ? TIER_MEDAL[g.bestTier] : ''}{' '}
                  {g.bestTier ?? '—'}
                  <span className="ml-2 text-white/30">
                    {g.conqueredReps}×
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {freezeTokens > 0 && (
        <p className="text-center text-xs text-sky-300/70">
          ❄️ {freezeTokens} freeze{freezeTokens === 1 ? '' : 's'} banked.
        </p>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg bg-white/5 px-3 py-2.5 text-center">
      <p className="text-[10px] uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-0.5 font-mono text-lg font-semibold text-[#E8A44A]">
        {value}
      </p>
      {sub && <p className="text-[10px] text-white/40">{sub}</p>}
    </div>
  );
}

/**
 * Day-30 graduation fork (spec §7) — surfaced ABOVE the rep, never blocking it.
 * "Reflects reality, always a win." Three doors auto-filled from the landing.
 */
function GymGraduation({
  graduation,
  onChoose,
}: {
  graduation: GraduationSummary;
  onChoose: (door: GraduationDoor) => void;
}) {
  const {
    startTempoBpm,
    currentTempoBpm,
    targetTempoBpm,
    daysPracticedInWindow,
    windowDays,
  } = graduation;
  const gained =
    typeof startTempoBpm === 'number' && typeof currentTempoBpm === 'number'
      ? currentTempoBpm - startTempoBpm
      : null;
  return (
    <div className="mx-auto mb-4 w-full max-w-2xl rounded-2xl border border-[#E8A44A]/30 bg-[#1a1512] p-5 text-white">
      <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
        30 days · graduation
      </p>
      <h2 className="mt-1 text-lg font-semibold">
        {gained != null && gained > 0
          ? `You picked up ${gained} BPM this month.`
          : 'A month in. Always a win.'}
      </h2>
      <p className="mt-1 text-sm text-white/50">
        Started {startTempoBpm ?? '—'} BPM → now {currentTempoBpm ?? '—'} BPM
        {typeof targetTempoBpm === 'number' && ` · target ${targetTempoBpm}`}.
        {typeof daysPracticedInWindow === 'number' &&
          typeof windowDays === 'number' &&
          ` You showed up ${daysPracticedInWindow} of ${windowDays} days.`}{' '}
        Where to from here?
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onChoose('go_deeper')}
          className="rounded-md bg-[#E8A44A] px-3 py-2 text-sm font-semibold text-black hover:bg-[#E8A44A]/90"
        >
          Go deeper ↑
        </button>
        <button
          type="button"
          onClick={() => onChoose('lock_it_in')}
          className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          Lock it in ✓
        </button>
        <button
          type="button"
          onClick={() => onChoose('switch_lanes')}
          className="rounded-md border border-white/15 px-3 py-2 text-sm text-white/80 hover:bg-white/5"
        >
          Switch lanes →
        </button>
      </div>
    </div>
  );
}

export default function GymPage() {
  // The gym is the monthly-membership product's entitlement. Gate on membership
  // BEFORE the session runs, so a non-member sees the wall and never auto-enrolls
  // (the backend enforces it too — this is the friendly front door).
  //
  // CRITICAL: also gate on auth readiness. Before auth resolves (isReady false),
  // useEntitlement's access query is disabled → it returns {tier:'free',
  // isLoading:false} — which would FLASH the membership wall to a logged-in
  // member/admin for a frame before their entitlement loads. Treat
  // "auth not ready" as still-resolving so we show the skeleton, never the wall.
  const { isReady: authReady } = useAuth();
  const { tier, isLoading: entitlementLoading } = useEntitlement();
  const isMember = tier === 'member';
  const gateResolving = !authReady || entitlementLoading;

  const {
    status,
    slug,
    bricks,
    enrollment,
    error,
    graduation,
    monthInReview,
    attendance,
    repMode,
    topicProgress,
    goalTitle,
    goals,
    chooseGoal,
    placeAndStart,
    chooseFloor,
    chooseDoor,
    refresh,
  } = useGymSession(undefined, { enabled: isMember });

  // Streak is the daily-return mechanic (P2.1) — real data, fetched directly.
  const { data: streak } = useStreak();

  // Hooks must run unconditionally — useTutorialExercises is enabled only when
  // a slug exists, so it idles until the rep is planned.
  const { tutorial, exercises, isLoading } = useTutorialExercises(slug);

  // Record a RepResult for each rep brick the player completes (the engine's
  // append-only history, sibling to the executor's own block completion).
  useRepResultSync({
    slug,
    enrollmentId: enrollment?.id ?? null,
    bricks,
  });

  const memoizedTutorial = React.useMemo(
    () => tutorial,
    [tutorial, tutorial?.id],
  );
  const memoizedExercises = React.useMemo(
    () => exercises,
    [exercises, exercises?.length, exercises?.[0]?.id],
  );

  // Membership gate. While auth + entitlement resolve, show the skeleton (never
  // flash the wall to a member, nor the gym to a non-member). Resolved +
  // non-member → the upsell wall.
  if (gateResolving) {
    return <TutorialPageSkeleton />;
  }
  if (!isMember) {
    return (
      <>
        <GymMembershipWall />
      </>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex items-center justify-center h-full min-h-[50vh]">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-white mb-2">
            Couldn&apos;t start your gym session
          </h2>
          <p className="text-zinc-400 mb-4">
            {error?.message ?? 'Something went wrong planning today’s rep.'}
          </p>
          <button
            type="button"
            onClick={refresh}
            className="rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (status === 'choosing') {
    return <GymGoalPicker goals={goals} onChoose={chooseGoal} />;
  }

  if (status === 'placement') {
    return <GymPlacement onStart={placeAndStart} />;
  }

  if (status === 'loading' || isLoading || !slug || !memoizedTutorial) {
    return <TutorialPageSkeleton />;
  }

  // Graduation owns the whole screen (recap + fork) — render it standalone.
  if (graduation) {
    return (
      <>
        <PageErrorBoundary pageName="Bass Gym">
          <div className="mx-auto w-full max-w-2xl p-4 md:p-6 lg:p-8">
            {monthInReview && <GymMonthInReview review={monthInReview} />}
            <GymGraduation graduation={graduation} onChoose={chooseDoor} />
          </div>
        </PageErrorBoundary>
      </>
    );
  }

  // The daily-rep view — built in the /app SessionCard/ProgressCard vocabulary:
  // #141318 card + top amber accent hairline, serif titles, mono #5A5660 micro-
  // labels, amber gradient CTA. The leather/gradient base is painted by the app
  // shell. HIERARCHY: the DRILL is the hero (the daily action) — it leads the
  // console card. The PATH (per-topic quota meters) + the attendance/goal RAIL
  // are context, sitting below the rep. Staggered one-shot entrance.
  const topicsDone = topicProgress?.filter((t) => t.isComplete).length ?? 0;
  const topicsTotal = topicProgress?.length ?? 0;

  // ── Coach-voice derived values (ALL from real data, nothing fabricated) ──
  // Reps banked is the HERO metric (founder decision): sum of reps logged across
  // topics, against the goal's total quota. The dot fill IS this, counting up.
  const repsBanked =
    topicProgress?.reduce((n, t) => n + Math.min(t.repsLogged, t.repQuota), 0) ??
    0;
  const repsTotal =
    topicProgress?.reduce((n, t) => n + t.repQuota, 0) ?? 0;
  const repsToGo = Math.max(0, repsTotal - repsBanked);
  const goalDone = repsTotal > 0 && repsBanked >= repsTotal;
  // The goal's name (real, frozen at enrollment) — fall back gracefully.
  const goalName = goalTitle?.trim() || 'Your goal';
  // Day N of the cycle, from attendance window vs. real reps banked. We don't
  // have a precise "day index", so frame by reps banked (the hero) — honest.
  const targetBpm =
    typeof enrollment?.goalSnapshot?.target?.tempoBpm === 'number'
      ? enrollment.goalSnapshot.target.tempoBpm
      : null;
  // Streak (real; may be undefined while loading).
  const streakDays = streak?.current ?? 0;
  const freezeTokens = streak?.freezeTokens ?? 0;

  return (
    <>
      <PageErrorBoundary pageName="Bass Gym">
        <GymStyles />
        {/* Center the dashboard in the main content area — vertically too, while
            still scrolling if the console is taller than the viewport. */}
        <div className="flex min-h-full w-full items-center justify-center">
          <div className="mx-auto w-full max-w-xl px-4 py-8 md:px-6 md:py-10 lg:py-12">
            {/* Coach masthead (P1.3 + P2.1): the named GOAL + a loud streak/
                freeze readout + a coach sentence — the "voice", not telemetry.
                The goal name is real (frozen snapshot); streak is real
                (useStreak). No fabricated BPM-yesterday line. */}
          <header className="gym-rise gym-d1 mb-5">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[10px] uppercase tracking-[2.5px] text-[#5A5660]">
                The Bass Gym
              </p>
              {/* Streak — loud, the daily-return mechanic. */}
              <div className="flex items-center gap-3 font-mono text-[11px]">
                {streakDays > 0 && (
                  <span className="text-[#E8E4DD]">
                    🔥 {streakDays}-day streak
                  </span>
                )}
                {freezeTokens > 0 && (
                  <span className="text-[#5B8DEF]" title="Streak freezes banked">
                    ❄️ {freezeTokens}
                  </span>
                )}
              </div>
            </div>
            <h1 className="mt-2 font-serif text-[26px] leading-tight text-[#E8E4DD] md:text-[30px]">
              {goalName}
            </h1>
            {/* One coach sentence from REAL state (no invented numbers). The
                target BPM is real (goal snapshot); reps banked is real. */}
            <p className="mt-1.5 text-sm leading-relaxed text-[#8A8690]">
              {goalDone
                ? 'Every rep banked — you finished the goal. Nice work.'
                : repsBanked === 0
                  ? repsTotal > 0
                    ? `${repsTotal} reps between you and this goal${
                        targetBpm ? ` at ${targetBpm} BPM` : ''
                      }. Let's bank the first one.`
                    : 'Your daily rep is ready. Let’s bank the first one.'
                  : `${repsBanked} ${repsBanked === 1 ? 'rep' : 'reps'} in the bank${
                      repsToGo > 0 ? ` · ${repsToGo} to go` : ''
                    }${targetBpm ? `, aiming for ${targetBpm} BPM` : ''}. Today's rep keeps the momentum.`}
            </p>
          </header>

          {/* THE HERO — one console card in the SessionCard vocabulary: #141318
              surface, top amber accent hairline. The drill (bare DrillSessionFrame)
              leads; the path is divided below it by a hairline. */}
          <div className="gym-rise gym-d2 relative mb-4 overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318]">
            {/* Top accent line — the SessionCard signature. */}
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />

            {/* Drill — bare (no card chrome of its own). It brings its own
                "Today's drill" micro-label, serif title, brick list, and the
                amber CTA. This is the primary action. The floor toggle sits
                directly UNDER the main CTA, dimmed + subordinate. */}
            <div className="p-[22px]">
              <DrillSessionFrame
                tutorial={memoizedTutorial}
                tutorialSlug={slug}
                exercises={memoizedExercises ?? []}
                isFloor={repMode === 'floor'}
                inline
                bare
              />
              {/* Secondary CTA — dimmed, clearly beneath "Start the drill". */}
              <button
                type="button"
                onClick={repMode === 'floor' ? refresh : chooseFloor}
                className="mt-2.5 w-full rounded-[9px] border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-xs text-[#8A8690] transition-colors hover:border-white/10 hover:bg-white/[0.04] hover:text-[#E8E4DD]"
              >
                {repMode === 'floor'
                  ? 'Do the full rep instead'
                  : 'Short on time? Do the 3-minute version — streak stays safe'}
              </button>
            </div>

            {/* Path (content-ladder topics) — quota meters as CONTEXT below the
                rep. Absent on single-focal SPEED goals. */}
            {topicProgress && topicProgress.length > 0 && (
              <>
                <div className="border-t border-white/[0.06]" />
                <GymTopicProgress topics={topicProgress} />
              </>
            )}
          </div>

          {/* Readout rail — the SessionCard stat-tile token. HERO = reps banked
              (founder decision), framed counting UP toward the goal. Days-shown-
              up + topics are secondary. Each tile renders only with real data. */}
          {(repsTotal > 0 || attendance || topicsTotal > 0) && (
            <div className="gym-rise gym-d3 mb-4 grid grid-cols-3 gap-2.5">
              {repsTotal > 0 && (
                <div className="col-span-3 rounded-lg border border-[#E8A44A]/20 bg-[#E8A44A]/[0.04] px-3 py-3.5 text-center sm:col-span-1">
                  <div className="font-mono text-2xl font-light leading-none tabular-nums text-[#E8A44A]">
                    {repsBanked}
                    <span className="text-base text-[#5A5660]">
                      /{repsTotal}
                    </span>
                  </div>
                  <div className="mt-1 font-mono text-[9px] uppercase tracking-[1px] text-[#8A8690]">
                    Reps banked
                  </div>
                </div>
              )}
              {attendance && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-3 text-center">
                  <div className="font-mono text-lg font-medium tabular-nums text-[#E8E4DD]">
                    {attendance.daysPracticed}
                    <span className="text-[#5A5660]">
                      /{attendance.windowDays}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#5A5660]">
                    Days shown up
                  </div>
                </div>
              )}
              {topicsTotal > 0 && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-3 text-center">
                  <div className="font-mono text-lg font-medium tabular-nums">
                    <span
                      className={
                        topicsDone === topicsTotal
                          ? 'text-[#E8A44A]'
                          : 'text-[#E8E4DD]'
                      }
                    >
                      {topicsDone}
                    </span>
                    <span className="text-[#5A5660]">/{topicsTotal}</span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#5A5660]">
                    Topics done
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </PageErrorBoundary>
    </>
  );
}
