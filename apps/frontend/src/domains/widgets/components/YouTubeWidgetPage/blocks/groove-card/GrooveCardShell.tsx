'use client';

/**
 * GrooveCardShell — LAUNCH-02.5c.
 *
 * Frame around the waveform + controls. Header carries the
 * "NOW PLAYING · TITLE — SUBTITLE" label + the click-toggle (♪) in the
 * top-right. Caption row below the waveform reflects reactive copy from
 * `stateCaptions`.
 */

import { Volume2, VolumeX, AudioWaveform, Music4 } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';

interface GrooveCardShellProps {
  title: string;
  subtitle: string;
  isPlaying: boolean;
  caption: string;
  /** Master volume for the whole groove (all stems), 0..1. */
  masterVolume: number;
  /** Fired as the master volume slider moves (0..1). */
  onMasterVolumeChange: (volume: number) => void;
  /** Slot for the waveform component. */
  waveform: ReactNode;
  /** Slot for the chord chart row, rendered in the header's middle column when
   *  `chordsVisible`. Omitted (null) when the groove has no chord chart. */
  chordRow?: ReactNode;
  /** Whether the chord ribbon is currently shown (toggled by the header chord
   *  icon). When false the middle column stays empty. */
  chordsVisible?: boolean;
  /** Toggle the chord ribbon's visibility (the header chord icon). */
  onToggleChords?: () => void;
  /** Which view the window slot is showing: the audio waveform or the bass
   *  sheet-music notation. When omitted, no view toggle is shown. */
  windowView?: 'waveform' | 'sheet';
  /** Toggle the window between waveform and sheet (the header notation icon).
   *  Omitted → no toggle. */
  onToggleWindowView?: () => void;
  /** Slot for the controls bar. */
  controls: ReactNode;
  /** Slot rendered INSIDE the card frame, below the controls (e.g. the premium
   *  Lines & Fills section). Omitted when the surface has nothing to show. */
  footer?: ReactNode;
  /** Read-only metadata line under the title (e.g. "E · 4 bars").
   * Composed by the view; omitted when empty. */
  meta?: string;
  /** Extra control rendered in the top-right cluster (e.g. the Dynamic Loop
   *  dial). Omitted on surfaces that don't offer it (drill bricks, capped free
   *  tier). */
  headerExtra?: ReactNode;
  /** Override the card's outer background. Pass a CSS color string (or any
   *  Tailwind-compatible value). Defaults to the in-app tutorial player's
   *  zinc-900 so the in-app surface is unchanged; the waitlist surface
   *  passes the page's own `#100E0D` so the card blends into the
   *  surrounding "Why It Works" column. */
  bg?: string;
  /** When true, drop the card's border + shadow so the tool FLOATS on the page
   *  (used by the gym equipment tools with a transparent `bg`, so the page texture
   *  shows through cleanly). Defaults false → the normal framed groove card. */
  floating?: boolean;
  /** When true, omit the title block (the "GROOVE CARD" eyebrow + title/subtitle).
   *  The right-side header controls (window toggle, volume) stay. Used by the gym
   *  equipment tools where the station already has its own heading. Default false. */
  hideTitle?: boolean;
}

