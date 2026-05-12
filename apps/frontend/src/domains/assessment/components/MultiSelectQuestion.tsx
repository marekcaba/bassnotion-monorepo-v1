'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { AssessmentQuestion } from '@bassnotion/contracts';

interface MultiSelectQuestionProps {
  question: AssessmentQuestion;
  selectedOptionIds: string[];
  onSelect: (optionIds: string[]) => void;
  onSubmit: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
}

export function MultiSelectQuestion({
  question,
  selectedOptionIds,
  onSelect,
  onSubmit,
  onBack,
  canGoBack = false,
}: MultiSelectQuestionProps) {
  const [hoveredOption, setHoveredOption] = useState<string | null>(null);

  const toggleOption = (optionId: string) => {
    if (selectedOptionIds.includes(optionId)) {
      onSelect(selectedOptionIds.filter((id) => id !== optionId));
    } else {
      onSelect([...selectedOptionIds, optionId]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, optionId: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleOption(optionId);
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
          <p className="mt-1.5 text-xs sm:text-sm text-white/40">{question.description}</p>
        )}
        <p className="mt-1 text-xs text-white/50">Select all that apply</p>
      </div>

      {/* Options - Minimal: simple list */}
      <div className="flex flex-col gap-1.5">
        {question.options?.map((option) => {
          const isSelected = selectedOptionIds.includes(option.id);

          return (
            <button
              key={option.id}
              onClick={() => toggleOption(option.id)}
              onMouseEnter={() => setHoveredOption(option.id)}
              onMouseLeave={() => setHoveredOption(null)}
              onKeyDown={(e) => handleKeyDown(e, option.id)}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5',
                'rounded-lg',
                'transition-colors duration-150',
                'text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20',
                isSelected
                  ? 'bg-white/10'
                  : 'hover:bg-white/[0.04]',
              )}
              role="checkbox"
              aria-checked={isSelected}
            >
              {/* Simple checkbox indicator */}
              <span
                className={cn(
                  'flex items-center justify-center w-3.5 h-3.5 rounded border transition-all duration-150 shrink-0',
                  isSelected
                    ? 'bg-white border-white'
                    : 'border-white/30',
                )}
              >
                {isSelected && (
                  <svg
                    className="w-2.5 h-2.5 text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>

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
          onClick={onSubmit}
          disabled={selectedOptionIds.length === 0}
          className={cn(
            'px-5 py-2 rounded-lg text-sm transition-all duration-150',
            selectedOptionIds.length > 0
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
