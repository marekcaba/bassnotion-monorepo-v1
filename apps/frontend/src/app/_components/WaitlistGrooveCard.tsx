'use client';

/**
 * WaitlistGrooveCard — LAUNCH-02.5d.
 *
 * Mounts the real <GrooveCardBlockView mode="waitlist" /> on the public
 * marketing page. Wraps it in <WaitlistAudioBootstrap> (so the
 * playback engine exists), drives the IntersectionObserver pre-warm
 * via useWaitlistPrewarm, and pipes the decoded countdown click into
 * the engine once available.
 *
 * The card itself doesn't know it's on the waitlist beyond the `mode`
 * prop — every behaviour change (±4 key cap, cap-hit telemetry, no
 * lazy outer-key loads) is encapsulated in useGrooveCardPlayback. This
 * file is just the marketing-side scaffolding.
 */

import { useEffect, useRef } from 'react';
import { GrooveCardBlockView } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/GrooveCardBlockView';
import type { GrooveCardBlock } from '@bassnotion/contracts';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';
import { WaitlistAudioBootstrap } from './WaitlistAudioBootstrap';
import { useWaitlistPrewarm } from './useWaitlistPrewarm';
import {
  WAITLIST_DEMO_BLOCK_ID,
  WAITLIST_DEMO_CONFIG,
  WAITLIST_COUNTDOWN_CLICK_URL,
} from './waitlistGrooveCard.config';

/**
 * Wire the pre-warm hook to a card container. Lives inside the
 * bootstrap so it can read from WindowRegistry once the bootstrap has
 * populated it.
 */
function WaitlistGrooveCardInner() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const { getCountdownClickBuffer, hasCountdownClick } = useWaitlistPrewarm({
    cardRef: containerRef,
    countdownClickUrl: WAITLIST_COUNTDOWN_CLICK_URL,
  });

  // Once the countdown click buffer is decoded, push it into the
  // engine's audio-stem buffer slot so the 02.5b stem path handles it
  // exactly like any other audio stem. The card itself drives the
  // countdown timing via 02.5c's hook.
  useEffect(() => {
    if (!hasCountdownClick) return;
    const buffer = getCountdownClickBuffer();
    if (!buffer) return;
    const engine = WindowRegistry.getPlaybackEngine();
    engine?.setAudioStemBuffers?.({ 'audio-click': buffer });
  }, [hasCountdownClick, getCountdownClickBuffer]);

  const block: GrooveCardBlock = {
    id: WAITLIST_DEMO_BLOCK_ID,
    type: 'groove-card',
    title: WAITLIST_DEMO_CONFIG.title,
    config: WAITLIST_DEMO_CONFIG,
    order: 0,
    showInIsland: false,
  };

  return (
    <div ref={containerRef}>
      <GrooveCardBlockView
        block={block}
        isActive
        isCompleted={false}
        onComplete={() => undefined}
        onNext={() => undefined}
        mode="waitlist"
        countdownClickUrl={WAITLIST_COUNTDOWN_CLICK_URL}
      />
    </div>
  );
}

/**
 * Top-level component the WaitlistClient mounts where the mockup used
 * to be. Provides the engine via WaitlistAudioBootstrap and renders
 * the card inside.
 */
export function WaitlistGrooveCard() {
  return (
    <WaitlistAudioBootstrap>
      <WaitlistGrooveCardInner />
    </WaitlistAudioBootstrap>
  );
}
