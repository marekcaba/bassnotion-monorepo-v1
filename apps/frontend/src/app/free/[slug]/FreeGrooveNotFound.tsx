/**
 * FreeGrooveNotFound — graceful fallback for `/free/:slug` when the slug
 * doesn't resolve to an active groove (mistyped link, unpublished groove,
 * backend briefly unreachable).
 *
 * Rendered INSIDE the page's leather frame, so it's just the inner copy +
 * CTAs — not a full-page 404. A broken YouTube link should still land on a
 * branded surface that converts, not a stack trace or a dead end.
 */

export function FreeGrooveNotFound() {
  return (
    <div className="flex max-w-[420px] flex-col items-center gap-6 text-center">
      <div className="font-heading text-[22px] uppercase leading-none tracking-[0.12em] text-[#E8650A]">
        BASSICOLOGY
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-[clamp(24px,4vw,32px)] uppercase leading-[1.05] tracking-[0.02em] text-[#E8E8E8]">
          This groove isn&apos;t available
        </h1>
        <p className="text-[14px] leading-relaxed text-[#999]">
          The link may be old or mistyped — but there&apos;s a whole library of
          grooves waiting inside.
        </p>
      </div>
      <div className="flex w-full flex-col items-center gap-3">
        <a
          href="/register"
          className="flex h-12 w-full max-w-[280px] items-center justify-center rounded-sm bg-[#E8650A] text-[14px] font-semibold tracking-[0.04em] text-white transition-colors hover:bg-[#B84E08]"
        >
          Sign up
        </a>
        <a
          href="/"
          className="text-[13px] text-[#999] transition-colors hover:text-[#E8E8E8]"
        >
          Back to home
        </a>
      </div>
    </div>
  );
}
