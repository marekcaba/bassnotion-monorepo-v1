'use client';

/**
 * GrooveCardControls — LAUNCH-02.5c.
 *
 * Bottom-row controls: Mute Bass / Key stepper / Play (center) / Tempo
 * stepper / Solo Drums. Plus a click toggle (♪) that the shell positions
 * in the top-right.
 *
 * Tempo and Key are stepper buttons (◂ value ▸) with ±1 step. The
 * caller (useGrooveCardPlayback) owns clamping; this component just
 * fires onTempoChange / onKeyChange with the next value.
 *
 * Every cap-relevant button reads `useEntitlement()` so LAUNCH-02 can
 * make the levers cap-aware without touching this component.
 */

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
} from 'lucide-react';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import { Popover, PopoverAnchor } from '@/shared/components/ui/popover';
import type { CountdownState } from '@/domains/widgets/hooks/useCountdown';
import type { HoverHintKey } from './captions';
import { parsePitchClass, spellPitchClass, prefersFlats } from './pitchClass';

/**
 * Convert an `originalKey` label + a semitone offset into a real note-name
 * display label, e.g. "E" + 2 → "F♯", "Db" + 3 → "E", "Bb" − 2 → "A♭".
 *
 * Parses flats/sharps/glyphs on the way in; spells the result in flats when the
 * original key was a flat key (bass-friendly), sharps otherwise. Falls back to
 * a "±N" form only when the original key is genuinely unparseable.
 */
export function formatKeyLabel(
  originalKey: string,
  semitonesFromOriginal: number,
): string {
  const baseIndex = parsePitchClass(originalKey);
  if (baseIndex == null) {
    if (semitonesFromOriginal === 0) return originalKey;
    const sign = semitonesFromOriginal > 0 ? '+' : '';
    return `${originalKey} ${sign}${semitonesFromOriginal}`;
  }
  return (
    spellPitchClass(
      baseIndex + semitonesFromOriginal,
      prefersFlats(originalKey),
    ) || originalKey
  );
}

interface GrooveCardControlsProps {
  isPlaying: boolean;
  isReady: boolean;
  isLoading: boolean;
  /** Visual count-in driver. While `isCountingDown` is true and
   *  `currentBeat > 0`, the play button shows the beat number instead of
   *  the Play/Pause icon. */
  countdownState: CountdownState;
  currentBpm: number;
  currentSemitones: number;
  pendingKeyShift: number | null;
  originalKey: string;
  isBassMuted: boolean;
  isSoloDrums: boolean;
  /** Disable the Mute button (e.g. while the bass is soloed — muting the part
   *  you're soloing would just be silence). */
  muteDisabled?: boolean;
  onPlayPause: () => void;
  onTempoChange: (next: number) => void;
  onKeyChange: (next: number) => void;
  onMuteBass: (muted: boolean) => void;
  onSoloDrums: (solo: boolean) => void;
  /** Fired when a FREE user taps Solo Drums while the deconstruction cap is on.
   *  The button stays tappable (not a dead disabled control) so the cap can
   *  pitch the upgrade instead of silently doing nothing. */
  onDeconCapHit?: () => void;
  /** The in-flow upgrade pitch — a popover anchored to the control just bumped.
   *  `pitchLever` names which control to anchor to (null = closed). The parent
   *  owns the open state (set on cap-hit, cleared on dismiss). */
  pitchLever?: 'tempo' | 'transpose' | 'loopRange' | 'deconstruction' | null;
  onPitchOpenChange?: (open: boolean) => void;
  /** Rendered inside the popover when open — the message + Upgrade CTA. */
  pitchContent?: React.ReactNode;
  /** Optional hover-hint reporter. Called with a `HoverHintKey` when the
   *  pointer enters one of the labelled buttons, and `null` on leave. The
   *  parent renders the matching string in the caption row above. Pointer-
   *  only — touch users don't see hover state. */
  onHoverHint?: (next: HoverHintKey | null) => void;
  /** When true, apply the deconstruction (Solo Drums) cap from entitlement.
   *  Only the drill surface opts in; tutorial/marketing surfaces leave it
   *  off so Solo Drums stays available there regardless of tier. */
  enforceCaps?: boolean;
  /** When true (drill bricks), the key + tempo are PRESCRIBED by the author —
   *  the steppers render disabled (read-only) so the student practices exactly
   *  the prescribed setup ("do exactly this"). */
  lockSettings?: boolean;
  /** When true (Dynamic Loop engaged), ONLY the key stepper is locked — the
   *  auto-cycle owns the key, so manual transposes are disabled. Tempo stays
   *  free. Separate from lockSettings (which also locks tempo). */
  lockKey?: boolean;
  /** The NEXT key the Dynamic Loop will move to (note-name label, e.g. "E"), or
   *  null when not cycling. Rendered as a green letter after a "→" arrow inside
   *  the key stepper, so the player can anticipate the change. */
  nextKeyLabel?: string | null;
  /** The effective transpose edge (absolute semitones): the engine's ±6, or the
   *  entitlement band when the user is capped. Used to DIM the key chevron at
   *  the edge so a member who's hit ±6 (the real end of the range — there is no
   *  ±7) sees a disabled control, not the upgrade pitch. */
  transposeRange: number;
  /** True when the transpose edge is the entitlement BAND (free tier), not the
   *  engine. In that case the chevron stays ENABLED at the edge so bumping it
   *  fires the upgrade pitch (the cap IS the CTA). When false (member), the
   *  chevron dims at the engine edge instead. */
  transposeCapped?: boolean;
}

