'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { SkillLevel, LearningJourney } from '@bassnotion/contracts';
import { JourneyRoadmap } from '@/domains/journey/components';

interface ResultsScreenProps {
  skillLevel: SkillLevel;
  percentageScore: number;
  totalQuestions: number;
  correctAnswers: number;
  assignedJourneyId: string | null;
  /** When true, renders as overlay inside video container (matches QuestionOverlay styling) */
  asOverlay?: boolean;
}

// Skill level configuration - minimal style (no emojis, subtle colors)
const SKILL_CONFIG: Record<
  SkillLevel,
  { label: string; message: string }
> = {
  beginner: {
    label: 'Beginner',
    message:
      "You're just starting your bass journey. We've got the perfect path to build a solid foundation.",
  },
  intermediate: {
    label: 'Intermediate',
    message:
      "You've got skills! Ready to take your playing to the next level with some advanced techniques.",
  },
  advanced: {
    label: 'Advanced',
    message:
      "Impressive! You're already an accomplished bassist. Let's dive into expert-level content.",
  },
};

export function ResultsScreen({
  skillLevel,
  percentageScore,
  totalQuestions,
  correctAnswers,
  assignedJourneyId,
  asOverlay = false,
}: ResultsScreenProps) {
  const router = useRouter();
  const [animatedScore, setAnimatedScore] = useState(0);
  const [showJourneyPreview, setShowJourneyPreview] = useState(false);
  const [journey, setJourney] = useState<LearningJourney | null>(null);
  const [loadingJourney, setLoadingJourney] = useState(false);

  const config = SKILL_CONFIG[skillLevel];

  // Fetch journey details if assigned
  useEffect(() => {
    if (assignedJourneyId) {
      setLoadingJourney(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/journey/my`, {
        credentials: 'include',
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.journey) {
            setJourney(data.journey);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch journey:', err);
        })
        .finally(() => {
          setLoadingJourney(false);
        });
    }
  }, [assignedJourneyId]);

  // Animate score counter
  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const increment = percentageScore / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= percentageScore) {
        setAnimatedScore(Math.round(percentageScore));
        clearInterval(timer);
      } else {
        setAnimatedScore(Math.round(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [percentageScore]);

  const handleContinue = () => {
    router.push('/dashboard');
  };

  // Minimal overlay content
  const resultsContent = (
    <div className="flex flex-col gap-4 sm:gap-5">
      {/* Skill level label - Minimal */}
      <div className="text-center">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-normal text-white/90 leading-snug">
          {config.label}
        </h2>
        <p className="mt-1.5 text-xs sm:text-sm text-white/40">
          {config.message}
        </p>
      </div>

      {/* Score - Minimal */}
      <div className="flex flex-col items-center gap-3">
        <div className="text-center">
          <span className="text-4xl sm:text-5xl font-light text-white">
            {animatedScore}%
          </span>
          <p className="text-white/40 text-xs mt-1">Knowledge Score</p>
        </div>

        {/* Progress bar - Minimal */}
        <div className="w-full max-w-xs h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-white/80 transition-all duration-1000"
            style={{ width: `${animatedScore}%` }}
          />
        </div>

        {/* Stats - Minimal */}
        <p className="text-white/30 text-xs">
          {correctAnswers} / {totalQuestions} correct
        </p>
      </div>

      {/* Journey assigned message - Minimal, compact for overlay */}
      {assignedJourneyId && asOverlay && (
        <div className="flex items-center justify-center gap-2 text-white/50 text-xs">
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Personalized journey created</span>
        </div>
      )}

      {/* Continue button - Minimal */}
      <div className="flex justify-center pt-2">
        <button
          onClick={handleContinue}
          className={cn(
            'px-6 py-2.5 rounded-lg text-sm transition-all duration-150',
            'bg-white text-black hover:bg-white/90',
          )}
        >
          {assignedJourneyId ? 'Start Your Journey' : 'Go to Dashboard'}
        </button>
      </div>
    </div>
  );

  // Overlay mode - matches QuestionOverlay styling exactly
  if (asOverlay) {
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
        aria-labelledby="results-title"
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
          {/* Results content - centered in remaining space */}
          <div
            id="results-title"
            className="flex-1 flex items-center justify-center min-h-0 animate-fade-in-up"
          >
            {/* Glassmorphism card with 16:9 aspect ratio (matching video) */}
            <div
              className={cn(
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
                  {resultsContent}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Standalone mode - fuller content with journey preview
  return (
    <div className="flex items-center justify-center min-h-[600px] p-8">
      <div
        className={cn(
          'w-full max-w-lg p-8 rounded-2xl',
          'bg-gradient-to-br from-gray-900 to-gray-950',
          'border border-gray-800',
          'shadow-2xl shadow-black/50',
          'animate-in fade-in zoom-in-95 duration-500',
        )}
      >
        <div className="w-full max-w-xl">
          {/* Skill level label */}
          <h2 className="text-3xl font-bold text-center mb-2 text-white">
            {config.label}
          </h2>

          {/* Message */}
          <p className="text-gray-300 text-center mb-6 text-base">
            {config.message}
          </p>

          {/* Score */}
          <div className="bg-gray-800/50 rounded-xl p-6 mb-6">
            <div className="text-center mb-4">
              <span className="text-5xl font-bold text-white">
                {animatedScore}%
              </span>
              <p className="text-gray-400 text-sm mt-1">Knowledge Score</p>
            </div>

            {/* Progress bar */}
            <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-white/80 transition-all duration-1000"
                style={{ width: `${animatedScore}%` }}
              />
            </div>

            {/* Stats */}
            <div className="flex justify-between mt-4 text-sm">
              <span className="text-gray-400">
                {correctAnswers} / {totalQuestions} correct
              </span>
              <span className="text-gray-400">
                {skillLevel === 'beginner' && '< 50%'}
                {skillLevel === 'intermediate' && '50-79%'}
                {skillLevel === 'advanced' && '80%+'}
              </span>
            </div>
          </div>

          {/* Journey assigned message */}
          {assignedJourneyId && (
            <div
              className={cn(
                'bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6',
                'animate-in fade-in slide-in-from-bottom-2 duration-500 delay-300',
              )}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-blue-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Journey Created!</p>
                  <p className="text-sm text-gray-400">
                    A personalized learning path awaits you
                  </p>
                </div>
                <button
                  onClick={() => setShowJourneyPreview(!showJourneyPreview)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                    showJourneyPreview
                      ? 'bg-blue-500 text-white'
                      : 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
                  )}
                >
                  {showJourneyPreview ? 'Hide' : 'Preview'}
                </button>
              </div>

              {/* Journey preview */}
              {showJourneyPreview && (
                <div className="mt-4 pt-4 border-t border-blue-500/20">
                  {loadingJourney ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : journey ? (
                    <JourneyRoadmap
                      journey={journey}
                      currentMilestoneId={journey.milestones[0]?.id}
                      completedMilestones={[]}
                      compact
                      showAnimation
                    />
                  ) : (
                    <p className="text-center text-gray-400 py-4">
                      Journey details will be available on your dashboard
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Continue button */}
          <button
            onClick={handleContinue}
            className={cn(
              'w-full px-6 py-4 rounded-xl font-semibold text-lg',
              'bg-white text-black',
              'hover:bg-white/90 transition-colors duration-200',
              'animate-in fade-in slide-in-from-bottom-2 duration-500 delay-500',
            )}
          >
            {assignedJourneyId ? 'Start Your Journey' : 'Go to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
}
