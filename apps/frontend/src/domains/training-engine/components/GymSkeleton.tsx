'use client';

/**
 * GymSkeleton — loading placeholders shaped like the gym's REAL states, instead
 * of the generic full-editor TutorialPageSkeleton (which draws a video card,
 * fretboard, four widgets… none of which the gym shows). A skeleton should be
 * the silhouette of what's about to appear, so the layout doesn't jump when the
 * content lands.
 *
 * Variants mirror the gym's states 1:1:
 *  - 'front-door' → the daily rep: centered eyebrow + giant headline + coach
 *    line + the amber CTA + the dimmed floor CTA (the default / most common).
 *  - 'picker'     → the goal picker: a header + stacked goal-card rows.
 *  - 'placement'  → the tempo-placement card: prompt + the big BPM readout +
 *    a slider track + the start button.
 *
 * Uses the platform `.skeleton-shimmer` sweep (globals.css) on the gym's own
 * dark tokens, so it matches the gym surface (the shadcn <Skeleton> uses the
 * light `bg-accent` token — wrong here).
 */

/** A single shimmering block on the gym's dark surface. */
function Bar({ className }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded-md ${className ?? ''}`} />;
}

export type GymSkeletonVariant = 'front-door' | 'picker' | 'placement';

export function GymSkeleton({
  variant = 'front-door',
}: {
  variant?: GymSkeletonVariant;
}) {
  if (variant === 'picker') {
    // Mirrors GymGoalPicker: a left-aligned header (mono label + serif title +
    // sub) then 3 goal-card rows (rounded-[14px] #141318, title + meta + 2 desc
    // lines), max-w-lg.
    return (
      <div
        className="mx-auto w-full max-w-lg px-4 py-10 md:py-12"
        aria-busy="true"
        aria-label="Loading your goals"
      >
        <div className="mb-6 space-y-2">
          <Bar className="h-2.5 w-28" />
          <Bar className="h-7 w-56" />
          <Bar className="h-3.5 w-72 max-w-full" />
        </div>
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="rounded-[14px] border border-white/[0.06] bg-[#141318] p-[22px]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <Bar className="h-5 w-40" />
                <Bar className="h-2.5 w-24" />
              </div>
              <Bar className="mt-3 h-3 w-full" />
              <Bar className="mt-2 h-3 w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'placement') {
    // Mirrors GymPlacement: a centered card (max-w-md) with the amber hairline,
    // label + serif prompt + paragraph + the big BPM number + a slider track +
    // the start button.
    return (
      <div
        className="flex min-h-[70vh] w-full items-center justify-center px-4"
        aria-busy="true"
        aria-label="Loading"
      >
        <div className="relative w-full max-w-md overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318]">
          <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />
          <div className="flex flex-col items-center space-y-6 p-8">
            <Bar className="h-2.5 w-28" />
            <Bar className="h-6 w-64 max-w-full" />
            <div className="w-full space-y-2">
              <Bar className="mx-auto h-3 w-full" />
              <Bar className="mx-auto h-3 w-4/5" />
            </div>
            <Bar className="h-14 w-40" />
            <Bar className="h-2 w-full rounded-full" />
            <Bar className="h-11 w-full rounded-[9px]" />
          </div>
        </div>
      </div>
    );
  }

  // 'front-door' (default) — the daily rep. A quiet topbar (streak, top-right),
  // then the centered invitation: eyebrow + a tall headline block + a coach
  // line + the amber CTA + the dimmed floor CTA. max-w-[26rem], same as the real
  // front door, so nothing shifts when the rep lands.
  return (
    <div
      className="flex min-h-full w-full flex-col"
      aria-busy="true"
      aria-label="Loading today's rep"
    >
      <div className="flex items-center justify-end px-1 py-1">
        <Bar className="h-3 w-24" />
      </div>
      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="flex w-full max-w-[26rem] flex-col items-center">
          <Bar className="mb-5 h-2.5 w-40" />
          <Bar className="mb-5 h-12 w-60 max-w-full" />
          <Bar className="mb-1.5 h-4 w-80 max-w-full" />
          <Bar className="mb-10 h-4 w-56 max-w-full" />
          <Bar className="h-[68px] w-full rounded-[14px]" />
          <Bar className="mt-3 h-[52px] w-full rounded-[14px]" />
        </div>
      </div>
    </div>
  );
}
