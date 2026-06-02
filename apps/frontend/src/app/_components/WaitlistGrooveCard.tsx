'use client';

/**
 * WaitlistGrooveCard — LAUNCH-02.5d.
 *
 * Mounts the real <GrooveCardBlockView mode="waitlist" /> on the public
 * marketing page. Wraps it in <WaitlistAudioBootstrap> (so the
 * playback engine exists), drives the IntersectionObserver pre-warm
 * via useWaitlistPrewarm, pipes the decoded countdown click into the
 * engine once available, and passes the prewarm's `resume` function as
 * `onBeforePlay` so the AudioContext is resumed inside the user-gesture
 * window when the visitor clicks Play.
 *
 * The card itself doesn't know it's on the waitlist beyond the `mode`
 * prop — every behaviour change (±4 key cap, cap-hit telemetry, no
 * lazy outer-key loads) is encapsulated in useGrooveCardPlayback. This
 * file is just the marketing-side scaffolding.
 */

import { useEffect, useRef, useState } from 'react';
import { GrooveCardBlockView } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/GrooveCardBlockView';
import type {
  GrooveCardBlock,
  GrooveCardBlockConfig,
} from '@bassnotion/contracts';
import type { FeaturedGroove } from '../page';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';
import { WaitlistAudioBootstrap } from './WaitlistAudioBootstrap';
import { useWaitlistPrewarm } from './useWaitlistPrewarm';
import {
  WAITLIST_DEMO_BLOCK_ID,
  WAITLIST_DEMO_CONFIG,
  WAITLIST_COUNTDOWN_ACCENT_URL,
  WAITLIST_COUNTDOWN_CLICK_URL,
} from './waitlistGrooveCard.config';

/**
 * Wire the pre-warm hook to a card container. Lives inside the
 * bootstrap so it can read from WindowRegistry once the bootstrap has
 * populated it.
 */
/** Initial waveform peak colour. Picked in [WaitlistGrooveCard] via the
 *  dev-only colour picker; once you settle on a value, paste it here and
 *  the picker will start from it the next reload. */
const INITIAL_WAVEFORM_COLOR = '#1f252e';

