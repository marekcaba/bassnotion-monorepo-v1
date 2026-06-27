'use client';

/**
 * ScalesControls — the Scales tool's playback grip, built from vertical ROLLER pickers
 * (wheel style) + a center play button. NO solo/mute. Layout:
 *
 *   [Scale roller] [Position roller]   ▶   [Key roller] [Tempo roller]
 *
 * Each roller shows prev (faint) / current (bright) / next (faint) with up/down arrows.
 * Separate from the shared GrooveCardControls so the real groove card is untouched.
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
}

export interface ScalesControlsProps {
  isPlaying: boolean;
  isReady: boolean;
  countdownState: CountdownState;
  scale: RollerSpec;
  position: RollerSpec;
  keyRoller: RollerSpec;
  tempo: RollerSpec;
  onPlayPause: () => void;
}

export function ScalesControls({
  isPlaying,
  isReady,
  countdownState,
  scale,
  position,
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
    <div className="flex items-center gap-3 rounded-b-xl bg-black/40 px-4 py-2.5">
      {/* <RollerCalibrationPanel config={anim} onChange={setAnim} /> */}
      {/* LEFT group — Scale | Position */}
      <div className="flex flex-1 items-center justify-evenly">
        <RollerPicker {...scale} anim={anim} ariaLabel="Scale" />
        <RollerPicker {...position} anim={anim} ariaLabel="Position" />
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

      {/* RIGHT group — Key | Tempo */}
      <div className="flex flex-1 items-center justify-evenly">
        <RollerPicker {...keyRoller} anim={anim} ariaLabel="Key" />
        {/* Tempo: press-and-hold the arrows to fly through BPM (stepping one at a time
            is tedious over a big range). */}
        <RollerPicker {...tempo} anim={anim} ariaLabel="Tempo" holdRepeat />
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
