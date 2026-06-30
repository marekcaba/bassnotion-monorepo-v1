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
// The KEY + TEMPO pickers use the platform-wide animated HORIZONTAL roller (the groove card's
// Stepper) so they match every other groove card. The content pickers (Scale/Exercise/Variant/
// Position) keep the vertical RollerPicker wheel. Cross-domain import, like the Dynamic Loop dial.
import { Stepper } from '@/domains/widgets/components/YouTubeWidgetPage/blocks/groove-card/GrooveCardControls';
// import { RollerCalibrationPanel } from './RollerCalibrationPanel'; // dev tuner — values baked
import { ROLLER_ANIM, type RollerAnimConfig } from './rollerConfig';
import type { CountdownState } from '@/domains/widgets/hooks/useCountdown';

/**
 * Adapt a vertical-wheel RollerSpec to the horizontal Stepper's props. The wheel's UP raises
 * the value (revealing prevLabel/prev2Label above); the horizontal stepper's RIGHT chevron
 * (onNext) raises too. So onNext←onUp, onPrev←onDown, and the neighbour to the RIGHT (offset
 * +1) is the wheel's raised value (prevLabel), to the LEFT (−1) the lowered (nextLabel).
 */
function stepperPropsFromSpec(spec: RollerSpec) {
  const neighbor = (offset: number): string =>
    offset === 1
      ? (spec.prevLabel ?? spec.currentLabel)
      : offset === 2
        ? (spec.prev2Label ?? spec.prevLabel ?? spec.currentLabel)
        : offset === -1
          ? (spec.nextLabel ?? spec.currentLabel)
          : offset === -2
            ? (spec.next2Label ?? spec.nextLabel ?? spec.currentLabel)
            : spec.currentLabel;
  return {
    label: spec.currentLabel,
    onPrev: spec.onDown,
    onNext: spec.onUp,
    disabled: spec.disabled,
    neighborFor: neighbor,
  };
}

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
  /** RECORD MODE: when armed (via the header Rec icon), the orange ▶ Play becomes a red ●
   *  Record — the scale bass is muted and every take is captured + graded. The ARM control
   *  lives in the header cluster now; this is read-only here (drives the center button). */
  recordMode?: boolean;
  /** ASSIGNMENT (gig) mode — the exercise/key/tempo/loops are LOCKED presets. Greys out + no-ops
   *  every roller, hides the content row (the WHAT is fixed), and pins record mode ON. The student
   *  only gets ▶/●. */
  locked?: boolean;
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
  recordMode = false,
  locked = false,
}: ScalesControlsProps) {
  const showBeat =
    countdownState.isCountingDown && countdownState.currentBeat > 0;

  // In locked (assignment) mode every roller is greyed + no-op'd. Apply it once here so each
  // RollerPicker below inherits it without threading `disabled` through every call site.
  const lock = (spec: RollerSpec): RollerSpec =>
    locked ? { ...spec, disabled: true } : spec;

  // Roller animation config — baked in ROLLER_ANIM. (Live tuner panel commented out;
  // re-enable RollerCalibrationPanel + setAnim to re-tune.)
  const [anim] = React.useState<RollerAnimConfig>(ROLLER_ANIM);

  return (
    <div className="flex flex-col gap-2 rounded-b-xl bg-black/40 px-4 py-2.5">
      {/* <RollerCalibrationPanel config={anim} onChange={setAnim} /> */}

      {/* ROW 1 — CONTENT: Scale type | kind tabs | Exercise. HIDDEN in locked (assignment)
          mode — the WHAT is fixed by the gig; the student doesn't choose content. */}
      {!locked && (
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
            {/* POSITION — which box of the scale (Runs/Patterns); hidden for Paths (a full-
                neck path has no box). Lives on the CONTENT row so the PERFORM row below stays
                a fixed Key · ▶ · Tempo regardless of kind. */}
            {showPosition && (
              <RollerPicker {...lock(position)} anim={anim} ariaLabel="Position" />
            )}
          </div>
        </div>
      )}

      {/* ROW 2 — PERFORM: Key | ▶ | Tempo. Fixed layout for every kind (Position moved to the
          content row above). Dynamic Loop / Drone / Rec live in the header icon cluster. */}
      <div className="flex items-center gap-3">
        {/* LEFT group — Key. The platform-wide animated horizontal roller (Stepper), same as
            every groove card; note-anchored so the letter doesn't shift when an accidental
            appears. */}
        <div className="flex flex-1 items-center justify-evenly gap-2">
          <Stepper
            {...stepperPropsFromSpec(lock(keyRoller))}
            labelKind="note"
            ariaLabel="Key"
          />
        </div>

        {/* CENTER — Play (orange) or RECORD (red), fixed island, always centered. In record
            mode the orange ▶ becomes a red ● (and a ■ stop while a take is recording). */}
        <button
          type="button"
          onClick={onPlayPause}
          disabled={!isReady}
          data-no-focus-ring
          aria-label={
            showBeat
              ? `Countdown beat ${countdownState.currentBeat}`
              : recordMode
                ? isPlaying
                  ? 'Stop recording'
                  : 'Record'
                : isPlaying
                  ? 'Pause'
                  : 'Play'
          }
          className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-white transition-colors focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${
            recordMode
              ? 'bg-red-600 hover:bg-red-500'
              : 'bg-orange-500 hover:bg-orange-400'
          }`}
        >
          {showBeat ? (
            <span className="text-xl font-bold">
              {countdownState.currentBeat}
            </span>
          ) : recordMode ? (
            isPlaying ? (
              <StopIcon />
            ) : (
              <RecordIcon />
            )
          ) : isPlaying ? (
            <PauseIcon />
          ) : (
            <PlayIcon />
          )}
        </button>

        {/* RIGHT group — Tempo */}
        <div className="flex flex-1 items-center justify-evenly gap-2">
          {/* Tempo: the platform-wide animated horizontal roller, with " BPM" suffix and
              press-and-hold to fly through values (stepping one tap at a time is tedious). */}
          <Stepper
            {...stepperPropsFromSpec(lock(tempo))}
            suffix=" BPM"
            ariaLabel="Tempo"
            holdRepeat
          />

          {/* Drone (engage toggle), Dynamic Loop, Rec, and Volume ALL live in the header
              icon cluster now (see ScalesTool's headerExtra + the shell's caption row): the
              drone icon engages/disengages the pad; its LEVEL rides in the volume popover.
              Nothing drone/rec/cycle related clutters this perform bar anymore. */}
        </div>
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg
      width="28"
      height="28"
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
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
    </svg>
  );
}
function RecordIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="12" r="7" />
    </svg>
  );
}
function StopIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
  );
}
