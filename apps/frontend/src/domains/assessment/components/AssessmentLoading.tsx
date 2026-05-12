'use client';

/**
 * AssessmentLoading
 *
 * Loading state for the assessment with warm, inviting design.
 * Matches V1 assessment styling.
 */

export interface AssessmentLoadingProps {
  message?: string;
}

export function AssessmentLoading({
  message = 'Loading...',
}: AssessmentLoadingProps) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {/* Pulsing bass clef icon - matches V1 warm styling */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-amber-500/20 animate-ping" />
          <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/30 to-orange-600/20 flex items-center justify-center backdrop-blur-sm border border-amber-500/20">
            <svg
              className="w-8 h-8 text-amber-400"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
          </div>
        </div>
        <p
          className="text-neutral-400 text-sm tracking-wide"
          style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
        >
          {message}
        </p>
      </div>
    </div>
  );
}