function WaitlistGrooveCardInner({
  featuredGroove,
}: {
  featuredGroove: FeaturedGroove | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
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

  // Dev-only live colour picker for the waveform peaks. The picker UI
  // is currently commented out below — uncomment the `<WaveformColorPicker>`
  // block in the JSX (and switch `_setWaveformColor` back to
  // `setWaveformColor`) to retune. The state itself stays in place so
  // re-enabling is a localized diff. Setter prefixed with `_` because
  // ESLint's unused-vars rule allows `^_`-prefixed identifiers.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [waveformColor, _setWaveformColor] = useState(INITIAL_WAVEFORM_COLOR);

  // Once the countdown samples are decoded, wire them into TWO engine
  // slots:
  //
  //   1. `audio-click` audio-stem buffer — the same path the 02.5b stem
  //      pipeline already uses (currently no scheduled regions consume
  //      this slot, but registering keeps the engine state aligned).
  //   2. The MetronomeScheduler via `setMetronomeBuffers` — this is the
  //      slot `PlaybackEngine.addCountdownRegion` schedules into. In /app
  //      `CoreServices` calls it from `MetronomePreloadStrategy`; the
  //      waitlist skips CoreServices, so without this call the count-in
  //      MIDI track lands at `MetronomeScheduler.schedule()` with no
  //      destination ("hasDestination: false") and falls back to a
  //      no-op EventBus dispatch — visible 1-2-3-4 but no audible click.
  //
  // Accent (beat 1) uses the high-pitched sample; click (beats 2-4) uses
  // the low-pitched one — matching the in-app metronome exactly. If the
  // accent buffer didn't decode (network / decode failure), fall back to
  // the click on every beat so we still get an audible count-in.
  useEffect(() => {
    if (!hasCountdownClick) return;
    const clickBuffer = getCountdownClickBuffer();
    if (!clickBuffer) return;
    const accentBuffer = getCountdownAccentBuffer() ?? clickBuffer;
    const engine = WindowRegistry.getPlaybackEngine();
    if (!engine) return;

    engine.setAudioStemBuffers?.({ 'audio-click': clickBuffer });

    // Prefer the per-instrument gain node so the metronome respects the
    // user-facing click toggle / volume state if it's ever wired in.
    // Fall back to ctx.destination so an early call (before the gain
    // node exists) still produces audible clicks.
    const metronomeGain =
      engine.getOrCreateInstrumentGainNode?.('metronome') ?? null;
    const ctx = WindowRegistry.getAudioContext?.();
    const destination = metronomeGain ?? ctx?.destination ?? null;
    if (!destination) return;
    engine.setMetronomeBuffers?.(accentBuffer, clickBuffer, destination);

    // Marketing-surface attenuation: drop the demo by 12 dB (gain 0.25)
    // so a visitor with their system volume set for typical browsing
    // doesn't get blasted. /app keeps the engine's 0.8 default. We write
    // to the SAME per-instrument GainNodes every scheduler terminates
    // into (AudioPlayerScheduler stem path, RegionScheduler infinite-
    // audio loop, MetronomeScheduler velocity path), so a single 0.25
    // covers bass / drums / harmony AND the count-in click with one knob.
    engine.setInstrumentVolume?.('audio-bass', 0.2);
    engine.setInstrumentVolume?.('audio-drums', 0.2);
    engine.setInstrumentVolume?.('audio-harmony', 0.2);
    engine.setInstrumentVolume?.('metronome', 0.2);
  }, [hasCountdownClick, getCountdownClickBuffer, getCountdownAccentBuffer]);

  // Pick the live admin-authored config when the SSR fetch succeeded;
  // otherwise stick with the bundled `WAITLIST_DEMO_CONFIG` so the page
  // renders even if the backend was unreachable at request time. The
  // tutorial's title drives the card headline — that's the editable
  // field admins touch in the /app tutorial editor's "Edit tutorial-info"
  // modal.
  const config: GrooveCardBlockConfig =
    featuredGroove?.grooveConfig ?? WAITLIST_DEMO_CONFIG;
  const title = featuredGroove?.tutorialTitle ?? WAITLIST_DEMO_CONFIG.title;

  const block: GrooveCardBlock = {
    id: WAITLIST_DEMO_BLOCK_ID,
    type: 'groove-card',
    title,
    config: { ...config, title },
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
        // Match the "Why It Works" Dial cards below (#100E0D), so the
        // groove card sits in the same visual column on the dark page.
        bg="#100E0D"
        // Sky-blue waveform — the in-app player keeps the default
        // orange so the audio shape pops; on the marketing page the
        // orange waveform would compete with the orange-accented
        // headline. Blue lets the card sit quietly in the layout.
        waveformColor={waveformColor}
        // Resume the prewarm's AudioContext inside the user-gesture
        // window. Without this, Safari may reject `ctx.resume()` if it
        // fires outside the original tap stack.
        onBeforePlay={resume}
      />
      {/*
        Dev-only live colour picker for the waveform peaks. Uncomment
        the block below (and switch the `_setWaveformColor` destructure
        above back to `setWaveformColor`) to retune the shade. The
        `WaveformColorPicker` component definition stays in this file so
        re-enabling is the smallest possible diff.

        {process.env.NODE_ENV !== 'production' && (
          <WaveformColorPicker
            color={waveformColor}
            onChange={setWaveformColor}
          />
        )}
      */}
    </div>
  );
}

/**
 * Dev-only floating control for tuning the waveform peak colour live.
 * Renders a small fixed panel in the bottom-right of the viewport with
 * a native `<input type="color">` and the current hex (click-to-copy).
 *
 * Currently DISABLED — the call site in `WaitlistGrooveCardInner` is
 * commented out. The ESLint disable below tells the linter the function
 * is intentionally unused (a real `_`-prefix would trip the react-hooks
 * rule because hooks must live inside Capital-first components). To
 * re-enable: uncomment the JSX block in `WaitlistGrooveCardInner` and
 * switch `_setWaveformColor` back to `setWaveformColor` above.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function WaveformColorPicker({
  color,
  onChange,
}: {
  color: string;
  onChange: (next: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 12,
        right: 12,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'rgba(0, 0, 0, 0.78)',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.85)',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(6px)',
      }}
      aria-label="Waveform colour picker (dev only)"
    >
      <span style={{ opacity: 0.55 }}>peaks</span>
      <input
        type="color"
        value={color}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 28,
          height: 22,
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label="Waveform peak colour"
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(color);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          } catch {
            /* clipboard may be denied; silent */
          }
        }}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'inherit',
          font: 'inherit',
          cursor: 'pointer',
          padding: '2px 4px',
        }}
        title="Click to copy hex"
      >
        {copied ? 'copied' : color}
      </button>
    </div>
  );
}

/**
 * Top-level component the WaitlistClient mounts where the mockup used
 * to be. Provides the engine via WaitlistAudioBootstrap and renders
 * the card inside.
 */
export function WaitlistGrooveCard({
  featuredGroove,
}: {
  /** Optional admin-authored override. When provided, the tutorial
   *  title drives the card headline and the groove-card block's config
   *  drives every audio parameter (stems, BPM, key sets, length). When
   *  null, the card falls back to the bundled `WAITLIST_DEMO_CONFIG` so
   *  the page renders even if the fetch failed. */
  featuredGroove?: FeaturedGroove | null;
}) {
  return (
    <WaitlistAudioBootstrap>
      <WaitlistGrooveCardInner featuredGroove={featuredGroove ?? null} />
    </WaitlistAudioBootstrap>
  );
}
