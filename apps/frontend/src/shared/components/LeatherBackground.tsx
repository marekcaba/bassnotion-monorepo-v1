'use client';

/**
 * LeatherBackground — the leather texture + fine noise grain overlay, extracted
 * from the inline waitlist JSX so the same warm surface can sit behind /app.
 *
 * Two absolutely-positioned, pointer-events-none layers that fill their
 * (positioned) parent:
 *   1. leather2.webp  — tiled 1776px, mix-blend-mode: screen, opacity 0.09
 *   2. SVG fractalNoise grain — opacity 0.015
 *
 * No radial glows here by design — surfaces that mount this keep their own
 * base background (e.g. /app's center-top radial gradient) showing through.
 * `mix-blend-mode: screen` needs a dark base beneath it to read correctly,
 * which the /app gradient provides.
 *
 * Mount it as the first child of a `relative` container; layers sit at z-0,
 * so give the container's real content `relative z-10` to paint above.
 */

const NOISE_DATA_URI =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

export function LeatherBackground() {
  return (
    <>
      {/* Leather texture — bottom decorative layer. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: 'url("/textures/leather2.webp")',
          backgroundSize: '1776px',
          backgroundRepeat: 'repeat',
          mixBlendMode: 'screen',
          opacity: 0.09,
        }}
      />
      {/* Fine noise grain on top of the leather. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          backgroundImage: NOISE_DATA_URI,
          opacity: 0.015,
        }}
      />
    </>
  );
}
