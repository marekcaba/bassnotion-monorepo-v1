'use client';

import React from 'react';
import type {
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
  TopicProgress,
} from '@bassnotion/contracts';
import Link from 'next/link';
import { TutorialPageSkeleton } from '@/domains/widgets/components/YouTubeWidgetPage/TutorialPageSkeleton';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { DrillSessionFrame } from '@/domains/drill/components/DrillSessionFrame';
import { useGymSession } from '@/domains/training-engine/hooks/useGymSession';
import { useRepResultSync } from '@/domains/training-engine/hooks/useRepResultSync';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';

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
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/5 bg-[#100E0D] p-8 text-center text-white">
        <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
          Find your start
        </p>
        <h1 className="text-2xl font-semibold">
          What tempo can you play this cleanly?
        </h1>
        <p className="text-sm text-white/50">
          Push it to the fastest you can hold relaxed and clean. The coach
          brackets each day’s rep around this — you can always ease off.
        </p>
        <div className="space-y-2">
          <div className="font-mono text-4xl font-semibold text-[#E8A44A]">
            {tempo} <span className="text-base text-white/40">BPM</span>
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
          <div className="flex justify-between text-[10px] text-white/30">
            <span>50</span>
            <span>180</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onStart(tempo)}
          className="w-full rounded-md bg-[#E8A44A] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#E8A44A]/90"
        >
          Start at {tempo} BPM
        </button>
      </div>
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
    <div className="flex min-h-[60vh] w-full items-center justify-center px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-white/5 bg-[#100E0D] p-8 text-center text-white">
        <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
          The Bass Gym
        </p>
        <h1 className="text-2xl font-semibold">
          Your goal for the month lives in the membership
        </h1>
        <p className="text-sm text-white/50">
          Membership gives you a coach-built daily rep — a 6-minute goal that
          climbs with you for the month, then resets fresh. Join to set yours.
        </p>
        <Link
          href="/pricing"
          className="inline-block w-full rounded-md bg-[#E8A44A] px-4 py-2.5 text-sm font-semibold text-black hover:bg-[#E8A44A]/90"
        >
          See membership
        </Link>
      </div>
    </div>
  );
}

/**
 * "Showed up X of N days" (Treadmill epic Story 7) — the attendance proof,
 * shown every day above the rep. A quiet strip, not a banner.
 */
function GymDayCount({
  daysPracticed,
  windowDays,
}: {
  daysPracticed: number;
  windowDays: number;
}) {
  return (
    <p className="mx-auto mb-3 w-full max-w-2xl text-center text-xs text-white/45">
      🔥 You showed up{' '}
      <span className="font-semibold text-white/70">
        {daysPracticed} of {windowDays} days
      </span>{' '}
      this cycle.
    </p>
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
function GymTopicProgress({ topics }: { topics: TopicProgress[] }) {
  const allComplete = topics.every((t) => t.isComplete);
  return (
    <div className="mx-auto mb-4 w-full max-w-2xl space-y-2.5">
      <p className="text-center text-xs uppercase tracking-wide text-white/40">
        {allComplete ? 'Goal complete — every bar full 🎉' : 'Your path'}
      </p>
      {topics.map((t) => {
        const pct =
          t.repQuota > 0
            ? Math.min(100, Math.round((t.repsLogged / t.repQuota) * 100))
            : 0;
        return (
          <div key={t.topicId} className="space-y-1">
            <div className="flex items-baseline justify-between text-xs">
              <span
                className={
                  t.isComplete ? 'text-[#E8A44A]' : 'font-medium text-white/70'
                }
              >
                {t.isComplete && '✓ '}
                {t.title}
              </span>
              <span className="font-mono text-white/40">
                {Math.min(t.repsLogged, t.repQuota)}/{t.repQuota}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-[#E8A44A] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
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
  const { tier, isLoading: entitlementLoading } = useEntitlement();
  const isMember = tier === 'member';

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
    placeAndStart,
    chooseFloor,
    chooseDoor,
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

  // Membership gate. While entitlement resolves, show the skeleton (never flash
  // the wall to a member, nor the gym to a non-member). Resolved + non-member →
  // the upsell wall.
  if (entitlementLoading) {
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

  if (status === 'placement') {
    return <GymPlacement onStart={placeAndStart} />;
  }

  if (status === 'loading' || isLoading || !slug || !memoizedTutorial) {
    return <TutorialPageSkeleton />;
  }

  return (
    <>
      <PageErrorBoundary pageName="Bass Gym">
        {graduation ? (
          <div className="px-4 pt-4">
            {/* The month-in-review recap (Story 6) above the fork — the journey
                screen the player sees at graduation. */}
            {monthInReview && <GymMonthInReview review={monthInReview} />}
            {/* Graduation banner carries the day-count itself — don't double it. */}
            <GymGraduation graduation={graduation} onChoose={chooseDoor} />
          </div>
        ) : (
          attendance && (
            <div className="px-4 pt-4">
              <GymDayCount
                daysPracticed={attendance.daysPracticed}
                windowDays={attendance.windowDays}
              />
            </div>
          )
        )}
        {/* Floor toggle (Story 5): wrecked / short on time → the 3-min version.
            Hidden at graduation (the fork/recap own that screen). */}
        {!graduation && (
          <p className="mx-auto -mt-1 mb-3 w-full max-w-2xl px-4 text-center text-xs text-white/40">
            {repMode === 'floor' ? (
              <>
                Short session today — just loop one groove (3 min). Streak stays
                safe.{' '}
                <button
                  type="button"
                  onClick={refresh}
                  className="underline underline-offset-2 hover:text-white/70"
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
                  className="underline underline-offset-2 hover:text-white/70"
                >
                  Do the 3-minute version
                </button>{' '}
                — your streak stays safe.
              </>
            )}
          </p>
        )}
        {/* The content-ladder path bars (Build B) — the ~3 topic quotas the
            student fills toward the goal. Multi-topic goals only; hidden at
            graduation (the recap/fork own that screen). */}
        {!graduation && topicProgress && topicProgress.length > 0 && (
          <div className="px-4">
            <GymTopicProgress topics={topicProgress} />
          </div>
        )}
        <DrillSessionFrame
          tutorial={memoizedTutorial}
          tutorialSlug={slug}
          exercises={memoizedExercises ?? []}
          isFloor={repMode === 'floor'}
        />
      </PageErrorBoundary>
    </>
  );
}