export function GrooveCardControls({
  isPlaying,
  isReady,
  isLoading,
  countdownState,
  currentBpm,
  currentSemitones,
  pendingKeyShift,
  originalKey,
  isBassMuted,
  isSoloDrums,
  muteDisabled = false,
  onPlayPause,
  onTempoChange,
  onKeyChange,
  onMuteBass,
  onSoloDrums,
  onDeconCapHit,
  pitchLever,
  onPitchOpenChange,
  pitchContent,
  onHoverHint,
  enforceCaps = false,
  lockSettings = false,
  lockKey = false,
  nextKeyLabel = null,
  transposeRange,
  transposeCapped = false,
}: GrooveCardControlsProps) {
  // Cap-aware hook reads — LAUNCH-02 will populate these.
  const { caps } = useEntitlement();

  // While the Dynamic Loop drives the key (lockKey), show the ACTUAL current
  // key and suppress the manual "queued" affordances — the green next-key
  // preview chip is the proper "change incoming" signal there. pendingKeyShift
  // is set on every auto-cycle setKey, so honouring it here would make the
  // stepper jump ahead to the next key and pin a permanent "…".
  const displayedSemitones = lockKey
    ? currentSemitones
    : (pendingKeyShift ?? currentSemitones);
  const keyLabel = formatKeyLabel(originalKey, displayedSemitones);

  // Edge-dim the key chevrons. When the user is NOT capped (a member), the
  // transpose edge is the engine's hard ±6 — there is no further to go, so the
  // chevron at that edge is disabled (dimmed), NOT a hidden upsell trigger. When
  // capped (free tier), the chevron stays enabled at the band edge so bumping it
  // surfaces the upgrade pitch (the cap is the CTA).
  const atUpperKeyEdge =
    !transposeCapped && !lockKey && currentSemitones >= transposeRange;
  const atLowerKeyEdge =
    !transposeCapped && !lockKey && currentSemitones <= -transposeRange;

  // Band levers (tempo/transpose) are NOT disabled when capped — they stay
  // enabled so the user can move WITHIN the band and bump the edge (the
  // engine clamps to the band and fires the cap-hit upsell). Disabling them
  // would hide the teaching moment. Mute is never capped. Only deconstruction
  // (solo drums) is a hard on/off gate.
  const deconCapped = enforceCaps && caps.deconstruction.isCapped;

  // Hover hint helper. PointerEvent unifies mouse / pen / touch; we filter
  // out 'touch' so taps don't briefly flash a hint before the tap action's
  // own reactive caption replaces it.
  const hoverProps = (key: HoverHintKey) =>
    onHoverHint
      ? {
          onPointerEnter: (e: ReactPointerEvent) => {
            if (e.pointerType === 'touch') return;
            onHoverHint(key);
          },
          onPointerLeave: () => onHoverHint(null),
        }
      : {};

  // One Popover for the whole row; the active lever provides the anchor so the
  // pitch pops FROM the control just bumped. A non-matching lever renders the
  // control plain. `transpose` anchors to the Key control, `tempo`/`loopRange`/
  // `deconstruction` to theirs.
  const anchorIf = (
    lever: 'tempo' | 'transpose' | 'loopRange' | 'deconstruction',
    node: React.ReactNode,
  ) =>
    pitchLever === lever ? <PopoverAnchor asChild>{node}</PopoverAnchor> : node;

  return (
    <Popover
      open={pitchLever != null}
      onOpenChange={(o) => onPitchOpenChange?.(o)}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 bg-black/40 rounded-b-xl">
        {anchorIf(
          'deconstruction',
          <button
            type="button"
            onClick={() =>
              deconCapped ? onDeconCapHit?.() : onSoloDrums(!isSoloDrums)
            }
            // When capped, stay enabled so the tap pitches the upgrade (the cap
            // is the pitch); only truly disable while the card isn't ready yet.
            disabled={!isReady}
            aria-pressed={isSoloDrums}
            aria-label="Solo drums"
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isSoloDrums
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            } ${deconCapped ? 'opacity-60' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
            {...hoverProps('solo-drums')}
          >
            Solo
          </button>,
        )}

        {anchorIf(
          'transpose',
          <div {...hoverProps('key')}>
            <Stepper
              label={keyLabel}
              // The key value is a note name; render it as an anchored letter so
              // it doesn't shift when an accidental (♯/♭) is added. A pending
              // change shows by the letter itself updating — no "…" suffix.
              labelKind="note"
              onPrev={() =>
                onKeyChange((pendingKeyShift ?? currentSemitones) - 1)
              }
              onNext={() =>
                onKeyChange((pendingKeyShift ?? currentSemitones) + 1)
              }
              disabled={!isReady || lockSettings || lockKey}
              // Dim the chevron at the engine edge for an uncapped (member)
              // user — ±6 is the end of the range, not a paywall. ← lowers the
              // key (prev), → raises it (next).
              disablePrev={atLowerKeyEdge}
              disableNext={atUpperKeyEdge}
              ariaLabel="Key"
              // Dynamic Loop: the upcoming key (green) shown after the arrow so
              // the player can anticipate the change.
              nextKeyLabel={nextKeyLabel}
            />
          </div>,
        )}

        <button
          type="button"
          onClick={onPlayPause}
          disabled={!isReady}
          aria-label={
            countdownState.isCountingDown && countdownState.currentBeat > 0
              ? `Countdown beat ${countdownState.currentBeat}`
              : isPlaying
                ? 'Pause'
                : 'Play'
          }
          className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-400 transition-colors focus:outline-none focus-visible:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
          {...hoverProps(isPlaying ? 'play-pause-pause' : 'play-pause-play')}
        >
          {isLoading ? (
            <span className="text-[10px] uppercase tracking-wider">
              Loading
            </span>
          ) : countdownState.isCountingDown &&
            countdownState.currentBeat > 0 ? (
            // Count-in: show "1", "2", "3", "4" inside the button. Same UX
            // pattern as the YouTube tutorial player (PlaybackControlsBar).
            <span className="text-2xl font-bold leading-none" aria-hidden>
              {countdownState.currentBeat}
            </span>
          ) : isPlaying ? (
            <Pause className="w-6 h-6" aria-hidden />
          ) : (
            <Play className="w-6 h-6 ml-0.5" aria-hidden />
          )}
        </button>

        {anchorIf(
          'tempo',
          <div {...hoverProps('tempo')}>
            <Stepper
              label={`${currentBpm}`}
              suffix=" BPM"
              onPrev={() => onTempoChange(currentBpm - 1)}
              onNext={() => onTempoChange(currentBpm + 1)}
              disabled={!isReady || lockSettings}
              ariaLabel="Tempo"
            />
          </div>,
        )}

        <button
          type="button"
          onClick={() => onMuteBass(!isBassMuted)}
          disabled={!isReady || muteDisabled}
          aria-pressed={isBassMuted}
          aria-label="Mute bass"
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            isBassMuted
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          {...hoverProps('mute-bass')}
        >
          Mute
        </button>
      </div>
      {pitchContent}
    </Popover>
  );
}

