/**
 * Assessment Layout
 *
 * Sales-page palette: deep radial gradient, no navbar/footer to keep focus on the quiz.
 */

import { ReactNode } from 'react';

export default function AssessmentLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className="min-h-screen relative overflow-hidden text-[#E8E8E8] font-dm-body"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
      }}
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
