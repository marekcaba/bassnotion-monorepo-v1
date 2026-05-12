'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BunnyQuizPlayer } from '@/domains/assessment/components';
import type { AssessmentConfig } from '@bassnotion/contracts';

// Fallback data in case API fails
import {
  ASSESSMENT_QUESTIONS,
  BUNNY_LIBRARY_ID,
  BUNNY_VIDEO_ID,
} from '@/domains/assessment/data/quizQuestions';

export default function AssessmentPage() {
  const router = useRouter();
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });

  // Validate that a video ID is valid (non-empty string)
  const isValidVideoId = (id: string | undefined): boolean => {
    return !!id && id.trim().length > 0;
  };

  // Fetch assessment config from API (public endpoint)
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/assessment/config`,
        );

        if (!response.ok) {
          throw new Error('Failed to fetch assessment config');
        }

        const data = await response.json();
        // Validate config has valid video ID and questions
        if (
          data.config &&
          data.config.questions &&
          data.config.questions.length > 0 &&
          isValidVideoId(data.config.videoId) &&
          isValidVideoId(data.config.videoLibraryId)
        ) {
          setConfig(data.config);
        } else {
          // Use fallback data if config invalid
          console.warn('Invalid config from API, using fallback', data.config?.videoId);
          setConfig({
            videoPlatform: 'bunny',
            videoLibraryId: BUNNY_LIBRARY_ID,
            videoId: BUNNY_VIDEO_ID,
            questions: ASSESSMENT_QUESTIONS,
            skillThresholds: { advanced: 80, intermediate: 50 },
          });
        }
      } catch (err) {
        console.error('Failed to fetch assessment config:', err);
        // Use fallback data on error
        setConfig({
          videoPlatform: 'bunny',
          videoLibraryId: BUNNY_LIBRARY_ID,
          videoId: BUNNY_VIDEO_ID,
          questions: ASSESSMENT_QUESTIONS,
          skillThresholds: { advanced: 80, intermediate: 50 },
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  const handleComplete = useCallback(
    (assignedJourneyId: string | null) => {
      console.log('Assessment complete, journey assigned:', assignedJourneyId);
      // The actual redirect happens when user clicks "Start Your Journey" on ResultsScreen
    },
    [],
  );

  const handleProgressChange = useCallback(
    (answered: number, total: number) => {
      setProgress({ answered, total });
    },
    [],
  );

  // Show number of completed questions
  // Before play: show 0, After answering: show count of answered questions
  const completedCount = progress.answered;

  // Progress bar shows completed percentage
  // Before play: empty (0%), After answering: shows progress based on completed
  const progressPercent = progress.total > 0
    ? (completedCount / progress.total) * 100
    : 0;

  // Loading state - warm, inviting
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            {/* Pulsing bass clef icon */}
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
              Preparing your session...
            </p>
          </div>
        </div>
      </>
    );
  }

  // No config available
  if (!config) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md mx-auto">
            {/* Warning icon with warm styling */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
              <svg
                className="w-8 h-8 text-amber-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h2
              className="text-3xl font-medium text-white mb-3 tracking-tight"
              style={{ fontFamily: 'var(--font-cormorant), serif' }}
            >
              Assessment Unavailable
            </h2>
            <p
              className="text-neutral-400 mb-8 leading-relaxed"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              We're still setting up your assessment. Please check back soon.
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="group relative px-8 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:shadow-amber-500/25 hover:-translate-y-0.5"
              style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
            >
              <span className="relative z-10">Go to Dashboard</span>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </button>
          </div>
        </div>
      </>
    );
  }

  // Render Bunny Stream player
  const renderVideoPlayer = () => {
    return (
      <BunnyQuizPlayer
        libraryId={config.videoLibraryId}
        videoId={config.videoId}
        questions={config.questions}
        onComplete={handleComplete}
        onProgressChange={handleProgressChange}
      />
    );
  };

  return (
    <>
      <div className="min-h-screen flex flex-col">
        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 md:py-12">
          {/* Content container - scales up through breakpoints */}
          <div className="w-full max-w-[95%] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
            {/* Welcome header */}
            <div className="text-center mb-8 sm:mb-10">
              {/* Subtle decorative element */}
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-amber-500/50" />
                <span
                  className="text-xs uppercase tracking-[0.2em] text-amber-500/70"
                  style={{ fontFamily: 'var(--font-inter), sans-serif' }}
                >
                  Takes 2 Minutes
                </span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-amber-500/50" />
              </div>

              {/* Main headline */}
              <h1
                className="text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight leading-tight"
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
                Let's Build{' '}
                <span className="bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                  Your Plan
                </span>
              </h1>

              {/* Subtitle */}
              <p
                className="mt-4 text-neutral-400 max-w-lg mx-auto leading-relaxed"
                style={{ fontFamily: 'var(--font-inter), sans-serif' }}
              >
                Answer 8 questions as they pop up and get your personalized path.
              </p>
            </div>

            {/* Video player with warm border glow */}
            <div className="relative">
              {/* Subtle glow behind video */}
              <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/10 rounded-2xl blur-xl opacity-50" />

              {/* Video container */}
              <div className="relative rounded-xl overflow-hidden ring-1 ring-white/10">
                {renderVideoPlayer()}
              </div>
            </div>

            {/* Progress section */}
            <div className="mt-8">
              {/* Progress bar container */}
              <div className="flex items-center gap-4">
                {/* Progress bar */}
                <div className="flex-1 h-2 bg-neutral-800/50 rounded-full overflow-hidden backdrop-blur-sm">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background: progressPercent > 0
                        ? 'linear-gradient(90deg, #f59e0b, #f97316, #f59e0b)'
                        : 'transparent',
                      boxShadow: progressPercent > 0
                        ? '0 0 20px rgba(245, 158, 11, 0.4)'
                        : 'none',
                    }}
                  />
                </div>

                {/* Question counter - shows current position (1-based) */}
                <div
                  className="flex items-center gap-2 text-sm"
                  style={{ fontFamily: 'var(--font-dm-sans), sans-serif' }}
                >
                  <span className="text-amber-400 font-medium">{completedCount}</span>
                  <span className="text-neutral-600">/</span>
                  <span className="text-neutral-500">{progress.total}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
