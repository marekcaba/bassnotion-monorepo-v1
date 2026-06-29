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
  const { slug, enrollment, repMode, bricks } = useGymSession(undefined, {
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

  // A member should NOT be on /gym/rep without a resolvable rep. Normally the slug is warm (the gate
  // planned it) and `ready` is true within a frame. If after a grace window there's still no rep
  // (direct URL with a cold cache that 401/404'd, lapsed sub), bounce to /gym, which owns the live
  // membership/placement/picker states this leaf doesn't render.
  React.useEffect(() => {
    if (!authReady) return;
    if (!isMember) {
      router.replace('/gym');
      return;
    }
    if (ready) return;
    const t = window.setTimeout(() => {
      router.replace('/gym');
    }, 6000);
    return () => window.clearTimeout(t);
  }, [authReady, isMember, ready, router]);

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
          // After the summary, "done" → the gym FLOOR. ?floor=1 tells /gym to open with the rep
          // overlay already DISMISSED (the front door + ready already happened — don't re-prompt).
          onExitTo="/gym?floor=1"
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
