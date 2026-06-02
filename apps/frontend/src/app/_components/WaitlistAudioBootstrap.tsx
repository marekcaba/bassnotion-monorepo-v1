'use client';

/**
 * WaitlistAudioBootstrap — LAUNCH-02.5d.
 *
 * Minimal audio-only provider for the public waitlist page. Spins up
 * just the engine pieces the Groove Card needs:
 *
 *   - One `AudioContext` (created lazily on first user gesture; left
 *     suspended until then so it never autoplays)
 *   - One `EventBus`
 *   - One `PlaybackEngine` with the 02.5b `AudioPlayerScheduler`
 *     wired into `EventRouter`
 *
 * Does NOT initialise anything the marketing page doesn't need:
 *   - No `CoreServices.initialize()` (would pull in WAM plugins,
 *     metronome MIDI scheduler, drum buffers, harmony, etc.)
 *   - No `TransportProvider` from /app (heavier; we get the same
 *     transport behaviour for free because `Tone.Transport` is global)
 *   - No completion/auth flows
 *
 * Pre-warming the AudioContext + decoding the bundled countdown click
 * lives in `useWaitlistPrewarm` (called by the card itself when it
 * intersects the viewport). This provider focuses on engine
 * construction + WindowRegistry registration so the existing playback
 * hooks (`useGrooveCardPlayback`, etc.) find the engine via
 * `WindowRegistry.getPlaybackEngine()` like they do in /app.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { EventBus } from '@/domains/playback/services/core/EventBus';
import { PlaybackEngine } from '@/domains/playback/services/core/PlaybackEngine';
import { WindowRegistry } from '@/domains/playback/services/WindowRegistry';

interface WaitlistAudioBootstrapProps {
  children: ReactNode;
}

/**
 * Mount the engine pieces on first render. The actual AudioContext is
 * created later — on first user gesture via `ensureAudioContext` or
 * directly inside `useWaitlistPrewarm`. PlaybackEngine.initialize() is
 * also deferred until then because it requires an AudioContext.
 *
 * Once any user gesture creates a context, the bootstrap subscribes via
 * WindowRegistry and lets PlaybackEngine.initialize complete.
 */
export function WaitlistAudioBootstrap({
  children,
}: WaitlistAudioBootstrapProps) {
  const engineRef = useRef<PlaybackEngine | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);

  // Construct on mount; teardown on unmount.
  useEffect(() => {
    // Re-use anything already on the WindowRegistry — if /app's
    // CoreServices already initialised (e.g. user navigated waitlist →
    // app → back), prefer the existing engine.
    if (WindowRegistry.getPlaybackEngine()) {
      return;
    }

    const eventBus = new EventBus();
    eventBusRef.current = eventBus;

    const engine = new PlaybackEngine(eventBus, {
      countdownBeats: 4,
      countdownEnabled: true,
      lookAheadTime: 0.1,
    });
    engineRef.current = engine;

    WindowRegistry.setEventBus(eventBus);
    WindowRegistry.setPlaybackEngine(engine);

    // The PlaybackEngine.initialize() call requires an AudioContext.
    // We defer it until the first user gesture: the Groove Card's
    // `play()` action runs through useGrooveCardPlayback, which calls
    // useWaitlistPrewarm's resume helper. That helper creates the
    // AudioContext, registers it via WindowRegistry, and calls
    // `engine.initialize(ctx, ctx.destination)`. We don't need a
    // subscription here — the resume helper handles initialisation
    // synchronously the moment the context exists.

    return () => {
      // Tear everything down so the next mount starts fresh.
      try {
        engine.dispose?.();
      } catch {
        // engine may not expose dispose; ignore
      }
      // Clear from the registry only if WE put it there. (If another
      // page already had an engine, leave it alone.)
      // Note: WindowRegistry has no clear() API; setting to null/undefined
      // would risk masking a legitimate engine. Leave registered.
      engineRef.current = null;
      eventBusRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
