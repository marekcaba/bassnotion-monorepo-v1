'use client';

import React, { type ReactNode } from 'react';
import { Lock, Music, Sparkles } from 'lucide-react';
import { BottomPlaybackBar } from '../components/BottomPlaybackBar';
import type { CountdownState } from '../GlobalControls/types.js';
import type { PracticeCompletions } from '@/domains/widgets/hooks/usePracticeCompletions';

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

interface ActApplyProps {
  /** Whether the groove is unlocked */
  isUnlocked: boolean;
  /** Completion progress for the locked state */
  completedCount: number;
  totalUnlocked: number;
  /** Tutorial data for video URL */
  tutorialData?: any;
  /** The reward/groove exercise */
  rewardExercise?: any;
  /** Fretboard card to render (passed as ReactNode to avoid prop duplication) */
  fretboardContent: ReactNode;
  /** Four widgets (drums, bass, harmony, metronome) */
  widgetsContent: ReactNode;
  /** Sheet music player */
  sheetContent: ReactNode;
  /** Transport clock / timeline */
  transportContent: ReactNode;
  /** Props forwarded to BottomPlaybackBar */
  bottomBarProps: BottomBarProps;
}

/** Extract YouTube video ID from URL */
function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) return url;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
  );
  return match?.[1] ?? null;
}

/**
 * Act 3: "Apply"
 * When unlocked: synced video + fretboard groove mode.
 * When locked: blurred preview with lock icon and progress.
 */
export const ActApply = React.memo(function ActApply({
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
}: ActApplyProps) {
  // No exercises — show "coming soon" placeholder
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

          {/* Placeholder dots */}
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
        {/* Locked state */}
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

          {/* Progress indicator */}
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

  // Unlocked — groove mode
  const videoUrl = tutorialData?.youtube_url || '';
  const youtubeId =
    getYouTubeVideoId(videoUrl) || tutorialData?.youtube_id || null;
  const grooveTitle = rewardExercise?.title || 'The Groove';

  return (
    <div className="h-full flex flex-col">
      {/* Video player — top portion */}
      <div className="flex-shrink-0 relative" style={{ height: '40%' }}>
        {youtubeId ? (
          <iframe
            src={`https://www.youtube.com/embed/${youtubeId}?rel=0&modestbranding=1`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            frameBorder="0"
            title="Tutorial video"
          />
        ) : (
          <div className="w-full h-full bg-slate-800/50 flex items-center justify-center">
            <Music className="w-12 h-12 text-slate-600" />
          </div>
        )}
      </div>

      {/* Fretboard + widgets — middle portion */}
      <div className="flex-1 overflow-y-auto flex flex-col">
        <div className="flex-1 px-4 py-2">{fretboardContent}</div>

        {/* Instrument widgets */}
        <div className="flex-shrink-0 px-4 py-2">{widgetsContent}</div>

        {/* Sheet music */}
        <div className="flex-shrink-0 px-4 py-2">{sheetContent}</div>

        {/* Transport clock */}
        <div className="flex-shrink-0 px-4 py-2">{transportContent}</div>

        {/* Motivational text */}
        <div className="flex-shrink-0 text-center px-4 py-3">
          <p className="text-sm text-slate-400 italic">
            &ldquo;See what I&apos;m playing. See where it is. Now you do
            it.&rdquo;
          </p>
          <p className="text-xs text-white/60 font-medium mt-1">
            {grooveTitle}
          </p>
        </div>
      </div>

      {/* Playback bar */}
      <div className="flex-shrink-0">
        <BottomPlaybackBar {...bottomBarProps} />
      </div>
    </div>
  );
});
