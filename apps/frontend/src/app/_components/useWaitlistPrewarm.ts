'use client';

/**
 * useWaitlistPrewarm — LAUNCH-02.5d.
 *
 * Pre-warm strategy for the waitlist Groove Card. iOS Safari has a
 * documented "first tap silent" risk when the AudioContext is created
 * on the gesture: by the time `ctx.resume()` returns, the gesture's
 * audio window has expired in some Safari versions. Mitigation:
 *
 *   1. When the card first scrolls into view (`IntersectionObserver`),
 *      create the AudioContext (it lands in `suspended` state — no
 *      autoplay), wire `PlaybackEngine.initialize()`, fetch + decode
 *      the bundled `countdown-click.ogg` buffer.
 *   2. The user's Play tap calls `resume()` on the already-existing
 *      context. Resume from `suspended` returns in <10ms (vs ~200-500ms
 *      for the full create+resume path).
 *   3. Pre-warm runs ONCE per page load — re-intersecting after a
 *      scroll-away doesn't re-decode.
 *
 * The hook returns `{ resume, getCountdownClickBuffer }`. The card calls
 * `resume()` from its Play handler (it's idempotent and safe to call
 * even before pre-warm completes). `getCountdownClickBuffer()` returns
 * the decoded buffer or null; the card hands it off to
 * `playbackEngine.setAudioStemBuffers({ 'audio-click': buffer })` so
 * the existing 02.5b stem path plays the countdown.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

export interface UseWaitlistPrewarmOptions {
  /** Ref to the card element. The IntersectionObserver watches this. */
  cardRef: React.RefObject<HTMLElement | null>;
  /** Where to fetch the countdown click sample from (in the
   *  audio-samples Supabase bucket). */
  countdownClickUrl: string;
  /** When false, the hook skips pre-warm. Defaults to true. */
  enabled?: boolean;
}

export interface UseWaitlistPrewarmReturn {
  /** True once the AudioContext exists. May still be suspended. */
  hasContext: boolean;
  /** True once the countdown click buffer has been decoded. */
  hasCountdownClick: boolean;
  /** Resume the AudioContext on user gesture. Safe to call from a Play
   *  click handler. Returns a promise that resolves once the context is
   *  running (or immediately if already running). */
  resume: () => Promise<void>;
  /** Return the decoded countdown click buffer, or null if not yet
   *  decoded. */
  getCountdownClickBuffer: () => AudioBuffer | null;
}

/**
 * Test-only: lets the test harness override `new AudioContext()` so a
 * mock context can be wired in. The real code uses the global
 * `AudioContext` (with the webkit fallback) when this is unset.
 */
let audioContextFactory: (() => AudioContext) | null = null;

/** @internal — test use only. */
export function _setAudioContextFactory(
  factory: (() => AudioContext) | null,
): void {
  audioContextFactory = factory;
}

function createAudioContext(): AudioContext {
  if (audioContextFactory) return audioContextFactory();
  const Ctor =
    typeof window !== 'undefined'
      ? (window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext)
      : undefined;
  if (!Ctor) throw new Error('AudioContext not available in this environment');
  return new Ctor();
}

export function useWaitlistPrewarm({
  cardRef,
  countdownClickUrl,
  enabled = true,
}: UseWaitlistPrewarmOptions): UseWaitlistPrewarmReturn {
  const [hasContext, setHasContext] = useState(false);
  const [hasCountdownClick, setHasCountdownClick] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const countdownBufferRef = useRef<AudioBuffer | null>(null);
  // Guards against re-prewarming after scroll-away → scroll-back.
  const prewarmStartedRef = useRef(false);
  // Guards against double-initialising the engine.
  const engineInitStartedRef = useRef(false);

  // Pre-warm body — extracted so it can be called from either the
  // observer or directly from `resume()` if the user taps before
  // intersection (rare but possible on first-paint).
  const runPrewarm = useCallback(async () => {
    if (prewarmStartedRef.current) return;
    prewarmStartedRef.current = true;

    try {
      // 1. Create the AudioContext. It lands in 'suspended' state in all
      //    modern browsers when constructed without a user gesture. Some
      //    browsers (Safari) auto-resume on gesture later.
      const ctx = createAudioContext();
      audioContextRef.current = ctx;
      WindowRegistry.setAudioContext(ctx);
      setHasContext(true);

      // 2. Initialise the engine with the context. The bootstrap put a
      //    PlaybackEngine on the registry; complete its initialisation
      //    now that we have a context.
      const engine = WindowRegistry.getPlaybackEngine();
      if (engine && !engineInitStartedRef.current) {
        engineInitStartedRef.current = true;
        try {
          await engine.initialize?.(ctx, ctx.destination);
        } catch (err) {
          // Engine may have been initialised by a different path
          // (e.g. /app navigated here and back); ignore double-init.
          void err;
        }
      }

      // 3. Decode the countdown click buffer.
      try {
        const response = await fetch(countdownClickUrl);
        if (!response.ok) {
          throw new Error(`countdown click fetch failed: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        countdownBufferRef.current = buffer;
        setHasCountdownClick(true);
      } catch (err) {
        // Per the story's risk register: missing buffer is non-fatal.
        // The card can either skip countdown or fall back to a tiny
        // in-bundle waveform; v1 just logs and proceeds.
        // eslint-disable-next-line no-console
        console.warn('[useWaitlistPrewarm] countdown decode failed:', err);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useWaitlistPrewarm] prewarm failed:', err);
    }
  }, [countdownClickUrl]);

  // IntersectionObserver: pre-warm on first intersection.
  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;
    const el = cardRef.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      // SSR / very old browsers: just pre-warm immediately.
      void runPrewarm();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            void runPrewarm();
            observer.disconnect();
            break;
          }
        }
      },
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [cardRef, enabled, runPrewarm]);

  // resume() is the gesture-handled hop: if the user clicks Play before
  // the observer has fired (e.g. card is mounted above the fold and the
  // user taps within ~50ms), trigger pre-warm now AND resume the context.
  const resume = useCallback(async () => {
    if (!prewarmStartedRef.current) {
      await runPrewarm();
    }
    const ctx = audioContextRef.current;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[useWaitlistPrewarm] resume failed:', err);
      }
    }
  }, [runPrewarm]);

  const getCountdownClickBuffer = useCallback(() => {
    return countdownBufferRef.current;
  }, []);

  return {
    hasContext,
    hasCountdownClick,
    resume,
    getCountdownClickBuffer,
  };
}
