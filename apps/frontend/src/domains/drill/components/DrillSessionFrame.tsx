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
import type { Tutorial } from '@bassnotion/contracts';
import { YouTubeWidgetPage } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useProgress } from '@/domains/progress/hooks/useProgress';
import { getDrillBricks } from '@/domains/drill/utils/drillBricks';
import { useDrillSession } from '@/domains/drill/hooks/useDrillSession';
import { useRecordSession } from '@/domains/drill/hooks/useStreak';
import { DrillPlanScreen } from './DrillPlanScreen';
import {
  DrillSummaryScreen,
  type DrillSummaryItem,
} from './DrillSummaryScreen';

interface DrillSessionFrameProps {
  tutorial: Tutorial;
  tutorialSlug: string;
  /** Exercise entities from useTutorialExercises — forwarded verbatim to the
   *  player (which types this as any[]). Drills rarely carry exercises, but a
   *  mixed tutorial might. */
  exercises: unknown[];
}

export function DrillSessionFrame({
  tutorial,
  tutorialSlug,
  exercises,
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
  const recordedRef = useRef(false);
  useEffect(() => {
    if (phase === 'summary' && !recordedRef.current) {
      recordedRef.current = true;
      // Reaching the summary = the player completed the FULL focused rep (every
      // brick), so this is a CEILING rep (advances both floor + ceiling).
      recordSession.mutate(true);
    }
    if (phase === 'plan') {
      recordedRef.current = false; // re-arm for a fresh run
    }
  }, [phase, recordSession]);

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
      <DrillPlanScreen title={tutorial.title} bricks={bricks} onStart={start} />
    );
  }

  if (phase === 'summary') {
    return (
      <DrillSummaryScreen
        title={tutorial.title}
        items={summaryItems}
        onRestart={restart}
        onDone={() => navigateWithTransition('/app')}
        streak={recordSession.data ?? null}
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
