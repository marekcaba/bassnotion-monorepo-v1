'use client';

import React, { useCallback, type ReactNode } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import { ChevronRight, Lock, Music, Sparkles } from 'lucide-react';
import { BottomPlaybackBar } from '../components/BottomPlaybackBar.js';
import type { CountdownState } from '../GlobalControls/types.js';
import type { LegacyPracticeCompletions as PracticeCompletions } from '@/domains/progress';

interface BottomBarProps {
  selectedExercise?: any;
  exercises?: any[];
  onExerciseSelect?: (exerciseId: string) => void;
  hasSelectedDots?: boolean;
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
  onToggleLoop?: () => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  countdownState: CountdownState;
  onCountdownStateChange?: (state: CountdownState) => void;
  practiceCompletions?: PracticeCompletions;
  onPracticeCompletion?: (exerciseId: string) => void;
}

interface GrooveBlockViewProps {
  block: TutorialBlock<'groove'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
  /** Whether there is a block after this one (shows "Finish" button) */
  hasNextBlock?: boolean;
  isUnlocked: boolean;
  completedCount: number;
  totalUnlocked: number;
  tutorialData?: any;
  rewardExercise?: any;
  fretboardContent: ReactNode;
  widgetsContent: ReactNode;
  sheetContent: ReactNode;
  transportContent: ReactNode;
  bottomBarProps: BottomBarProps;
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  );
  return match?.[1] ?? null;
}

export const GrooveBlockView = React.memo(function GrooveBlockView({
  block,
  onComplete,
  onNext,
  hasNextBlock,
  isUnlocked,
  completedCount,
  totalUnlocked,
  tutorialData,
  rewardExercise,
  fretboardContent,
  widgetsContent,
  sheetContent,
  transportContent,
  bottomBarProps,
}: GrooveBlockViewProps) {
  const { youtubeUrl } = block.config;

  const handleFinish = useCallback(() => {
    onComplete();
    onNext();
  }, [onComplete, onNext]);

  if (totalUnlocked === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-slate-700/50 border-2 border-slate-600/50 flex items-center justify-center mx-auto">
            <Sparkles className="w-10 h-10 text-slate-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">
              The Groove is Coming
            </h2>
            <p className="text-slate-400 text-base max-w-sm mx-auto">
              Practice exercises are being prepared for this tutorial
            </p>
          </div>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="w-3 h-3 rounded-full border-2 border-dashed border-slate-600/50 bg-slate-800/30"
              />
            ))}
            <div className="w-3 h-3 rounded-full border-2 border-dashed border-purple-500/30 bg-purple-900/20" />
          </div>
        </div>
      </div>
    );
  }

  if (!isUnlocked) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6">
        <div className="text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-purple-500/15 border-2 border-purple-500/30 flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-purple-400" />
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white">The Groove Awaits</h2>
            <p className="text-slate-400 text-base max-w-sm mx-auto">
              Complete all practice exercises to unlock the full groove
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <div className="flex items-center gap-1.5">
              {Array.from({ length: totalUnlocked }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors duration-300 ${
                    i < completedCount
                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]'
                      : 'bg-white/15'
                  }`}
                />
              ))}
            </div>
            <span className="text-sm text-white/40 tabular-nums">
              {completedCount}/{totalUnlocked}
            </span>
          </div>
        </div>
      </div>
    );
  }

  const videoSource = youtubeUrl || tutorialData?.youtube_url || '';
  const youtubeId =
    getYouTubeVideoId(videoSource) || tutorialData?.youtube_id || null;
  const grooveTitle = rewardExercise?.title || 'The Groove';

  return (
    <div className="h-full flex flex-col">
      {/* YouTube embed — full width */}
      <div
        className="flex-shrink-0 relative mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px]"
        style={{ height: '40%' }}
      >
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            className="w-full h-full rounded-b-xl"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            title="Tutorial video"
          />
        ) : (
          <div className="w-full h-full bg-slate-800/50 flex items-center justify-center rounded-b-xl">
            <Music className="w-12 h-12 text-slate-600" />
          </div>
        )}
      </div>

      {/* Content — centered to match exercise block */}
      <div
        className="flex-1 overflow-y-auto flex flex-col"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="mx-auto w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-[800px] px-4 flex flex-col flex-1">
          <div className="flex-1 py-2">{fretboardContent}</div>
          <div className="flex-shrink-0 py-2">{widgetsContent}</div>
          <div className="flex-shrink-0 py-2">{sheetContent}</div>
          <div className="flex-shrink-0 py-2">{transportContent}</div>
          <div className="flex-shrink-0 text-center py-3">
            <p className="text-sm text-slate-400 italic">
              &ldquo;See what I&apos;m playing. See where it is. Now you do
              it.&rdquo;
            </p>
            <p className="text-xs text-white/60 font-medium mt-1">
              {grooveTitle}
            </p>
          </div>

          {/* Finish button — shown when there's a next block */}
          {hasNextBlock && (
            <div className="flex-shrink-0 text-center pb-3">
              <button
                onClick={handleFinish}
                className="px-8 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm tracking-wide shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 inline-flex items-center gap-2"
              >
                Finish the Groove
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar — full width */}
      <div className="flex-shrink-0">
        <BottomPlaybackBar {...bottomBarProps} />
      </div>
    </div>
  );
});
