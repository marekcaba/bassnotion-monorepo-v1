'use client';

import { cn } from '@/lib/utils';
import type { JourneyMilestone } from '@bassnotion/contracts';

interface MilestoneCardProps {
  milestone: JourneyMilestone;
  isCompleted?: boolean;
  isCurrent?: boolean;
  onStartTutorial?: (tutorialId: string) => void;
}

export function MilestoneCard({
  milestone,
  isCompleted = false,
  isCurrent = false,
  onStartTutorial,
}: MilestoneCardProps) {
  const isLocked = !isCompleted && !isCurrent;

  return (
    <div
      className={cn(
        'p-6 rounded-2xl border transition-all duration-200',
        isCompleted && 'bg-green-500/5 border-green-500/30',
        isCurrent && 'bg-blue-500/10 border-blue-500/30 ring-1 ring-blue-500/50',
        isLocked && 'bg-gray-800/30 border-gray-700/30 opacity-60',
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-4">
        {/* Status icon */}
        <div
          className={cn(
            'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0',
            isCompleted && 'bg-green-500',
            isCurrent && 'bg-blue-500',
            isLocked && 'bg-gray-700',
          )}
        >
          {isCompleted ? (
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : isCurrent ? (
            <svg
              className="w-6 h-6 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          ) : (
            <svg
              className="w-6 h-6 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          )}
        </div>

        {/* Title & description */}
        <div className="flex-1 min-w-0">
          <h3
            className={cn(
              'text-lg font-semibold mb-1',
              isLocked ? 'text-gray-400' : 'text-white',
            )}
          >
            {milestone.title}
          </h3>
          <p className="text-sm text-gray-500">{milestone.description}</p>
        </div>

        {/* Status badge */}
        <span
          className={cn(
            'px-3 py-1 rounded-full text-xs font-medium',
            isCompleted && 'bg-green-500/20 text-green-400',
            isCurrent && 'bg-blue-500/20 text-blue-400',
            isLocked && 'bg-gray-700/50 text-gray-500',
          )}
        >
          {isCompleted ? 'Completed' : isCurrent ? 'In Progress' : 'Locked'}
        </span>
      </div>

      {/* Tutorials list */}
      {milestone.tutorialIds && milestone.tutorialIds.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-400 mb-2">
            Tutorials ({milestone.tutorialIds.length})
          </h4>
          <div className="space-y-2">
            {milestone.tutorialIds.slice(0, 3).map((tutorialId, index) => (
              <button
                key={tutorialId}
                onClick={() => !isLocked && onStartTutorial?.(tutorialId)}
                disabled={isLocked}
                className={cn(
                  'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors',
                  isLocked
                    ? 'bg-gray-800/30 cursor-not-allowed'
                    : 'bg-gray-800/50 hover:bg-gray-800',
                )}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium',
                    isLocked ? 'bg-gray-700 text-gray-500' : 'bg-gray-700 text-gray-300',
                  )}
                >
                  {index + 1}
                </div>
                <span
                  className={cn(
                    'flex-1 text-sm',
                    isLocked ? 'text-gray-500' : 'text-gray-300',
                  )}
                >
                  Tutorial {index + 1}
                </span>
                {!isLocked && (
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </button>
            ))}
            {milestone.tutorialIds.length > 3 && (
              <p className="text-xs text-gray-500 text-center py-2">
                +{milestone.tutorialIds.length - 3} more tutorials
              </p>
            )}
          </div>
        </div>
      )}

      {/* Action button for current milestone */}
      {isCurrent && milestone.tutorialIds && milestone.tutorialIds.length > 0 && (
        <button
          onClick={() => onStartTutorial?.(milestone.tutorialIds![0])}
          className={cn(
            'mt-4 w-full py-3 rounded-xl font-semibold',
            'bg-blue-600 hover:bg-blue-500 text-white',
            'transition-colors duration-200',
          )}
        >
          Continue Learning
        </button>
      )}
    </div>
  );
}
