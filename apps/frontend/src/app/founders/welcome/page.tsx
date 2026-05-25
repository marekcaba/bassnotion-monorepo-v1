'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';

interface WelcomeContext {
  firstName: string | null;
  paid: boolean;
}

/**
 * Post-payment landing for founder purchases.
 *
 * Reached by Stripe's "After payment" redirect with ?session_id=cs_xxx.
 * Personalizes the headline if the session resolves to a paid founder
 * (server-side Stripe lookup via /api/v1/founders/welcome-context).
 * Visible without auth — anyone who has the session_id can land here,
 * which is fine because we only render the first name + a celebration.
 *
 * Brand-matched to the waitlist page so the founder doesn't feel like
 * they were dropped onto a different product after paying.
 *
 * Next 15 requires useSearchParams() to be wrapped in a <Suspense>
 * boundary so static prerendering can bail out cleanly to client-side
 * rendering when search params are present. The default export is the
 * Suspense wrapper; the real content lives in FoundersWelcomeContent.
 */
export default function FoundersWelcomePage() {
  return (
    <Suspense fallback={<WelcomeFallback />}>
      <FoundersWelcomeContent />
    </Suspense>
  );
}

function FoundersWelcomeContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');

  const [context, setContext] = useState<WelcomeContext | null>(null);
  // Overlay only runs when arriving fresh from Stripe (sessionId present).
  // Bookmarked/direct visits skip the celebration so it doesn't feel fake.
  const [overlayPhase, setOverlayPhase] = useState<'in' | 'out' | 'gone'>(
    sessionId ? 'in' : 'gone',
  );

  useEffect(() => {
    // Force scroll-to-top in case the user arrived via a hash-laden URL.
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (overlayPhase === 'gone') return;
    // Hold the checkmark for ~1.6s, then fade out over 600ms.
    const fadeTimer = setTimeout(() => setOverlayPhase('out'), 1600);
    const removeTimer = setTimeout(() => setOverlayPhase('gone'), 2200);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(removeTimer);
    };
  }, [overlayPhase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl || !sessionId) {
        setContext({ firstName: null, paid: Boolean(sessionId) });
        return;
      }
      try {
        const url = new URL(`${apiUrl}/api/v1/founders/welcome-context`);
        url.searchParams.set('session_id', sessionId);
        const res = await fetch(url.toString(), { cache: 'no-store' });
        if (!res.ok) {
          setContext({ firstName: null, paid: true });
          return;
        }
        const data = (await res.json()) as WelcomeContext;
        if (!cancelled) setContext(data);
      } catch {
        // best-effort — show the generic celebration anyway
        if (!cancelled) setContext({ firstName: null, paid: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const greeting = context?.firstName
    ? `Welcome, ${context.firstName}.`
    : 'Welcome.';

  return (
    <div className="min-h-screen text-[#F5F1EB] font-dm-body text-base leading-[1.55] overflow-x-hidden flex flex-col relative bg-[#0A0908]">
      {overlayPhase !== 'gone' && <SuccessOverlay phase={overlayPhase} />}

      {/* Brand atmospherics — same dual-radial as the waitlist page */}
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(900px 600px at 78% 4%, rgba(242,107,29,0.11), transparent 60%), radial-gradient(700px 520px at 5% 95%, rgba(242,107,29,0.05), transparent 55%)',
        }}
      />
      <div
        aria-hidden="true"
        className="fixed inset-0 pointer-events-none z-0 opacity-[0.04]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="relative z-10 max-w-[1120px] w-full mx-auto px-6 flex-1 flex flex-col">
        {/* Nav (logo only) */}
        <nav className="flex items-center pt-7">
          <a
            href="/"
            aria-label="Bassicology home"
            className="flex items-center gap-2.5 no-underline"
          >
            <span className="font-heading uppercase text-2xl tracking-[0.06em] text-[#F26B1D] leading-none">
              Bassicology
            </span>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#9A948C] border border-[#26221E] rounded-full px-2.5 py-1 leading-none whitespace-nowrap">
              Founder
            </span>
          </a>
        </nav>

        <main className="flex-1 flex items-center justify-center py-16">
          <div className="w-full max-w-[720px] text-center">
            {/* Green check */}
            <div
              aria-hidden="true"
              className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(78,199,127,0.12)] border-2 border-[#4EC77F] mb-8"
            >
              <svg
                width="26"
                height="26"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#4EC77F"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>

            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.14em] uppercase text-[#F26B1D] mb-5">
              <span
                aria-hidden="true"
                className="w-6 h-px bg-[#F26B1D] opacity-60"
              />
              You&apos;re in the Founding 100
              <span
                aria-hidden="true"
                className="w-6 h-px bg-[#F26B1D] opacity-60"
              />
            </div>

            {/* Headline */}
            <h1 className="font-heading uppercase text-[clamp(38px,6.4vw,72px)] leading-[0.95] tracking-[0.005em] mb-8">
              {greeting}
              <br />
              <span className="text-[#F26B1D]">You just made history.</span>
            </h1>

            {/* Body */}
            <p className="text-[#9A948C] text-lg leading-[1.7] max-w-[36em] mx-auto mb-10">
              You&apos;re locked in. A note from{' '}
              <b className="text-[#F5F1EB] font-semibold">mar.c</b> is already
              on its way — keep an eye on your inbox. Read it. Reply if you feel
              like it. Then go grab your bass.
            </p>

            {/* Benefits recap card */}
            <div
              className="text-left rounded-[18px] border-[1.5px] border-[rgba(242,107,29,0.35)] p-6 sm:p-7 mb-10 mx-auto max-w-[560px]"
              style={{
                background:
                  'linear-gradient(160deg, rgba(242,107,29,0.09), rgba(242,107,29,0.02))',
              }}
            >
              <div className="text-center text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#F26B1D] mb-5">
                What&apos;s locked in for you
              </div>
              <ul className="space-y-3 list-none p-0 m-0">
                <Perk bold="Lifetime access.">
                  You&apos;re one of the first 100. No monthly fee, ever.
                </Perk>
                <Perk bold="First through the door —">
                  before any wave. Before any public launch.
                </Perk>
                <Perk bold="A real say in what gets built.">
                  Hundred people I can actually listen to beats ten thousand I
                  can&apos;t.
                </Perk>
              </ul>
            </div>

            {/* Soft CTA */}
            <a
              href="/"
              className="inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.04em] text-[#F26B1D] border border-[rgba(242,107,29,0.4)] hover:border-[#F26B1D] hover:bg-[rgba(242,107,29,0.07)] rounded-full px-5 py-2.5 transition-colors no-underline"
            >
              Back to bassicology.com
            </a>

            {/* Small print */}
            <p className="text-xs text-[#6B655E] mt-12 italic">
              Stripe will email your receipt separately. If anything looks off,
              reply to mar.c&apos;s note and we&apos;ll sort it personally.
            </p>
          </div>
        </main>

        <footer className="relative z-10 text-center py-10 px-6 text-[12px] text-[#6B655E] mt-8">
          Bassicology · Play, don&apos;t watch · 2026
        </footer>
      </div>
    </div>
  );
}

