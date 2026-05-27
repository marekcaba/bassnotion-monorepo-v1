'use client';

/**
 * GrooveCardShell — LAUNCH-02.5c.
 *
 * Frame around the waveform + controls. Header carries the
 * "NOW PLAYING · TITLE — SUBTITLE" label + the click-toggle (♪) in the
 * top-right. Caption row below the waveform reflects reactive copy from
 * `stateCaptions`.
 */

import { Music2 } from 'lucide-react';
import type { ReactNode } from 'react';

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
}: GrooveCardShellProps) {
  return (
    <section
      data-block-type="groove-card"
      className="relative rounded-xl bg-zinc-900 border border-white/5 text-white shadow-lg overflow-hidden"
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
        >
          <Music2 className="w-4 h-4" aria-hidden />
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
