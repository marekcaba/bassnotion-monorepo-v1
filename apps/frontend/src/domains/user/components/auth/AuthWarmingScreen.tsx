'use client';

import { LeatherBackground } from '@/shared/components/LeatherBackground';

/**
 * AuthWarmingScreen — the branded "signing you in" moment shown on /auth/callback while the OAuth
 * code is exchanged, before the redirect to /backstage. Uses the app's real surface: the same dark
 * radial base + LeatherBackground texture the /app shell uses, with the amber GLOW on the
 * BASSICOLOGY wordmark itself (a breathing layered text-shadow) — the stage lights coming up, not a
 * bare loading page.
 *
 * Pure CSS animation (no framer-motion in this app). Self-contained apart from LeatherBackground.
 */
export function AuthWarmingScreen({
  message = 'Warming up your session',
}: {
  message?: string;
}) {
  return (
    <div
      className="relative flex h-svh w-screen flex-col items-center justify-center overflow-hidden px-6"
      style={{
        // Same dark base as the /app shell — LeatherBackground's screen-blend needs it beneath.
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
      }}
    >
      {/* The app's real leather + grain surface (z-0). */}
      <LeatherBackground />

      <div
        className="relative z-10 flex flex-col items-center"
        style={{ animation: 'authRise 0.6s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        {/* Wordmark — the anchor. Amber condensed display face; the glow lives ON the logo
            (breathing layered text-shadow: a tight core + a soft bloom). */}
        <h1
          className="font-heading select-none text-center text-[clamp(44px,8vw,84px)] font-normal uppercase leading-[0.9] tracking-[0.12em] text-[#E8650A]"
          style={{
            textShadow:
              '0 0 8px rgba(232,101,10,0.13), 0 0 13px rgba(232,101,10,0.15)',
            animation: 'authLogoGlow 2.8s ease-in-out infinite',
          }}
        >
          Bassicology
        </h1>

        {/* A thin "tuning" line — a warm sweep that runs edge-to-edge, evoking an instrument
            being plugged in + warming up. This is the load indicator, reimagined as a fretline. */}
        <div className="relative mt-9 h-px w-[min(340px,72vw)] overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="absolute inset-y-0 left-0 w-1/2 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #ffc700 45%, #E8A44A 55%, transparent 100%)',
              animation: 'authTune 1.5s cubic-bezier(0.65,0,0.35,1) infinite',
            }}
          />
        </div>

        {/* Status line — small, wide-tracked, muted; matches the login/settings label voice. */}
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8A8A8A]">
          {message}
        </p>
      </div>

      {/* Component-scoped keyframes so this stays self-contained. */}
      <style>{`
        @keyframes authLogoGlow {
          0%, 100% { text-shadow: 0 0 8px rgba(232,101,10,0.13), 0 0 13px rgba(232,101,10,0.15); }
          50%      { text-shadow: 0 0 10px rgba(232,101,10,0.25), 0 0 17px rgba(232,101,10,0.27); }
        }
        @keyframes authRise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authTune {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="authLogoGlow"], [style*="authTune"], [style*="authRise"] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
