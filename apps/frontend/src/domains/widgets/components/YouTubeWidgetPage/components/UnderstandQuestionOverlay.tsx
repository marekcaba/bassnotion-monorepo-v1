'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { UnderstandQuestion } from '@bassnotion/contracts';

interface UnderstandQuestionOverlayProps {
  question: UnderstandQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedOptionId: string | null;
  onOptionSelect: (optionId: string) => void;
  onSubmit: () => void;
  isVisible: boolean;
}

/**
 * Question overlay for Act 1: Understand
 *
 * Simplified version of assessment QuestionOverlay:
 * - Only supports multiple choice questions
 * - No back button (linear progression)
 * - No category badges (all are comprehension checks)
 */
export function UnderstandQuestionOverlay({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  onOptionSelect,
  onSubmit,
  isVisible,
}: UnderstandQuestionOverlayProps) {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const handleSelect = useCallback(
    (optionId: string) => {
      // Toggle selection - clicking same option deselects it
      if (selectedOptionId === optionId) {
        // Don't deselect - just keep selected
        return;
      }
      onOptionSelect(optionId);
    },
    [selectedOptionId, onOptionSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent, optionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(optionId);
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={cn(
        // Absolute positioning within video container
        'absolute inset-0 z-10',
        'flex items-center justify-center',
        // Semi-transparent backdrop so video is visible underneath
        'bg-black/30 backdrop-blur-sm',
        // Fade in animation
        'animate-fade-in',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="question-title"
    >
      {/* Progress indicator - absolutely positioned so it doesn't affect centering */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-10">
        <span className="text-white/40 text-xs sm:text-sm">
          {questionNumber} / {totalQuestions}
        </span>
      </div>

      {/* Question content - truly centered */}
      <div
        id="question-title"
        className="w-full h-full flex items-center justify-center p-4 sm:p-6 md:p-8 animate-fade-in-up"
      >
        {/* Glassmorphism card with 16:9 aspect ratio */}
        <div
          className={cn(
            'relative w-[85%] max-w-3xl',
            'rounded-2xl sm:rounded-3xl',
            // Glassmorphism effect
            'bg-white/[0.03] backdrop-blur-xl',
            'border border-white/[0.08]',
            // Shadow for depth
            'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
          )}
          style={{ aspectRatio: '16 / 9' }}
        >
          {/* Content positioned absolutely to respect aspect ratio */}
          <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-6 md:p-8 overflow-y-auto">
            <div className="w-full max-w-lg">
              <div className="flex flex-col gap-4 sm:gap-5">
                {/* Question text */}
                <div className="text-center">
                  <h2 className="text-base sm:text-lg md:text-xl font-normal text-white/90 leading-snug">
                    {question.question}
                  </h2>
                </div>

                {/* Options */}
                <div className="flex flex-col gap-1.5">
                  {question.options.map((option) => {
                    const isSelected = selectedOptionId === option.id;

                    return (
                      <button
                        key={option.id}
                        onClick={() => handleSelect(option.id)}
                        onMouseEnter={() => setHoveredOption(option.id)}
                        onMouseLeave={() => setHoveredOption(null)}
                        onKeyDown={(e) => handleKeyDown(e, option.id)}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2.5',
                          'rounded-lg',
                          'transition-colors duration-150',
                          'text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
                          isSelected ? 'bg-white/10' : 'hover:bg-white/[0.04]',
                        )}
                        role="radio"
                        aria-checked={isSelected}
                      >
                        {/* Circle indicator */}
                        <span
                          className={cn(
                            'shrink-0 w-3.5 h-3.5 rounded-full border transition-all duration-150',
                            isSelected
                              ? 'border-white bg-white'
                              : 'border-white/30',
                          )}
                        />

                        {/* Option text */}
                        <span
                          className={cn(
                            'text-sm leading-snug transition-colors duration-150',
                            isSelected ? 'text-white' : 'text-white/60',
                          )}
                        >
                          {option.text}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Submit button */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={onSubmit}
                    disabled={!selectedOptionId}
                    className={cn(
                      'px-5 py-2 rounded-lg text-sm transition-all duration-150',
                      selectedOptionId
                        ? 'bg-white text-black hover:bg-white/90'
                        : 'bg-white/10 text-white/30 cursor-not-allowed',
                    )}
                  >
                    Continue
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
