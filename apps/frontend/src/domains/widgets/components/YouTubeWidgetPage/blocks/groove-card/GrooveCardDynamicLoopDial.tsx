'use client';

/**
 * GrooveCardDynamicLoopDial — the top-right "Dynamic Loop" control.
 *
 * A small button (sits next to the metronome in the shell header) that opens a
 * popover to configure + engage the auto key-cycle: the groove holds the home
 * key for N loops, transposes to a target key for N loops, then back — forever,
 * each change landing on the loop seam.
 *
 * This component is PURELY the dial UI + its local config state. The cycle math
 * lives in useDynamicLoop (driven from the view). The parent owns the `engaged`
 * flag (so it can force-disengage on stop / losing active-card focus) and the
 * live config; this component just renders steppers and the Engage toggle and
 * reports changes up.
 *
 * Settings are per-card, in-memory only (no persistence) — the parent holds the
 * state; a reload resets to defaults.
 */

import { ChevronLeft, ChevronRight, Repeat } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover';
import { formatKeyLabel } from './GrooveCardControls';
import type { DynamicLoopConfig } from './useDynamicLoop';

interface GrooveCardDynamicLoopDialProps {
  /** Original key label (e.g. "E"), used to render the target as a real note
   *  name via formatKeyLabel. */
  originalKey: string;
  /** Current dial config (target semitones + loops-per-key). */
  config: DynamicLoopConfig;
  /** Fired when the user steps either dial. The parent holds the state. */
  onConfigChange: (next: DynamicLoopConfig) => void;
  /** Whether the cycle is currently engaged. */
  engaged: boolean;
  /** Toggle engage on/off. */
  onEngagedChange: (engaged: boolean) => void;
  /** The effective transpose range edge (engine cap, or the entitlement band
   *  when tighter). The target stepper clamps to ±this so the cycle never trips
   *  setKey's cap/upsell path. */
  maxSemitones: number;
  /** Disable the whole control (e.g. while not ready). */
  disabled?: boolean;
  /** Hover-hint reporter, matching the metronome button's pattern. Pointer
   *  only — touch is filtered by the caller. */
  onHover?: (hovering: boolean) => void;
}

const EVERY_MIN = 1;
const EVERY_MAX = 16;

export function GrooveCardDynamicLoopDial({
  originalKey,
  config,
  onConfigChange,
  engaged,
  onEngagedChange,
  maxSemitones,
  disabled,
  onHover,
}: GrooveCardDynamicLoopDialProps) {
  const max = Math.max(1, Math.round(maxSemitones));
  const target = Math.max(
    -max,
    Math.min(max, Math.round(config.targetSemitones)),
  );
  const everyN = Math.max(
    EVERY_MIN,
    Math.min(EVERY_MAX, Math.round(config.everyN)),
  );

  const stepTarget = (delta: number) => {
    const next = Math.max(-max, Math.min(max, target + delta));
    if (next !== target) onConfigChange({ ...config, targetSemitones: next });
  };
  const stepEvery = (delta: number) => {
    const next = Math.max(EVERY_MIN, Math.min(EVERY_MAX, everyN + delta));
    if (next !== everyN) onConfigChange({ ...config, everyN: next });
  };

  const targetLabel = formatKeyLabel(originalKey, target);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Dynamic loop settings"
          aria-pressed={engaged}
          className={`p-2 rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
            engaged
              ? 'bg-orange-500 text-white'
              : 'bg-white/5 text-white/50 hover:bg-white/10'
          }`}
          onPointerEnter={
            onHover
              ? (e) => {
                  if (e.pointerType === 'touch') return;
                  onHover(true);
                }
              : undefined
          }
          onPointerLeave={onHover ? () => onHover(false) : undefined}
        >
          <Repeat className="w-4 h-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        side="bottom"
        className="w-64 bg-zinc-900 border-white/10 text-white p-4"
      >
        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold">Dynamic loop</h4>
            <p className="mt-0.5 text-xs text-white/50">
              Auto-transpose every few loops, then back.
            </p>
          </div>

          {/* Transpose-to dial */}
          <DialRow
            label="Transpose to"
            value={targetLabel}
            onPrev={() => stepTarget(-1)}
            onNext={() => stepTarget(1)}
            prevDisabled={target <= -max}
            nextDisabled={target >= max}
            ariaLabel="Dynamic loop target key"
          />

          {/* Every-N-loops dial */}
          <DialRow
            label="Every"
            value={`${everyN} ${everyN === 1 ? 'loop' : 'loops'}`}
            onPrev={() => stepEvery(-1)}
            onNext={() => stepEvery(1)}
            prevDisabled={everyN <= EVERY_MIN}
            nextDisabled={everyN >= EVERY_MAX}
            ariaLabel="Dynamic loop length"
          />

          {/* Engage toggle */}
          <button
            type="button"
            onClick={() => onEngagedChange(!engaged)}
            aria-pressed={engaged}
            className={`w-full py-2 rounded-md text-sm font-medium transition-colors ${
              engaged
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            {engaged ? 'Disengage' : 'Engage dynamic loop'}
          </button>
          {engaged && (
            <p className="text-[11px] text-white/40 leading-snug">
              The key stepper is locked while engaged. Disengage to change it.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DialRowProps {
  label: string;
  value: string;
  onPrev: () => void;
  onNext: () => void;
  prevDisabled: boolean;
  nextDisabled: boolean;
  ariaLabel: string;
}

function DialRow({
  label,
  value,
  onPrev,
  onNext,
  prevDisabled,
  nextDisabled,
  ariaLabel,
}: DialRowProps) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-white/70">{label}</span>
      <div className="flex items-center gap-1" aria-label={ariaLabel}>
        <button
          type="button"
          onClick={onPrev}
          disabled={prevDisabled}
          aria-label={`${ariaLabel} down`}
          className="p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden />
        </button>
        <span className="min-w-[64px] text-center text-sm font-medium text-white">
          {value}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled}
          aria-label={`${ariaLabel} up`}
          className="p-1.5 rounded-md text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-4 h-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
