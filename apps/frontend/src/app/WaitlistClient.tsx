'use client';

import { useEffect, useRef, useState } from 'react';
import {
  type FounderCardConfig,
  waitlistLevels,
  type WaitlistLevel,
} from '@bassnotion/contracts';
import {
  ensureFirstTouchAttribution,
  getStoredAttribution,
} from '@/shared/attribution';
import { FounderCard } from '@/shared/founder-card/FounderCard';

const LEVEL_OPTIONS: { value: WaitlistLevel; label: string; hint: string }[] = [
  { value: 'starting', label: 'Just starting out', hint: '0–1 yr' },
  {
    value: 'returning',
    label: 'Returning after time away',
    hint: 'picking it back up',
  },
  {
    value: 'intermediate',
    label: 'Stuck at intermediate',
    hint: "know it, can't deploy it",
  },
  { value: 'advanced', label: 'Advanced', hint: 'sharpening edges' },
];

// Sanity-check the order matches the schema's `waitlistLevels`.
if (
  process.env.NODE_ENV !== 'production' &&
  LEVEL_OPTIONS.map((o) => o.value).join(',') !== waitlistLevels.join(',')
) {
  console.warn(
    '[waitlist] LEVEL_OPTIONS order does not match waitlistLevels — UI may not render every level',
  );
}

type FormStatus = 'idle' | 'submitting' | 'upsell' | 'done' | 'error';

// Stripe Payment Link comes from env so staging gets the test link and
// production gets the live link automatically. NEXT_PUBLIC_* values are
// inlined into the client bundle at build time.
const FOUNDER_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_FOUNDER_LINK ?? '';

const FOUNDER_SPOTS_TOTAL = 100;

// Soft fallback shown when the live count endpoint hasn't responded yet.
// Stays small so first paint isn't an obviously-fake number.
const FOUNDER_SPOTS_INITIAL = 0;

// Stripe client_reference_id constraints: max 200 chars, alphanumeric + . _ -.
// We pack the high-signal attribution fields (UTMs only) into a base64url
// JSON blob to survive the round-trip through Stripe Checkout into the
// webhook payload. The wider attribution (referrer, timezone, landingPath)
// already lives on the waitlist row keyed by email — we can cross-reference
// later if needed without spending the 200-char budget here.
const STRIPE_CLIENT_REF_PREFIX = 'attr:';
const STRIPE_CLIENT_REF_MAX = 200;

