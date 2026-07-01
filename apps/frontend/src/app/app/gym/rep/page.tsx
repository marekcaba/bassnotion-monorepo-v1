'use client';

/**
 * /app/gym/rep (clean URL /gym/rep) — the RUNNING rep, full-surface on the leather background.
 *
 * The front door + "Are you ready?" already happened on /gym; arriving here means the player
 * committed, so the rep starts RUNNING immediately (DrillSessionFrame autoRun). The summary shows
 * here too; "done" returns to the gym FLOOR (/gym, with the overlay dismissed).
 *
 * The rep is resolved the same way /gym does — useGymSession (reads the warm cache, so this is
 * instant when the player came through the gate) → the planned slug → useTutorialExercises. This is
 * the HEAVY leaf (the player mounts here), so audioRoutes already matches /app/gym/.
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { DrillSessionFrame } from '@/domains/drill/components/DrillSessionFrame';
import { useTutorialExercises } from '@/domains/widgets/hooks/useTutorialExercises';
import { useGymSession } from '@/domains/training-engine/hooks/useGymSession';
import { useRepResultSync } from '@/domains/training-engine/hooks/useRepResultSync';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';

function GymRepContent() {
  const router = useRouter();
  const { isReady: authReady } = useAuth();
  const { tier } = useEntitlement();
  const isMember = tier === 'member';

  // Resolve today's rep from the warm cache (the gate already planned it). `bricks` come straight
  // from the session (the minted rep's TutorialBlocks) — the same value /gym feeds useRepResultSync.
  const { status, slug, enrollment, repMode, bricks } = useGymSession(undefined, {
    enabled: isMember && authReady,
  });

  const { tutorial, exercises, isLoading } = useTutorialExercises(slug);

  // Record each completed rep brick (the engine's append-only history) — same as /gym does.
  useRepResultSync({
    slug,
    enrollmentId: enrollment?.id ?? null,
    bricks,
  });

  const ready = slug != null && tutorial != null && !isLoading;

  // A member should NOT be on /gym/rep without a resolvable rep. This leaf renders ONLY the running
  // rep — the gym owns the goal picker / tempo placement / error / membership states. So bounce to
  // /gym whenever the session lands in one of those states (it'll show the right UI there).
  //
  // Crucially this keys off the session STATUS, not a blind timer: 'loading' (genuinely fetching) and
  // 'ready'-but-tutorial-still-loading are legitimate waits and must NOT be interrupted — a slow but
  // valid fetch should resolve, not get yanked back. We only redirect on a definitively-wrong state.
  const needsGym =
    status === 'choosing' || status === 'placement' || status === 'error';
  React.useEffect(() => {
    if (!authReady) return;
    if (!isMember || needsGym) {
      router.replace('/gym');
    }
  }, [authReady, isMember, needsGym, router]);

  // Last-resort safety net ONLY: if the session is somehow wedged (neither resolving nor reporting a
  // redirectable state) for a long beat, fall back to /gym. Generous (12s) so it never races a slow
  // network — the status-based redirect above is the real mechanism; this just prevents a dead spin.
  React.useEffect(() => {
    if (!authReady || !isMember || ready || needsGym) return;
    const t = window.setTimeout(() => router.replace('/gym'), 12000);
    return () => window.clearTimeout(t);
  }, [authReady, isMember, ready, needsGym, router]);

  return (
    <div className="relative min-h-[calc(100svh-2rem)] w-full">
      {ready && slug && tutorial ? (
        <DrillSessionFrame
          tutorial={tutorial}
          tutorialSlug={slug}
          exercises={exercises ?? []}
          isFloor={repMode === 'floor'}
          // Start running immediately (the front door + "Are you ready?" happened on /gym).
          autoRun
          // On completion, DON'T show the recap here — bounce straight to /gym, where it appears in
          // the gym overlay as "Session completed" (?done=1). Keeps the flow "in place" (started in
          // the gym overlay, ends in the gym overlay).
          redirectOnSummary
          onExitTo="/gym?done=1"
        />
      ) : (
        // Brief resolve — usually instant from the warm cache (the effect above bounces to /gym if
        // it doesn't resolve).
        <div className="flex min-h-[calc(100svh-2rem)] w-full items-center justify-center">
          <div
            className="h-9 w-9 animate-spin rounded-full border-2 border-white/10 border-t-[#E8A44A]"
            role="status"
            aria-label="Loading your rep"
          />
        </div>
      )}
    </div>
  );
}

export default function GymRepPage() {
  return (
    <>
      <PageErrorBoundary pageName="Gym Rep">
        <GymRepContent />
      </PageErrorBoundary>
    </>
  );
}
