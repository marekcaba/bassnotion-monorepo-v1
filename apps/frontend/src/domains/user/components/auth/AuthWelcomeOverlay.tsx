'use client';

import { useEffect, useState } from 'react';
import { clearJustLoggedIn } from './justLoggedIn';

/**
 * AuthWelcomeOverlay (Approach B) — the branded welcome beat after a fresh login.
 *
 * SERVER-DECIDED: the /app server layout reads the bn-welcome cookie and passes `show`. When true,
 * this renders in the FIRST HTML paint — the opaque overlay covers Backstage from frame one, so
 * there's no client-side "Backstage → overlay → Backstage" flash. It shows the BASSICOLOGY logo
 * (with the glow) over the same app gradient for a beat, then fades out revealing the Backstage that
 * loaded behind it. Backstage carries its own LeatherBackground, so the leather is CONTINUOUS —
 * only the logo appears then dissolves.
 *
 * On mount the client clears the bn-welcome cookie (non-httpOnly) so it fires exactly once — never
 * on a refresh. When show=false it renders null (zero cost on normal navigation).
 */

// How long the logo is held before it begins to fade (ms) + the fade duration (ms).
const HOLD_MS = 900;
const FADE_MS = 650;

export function AuthWelcomeOverlay({ show }: { show: boolean }) {
  // 'show' = opaque; 'fading' = fading out; 'done' = fully gone.
  const [phase, setPhase] = useState<'show' | 'fading' | 'done'>('show');

  useEffect(() => {
    if (!show) return;
    // Clear the one-shot cookie immediately so a refresh won't re-show the overlay.
    clearJustLoggedIn();
    const fadeAt = window.setTimeout(() => setPhase('fading'), HOLD_MS);
    const doneAt = window.setTimeout(() => setPhase('done'), HOLD_MS + FADE_MS);
    return () => {
      window.clearTimeout(fadeAt);
      window.clearTimeout(doneAt);
    };
  }, [show]);

  if (!show || phase === 'done') return null;

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
      {/* authWelcomeRise + the reduced-motion rule live in globals.css (the .auth-welcome-logo
          class) — NOT an inline <style> here, which would break SSR hydration (React #418). */}
      <h1
        className="auth-welcome-logo font-heading select-none text-center text-[clamp(44px,8vw,84px)] font-normal uppercase leading-[0.9] tracking-[0.12em] text-[#E8650A]"
        style={{
          textShadow:
            '0 0 8px rgba(232,101,10,0.13), 0 0 13px rgba(232,101,10,0.15)',
          animation: 'authWelcomeRise 0.55s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        Bassicology
      </h1>
    </div>
  );
}
