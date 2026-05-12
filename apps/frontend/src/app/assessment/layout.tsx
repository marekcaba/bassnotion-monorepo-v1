/**
 * Assessment Layout
 *
 * A warm, focused layout for the assessment/onboarding quiz.
 * No navbar, no footer - just the quiz content to keep users focused.
 * "Intimate Studio Session" aesthetic - late-night recording studio vibes.
 */

import { ReactNode } from 'react';
import { Cormorant_Garamond, DM_Sans } from 'next/font/google';

// Elegant serif for headlines - musical, refined
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-cormorant',
  display: 'swap',
});

// Clean sans for body - modern, readable
const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export default function AssessmentLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${cormorant.variable} ${dmSans.variable} min-h-screen relative overflow-hidden bg-[#0f0f0f]`}
    >
      {/* Subtle noise texture overlay */}
      <div
        className="fixed inset-0 opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <div className="relative z-10">{children}</div>
    </div>
  );
}
