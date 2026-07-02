'use client';

/**
 * /app/library (clean URL /library) — the member's VAULT. A 5th room next to Backstage / Gym /
 * College / Gigs: the archive of what they've made and the shelf of what they play to.
 *
 * Three sections (scaffolded here; each fills in behind its own follow-up):
 *   1. Recordings        — their submitted + captured takes, replayable in context.
 *   2. Stem Splitter     — upload a track → AI separates it into stems (bass mutable → backing track).
 *   3. Playlists & Music — their playlists + platform-recommended tracks to practice against.
 *
 * LIGHT FIRST PAINT: section shells only — no audio engine. Playback mounts on interaction; the
 * engine warms in the background (routeCanReachAudio includes /app/library), like the gigs list.
 */

import type { ComponentType } from 'react';
import {
  Library as LibraryIcon,
  Mic,
  Scissors,
  ListMusic,
} from 'lucide-react';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';

interface LibrarySection {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

// The three shelves of the vault. Rendered as section cards for the first version; each becomes a
// live panel behind its own follow-up (recordings history, the stem splitter, the playlist shelf).
const SECTIONS: LibrarySection[] = [
  {
    icon: Mic,
    title: 'Recordings',
    description:
      'Every take you capture and submit, kept here and replayable in context — hear where you were a month ago against where you are now.',
  },
  {
    icon: Scissors,
    title: 'Stem Splitter',
    description:
      'Upload a track and the AI separates it into stems. Mute the bass and it becomes your backing track — loop it, slow it, transpose it.',
  },
  {
    icon: ListMusic,
    title: 'Playlists & Music',
    description:
      'Your playlists plus tracks the platform recommends for what you are working on — the shelf you reach for when you sit down to play.',
  },
];

function LibraryContent() {
  // Top-anchored, horizontally centered — matches Backstage / Gigs. Not vertically centered: the
  // sections below grow as they gain content, so anchoring to the top keeps the headline fixed.
  return (
    <div className="flex min-h-[calc(100svh-4rem)] w-full flex-col items-center p-6 pt-[12vh] md:p-10 md:pt-[12vh]">
      <div className="flex w-full max-w-4xl flex-col items-center space-y-10">
        <div className="w-full text-left">
          <div className="flex items-center gap-3.5">
            <LibraryIcon className="size-10 shrink-0 text-[#ffc700]" />
            <h1 className="font-heading text-[clamp(34px,5vw,52px)] uppercase leading-none tracking-[0.01em] text-zinc-100">
              Library
            </h1>
          </div>
          <p className="mt-4 text-zinc-400">
            Your vault — recordings, the stem splitter, and the music you play to.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-3">
          {SECTIONS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6"
            >
              <div className="flex items-center gap-3">
                <Icon className="size-6 shrink-0 text-[#ffc700]" />
                <h2 className="font-heading text-lg uppercase tracking-[0.04em] text-zinc-100">
                  {title}
                </h2>
              </div>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-zinc-400">
                {description}
              </p>
              <span className="mt-5 inline-flex w-fit items-center rounded-full border border-white/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
                Coming soon
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function LibraryPageClient() {
  return (
    <PageErrorBoundary pageName="Library">
      <LibraryContent />
    </PageErrorBoundary>
  );
}
