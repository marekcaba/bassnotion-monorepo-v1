'use client';

/**
 * TaskBlockView — a no-audio drill brick: instruction + a wall-clock timer (or
 * a manual "done"). The free-tier staple ("practice C major triads for 5 min")
 * — the student plays their own instrument while the timer runs.
 *
 * Completes the same way as a groove brick: criterion met → Next unlocks →
 * onComplete(blockId, data) + onNext. A "too hard — lay it anyway" release
 * valve always advances. No groove, no stems, no playback.
 */

import { useCallback, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { TaskBlock, DrillCompletionResult } from '@bassnotion/contracts';
import { Button } from '@/shared/components/ui/button';
import { useDrillCriterion } from '@/domains/drill/hooks/useDrillCriterion';

interface TaskBlockViewProps {
  block: TaskBlock;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: (data?: Record<string, unknown>) => void;
  onNext: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export function TaskBlockView({
  block,
  onComplete,
  onNext,
}: TaskBlockViewProps) {
  const config = block.config;
  const criterion = config.completionCriterion;
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  // Wall-clock: a task block has no audio, so the timer runs only while the
  // learner has it running (isPlaying = running). Start arms it; the pause
  // button toggles `running` to freeze/resume the countdown — useDrillCriterion
  // accrues elapsed seconds only while isPlaying is true. Manual ignores it.
  const { isMet, progress } = useDrillCriterion(criterion, {
    isPlaying: running,
    getAudioPhase: () => null, // no audio → no loops criterion on task blocks
  });

  const start = useCallback(() => {
    setStarted(true);
    setRunning(true);
  }, []);

  const finish = useCallback(
    (result: DrillCompletionResult) => {
      setDone(true);
      onComplete({
        result,
        criterion: criterion?.type,
        achievedTier: null,
        at: new Date().toISOString(),
      });
      // No scroll here — the player auto-advances reactively once onComplete
      // marks this brick done + unlocks the next block (see the drill
      // auto-advance effect in YouTubeWidgetPage). A single click advances.
    },
    [onComplete, criterion?.type],
  );

  const isManual = criterion?.type === 'manual';

  return (
    <div className="flex h-full w-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl space-y-6 rounded-2xl border border-white/5 bg-[#100E0D] p-8 text-center text-white">
        {config.heading && (
          <p className="font-mono text-xs uppercase tracking-[2px] text-[#E8A44A]">
            {config.heading}
          </p>
        )}
        <p className="text-lg leading-relaxed">{config.instruction}</p>

        {/* Timer (time criterion) */}
        {criterion?.type === 'time' && progress && (
          <p
            className={`font-mono text-4xl ${
              started && !running ? 'text-white/40' : ''
            }`}
          >
            {formatTime(progress.target - progress.current)}
          </p>
        )}

        {done ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-semibold text-[#cd7f4d]">
              ✓ Done. Brick laid.
            </p>
            {/* The player auto-scrolls to the next block on finish; this is a
                manual fallback so the student is never stranded if the scroll
                misses (or they scrolled back to a completed brick). */}
            <Button onClick={onNext} className="text-white">
              Next →
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            {isManual ? (
              <Button
                onClick={() => finish('completed')}
                className="text-white"
              >
                I&apos;m done →
              </Button>
            ) : !started ? (
              <Button onClick={start} className="text-white">
                <Play className="mr-1.5 h-4 w-4" /> Start
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                {/* Pause / resume the countdown without losing progress. */}
                <Button
                  variant="outline"
                  onClick={() => setRunning((r) => !r)}
                  className="text-white"
                  aria-label={running ? 'Pause timer' : 'Resume timer'}
                >
                  {running ? (
                    <>
                      <Pause className="mr-1.5 h-4 w-4" /> Pause
                    </>
                  ) : (
                    <>
                      <Play className="mr-1.5 h-4 w-4" /> Resume
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => finish('completed')}
                  disabled={!isMet}
                  className="text-white"
                >
                  Next →
                </Button>
              </div>
            )}
            <button
              type="button"
              onClick={() => finish('released')}
              className="text-xs text-white/70 underline underline-offset-2 hover:text-white"
            >
              Too hard — lay it anyway ↓
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
