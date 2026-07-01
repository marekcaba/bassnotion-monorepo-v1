'use client';

/**
 * AuthWarmingScreen — the branded "signing you in" moment shown on /auth/callback while the OAuth
 * code is exchanged, before the redirect to /backstage. Matches the platform's dark leather + amber
 * aesthetic (the same radial-gradient base as the app shell + login). Reads as an intentional
 * "warming up your session" beat — the stage lights coming up — not a bare loading page.
 *
 * Pure CSS animation (no framer-motion in this app). Self-contained; drop it in wherever the
 * callback needs a waiting state.
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
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
      }}
    >
      {/* Amber stage-glow that breathes behind the wordmark — like an amp powering on. */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[130%]"
        style={{
          width: '520px',
          height: '520px',
          background:
            'radial-gradient(circle, rgba(232,101,10,0.22) 0%, rgba(232,101,10,0.08) 35%, transparent 68%)',
          filter: 'blur(8px)',
          animation: 'authGlowBreathe 2.6s ease-in-out infinite',
        }}
      />

      {/* Fine grain/vignette overlay for depth (no hard edges). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.5]"
        style={{
          background:
            'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(0,0,0,0.55) 100%)',
        }}
      />

      <div
        className="relative flex flex-col items-center"
        style={{ animation: 'authRise 0.6s cubic-bezier(0.22,1,0.36,1) both' }}
      >
        {/* Wordmark — the anchor. Amber, condensed display face, wide tracking. */}
        <h1 className="font-heading select-none text-center text-[clamp(40px,7vw,72px)] font-normal uppercase leading-[0.9] tracking-[0.12em] text-[#E8650A] [text-shadow:0_0_36px_rgba(232,101,10,0.35)]">
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

        {/* Status line — small, wide-tracked, muted; matches the login/settings label voice.
            The trailing dots animate via ::after so the copy stays clean. */}
        <p className="auth-warming-status mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8A8A8A]">
          {message}
        </p>
      </div>

      {/* Component-scoped keyframes so this stays fully self-contained. */}
      <style>{`
        @keyframes authGlowBreathe {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -130%) scale(1); }
          50%      { opacity: 1;    transform: translate(-50%, -130%) scale(1.08); }
        }
        @keyframes authRise {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes authTune {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
        .auth-warming-status::after {
          content: '';
          animation: authDots 1.6s steps(1, end) infinite;
        }
        @keyframes authDots {
          0%   { content: ''; }
          25%  { content: '.'; }
          50%  { content: '..'; }
          75%  { content: '...'; }
          100% { content: ''; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="authGlowBreathe"], [style*="authTune"], [style*="authRise"] {
            animation: none !important;
          }
          .auth-warming-status::after { animation: none; content: '…'; }
        }
      `}</style>
    </div>
  );
}
