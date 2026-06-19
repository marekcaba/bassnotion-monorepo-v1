'use client';

import React from 'react';
import type {
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
  EnrollableGoal,
} from '@bassnotion/contracts';
import { marketingUrl } from '@/lib/marketing-url';
import { GymFloor } from '@/domains/training-engine/components/GymFloor';
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
 * The ONE loading state for the gym. Shown while auth + entitlement + the gym
 * session are still resolving — shape-neutral (a calm centered spinner), so it
 * never mimics the overlay or the picker and then yanks to the other. When
 * everything is ready the real composed view (floor + overlay, or the picker)
 * fades in once via gym-rise. No skeletons, no triple-flicker.
 */
function GymLoading() {
  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center">
      <div
        className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#E8A44A]"
        role="status"
        aria-label="Loading the gym"
      />
    </div>
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
          {/* Cross-origin to the apex marketing /pricing — plain <a> (a Next
              <Link> won't client-navigate cross-origin and would prefetch a
              308). marketingUrl() makes it absolute on the app host. */}
          <a
            href={marketingUrl('/pricing')}
            className="inline-flex w-full items-center justify-center rounded-[9px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-4 py-3 text-sm font-semibold text-[#0C0B0F] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(232,164,74,0.3)]"
          >
            See membership
          </a>
        </div>
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
        <Stat
          label="Reps"
          value={`${totalReps}`}
          sub={`${conqueredReps} conquered`}
        />
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
                  {g.bestTier ? TIER_MEDAL[g.bestTier] : ''} {g.bestTier ?? '—'}
                  <span className="ml-2 text-white/30">{g.conqueredReps}×</span>
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

  // The "Six minutes." rep sits as an OVERLAY on the equipment FLOOR. Open by
  // default (the coached path leads); "Explore the gym" dismisses it to the
  // self-directed floor, and a "Today's rep" button re-summons it. Re-open
  // whenever a fresh rep is planned (refresh / floor toggle / new slug).
  //
  // Two flags drive a symmetric ease-in-out FADE both ways:
  //  - `overlayMounted` = is it in the DOM (presence).
  //  - `overlayVisible` = opacity target (1 = shown, 0 = fading).
  // FADE IN: mount at opacity 0, then flip visible→true next frame so the CSS
  // transition runs. FADE OUT: flip visible→false, then unmount after the fade.
  const OVERLAY_FADE_MS = 450;
  const [overlayMounted, setOverlayMounted] = React.useState(true);
  const [overlayVisible, setOverlayVisible] = React.useState(true);

  const summonOverlay = React.useCallback(() => {
    setOverlayMounted(true);
    // Mount transparent, then fade to opaque on the next frame.
    requestAnimationFrame(() => setOverlayVisible(true));
  }, []);
  const dismissOverlay = React.useCallback(() => {
    setOverlayVisible(false);
    window.setTimeout(() => setOverlayMounted(false), OVERLAY_FADE_MS);
  }, []);

  // A fresh rep (new slug) re-summons the coached overlay.
  React.useEffect(() => {
    if (slug) summonOverlay();
  }, [slug, summonOverlay]);

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

  // Membership gate. While auth + entitlement resolve, show the ONE neutral
  // loading spinner (never flash the wall to a member, nor the gym to a
  // non-member, nor a shape-specific skeleton that pivots). Resolved +
  // non-member → the upsell wall.
  if (gateResolving) {
    return <GymLoading />;
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
    // ONE neutral spinner — no shape-guessing. The previous code rendered a
    // picker-shaped OR front-door-shaped skeleton here, which (combined with the
    // gate spinner above) produced the visible flicker: overlay-shaped skeleton
    // → picker → skeleton → overlay. A single calm spinner until the real status
    // resolves, then the final view fades in once.
    return <GymLoading />;
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

  // The daily-rep view — THE FRONT DOOR. When a student opens /app/gym they see
  // ONLY the rep: a quiet eyebrow naming today's topic, the giant "Six minutes."
  // headline, a coach line, and the big amber CTA — over the equipment floor.
  // The climb (stats + topic path) now lives in the user dashboard (/app/settings),
  // not the gym; under the CTAs there's only "Explore the gym".

  // ── Coach-voice derived values (ALL from real data, nothing fabricated) ──
  // Reps banked is the HERO metric (founder decision): sum of reps logged across
  // topics, against the goal's total quota. The dot fill IS this, counting up.
  const repsBanked =
    topicProgress?.reduce(
      (n, t) => n + Math.min(t.repsLogged, t.repQuota),
      0,
    ) ?? 0;
  const repsTotal = topicProgress?.reduce((n, t) => n + t.repQuota, 0) ?? 0;
  const repsToGo = Math.max(0, repsTotal - repsBanked);
  const goalDone = repsTotal > 0 && repsBanked >= repsTotal;
  // The goal's name (real, frozen at enrollment) — fall back gracefully.
  const goalName = goalTitle?.trim() || 'Your goal';
  const targetBpm =
    typeof enrollment?.goalSnapshot?.target?.tempoBpm === 'number'
      ? enrollment.goalSnapshot.target.tempoBpm
      : null;
  // Streak (real; may be undefined while loading).
  const streakDays = streak?.current ?? 0;
  const freezeTokens = streak?.freezeTokens ?? 0;

  // ── TODAY'S TOPIC (real) ── Each rep targets ONE topic, and banking it fills
  // one DOT in that topic's quota (founder model). The planner stamps the chosen
  // topic on the rep's bricks (config.topicId); reading it back here matches the
  // server's pick EXACTLY (no re-derivation drift). Match it to topicProgress for
  // the title + this topic's quota fill. Absent on single-focal SPEED goals.
  const todayTopicId =
    (bricks
      .map((b) => (b.config as { topicId?: string } | undefined)?.topicId)
      .find(Boolean) as string | undefined) ?? null;
  const todayTopic =
    (todayTopicId && topicProgress?.find((t) => t.topicId === todayTopicId)) ||
    null;
  // The eyebrow: TODAY · <topic name>. Falls back to the goal name on a SPEED
  // goal (no topics), then to a bare "TODAY".
  const eyebrow = `TODAY · ${(todayTopic?.title || goalName || 'THE GRID').toUpperCase()}`;
  // The coach line — real state only. Names this topic's progress when we have
  // it; otherwise the goal-level reps banked. No invented numbers.
  const coachLine = goalDone
    ? 'Every rep banked — you finished the goal. Nice work.'
    : todayTopic
      ? todayTopic.repsLogged === 0
        ? `First rep on ${todayTopic.title.toLowerCase()}. One dot at a time.`
        : `${todayTopic.repsLogged} of ${todayTopic.repQuota} on ${todayTopic.title.toLowerCase()} — keep stacking dots.`
      : repsBanked > 0
        ? `${repsBanked} ${repsBanked === 1 ? 'rep' : 'reps'} in the bank${
            repsToGo > 0 ? ` · ${repsToGo} to go` : ''
          }${targetBpm ? `, aiming for ${targetBpm} BPM` : ''}.`
        : streakDays > 0
          ? `${streakDays} days in. The pocket's closer than it feels.`
          : 'Six minutes is the whole ask. Let’s bank the first one.';

  return (
    <>
      <PageErrorBoundary pageName="Bass Gym">
        <GymStyles />
        {/* The gym = the FLOOR (equipment) with the "Six minutes." rep as an
            OVERLAY on top. `relative` so the overlay is scoped to the gym's
            content area (the app sidebar stays visible + clickable to the left;
            the overlay never covers it). min-h-full so the scrim fills the view
            even when the floor is short.
            NO animation/transform/opacity on THIS wrapper — any of them promotes
            it to its own layer / stacking context, which breaks the overlay
            scrim's backdrop-filter blur (the floor headline punches through).
            The entrance is handled by the overlay's own fade (overlayVisible +
            the gym-rise children INSIDE the scrim, which sit above it). */}
        <div className="relative min-h-full w-full">
          {/* ── BASE LAYER: the equipment floor ── */}
          <GymFloor />

          {/* ── OVERLAY: today's coached rep ── A blurred scrim over the floor,
              so the equipment reads through behind the prompt ("the full floor
              is right there"). FADES both ways (opacity + blur ease in/out):
              "Explore the gym" fades it out before unmounting; "Today's rep"
              mounts it transparent then fades it back in. */}
          {overlayMounted && (
            <div
              className="absolute inset-0 z-30 flex flex-col items-center justify-center px-4 py-10 transition-[opacity,backdrop-filter] duration-[450ms] ease-in-out"
              style={{
                background:
                  'radial-gradient(80% 60% at 50% 42%, rgba(12,11,14,1) 0%, rgba(12,11,14,0) 60%, rgba(8,7,10,1) 100%)',
                backdropFilter: overlayVisible
                  ? 'blur(14.5px) saturate(0.9)'
                  : 'blur(0px) saturate(1)',
                WebkitBackdropFilter: overlayVisible
                  ? 'blur(14.5px) saturate(0.9)'
                  : 'blur(0px) saturate(1)',
                opacity: overlayVisible ? 1 : 0,
                pointerEvents: overlayVisible ? undefined : 'none',
              }}
            >
              {/* Streak — top-right of the overlay (daily-return mechanic). */}
              <div className="gym-rise gym-d1 absolute right-2 top-2 flex items-center gap-2 font-mono text-[11px] tracking-[1.5px]">
                {streakDays > 0 && (
                  <span className="uppercase text-[#7d786d]">
                    {streakDays}-day streak
                  </span>
                )}
                {freezeTokens > 0 && (
                  <span
                    className="text-[#5B8DEF]"
                    title="Streak freezes banked"
                  >
                    ❄️ {freezeTokens}
                  </span>
                )}
              </div>

              {/* The front door (the rep). */}
              <div className="gym-rise gym-d2 w-full max-w-[26rem]">
                <DrillSessionFrame
                  tutorial={memoizedTutorial}
                  tutorialSlug={slug}
                  exercises={memoizedExercises ?? []}
                  isFloor={repMode === 'floor'}
                  inline
                  bare
                  frontDoor={{
                    eyebrow,
                    headline: 'Six minutes.',
                    coachLine,
                    floor: {
                      label:
                        repMode === 'floor'
                          ? 'Do the full rep instead'
                          : 'Short on time? 3-minute version — streak stays safe',
                      onClick: repMode === 'floor' ? refresh : chooseFloor,
                    },
                  }}
                />

                {/* Dismiss → reveal the floor underneath. The only thing under
                    the CTAs (the climb moved to the user dashboard / settings). */}
                <div className="mt-8 text-center">
                  <button
                    type="button"
                    onClick={dismissOverlay}
                    disabled={!overlayVisible}
                    className="group inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[2px] text-[#605b52] transition-colors hover:text-[#E8A44A] disabled:opacity-50"
                  >
                    Explore the gym
                    <span className="transition-transform group-hover:translate-y-0.5">
                      ↓
                    </span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Re-summon the coached rep once the floor is showing. */}
          {!overlayMounted && (
            <button
              type="button"
              onClick={summonOverlay}
              className="gym-rise fixed bottom-7 right-7 z-40 inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-5 py-3.5 text-sm font-semibold text-[#2a1c08] shadow-[0_12px_32px_rgba(232,164,74,0.32)] transition-all hover:-translate-y-0.5 hover:brightness-105"
            >
              <span
                aria-hidden
                className="inline-block size-0 border-y-[7px] border-l-[11px] border-y-transparent border-l-current"
              />
              Today&apos;s rep
            </button>
          )}
        </div>
      </PageErrorBoundary>
    </>
  );
}