/**
 * KeyChangeDisplay — the animated "current → next" key indicator shown inside
 * the key stepper while the Dynamic Loop cycles. Stable layout: a fixed central
 * arrow ("we go to here") with a bare letter on each side — white CURRENT key,
 * green NEXT key, no pill/rectangle/count. When the cycle advances, EACH letter
 * crossfades to its new value (the departing letter eases out + drifts, the new
 * one eases in), so the whole indicator reads as the keys travelling forward.
 */
function KeyChangeDisplay({
  currentLabel,
  nextLabel,
}: {
  currentLabel: string;
  nextLabel: string;
}) {
  return (
    <span
      className="flex items-center justify-center gap-1.5 text-center"
      aria-label={`Current key ${currentLabel}, next key ${nextLabel}`}
    >
      <AnimatedLetter label={currentLabel} className="text-white" />
      <ArrowRight className="w-3.5 h-3.5 text-white/40 shrink-0" aria-hidden />
      <AnimatedLetter label={nextLabel} className="text-emerald-300" />
    </span>
  );
}

/**
 * AnimatedLetter — a single key letter that crossfades when its value changes:
 * the departing letter eases out (drifting left), the new one eases in. The slot
 * has a FIXED width (sized for a 2-glyph key like "D♭") and centers its content,
 * so single-char keys ("E") and flat/sharp keys ("D♭") occupy the same space and
 * the letters never shift horizontally as the key changes — the central arrow
 * stays put. Both the live and departing letters are absolutely centered so
 * neither drives the box width.
 */
