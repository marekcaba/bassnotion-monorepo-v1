'use client';

/**
 * GrooveCardShell — LAUNCH-02.5c.
 *
 * Frame around the waveform + controls. Header carries the
 * "NOW PLAYING · TITLE — SUBTITLE" label + the click-toggle (♪) in the
 * top-right. Caption row below the waveform reflects reactive copy from
 * `stateCaptions`.
 */

import { Metronome } from 'lucide-react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';

interface GrooveCardShellProps {
  title: string;
  subtitle: string;
  isPlaying: boolean;
  caption: string;
  clickEnabled: boolean;
  onToggleClick: () => void;
  /** Slot for the waveform component. */
  waveform: ReactNode;
  /** Slot for the controls bar. */
  controls: ReactNode;
  /** Read-only metadata line under the title (e.g. "E · 4 bars").
   * Composed by the view; omitted when empty. */
  meta?: string;
  /** Mouse-over the metronome button reports 'metronome' here; pointer-
   *  leave reports null. Touch is filtered out by the caller. */
  onMetronomeHover?: (hovering: boolean) => void;
  /** Override the card's outer background. Pass a CSS color string (or any
   *  Tailwind-compatible value). Defaults to the in-app tutorial player's
   *  zinc-900 so the in-app surface is unchanged; the waitlist surface
   *  passes the page's own `#100E0D` so the card blends into the
   *  surrounding "Why It Works" column. */
  bg?: string;
}

export function GrooveCardShell({
  title,
  subtitle,
  isPlaying,
  caption,
  clickEnabled,
  onToggleClick,
  waveform,
  controls,
  meta,
  onMetronomeHover,
  bg,
}: GrooveCardShellProps) {
  return (
    <section
      data-block-type="groove-card"
      className="relative rounded-xl bg-zinc-900 border border-white/5 text-white shadow-lg overflow-hidden"
      // Inline style wins over the Tailwind class when `bg` is supplied,
      // letting the waitlist surface theme the card without touching the
      // in-app tutorial player default.
      style={bg ? { backgroundColor: bg } : undefined}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-4 px-4 pt-4">
        <div className="flex-1 min-w-0">
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
        <button
          type="button"
          onClick={onToggleClick}
          aria-label={clickEnabled ? 'Mute click' : 'Enable click'}
          aria-pressed={clickEnabled}
          className={`p-2 rounded-full transition-colors ${
            clickEnabled
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
          onPointerEnter={
            onMetronomeHover
              ? (e: ReactPointerEvent) => {
                  if (e.pointerType === 'touch') return;
                  onMetronomeHover(true);
                }
              : undefined
          }
          onPointerLeave={
            onMetronomeHover ? () => onMetronomeHover(false) : undefined
          }
        >
          <Metronome className="w-4 h-4" aria-hidden />
        </button>
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
    </section>
  );
}
