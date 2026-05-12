'use client';

/**
 * SegmentQuestionOverlay
 *
 * Displays a question overlay for segment-based assessment.
 * Supports multiple-choice, multi-select, text-input, and skill-verification.
 * Styled to match V1 assessment warm amber theme.
 */

import { useCallback } from 'react';
import type { SegmentQuestion } from '@bassnotion/contracts';
import { ChevronLeft, Check, Volume2 } from 'lucide-react';

export interface SegmentQuestionOverlayProps {
  question: SegmentQuestion;
  selectedAnswer: unknown;
  onSelectAnswer: (answer: unknown) => void;
  onSubmit: () => void;
  onGoBack: () => void;
  canGoBack: boolean;
}

export function SegmentQuestionOverlay({
  question,
  selectedAnswer,
  onSelectAnswer,
  onSubmit,
  onGoBack,
  canGoBack,
}: SegmentQuestionOverlayProps) {
  const isMultiSelect = question.questionType === 'multi-select';
  const hasAudio = !!question.audioConfig?.url;

  // Handle option selection
  const handleOptionClick = useCallback(
    (optionValue: string) => {
      if (isMultiSelect) {
        const currentSelected = (selectedAnswer as string[]) || [];
        if (currentSelected.includes(optionValue)) {
          onSelectAnswer(currentSelected.filter((v) => v !== optionValue));
        } else {
          onSelectAnswer([...currentSelected, optionValue]);
        }
      } else {
        onSelectAnswer(optionValue);
      }
    },
    [isMultiSelect, selectedAnswer, onSelectAnswer],
  );

  // Handle text input
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSelectAnswer(e.target.value);
    },
    [onSelectAnswer],
  );

  // Play audio if available
  const playAudio = useCallback(() => {
    if (question.audioConfig?.url) {
      const audio = new Audio(question.audioConfig.url);
      audio.play().catch(console.error);
    }
  }, [question.audioConfig?.url]);

  // Check if answer is selected
  const isOptionSelected = (optionValue: string): boolean => {
    if (isMultiSelect) {
      return ((selectedAnswer as string[]) || []).includes(optionValue);
    }
    return selectedAnswer === optionValue;
  };

  // Check if can submit
  const canSubmit = (): boolean => {
    if (question.questionType === 'text-input') {
      return typeof selectedAnswer === 'string' && selectedAnswer.trim() !== '';
    }
    if (isMultiSelect) {
      return Array.isArray(selectedAnswer) && selectedAnswer.length > 0;
    }
    return selectedAnswer !== null && selectedAnswer !== undefined;
  };

  return (
    <div className="w-full">
      {/* Audio button if available */}
      {hasAudio && (
        <button
          onClick={playAudio}
          className="mb-6 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-lg transition-all text-white font-medium shadow-lg shadow-amber-500/20"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          <Volume2 className="w-5 h-5" />
          <span>Listen</span>
        </button>
      )}

      {/* Question text */}
      <h2
        className="text-xl sm:text-2xl font-semibold text-white mb-2 tracking-tight"
        style={{ fontFamily: 'var(--font-inter), sans-serif' }}
      >
        {question.questionText}
      </h2>

      {/* Description if present */}
      {question.description && (
        <p
          className="text-neutral-400 mb-4 leading-relaxed text-sm sm:text-base"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          {question.description}
        </p>
      )}

      {/* Options for multiple-choice, multi-select, skill-verification */}
      {question.options && question.options.length > 0 && (
        <div className="space-y-2 sm:space-y-3 mt-4">
          {question.options.map((option) => (
            <button
              key={option.id}
              onClick={() => handleOptionClick(option.value)}
              className={`w-full text-left p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 ${
                isOptionSelected(option.value)
                  ? 'border-amber-500 bg-amber-500/20 text-white shadow-lg shadow-amber-500/10'
                  : 'border-white/10 bg-white/5 text-neutral-200 hover:border-white/20 hover:bg-white/10'
              }`}
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                    isOptionSelected(option.value)
                      ? 'border-amber-500 bg-amber-500'
                      : 'border-neutral-500'
                  }`}
                >
                  {isOptionSelected(option.value) && (
                    <Check className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  )}
                </div>
                <span className="text-sm sm:text-base">{option.text}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Text input for text-input type */}
      {question.questionType === 'text-input' && (
        <div className="mt-4">
          <input
            type="text"
            value={(selectedAnswer as string) || ''}
            onChange={handleTextChange}
            placeholder="Type your answer..."
            className="w-full p-3 sm:p-4 rounded-xl bg-white/5 border-2 border-white/10 text-white placeholder-neutral-500 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all"
            style={{ fontFamily: 'var(--font-inter), sans-serif' }}
          />
        </div>
      )}

      {/* Submit button - matches V1 warm gradient */}
      <div className="mt-6 flex justify-center">
        <button
          onClick={onSubmit}
          disabled={!canSubmit()}
          className="group relative px-6 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0"
          style={{ fontFamily: 'var(--font-inter), sans-serif' }}
        >
          <span className="relative z-10">Continue</span>
          <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </button>
      </div>
    </div>
  );
}
