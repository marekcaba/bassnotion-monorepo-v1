'use client';

import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { AssessmentQuestion } from '@bassnotion/contracts';
import { AudioPlayer, type AudioPlayerRef } from './AudioPlayer';

interface MultipleChoiceQuestionProps {
  question: AssessmentQuestion;
  selectedOptionId: string | null;
  onSelect: (optionId: string | null) => void; // null to deselect
  onSubmit: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function MultipleChoiceQuestion({
  question,
  selectedOptionId,
  onSelect,
  onSubmit,
  onBack,
  canGoBack = false,
}: MultipleChoiceQuestionProps) {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);
  const audioPlayerRef = useRef<AudioPlayerRef>(null);

  // Stop audio and then submit
  const handleSubmit = useCallback(() => {
    audioPlayerRef.current?.stop();
    onSubmit();
  }, [onSubmit]);

  // Toggle selection - clicking same option deselects it
  const handleSelect = useCallback(
    (optionId: string) => {
      if (selectedOptionId === optionId) {
        onSelect(null); // Deselect
      } else {
        onSelect(optionId); // Select
      }
    },
    [selectedOptionId, onSelect],
  );

  const handleKeyDown = (e: React.KeyboardEvent, optionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleSelect(optionId);
    }
  };

  return (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Question - Minimal: simple, quiet typography */}
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

      {/* Options - Minimal: simple list, subtle hover */}
      <div className="flex flex-col gap-1.5">
        {question.options?.map((option) => {
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
              {/* Simple circle indicator */}
              <span
                className={cn(
                  'shrink-0 w-3.5 h-3.5 rounded-full border transition-all duration-150',
                  isSelected ? 'border-white bg-white' : 'border-white/30',
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
  );
}
