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

// Pitch-class index (0..11) for every common note spelling. Handles naturals,
// sharps and flats, in both ASCII (#/b) and glyph (♯/♭) accidentals, plus the
// rare B♯/E♯/C♭/F♭ enharmonics. This is the INPUT parser — the admin types the
// groove's original key as free text (e.g. "Db", "F#", "B♭").
const PITCH_CLASS_BY_NAME: Record<string, number> = {
  c: 0,
  'b#': 0,
  dbb: 0,
  'c#': 1,
  db: 1,
  d: 2,
  'c##': 2,
  ebb: 2,
  'd#': 3,
  eb: 3,
  e: 4,
  fb: 4,
  'd##': 4,
  f: 5,
  'e#': 5,
  gbb: 5,
  'f#': 6,
  gb: 6,
  g: 7,
  'f##': 7,
  abb: 7,
  'g#': 8,
  ab: 8,
  a: 9,
  'g##': 9,
  bbb: 9,
  'a#': 10,
  bb: 10,
  b: 11,
  cb: 11,
  'a##': 11,
};

// OUTPUT spellings. Flat keys (the groove's original key uses a ♭, or none of
// the white-key sharps fits naturally) read better in flats for bass players;
// otherwise sharps. We pick the table by whether the ORIGINAL key was flat.
const SHARP_LABELS = [
  'C',
  'C♯',
  'D',
  'D♯',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'A♯',
  'B',
] as const;
const FLAT_LABELS = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'G♭',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;

/** Normalise a free-text note name to a pitch class 0..11, or null if we can't
 *  parse it. Accepts "Db", "D♭", "F#", "F♯", "b#", etc. */
function parsePitchClass(name: string): number | null {
  const normalised = name
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .toLowerCase();
  const pc = PITCH_CLASS_BY_NAME[normalised];
  return pc == null ? null : pc;
}

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
  const shifted = (((baseIndex + semitonesFromOriginal) % 12) + 12) % 12;
  const usesFlat = /♭|b/.test(originalKey.trim().replace(/♯/g, '#').slice(1));
  const labels = usesFlat ? FLAT_LABELS : SHARP_LABELS;
  return labels[shifted] ?? originalKey;
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
  const isKeyPending = !lockKey && pendingKeyShift !== null;

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
        <button
          type="button"
          onClick={() => onMuteBass(!isBassMuted)}
          disabled={!isReady}
          aria-pressed={isBassMuted}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            isBassMuted
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-white/70 hover:bg-white/10'
          } disabled:opacity-40 disabled:cursor-not-allowed`}
          {...hoverProps('mute-bass')}
        >
          Mute Bass
        </button>

        {anchorIf(
          'transpose',
          <div {...hoverProps('key')}>
            <Stepper
              label={keyLabel}
              suffix={isKeyPending ? ' …' : ''}
              onPrev={() =>
                onKeyChange((pendingKeyShift ?? currentSemitones) - 1)
              }
              onNext={() =>
                onKeyChange((pendingKeyShift ?? currentSemitones) + 1)
              }
              disabled={!isReady || lockSettings || lockKey}
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
          className="w-14 h-14 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
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
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              isSoloDrums
                ? 'bg-orange-500 text-white'
                : 'bg-white/5 text-white/70 hover:bg-white/10'
            } ${deconCapped ? 'opacity-60' : ''} disabled:opacity-40 disabled:cursor-not-allowed`}
            {...hoverProps('solo-drums')}
          >
            Solo Drums
          </button>,
        )}
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
      className="flex items-center justify-center gap-1.5 min-w-[56px] text-center"
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

interface StepperProps {
  label: string;
  suffix?: string;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  ariaLabel: string;
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
  nextKeyLabel = null,
}: StepperProps) {
  return (
    <div className="flex items-center gap-1" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={onPrev}
        disabled={disabled}
        aria-label={`${ariaLabel} down`}
        className="p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden />
      </button>
      {/* While the Dynamic Loop cycles: "current → next" with both letters
          animating on each change (KeyChangeDisplay). Otherwise: the plain
          current key + pending "…". */}
      {nextKeyLabel ? (
        <KeyChangeDisplay currentLabel={label} nextLabel={nextKeyLabel} />
      ) : (
        <span className="flex items-center justify-center min-w-[56px] text-center">
          <span className="text-base font-semibold text-white">
            {label}
            {suffix}
          </span>
        </span>
      )}
      <button
        type="button"
        onClick={onNext}
        disabled={disabled}
        aria-label={`${ariaLabel} up`}
        className="p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight className="w-4 h-4" aria-hidden />
      </button>
    </div>
  );
}
