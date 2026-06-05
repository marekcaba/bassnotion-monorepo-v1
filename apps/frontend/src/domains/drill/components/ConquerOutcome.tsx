'use client';

/**
 * The drill outcome bar under the Groove Card — criterion-aware (Phase 1).
 *
 * Renders the right control for the brick's completion criterion + the live
 * target, with a disabled "Next" until the criterion is met, plus the
 * "too hard → lay it anyway" release valve on every brick:
 *
 *   - conquer → self-report "I played it clean" button (advances on tap).
 *   - time    → "practice N:NN" countdown; Next unlocks at 0.
 *   - loops   → "loops X / N" counter; Next unlocks at N.
 *   - manual  → an "I'm done" Next button (always enabled).
 *   - done    → burst + result chip.
 *
 * Self-report v1 (no Bridge). Silver/Gold are greyed targets until scoring.
 */

import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import type { MasteryTier, DrillCriterionType } from '@bassnotion/contracts';
import type { CriterionProgress } from '../hooks/useDrillCriterion';

interface ConquerOutcomeProps {
  /** The brick's criterion type (drives which control shows). */
  criterionType: DrillCriterionType | undefined;
  /** Live progress for time/loops, or null. */
  progress: CriterionProgress | null;
  /** Whether a measured criterion (time/loops) is satisfied. */
  isMet: boolean;
  /** Set once the brick is done (shows the celebration state). */
  doneTier: MasteryTier | 'done' | null;
  /** Whether the card is ready to play (gates the buttons). */
  isReady: boolean;
  /** conquer criterion — self-report clean pass. */
  onConquer: () => void;
  /** time/loops/manual criterion — advance once met (or immediately for manual). */
  onCriterionDone: () => void;
  /** Release valve — advance with a released result. */
  onStepDown: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function ConquerOutcome({
  criterionType,
  progress,
  isMet,
  doneTier,
  isReady,
  onConquer,
  onCriterionDone,
  onStepDown,
}: ConquerOutcomeProps) {
  if (doneTier) {
    const conquered = doneTier !== 'done';
    return (
      <div className="flex flex-col items-center gap-3 py-3">
        <div className="relative grid place-items-center">
          <div className="absolute h-16 w-16 rounded-full bg-[#cd7f4d]/20 animate-ping" />
          <div className="relative grid h-14 w-14 place-items-center rounded-full border-2 border-[#cd7f4d] text-2xl">
            ✓
          </div>
        </div>
        <p className="text-sm font-semibold">
          {conquered
            ? "Conquered. That's a rep that counts."
            : 'Done. Brick laid.'}
        </p>
        {conquered && (
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge className="border-transparent bg-[#cd7f4d] text-black">
              🥉 Bronze
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500">
              🔒 Silver · at tempo
            </Badge>
            <Badge variant="outline" className="border-zinc-700 text-zinc-500">
              🔒 Gold · new key
            </Badge>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 py-3">
      {/* Live target for measured criteria. */}
      {criterionType === 'time' && progress && (
        <p className="font-mono text-2xl text-white">
          {formatTime(progress.target - progress.current)}
        </p>
      )}
      {criterionType === 'loops' && progress && (
        <p className="text-sm text-white">
          loops{' '}
          <span className="font-semibold">
            {progress.current} / {progress.target}
          </span>
        </p>
      )}

      {/* Primary action per criterion. */}
      {criterionType === 'conquer' ? (
        <Button
          onClick={onConquer}
          disabled={!isReady}
          className="w-full text-white sm:w-auto"
        >
          ✓ I played it clean — conquer it
        </Button>
      ) : (
        <Button
          onClick={onCriterionDone}
          // manual is always enabled; time/loops unlock when met.
          disabled={!isReady || (criterionType !== 'manual' && !isMet)}
          className="w-full text-white sm:w-auto"
        >
          {criterionType === 'manual' ? "I'm done →" : 'Next →'}
        </Button>
      )}

      <button
        type="button"
        onClick={onStepDown}
        className="text-xs text-white/70 underline underline-offset-2 hover:text-white"
      >
        Too hard — lay it anyway ↓
      </button>
    </div>
  );
}
