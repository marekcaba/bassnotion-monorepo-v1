'use client';

import { useEffect, useState } from 'react';
import { clearJustLoggedIn } from './justLoggedIn';

/** How long the welcome logo holds before it fades (ms) + the crossfade duration (ms). */
export const WELCOME_HOLD_MS = 1600;
export const WELCOME_FADE_MS = 700;

export type WelcomePhase = 'show' | 'fading' | 'done';

/**
 * Owns the post-login welcome timing so the OVERLAY (logo, fading OUT) and the CONTENT (Backstage,
 * fading IN) stay in lockstep — one source of truth drives both, so the crossfade is exact.
 *
 * `show` is server-decided (bn-welcome cookie). When true: phase starts 'show' (logo opaque, content
 * hidden), → 'fading' after HOLD (logo fades out, content fades in), → 'done' after FADE (overlay
 * gone). Clears the one-shot cookie on mount so it fires exactly once. When show=false: always 'done'.
 */
export function useWelcomePhase(show: boolean): WelcomePhase {
  const [phase, setPhase] = useState<WelcomePhase>(show ? 'show' : 'done');

  useEffect(() => {
    if (!show) return;
    clearJustLoggedIn();
    const fadeAt = window.setTimeout(() => setPhase('fading'), WELCOME_HOLD_MS);
    const doneAt = window.setTimeout(
      () => setPhase('done'),
      WELCOME_HOLD_MS + WELCOME_FADE_MS,
    );
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(doneAt);
    };
  }, [show]);

  return phase;
}
