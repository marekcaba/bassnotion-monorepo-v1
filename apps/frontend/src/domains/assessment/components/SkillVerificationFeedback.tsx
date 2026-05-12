'use client';

/**
 * SkillVerificationFeedback
 *
 * Displays text feedback when a user answers a skill verification question incorrectly.
 * This is a text overlay (not a video) as per the requirements.
 * Styled to match V1 assessment warm theme.
 */

export interface SkillVerificationFeedbackProps {
  feedbackText: string;
  onDismiss: () => void;
}

export function SkillVerificationFeedback({
  feedbackText,
  onDismiss,
}: SkillVerificationFeedbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        {/* Card with warm glow */}
        <div className="relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

          <div className="relative bg-neutral-900/80 backdrop-blur-sm rounded-xl p-8 ring-1 ring-white/10 text-center">
            {/* Feedback icon */}
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-amber-500/30 to-orange-600/20 flex items-center justify-center border border-amber-500/20">
                <svg
                  className="w-10 h-10 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2
              className="text-2xl font-semibold text-white mb-4 tracking-tight"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              Not quite right!
            </h2>

            {/* Feedback text */}
            <p
              className="text-lg text-neutral-300 mb-8 leading-relaxed"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              {feedbackText}
            </p>

            {/* Encouragement */}
            <p
              className="text-neutral-400 mb-8"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              Don&apos;t worry - this helps us understand where you are so we can
              create the perfect learning path for you.
            </p>

            {/* Continue button - matches V1 warm gradient */}
            <button
              onClick={onDismiss}
              className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5"
              style={{ fontFamily: 'var(--font-inter), sans-serif' }}
            >
              <span className="relative z-10">Continue</span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
