'use client';

/**
 * DrillSessionFrame — wraps the tutorial player with the drill session frame:
 *
 *   plan (gate) → running (the player) → summary
 *
 * Only mounted for drill tutorials (see isDrillTutorial). It owns the phase
 * (useDrillSession) and reads the same progress cache the player writes to via
 * useCompleteBlock, so completion flows through automatically: when the last
 * brick is marked complete, the frame flips to the summary.
 *
 * The player itself is unchanged — it renders during the 'running' phase. The
 * plan/summary screens replace it (not overlay) so audio isn't running behind
 * a recap.
 */

import { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Tutorial } from '@bassnotion/contracts';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useProgress } from '@/domains/progress/hooks/useProgress';
import { getDrillBricks } from '@/domains/drill/utils/drillBricks';
import { useDrillSession } from '@/domains/drill/hooks/useDrillSession';
import { useRecordSession, useStreak } from '@/domains/drill/hooks/useStreak';
import { DrillPlanScreen, type FrontDoor } from './DrillPlanScreen';
import {
  DrillSummaryScreen,
  type DrillSummaryItem,
} from './DrillSummaryScreen';

// The player (and the whole audio/playback graph it pulls) only renders in the
// 'running' phase. Dynamic-import it so the gym overlay, the gym-floor chooser,
// and the drill 'plan'/'summary' screens paint from a tiny chunk with no audio
// bundle. By the time the user presses Start, the background warm-up (or the
// ensureAudioReady() kick in useDrillSession.start) has the engine ready.
const YouTubeWidgetPage = dynamic(
  () =>
    import(
      '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage'
    ).then((m) => ({ default: m.YouTubeWidgetPage })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-white/50">
        Loading rep…
      </div>
    ),
  },
);

interface DrillSessionFrameProps {
  tutorial: Tutorial;
  tutorialSlug: string;
  /** Exercise entities from useTutorialExercises — forwarded verbatim to the
   *  player (which types this as any[]). Drills rarely carry exercises, but a
   *  mixed tutorial might. */
  exercises: unknown[];
  /** Story 5: this is the short FLOOR session (one 3-min brick). Completing it
   *  records a FLOOR rep (showed up) — it advances the floor streak but NOT the
   *  ceiling (which is the full focused rep). Defaults to false (full rep). */
  isFloor?: boolean;
  /** Inline the plan screen (no full-height self-centering) so it flows in a
   *  parent column — the gym stacks its status/path strip above the drill. */
  inline?: boolean;
  /** Bare plan screen (no card chrome) so it nests inside a parent panel — the
   *  gym merges stats + path + drill into one console card. */
  bare?: boolean;
  /** Front-door plan screen (the gym): the centered "Six minutes." invitation
   *  with the giant CTA, no brick list. Only affects the 'plan' phase. */
  frontDoor?: FrontDoor;
}

export function DrillSessionFrame({
  tutorial,
  tutorialSlug,
  exercises,
  isFloor = false,
  inline = false,
  bare = false,
  frontDoor,
}: DrillSessionFrameProps) {
  const { profile } = useUserProfile();
  const { navigateWithTransition } = useViewTransitionRouter();

  // Same query key the player uses → shared cache. The player marks blocks
  // complete (useCompleteBlock updates this cache), so completedIds here update
  // reactively without a refetch.
  const { data: progress } = useProgress(tutorialSlug, {
    enabled: !!profile?.id,
  });

  const bricks = useMemo(() => getDrillBricks(tutorial), [tutorial]);
  const brickIds = useMemo(() => bricks.map((b) => b.id), [bricks]);

  const completedIds = useMemo(
    () =>
      new Set(
        (progress?.blocks ?? [])
          .filter((b) => b.completed)
          .map((b) => b.blockId),
      ),
    [progress],
  );

  const { phase, start, restart } = useDrillSession({
    isDrill: true,
    brickIds,
    completedIds,
  });

  // Bump the practice streak when the session is completed (phase → summary).
  // Fire once per visit (the ref guard); the server is idempotent per day, so a
  // duplicate would be harmless anyway. A "run it again" → plan → summary cycle
  // re-arms it, but the same-day server no-op keeps the count correct.
  const recordSession = useRecordSession();
  // The already-cached streak (the user's streak BEFORE this session). Used as
  // the summary's immediate fallback so the "🔥 N-day streak" line is present
  // the instant the summary renders, instead of popping in 1-3s later when the
  // record mutation's round-trip resolves. The mutation result (the post-record
  // value) replaces it as soon as it lands — same calendar day, so it differs by
  // at most the +1 this session earned.
  const cachedStreak = useStreak();
  const recordedRef = useRef(false);
  useEffect(() => {
    if (phase === 'summary' && !recordedRef.current) {
      recordedRef.current = true;
      // A FULL rep (all bricks) = a CEILING rep (advances floor + ceiling). A
      // FLOOR session (Story 5: the short 3-min version) advances the floor
      // streak only — "showed up", streak safe, but not the full-focus ceiling.
      recordSession.mutate(!isFloor);
    }
    if (phase === 'plan') {
      recordedRef.current = false; // re-arm for a fresh run
    }
  }, [phase, recordSession, isFloor]);

  const summaryItems = useMemo<DrillSummaryItem[]>(() => {
    const dataById = new Map(
      (progress?.blocks ?? []).map((b) => [b.blockId, b.data ?? null]),
    );
    return bricks.map((brick) => ({
      brick,
      result: dataById.get(brick.id) ?? null,
    }));
  }, [bricks, progress]);

  if (phase === 'plan') {
    return (
      <DrillPlanScreen
        title={tutorial.title}
        bricks={bricks}
        onStart={start}
        inline={inline}
        bare={bare}
        frontDoor={frontDoor}
      />
    );
  }

  if (phase === 'summary') {
    return (
      <DrillSummaryScreen
        title={tutorial.title}
        items={summaryItems}
        onRestart={restart}
        onDone={() => navigateWithTransition('/')}
        // Post-record value once the mutation lands; until then the cached
        // pre-session streak so the line never pops in from nothing.
        streak={recordSession.data ?? cachedStreak.data ?? null}
      />
    );
  }

  // 'running' → the normal player.
  return (
    <YouTubeWidgetPage
      tutorialData={tutorial}
      tutorialSlug={tutorialSlug}
      exercises={exercises}
      hideChrome
    />
  );
}
