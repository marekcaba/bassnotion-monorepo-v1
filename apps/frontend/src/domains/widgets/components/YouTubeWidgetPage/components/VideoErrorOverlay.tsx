'use client';

import { cn } from '@/lib/utils';

interface VideoErrorOverlayProps {
  error: string;
  retryCount: number;
  onRetry: () => void;
  onSkip: () => void;
}

/**
 * Error overlay for video load failures
 *
 * Shows retry button, and after 3+ failures offers escape hatch to skip to practice
 */
export function VideoErrorOverlay({
  error,
  retryCount,
  onRetry,
  onSkip,
}: VideoErrorOverlayProps) {
  const canRetry = retryCount < 3;
  const showSkipOption = retryCount >= 3;

  return (
    <div
      className={cn(
        'absolute inset-0 z-20',
        'flex items-center justify-center',
        'bg-black/60 backdrop-blur-sm',
      )}
    >
      <div className="flex flex-col items-center gap-4 p-6 text-center max-w-sm">
        {/* Error icon */}
        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error message */}
        <div>
          <p className="text-white/80 font-medium mb-1">Video failed to load</p>
          <p className="text-white/50 text-sm">
            Check your connection and try again.
          </p>
        </div>

        {/* Retry button */}
        {canRetry && (
          <button
            onClick={onRetry}
            className={cn(
              'px-6 py-2.5 rounded-lg',
              'bg-white text-black font-medium',
              'hover:bg-white/90 transition-colors',
            )}
          >
            Tap to Retry
          </button>
        )}

        {/* Retry count indicator */}
        {retryCount > 0 && retryCount < 3 && (
          <p className="text-white/30 text-xs">Attempt {retryCount + 1} of 3</p>
        )}

        {/* Skip option after 3 failures */}
        {showSkipOption && (
          <div className="flex flex-col items-center gap-3 mt-2">
            <button
              onClick={onRetry}
              className={cn(
                'px-6 py-2.5 rounded-lg',
                'bg-white/10 text-white',
                'hover:bg-white/20 transition-colors',
              )}
            >
              Try One More Time
            </button>

            <button
              onClick={onSkip}
              className={cn(
                'text-white/40 text-sm underline',
                'hover:text-white/60 transition-colors',
              )}
            >
              Having trouble? Skip to practice
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
