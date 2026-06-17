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
      <div className="gym-rise gym-d1 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.01] text-center">
        <div className="space-y-6 p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#E8A44A]">
            Find your start
          </p>
          <h1 className="font-heading text-4xl uppercase leading-[0.95] tracking-[0.02em] text-[#E8E4DD]">
            What tempo can you play{' '}
            <span className="text-[#E8A44A]">clean?</span>
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
            className="w-full rounded-lg bg-[#E8A44A] px-4 py-3 font-heading text-base uppercase tracking-[0.1em] text-black transition-all hover:bg-[#f0b35e] hover:shadow-[0_0_24px_rgba(232,164,74,0.35)]"
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
      <div className="gym-rise gym-d1 mb-7 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#E8A44A]">
          Set up your month
        </p>
        <h1 className="mt-1 font-heading text-5xl uppercase leading-[0.92] tracking-[0.02em] text-[#E8E4DD]">
          Choose your <span className="text-[#E8A44A]">goal</span>
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-[#8A8690]">
          Pick what you’ll climb this month. The coach builds your daily rep
          around it.
        </p>
      </div>

      {goals.length === 0 ? (
        <p className="gym-rise gym-d2 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-8 text-center text-sm text-[#8A8690]">
          No goals are available yet. Check back soon.
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((g, i) => (
            <button
              key={g.slug}
              type="button"
              onClick={() => onChoose(g.slug)}
              className="gym-rise group block w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#E8A44A]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
              style={{ animationDelay: `${0.1 + i * 0.07}s` }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-heading text-2xl uppercase leading-none tracking-[0.03em] text-[#E8E4DD] transition-colors group-hover:text-[#E8A44A]">
                  {g.title}
                </h2>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-[#8A8690]/70">
                  {g.topicCount > 0
                    ? `${g.topicCount} topics · ${g.totalQuota} reps`
                    : g.targetTempoBpm
                      ? `${g.targetTempoBpm} BPM`
                      : g.type}
                </span>
              </div>
              {g.description && (
                <p className="mt-2 text-sm leading-relaxed text-[#8A8690]">
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
      <div className="gym-rise gym-d1 w-full max-w-md overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.05] to-white/[0.01] text-center">
        <div className="space-y-5 p-8">
          <p className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#E8A44A]">
            The Bass Gym
          </p>
          <h1 className="font-heading text-4xl uppercase leading-[0.95] tracking-[0.02em] text-[#E8E4DD]">
            Your goal for the month{' '}
            <span className="text-[#E8A44A]">lives in the membership</span>
          </h1>
          <p className="text-sm leading-relaxed text-[#8A8690]">
            Membership gives you a coach-built daily rep — a 6-minute goal that
            climbs with you for the month, then resets fresh.
          </p>
          <Link
            href="/pricing"
            className="inline-flex w-full items-center justify-center rounded-lg bg-[#E8A44A] px-4 py-3 font-heading text-base uppercase tracking-[0.1em] text-black transition-all hover:bg-[#f0b35e] hover:shadow-[0_0_24px_rgba(232,164,74,0.35)]"
          >
            See membership
          </Link>
        </div>
      </div>
    </div>
  );
}


/**
 * The content-ladder PATH (epic §3 Build B) — the ~3 TOPIC progress bars the
 * student fills toward the goal. One bar per topic ("Hold the Engine 3/12"); the
 * goal is done when every bar is full. Internal "stages" are NEVER surfaced —
 * the student only sees the quota fill (founder decision §4: the future depends
 * on their pace, so we show present state, not a future timeline). Rendered
 * above the drill; absent on single-focal SPEED goals (topicProgress is null).
 */
/** One dot PER REP — filled (amber) up to repsLogged, hollow after. Never wraps:
 *  the dots are a flex row that shrinks each dot as the quota grows, so even a
 *  12-rep quota stays on one line (a 10-quota reads comfortably). */
function QuotaDots({
  logged,
  quota,
  done,
}: {
  logged: number;
  quota: number;
  done: boolean;
}) {
  const filled = Math.min(logged, quota);
  return (
    <div
      className="flex w-full min-w-0 items-center gap-[clamp(2px,1.4%,6px)]"
      aria-hidden
    >
      {Array.from({ length: Math.max(1, quota) }).map((_, i) => (
        <span
          key={i}
          className={`aspect-square min-w-0 flex-1 rounded-full transition-colors duration-500 ${
            i < filled
              ? 'bg-[#E8A44A]'
              : 'border border-white/[0.08] bg-white/[0.02]'
          } ${i < filled && done ? 'shadow-[0_0_5px_rgba(232,164,74,0.45)]' : ''}`}
          style={{ transitionDelay: `${i * 30}ms`, maxWidth: 13 }}
        />
      ))}
    </div>
  );
}

/** The per-topic path rows — list-row vocabulary from the /app ProgressCard:
 *  serif title, mono NN/NN readout, dots. NO card chrome of its own (it's
 *  rendered inside the merged console card). */
function GymTopicProgress({ topics }: { topics: TopicProgress[] }) {
  return (
    <div className="flex flex-col gap-1.5 px-[22px] pb-[18px]">
      {topics.map((t) => (
        <div
          key={t.topicId}
          className="space-y-2 rounded-[7px] border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={`truncate font-serif text-[15px] ${
                t.isComplete ? 'text-[#E8A44A]' : 'text-[#E8E4DD]'
              }`}
            >
              {t.title}
            </span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums">
              <span
                className={t.isComplete ? 'text-[#E8A44A]' : 'text-[#E8E4DD]'}
              >
                {String(Math.min(t.repsLogged, t.repQuota)).padStart(2, '0')}
              </span>
              <span className="text-[#5A5660]">
                {' / '}
                {String(t.repQuota).padStart(2, '0')}
              </span>
            </span>
          </div>
          <QuotaDots
            logged={t.repsLogged}
            quota={t.repQuota}
            done={t.isComplete}
          />
        </div>
      ))}
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
    goals,
    chooseGoal,
    placeAndStart,
    chooseFloor,
    chooseDoor,
    startSwitch,
    refresh,
  } = useGymSession(undefined, { enabled: isMember });

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

  // The daily-rep view — "the training apparatus": condensed athletic display
  // type (Bebas/Podium via font-heading), mono stat readouts, amber-on-leather,
  // one staggered entrance. The app shell paints the leather/gradient base.
  return (
    <>
      <PageErrorBoundary pageName="Bass Gym">
        <GymStyles />
        <div className="mx-auto w-full max-w-xl px-4 py-8 md:px-6 md:py-10 lg:py-12">
          {/* ONE console card — built in the /app SessionCard vocabulary:
              #141318 surface, top amber accent hairline, mono micro-labels,
              serif titles. Holds: stat header → path dots → drill. */}
          <div className="gym-rise gym-d1 relative mb-5 overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318]">
            {/* Top accent line — the SessionCard signature. */}
            <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />

            {/* Header: section label + the day readout. */}
            <div className="flex items-start justify-between gap-4 px-[22px] pb-3.5 pt-[22px]">
              <div className="min-w-0">
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
                  {topicProgress && topicProgress.every((t) => t.isComplete)
                    ? 'Goal — complete'
                    : 'Your path'}
                </div>
                <div className="font-serif text-[22px] leading-tight text-[#E8E4DD]">
                  The Bass Gym
                </div>
                {topicProgress && topicProgress.length > 0 && (
                  <div className="mt-0.5 font-mono text-[11px] text-[#5A5660]">
                    {topicProgress.filter((t) => t.isComplete).length}/
                    {topicProgress.length} topics complete
                  </div>
                )}
              </div>
              {attendance && (
                <div className="shrink-0 whitespace-nowrap text-right">
                  <div className="font-mono text-[22px] font-light text-[#E8E4DD]">
                    {attendance.daysPracticed}
                    <span className="text-[#5A5660]">
                      /{attendance.windowDays}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-[#5A5660]">
                    days
                  </div>
                </div>
              )}
            </div>

            {/* Path (content-ladder topics) — dot rows. */}
            {topicProgress && topicProgress.length > 0 && (
              <GymTopicProgress topics={topicProgress} />
            )}

            {/* Drill — bare (no card chrome), divided from the header/path. */}
            <div className="border-t border-white/[0.06] p-[22px]">
              <DrillSessionFrame
                tutorial={memoizedTutorial}
                tutorialSlug={slug}
                exercises={memoizedExercises ?? []}
                isFloor={repMode === 'floor'}
                inline
                bare
              />
            </div>
          </div>

          {/* Quiet options under the rep: floor toggle + switch goal. */}
          <div className="gym-rise gym-d4 space-y-1 text-center text-xs text-[#8A8690]">
            <p>
              {repMode === 'floor' ? (
                <>
                  Short session today — just loop one groove (3 min). Streak
                  stays safe.{' '}
                  <button
                    type="button"
                    onClick={refresh}
                    className="underline underline-offset-2 hover:text-[#E8E4DD]"
                  >
                    Do the full rep instead
                  </button>
                </>
              ) : (
                <>
                  Wrecked or short on time?{' '}
                  <button
                    type="button"
                    onClick={chooseFloor}
                    className="underline underline-offset-2 hover:text-[#E8E4DD]"
                  >
                    Do the 3-minute version
                  </button>{' '}
                  — your streak stays safe.
                </>
              )}
            </p>
            <p>
              Not the right goal?{' '}
              <button
                type="button"
                onClick={startSwitch}
                className="underline underline-offset-2 hover:text-[#E8E4DD]"
              >
                Switch goal
              </button>
            </p>
          </div>
        </div>
      </PageErrorBoundary>
    </>
  );
}
