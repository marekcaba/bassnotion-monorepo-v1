'use client';

import { useEffect, useState } from 'react';
import { consumeJustLoggedIn } from './justLoggedIn';

/**
 * AuthWelcomeOverlay (Approach B) — the branded welcome beat after a fresh login.
 *
 * Mounted in the /app shell ABOVE the content. On mount it consumes the one-shot "just logged in"
 * flag (see justLoggedIn.ts); if set, it shows the BASSICOLOGY logo — with the glow — over an
 * OPAQUE base for a beat, then fades the whole overlay out, revealing the Backstage that has been
 * loading behind it the whole time. Because Backstage carries its own LeatherBackground, the leather
 * surface is CONTINUOUS: the overlay's own base fades to transparent onto the identical leather, so
 * the background never flashes — only the logo appears then dissolves.
 *
 * Fires exactly once per fresh login (flag is read-and-cleared), for EVERY method (email / OAuth /
 * magic-link), and never on a normal load or refresh. Renders null when there's nothing to show.
 */

// Total time the logo is held before it begins to fade (ms) + the fade duration (ms).
const HOLD_MS = 900;
const FADE_MS = 650;

export function AuthWelcomeOverlay() {
  // 'show' = overlay mounted + opaque; 'fading' = fading out; null = gone (renders nothing).
  const [phase, setPhase] = useState<'show' | 'fading' | null>(null);

  useEffect(() => {
    if (!consumeJustLoggedIn()) return; // not a fresh login → never render.
    setPhase('show');
    const fadeAt = window.setTimeout(() => setPhase('fading'), HOLD_MS);
    const doneAt = window.setTimeout(() => setPhase(null), HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(doneAt);
    };
  }, []);

  if (phase === null) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
      style={{
        // Opaque base over the SAME app gradient, so the leather beneath reads continuous as we fade.
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
        opacity: phase === 'fading' ? 0 : 1,
        transition: `opacity ${FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      <h1
        className="font-heading select-none text-center text-[clamp(44px,8vw,84px)] font-normal uppercase leading-[0.9] tracking-[0.12em] text-[#E8650A]"
        style={{
          textShadow:
            '0 0 8px rgba(232,101,10,0.13), 0 0 13px rgba(232,101,10,0.15)',
          animation: 'authWelcomeRise 0.55s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        Bassicology
      </h1>

      <style>{`
        @keyframes authWelcomeRise {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="authWelcomeRise"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
