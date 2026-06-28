'use client';

/**
 * /app/gym/scales (clean URL /gym/scales) — the Scales equipment station.
 *
 * A LEAF route under the gym floor: the engine mounts here (audioRoutes →
 * routeNeedsAudioProvider matches /app/gym/), NOT on the floor itself, so the floor
 * stays instant. The /gym floor pre-warms the engine on idle (routeCanReachAudio), and
 * the floor's station card hover-prefetches this route + the engine — so landing here
 * is fast.
 */

import { ScalesTool } from '@/domains/training-engine/equipment/scales/ScalesTool';
import { WAITLIST_DEMO_CONFIG } from '@/app/_components/waitlistGrooveCard.config';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';

export default function GymScalesPage() {
  // The user's bass config (string count + neck length) — the SAME source the
  // tutorial fretboard reads (YouTubeWidgetPage.tsx:378-379), so a 5-string player
  // sees their own neck here too. Defaults match the tutorial (4-string, 25 frets).
  const { profile } = useUserProfile();
  const stringCount = profile?.preferences?.bassConfiguration?.stringCount ?? 4;
  const maxFrets = profile?.preferences?.bassConfiguration?.maxFrets ?? 25;

  // Backing groove for now (real transport + the shared clock the fretboard rides).
  // Chord/drone/metronome-only backing per scale is a later content decision.
  //
  // WIDTH + CENTERING: identical to the real groove card's container in the tutorial
  // player (YouTubeWidgetPage.tsx:1594) — the "grab the same dumbbell" familiarity
  // depends on the tool being the EXACT same size/position as the card it echoes.
  return (
    <>
      {/* Vertically + horizontally center in the content area, like the gym floor
          (flex items-center justify-center). The inner div keeps the groove-card's
          exact responsive width. */}
      <div className="flex min-h-[calc(100svh-2rem)] w-full items-center justify-center px-4">
        <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px]">
          <ScalesTool
            backingConfig={WAITLIST_DEMO_CONFIG}
            stringCount={stringCount}
            maxFrets={maxFrets}
          />
        </div>
      </div>
    </>
  );
}