function packAttributionForStripe(
  attribution: ReturnType<typeof getStoredAttribution>,
): string | undefined {
  const slim = {
    s: attribution.utmSource ?? undefined,
    m: attribution.utmMedium ?? undefined,
    c: attribution.utmCampaign ?? undefined,
    n: attribution.utmContent ?? undefined,
    t: attribution.utmTerm ?? undefined,
    a: attribution.capturedAt ?? undefined,
  };
  // Drop empties so we don't waste budget on null markers.
  const filtered = Object.fromEntries(
    Object.entries(slim).filter(([, v]) => v != null && v !== ''),
  );
  if (Object.keys(filtered).length === 0) return undefined;

  try {
    const json = JSON.stringify(filtered);
    // base64url: standard base64 with + -> -, / -> _, = stripped.
    const b64 =
      typeof btoa === 'function'
        ? btoa(unescape(encodeURIComponent(json)))
        : Buffer.from(json, 'utf8').toString('base64');
    const b64url = b64
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    const candidate = `${STRIPE_CLIENT_REF_PREFIX}${b64url}`;
    if (candidate.length > STRIPE_CLIENT_REF_MAX) return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}
type GrooveControl = 'play' | 'tempo' | 'key' | 'mute';
const TEMPO_OPTIONS = [72, 88, 104, 120];
const KEY_OPTIONS = ['E', 'F#', 'G', 'A', 'C'];

const CAPTION_DEFAULT =
  'Press play. Then touch a control below — hear the band bend to you.';

const CAPTIONS: Record<GrooveControl, (state: GrooveState) => string> = {
  play: (s) =>
    s.playing
      ? "Band's playing. Now slow it down, change the key, or mute the bass."
      : CAPTION_DEFAULT,
  tempo: () => 'Tempo changed. The whole band followed you — not a recording.',
  key: () => 'New key. Every instrument transposed instantly.',
  mute: (s) =>
    s.muted
      ? "Bass muted. That's your seat now. Play the line."
      : 'Bass back in. Hear how it locks with the drums.',
};

type GrooveState = {
  playing: boolean;
  tempo: number;
  keyIndex: number;
  muted: boolean;
};

/**
 * Scroll-triggered fade+rise wrapper. Honors prefers-reduced-motion
 * (renders immediately, no transition). Fires once per element.
 */
function Reveal({
  children,
  delayMs = 0,
}: {
  children: React.ReactNode;
  delayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(16px)',
        transition:
          'opacity 800ms cubic-bezier(0.16, 1, 0.3, 1), transform 800ms cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: `${delayMs}ms`,
        willChange: shown ? 'auto' : 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}

export function WaitlistClient({
  cardConfig,
}: {
  cardConfig: FounderCardConfig;
}) {
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<WaitlistLevel | ''>('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);
  const [founderClaimed, setFounderClaimed] = useState<number>(
    FOUNDER_SPOTS_INITIAL,
  );

  // Force the page to the top on every load / reload. Browsers default to
  // 'auto' scroll restoration, which puts the visitor wherever they were
  // last — on a long landing page that almost always means waking up at
  // the form, missing the hero entirely.
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);
  }, []);

  // Capture first-touch attribution (UTMs, referrer, landing path, timezone)
  // on first page load. Persists in localStorage for 30 days so the first
  // marketing source that brought a visitor wins, even if they come back via
  // a different link later. Best-effort — never throws.
  useEffect(() => {
    ensureFirstTouchAttribution();
  }, []);

  // Fetch the real founder count once on page mount. The number is ready by
  // the time visitors reach the upsell step. On any failure we keep the
  // initial fallback so the bar never disappears.
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiUrl}/api/v1/founders/count`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data: {
          claimed?: number;
          total?: number;
          error?: false | string;
        } = await res.json();
        if (cancelled) return;
        if (typeof data.claimed === 'number' && !data.error) {
          setFounderClaimed(data.claimed);
        }
      } catch {
        // best-effort — fallback value remains
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;

    if (!level) {
      setErrorMessage('Pick where you are with bass');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setErrorMessage(null);

    try {
      const attribution = getStoredAttribution();
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, level, website, attribution }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setErrorMessage(data.error ?? 'Something went wrong');
        setStatus('error');
        return;
      }
      setAlreadyOnList(Boolean(data.alreadyOnList));
      setStatus('upsell');
    } catch {
      setErrorMessage('Network error — check your connection and try again');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen text-[#F5F1EB] font-dm-body text-base leading-[1.55] overflow-x-hidden flex flex-col relative bg-[#0A0908]">
      {/* Two-radial accent + noise overlay (mockup tokens) */}
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
        {/* ── NAV ───────────────────────────────────────────── */}
        <nav className="flex items-center justify-between gap-3 pt-7">
          <a
            href="/"
            aria-label="Bassicology home"
            className="flex items-center gap-2.5 no-underline"
          >
            <span className="font-heading uppercase text-2xl tracking-[0.06em] text-[#F26B1D] leading-none">
              Bassicology
            </span>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#9A948C] border border-[#26221E] rounded-full px-2.5 py-1 leading-none whitespace-nowrap">
              Pre-launch
            </span>
          </a>

          <a
            href="#waitlist-form"
            className="inline-flex items-center text-[12px] sm:text-[13px] font-bold tracking-[0.04em] text-[#F26B1D] border border-[rgba(242,107,29,0.4)] hover:border-[#F26B1D] hover:bg-[rgba(242,107,29,0.07)] rounded-full px-3.5 sm:px-4 py-2 transition-colors no-underline whitespace-nowrap"
          >
            Get notified
          </a>
        </nav>

        {/* All page sections share a single vertical rhythm.
            To change the gap between every section, change SECTION_GAP_PX. */}
        <div
          className="flex flex-col"
          style={{ gap: '150px', paddingTop: '64px', paddingBottom: '40px' }}
        >
          {/* ── HERO + GROOVE CARD merged into one sibling, so the 196px gap
              only applies between this block and the next section, not
              between the headline and the demo. ──────────────────── */}
          <Reveal>
            <div className="text-center max-w-[780px] mx-auto">
              <div className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.14em] uppercase text-[#F26B1D] mb-5 animate-[hero-eyebrow-pulse_3s_ease-in-out_infinite] motion-reduce:animate-none">
                <span
                  aria-hidden="true"
                  className="w-6 h-px bg-[#F26B1D] opacity-60"
                />
                Opening soon · 2026
                <span
                  aria-hidden="true"
                  className="w-6 h-px bg-[#F26B1D] opacity-60"
                />
              </div>
              <style jsx global>{`
                @keyframes hero-eyebrow-pulse {
                  0%,
                  100% {
                    opacity: 0.6;
                  }
                  50% {
                    opacity: 1;
                  }
                }
              `}</style>
              <h1 className="font-heading uppercase text-[clamp(38px,6.4vw,72px)] leading-[0.95] tracking-[0.005em]">
                Stop watching bass.
                <br />
                <span className="text-[#F26B1D]">Start playing it.</span>
              </h1>
              <p className="mt-6 mx-auto text-[#9A948C] text-[18px] leading-[1.6] max-w-[34em]">
                Every other platform hands you a video to watch. Bassicology
                hands you a band. Real groove, real drummer —{' '}
                <b className="text-[#F5F1EB] font-semibold">
                  slow it down, change the key, mute the bass, and take the seat
                  yourself.
                </b>{' '}
                Right here. No account.
              </p>
            </div>

            <div className="mt-10">
              <GrooveCardMockup />
            </div>
          </Reveal>

          {/* ── WHY IT WORKS ──────────────────────────────────── */}
          <Reveal>
            <WhyItWorks />
          </Reveal>

          {/* ── FOUNDER QUOTE — standalone banner ─────────────── */}
          <Reveal>
            <FounderQuote />
          </Reveal>

          {/* ── FORM ──────────────────────────────────────────── */}
          <Reveal>
            <section
              id="waitlist-form"
              className="max-w-[520px] w-full mx-auto scroll-mt-24"
            >
              {status === 'upsell' ? (
                <FounderUpsell
                  email={email}
                  alreadyOnList={alreadyOnList}
                  claimed={founderClaimed}
                  cardConfig={cardConfig}
                  onDone={() => setStatus('done')}
                />
              ) : status === 'done' ? (
                <SuccessView alreadyOnList={alreadyOnList} />
              ) : (
                <>
                  <div className="text-center mb-5">
                    <div className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.14em] uppercase text-[#F26B1D] animate-[hero-eyebrow-pulse_3s_ease-in-out_infinite] motion-reduce:animate-none">
                      <span
                        aria-hidden="true"
                        className="w-6 h-px bg-[#F26B1D] opacity-60"
                      />
                      Opening soon · 2026
                      <span
                        aria-hidden="true"
                        className="w-6 h-px bg-[#F26B1D] opacity-60"
                      />
                    </div>
                  </div>
                  <h2 className="font-heading uppercase text-center text-[clamp(38px,6.4vw,72px)] leading-[0.95] tracking-[0.005em]">
                    Want <span className="text-[#F26B1D]">in</span> when
                    <br />
                    it goes <span className="text-[#F26B1D]">live?</span>
                  </h2>
                  <p className="text-center text-[#9A948C] text-[16px] mt-4 max-w-[30em] mx-auto">
                    Bassicology opens in waves. Drop your email and we&apos;ll
                    let you know the moment your spot comes up.
                  </p>

                  <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
                    {/* honeypot */}
                    <div
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: '-9999px',
                        width: '1px',
                        height: '1px',
                        overflow: 'hidden',
                      }}
                    >
                      <label>
                        Website
                        <input
                          type="text"
                          tabIndex={-1}
                          autoComplete="off"
                          value={website}
                          onChange={(e) => setWebsite(e.target.value)}
                        />
                      </label>
                    </div>

                    {/* EMAIL */}
                    <label className="block">
                      <span className="block text-[13px] font-semibold mb-2.5">
                        Email address
                      </span>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={status === 'submitting'}
                        placeholder="you@email.com"
                        autoComplete="email"
                        className="w-full bg-[#100E0D] border-[1.5px] border-[#26221E] rounded-xl px-[18px] py-4 text-[16px] text-[#F5F1EB] placeholder:text-[#6B655E] outline-none focus:border-[#F26B1D] focus:shadow-[0_0_0_4px_rgba(242,107,29,0.12)] transition-[border-color,box-shadow] duration-200 disabled:opacity-50"
                      />
                    </label>

                    {/* LEVEL */}
                    <fieldset>
                      <legend className="block text-[13px] font-semibold mb-2.5">
                        How long have you been playing?
                      </legend>
                      <div className="space-y-2.5">
                        {LEVEL_OPTIONS.map(({ value, label, hint }) => {
                          const active = level === value;
                          return (
                            <label
                              key={value}
                              className={`flex items-center gap-3.5 cursor-pointer border-[1.5px] rounded-xl px-[18px] py-3.5 transition-all duration-150 ${
                                active
                                  ? 'border-[#F26B1D] bg-[rgba(242,107,29,0.07)]'
                                  : 'border-[#26221E] bg-[#100E0D] hover:border-[#3D3630] hover:bg-[#141210]'
                              }`}
                            >
                              <input
                                type="radio"
                                name="level"
                                value={value}
                                checked={active}
                                onChange={() => setLevel(value)}
                                disabled={status === 'submitting'}
                                className="sr-only"
                              />
                              <span
                                aria-hidden="true"
                                className={`relative w-[18px] h-[18px] rounded-full border-2 flex-none transition-colors ${
                                  active
                                    ? 'border-[#F26B1D]'
                                    : 'border-[#3A332C]'
                                }`}
                              >
                                <span
                                  className={`absolute inset-[3px] rounded-full bg-[#F26B1D] transition-transform ${
                                    active ? 'scale-100' : 'scale-0'
                                  }`}
                                />
                              </span>
                              <span className="text-[15px] font-medium">
                                {label}
                              </span>
                              <span className="text-[12px] text-[#6B655E] font-medium ml-auto">
                                {hint}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>

                    {/* ERROR */}
                    {status === 'error' && errorMessage && (
                      <div role="alert" className="text-[14px] text-[#E0533A]">
                        {errorMessage}
                      </div>
                    )}

                    {/* SUBMIT */}
                    <button
                      type="submit"
                      disabled={status === 'submitting'}
                      className="w-full mt-2 bg-gradient-to-b from-[#FF7A22] to-[#C4530F] text-[#1A0D04] font-extrabold text-[17px] px-6 py-[18px] rounded-[13px] cursor-pointer border-none shadow-[0_14px_34px_-12px_rgba(242,107,29,0.6)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(242,107,29,0.7)] active:translate-y-0 transition-[transform,box-shadow] duration-200 disabled:opacity-70 disabled:cursor-wait disabled:translate-y-0 leading-tight"
                    >
                      {status === 'submitting'
                        ? 'Reserving your spot…'
                        : 'Notify me when it opens'}
                      <span className="block text-xs font-semibold text-[rgba(26,13,4,0.7)] mt-1">
                        No spam. One email when your wave is live.
                      </span>
                    </button>

                    {/* TRUST */}
                    <div className="flex flex-wrap justify-center gap-4 pt-1">
                      {['No spam, ever', 'Free to join', 'Leave anytime'].map(
                        (t) => (
                          <span
                            key={t}
                            className="text-[12px] text-[#6B655E] flex items-center gap-1.5"
                          >
                            <svg
                              width="13"
                              height="13"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#F26B1D"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden="true"
                              style={{ opacity: 0.85 }}
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            {t}
                          </span>
                        ),
                      )}
                    </div>
                  </form>
                </>
              )}
            </section>
          </Reveal>
        </div>
      </div>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="relative z-10 text-center py-10 px-6 text-[12px] text-[#6B655E] border-t border-[#26221E] mt-8">
        <div className="italic text-[#9A948C] text-[14px] mb-3">
          &ldquo;They describe practice. We are practice.&rdquo;
        </div>
        Bassicology · Play, don&apos;t watch · 2026
      </footer>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FOUNDER QUOTE — standalone banner, mirrors /preview quote-banner.
   ════════════════════════════════════════════════════════════ */
function FounderQuote() {
  return (
    <div className="text-center">
      <p className="max-w-[720px] mx-auto text-xl md:text-2xl leading-relaxed text-[#C8C8C8] font-dm-body italic">
        &ldquo;The day I stopped watching bass lessons online and started
        actually playing along to the real music, everything changed.
        That&rsquo;s the whole reason I&rsquo;m building Bassicology.&rdquo;
      </p>
      <div className="mt-5 text-[13px] text-[#9A948C] font-semibold tracking-[0.02em]">
        <b className="text-[#F5F1EB] font-bold">mar.c</b>{' '}
        <span className="text-[#6B655E] font-medium">
          &middot; founder of Bassicology
        </span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   WHY IT WORKS — three "dial" cards that rhyme the Groove Card controls.
   Each dial has a subtle micro-animation tied to its concept.
   ════════════════════════════════════════════════════════════ */
function WhyItWorks() {
  return (
    <section className="max-w-[780px] mx-auto">
      <h2 className="font-heading uppercase text-center text-[clamp(30px,5vw,56px)] leading-[0.95] tracking-[0.005em]">
        You&apos;ve watched enough.
        <br />
        Now <span className="text-[#F26B1D]">let&apos;s play.</span>
      </h2>

      <div className="mt-10 md:mt-11 grid grid-cols-1 md:grid-cols-3 gap-3.5 md:gap-4">
        <TempoDial />
        <KeyDial />
        <MuteDial />
      </div>
    </section>
  );
}

/* ── Shared dial chrome ─────────────────────────────────────── */
function Dial({
  caption,
  visual,
  title,
  body,
}: {
  caption: string;
  visual: React.ReactNode;
  title: string;
  body: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden bg-[#100E0D] border border-[#26221E] rounded-[16px] px-5 pt-[22px] pb-6 transition-[border-color,transform] duration-150 hover:border-[rgba(242,107,29,0.35)] hover:-translate-y-[3px]">
      {/* Top-right radial glow */}
      <div
        aria-hidden="true"
        className="absolute -top-[30%] -right-[20%] w-[140px] h-[140px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(242,107,29,0.10), transparent 70%)',
        }}
      />
      <div className="relative">
        <div className="font-heading text-[11px] tracking-[0.12em] uppercase text-[#6B655E]">
          {caption}
        </div>
        {visual}
        <h4 className="font-heading text-[18px] uppercase tracking-[0.01em] text-[#F5F1EB] leading-[1.05]">
          {title}
        </h4>
        <p className="text-[13.5px] text-[#9A948C] mt-2.5 leading-[1.55]">
          {body}
        </p>
      </div>
    </div>
  );
}

/* ── Tempo dial ─────────────────────────────────────────────── */
function TempoDial() {
  const TEMPO_STEPS = [
    { pct: 8, bpm: 68 },
    { pct: 42, bpm: 96 },
    { pct: 78, bpm: 124 },
    { pct: 30, bpm: 84 },
  ];
  const [stepIndex, setStepIndex] = useState(0);
  const [bpm, setBpm] = useState(TEMPO_STEPS[0]?.bpm ?? 68);
  const rafRef = useRef<number | null>(null);

  // Cycle to the next preset every 2.2s; ease the BPM number between values.
  useEffect(() => {
    const advance = () => {
      setStepIndex((i) => (i + 1) % TEMPO_STEPS.length);
    };
    const id = window.setInterval(advance, 2200);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const target = TEMPO_STEPS[stepIndex]?.bpm ?? 68;
    const start = bpm;
    const t0 = performance.now();
    const dur = 650;
    const tick = (now: number) => {
      const k = Math.min((now - t0) / dur, 1);
      const eased = 1 - Math.pow(1 - k, 3);
      setBpm(Math.round(start + (target - start) * eased));
      if (k < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // bpm intentionally omitted — we want each new stepIndex to start from
    // whatever bpm is "now," not retrigger on every interpolation tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex]);

  const pct = TEMPO_STEPS[stepIndex]?.pct ?? 8;

  return (
    <Dial
      caption="Tempo"
      title="Slow it to your speed"
      visual={
        <>
          <div className="flex items-baseline gap-2 mt-2.5 h-10">
            <span className="font-heading text-[38px] leading-none text-[#F26B1D]">
              {bpm}
            </span>
            <span className="text-[13px] text-[#9A948C] font-bold">bpm</span>
          </div>
          <div className="relative h-[5px] rounded-[5px] bg-[#221D18] my-[14px] mb-[18px]">
            <span
              aria-hidden="true"
              className="absolute left-0 top-0 bottom-0 rounded-[5px] transition-[width] duration-[900ms] ease-[cubic-bezier(.4,0,.2,1)]"
              style={{
                width: `${pct}%`,
                background: 'linear-gradient(90deg, #C4530F, #FF7A22)',
              }}
            />
            <span
              aria-hidden="true"
              className="absolute top-1/2 -translate-y-1/2 w-[15px] h-[15px] rounded-full bg-[#F26B1D] transition-[left] duration-[900ms] ease-[cubic-bezier(.4,0,.2,1)]"
              style={{
                left: `calc(${pct}% - 7.5px)`,
                boxShadow: '0 0 12px 2px rgba(242,107,29,0.5)',
              }}
            />
          </div>
        </>
      }
      body={
        <>
          Take any groove down to where you can actually nail it, then climb
          back bar by bar. Every other platform plays at one speed — theirs.{' '}
          <b className="text-[#F5F1EB] font-semibold">
            Here the music moves at yours.
          </b>
        </>
      }
    />
  );
}

/* ── Key dial ───────────────────────────────────────────────── */
function KeyDial() {
  const KEYS = ['E', 'G', 'A', 'C', 'D'];
  const [activeIndex, setActiveIndex] = useState(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((i) => (i + 1) % KEYS.length);
    }, 1600);
    return () => window.clearInterval(id);
  }, [KEYS.length]);

  return (
    <Dial
      caption="Key"
      title="Any key, instantly"
      visual={
        <div className="flex gap-1.5 h-10 items-center mt-2.5">
          {KEYS.map((k, i) => {
            const active = i === activeIndex;
            return (
              <span
                key={k}
                aria-hidden="true"
                className={`font-heading text-[16px] transition-[color,transform] duration-[400ms] ${
                  active
                    ? 'text-[#F26B1D] scale-125'
                    : 'text-[#3A332C] scale-100'
                }`}
              >
                {k}
              </span>
            );
          })}
        </div>
      }
      body={
        <>
          Shift the whole song to any key with one dial. You stop memorizing one
          shape and start{' '}
          <b className="text-[#F5F1EB] font-semibold">understanding the line</b>{' '}
          — so it transfers to every song you&apos;ll ever play.
        </>
      }
    />
  );
}

/* ── Mute Bass dial ─────────────────────────────────────────── */
function MuteDial() {
  const BAR_COUNT = 9;
  const [muted, setMuted] = useState(true);
  const [heights, setHeights] = useState<number[]>(() =>
    Array.from({ length: BAR_COUNT }, () => 6),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setMuted((wasMuted) => {
        const nowMuted = !wasMuted;
        setHeights(
          Array.from({ length: BAR_COUNT }, () =>
            nowMuted ? 6 : 10 + Math.random() * 26,
          ),
        );
        return nowMuted;
      });
    }, 1400);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Dial
      caption="Mute Bass"
      title="Mute it — that's your seat"
      visual={
        <div className="flex gap-[5px] items-center h-10 mt-2.5">
          {heights.map((h, i) => (
            <span
              key={i}
              aria-hidden="true"
              className="w-1 rounded-[3px] transition-[height,background-color,opacity] duration-[250ms] ease-in-out"
              style={{
                height: `${h}px`,
                backgroundColor: muted ? '#3A332C' : '#F26B1D',
                opacity: muted ? 0.5 : 0.85,
              }}
            />
          ))}
        </div>
      }
      body={
        <>
          Drop the bass track and the band plays on without you. Now you&apos;re
          not following a line,{' '}
          <b className="text-[#F5F1EB] font-semibold">
            you&apos;re being the bassist.
          </b>{' '}
          That&apos;s the rep nothing else gives you.
        </>
      }
    />
  );
}

/* ════════════════════════════════════════════════════════════
   GROOVE CARD — visual mockup only (no real audio yet)
   ════════════════════════════════════════════════════════════ */
function GrooveCardMockup() {
  const [groove, setGroove] = useState<GrooveState>({
    playing: false,
    tempo: 104,
    keyIndex: 0,
    muted: false,
  });
  const [caption, setCaption] = useState(CAPTION_DEFAULT);

  const handleControl = (control: GrooveControl) => {
    let next: GrooveState = groove;
    if (control === 'play') next = { ...groove, playing: !groove.playing };
    else if (control === 'tempo') {
      const i = TEMPO_OPTIONS.indexOf(groove.tempo);
      next = {
        ...groove,
        tempo: TEMPO_OPTIONS[(i + 1) % TEMPO_OPTIONS.length] ?? 104,
      };
    } else if (control === 'key') {
      next = {
        ...groove,
        keyIndex: (groove.keyIndex + 1) % KEY_OPTIONS.length,
      };
    } else if (control === 'mute') next = { ...groove, muted: !groove.muted };
    setGroove(next);
    setCaption(CAPTIONS[control](next));
  };

  const handlePlayButton = () => {
    const next = { ...groove, playing: true };
    setGroove(next);
    setCaption(CAPTIONS.play(next));
  };

  return (
    <section
      className="mx-auto max-w-[780px] w-full rounded-[20px] p-5 border border-[#26221E] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{
        background: 'linear-gradient(165deg, #161412, #0C0B0A)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-1.5 pb-3.5">
        <span className="text-xs font-bold tracking-[0.1em] uppercase text-[#6B655E]">
          Now playing ·{' '}
          <b className="text-[#F5F1EB]">
            &ldquo;Greasy Pocket&rdquo; — Funk in {KEY_OPTIONS[groove.keyIndex]}
          </b>
        </span>
        <div className="flex items-center gap-2">
          {/* Dev-only guardrail. Auto-hides on Vercel production.
              Reminds us to swap in the real Groove Card before launch. */}
          {process.env.NEXT_PUBLIC_VERCEL_ENV !== 'production' && (
            <span
              title="This Groove Card is a visual mockup; the real interactive component will replace it before launch."
              className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#FFBD2E] border border-[rgba(255,189,46,0.35)] bg-[rgba(255,189,46,0.06)] rounded-full px-2 py-1 whitespace-nowrap"
            >
              Preview
            </span>
          )}
          <span className="text-[11px] font-bold tracking-[0.06em] text-[#F26B1D] border border-[rgba(242,107,29,0.3)] bg-[rgba(242,107,29,0.07)] rounded-full px-3 py-1 whitespace-nowrap">
            ▶ Try the controls
          </span>
        </div>
      </div>

      {/* Stage */}
      <div
        className="relative bg-[#0C0B0A] border border-[#211D19] rounded-[13px] overflow-hidden"
        style={{ aspectRatio: '16 / 8' }}
      >
        <div className="absolute inset-0 grid place-items-center text-center p-5">
          <GrooveWaveform
            playing={groove.playing}
            tempo={groove.tempo}
            muted={groove.muted}
          />
        </div>

        {!groove.playing && (
          <button
            type="button"
            onClick={handlePlayButton}
            aria-label="Play"
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[58px] h-[58px] rounded-full bg-[rgba(242,107,29,0.92)] grid place-items-center cursor-pointer border-none shadow-[0_8px_30px_-6px_rgba(242,107,29,0.7)] hover:scale-[1.07] transition-transform z-10"
          >
            <svg
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="#1A0D04"
              style={{ marginLeft: 3 }}
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        )}

        {/* Caption */}
        <div
          className="absolute left-0 right-0 bottom-0 px-[18px] py-3.5 text-[13px] text-[#9A948C] text-left"
          style={{
            background: 'linear-gradient(0deg, rgba(8,7,6,0.92), transparent)',
          }}
          dangerouslySetInnerHTML={{
            __html: caption.replace(
              /<b>(.*?)<\/b>/g,
              '<b class="text-[#F5F1EB] font-semibold">$1</b>',
            ),
          }}
        />
      </div>

      {/* Controls */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3.5">
        <ControlButton
          label="Play"
          value={groove.playing ? '■' : '●'}
          active={groove.playing}
          onClick={() => handleControl('play')}
        />
        <ControlButton
          label="Tempo"
          value={groove.tempo}
          suffix="bpm"
          active
          onClick={() => handleControl('tempo')}
        />
        <ControlButton
          label="Key"
          value={KEY_OPTIONS[groove.keyIndex] ?? 'E'}
          active
          onClick={() => handleControl('key')}
        />
        <ControlButton
          label="Mute Bass"
          value={groove.muted ? 'On' : 'Off'}
          active={groove.muted}
          onClick={() => handleControl('mute')}
        />
      </div>

      <div className="text-center text-[12.5px] text-[#6B655E] mt-4">
        <b className="text-[#9A948C] font-semibold">
          This is the actual instrument
        </b>{' '}
        — every lever here works in the platform, on any song you bring.
      </div>
    </section>
  );
}

function ControlButton({
  label,
  value,
  suffix,
  active,
  onClick,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-center rounded-xl px-3 py-3.5 cursor-pointer transition-all duration-150 border bg-[#100E0D] select-none ${
        active
          ? 'border-[#F26B1D] bg-[rgba(242,107,29,0.08)]'
          : 'border-[#211D19] hover:border-[#3D3630] hover:bg-[#161311]'
      }`}
    >
      <div
        className={`font-heading uppercase text-[13px] tracking-[0.04em] transition-colors ${
          active ? 'text-[#F26B1D]' : 'text-[#6B655E]'
        }`}
      >
        {label}
      </div>
      <div className="font-heading text-[21px] mt-1.5 leading-none text-[#F5F1EB]">
        {value}
        {suffix && (
          <small className="ml-1 text-xs text-[#9A948C] font-dm-body font-bold">
            {suffix}
          </small>
        )}
      </div>
    </button>
  );
}

