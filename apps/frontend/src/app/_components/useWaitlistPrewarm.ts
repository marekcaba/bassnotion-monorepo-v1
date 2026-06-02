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
 *      load Tone.js (so the engine's `getTone()` helpers find it on
 *      `window.Tone`/`__globalTone`), create the AudioContext (it lands
 *      in `suspended` state — no autoplay), register the context as
 *      BOTH the WindowRegistry slot AND `window.__persistentAudioContext`
 *      so legacy and new-arch consumers see the same instance, wire
 *      `PlaybackEngine.initialize()`, fetch + decode the bundled
 *      `countdown-click.ogg` buffer.
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
import { InstrumentDependencyManager } from '@/domains/playback/services/InstrumentDependencyManager';

export interface UseWaitlistPrewarmOptions {
  /** Ref to the card element. The IntersectionObserver watches this. */
  cardRef: React.RefObject<HTMLElement | null>;
  /** Where to fetch the countdown click sample (beats 2-4) from. */
  countdownClickUrl: string;
  /** Optional accent sample for beat 1. When omitted the click buffer
   *  is reused on every beat. The waitlist passes the high-pitched
   *  metronome sample so the count-in is tonally identical to /app. */
  countdownAccentUrl?: string;
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
  /** Return the decoded countdown click buffer (beats 2-4), or null if
   *  not yet decoded. */
  getCountdownClickBuffer: () => AudioBuffer | null;
  /** Return the decoded countdown accent buffer (beat 1), or null if
   *  either no `countdownAccentUrl` was passed or it hasn't decoded yet.
   *  Callers that want a uniform click on every beat can fall back to
   *  `getCountdownClickBuffer()` when this returns null. */
  getCountdownAccentBuffer: () => AudioBuffer | null;
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
  countdownAccentUrl,
  enabled = true,
}: UseWaitlistPrewarmOptions): UseWaitlistPrewarmReturn {
  const [hasContext, setHasContext] = useState(false);
  const [hasCountdownClick, setHasCountdownClick] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const countdownBufferRef = useRef<AudioBuffer | null>(null);
  const countdownAccentBufferRef = useRef<AudioBuffer | null>(null);
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
      // 1. Load Tone.js BEFORE we create the context. Every downstream
      //    consumer (`PlaybackEngine.start`, `ensureAudioContext`,
      //    `RegionScheduler`, `getToneTransportFallback`) reads
      //    `window.Tone || window.__globalTone` and throws if neither is
      //    populated. `InstrumentDependencyManager.getTone()` is the only
      //    helper that writes BOTH slots (strategy 4 of its loader chain)
      //    AND is idempotent / promise-deduped, so it's safe to call from
      //    both the IntersectionObserver path and the `resume()` race-case
      //    path without firing two `import('tone')` calls. No side
      //    effects beyond the two window writes — does not pull in
      //    CoreServices / WAM / metronome / sampler loading.
      await InstrumentDependencyManager.getTone();

      // 2. Create the AudioContext. It lands in 'suspended' state in all
      //    modern browsers when constructed without a user gesture. Some
      //    browsers (Safari) auto-resume on gesture later.
      const ctx = createAudioContext();
      audioContextRef.current = ctx;

      // 3. Register the context. `WindowRegistry.setAudioContext` writes
      //    to `window.__bassnotion_audioContext` AND deletes the legacy
      //    `__persistentAudioContext` key — but `getPersistentAudioContext()`
      //    (audioContext.ts) reads only `__persistentAudioContext`. So we
      //    set both: the WindowRegistry call satisfies new-arch consumers,
      //    and the inline write — performed AFTER the registry call so the
      //    registry's `delete` doesn't undo it — satisfies the legacy
      //    persistent-context helpers that `ensureAudioContext` walks
      //    inside the play handler. Without this, `getOrCreatePersistentAudioContext`
      //    would create a SECOND AudioContext at play-time, decoupled
      //    from the one the engine + click buffer were bound to.
      WindowRegistry.setAudioContext(ctx);
      if (typeof window !== 'undefined') {
        window.__persistentAudioContext = ctx;
      }
      setHasContext(true);

      // 4. Initialise the engine with the context. The bootstrap put a
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

      // 5. Decode the countdown samples. The click (beats 2-4) is
      //    required for the count-in to be audible at all; the accent
      //    (beat 1) is optional — when absent or it fails, callers can
      //    fall back to the click on every beat.
      //
      //    Run both fetches in parallel: the two metronome samples are
      //    ~5 KB each, so the cost of an extra parallel fetch is well
      //    below the savings of avoiding a serial waterfall.
      const decode = async (url: string): Promise<AudioBuffer> => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`countdown sample fetch failed: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return ctx.decodeAudioData(arrayBuffer);
      };

      const [clickResult, accentResult] = await Promise.allSettled([
        decode(countdownClickUrl),
        countdownAccentUrl
          ? decode(countdownAccentUrl)
          : Promise.resolve(null as unknown as AudioBuffer),
      ]);

      if (clickResult.status === 'fulfilled') {
        countdownBufferRef.current = clickResult.value;
        setHasCountdownClick(true);
      } else {
        // Per the story's risk register: missing buffer is non-fatal.
        // The card can either skip countdown or fall back to a tiny
        // in-bundle waveform; v1 just logs and proceeds.
        // eslint-disable-next-line no-console
        console.warn(
          '[useWaitlistPrewarm] countdown click decode failed:',
          clickResult.reason,
        );
      }
      if (accentResult.status === 'fulfilled' && accentResult.value) {
        countdownAccentBufferRef.current = accentResult.value;
      } else if (countdownAccentUrl && accentResult.status === 'rejected') {
        // eslint-disable-next-line no-console
        console.warn(
          '[useWaitlistPrewarm] countdown accent decode failed (falling back to click):',
          accentResult.reason,
        );
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[useWaitlistPrewarm] prewarm failed:', err);
    }
  }, [countdownClickUrl, countdownAccentUrl]);

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

  const getCountdownAccentBuffer = useCallback(() => {
    return countdownAccentBufferRef.current;
  }, []);

  return {
    hasContext,
    hasCountdownClick,
    resume,
    getCountdownClickBuffer,
    getCountdownAccentBuffer,
  };
}
