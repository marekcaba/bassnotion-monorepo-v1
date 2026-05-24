'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { waitlistLevels, type WaitlistLevel } from '@bassnotion/contracts';

// Lazy-load Three.js so it doesn't ship in the initial HTML. The chunk gets
// warm-cached for users who sign up and land in /app afterwards.
const MarketingFretboard3D = dynamic(
  () =>
    import('@/shared/components/marketing/MarketingFretboard3D').then(
      (m) => m.default,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full h-full bg-[#0F172A] rounded-[13px]"
        aria-hidden="true"
      />
    ),
  },
);

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

// === FOUNDER PAYMENT LINK ===
// Paste your Stripe Payment Link URL here once it's created.
// Until then, the button shows a "coming soon" toast and records interest.
const FOUNDER_PAYMENT_LINK = 'https://buy.stripe.com/fZu3cv5Tp2zj2g0ci83sI01';
const FOUNDER_SPOTS_TOTAL = 100;
const FOUNDER_SPOTS_CLAIMED = 62; // hardcoded until we have real founders
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
  tempo: () =>
    'Tempo changed. The whole band followed you — not a recording.',
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

export default function WaitlistPage() {
  const [email, setEmail] = useState('');
  const [level, setLevel] = useState<WaitlistLevel | ''>('');
  const [website, setWebsite] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [alreadyOnList, setAlreadyOnList] = useState(false);

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
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, level, website }),
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
        <nav className="flex items-center justify-between pt-7">
          <a
            href="/"
            aria-label="Bassicology home"
            className="flex items-center gap-2.5 no-underline"
          >
            <span className="font-heading uppercase text-2xl tracking-[0.06em] text-[#F26B1D] leading-none">
              Bassicology
            </span>
            <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-[#9A948C] border border-[#26221E] rounded-full px-2.5 py-1 leading-none">
              BETA
            </span>
          </a>
        </nav>

        {/* ── HERO ──────────────────────────────────────────── */}
        <section className="text-center max-w-[780px] mx-auto pt-16 pb-7">
          <div className="inline-flex items-center gap-2.5 text-xs font-bold tracking-[0.14em] uppercase text-[#F26B1D] mb-5">
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
          <h1 className="font-heading uppercase text-[clamp(38px,6.4vw,72px)] leading-[0.95] tracking-[0.005em]">
            Stop watching bass.
            <br />
            <span className="text-[#F26B1D]">Start playing it.</span>
          </h1>
          <p className="mt-6 mx-auto text-[#9A948C] text-[18px] leading-[1.6] max-w-[34em]">
            Every other platform hands you a video to watch. Bassicology hands
            you a band. Real groove, real drummer —{' '}
            <b className="text-[#F5F1EB] font-semibold">
              slow it down, change the key, mute the bass, and take the seat
              yourself.
            </b>{' '}
            Right here. No account.
          </p>
        </section>

        {/* ── GROOVE CARD (visual mockup, no real audio yet) ── */}
        <GrooveCardMockup />

        {/* ── MICRO TAGS ────────────────────────────────────── */}
        <div className="flex flex-wrap gap-6 justify-center mt-7">
          {["Play, don't watch", 'Your tempo, your key', 'Original grooves, weekly'].map(
            (t) => (
              <span
                key={t}
                className="text-[13px] text-[#6B655E] flex items-center gap-2 before:content-[''] before:w-[5px] before:h-[5px] before:rounded-full before:bg-[#F26B1D] before:opacity-85"
              >
                {t}
              </span>
            ),
          )}
        </div>

        {/* ── WHY IT WORKS ──────────────────────────────────── */}
        <WhyItWorks />

        {/* ── FORM ──────────────────────────────────────────── */}
        <section className="max-w-[520px] w-full mx-auto pt-20 md:pt-28 pb-8">
          {status === 'upsell' ? (
            <FounderUpsell
              email={email}
              alreadyOnList={alreadyOnList}
              onDone={() => setStatus('done')}
            />
          ) : status === 'done' ? (
            <SuccessView alreadyOnList={alreadyOnList} />
          ) : (
            <>
              <div className="text-center text-xs font-bold tracking-[0.16em] uppercase text-[#F26B1D] mb-3.5">
                Be first in when we open
              </div>
              <h2 className="font-heading uppercase text-center text-[clamp(38px,6.4vw,72px)] leading-[0.95] tracking-[0.005em]">
                Want in when
                <br />
                it goes <span className="text-[#F26B1D]">live?</span>
              </h2>
              <p className="text-center text-[#9A948C] text-[16px] mt-4 max-w-[30em] mx-auto">
                Bassicology opens in waves. Drop your email and we&apos;ll let
                you know the moment your spot comes up.
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
                    autoFocus
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
                              active ? 'border-[#F26B1D]' : 'border-[#3A332C]'
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
   WHY IT WORKS — founder quote + lazy fretboard + 3 numbered points
   ════════════════════════════════════════════════════════════ */
function WhyItWorks() {
  const points: { title: string; body: React.ReactNode }[] = [
    {
      title: '3D Fretboard',
      body: (
        <>
          See every note in space. Finally understand{' '}
          <b className="text-[#F5F1EB] font-semibold">why the shapes work</b> —
          not just where your fingers go.
        </>
      ),
    },
    {
      title: 'Deconstructed Grooves',
      body: (
        <>
          Every groove pulled apart into its techniques, drilled one layer at a
          time — so they end up in{' '}
          <b className="text-[#F5F1EB] font-semibold">your fingers</b>, not just
          your favorites playlist.
        </>
      ),
    },
    {
      title: '4-Week Accelerator',
      body: (
        <>
          A prescribed path from stuck to fluent.{' '}
          <b className="text-[#F5F1EB] font-semibold">
            Open it, press play, finish in a month.
          </b>{' '}
          No more guessing what to practice.
        </>
      ),
    },
  ];

  return (
    <section
      className="mt-14 max-w-[1000px] mx-auto rounded-[22px] border border-[#26221E] px-5 py-10 md:px-[30px] md:py-[50px]"
      style={{
        background: 'linear-gradient(165deg, #0E0D0C, #0A0908)',
      }}
    >
      <div className="text-center text-xs font-bold tracking-[0.16em] uppercase text-[#F26B1D] mb-[18px]">
        Why it actually works
      </div>

      {/* Founder quote */}
      <div className="max-w-[30em] mx-auto text-center">
        <p className="font-heading uppercase font-normal text-[clamp(20px,2.7vw,27px)] leading-[1.25] tracking-[0.005em]">
          &ldquo;The thing that took me from 20 to 120 wasn&apos;t more lessons.
          It was <span className="text-[#F26B1D]">grooves</span> — pitch them up,
          slow them down, and really feel how the line sits in the music.
          That&apos;s the whole platform.&rdquo;
        </p>
        <div className="mt-4 text-[13px] text-[#9A948C] font-semibold tracking-[0.02em]">
          <b className="text-[#F5F1EB] font-bold">mar.c</b>{' '}
          <span className="text-[#6B655E] font-medium">
            · founder of Bassicology
          </span>
        </div>
      </div>

      {/* Grid: fretboard left, points right */}
      <div className="mt-11 grid grid-cols-1 md:grid-cols-[1.15fr_1fr] gap-6 md:gap-[30px] items-center">
        {/* 3D fretboard — lazy-loaded plain Three.js */}
        <div
          className="relative bg-[#0B0A09] border border-[#211D19] rounded-[16px] p-[18px] overflow-hidden flex items-center justify-center"
          style={{ minHeight: 300 }}
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(380px 240px at 50% 40%, rgba(242,107,29,0.12), transparent 70%)',
            }}
          />
          <span className="absolute top-3.5 left-4 text-[10.5px] font-bold tracking-[0.12em] uppercase text-[#6B655E] z-10">
            3D Fretboard
          </span>
          <div className="absolute inset-[18px] rounded-[10px] overflow-hidden">
            <MarketingFretboard3D />
          </div>
        </div>

        {/* Three points */}
        <div className="grid gap-4">
          {points.map((p, i) => (
            <div
              key={p.title}
              className="bg-[#100E0D] border border-[#26221E] rounded-[14px] px-5 py-[18px] hover:border-[#3D3630] transition-colors"
            >
              <div className="flex items-center gap-2.5 font-heading text-[17px] uppercase tracking-[0.01em] text-[#F5F1EB]">
                <span className="w-6 h-6 rounded-[7px] bg-[rgba(242,107,29,0.13)] border border-[rgba(242,107,29,0.3)] text-[#F26B1D] text-[13px] grid place-items-center flex-none">
                  {i + 1}
                </span>
                {p.title}
              </div>
              <p className="text-[13.5px] text-[#9A948C] mt-2 leading-[1.5]">
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
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
      next = { ...groove, keyIndex: (groove.keyIndex + 1) % KEY_OPTIONS.length };
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
      className="mt-10 mx-auto max-w-[780px] w-full rounded-[20px] p-5 border border-[#26221E] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.03)]"
      style={{
        background: 'linear-gradient(165deg, #161412, #0C0B0A)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-1.5 pb-3.5">
        <span className="text-xs font-bold tracking-[0.1em] uppercase text-[#6B655E]">
          Now playing ·{' '}
          <b className="text-[#F5F1EB]">
            &ldquo;Greasy Pocket&rdquo; — Funk in {KEY_OPTIONS[groove.keyIndex]}
          </b>
        </span>
        <span className="text-[11px] font-bold tracking-[0.06em] text-[#F26B1D] border border-[rgba(242,107,29,0.3)] bg-[rgba(242,107,29,0.07)] rounded-full px-3 py-1 whitespace-nowrap">
          ▶ Try the controls
        </span>
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
            background:
              'linear-gradient(0deg, rgba(8,7,6,0.92), transparent)',
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
            background:
              'linear-gradient(180deg, #FF7A22, #C4530F)',
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
  onDone,
}: {
  email: string;
  alreadyOnList: boolean;
  onDone: () => void;
}) {
  const [recordingInterest, setRecordingInterest] = useState(false);
  const spotsPct = Math.min(
    100,
    Math.round((FOUNDER_SPOTS_CLAIMED / FOUNDER_SPOTS_TOTAL) * 100),
  );

  const recordInterest = async () => {
    // Fire-and-forget — we don't block the user on it.
    try {
      await fetch('/api/waitlist/founder-interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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
      window.open(FOUNDER_PAYMENT_LINK, '_blank', 'noopener,noreferrer');
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
          {alreadyOnList ? "You're already in." : "You're on the list."}
        </h2>
        <p className="text-[#9A948C] mt-2.5 text-[15px]">
          We&apos;ll email you the moment your wave opens. But there&apos;s one
          way to skip the line entirely…
        </p>
      </div>

      {/* Founder card */}
      <div
        className="relative mt-7 rounded-[18px] border-[1.5px] border-[rgba(242,107,29,0.35)] p-6 text-center overflow-hidden"
        style={{
          background:
            'linear-gradient(160deg, rgba(242,107,29,0.09), rgba(242,107,29,0.02))',
        }}
      >
        {/* corner glow */}
        <div
          aria-hidden="true"
          className="absolute -top-[40%] -right-[10%] w-[200px] h-[200px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(242,107,29,0.18), transparent 70%)',
          }}
        />

        <div className="relative">
          <span className="inline-block text-[11px] font-extrabold tracking-[0.14em] uppercase text-[#F26B1D] bg-[rgba(242,107,29,0.12)] border border-[rgba(242,107,29,0.3)] rounded-full px-3 py-1.5 mb-4">
            Founding 100 · only at launch
          </span>

          <h3 className="font-heading uppercase text-[28px] leading-none">
            Become a <span className="text-[#F26B1D]">founding member</span>
          </h3>

          <div className="mt-4 flex items-baseline justify-center gap-2.5">
            <span className="font-heading text-[46px] text-[#F5F1EB] leading-none">
              $397
            </span>
            <span className="text-[13px] text-[#9A948C] font-semibold">
              once · lifetime access
            </span>
          </div>

          <p className="text-[#9A948C] text-[14.5px] max-w-[30em] mt-2 mx-auto leading-[1.55]">
            The first 100 people get{' '}
            <b className="text-[#F5F1EB] font-semibold">lifetime membership</b>{' '}
            — every tempo, every key, the full library, and every tool we ever
            ship — for one payment, forever. Plus you fund the build and get in
            on day one, ahead of every wave.
          </p>

          <ul className="list-none text-left max-w-[330px] mx-auto mt-5 space-y-2.5">
            {[
              <>
                <b className="font-bold">Lifetime keys.</b> Never pay the
                $24/mo. Locked for life.
              </>,
              <>
                <b className="font-bold">First through the door</b> — skip every
                wait-list wave.
              </>,
              <>
                <b className="font-bold">Founder&apos;s ear</b> — shape what we
                build next.
              </>,
            ].map((node, i) => (
              <li
                key={i}
                className="text-[14px] text-[#F5F1EB] flex gap-2.5 items-start"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#F26B1D"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="flex-none mt-0.5"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{node}</span>
              </li>
            ))}
          </ul>

          {/* Spots progress */}
          <div className="mt-5 bg-black/25 border border-[rgba(242,107,29,0.18)] rounded-xl px-4 py-3.5">
            <div className="flex justify-between items-baseline text-[12.5px]">
              <span className="text-[#9A948C] font-medium">
                <b className="text-[#F5F1EB] font-extrabold">
                  {FOUNDER_SPOTS_CLAIMED}
                </b>{' '}
                of {FOUNDER_SPOTS_TOTAL} spots claimed
              </span>
              <span className="text-[#F26B1D] font-extrabold">
                closes at {FOUNDER_SPOTS_TOTAL}
              </span>
            </div>
            <div className="h-[7px] bg-[#221D18] rounded-md mt-2.5 overflow-hidden">
              <div
                className="h-full rounded-md transition-[width] duration-[1400ms] ease-[cubic-bezier(.2,.8,.2,1)]"
                style={{
                  width: `${spotsPct}%`,
                  background:
                    'linear-gradient(90deg, #C4530F, #FF7A22)',
                }}
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleFounderClick}
            disabled={recordingInterest}
            className="w-full mt-5 bg-gradient-to-b from-[#FF7A22] to-[#C4530F] text-[#1A0D04] font-extrabold text-[17px] px-6 py-[18px] rounded-[13px] cursor-pointer border-none shadow-[0_14px_34px_-12px_rgba(242,107,29,0.6)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_-12px_rgba(242,107,29,0.7)] active:translate-y-0 transition-[transform,box-shadow] duration-200 disabled:opacity-70 leading-tight"
          >
            Become a founder — $397
            <span className="block text-xs font-semibold text-[rgba(26,13,4,0.7)] mt-1">
              Secure checkout · 30-day money-back guarantee
            </span>
          </button>

          <p className="text-[11.5px] text-[#6B655E] mt-3.5 max-w-[32em] mx-auto leading-[1.55]">
            <b className="text-[#9A948C] font-semibold">
              Heads up — the platform isn&apos;t live yet.
            </b>{' '}
            Bassicology opens in 2026. You&apos;re paying today to lock lifetime
            founding access at $397; you get in the day we open, before every
            wave. Not happy before launch? Full refund, no questions.
          </p>
        </div>
      </div>

      {/* Skip button */}
      <button
        type="button"
        onClick={onDone}
        className="block w-full mt-3.5 bg-transparent border-[1.5px] border-[#26221E] text-[#9A948C] font-bold text-[15px] py-[15px] rounded-[13px] cursor-pointer hover:border-[#3D3630] hover:text-[#F5F1EB] transition-colors"
      >
        No thanks — just notify me when it&apos;s live
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
        {alreadyOnList ? "You're already in." : "You're on the list."}
      </h2>

      <p className="text-[#9A948C] mt-2.5 text-[15px] max-w-[30em] mx-auto">
        {alreadyOnList
          ? "We'll send the invite to the email you signed up with — keep an eye on your inbox."
          : "We'll email you the moment your wave opens. First groove's already on its way to your inbox. Grab your bass."}
      </p>
    </div>
  );
}