export function GrooveCardShell({
  title,
  subtitle,
  isPlaying,
  caption,
  masterVolume,
  onMasterVolumeChange,
  waveform,
  chordRow,
  chordsVisible = false,
  onToggleChords,
  windowView,
  onToggleWindowView,
  controls,
  footer,
  meta,
  headerExtra,
  bg,
  floating = false,
  hideTitle = false,
}: GrooveCardShellProps) {
  // The groove card is driven by keyboard SHORTCUTS (letter keys via
  // useGrooveCardKeyboard), NOT by Tab-focusing its controls. Tabbing onto a
  // control and pressing Space would activate whatever happened to be focused —
  // surprising and unwanted. So make every focusable control NON-tabbable
  // (tabIndex=-1): Tab skips the card entirely, controls stay clickable, shortcuts
  // are unaffected. (Stuck focus-ring artifacts are suppressed in globals.css.)
  //
  // Two DOM scopes need detabbing: (1) the card's own subtree, and (2) Radix
  // POPOVER content, which Radix PORTALS to <body> (outside the card) — so the
  // Dynamic Loop / volume / loop-range panels would otherwise stay tab-focusable.
  // We detab any `[data-slot="popover-content"]` in the body too (only ever the
  // card's popovers in these surfaces). Both scopes re-run on DOM mutations so
  // controls/panels that mount later are covered.
  const rootRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const SELECTOR =
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const detabWithin = (container: ParentNode) => {
      container.querySelectorAll<HTMLElement>(SELECTOR).forEach((el) => {
        if (el.getAttribute('tabindex') !== '-1')
          el.setAttribute('tabindex', '-1');
      });
    };
    const detabCard = () => detabWithin(root);
    const detabPopovers = () => {
      // Portaled popover panels (Dynamic Loop, volume, loop-range upsell, …).
      const panels = document.querySelectorAll<HTMLElement>(
        '[data-slot="popover-content"]',
      );
      if (panels.length === 0) return; // cheap early-out for unrelated body churn
      panels.forEach((panel) => {
        panel.setAttribute('tabindex', '-1');
        detabWithin(panel);
      });
    };
    detabCard();
    detabPopovers();
    // Card subtree → detab the card's own controls as they change.
    const cardObserver = new MutationObserver(detabCard);
    cardObserver.observe(root, { childList: true, subtree: true });
    // Body subtree → detab popover panels when they portal in (early-out keeps the
    // unrelated-body-churn cost to one querySelectorAll).
    const bodyObserver = new MutationObserver(detabPopovers);
    bodyObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      cardObserver.disconnect();
      bodyObserver.disconnect();
    };
  }, []);

  return (
    <section
      ref={rootRef}
      data-block-type="groove-card"
      className={
        floating
          ? // No overflow-hidden when floating: equipment tools let the fretboard
            // canvas BLEED past the card edges to show more frets.
            'relative rounded-xl text-white'
          : 'relative rounded-xl border border-white/5 text-white shadow-lg overflow-hidden'
      }
      // Default card background is the warm near-black the waitlist demo
      // established (#100E0D), so the in-app player and the waitlist surface
      // render the Groove Card identically. A supplied `bg` prop still
      // overrides per-card. (Inline style instead of a Tailwind class so the
      // single default lives in one place.)
      style={{ backgroundColor: bg ?? '#100E0D' }}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-8 px-4 pt-4">
        {/* Title block — capped so it never squeezes the chord ribbon to
            nothing; it truncates instead. Omitted when hideTitle (equipment tools
            carry their own heading), leaving the header controls right-aligned. */}
        {!hideTitle && (
          <div className="min-w-0 max-w-[45%] shrink-0">
            <span className="text-[10px] tracking-[0.2em] uppercase text-white/40">
              {isPlaying ? 'Now playing' : 'Groove card'}
            </span>
            <h3 className="text-base font-semibold text-white truncate">
              {title}
              {subtitle && (
                <span className="text-white/50 font-normal"> — {subtitle}</span>
              )}
            </h3>
            {meta && (
              <p className="mt-0.5 text-xs text-white/40 truncate">{meta}</p>
            )}
          </div>
        )}
        {/* Chord ribbon fills the space between the title and the controls,
            with the now-line centered. Symmetric edge fades dissolve the chords
            on BOTH sides (played chords exiting left, upcoming approaching from
            the right) so neither edge hard-cuts. The mask spans the full ribbon
            width (no inner padding eating the left fade); the title gap comes
            from the header's gap. Omitted when the groove has no chart, leaving
            the title/controls layout unchanged. */}
        <div
          className="min-w-0 flex-1"
          style={{
            maskImage:
              'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
            WebkitMaskImage:
              'linear-gradient(to right, transparent 0%, black 18%, black 82%, transparent 100%)',
          }}
        >
          {chordsVisible ? chordRow : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Window view toggle — switch the window between the audio WAVEFORM
              and the bass SHEET-MUSIC notation. A compact two-icon segmented
              control; the active half highlights. */}
          {windowView && onToggleWindowView && (
            <div
              role="group"
              aria-label="Window view"
              className="flex items-center rounded-full bg-white/5 p-0.5"
            >
              <button
                type="button"
                onClick={() =>
                  windowView !== 'waveform' && onToggleWindowView()
                }
                aria-label="Show waveform"
                aria-pressed={windowView === 'waveform'}
                title="Waveform"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  windowView === 'waveform'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <AudioWaveform className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => windowView !== 'sheet' && onToggleWindowView()}
                aria-label="Show sheet music"
                aria-pressed={windowView === 'sheet'}
                title="Sheet music"
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
                  windowView === 'sheet'
                    ? 'bg-orange-500 text-white shadow-sm'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Music4 className="h-4 w-4" aria-hidden />
              </button>
            </div>
          )}
          {/* Chord-strip toggle (LEFT) — shows/hides the chord ribbon. Labelled
              "A7" rather than a notes glyph so it's obvious it toggles chords.
              Highlights orange when on. */}
          {onToggleChords && (
            <button
              type="button"
              onClick={onToggleChords}
              aria-label={chordsVisible ? 'Hide chords' : 'Show chords'}
              aria-pressed={chordsVisible}
              title="Chords"
              className={`flex h-9 min-w-[36px] items-center justify-center rounded-full px-2 text-xs font-bold tracking-tight transition-colors ${
                chordsVisible
                  ? 'bg-orange-500 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              A7
            </button>
          )}
          {/* Master volume (MIDDLE) — scales the whole groove (all stems),
              0..1. Tucked behind a volume icon; clicking it pops the slider. */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Volume"
                title="Volume"
                className="p-2.5 rounded-full bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
              >
                {masterVolume <= 0 ? (
                  <VolumeX className="w-5 h-5" aria-hidden />
                ) : (
                  <Volume2 className="w-5 h-5" aria-hidden />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              // Force the dark card palette regardless of page theme (the card
              // is always dark), so the popover matches the surface.
              className="flex w-auto items-center gap-2 border-white/10 bg-[#1a1716] px-3 py-2"
            >
              <VolumeX
                className="w-3.5 h-3.5 shrink-0 text-white/40"
                aria-hidden
              />
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={masterVolume}
                onChange={(e) => onMasterVolumeChange(Number(e.target.value))}
                aria-label="Volume"
                className="h-1 w-32 cursor-pointer accent-orange-500"
              />
              <Volume2
                className="w-3.5 h-3.5 shrink-0 text-white/40"
                aria-hidden
              />
            </PopoverContent>
          </Popover>
          {/* Dynamic Loop dial (RIGHT) — the headline interactive control,
              styled to stand out (see the dial's own styling). */}
          {headerExtra}
        </div>
      </header>

      {/* Waveform */}
      <div className="px-4 pt-4">{waveform}</div>

      {/* Caption */}
      <div className="px-4 py-3 min-h-[2.5rem]">
        {caption ? (
          <p className="text-sm text-white/70">{caption}</p>
        ) : (
          <p className="text-sm text-white/30 italic">…</p>
        )}
      </div>

      {/* Controls bar */}
      {controls}

      {/* Footer slot — part of the card frame (e.g. premium Lines & Fills). */}
      {footer}
    </section>
  );
}
