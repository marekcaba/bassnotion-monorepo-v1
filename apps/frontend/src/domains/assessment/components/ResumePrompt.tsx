'use client';

import { cn } from '@/lib/utils';
import type { AssessmentProgress } from '@bassnotion/contracts';

interface ResumePromptProps {
  savedProgress: AssessmentProgress;
  totalQuestions: number;
  onRestore: () => void;
  onStartFresh: () => void;
}

export function ResumePrompt({
  savedProgress,
  totalQuestions,
  onRestore,
  onStartFresh,
}: ResumePromptProps) {
  const answeredQuestions = savedProgress.answers.length;
  const progressPercent = Math.round(
    (answeredQuestions / totalQuestions) * 100,
  );
  const lastUpdated = new Date(savedProgress.lastUpdatedAt);
  const timeAgo = getTimeAgo(lastUpdated);

  return (
    <div
      className={cn(
        // Absolute positioning within video container (like QuestionOverlay)
        'absolute inset-0 z-10',
        'flex items-center justify-center',
        'bg-black/90 backdrop-blur-sm',
        // Fade in animation
        'animate-fade-in',
      )}
      role="dialog"
      aria-modal="true"
      aria-labelledby="resume-title"
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
        {/* Header - compact badge like QuestionOverlay */}
        <div className="flex items-center justify-end mb-3 sm:mb-4 shrink-0">
          <span
            className={cn(
              'px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium rounded-full border',
              'bg-amber-500/20 text-amber-300 border-amber-500/30',
            )}
          >
            Welcome Back
          </span>
        </div>

        {/* Content - centered in remaining space */}
        <div
          id="resume-title"
          className="flex-1 flex items-center justify-center min-h-0 animate-fade-in-up"
        >
          <div className="w-full max-w-md flex flex-col gap-4 sm:gap-6">
            {/* Title */}
            <div className="text-center">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white leading-tight mb-1 sm:mb-2">
                Continue your assessment?
              </h2>
              <p className="text-xs sm:text-sm text-gray-400">
                You have an unfinished session
              </p>
            </div>

            {/* Progress info - compact card */}
            <div className="bg-gray-800/30 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50">
              <div className="flex justify-between text-xs sm:text-sm text-gray-400 mb-2">
                <span>Progress</span>
                <span className="text-amber-400 font-medium">
                  {answeredQuestions} of {totalQuestions}
                </span>
              </div>
              <div className="h-1.5 sm:h-2 bg-gray-700/50 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${progressPercent}%`,
                    background: 'linear-gradient(90deg, #f59e0b, #f97316)',
                  }}
                />
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                Last saved {timeAgo}
              </p>
            </div>

            {/* Action buttons - styled like question buttons */}
            <div className="flex flex-col gap-2 sm:gap-3">
              <button
                onClick={onRestore}
                className={cn(
                  'w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base',
                  'bg-amber-500 hover:bg-amber-400 text-white',
                  'shadow-lg shadow-amber-500/25',
                  'transition-all duration-200',
                )}
              >
                Continue →
              </button>

              <button
                onClick={onStartFresh}
                className={cn(
                  'w-full px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-medium text-sm sm:text-base',
                  'bg-gray-800/50 hover:bg-gray-700/50 text-gray-300 hover:text-white',
                  'border border-gray-700 hover:border-gray-600',
                  'transition-all duration-200',
                )}
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function to get human-readable time ago
function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString();
}
