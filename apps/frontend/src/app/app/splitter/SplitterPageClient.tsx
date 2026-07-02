'use client';

/**
 * /app/splitter (clean URL /splitter) — the Stem Splitter. Takes the member's own recordings and
 * separates them into stems. Mute the bass and the recording becomes a backing track to play over —
 * loop it, slow it, transpose it with the existing engine.
 *
 * LIGHT FIRST PAINT: room shell only — no audio engine. Splitting + stem playback mount on
 * interaction; the engine warms in the background (routeCanReachAudio includes /app/splitter), like
 * the gigs list. Scaffolded here ("coming soon"); the splitter itself fills in behind its follow-up.
 */

import { Scissors } from 'lucide-react';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';

function SplitterContent() {
  // Top-anchored, horizontally centered — matches Backstage / Gigs. Not vertically centered: the
  // panel below grows as it gains content, so anchoring to the top keeps the headline fixed.
  return (
    <div className="flex min-h-[calc(100svh-4rem)] w-full flex-col items-center p-6 pt-[12vh] md:p-10 md:pt-[12vh]">
      <div className="flex w-full max-w-4xl flex-col items-center space-y-10">
        <div className="w-full text-left">
          <div className="flex items-center gap-3.5">
            <Scissors className="size-10 shrink-0 text-[#ffc700]" />
            <h1 className="font-heading text-[clamp(34px,5vw,52px)] uppercase leading-none tracking-[0.01em] text-zinc-100">
              Splitter
            </h1>
          </div>
          <p className="mt-4 text-zinc-400">
            Split a recording into stems — mute the bass and play over the rest.
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-10 text-center">
          <Scissors className="size-8 text-[#ffc700]" />
          <p className="max-w-md text-sm leading-relaxed text-zinc-400">
            Pick one of your recordings and the AI separates it into stems. Mute
            the bass and what is left becomes your backing track — loop it, slow
            it, transpose it.
          </p>
          <span className="mt-1 inline-flex w-fit items-center rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            Coming soon
          </span>
        </div>
      </div>
    </div>
  );
}

export function SplitterPageClient() {
  return (
    <PageErrorBoundary pageName="Splitter">
      <SplitterContent />
    </PageErrorBoundary>
  );
}