/* Animated waveform — purely visual; pseudo-random heights driven by tempo */
function GrooveWaveform({
  playing,
  tempo,
  muted,
}: {
  playing: boolean;
  tempo: number;
  muted: boolean;
}) {
  const BARS = 42;
  const ref = useRef<HTMLDivElement>(null);
  const stateRef = useRef({ playing, tempo, muted });
  stateRef.current = { playing, tempo, muted };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bars = Array.from(el.children) as HTMLElement[];
    let frameId: number;

    const tick = () => {
      const { playing: p, tempo: t, muted: m } = stateRef.current;
      if (p) {
        const base = m ? 6 : 16;
        const amp = m ? 8 : 60;
        const now = Date.now();
        for (let i = 0; i < bars.length; i++) {
          const h =
            base +
            Math.abs(Math.sin(now / (420 - t * 1.6) + i * 0.5)) *
              amp *
              Math.random();
          const bar = bars[i];
          if (!bar) continue;
          bar.style.height = `${h}px`;
          bar.style.opacity = m ? '0.35' : '0.85';
        }
      } else {
        for (const bar of bars) {
          bar.style.height = '10px';
          bar.style.opacity = '0.4';
        }
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <div
      ref={ref}
      className="flex items-center gap-1 h-[90px]"
      aria-hidden="true"
    >
      {Array.from({ length: BARS }).map((_, i) => (
        <span
          key={i}
          className="block w-[5px] rounded transition-[height] duration-150 ease-linear"
          style={{
            background: 'linear-gradient(180deg, #FF7A22, #C4530F)',
            opacity: 0.85,
            height: '10px',
          }}
        />
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FOUNDER UPSELL — shown after signup, before final confirmation
   ════════════════════════════════════════════════════════════ */
function FounderUpsell({
  email,
  alreadyOnList,
  claimed,
  cardConfig,
  onDone,
}: {
  email: string;
  alreadyOnList: boolean;
  claimed: number;
  cardConfig: FounderCardConfig;
  onDone: () => void;
}) {
  void alreadyOnList;
  const [recordingInterest, setRecordingInterest] = useState(false);

  const recordInterest = async () => {
    // Fire-and-forget — we don't block the user on it.
    try {
      const attribution = getStoredAttribution();
      await fetch('/api/waitlist/founder-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, attribution }),
      });
    } catch {
      // Interest tracking is best-effort; never block the user on a network blip.
    }
  };

  const handleFounderClick = async () => {
    if (recordingInterest) return;
    setRecordingInterest(true);
    await recordInterest();
    setRecordingInterest(false);
    if (FOUNDER_PAYMENT_LINK) {
      // Pass first-touch attribution through Stripe via client_reference_id
      // so the webhook can record which marketing source actually converted.
      const attribution = getStoredAttribution();
      const clientRef = packAttributionForStripe(attribution);
      const url = clientRef
        ? `${FOUNDER_PAYMENT_LINK}?client_reference_id=${encodeURIComponent(
            clientRef,
          )}`
        : FOUNDER_PAYMENT_LINK;
      // Same-tab handoff: industry-standard pattern (Linear, Vercel, Notion,
      // GitHub, Substack all do it this way). Stripe Payment Link is
      // configured with an "After payment" redirect to /founders/welcome,
      // so the user finishes the journey in the same tab they started in.
      window.location.href = url;
    } else {
      // No payment link configured yet — show the soft landing.
      alert(
        "Founder seats open soon — we've noted your interest and you'll be first to hear when checkout is live.",
      );
    }
  };

  return (
    <div className="animate-[upsell-fade_0.4s_ease]">
      <style jsx global>{`
        @keyframes upsell-fade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>

      {/* Confirmation header */}
      <div className="text-center">
        <div
          aria-hidden="true"
          className="inline-flex items-center justify-center w-[54px] h-[54px] rounded-full bg-[rgba(78,199,127,0.12)] border-2 border-[#4EC77F] mb-4"
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
        <h2 className="font-heading uppercase text-[26px] tracking-[0.02em]">
          You&apos;re on the list.
        </h2>
        <p className="text-[#9A948C] mt-2.5 text-[15px]">
          We&apos;ll email you the moment your wave opens. But there&apos;s one
          way to skip the line entirely…
        </p>
      </div>

      {/* Founder card */}
      <div className="mt-7">
        <FounderCard
          config={cardConfig}
          claimed={claimed}
          total={FOUNDER_SPOTS_TOTAL}
          onCtaClick={handleFounderClick}
          ctaDisabled={recordingInterest}
        />
      </div>

      {/* Skip button */}
      <button
        type="button"
        onClick={onDone}
        className="block w-full mt-3.5 bg-transparent border-[1.5px] border-[#26221E] text-[#9A948C] font-bold text-[15px] py-[15px] rounded-[13px] cursor-pointer hover:border-[#3D3630] hover:text-[#F5F1EB] transition-colors"
      >
        {cardConfig.skipText}
      </button>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUCCESS VIEW
   ════════════════════════════════════════════════════════════ */
function SuccessView({ alreadyOnList }: { alreadyOnList: boolean }) {
  return (
    <div className="text-center">
      <div
        aria-hidden="true"
        className="inline-flex items-center justify-center w-[54px] h-[54px] rounded-full bg-[rgba(78,199,127,0.12)] border-2 border-[#4EC77F] mb-4"
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

      <h2 className="font-heading uppercase text-[26px] tracking-[0.02em]">
        You&apos;re on the list.
      </h2>

      <p className="text-[#9A948C] mt-2.5 text-[15px] max-w-[30em] mx-auto">
        {alreadyOnList
          ? "We'll send the invite to the email you signed up with — keep an eye on your inbox."
          : "We'll email you the moment your wave opens. First groove's already on its way to your inbox. Grab your bass."}
      </p>
    </div>
  );
}
