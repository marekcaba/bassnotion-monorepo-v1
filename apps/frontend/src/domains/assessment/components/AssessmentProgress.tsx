'use client';

/**
 * AssessmentProgress
 *
 * Shows a progress bar for the assessment with warm amber styling.
 * Matches V1 assessment progress bar design.
 */

export interface AssessmentProgressProps {
  progress: number; // 0-100
  current?: number; // Current question number
  total?: number; // Total questions
}

export function AssessmentProgress({
  progress,
  current = 0,
  total = 8,
}: AssessmentProgressProps) {
  return (
    <div className="w-full">
      {/* Progress bar container - matches V1 */}
      <div className="flex items-center gap-4">
        {/* Progress bar */}
        <div className="flex-1 h-2 bg-neutral-800/50 rounded-full overflow-hidden backdrop-blur-sm">
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              background:
                progress > 0
                  ? 'linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)'
                  : 'transparent',
              boxShadow:
                progress > 0 ? '0 0 20px rgba(245, 158, 11, 0.4)' : 'none',
            }}
          />
        </div>

        {/* Question counter - shows current position (1-based) */}
        <div
          className="flex items-center gap-2 text-sm"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          <span className="text-amber-400 font-medium">{current}</span>
          <span className="text-neutral-600">/</span>
          <span className="text-neutral-500">{total}</span>
        </div>
      </div>
    </div>
  );
}
