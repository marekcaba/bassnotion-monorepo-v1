'use client';

import React, { useState, useCallback, useMemo } from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import type { Tutorial } from '@bassnotion/contracts';
import { resolveOverlayEvents } from '@bassnotion/contracts';
import { LessonHeader, UnderstandVideoPlayer } from '../components/index.js';
import { ChevronRight } from 'lucide-react';

interface VideoBlockViewProps {
  block: TutorialBlock<'video'>;
  isActive: boolean;
  isCompleted: boolean;
  onComplete: () => void;
  onNext: () => void;
  tutorialData?: Tutorial;
}

export const VideoBlockView = React.memo(function VideoBlockView({
  block,
  isActive,
  isCompleted,
  onComplete,
  onNext,
  tutorialData,
}: VideoBlockViewProps) {
  const [isDone, setIsDone] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wasSkipped, setWasSkipped] = useState(false);

  const { videoUrl, videoLibraryId } = block.config;
  const overlayEvents = useMemo(
    () => resolveOverlayEvents(block.config),
    [block.config],
  );
  const totalQuizEvents = overlayEvents.filter((e) => e.type === 'QUIZ').length;
  const hasVideo = videoUrl && videoLibraryId;

  const handleQuestionAnswered = useCallback((isCorrect: boolean) => {
    if (isCorrect) setCorrectCount((c) => c + 1);
  }, []);

  const handleComplete = useCallback(() => {
    setIsDone(true);
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    setWasSkipped(true);
    setIsDone(true);
    onComplete();
  }, [onComplete]);

  const handleGotIt = useCallback(() => {
    onNext();
  }, [onNext]);

  if (!hasVideo) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center">
        <div className="mx-auto px-4 py-8 w-full max-w-2xl text-center">
          <LessonHeader
            category={tutorialData?.category}
            title={tutorialData?.title || block.title}
            highlightWords={tutorialData?.title_highlight_words}
          />
          <div className="mt-8">
            <button
              onClick={handleGotIt}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-base tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 inline-flex items-center gap-2"
            >
              Let&apos;s Practice
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto flex items-center justify-center">
      <div className="mx-auto px-4 py-6 w-full flex flex-col items-center gap-6">
        <LessonHeader
          category={tutorialData?.category}
          title={tutorialData?.title || block.title}
          highlightWords={tutorialData?.title_highlight_words}
        />

        <UnderstandVideoPlayer
          videoUrl={videoUrl}
          libraryId={videoLibraryId}
          overlayEvents={overlayEvents}
          onQuestionAnswered={handleQuestionAnswered}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />

        {!isDone ? (
          <p className="text-white/50 text-sm relative z-10">
            Click play to see the flow
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            {!wasSkipped && totalQuizEvents > 0 && (
              <p className="text-white/70">
                {correctCount}/{totalQuizEvents} — You&apos;re locked in!
              </p>
            )}
            <button
              onClick={handleGotIt}
              className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-semibold text-base tracking-wide shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-all duration-200 inline-flex items-center gap-2"
            >
              I Got It — Let&apos;s Practice
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
});
