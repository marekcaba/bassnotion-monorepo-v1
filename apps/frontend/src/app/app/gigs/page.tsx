'use client';

/**
 * /app/gigs (clean URL /gigs) — the student's GIGS list: the admin-authored deliverables they
 * inherit via the goals they're enrolled in. Each row links to the perform page
 * (/gigs/[goalSlug]/[gigId]) where the locked tool loads and the take is recorded + graded.
 *
 * LIGHT BY DESIGN: this page loads ONLY gig metadata (one small GET) — NO audio engine, NO player.
 * The heavy ScalesTool + AudioProvider mount only on the perform leaf (audioRoutes matches the
 * /app/gigs/ prefix, never this list). The engine warms in the background after this paints
 * (routeCanReachAudio includes /app/gigs), so opening a gig is fast — the same split the gym floor
 * uses. See the gigs-page-load-architecture note.
 */

import React from 'react';
import { Play } from 'lucide-react';
import type { Gig } from '@bassnotion/contracts';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { fetchMyGigs } from '@/domains/training-engine/api/training-engine.api';

function GigsContent() {
  const { isAuthenticated } = useAuth();
  const [gigs, setGigs] = React.useState<Gig[] | null>(null);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    fetchMyGigs()
      .then((list) => {
        if (!cancelled) setGigs(list);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-10">
      <div className="flex items-center gap-3">
        <Play className="size-8 text-[#ffc700]" />
        <h1 className="text-2xl font-bold text-zinc-100">Gigs</h1>
      </div>
      <p className="mt-3 text-zinc-400">
        Your assigned deliverables. Open one, play it through, and submit your
        take.
      </p>

      <div className="mt-6">
        {error ? (
          <p className="text-sm text-red-400">
            Couldn&apos;t load your gigs. Try again in a moment.
          </p>
        ) : gigs === null ? (
          <p className="text-sm text-zinc-500">Loading…</p>
        ) : gigs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No gigs right now. Your coach assigns these on your goal.
          </p>
        ) : (
          <ul className="space-y-3">
            {gigs.map((g) => (
              <GigRow key={g.id} gig={g} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function GigRow({ gig }: { gig: Gig }) {
  // The perform route is /gigs/[goalSlug]/[gigId]. goalSlug is joined in on the read; fall back
  // to the goalId if a slug is somehow missing (the route only uses gigId to load).
  const goalSeg = gig.goalSlug || gig.goalId;
  const href = `/gigs/${encodeURIComponent(goalSeg)}/${encodeURIComponent(gig.id)}`;

  return (
    <li>
      <a
        href={href}
        className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 transition-colors hover:border-zinc-600 hover:bg-zinc-900"
      >
        <div className="min-w-0">
          <div className="truncate font-medium text-zinc-100">{gig.title}</div>
          <div className="mt-0.5 text-xs text-zinc-500">
            Day {gig.cycleDay}
            {gig.exerciseName ? ` · ${gig.exerciseName}` : ''}
            {gig.scaleKey ? ` · ${gig.scaleKey}` : ''}
            {gig.tempoBpm ? ` · ${gig.tempoBpm} BPM` : ''}
            {gig.recordLoops
              ? ` · ${gig.recordLoops} ${gig.recordLoops === 1 ? 'loop' : 'loops'}`
              : ''}
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-1.5 rounded bg-[#ffc700] px-3 py-1.5 text-sm font-bold text-black">
          <Play className="size-4" />
          Perform
        </span>
      </a>
    </li>
  );
}

export default function GigsPage() {
  return (
    <>
      <PageErrorBoundary pageName="Gigs">
        <GigsContent />
      </PageErrorBoundary>
    </>
  );
}