function AnimatedLetter({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  const prevRef = useRef(label);
  const [leaving, setLeaving] = useState<string | null>(null);

  useEffect(() => {
    if (prevRef.current === label) return undefined;
    const departing = prevRef.current;
    prevRef.current = label;
    setLeaving(departing);
    const t = setTimeout(() => setLeaving(null), 200);
    return () => clearTimeout(t);
  }, [label]);

  return (
    <span className="relative inline-flex h-5 w-8 shrink-0 items-center justify-center">
      <span
        key={`in-${label}`}
        className={`absolute inset-0 flex items-center justify-center text-base font-semibold leading-none animate-key-arrive ${className}`}
      >
        {label}
      </span>
      {leaving && leaving !== label && (
        <span
          key={`out-${leaving}`}
          aria-hidden
          className={`absolute inset-0 flex items-center justify-center text-base font-semibold leading-none animate-key-leave ${className}`}
        >
          {leaving}
        </span>
      )}
    </span>
  );
}

/**
 * NoteLabel — a key note name where the BASE LETTER is centered between the
 * stepper arrows and any accidental (♯/♭) hangs off the letter's RIGHT without
 * affecting that centering. The accidental is absolutely positioned at the
 * letter's right edge, so "C" and "C♯" keep the SAME centered letter position —
 * the letter never shifts when an accidental appears; only the glyph is added.
 */
function NoteLabel({ label }: { label: string }) {
  // Split the leading note letter (A-G, case-insensitive) from any accidental
  // glyph(s). A non-note fallback label (e.g. "E +3") renders as-is in the base.
  const m = /^([A-Ga-g])(.*)$/.exec(label);
  const base = m ? m[1] : label;
  const accidental = m ? m[2] : '';
  return (
    <span className="flex items-center justify-center">
      {/* The base letter is centered; the accidental is absolutely placed at its
          right edge so it doesn't push the letter off-center. */}
      <span className="relative inline-flex items-center justify-center text-base font-semibold text-white">
        <span>{base}</span>
        {accidental ? (
          <span className="absolute left-full top-0">{accidental}</span>
        ) : null}
      </span>
    </span>
  );
}

interface StepperProps {
  label: string;
  suffix?: string;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  ariaLabel: string;
  /** 'note' renders the label as a note name with the BASE letter anchored in a
   *  fixed slot and any accidental (♯/♭) hanging off its right, so the letter
   *  never shifts when an accidental is added/removed. 'text' (default) renders
   *  the label centered with its suffix (e.g. tempo "100 BPM"). */
  labelKind?: 'note' | 'text';
  /** Per-direction disable for the range EDGE (dim just the prev or next
   *  chevron when there's no further to go). Combined with the whole-stepper
   *  `disabled`. */
  disablePrev?: boolean;
  disableNext?: boolean;
  /** Dynamic Loop: the upcoming key shown in green after the arrow. Null when
   *  not cycling (then the plain stepper renders). */
  nextKeyLabel?: string | null;
}

function Stepper({
  label,
  suffix,
  onPrev,
  onNext,
  disabled,
  ariaLabel,
  labelKind = 'text',
  disablePrev = false,
  disableNext = false,
  nextKeyLabel = null,
}: StepperProps) {
  return (
    <div className="flex items-center gap-1" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled || disablePrev}
        aria-label={`${ariaLabel} down`}
        className="p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
      </button>
      {/* Key label lives in a FIXED-WIDTH slot sized for the WIDER engaged
          state ("current → next"), so engaging the Dynamic Loop — which swaps
          the plain key letter for the animated KeyChangeDisplay — doesn't change
          the stepper's footprint and shove the neighbouring controls. */}
      {labelKind === 'note' ? (
        <span className="flex w-[84px] items-center justify-center">
          {nextKeyLabel ? (
            <KeyChangeDisplay currentLabel={label} nextLabel={nextKeyLabel} />
          ) : (
            <NoteLabel label={label} />
          )}
        </span>
      ) : (
        // FIXED-WIDTH numeric label: the value sits in a constant-width,
        // tabular-figures slot (right-aligned) so 2↔3 digit changes (99↔100)
        // don't reflow the suffix or the neighbouring controls. The suffix
        // ("BPM") is a separate fixed element after it.
        <span className="flex items-center justify-center text-base font-semibold text-white">
          <span className="inline-block w-[3ch] text-right tabular-nums">
            {label}
          </span>
          {suffix && <span className="ml-1.5">{suffix.trim()}</span>}
        </span>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled || disableNext}
        aria-label={`${ariaLabel} up`}
        className="p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
