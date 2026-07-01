'use client';

/**
 * ScalesBlockView — block-renderer entry point for a SCALES block.
 *
 * Mounts the gym Scales tool (the first fully-built gym equipment tool) inside the block player,
 * LOCKED to the block's preset. This is how a Scales tool is served as a REP brick.
 *
 * COMPLETION IS BY LOOP COUNT, not self-assessment. The admin sets `recordLoops` (e.g. 4); the
 * tool plays exactly that many loops then auto-stops → the brick is marked done → a NEXT button
 * appears (and PERSISTS) below the playback controls. The 3 ladder levels (L1/L2/L3 = 68/70/72)
 * are 3 bricks; NEXT advances to the next one, and on the TOP brick (L3) it reads "Complete the
 * rep" and hands back to the drill frame's summary.
 *
 * THE CLIMB: the TOP brick (L3) records 'conquered' (advances the tempo tomorrow —
 * deriveStudentSignals counts result === 'conquered'); the lower bricks (L1/L2) record 'completed'
 * (advance only). See the gym-tool context contract.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  TutorialBlock,
  DrillCompletionResult,
  GymToolContext,
  RepBrickPayload,
} from '@bassnotion/contracts';
import { ScalesTool } from '@/domains/training-engine/equipment/scales/ScalesTool';
import type { StringCount } from '@/domains/training-engine/equipment/scales/scaleGenerator';
import { WAITLIST_DEMO_CONFIG } from '@/app/_components/waitlistGrooveCard.config';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { Button } from '@/shared/components/ui/button';

interface ScalesBlockViewProps {
  block: TutorialBlock<'scales'>;
  isActive: boolean;
  isCompleted: boolean;
  /** BlockRenderer binds this to (data?) => markBlockComplete(block.id, data). */
  onComplete: (data?: Record<string, unknown>) => void;
  /** Advance to the next block. On the last brick this is a no-op scroll — the summary is
   *  triggered by onRepComplete instead. */
  onNext: () => void;
  /** The last brick's "Complete the rep" click → the drill frame flips to the summary (works on
   *  a same-day replay, where the auto-flip guard would otherwise block it). */
  onRepComplete?: () => void;
  onBeforePlay?: () => Promise<void> | void;
}

export function ScalesBlockView({
  block,
  isCompleted,
  onComplete,
  onNext,
  onRepComplete,
  onBeforePlay,
}: ScalesBlockViewProps) {
  const config = block.config;
  const { profile } = useUserProfile();
  const stringCount = (profile?.preferences?.bassConfiguration?.stringCount ??
    4) as StringCount;
  const maxFrets = profile?.preferences?.bassConfiguration?.maxFrets ?? 25;

  // The TOP brick (L3, today+notch) is the last level and the win that climbs the tempo; lower
  // bricks just advance. A single-focal goal (no ladder) has no ladderPosition → treat as top.
  const isTopBrick = (block.ladderPosition ?? 'L3') === 'L3';
  const result: DrillCompletionResult = isTopBrick ? 'conquered' : 'completed';

  // Has this brick finished its loops (this session)? The NEXT/COMPLETE button shows when the
  // loops are done OR the brick was already completed on a prior visit (so it PERSISTS).
  const [loopsDone, setLoopsDone] = useState(false);
  const showNext = loopsDone || isCompleted;

  // Loops finishing only REVEALS the button — it does NOT record completion. The user must click
  // Next / Complete. This is what makes the LAST brick require an explicit "Complete the rep"
  // click before the session-complete summary appears (rather than auto-flipping on loop-finish).
  const revealButton = useCallback(() => setLoopsDone(true), []);

  // The button click: record this brick's completion (once), then advance. On a LOWER brick that
  // scrolls to the next level; on the TOP brick it triggers the rep summary (onRepComplete) —
  // which works even on a same-day replay where every brick is already completed in the DB.
  const firedRef = useRef(false);
  const onAdvance = useCallback(() => {
    if (!firedRef.current && !isCompleted) {
      firedRef.current = true;
      const payload: RepBrickPayload = {
        completed: true,
        tempoBpm: config.tempoBpm ?? undefined,
      };
      // result + payload at the top level so useRepResultSync reads data.result / data.at.
      onComplete({ result, ...payload, at: new Date().toISOString() });
    }
    if (isTopBrick) onRepComplete?.();
    else onNext();
  }, [
    isCompleted,
    isTopBrick,
    onComplete,
    onNext,
    onRepComplete,
    result,
    config.tempoBpm,
  ]);

  // REP context: locked to the block's preset. Loops finishing only REVEALS the button; the
  // click (onAdvance) records completion. The sink routes to the same reveal.
  const context = useMemo<GymToolContext>(
    () => ({
      kind: 'rep',
      locked: true,
      preset: {
        exerciseId: config.exerciseId,
        exerciseName: config.exerciseName,
        scaleKey: config.scaleKey ?? null,
        tempoBpm: config.tempoBpm ?? null,
        recordLoops: config.recordLoops ?? 2,
      },
      resultSink: { kind: 'rep', onBrickComplete: revealButton },
    }),
    [
      config.exerciseId,
      config.exerciseName,
      config.scaleKey,
      config.tempoBpm,
      config.recordLoops,
      revealButton,
    ],
  );

  return (
    <div className="space-y-3">
      <ScalesTool
        backingConfig={WAITLIST_DEMO_CONFIG}
        stringCount={stringCount}
        maxFrets={maxFrets}
        onBeforePlay={onBeforePlay}
        context={context}
        // Loops done → reveal the button (does NOT auto-complete; the click does).
        onLoopsComplete={revealButton}
      />

      {/* NEXT / COMPLETE — appears once the loops are done and PERSISTS on a completed brick.
          The CLICK records completion + advances: on lower bricks it moves to the next ladder
          level; on the TOP brick it completes the rep, which flips the frame to the summary
          (so the summary needs this explicit click, never an auto-flip). Below the controls. */}
      {showNext && (
        <div className="flex justify-center pt-1">
          <Button
            onClick={onAdvance}
            className="bg-[#cd7f4d] text-black hover:bg-[#cd7f4d]/90"
          >
            {isTopBrick ? 'Complete the rep →' : 'Next →'}
          </Button>
        </div>
      )}
    </div>
  );
}
