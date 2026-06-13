'use client';

/**
 * FreeGrooveExperience — the interactive (free-tier capped) Groove Card +
 * reveal-on-cap Sign up button, mounted on the public `/free/:slug`
 * YouTube-funnel landing page.
 *
 * Each YouTube video's description links to `/free/<tutorial-slug>`; this
 * renders the exact groove from that video so a visitor can play with it
 * immediately. It mirrors the marketing-side scaffolding of
 * `WaitlistGrooveCard` (engine bootstrap + countdown-sample wiring + the
 * 12 dB marketing attenuation) but differs deliberately:
 *
 *   1. The groove comes from the URL slug (resolved server-side and passed
 *      in as `config`), NOT the bundled `WAITLIST_DEMO_CONFIG`.
 *   2. `enableCaps` is ON, so for an anonymous visitor the levers cap at the
 *      unpaid band (tempo / transpose / loop-range / solo).
 *   3. `suppressUpsell` is ON: the card does NOT show its built-in "become a
 *      member" popover. Instead, the FIRST time any lever caps, this surface
 *      reveals its own Sign up button. The cap is the trigger, the Sign up
 *      button is the pitch — no membership panel.
 *
 * Card + button live in the same client island so the cap-hit state can flip
 * the button from hidden → visible. Kept separate from `WaitlistGrooveCard`
 * (the homepage's uncapped surface) on purpose. The countdown-wiring effect
 * below is intentionally identical to `WaitlistGrooveCardInner`'s.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GrooveCardBlockView } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/GrooveCardBlockView';
import type {
  GrooveCardBlock,
  GrooveCardBlockConfig,
} from '@bassnotion/contracts';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';
import { WaitlistAudioBootstrap } from '@/app/_components/WaitlistAudioBootstrap';
import { useWaitlistPrewarm } from '@/app/_components/useWaitlistPrewarm';
import {
  WAITLIST_COUNTDOWN_ACCENT_URL,
  WAITLIST_COUNTDOWN_CLICK_URL,
} from '@/app/_components/waitlistGrooveCard.config';

function FreeGrooveExperienceInner({
  config,
  slug,
}: {
  config: GrooveCardBlockConfig;
  slug: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  // The Sign up button starts hidden and is revealed the first time the
  // visitor bumps a capped lever — the cap itself is the call to action.
  const [revealed, setRevealed] = useState(false);
  const onCapHit = useCallback(() => setRevealed(true), []);

  const {
    getCountdownClickBuffer,
    getCountdownAccentBuffer,
    hasCountdownClick,
    resume,
  } = useWaitlistPrewarm({
    cardRef: containerRef,
    countdownClickUrl: WAITLIST_COUNTDOWN_CLICK_URL,
    countdownAccentUrl: WAITLIST_COUNTDOWN_ACCENT_URL,
  });

  // Wire the decoded count-in samples into the engine + apply the
  // marketing-surface attenuation. Identical to WaitlistGrooveCardInner —
  // see that file for the full rationale on the two engine slots and the
  // 0.2 gain. The waitlist skips CoreServices, so without setMetronomeBuffers
  // the count-in is visible (1-2-3-4) but silent.
  useEffect(() => {
    if (!hasCountdownClick) return;
    const clickBuffer = getCountdownClickBuffer();
    if (!clickBuffer) return;
    const accentBuffer = getCountdownAccentBuffer() ?? clickBuffer;
    const engine = WindowRegistry.getPlaybackEngine();
    if (!engine) return;

    engine.setAudioStemBuffers?.({ 'audio-click': clickBuffer });

    const metronomeGain =
      engine.getOrCreateInstrumentGainNode?.('metronome') ?? null;
    const ctx = WindowRegistry.getAudioContext?.();
    const destination = metronomeGain ?? ctx?.destination ?? null;
    if (!destination) return;
    engine.setMetronomeBuffers?.(accentBuffer, clickBuffer, destination);

    engine.setInstrumentVolume?.('audio-bass', 0.2);
    engine.setInstrumentVolume?.('audio-drums', 0.2);
    engine.setInstrumentVolume?.('audio-harmony', 0.2);
    engine.setInstrumentVolume?.('metronome', 0.2);
  }, [hasCountdownClick, getCountdownClickBuffer, getCountdownAccentBuffer]);

  // Stable, surface-scoped id — only one Free Groove Card mounts per page,
  // and it's never persisted (no DB block_completions on this public path).
  const block: GrooveCardBlock = {
    id: 'free-groove-card',
    type: 'groove-card',
    title: config.title,
    config,
    order: 0,
    showInIsland: false,
  };

  return (
    <div ref={containerRef} className="flex flex-col items-center gap-6">
      <div className="w-full">
        <GrooveCardBlockView
          block={block}
          isActive
          isCompleted={false}
          onComplete={() => undefined}
          onNext={() => undefined}
          mode="waitlist"
          // Free-tier caps ON: anonymous visitors get UNPAID_CAPS (tempo /
          // transpose / loop-range / solo).
          enableCaps
          // No in-card "become a member" popover on the funnel — the cap
          // reveals the Sign up button below instead.
          suppressUpsell
          onCapHit={onCapHit}
          countdownClickUrl={WAITLIST_COUNTDOWN_CLICK_URL}
          // Resume the prewarm's AudioContext inside the user-gesture window
          // (Safari rejects ctx.resume() outside the original tap stack).
          onBeforePlay={resume}
        />
      </div>

      {/* One static line of guidance — no multi-step tour (the YouTube video
          already demoed the card). Says the single thing to try. */}
      <p className="text-center text-[13px] leading-relaxed text-white/45">
        Press play, then mute the bass and take the seat.
      </p>

      {/* Hidden until the visitor hits a cap, then fades in. `?from=<slug>`
          attributes which video converted. Kept mounted (opacity, not
          conditional) so the reveal animates and layout doesn't jump. */}
      <a
        href={`/register?from=${encodeURIComponent(slug)}`}
        aria-hidden={!revealed}
        tabIndex={revealed ? 0 : -1}
        className={[
          'flex h-12 w-full max-w-[280px] items-center justify-center rounded-sm',
          'bg-[#E8650A] text-[14px] font-semibold tracking-[0.04em] text-white',
          'transition-all duration-500 hover:bg-[#B84E08]',
          revealed
            ? 'pointer-events-auto translate-y-0 opacity-100'
            : 'pointer-events-none translate-y-2 opacity-0',
        ].join(' ')}
      >
        Sign up
      </a>
    </div>
  );
}

/**
 * Public entry point the `/free/:slug` page mounts. Provides the minimal
 * audio engine via WaitlistAudioBootstrap and renders the capped card +
 * reveal-on-cap Sign up button.
 */
export function FreeGrooveExperience({
  config,
  slug,
}: {
  config: GrooveCardBlockConfig;
  slug: string;
}) {
  return (
    <WaitlistAudioBootstrap>
      <FreeGrooveExperienceInner config={config} slug={slug} />
    </WaitlistAudioBootstrap>
  );
}
