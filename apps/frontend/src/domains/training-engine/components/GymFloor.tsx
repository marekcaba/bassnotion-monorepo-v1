'use client';

/**
 * GymFloor — the underlying "floor" of the Bass Gym: a grid of EQUIPMENT cards,
 * one per training station (Connecting Chords, Scales, Rhythm, …). The daily
 * "Six minutes." rep sits as an OVERLAY on top of this floor (see gym/page.tsx);
 * dismissing the overlay reveals the floor so a member can self-direct — "train
 * what you want", just like a real gym.
 *
 * Cards are styled as neumorphic stations: raised hardware machined out of the
 * dark surface (dual soft shadows), a recessed icon disc, a per-station LED
 * color, and a quota track. Each station's color is the /app skill-tag palette.
 *
 * ⚠️ MOSTLY PLACEHOLDER. The 8 stations + their progress numbers are STATIC mock
 * data; the equipment tools mostly don't exist yet. The FIRST real one is Scales
 * (route '/gym/scales'); stations with a `route` navigate to their tool and
 * hover-prefetch it (route chunk + audio engine) so the click feels instant.
 */

import { useRef } from 'react';
import {
  Network,
  AudioWaveform,
  Drum,
  Activity,
  Timer,
  Ear,
  Music2,
  Layers,
  Lock,
  type LucideIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { ensureAudioReady } from '@/domains/playback/services/ensureAudioReady';

interface Station {
  key: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  /** LED + accent color (the /app skill-tag palette). */
  color: string;
  /** Mock progress — reps logged / quota. */
  logged: number;
  quota: number;
  /** Locked stations route through another room (e.g. College). */
  lockedBy?: string;
  /** Clean URL the station's tool opens at. Absent = tool not built yet (the card
   *  renders but does nothing on click — a coming-soon placeholder). */
  route?: string;
}

// PLACEHOLDER equipment — the floor's shape, not live data (see file header).
const STATIONS: Station[] = [
  {
    key: 'chords',
    name: 'Connecting Chords',
    desc: 'Voice-lead between changes. Smooth landings on every chord tone.',
    icon: Network,
    color: '#E8A44A',
    logged: 13,
    quota: 21,
  },
  {
    key: 'scales',
    name: 'Scales',
    desc: 'Major, minor, modes — fluent in every position across the neck.',
    icon: AudioWaveform,
    color: '#5B8DEF',
    logged: 21,
    quota: 25,
    route: '/gym/scales', // the first built equipment tool
  },
  {
    key: 'rhythm',
    name: 'Rhythm',
    desc: 'Lock to the click. Build a vocabulary of grooveable patterns.',
    icon: Drum,
    color: '#6BCF8E',
    logged: 9,
    quota: 20,
  },
  {
    key: 'groove',
    name: 'Groove',
    desc: 'Real grooves at real tempos. Sit in the pocket, feel the time.',
    icon: Activity,
    color: '#C77DFF',
    logged: 17,
    quota: 24,
  },
  {
    key: 'timing',
    name: 'Timing',
    desc: 'Tighten your placement. Ahead, behind, dead-center — on command.',
    icon: Timer,
    color: '#FF7EB3',
    logged: 6,
    quota: 18,
  },
  {
    key: 'listening',
    name: 'Listening',
    desc: 'Train your ear. Name intervals, lines, and changes by sound alone.',
    icon: Ear,
    color: '#4EC8C8',
    logged: 11,
    quota: 21,
  },
  {
    key: 'arpeggios',
    name: 'Arpeggios',
    desc: 'Outline harmony cleanly. Triads and 7ths through every inversion.',
    icon: Music2,
    color: '#F0C254',
    logged: 5,
    quota: 19,
  },
  {
    key: 'song-structure',
    name: 'Song Structure',
    desc: 'Map intro, verse, chorus, bridge — know where the bass should go.',
    icon: Layers,
    color: '#8A8AF0',
    logged: 0,
    quota: 0,
    lockedBy: 'College',
  },
];

/** A single neumorphic equipment station. */
function StationCard({ s }: { s: Station }) {
  const Icon = s.lockedBy ? Lock : s.icon;
  const pct = s.quota > 0 ? Math.round((s.logged / s.quota) * 100) : 0;
  const locked = !!s.lockedBy;

  const { navigateWithTransition } = useViewTransitionRouter();
  const router = useRouter();
  const interactive = !locked && !!s.route;

  // Open the station's tool. Only stations with a built route are interactive.
  const handleClick = () => {
    if (interactive) navigateWithTransition(s.route!);
  };

  // HOVER-PREFETCH: warm both the route chunk AND the audio engine the moment the
  // user hovers, so landing on the tool is instant and the FLOOR is never blocked.
  // ensureAudioReady is idempotent + creates the AudioContext SUSPENDED (no sound,
  // no gesture violation), so this is safe speculation — fires once per hover.
  const prefetchedRef = useRef(false);
  const handlePrefetch = () => {
    if (!interactive || prefetchedRef.current) return;
    prefetchedRef.current = true;
    router.prefetch(s.route!);
    void ensureAudioReady();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      // The neumorphic body: a soft gradient surface with a dark recess shadow
      // (lower-right) + a light catch-light (upper-left). The group lets the LED
      // glow + lift fire on hover.
      className="group relative flex min-h-[184px] flex-col overflow-hidden rounded-[22px] p-[26px_24px_22px] text-left transition-all duration-300 hover:-translate-y-1.5"
      style={{
        background:
          'linear-gradient(155deg, #201d25 0%, #17151b 46%, #131117 100%)',
        boxShadow:
          '9px 9px 22px #050406, -7px -7px 18px #221f29, inset 0 1px 0 rgba(255,255,255,0.03)',
        cursor: interactive ? 'pointer' : 'default',
      }}
    >
      {/* LED-colored radial glow, lit on hover */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full opacity-0 blur-lg transition-opacity duration-300 group-hover:opacity-[0.14]"
        style={{
          background: `radial-gradient(circle, ${s.color} 0%, transparent 68%)`,
        }}
      />

      <div className="flex items-center justify-between">
        {/* Recessed icon disc */}
        <span
          className="grid size-[50px] place-items-center rounded-[15px]"
          style={{
            background: '#151318',
            boxShadow: 'inset 3px 3px 7px #050406, inset -3px -3px 7px #221f29',
            color: locked ? '#635d57' : s.color,
          }}
        >
          <Icon className="size-6" strokeWidth={1.7} />
        </span>

        {locked ? (
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-[#635d57]">
            🔒 {s.lockedBy}
          </span>
        ) : (
          <span
            className="size-[9px] animate-pulse rounded-full"
            style={{
              background: s.color,
              boxShadow: `0 0 10px 1px ${s.color}`,
              opacity: 0.85,
            }}
          />
        )}
      </div>

      <h3
        className="mt-5 font-serif text-[22px] leading-tight tracking-[-0.2px]"
        style={{ color: locked ? '#635d57' : '#EDE8DF' }}
      >
        {s.name}
      </h3>
      <p
        className="mt-[7px] flex-1 text-[13px] leading-[1.5]"
        style={{ color: locked ? '#635d57' : '#9A938A' }}
      >
        {s.desc}
      </p>

      {/* Quota track + reps tag */}
      <div className="mt-[18px] flex items-center gap-3">
        <span
          className="h-1.5 flex-1 overflow-hidden rounded-full"
          style={{
            background: '#151318',
            boxShadow: 'inset 2px 2px 4px #050406, inset -1px -1px 3px #221f29',
          }}
        >
          <i
            className="block h-full rounded-full"
            style={{
              width: `${pct}%`,
              background: `linear-gradient(90deg, ${s.color}, color-mix(in srgb, ${s.color} 55%, #fff))`,
              boxShadow: locked ? 'none' : `0 0 8px ${s.color}`,
            }}
          />
        </span>
        <span className="whitespace-nowrap font-mono text-[11px] tracking-[0.5px] text-[#635d57]">
          {locked ? (
            'Unlock in College'
          ) : (
            <>
              <b className="font-medium text-[#9A938A]">{s.logged}</b>/{s.quota}
            </>
          )}
        </span>
      </div>
    </button>
  );
}

export function GymFloor() {
  return (
    <div className="mx-auto w-full max-w-[1320px] px-6 pb-32 pt-2 md:px-10">
      <header className="pb-6 pt-10">
        <p className="mb-3.5 font-mono text-[11px] uppercase tracking-[4px] text-[#635d57]">
          The Floor · Your Equipment
        </p>
        <h1 className="font-serif text-[clamp(30px,5vw,46px)] font-normal leading-[1.02] tracking-[-0.5px] text-[#EDE8DF]">
          Every rack on the floor.{' '}
          <em className="not-italic text-[#E8A44A]">Train what you want.</em>
        </h1>
        <p className="mt-3.5 max-w-[540px] text-[15.5px] leading-relaxed text-[#9A938A]">
          Your daily rep is the coached path — but the whole gym is open. Walk
          up to any station and put in the work.
        </p>
      </header>

      <div className="grid grid-cols-[repeat(auto-fill,minmax(290px,1fr))] gap-[26px]">
        {STATIONS.map((s) => (
          <StationCard key={s.key} s={s} />
        ))}
      </div>
    </div>
  );
}