function Perk({ bold, children }: { bold: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 items-start">
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#F26B1D"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="flex-none mt-0.5"
        aria-hidden="true"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
      <span className="text-[15px] leading-[1.55] text-[#F5F1EB]">
        <strong className="text-[#F5F1EB] font-semibold">{bold}</strong>{' '}
        {children}
      </span>
    </li>
  );
}

/**
 * Centered success animation that confirms the payment landed safely
 * before the welcome content is revealed. Shown once on arrival from
 * Stripe (when ?session_id=... is present), then dissolves.
 */
function SuccessOverlay({ phase }: { phase: 'in' | 'out' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Payment successful"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0908]"
      style={{
        opacity: phase === 'out' ? 0 : 1,
        transition: 'opacity 600ms ease-out',
        pointerEvents: phase === 'out' ? 'none' : 'auto',
      }}
    >
      <div className="flex flex-col items-center gap-6">
        <div
          className="relative flex items-center justify-center w-24 h-24 rounded-full"
          style={{
            background: 'rgba(78,199,127,0.10)',
            border: '2px solid #4EC77F',
            animation:
              'overlay-pop 420ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
          }}
        >
          <svg
            width="44"
            height="44"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#4EC77F"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline
              points="20 6 9 17 4 12"
              style={{
                strokeDasharray: 30,
                strokeDashoffset: 30,
                animation: 'overlay-check 480ms ease-out 260ms forwards',
              }}
            />
          </svg>
        </div>
        <div
          className="text-[11px] font-extrabold tracking-[0.18em] uppercase text-[#4EC77F]"
          style={{
            opacity: 0,
            animation: 'overlay-fade-in 360ms ease-out 600ms forwards',
          }}
        >
          Payment successful
        </div>
      </div>

      <style jsx>{`
        @keyframes overlay-pop {
          0% {
            opacity: 0;
            transform: scale(0.6);
          }
          100% {
            opacity: 1;
            transform: scale(1);
          }
        }
        @keyframes overlay-check {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes overlay-fade-in {
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Brand-matched skeleton shown while the Suspense boundary resolves
 * useSearchParams() on the client. Visible for ~100ms; just enough to
 * avoid a white flash on page entry.
 */
function WelcomeFallback() {
  return (
    <div className="min-h-screen bg-[#0A0908] flex items-center justify-center">
      <div className="text-[#6B655E] font-dm-body text-sm tracking-[0.08em] uppercase">
        Loading…
      </div>
    </div>
  );
}
