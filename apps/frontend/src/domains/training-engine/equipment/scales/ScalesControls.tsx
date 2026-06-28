'use client';

/**
 * ScalesControls — the Scales tool's playback grip, built from vertical ROLLER pickers
 * (wheel style) + a center play button. NO solo/mute. Two rows:
 *
 *   ROW 1 (CONTENT):   [Scale type]   Runs · Patterns · Paths   [Exercise]
 *   ROW 2 (PERFORM):   [Position?] [Key]   ▶   [Tempo]
 *
 * The CONTENT row picks WHAT you practice (which scale type, which authored exercise from
 * the library — "Auto" is the generated box scale). The PERFORM row picks HOW (position,
 * key, tempo) and relocates/transposes that one choice at runtime. Position is hidden for
 * full-neck PATHS (a path has no box position). Separate from the shared
 * GrooveCardControls so the real groove card is untouched.
 */

import React from 'react';
import { RollerPicker } from './RollerPicker';
// import { RollerCalibrationPanel } from './RollerCalibrationPanel'; // dev tuner — values baked
import { ROLLER_ANIM, type RollerAnimConfig } from './rollerConfig';
import type { CountdownState } from '@/domains/widgets/hooks/useCountdown';

/** A roller's visible labels (+ two-out neighbors for a continuous slide) + its
 *  up/down handlers. */
export interface RollerSpec {
  prev2Label?: string;
  prevLabel?: string;
  currentLabel: string;
  nextLabel?: string;
  next2Label?: string;
  onUp: () => void;
  onDown: () => void;
  /** Grey out + no-op the arrows (e.g. an Exercise roller with a single option). */
  disabled?: boolean;
}

/** The kind filter on the content row — buckets the library by what KIND of exercise. */
export interface KindTab<K extends string = string> {
  value: K;
  label: string;
}
export interface KindTabsSpec<K extends string = string> {
  tabs: KindTab<K>[];
  active: K;
  onSelect: (k: K) => void;
}

export interface ScalesControlsProps {
  isPlaying: boolean;
  isReady: boolean;
  countdownState: CountdownState;
  /** CONTENT row */
  scale: RollerSpec; // scale TYPE
  exercise: RollerSpec; // which exercise GROUP (or "Auto")
  variant: RollerSpec; // which fingering within the group (v1/v2/…)
  /** Show the variant roller (only when the selected group has >1 fingering). */
  showVariant: boolean;
  kindTabs: KindTabsSpec;
  /** PERFORM row */
  position: RollerSpec;
  /** Hide the Position roller (a full-neck PATH has no box position). */
  showPosition: boolean;
  keyRoller: RollerSpec;
  tempo: RollerSpec;
  onPlayPause: () => void;
}

export function ScalesControls({
  isPlaying,
  isReady,
  countdownState,
  scale,
  exercise,
  variant,
  showVariant,
  kindTabs,
  position,
  showPosition,
  keyRoller,
  tempo,
  onPlayPause,
}: ScalesControlsProps) {
  const showBeat =
    countdownState.isCountingDown && countdownState.currentBeat > 0;

  // Roller animation config — baked in ROLLER_ANIM. (Live tuner panel commented out;
  // re-enable RollerCalibrationPanel + setAnim to re-tune.)
  const [anim] = React.useState<RollerAnimConfig>(ROLLER_ANIM);

  return (
    <div className="flex flex-col gap-2 rounded-b-xl bg-black/40 px-4 py-2.5">
      {/* <RollerCalibrationPanel config={anim} onChange={setAnim} /> */}

      {/* ROW 1 — CONTENT: Scale type | kind tabs | Exercise */}
      <div className="flex items-center gap-3 border-b border-white/5 pb-2">
        <div className="flex flex-1 items-center justify-evenly">
          <RollerPicker {...scale} anim={anim} ariaLabel="Scale type" />
        </div>
        {/* Kind filter — Runs / Patterns / Paths */}
        <div className="flex shrink-0 gap-1">
          {kindTabs.tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => kindTabs.onSelect(t.value)}
              className={`rounded px-2 py-1 text-[11px] font-semibold transition-colors ${
                kindTabs.active === t.value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white/10 text-gray-300 hover:bg-white/20'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center justify-evenly">
          <RollerPicker {...exercise} anim={anim} ariaLabel="Exercise" />
          {showVariant && (
            <RollerPicker {...variant} anim={anim} ariaLabel="Variant" />
          )}
        </div>
      </div>

      {/* ROW 2 — PERFORM: Position? | Key | ▶ | Tempo */}
      <div className="flex items-center gap-3">
        {/* LEFT group — Position (hidden for paths) | Key */}
        <div className="flex flex-1 items-center justify-evenly">
          {showPosition && (
            <RollerPicker {...position} anim={anim} ariaLabel="Position" />
          )}
          <RollerPicker {...keyRoller} anim={anim} ariaLabel="Key" />
        </div>

        {/* CENTER — Play (fixed island, always centered) */}
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!isReady}
          data-no-focus-ring
          aria-label={
            showBeat
              ? `Countdown beat ${countdownState.currentBeat}`
              : isPlaying
                ? 'Pause'
                : 'Play'
          }
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-colors hover:bg-orange-400 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
        >
          {showBeat ? (
            <span className="text-xl font-bold">
              {countdownState.currentBeat}
            </span>
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        {/* RIGHT group — Tempo */}
        <div className="flex flex-1 items-center justify-evenly">
          {/* Tempo: press-and-hold the arrows to fly through BPM (stepping one at a time
              is tedious over a big range). */}
          <RollerPicker {...tempo} anim={anim} ariaLabel="Tempo" holdRepeat />
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
