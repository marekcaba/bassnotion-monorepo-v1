'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

// ─── Scroll Reveal Hook ──────────────────────────────────────────────────────
function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('landing-visible');
            observer.unobserve(e.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    // Observe the container and all children with data-reveal
    const children = el.querySelectorAll('[data-reveal]');
    children.forEach((child) => observer.observe(child));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[#252525] py-7">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex justify-between items-center gap-5 text-left cursor-pointer"
      >
        <span className="text-base font-medium text-[#E8E8E8]">{question}</span>
        <span
          className={`text-xl text-[#E8650A] font-light flex-shrink-0 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
        >
          +
        </span>
      </button>
      {open && (
        <p className="text-[15px] leading-[1.8] text-[#999] mt-3.5 font-dm-body">
          {answer}
        </p>
      )}
    </div>
  );
}

// ─── Domain Matrix SVG ───────────────────────────────────────────────────────
function DomainMatrixSVG() {
  return (
    <svg
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full block"
    >
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#E8650A" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#E8650A" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* glow */}
      <circle cx="200" cy="200" r="200" fill="url(#glow)" />
      {/* orbit rings */}
      <circle
        cx="200"
        cy="200"
        r="140"
        fill="none"
        stroke="#222"
        strokeWidth="1"
        strokeDasharray="4 6"
      />
      <circle
        cx="200"
        cy="200"
        r="80"
        fill="none"
        stroke="#1A1A1A"
        strokeWidth="1"
      />
      {/* center player */}
      <circle
        cx="200"
        cy="200"
        r="44"
        fill="#111"
        stroke="#E8650A"
        strokeWidth="1.5"
      />
      <text
        x="200"
        y="196"
        textAnchor="middle"
        fill="#E8650A"
        fontFamily="var(--font-bebas-neue), Impact, sans-serif"
        fontSize="14"
        letterSpacing="2"
      >
        PLAYER
      </text>
      <text
        x="200"
        y="214"
        textAnchor="middle"
        fill="#555"
        fontFamily="var(--font-dm-sans), sans-serif"
        fontSize="9"
      >
        bass player
      </text>

      {/* Time — top */}
      <circle
        cx="200"
        cy="58"
        r="28"
        fill="#0F0F0F"
        stroke="#4A9EFF"
        strokeWidth="1.5"
      />
      <text
        x="200"
        y="54"
        textAnchor="middle"
        fill="#4A9EFF"
        fontFamily="var(--font-bebas-neue)"
        fontSize="11"
      >
        5/8
      </text>
      <text
        x="200"
        y="66"
        textAnchor="middle"
        fill="#777"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Time
      </text>
      <circle cx="175" cy="52" r="3" fill="#4A9EFF" opacity="0.6" />
      <circle cx="225" cy="52" r="3" fill="#4A9EFF" opacity="0.6" />
      <circle cx="200" cy="32" r="3" fill="#4A9EFF" opacity="0.3" />

      {/* Sound — top right */}
      <circle
        cx="323"
        cy="100"
        r="32"
        fill="#0F0F0F"
        stroke="#3DBA6F"
        strokeWidth="1.5"
      />
      <text
        x="323"
        y="96"
        textAnchor="middle"
        fill="#3DBA6F"
        fontFamily="var(--font-bebas-neue)"
        fontSize="13"
      >
        8/12
      </text>
      <text
        x="323"
        y="110"
        textAnchor="middle"
        fill="#777"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Sound
      </text>
      <circle cx="348" cy="88" r="3" fill="#3DBA6F" opacity="0.6" />
      <circle cx="340" cy="115" r="3" fill="#3DBA6F" opacity="0.6" />
      <circle cx="308" cy="80" r="3" fill="#3DBA6F" opacity="0.3" />

      {/* Hands — right */}
      <circle
        cx="352"
        cy="210"
        r="26"
        fill="#0F0F0F"
        stroke="#666"
        strokeWidth="1.5"
      />
      <text
        x="352"
        y="206"
        textAnchor="middle"
        fill="#888"
        fontFamily="var(--font-bebas-neue)"
        fontSize="11"
      >
        4/8
      </text>
      <text
        x="352"
        y="220"
        textAnchor="middle"
        fill="#555"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Hands
      </text>
      <circle cx="378" cy="200" r="3" fill="#666" opacity="0.5" />
      <circle cx="374" cy="224" r="3" fill="#666" opacity="0.3" />

      {/* Ear — bottom right */}
      <circle
        cx="305"
        cy="320"
        r="24"
        fill="#0F0F0F"
        stroke="#666"
        strokeWidth="1.5"
      />
      <text
        x="305"
        y="316"
        textAnchor="middle"
        fill="#888"
        fontFamily="var(--font-bebas-neue)"
        fontSize="11"
      >
        2/8
      </text>
      <text
        x="305"
        y="330"
        textAnchor="middle"
        fill="#555"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Ear
      </text>
      <circle cx="328" cy="312" r="3" fill="#666" opacity="0.4" />

      {/* Foundation — bottom */}
      <circle
        cx="200"
        cy="355"
        r="30"
        fill="#0F0F0F"
        stroke="#4A9EFF"
        strokeWidth="1.5"
      />
      <text
        x="200"
        y="351"
        textAnchor="middle"
        fill="#4A9EFF"
        fontFamily="var(--font-bebas-neue)"
        fontSize="12"
      >
        6/10
      </text>
      <text
        x="200"
        y="366"
        textAnchor="middle"
        fill="#777"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Foundation
      </text>
      <circle cx="176" cy="372" r="3" fill="#4A9EFF" opacity="0.5" />
      <circle cx="224" cy="372" r="3" fill="#4A9EFF" opacity="0.5" />
      <circle cx="200" cy="384" r="3" fill="#4A9EFF" opacity="0.2" />

      {/* Neck — bottom left */}
      <circle
        cx="95"
        cy="320"
        r="24"
        fill="#0F0F0F"
        stroke="#555"
        strokeWidth="1.5"
      />
      <text
        x="95"
        y="316"
        textAnchor="middle"
        fill="#777"
        fontFamily="var(--font-bebas-neue)"
        fontSize="11"
      >
        1/8
      </text>
      <text
        x="95"
        y="330"
        textAnchor="middle"
        fill="#555"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Neck
      </text>
      <circle cx="72" cy="312" r="3" fill="#555" opacity="0.4" />

      {/* Theory — left */}
      <circle
        cx="48"
        cy="210"
        r="26"
        fill="#0F0F0F"
        stroke="#555"
        strokeWidth="1.5"
      />
      <text
        x="48"
        y="206"
        textAnchor="middle"
        fill="#777"
        fontFamily="var(--font-bebas-neue)"
        fontSize="11"
      >
        3/8
      </text>
      <text
        x="48"
        y="220"
        textAnchor="middle"
        fill="#555"
        fontFamily="var(--font-dm-sans)"
        fontSize="8"
      >
        Theory
      </text>
      <circle cx="22" cy="200" r="3" fill="#555" opacity="0.4" />
      <circle cx="26" cy="224" r="3" fill="#555" opacity="0.3" />

      {/* cluster labels */}
      <text
        x="138"
        y="290"
        textAnchor="middle"
        fill="#444"
        fontFamily="var(--font-dm-sans)"
        fontSize="9"
      >
        Flow
      </text>
      <text
        x="148"
        y="132"
        textAnchor="middle"
        fill="#444"
        fontFamily="var(--font-dm-sans)"
        fontSize="9"
      >
        Navigation
      </text>
      <text
        x="275"
        y="165"
        textAnchor="middle"
        fill="#444"
        fontFamily="var(--font-dm-sans)"
        fontSize="9"
      >
        Voice
      </text>
      <text
        x="275"
        y="280"
        textAnchor="middle"
        fill="#444"
        fontFamily="var(--font-dm-sans)"
        fontSize="9"
      >
        Pocket
      </text>
      <text
        x="148"
        y="340"
        textAnchor="middle"
        fill="#444"
        fontFamily="var(--font-dm-sans)"
        fontSize="9"
      >
        Transcription
      </text>
    </svg>
  );
}

// ─── Terminal Window Chrome ──────────────────────────────────────────────────
function TerminalChrome({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-[#0A0A0A] border border-[#252525] rounded-md overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.03)]">
      <div className="bg-[#161616] px-4 py-2.5 flex items-center gap-2 border-b border-[#252525]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
        <span className="text-[11px] text-[#555] tracking-[0.08em] ml-2 font-mono">
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

// ─── Room Card ───────────────────────────────────────────────────────────────
function RoomCard({
  icon,
  name,
  mode,
  body,
  delay,
}: {
  icon: string;
  name: string;
  mode: string;
  body: string;
  delay: number;
}) {
  return (
    <div
      data-reveal
      style={{ transitionDelay: `${delay * 0.1}s` }}
      className="landing-reveal group bg-[#0F0F0F] border border-[#252525] p-9 relative overflow-hidden transition-colors duration-250 hover:bg-[#161616] hover:border-[#333]"
    >
      {/* top accent line */}
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-[#E8650A] origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100" />
      <span className="text-[28px] mb-4 block">{icon}</span>
      <div className="font-heading uppercase text-[28px] tracking-[0.04em] text-[#E8E8E8] mb-1.5">
        {name}
      </div>
      <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-[#E8650A] mb-4">
        {mode}
      </div>
      <p className="text-sm leading-[1.75] text-[#999] font-dm-body">{body}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════════
export default function HomePage() {
  const { navigateWithTransition } = useViewTransitionRouter();
  const heroRef = useRef<HTMLElement>(null);
  const socialRef = useScrollReveal();
  const ecosystemRef = useScrollReveal();
  const domainsRef = useScrollReveal();
  const quoteBannerRef = useScrollReveal();
  const startRef = useScrollReveal();
  const faqRef = useScrollReveal();
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Trigger hero reveal immediately on mount
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const children = el.querySelectorAll('[data-reveal]');
    const timer = setTimeout(() => {
      children.forEach((c) => c.classList.add('landing-visible'));
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Show "back to top" button after any scroll
  useEffect(() => {
    const onScroll = () => {
      const scrolled =
        window.scrollY ||
        document.documentElement.scrollTop ||
        document.body.scrollTop ||
        0;
      setShowBackToTop(scrolled > 100);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll);
    };
  }, []);

  const goToAssessment = useCallback(() => {
    // MVP routes to V1 (single linear video + popup questions). V2 (segment-based
    // branching flow) is preserved at /assessment/v2 for future development.
    navigateWithTransition('/assessment');
  }, [navigateWithTransition]);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    // Clear the #section hash from the URL without triggering a navigation
    if (window.location.hash) {
      window.history.replaceState(
        null,
        '',
        window.location.pathname + window.location.search,
      );
    }
  }, []);

  return (
    <>
      {/* ── Scoped Landing Styles ─────────────────────────────────────── */}
      <style jsx global>{`
        /* Smooth in-page anchor scrolling (Platform / Method / FAQ).
           scroll-padding-top offsets sections so they clear the fixed nav. */
        html {
          scroll-behavior: smooth;
          scroll-padding-top: 80px;
        }
        @media (prefers-reduced-motion: reduce) {
          html {
            scroll-behavior: auto;
          }
        }

        /* scroll reveal */
        .landing-reveal {
          opacity: 0;
          transform: translateY(28px);
          transition:
            opacity 0.65s ease,
            transform 0.65s ease;
        }
        .landing-visible,
        .landing-visible.landing-reveal {
          opacity: 1;
          transform: translateY(0);
        }

        /* blinking cursor */
        .landing-cursor::after {
          content: '\u2588';
          animation: landing-blink 1.1s step-end infinite;
          color: #e8650a;
        }
        @keyframes landing-blink {
          50% {
            opacity: 0;
          }
        }
      `}</style>

      <div
        className="text-[#E8E8E8] font-dm-body text-base leading-relaxed overflow-x-hidden min-h-screen"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
        }}
      >
        {/* ── NAV ────────────────────────────────────────────────────── */}
        <nav className="fixed top-0 left-0 right-0 z-[100] h-[72px] flex items-center justify-between px-6 md:px-[60px] bg-gradient-to-b from-[rgba(8,8,8,0.98)] to-transparent backdrop-blur-[8px]">
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
          {/* Desktop links */}
          <ul className="hidden md:flex items-center gap-9 list-none">
            <li>
              <a
                href="#ecosystem"
                className="text-[#999] no-underline text-[13px] font-medium tracking-[0.06em] uppercase hover:text-[#E8E8E8] transition-colors"
              >
                Platform
              </a>
            </li>
            <li>
              <a
                href="#domains"
                className="text-[#999] no-underline text-[13px] font-medium tracking-[0.06em] uppercase hover:text-[#E8E8E8] transition-colors"
              >
                Method
              </a>
            </li>
            <li>
              <a
                href="#faq"
                className="text-[#999] no-underline text-[13px] font-medium tracking-[0.06em] uppercase hover:text-[#E8E8E8] transition-colors"
              >
                FAQ
              </a>
            </li>
            <li aria-hidden="true" className="h-5 w-px bg-[#252525] mx-2" />
            <li>
              <a
                href="/login"
                className="text-[#999] no-underline text-[13px] font-medium tracking-[0.06em] uppercase hover:text-[#E8E8E8] transition-colors"
              >
                Log In
              </a>
            </li>
            <li>
              <button
                onClick={goToAssessment}
                className="bg-[#E8650A] text-white px-[22px] py-2.5 rounded-sm text-[13px] font-semibold tracking-[0.06em] uppercase hover:bg-[#B84E08] transition-colors cursor-pointer border-none"
              >
                Get Started
              </button>
            </li>
          </ul>
          {/* Mobile CTA only */}
          <button
            onClick={goToAssessment}
            className="md:hidden bg-[#E8650A] text-white px-4 py-2 rounded-sm text-xs font-semibold tracking-[0.06em] uppercase cursor-pointer border-none"
          >
            Get Started
          </button>
        </nav>

        {/* ── HERO ───────────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          id="hero"
          className="min-h-screen grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center pt-[140px] pb-[60px] lg:pb-[100px] px-6 md:px-[60px] max-w-[1200px] mx-auto"
        >
          <div data-reveal className="landing-reveal">
            <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8650A] mb-7">
              Bassicology
            </div>
            <h1 className="font-heading uppercase text-[clamp(52px,7vw,88px)] leading-[0.93] tracking-[0.02em] text-[#E8E8E8] mb-8">
              You&apos;ve <span className="text-[#E8650A]">never</span>
              <br />
              practiced
              <br />
              bass like <span className="text-[#E8650A]">this</span>
            </h1>
            <p className="text-[#999] text-xl leading-[1.7] mb-10 max-w-[480px] font-dm-body">
              Your playing finally gets the attention it deserves.
            </p>
            <button
              onClick={goToAssessment}
              className="inline-flex items-center gap-2.5 bg-[#E8650A] text-white px-8 py-4 text-[15px] font-semibold tracking-[0.04em] rounded-sm hover:bg-[#B84E08] hover:-translate-y-px transition-all cursor-pointer border-none"
            >
              <span>▸</span> Take the Free Groove Finder
            </button>
            <p className="text-xs text-[#555] mt-3 italic">
              3 minutes · Free · Get your personal Domain Matrix
            </p>
          </div>

          {/* Terminal / Fretboard ASCII */}
          <div
            data-reveal
            className="landing-reveal"
            style={{ transitionDelay: '0.2s' }}
          >
            <TerminalChrome title="BASSICOLOGY — LIVE SESSION">
              <div className="p-5 px-6 font-mono text-[13px] leading-[1.8]">
                <span className="block whitespace-pre text-[#444]">
                  {'  '}
                  ──────────────────────────────────
                </span>
                <span className="block">&nbsp;</span>
                <span className="block whitespace-pre text-[#666]">
                  {'  '}THE LOCKDOWN · Funk · 88 BPM
                </span>
                <span className="block">&nbsp;</span>
                <span className="block whitespace-pre">
                  {'  '}
                  <span className="text-[#666]">G</span>
                  {'  '}
                  <span className="text-[#444]">─── ───</span>{' '}
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ───</span>{' '}
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ───</span>
                </span>
                <span className="block whitespace-pre">
                  {'  '}
                  <span className="text-[#666]">D</span>
                  {'  '}
                  <span className="text-[#444]">───</span>
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ───</span>{' '}
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ─── ───</span>
                </span>
                <span className="block whitespace-pre">
                  {'  '}
                  <span className="text-[#666]">A</span>
                  {'  '}
                  <span className="text-[#444]">─── ──</span>
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">─ ───</span>{' '}
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ─── ─</span>
                </span>
                <span className="block whitespace-pre">
                  {'  '}
                  <span className="text-[#666]">E</span>
                  {'  '}
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ─── ─── ───</span>{' '}
                  <span className="text-[#E8650A]">●</span>
                  <span className="text-[#444]">── ─── ───</span>
                </span>
                <span className="block whitespace-pre text-[#444]">
                  {'      '}1 2 3 4 5 6 7 8
                </span>
                <span className="block">&nbsp;</span>
                <span className="block whitespace-pre text-[#3DBA6F]">
                  {'  '}▶ bar 3 of 8 · notes firing live
                </span>
                <span className="block">&nbsp;</span>
                <span className="block whitespace-pre text-[#444]">
                  {'  '}
                  ──────────────────────────────────
                </span>
                <span className="block whitespace-pre text-[#666]">
                  {'  '}DOMAIN IN FOCUS
                </span>
                <span className="block whitespace-pre">
                  {'  '}
                  <span className="text-[#666]">Groove Feel</span>
                  {'  '}
                  <span className="text-[#4A9EFF]">████████</span>
                  <span className="text-[#444]">██</span>
                  {'  '}
                  <span className="text-[#E8650A]">gap detected</span>
                </span>
                <span className="block">&nbsp;</span>
              </div>
            </TerminalChrome>
          </div>
        </section>

        {/* Spacer to maintain visual gap between hero and ecosystem */}
        <div className="py-[30px]" />

        {/* ── ECOSYSTEM ──────────────────────────────────────────────── */}
        <section
          ref={ecosystemRef}
          id="ecosystem"
          className="py-[120px] px-6 md:px-[60px] max-w-[1200px] mx-auto"
        >
          <div data-reveal className="landing-reveal mb-[70px]">
            <SectionLabel>The Ecosystem</SectionLabel>
            <h2 className="font-heading uppercase text-[clamp(44px,6vw,72px)] leading-[0.95] text-[#E8E8E8] mb-5">
              A <span className="text-[#E8650A]">bass world</span> that unlocks
              as you <span className="text-[#E8650A]">grow</span>
            </h2>
            <p className="text-[#999] text-xl max-w-[580px] leading-[1.7] font-dm-body">
              Every musician lives in four modes — Learn, Practice, Create,
              Perform. Bassicology built a room for each one. The more you play,
              the more opens up.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-0.5">
            {ROOMS.map((r, i) => (
              <RoomCard key={r.name} {...r} delay={(i % 2) + 1} />
            ))}
          </div>

          <div
            data-reveal
            className="landing-reveal mt-10 py-6 px-7 bg-[#1A1008] border border-[rgba(232,101,10,0.2)] border-l-[3px] border-l-[#E8650A] text-[15px] text-[#999] italic font-dm-body"
          >
            <strong className="text-[#E8E8E8] not-italic">
              Progress in one room unlocks something new in another —
              automatically.
            </strong>{' '}
            You never have to figure out what comes next.
          </div>
        </section>

        <Divider />

        {/* ── SOCIAL PROOF ───────────────────────────────────────────── */}
        <section
          ref={socialRef}
          id="social"
          className="py-20 px-6 md:px-[60px] max-w-[1200px] mx-auto"
        >
          <div data-reveal className="landing-reveal">
            <SectionLabel>What Players Say</SectionLabel>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0.5">
            {QUOTES.map((q, i) => (
              <div
                key={i}
                data-reveal
                style={{ transitionDelay: `${(i + 1) * 0.1}s` }}
                className="landing-reveal bg-[#0F0F0F] border border-[#252525] p-7 hover:border-[#333] transition-colors"
              >
                <span className="font-heading uppercase text-[56px] leading-[0.7] text-[#E8650A] opacity-30 block mb-3">
                  &ldquo;
                </span>
                <p className="text-sm leading-[1.75] text-[#999] italic mb-5 font-dm-body">
                  {q.text}
                </p>
                <span className="text-xs font-semibold text-[#555] tracking-[0.06em] uppercase">
                  {q.who}
                </span>
              </div>
            ))}
          </div>
        </section>

        <Divider />

        {/* ── DOMAINS — Connect the Dots ─────────────────────────────── */}
        <section
          ref={domainsRef}
          id="domains"
          className="py-[120px] px-6 md:px-[60px] max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          {/* Domain map */}
          <div data-reveal className="landing-reveal">
            <TerminalChrome title="DOMAIN MATRIX">
              <div className="p-8 bg-[#080808] relative">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_50%,rgba(232,101,10,0.04)_0%,transparent_70%)] pointer-events-none" />
                <DomainMatrixSVG />
                <div className="font-mono text-[11px] text-[#444] text-center mt-4 tracking-[0.08em]">
                  // each domain scored · each gap visible
                </div>
              </div>
            </TerminalChrome>
          </div>

          {/* copy */}
          <div
            data-reveal
            className="landing-reveal"
            style={{ transitionDelay: '0.2s' }}
          >
            <SectionLabel>How It Works</SectionLabel>
            <h2 className="font-heading uppercase text-[clamp(60px,7vw,96px)] leading-[0.88] text-[#E8E8E8] mb-9">
              Connect
              <br />
              the dots
            </h2>
            <p className="text-[#999] text-[15px] leading-[1.8] mb-4 font-dm-body">
              Most platforms give you more. More songs, more videos, more
              techniques to accumulate. Bassicology does the opposite.
            </p>
            <div className="py-5 px-6 border-l-[3px] border-l-[#E8650A] bg-[#1A1008] text-base italic text-[#E8650A] my-7 leading-relaxed">
              &ldquo;The problem was never more information — it was connecting
              what you already had.&rdquo;
            </div>
            <p className="text-[#999] text-[15px] leading-[1.8] mb-4 font-dm-body">
              Bass playing breaks down into 17 trainable domains. Each one is an
              iceberg — you don&apos;t need to own the whole thing. Get the tip
              of the right ones and they synthesise together into something that
              sounds completely different.
            </p>
            <p className="text-[#999] text-[15px] leading-[1.8] mb-4 font-dm-body">
              Isolate the domain you&apos;re missing. Build it from first
              principles. Put it back inside real music. You hear the difference
              in the same session.
            </p>
            <div className="bg-[#0F0F0F] border border-[#252525] py-5 px-6 text-sm text-[#999] italic mt-6 leading-[1.7] font-dm-body">
              Get two or three of the right domains at real depth — and you
              already sound like a completely different player.
            </div>
          </div>
        </section>

        {/* ── QUOTE BANNER ─────────────────────────────────────────── */}
        <div
          ref={quoteBannerRef}
          className="py-16 md:py-24 px-6 md:px-[60px] text-center landing-reveal"
        >
          <p className="max-w-[720px] mx-auto text-xl md:text-2xl leading-relaxed text-[#C8C8C8] font-dm-body italic">
            &ldquo;Whether you&rsquo;re just starting, rebuilding after years
            away, or years in and still feeling the ceiling&nbsp;&mdash; this is
            built for where you actually are.&rdquo;
          </p>
        </div>

        {/* ── START SMALL ────────────────────────────────────────────── */}
        <section
          ref={startRef}
          id="start-small"
          className="py-[120px] px-6 md:px-[60px] max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center"
        >
          <div data-reveal className="landing-reveal">
            <SectionLabel>Start Small</SectionLabel>
            <h2 className="font-heading uppercase text-[clamp(72px,9vw,120px)] leading-[0.88] text-[#E8E8E8] mb-9">
              Start
              <br />
              small
            </h2>
            <p className="text-[#999] text-[15px] leading-[1.8] mb-4 font-dm-body">
              Take the Groove Finder. Come back. Your Domain Matrix is mapped,
              your gaps are identified, and your first three practice sessions
              are already waiting — built specifically around what you need.
            </p>
            <p className="text-[#999] text-[15px] leading-[1.8] mb-4 font-dm-body">
              You don&apos;t plan the practice. You don&apos;t figure out what
              to work on. You open the platform, see your session card, and
              press Start. It runs itself.
            </p>
            <p className="text-[#999] text-[15px] leading-[1.8] mb-4 font-dm-body">
              Every session is named. Timed. Focused on one thing. Small enough
              to fit inside a real day. Big enough to move the needle every
              time.
            </p>
            <div className="py-5 px-6 border-l-[3px] border-l-[#E8650A] bg-[#1A1008] text-[15px] italic text-[#999] my-7 leading-[1.7] font-dm-body">
              This is the closest thing to having a great teacher — without
              needing one in the room.
            </div>
            <div className="mt-10">
              <button
                onClick={goToAssessment}
                className="inline-flex items-center gap-2.5 bg-[#E8650A] text-white px-8 py-4 text-[15px] font-semibold tracking-[0.04em] rounded-sm hover:bg-[#B84E08] hover:-translate-y-px transition-all cursor-pointer border-none"
              >
                <span>▸</span> Take the Free Groove Finder
              </button>
              <p className="text-xs text-[#555] mt-3 italic">
                3 minutes · Free · No credit card · Sessions 15–25 min · First 3
                already built
              </p>
            </div>
          </div>

          {/* Session card */}
          <div
            data-reveal
            className="landing-reveal"
            style={{ transitionDelay: '0.2s' }}
          >
            <div className="bg-[#0A0A0A] border border-[#252525] rounded-md overflow-hidden shadow-[0_40px_80px_rgba(0,0,0,0.5)]">
              {/* top bar */}
              <div className="bg-[#161616] px-5 py-3 flex gap-2 items-center border-b border-[#252525]">
                <span className="w-2.5 h-2.5 rounded-full bg-[#FF5F56]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#FFBD2E]" />
                <span className="w-2.5 h-2.5 rounded-full bg-[#27C93F]" />
                <span className="text-[11px] text-[#555] tracking-[0.08em] ml-2 font-mono">
                  TODAY&apos;S SESSION
                </span>
              </div>

              {/* tabs */}
              <div className="flex border-b border-[#252525] overflow-x-auto">
                {SESSION_TABS.map((tab, i) => (
                  <div
                    key={tab.label}
                    className={`px-4 py-2.5 text-xs flex items-center gap-1.5 border-r border-[#252525] whitespace-nowrap ${
                      i === 1
                        ? 'text-[#E8E8E8] bg-[rgba(232,101,10,0.05)] border-b border-b-[#E8650A] -mb-px'
                        : 'text-[#555]'
                    }`}
                  >
                    {tab.icon} {tab.label}
                  </div>
                ))}
              </div>

              {/* session body */}
              <div className="p-6 pb-5">
                <div className="text-[10px] font-semibold tracking-[0.16em] uppercase text-[#555] mb-2">
                  Today&apos;s Session
                </div>
                <div className="font-heading uppercase text-[32px] tracking-[0.04em] text-[#E8E8E8] mb-1 flex justify-between items-baseline">
                  The Grid
                  <span className="text-sm text-[#999] font-dm-body font-normal">
                    20 min
                  </span>
                </div>
                <p className="text-[13px] text-[#999] mb-5 leading-relaxed font-dm-body">
                  Where you place a note matters more than what note you play.
                </p>

                {/* tags */}
                <div className="flex gap-2 mb-6 flex-wrap">
                  <span className="px-3 py-1 rounded-sm text-[11px] font-semibold tracking-[0.08em] uppercase bg-[rgba(74,158,255,0.12)] text-[#4A9EFF] border border-[rgba(74,158,255,0.2)]">
                    Time
                  </span>
                  <span className="px-3 py-1 rounded-sm text-[11px] font-semibold tracking-[0.08em] uppercase bg-[rgba(61,186,111,0.12)] text-[#3DBA6F] border border-[rgba(61,186,111,0.2)]">
                    Sound
                  </span>
                  <span className="px-3 py-1 rounded-sm text-[11px] font-semibold tracking-[0.08em] uppercase bg-[rgba(232,101,10,0.12)] text-[#E8650A] border border-[rgba(232,101,10,0.2)]">
                    Hands
                  </span>
                </div>

                {/* start button */}
                <button className="w-full bg-[#E8650A] text-white border-none py-3.5 font-dm-body text-sm font-semibold tracking-[0.06em] cursor-pointer flex items-center justify-center gap-2.5 rounded-sm hover:bg-[#B84E08] transition-colors mb-7">
                  ▶ &nbsp; Start Session
                </button>

                {/* progress */}
                <div className="border-t border-[#252525] pt-5">
                  <div className="text-[10px] font-semibold tracking-[0.14em] uppercase text-[#555] mb-3.5">
                    Your Progress
                  </div>
                  <div className="flex gap-5 mb-4">
                    {STATS.map((s) => (
                      <div
                        key={s.name}
                        className="flex-1 bg-[#161616] py-2.5 px-2 rounded-sm text-center"
                      >
                        <span className="font-heading uppercase text-[26px] tracking-[0.04em] text-[#E8E8E8] block">
                          {s.value}
                        </span>
                        <span className="text-[10px] text-[#555] uppercase tracking-[0.08em]">
                          {s.name}
                        </span>
                      </div>
                    ))}
                  </div>
                  {PAST_SESSIONS.map((ps) => (
                    <div
                      key={ps.name}
                      className="flex items-center gap-3 py-2.5 border-b border-[#252525] last:border-b-0"
                    >
                      <div className="w-7 h-7 rounded-full border border-[#333] flex items-center justify-center flex-shrink-0 text-[#555] text-[9px]">
                        ▶
                      </div>
                      <span className="text-[13px] text-[#999] flex-1 font-dm-body">
                        {ps.name}
                      </span>
                      <span className="text-[11px] text-[#555] font-mono">
                        {ps.time}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <Divider />

        {/* ── FAQ ─────────────────────────────────────────────────────── */}
        <section
          ref={faqRef}
          id="faq"
          className="py-[120px] px-6 md:px-[60px] max-w-[900px] mx-auto"
        >
          <div data-reveal className="landing-reveal">
            <SectionLabel>FAQ</SectionLabel>
          </div>
          <h2
            data-reveal
            className="landing-reveal font-heading uppercase text-[52px] text-[#E8E8E8] mb-[60px] tracking-[0.02em] text-center"
          >
            A few things people ask
          </h2>
          {FAQ_DATA.map((item, i) => (
            <div key={i} data-reveal className="landing-reveal">
              <FaqItem question={item.q} answer={item.a} />
            </div>
          ))}
        </section>

        <Divider />

        {/* ── FOOTER ──────────────────────────────────────────────────── */}
        <footer className="py-10 px-6 md:px-[60px] max-w-[1200px] mx-auto flex items-center justify-between">
          <a
            href="/"
            aria-label="Bassicology home"
            className="flex items-start gap-1.5 no-underline cursor-pointer"
          >
            <div className="font-heading uppercase text-xl tracking-[0.12em] text-[#E8650A] leading-none">
              BASSICOLOGY
            </div>
            <span className="text-[9px] font-semibold tracking-[0.18em] uppercase text-[#666] border border-[#333] px-1.5 py-0.5 rounded-sm leading-none -translate-y-0.5">
              Beta
            </span>
          </a>
          <div className="text-[13px] text-[#555]">
            Premium bass education. Built from first principles.
          </div>
        </footer>
      </div>

      {/* ── Back to top ─────────────────────────────────────────────────
          Portaled to <body> to escape the .ui-zone CSS containment
          (which would otherwise scope position: fixed to that container). */}
      {mounted &&
        createPortal(
          <button
            onClick={scrollToTop}
            aria-label="Back to top"
            title="Back to top"
            style={{
              position: 'fixed',
              bottom: '64px',
              right: '64px',
              zIndex: 110,
              width: '44px',
              height: '44px',
              background: '#0F0F0F',
              border: '1px solid #252525',
              color: '#E8650A',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: showBackToTop ? 1 : 0,
              transform: showBackToTop ? 'translateY(0)' : 'translateY(8px)',
              pointerEvents: showBackToTop ? 'auto' : 'none',
              transition:
                'opacity 0.2s, transform 0.2s, background 0.2s, border-color 0.2s',
            }}
          >
            <span style={{ fontSize: '16px', lineHeight: 1 }}>↑</span>
          </button>,
          document.body,
        )}
    </>
  );
}

// ─── Shared Presentational Helpers ───────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8650A] mb-5">
      {children}
    </div>
  );
}

function Divider() {
  return (
    <div className="h-px bg-gradient-to-r from-transparent via-[#252525] to-transparent mx-6 md:mx-[60px]" />
  );
}

// ─── Static Data ─────────────────────────────────────────────────────────────
const QUOTES = [
  {
    text: 'I practiced for 3 years and something was always off. First session on Bassicology I found out it was my muting. One thing. Three years.',
    who: 'Marcus, 34 — Playing 4 years',
  },
  {
    text: "I picked up bass again after 12 years away. The Groove Finder placed me at my actual level in 3 minutes. I didn't have to start from zero.",
    who: 'Sandra, 41 — Returning player',
  },
  {
    text: "I had the gear, the tutorials, the hours. What I didn't have was someone to tell me what was actually wrong. Bassicology did that in session one.",
    who: 'Dan, 38 — Self-taught bassist',
  },
];

const ROOMS = [
  {
    icon: '🎸',
    name: 'Bassment',
    mode: 'Learn + Practice',
    body: 'Two sides. The Class — a guided path through domains, linear, progressive, led. The Woodshed — self-directed drilling on your specific gaps. Where the ceiling moves.',
  },
  {
    icon: '🎙',
    name: 'Studio',
    mode: 'Create',
    body: 'Checkpoint recordings that auto-build your progress portfolio. The move from "I can play" to "I can make something." Your proof of growth — manufactured as a byproduct of learning.',
  },
  {
    icon: '🤘',
    name: 'Gigs',
    mode: 'Perform',
    body: 'Constraint-based challenges. Pressure situations. Feel changes, drop-ins, live adaptation. The thing every bassist fears — freezing on a real gig — trained safely here, before it matters.',
  },
  {
    icon: '🪪',
    name: 'Backstage',
    mode: 'The Meta Layer',
    body: "Your Domain Matrix. Progress dashboard. Community. Groove Cards. The bird's-eye view of your playing — always accessible, never competing for attention during sessions.",
  },
];

const SESSION_TABS = [
  { icon: '🏠', label: 'Home' },
  { icon: '🎸', label: 'Bassment' },
  { icon: '🎙', label: 'Studio' },
  { icon: '🤘', label: 'Gigs' },
];

const STATS = [
  { value: '8', name: 'Takes' },
  { value: '48m', name: 'Today' },
  { value: '5', name: 'Grooves' },
];

const PAST_SESSIONS = [
  { name: 'Duration Dial — Mixed', time: '0:18' },
  { name: 'The 50/50 — Final Take', time: '0:24' },
  { name: 'Day 1 — Before Muting', time: '0:15' },
];

const FAQ_DATA = [
  {
    q: 'Who is this for?',
    a: "Anyone who plays bass and wants to get better. Whether you just learned your open strings or you've been playing for years and something still feels off — if you want to understand the instrument rather than just play along to songs, this is your place.",
  },
  {
    q: 'What is the Groove Finder?',
    a: 'A free 3-minute assessment that maps your playing across all 17 domains and gives you a personalised 3-day practice plan — three sessions built automatically around your specific gaps. No credit card, no catch.',
  },
  {
    q: 'Do I need to know music theory?',
    a: 'No. You learn through playing, not reading about playing. Every session starts with you picking up the bass before anyone explains anything. The theory, if it comes up at all, arrives as the answer to a question you just experienced — not as a lesson delivered upfront.',
  },
  {
    q: 'What happens after the first 3 sessions?',
    a: 'Your Domain Matrix keeps updating as you play. The platform keeps prescribing what to work on next. The further you go, the more unlocks — new rooms, new drills, new challenges built around where you are.',
  },
  {
    q: 'Do I need any special gear?',
    a: 'Just a bass and somewhere to play it. The platform runs in your browser. Plug in through an audio interface for the best experience, but you can get started with whatever you have right now.',
  },
  {
    q: 'Is this for beginners or advanced players?',
    a: 'Both. The domains work at every level. A beginner builds foundations from scratch. An advanced player finds the specific ones they skipped and goes back to own them properly. The platform meets you where you are.',
  },
  {
    q: 'Can this help me get ready to play with other musicians?',
    a: "Yes — and it's one of the most common reasons people come here. Whether your goal is to groove confidently alone or feel ready to play in a band, the Domain Matrix shows you exactly what's between you and that moment.",
  },
  {
    q: 'What if I just want to play and have fun?',
    a: "Go straight to Gigs. Pick a genre, plug in, follow the fretboard. No structure, no schedule. Just you, your bass, and the groove. The assessment is always there when you're ready to go deeper.",
  },
];
