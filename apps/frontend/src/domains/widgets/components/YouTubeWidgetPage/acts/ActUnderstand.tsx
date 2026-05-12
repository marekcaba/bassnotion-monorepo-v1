'use client';

import React, { useState, useCallback } from 'react';
import type { Tutorial } from '@bassnotion/contracts';
import {
  LessonHeader,
  UnderstandVideoPlayer,
} from '../components';
import { ChevronRight } from 'lucide-react';

interface ActUnderstandProps {
  tutorialData?: Tutorial;
  onGotIt: () => void;
}

/**
 * Act 1: "Understand"
 *
 * Video-first learning experience:
 * 1. Context header (lesson number, title, one-line pitch)
 * 2. Explainer video with interactive quiz overlays
 * 3. Micro-celebration on completion
 * 4. CTA to proceed to Act 2
 *
 * Philosophy: The micro-tests ARE the comprehension check. Trust them.
 */
export const ActUnderstand = React.memo(function ActUnderstand({
  tutorialData,
  onGotIt,
}: ActUnderstandProps) {
  const [isComplete, setIsComplete] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [wasSkipped, setWasSkipped] = useState(false);

  const totalQuestions = tutorialData?.understand_questions?.length || 0;
  const hasVideo = tutorialData?.understand_video_url && tutorialData?.understand_video_library_id;

  // Handle question answered
  const handleQuestionAnswered = useCallback((isCorrect: boolean) => {
    if (isCorrect) {
      setCorrectCount((c) => c + 1);
    }
  }, []);

  // Handle video + quiz completion
  const handleComplete = useCallback(() => {
    setIsComplete(true);
  }, []);

  // Handle skip (due to video errors)
  const handleSkip = useCallback(() => {
    setWasSkipped(true);
    setIsComplete(true);
  }, []);

  // If no understand video is configured, show a simpler fallback
  if (!hasVideo) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center">
        <div className="mx-auto px-4 py-8 w-full max-w-2xl text-center">
          <LessonHeader
            category={tutorialData?.category}
            title={tutorialData?.title || 'Loading...'}
            highlightWords={tutorialData?.title_highlight_words}
          />

          <div className="mt-8">
            <button
              onClick={onGotIt}
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
        {/* Context Header */}
        <LessonHeader
          category={tutorialData?.category}
          title={tutorialData?.title || 'Loading...'}
          highlightWords={tutorialData?.title_highlight_words}
        />

        {/* Video Player with Quiz Overlays */}
        <UnderstandVideoPlayer
          videoUrl={tutorialData.understand_video_url!}
          libraryId={tutorialData.understand_video_library_id!}
          questions={tutorialData.understand_questions}
          onQuestionAnswered={handleQuestionAnswered}
          onComplete={handleComplete}
          onSkip={handleSkip}
        />

        {/* Bottom area: hint or CTA */}
        {!isComplete ? (
          <p className="text-white/50 text-sm relative z-10">
            👆 Click play to see the flow
          </p>
        ) : (
          <div className="flex flex-col items-center gap-4 animate-fade-in">
            {/* Micro-celebration */}
            {!wasSkipped && totalQuestions > 0 && (
              <p className="text-white/70">
                ✨ {correctCount}/{totalQuestions} — You&apos;re locked in!
              </p>
            )}

            {/* CTA Button */}
            <button
              onClick={onGotIt}
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
