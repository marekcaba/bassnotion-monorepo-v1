'use client';

import React from 'react';
import type { GraduationSummary, GraduationDoor } from '@bassnotion/contracts';
import { TutorialPageSkeleton } from '@/domains/widgets/components/YouTubeWidgetPage/TutorialPageSkeleton';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { DrillSessionFrame } from '@/domains/drill/components/DrillSessionFrame';
import { useGymSession } from '@/domains/training-engine/hooks/useGymSession';
import { useRepResultSync } from '@/domains/training-engine/hooks/useRepResultSync';

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
  const { startTempoBpm, currentTempoBpm, targetTempoBpm } = graduation;
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
  const {
    status,
    slug,
    bricks,
    enrollment,
    error,
    graduation,
    placeAndStart,
    chooseDoor,
    refresh,
  } = useGymSession();

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
        {graduation && (
          <div className="px-4 pt-4">
            <GymGraduation graduation={graduation} onChoose={chooseDoor} />
          </div>
        )}
        <DrillSessionFrame
          tutorial={memoizedTutorial}
          tutorialSlug={slug}
          exercises={memoizedExercises ?? []}
        />
      </PageErrorBoundary>
    </>
  );
}
