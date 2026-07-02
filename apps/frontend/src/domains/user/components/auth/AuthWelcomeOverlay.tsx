'use client';

import type { WelcomePhase } from './useWelcomePhase';
import { WELCOME_FADE_MS } from './useWelcomePhase';

/**
 * AuthWelcomeOverlay (Approach B) — the branded welcome beat after a fresh login.
 *
 * SERVER-DECIDED + SCOPED to the content <main> pane (the sidebar shell stays visible). Its
 * background is TRANSPARENT: the shell's single LeatherBackground shows through here AND under the
 * sidebar as ONE continuous, unmoving surface — so there's no leather-texture seam. Only the LOGO
 * (+ tuning line + subheadline) floats on that shared leather, then fades out while the Backstage
 * content crossfades IN behind it (the content's fade is driven by the same phase in AppClientLayout).
 *
 * `phase` is owned by useWelcomePhase in the parent (so overlay-out and content-in stay in lockstep).
 * Renders null when phase==='done'. All keyframes are in globals.css (inline <style> breaks SSR
 * hydration → React #418).
 */
export function AuthWelcomeOverlay({ phase }: { phase: WelcomePhase }) {
  if (phase === 'done') return null;

  return (
    <div
      aria-hidden
      // absolute (fills the RELATIVE <main>, sidebar stays). TRANSPARENT background so the shell's
      // continuous leather shows through — only the logo group fades, not any background layer.
      className="pointer-events-none absolute inset-0 z-[200] flex items-center justify-center"
      style={{
        opacity: phase === 'fading' ? 0 : 1,
        transition: `opacity ${WELCOME_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
      }}
    >
      {/* The FULL callback-preview composition: logo (breathing glow) + tuning line + subheadline.
          Keyframes (authWelcomeRise / authLogoGlow / authTune) live in globals.css — NOT inline
          <style> here, which would break SSR hydration (React #418). */}
      <div
        className="flex flex-col items-center"
        style={{
          animation: 'authWelcomeRise 0.55s cubic-bezier(0.22,1,0.36,1) both',
        }}
      >
        {/* Wordmark — the anchor, with the glow ON the logo (breathing layered text-shadow). */}
        <h1
          className="auth-welcome-logo font-heading select-none text-center text-[clamp(44px,8vw,84px)] font-normal uppercase leading-[0.9] tracking-[0.12em] text-[#E8650A]"
          style={{
            textShadow:
              '0 0 8px rgba(232,101,10,0.13), 0 0 13px rgba(232,101,10,0.15)',
            animation: 'authLogoGlow 2.8s ease-in-out infinite',
          }}
        >
          Bassicology
        </h1>

        {/* The "tuning" line — a warm sweep, the load indicator reimagined as a fretline. */}
        <div className="relative mt-9 h-px w-[min(340px,72vw)] overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="auth-welcome-tune absolute inset-y-0 left-0 w-1/2 rounded-full"
            style={{
              background:
                'linear-gradient(90deg, transparent 0%, #ffc700 45%, #E8A44A 55%, transparent 100%)',
              animation: 'authTune 1.5s cubic-bezier(0.65,0,0.35,1) infinite',
            }}
          />
        </div>

        {/* Subheadline — small, wide-tracked, muted. */}
        <p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8A8A8A]">
          Warming up your session
        </p>
      </div>
    </div>
  );
}
