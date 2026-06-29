'use client';

/**
 * /app/gigs/[goalSlug]/[gigId] (clean URL /gigs/[goalSlug]/[gigId]) — the gig PERFORM page.
 *
 * The student lands here from the /gigs list. It loads ONE gig by id (scoped to the student's
 * enrollment — a gig on a goal they're not in 404s) and mounts the Scales tool in LOCKED
 * ASSIGNMENT mode: the exercise + key + tempo + loop count are dialed in from the gig and the
 * controls are greyed; record is forced on. The student arms, plays for the admin-set number of
 * loops, gets graded, and Submits (or Retakes). Submit replaces any prior take for this gig.
 *
 * LOAD: this is the HEAVY leaf — the AudioProvider + engine mount here (audioRoutes matches the
 * /app/gigs/ prefix). The /gigs LIST stays light and warms the engine in the background, so
 * landing here is fast (same split as the gym floor → /gym/scales).
 */

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { Gig } from '@bassnotion/contracts';
import { ScalesTool } from '@/domains/training-engine/equipment/scales/ScalesTool';
import {
  WAITLIST_DEMO_CONFIG,
  WAITLIST_DEMO_BLOCK_ID,
} from '@/app/_components/waitlistGrooveCard.config';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { fetchGig } from '@/domains/training-engine/api/training-engine.api';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';

function GigPerformContent() {
  const params = useParams<{ goalSlug: string; gigId: string }>();
  const router = useRouter();
  const gigId = params?.gigId;

  // The user's bass config (string count + neck length) — same source as the gym Scales page.
  const { profile } = useUserProfile();
  const stringCount = profile?.preferences?.bassConfiguration?.stringCount ?? 4;
  const maxFrets = profile?.preferences?.bassConfiguration?.maxFrets ?? 25;

  const [gig, setGig] = React.useState<Gig | null>(null);
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>(
    'loading',
  );

  React.useEffect(() => {
    if (!gigId) return;
    let cancelled = false;
    setStatus('loading');
    fetchGig(gigId)
      .then((res) => {
        if (cancelled) return;
        setGig(res.gig);
        setStatus('ready');
      })
      .catch(() => {
        if (cancelled) return;
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [gigId]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-[calc(100svh-2rem)] items-center justify-center text-zinc-400">
        Loading gig…
      </div>
    );
  }

  if (status === 'error' || !gig) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold text-zinc-100">Gig not available</h1>
        <p className="mt-3 text-sm text-zinc-400">
          This gig doesn&apos;t exist, or it isn&apos;t on a goal you&apos;re
          enrolled in.
        </p>
        <a
          href="/gigs"
          className="mt-5 inline-block rounded bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-700"
        >
          ← Back to gigs
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100svh-2rem)] w-full flex-col items-center justify-center px-4">
      {/* Brief — what the assignment is. */}
      <div className="mb-2 w-full max-w-md text-center sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px]">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-[#ffc700]">
          Gig · {gig.scaleKey} · {gig.tempoBpm} BPM · {gig.recordLoops}{' '}
          {gig.recordLoops === 1 ? 'loop' : 'loops'}
        </div>
        <h1 className="mt-0.5 text-lg font-bold text-zinc-100">{gig.title}</h1>
        {gig.instructions && (
          <p className="mt-1 text-sm text-zinc-400">{gig.instructions}</p>
        )}
      </div>

      {/* The locked tool — same container width as the gym Scales page (familiarity). */}
      <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px]">
        <ScalesTool
          backingConfig={WAITLIST_DEMO_CONFIG}
          stringCount={stringCount}
          maxFrets={maxFrets}
          assignment={{
            gig,
            backingId: WAITLIST_DEMO_BLOCK_ID,
            // After submitting, collapse back to the /gigs list (which marks this gig done).
            onSubmitted: () => router.push('/gigs'),
          }}
        />
      </div>
    </div>
  );
}

export default function GigPerformPage() {
  return (
    <>
      <PageErrorBoundary pageName="Gig">
        <GigPerformContent />
      </PageErrorBoundary>
    </>
  );
}
