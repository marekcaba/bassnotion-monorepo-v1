'use client';

import { useState } from 'react';
import { waitlistLevels, type WaitlistLevel } from '@bassnotion/contracts';

const LEVEL_LABELS: Record<WaitlistLevel, { title: string; hint: string }> = {
  starting: { title: 'Just starting', hint: 'Picked it up recently' },
  returning: { title: 'Returning', hint: 'Played years ago, coming back' },
  intermediate: {
    title: 'Intermediate',
    hint: 'Comfortable, hitting a ceiling',
  },
  advanced: { title: 'Advanced', hint: 'Years in, polishing the craft' },
};

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

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
      setStatus('success');
    } catch {
      setErrorMessage('Network error — check your connection and try again');
      setStatus('error');
    }
  };

  return (
    <>
      <style jsx global>{`
        @keyframes waitlist-blink {
          50% {
            opacity: 0;
          }
        }
        .waitlist-cursor::after {
          content: '█';
          margin-left: 4px;
          animation: waitlist-blink 1.1s step-end infinite;
          color: #e8650a;
        }
      `}</style>

      <div
        className="min-h-screen text-[#E8E8E8] font-dm-body text-base leading-relaxed overflow-x-hidden flex flex-col"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
        }}
      >
        {/* ── NAV ────────────────────────────────────────────────────── */}
        <nav className="h-[72px] flex items-center px-6 md:px-[60px]">
          <a
            href="/"
            aria-label="Bassicology home"
            className="flex items-start gap-1.5 no-underline cursor-pointer"
          >
            <div className="font-heading uppercase text-[22px] tracking-[0.12em] text-[#E8650A] leading-none">
              BASSICOLOGY
            </div>
            <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#666] border border-[#333] px-1.5 py-0.5 rounded-sm leading-none -translate-y-0.5">
              Beta
            </span>
          </a>
        </nav>

        {/* ── MAIN ───────────────────────────────────────────────────── */}
        <main className="flex-1 flex items-center justify-center px-6 md:px-[60px] py-12">
          <div className="w-full max-w-[640px]">
            {/* eyebrow */}
            <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8650A] mb-7">
              Pre-launch · Invite Only
            </div>

            {/* headline */}
            <h1 className="font-heading uppercase text-[clamp(48px,7vw,80px)] leading-[0.93] tracking-[0.02em] text-[#E8E8E8] mb-7">
              Join the
              <br />
              <span className="text-[#E8650A]">waitlist</span>
              <span className="waitlist-cursor" aria-hidden="true" />
            </h1>

            {/* sub */}
            <p className="text-[#999] text-lg leading-[1.7] mb-10 max-w-[480px] font-dm-body">
              Bassicology opens in waves. Drop your email and we&apos;ll let you
              in when your spot comes up.
            </p>

            {/* terminal card */}
            <div className="bg-[#0A0A0A] border border-[#252525] rounded-md overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)]">
              <div className="bg-[#161616] px-4 py-2.5 flex items-center gap-2 border-b border-[#252525]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                <span className="text-[11px] text-[#555] tracking-[0.08em] ml-2 font-mono">
                  register_player.sh
                </span>
              </div>

              {status === 'success' ? (
                <SuccessBody alreadyOnList={alreadyOnList} />
              ) : (
                <form onSubmit={submit} className="p-7 md:p-9" noValidate>
                  {/* honeypot — hidden from real users */}
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
                    <span className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[#666] mb-2.5 font-mono">
                      ▸ Email
                    </span>
                    <input
                      type="email"
                      required
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={status === 'submitting'}
                      placeholder="you@email.com"
                      className="w-full bg-[#161616] border border-[#252525] rounded-sm px-4 py-3 text-[15px] text-[#E8E8E8] placeholder:text-[#444] font-mono outline-none focus:border-[#E8650A] focus:ring-1 focus:ring-[#E8650A]/30 transition-colors disabled:opacity-50"
                    />
                  </label>

                  {/* LEVEL */}
                  <fieldset className="mt-7">
                    <legend className="block text-[10px] font-semibold tracking-[0.18em] uppercase text-[#666] mb-3 font-mono">
                      ▸ How long have you played?
                    </legend>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {waitlistLevels.map((value) => {
                        const { title, hint } = LEVEL_LABELS[value];
                        const active = level === value;
                        return (
                          <label
                            key={value}
                            className={`cursor-pointer border rounded-sm px-4 py-3 transition-colors ${
                              active
                                ? 'border-[#E8650A] bg-[rgba(232,101,10,0.06)]'
                                : 'border-[#252525] bg-[#161616] hover:border-[#333]'
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
                              className={`block text-[13px] font-semibold tracking-[0.02em] mb-0.5 ${
                                active ? 'text-[#E8E8E8]' : 'text-[#C8C8C8]'
                              }`}
                            >
                              {title}
                            </span>
                            <span className="block text-[11px] text-[#666] font-dm-body">
                              {hint}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  {/* ERROR */}
                  {status === 'error' && errorMessage && (
                    <div
                      role="alert"
                      className="mt-6 px-4 py-3 border border-[rgba(255,95,86,0.3)] bg-[rgba(255,95,86,0.06)] text-[#FF8A82] text-[13px] font-mono"
                    >
                      ! {errorMessage}
                    </div>
                  )}

                  {/* SUBMIT */}
                  <button
                    type="submit"
                    disabled={status === 'submitting'}
                    className="mt-8 w-full inline-flex items-center justify-center gap-2.5 bg-[#E8650A] text-white px-8 py-4 text-[15px] font-semibold tracking-[0.04em] rounded-sm hover:bg-[#B84E08] hover:-translate-y-px transition-all cursor-pointer border-none disabled:opacity-60 disabled:cursor-wait disabled:translate-y-0"
                  >
                    {status === 'submitting' ? (
                      <>
                        <span className="font-mono">…</span> Reserving your spot
                      </>
                    ) : (
                      <>
                        <span>▸</span> Reserve my spot
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-[#555] mt-4 font-mono tracking-[0.04em] text-center">
                    // no spam · early access · founder pricing
                  </p>
                </form>
              )}
            </div>
          </div>
        </main>

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <footer className="py-8 px-6 md:px-[60px] text-center">
          <p className="text-xs text-[#555] font-mono tracking-[0.08em]">
            Practice, don&apos;t watch.
          </p>
        </footer>
      </div>
    </>
  );
}

function SuccessBody({ alreadyOnList }: { alreadyOnList: boolean }) {
  return (
    <div className="p-7 md:p-9 font-mono text-[13px] leading-[1.9]">
      <div className="text-[#3DBA6F] mb-2">
        <span aria-hidden="true">▶</span>{' '}
        {alreadyOnList ? 'already on the list' : 'spot secured'}
      </div>
      <div className="text-[#666] mb-7">
        // we&apos;ll be in touch when your wave opens
      </div>

      <div className="text-[#444] border-t border-[#252525] pt-5 mb-5">
        ──────────────────────────────────
      </div>

      <div className="text-[#999] font-dm-body text-[14px] leading-[1.75] mb-6">
        {alreadyOnList
          ? "You're already in. We'll send the invite to the email you signed up with — keep an eye on your inbox."
          : 'Look out for an email confirming your spot. Bassicology opens in waves — early signups get founder pricing.'}
      </div>

      <div className="text-[#555] text-[11px] tracking-[0.08em] uppercase">
        Until then — pick up your bass.
      </div>
    </div>
  );
}
