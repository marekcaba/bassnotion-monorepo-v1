'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { AssessmentQuestion } from '@bassnotion/contracts';
import { AudioPlayer, type AudioPlayerRef } from './AudioPlayer';

interface TextInputQuestionProps {
  question: AssessmentQuestion;
  textAnswer: string;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function TextInputQuestion({
  question,
  textAnswer,
  onTextChange,
  onSubmit,
  onBack,
  canGoBack = false,
}: TextInputQuestionProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  // Stop audio and then submit
  const handleSubmit = useCallback(() => {
    audioPlayerRef.current?.stop();
    onSubmit();
  }, [onSubmit]);

  // Auto-focus input when component mounts (with delay for audio questions)
  useEffect(() => {
    const delay = question.audioConfig ? 500 : 0;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, delay);
    return () => clearTimeout(timer);
  }, [question.audioConfig]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && textAnswer.trim()) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Question - Minimal */}
      <div className="text-center">
        <h2 className="text-base sm:text-lg md:text-xl font-normal text-white/90 leading-snug">
          {question.question}
        </h2>
        {question.description && (
          <p className="mt-1.5 text-xs sm:text-sm text-white/40">
            {question.description}
          </p>
        )}
      </div>

      {/* Audio player (if question has audio) */}
      {question.audioConfig && (
        <div className="flex justify-center">
          <AudioPlayer
            ref={audioPlayerRef}
            url={question.audioConfig.url}
            label={question.audioConfig.label || 'Listen'}
          />
        </div>
      )}

      {/* Text input - Minimal */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={textAnswer}
          onChange={(e) => onTextChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            question.textInputConfig?.placeholder || 'Type your answer...'
          }
          className={cn(
            'w-full px-4 py-2.5 text-sm rounded-lg',
            'bg-white/[0.04] border border-white/10',
            'text-white placeholder-white/30',
            'focus:outline-none focus:border-white/30 focus:bg-white/[0.06]',
            'transition-all duration-150',
          )}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />

        {/* Clear button */}
        {textAnswer && (
          <button
            onClick={() => onTextChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/30 hover:text-white/60 transition-colors"
            aria-label="Clear input"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Hint - Minimal */}
      <p className="text-[10px] text-white/30 text-center">
        Press Enter to continue
      </p>

      {/* Action buttons - Minimal */}
      <div className="flex justify-between items-center pt-1">
        {canGoBack ? (
          <button
            onClick={onBack}
            className="px-2 py-1 text-xs text-white/40 hover:text-white/60 transition-colors duration-150"
          >
            Back
          </button>
        ) : (
          <div />
        )}

        <button
          onClick={handleSubmit}
          disabled={!textAnswer.trim()}
          className={cn(
            'px-5 py-2 rounded-lg text-sm transition-all duration-150',
            textAnswer.trim()
              ? 'bg-white text-black hover:bg-white/90'
              : 'bg-white/10 text-white/30 cursor-not-allowed',
          )}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
