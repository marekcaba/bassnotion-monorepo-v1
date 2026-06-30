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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/shared/components/ui/popover';

/** Fade duration (ms) for the self-managed volume panel (the gym caption-row case). */
const VOL_FADE_MS = 160;

/**
 * useFadeMount — keep content mounted through an exit fade. `mounted` stays true through the
 * fade-out window so opacity can transition 1→0 before unmount; `shown` is the opacity flag.
 * A double rAF on enter guarantees the element paints at opacity 0 first, so 0→1 transitions
 * (a single frame can land in the same paint as mount → no fade). Deterministic in BOTH
 * directions — used instead of Radix's Presence, which doesn't reliably catch the exit on a
 * controlled popover here.
 */
function useFadeMount(wantVisible: boolean): { mounted: boolean; shown: boolean } {
  const [mounted, setMounted] = useState(wantVisible);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (wantVisible) {
      setMounted(true);
      let raf2 = 0;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(raf1);
        cancelAnimationFrame(raf2);
      };
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), VOL_FADE_MS);
    return () => window.clearTimeout(t);
  }, [wantVisible]);
  return { mounted, shown };
}

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
  /** When true, move the volume + headerExtra cluster OUT of the top-right header and into
   *  the CAPTION ROW (bottom-right, just above the controls bar). Used by gym equipment
   *  tools (e.g. Scales) that want those icons down by the perform controls rather than up
   *  in the floating header. The window/chord toggles stay in the header. Default false →
   *  the normal groove card keeps everything in the header. */
  controlsInCaptionRow?: boolean;
  /** An extra control rendered INSIDE the volume popover, below the master-volume row (e.g.
   *  the Scales tool's drone-level slider — all "levels" live behind the one volume icon).
   *  Omitted → the popover holds only the master slider, as the normal groove card does. */
  volumePopoverExtra?: ReactNode;
  /** Optionally CONTROL the volume popover's open state (default: uncontrolled). Gym tools
   *  pass this so they can keep the volume sliders mutually exclusive with the Rec loop
   *  stepper (which shares the same spot) — opening one closes/hides the other. Omitted →
   *  the popover manages its own open state, as the normal groove card does. */
  volumeOpen?: boolean;
  onVolumeOpenChange?: (open: boolean) => void;
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
  controlsInCaptionRow = false,
  volumePopoverExtra,
  volumeOpen,
  onVolumeOpenChange,
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

  // The slider stack shared by both volume-control variants: master volume + an optional
  // extra level row (the gym drone level).
  const volumeSliders = (
    <>
      <div className="flex items-center gap-2">
        <VolumeX className="w-3.5 h-3.5 shrink-0 text-white/40" aria-hidden />
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
        <Volume2 className="w-3.5 h-3.5 shrink-0 text-white/40" aria-hidden />
      </div>
      {volumePopoverExtra}
    </>
  );

  // The trigger icon, shared.
  const volumeIcon = masterVolume <= 0 ? (
    <VolumeX className="w-5 h-5" aria-hidden />
  ) : (
    <Volume2 className="w-5 h-5" aria-hidden />
  );

  // SELF-MANAGED fading panel — used by the gym caption-row case (controlsInCaptionRow), where
  // Radix's Presence doesn't reliably play the EXIT animation on a controlled popover. We own
  // the open state + mount via useFadeMount (deterministic fade IN and OUT, same as the Rec
  // loop stepper), positioned ABOVE the icon, with a click-outside backdrop to close.
  const fade = useFadeMount(controlsInCaptionRow ? !!volumeOpen : false);
  const volumeControl = controlsInCaptionRow ? (
    <div className="relative flex items-center">
      <button
        type="button"
        aria-label="Volume"
        title="Volume"
        aria-expanded={!!volumeOpen}
        onClick={() => onVolumeOpenChange?.(!volumeOpen)}
        className="p-2.5 rounded-full bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
      >
        {volumeIcon}
      </button>
      {fade.mounted && (
        <>
          {/* Click-outside backdrop (invisible) — closes the panel. */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => onVolumeOpenChange?.(false)}
          />
          {/* The sliders panel, above the icon (the cluster sits low in the caption row),
              right-aligned to the icon. Fades both ways via the opacity transition. */}
          <div
            className="absolute bottom-full right-0 z-50 mb-2 flex w-auto flex-col gap-2 rounded-md border border-white/10 bg-[#1a1716] px-3 py-2 shadow-md"
            style={{
              opacity: fade.shown ? 1 : 0,
              transition: `opacity ${VOL_FADE_MS}ms ease-out`,
            }}
          >
            {volumeSliders}
          </div>
        </>
      )}
    </div>
  ) : (
    // DEFAULT (classic groove card header): the shared Radix popover, unchanged.
    <Popover open={volumeOpen} onOpenChange={onVolumeOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Volume"
          title="Volume"
          className="p-2.5 rounded-full bg-white/5 text-white/50 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          {volumeIcon}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        sideOffset={8}
        // Force the dark card palette regardless of page theme (the card is always dark),
        // so the popover matches the surface. A column so an optional extra level row can
        // stack under the master volume.
        className="flex w-auto flex-col gap-2 border-white/10 bg-[#1a1716] px-3 py-2"
      >
        {volumeSliders}
      </PopoverContent>
    </Popover>
  );

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
          {/* Volume + headerExtra (Dynamic Loop dial / Rec icon) live HERE by default. When
              controlsInCaptionRow is set (gym tools), they move down to the caption row
              instead — the window/chord toggles above always stay in the header. */}
          {!controlsInCaptionRow && (
            <>
              {volumeControl}
              {headerExtra}
            </>
          )}
        </div>
      </header>

      {/* Waveform */}
      <div className="px-4 pt-4">{waveform}</div>

      {/* Caption — left-aligned reactive copy. When controlsInCaptionRow is set, the volume
          + headerExtra cluster is right-aligned in this same row (bottom-right, above the
          controls bar) instead of up in the header. */}
      <div className="flex items-center gap-3 px-4 py-3 min-h-[2.5rem]">
        <div className="min-w-0 flex-1">
          {caption ? (
            <p className="text-sm text-white/70">{caption}</p>
          ) : (
            <p className="text-sm text-white/30 italic">…</p>
          )}
        </div>
        {controlsInCaptionRow && (
          // headerExtra (gym tools: Dynamic Loop + Rec) sits BEFORE volume so the row reads
          // left→right as the tool intends, with volume as the rightmost icon.
          <div className="flex shrink-0 items-center gap-2">
            {headerExtra}
            {volumeControl}
          </div>
        )}
      </div>

      {/* Controls bar */}
      {controls}

      {/* Footer slot — part of the card frame (e.g. premium Lines & Fills). */}
      {footer}
    </section>
  );
}
