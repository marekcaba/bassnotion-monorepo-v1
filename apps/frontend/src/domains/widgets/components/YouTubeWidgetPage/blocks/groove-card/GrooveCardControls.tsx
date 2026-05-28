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

import type { PointerEvent as ReactPointerEvent } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play } from 'lucide-react';
import { useEntitlement } from '@/domains/billing/hooks/useEntitlement';
import type { CountdownState } from '@/domains/widgets/hooks/useCountdown';
import type { HoverHintKey } from './captions';

const SEMITONE_LABELS = [
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

/**
 * Convert an `originalKey` label + a semitone offset into a display label.
 * "E" + 2 → "F♯". Falls back to a "±N" form when the original key isn't
 * one of the 12 names we recognise.
 */
export function formatKeyLabel(
  originalKey: string,
  semitonesFromOriginal: number,
): string {
  const normalised = originalKey.trim();
  const baseIndex = SEMITONE_LABELS.findIndex(
    (n) => n.toLowerCase() === normalised.toLowerCase(),
  );
  if (baseIndex === -1) {
    if (semitonesFromOriginal === 0) return originalKey;
    const sign = semitonesFromOriginal > 0 ? '+' : '';
    return `${originalKey} ${sign}${semitonesFromOriginal}`;
  }
  const shifted = (((baseIndex + semitonesFromOriginal) % 12) + 12) % 12;
  return SEMITONE_LABELS[shifted]!;
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
  /** Optional hover-hint reporter. Called with a `HoverHintKey` when the
   *  pointer enters one of the labelled buttons, and `null` on leave. The
   *  parent renders the matching string in the caption row above. Pointer-
   *  only — touch users don't see hover state. */
  onHoverHint?: (next: HoverHintKey | null) => void;
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
  onHoverHint,
}: GrooveCardControlsProps) {
  // Cap-aware hook reads — LAUNCH-02 will populate these.
  const { caps } = useEntitlement();

  const keyLabel = formatKeyLabel(
    originalKey,
    pendingKeyShift ?? currentSemitones,
  );
  const isKeyPending = pendingKeyShift !== null;

  const tempoCapped = caps.tempo.isCapped;
  const transposeCapped = caps.transpose.isCapped;
  const muteCapped = caps.mute.isCapped;
  const deconCapped = caps.deconstruction.isCapped;

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

  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3 bg-black/40 rounded-b-xl">
      <button
        type="button"
        onClick={() => onMuteBass(!isBassMuted)}
        disabled={muteCapped || !isReady}
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

      <div {...hoverProps('key')}>
        <Stepper
          label={keyLabel}
          suffix={isKeyPending ? ' …' : ''}
          onPrev={() => onKeyChange((pendingKeyShift ?? currentSemitones) - 1)}
          onNext={() => onKeyChange((pendingKeyShift ?? currentSemitones) + 1)}
          disabled={transposeCapped || !isReady}
          ariaLabel="Key"
        />
      </div>

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
          <span className="text-[10px] uppercase tracking-wider">Loading</span>
        ) : countdownState.isCountingDown && countdownState.currentBeat > 0 ? (
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

      <div {...hoverProps('tempo')}>
        <Stepper
          label={`${currentBpm}`}
          suffix=" BPM"
          onPrev={() => onTempoChange(currentBpm - 1)}
          onNext={() => onTempoChange(currentBpm + 1)}
          disabled={tempoCapped || !isReady}
          ariaLabel="Tempo"
        />
      </div>

      <button
        type="button"
        onClick={() => onSoloDrums(!isSoloDrums)}
        disabled={deconCapped || !isReady}
        aria-pressed={isSoloDrums}
        className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
          isSoloDrums
            ? 'bg-orange-500 text-white'
            : 'bg-white/5 text-white/70 hover:bg-white/10'
        } disabled:opacity-40 disabled:cursor-not-allowed`}
        {...hoverProps('solo-drums')}
      >
        Solo Drums
      </button>
    </div>
  );
}

interface StepperProps {
  label: string;
  suffix?: string;
  onPrev: () => void;
  onNext: () => void;
  disabled?: boolean;
  ariaLabel: string;
}

function Stepper({
  label,
  suffix,
  onPrev,
  onNext,
  disabled,
  ariaLabel,
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
      <span className="min-w-[56px] text-center text-sm font-medium text-white">
        {label}
        {suffix}
      </span>
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
