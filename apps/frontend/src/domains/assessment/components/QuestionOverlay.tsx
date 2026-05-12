'use client';

import { cn } from '@/lib/utils';
import type { AssessmentQuestion } from '@bassnotion/contracts';
import { MultipleChoiceQuestion } from './MultipleChoiceQuestion';
import { MultiSelectQuestion } from './MultiSelectQuestion';
import { TextInputQuestion } from './TextInputQuestion';
import { DragDropQuestion } from './DragDropQuestion';

interface QuestionOverlayProps {
  question: AssessmentQuestion;
  questionNumber: number;
  totalQuestions: number;
  // State
  selectedOptionId: string | null;
  selectedOptionIds: string[];
  textAnswer: string;
  dragDropMapping: Record<string, string>;
  // Callbacks
  onOptionSelect: (optionId: string | null) => void;
  onOptionsSelect: (optionIds: string[]) => void;
  onTextChange: (text: string) => void;
  onDragDropChange: (mapping: Record<string, string>) => void;
  onSubmit: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  isVisible: boolean;
}

export function QuestionOverlay({
  question,
  questionNumber,
  totalQuestions,
  selectedOptionId,
  selectedOptionIds,
  textAnswer,
  dragDropMapping,
  onOptionSelect,
  onOptionsSelect,
  onTextChange,
  onDragDropChange,
  onSubmit,
  onBack,
  canGoBack = false,
  isVisible,
}: QuestionOverlayProps) {
  if (!isVisible) return null;

  const renderQuestion = () => {
    switch (question.type) {
      case 'multiple-choice':
        return (
          <MultipleChoiceQuestion
            question={question}
            selectedOptionId={selectedOptionId}
            onSelect={onOptionSelect}
            onSubmit={onSubmit}
            onBack={onBack}
            canGoBack={canGoBack}
          />
        );
      case 'multi-select':
        return (
          <MultiSelectQuestion
            question={question}
            selectedOptionIds={selectedOptionIds}
            onSelect={onOptionsSelect}
            onSubmit={onSubmit}
            onBack={onBack}
            canGoBack={canGoBack}
          />
        );
      case 'text-input':
        return (
          <TextInputQuestion
            question={question}
            textAnswer={textAnswer}
            onTextChange={onTextChange}
            onSubmit={onSubmit}
            onBack={onBack}
            canGoBack={canGoBack}
          />
        );
      case 'drag-drop':
        return (
          <DragDropQuestion
            question={question}
            mapping={dragDropMapping}
            onMappingChange={onDragDropChange}
            onSubmit={onSubmit}
            onBack={onBack}
            canGoBack={canGoBack}
          />
        );
      default:
        return <div>Unknown question type</div>;
    }
  };

  // Category badge color
  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'knowledge':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'goal':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'preference':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      default:
        return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
    }
  };

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
      {/* Content wrapper - fills the video area with padding */}
      <div
        className={cn(
          'w-full h-full',
          'flex flex-col',
          'p-4 sm:p-6 md:p-8',
          'overflow-y-auto',
        )}
      >
        {/* Header - compact for video overlay */}
        <div className="flex items-center justify-end mb-3 sm:mb-4 shrink-0">
          {/* Category badge */}
          <span
            className={cn(
              'px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full border',
              getCategoryColor(question.category),
            )}
          >
            {question.category.charAt(0).toUpperCase() + question.category.slice(1)}
          </span>
        </div>

        {/* Question content - centered in remaining space */}
        <div
          id="question-title"
          className="flex-1 flex items-center justify-center min-h-0 animate-fade-in-up"
        >
          {/* Glassmorphism card with 16:9 aspect ratio (matching video) */}
          <div
            className={cn(
              // 16:9 aspect ratio - use padding-bottom trick for reliable aspect ratio
              'relative w-[80%] max-w-4xl',
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
            <div className="absolute inset-0 flex items-center justify-center p-5 sm:p-6 md:p-8 overflow-y-auto">
              <div className="w-full max-w-xl">
                {renderQuestion()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
