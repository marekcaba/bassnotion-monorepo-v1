'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { navigateToApp } from '@/lib/marketing-url';
import { BunnyQuizPlayer } from '@/domains/assessment/components';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import type { AssessmentConfig } from '@bassnotion/contracts';

// Fallback data in case API fails
import {
  ASSESSMENT_QUESTIONS,
  BUNNY_LIBRARY_ID,
  BUNNY_VIDEO_ID,
} from '@/domains/assessment/data/quizQuestions';

export default function AssessmentPage() {
  const router = useRouter();
  const { logger } = useCorrelation('AssessmentPage');
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState({ answered: 0, total: 0 });

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

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
          logger.warn('Invalid config from API, using fallback', {
            videoId: data.config?.videoId,
          });
          setConfig({
            videoPlatform: 'bunny',
            videoLibraryId: BUNNY_LIBRARY_ID,
            videoId: BUNNY_VIDEO_ID,
            questions: ASSESSMENT_QUESTIONS,
            skillThresholds: { advanced: 80, intermediate: 50 },
          });
        }
      } catch (err) {
        logger.error(
          'Failed to fetch assessment config',
          err instanceof Error ? err : undefined,
        );
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
  }, [logger]);

  const handleComplete = useCallback(
    (assignedJourneyId: string | null) => {
      logger.info('Assessment complete, journey assigned', {
        assignedJourneyId,
      });
      // The actual redirect happens when user clicks "Start Your Journey" on ResultsScreen
    },
    [logger],
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
  const progressPercent =
    progress.total > 0 ? (completedCount / progress.total) * 100 : 0;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          {/* Pulsing bass clef icon */}
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-[#E8650A]/20 animate-ping" />
            <div className="relative w-16 h-16 rounded-sm bg-[#0F0F0F] border border-[#E8650A]/30 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#E8650A]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
              </svg>
            </div>
          </div>
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8650A]">
            Preparing your session…
          </p>
        </div>
      </div>
    );
  }

  // No config available
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto">
          {/* Warning icon */}
          <div className="w-16 h-16 mx-auto mb-6 rounded-sm bg-[#0F0F0F] border border-[#E8650A]/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-[#E8650A]"
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
          <h2 className="font-heading uppercase text-[clamp(28px,4vw,40px)] leading-[0.95] tracking-[0.02em] text-[#E8E8E8] mb-4">
            Assessment Unavailable
          </h2>
          <p className="text-[#999] mb-8 leading-relaxed">
            We&apos;re still setting up your assessment. Please check back soon.
          </p>
          <button
            onClick={() => navigateToApp('/backstage', (url) => router.push(url))}
            className="inline-flex items-center gap-2.5 bg-[#E8650A] text-white px-8 py-4 text-[15px] font-semibold tracking-[0.04em] rounded-sm hover:bg-[#B84E08] hover:-translate-y-px transition-all cursor-pointer border-none uppercase"
          >
            Go to Backstage
          </button>
        </div>
      </div>
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
      <button
        onClick={handleBack}
        aria-label="Go back"
        title="Back"
        style={{
          position: 'fixed',
          top: '64px',
          left: '64px',
          zIndex: 110,
          width: '44px',
          height: '44px',
          background: '#0F0F0F',
          border: '1px solid #252525',
          color: '#E8650A',
          borderRadius: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background 0.2s, border-color 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#161616';
          e.currentTarget.style.borderColor = 'rgba(232, 101, 10, 0.4)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#0F0F0F';
          e.currentTarget.style.borderColor = '#252525';
        }}
      >
        <ArrowLeft style={{ width: '16px', height: '16px' }} />
      </button>
      <div className="min-h-screen flex flex-col">
        {/* Main content */}
        <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-8 md:py-12">
          {/* Content container - scales up through breakpoints */}
          <div className="w-full max-w-[95%] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl">
            {/* Welcome header */}
            <div className="text-center mb-8 sm:mb-10">
              {/* Decorative eyebrow */}
              <div className="flex items-center justify-center gap-3 mb-5">
                <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#E8650A]/50" />
                <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#E8650A]">
                  Takes 2 Minutes
                </span>
                <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#E8650A]/50" />
              </div>

              {/* Main headline — sales-page wordmark style */}
              <h1 className="font-heading uppercase text-[clamp(36px,5vw,56px)] leading-[0.95] tracking-[0.02em] text-[#E8E8E8]">
                Let&apos;s build{' '}
                <span className="text-[#E8650A]">your plan</span>
              </h1>

              {/* Subtitle */}
              <p className="mt-5 text-[#999] max-w-lg mx-auto leading-relaxed">
                Answer 8 questions as they pop up and get your personalized
                path.
              </p>
            </div>

            {/* Video player with subtle orange glow */}
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#E8650A]/10 via-[#E8650A]/5 to-[#E8650A]/10 rounded-sm blur-xl opacity-50" />
              <div className="relative rounded-sm overflow-hidden ring-1 ring-[#252525]">
                {renderVideoPlayer()}
              </div>
            </div>

            {/* Progress section */}
            <div className="mt-8">
              <div className="flex items-center gap-4">
                <div className="flex-1 h-1.5 bg-[#161616] rounded-full overflow-hidden border border-[#252525]">
                  <div
                    className="h-full rounded-full transition-all duration-500 ease-out"
                    style={{
                      width: `${progressPercent}%`,
                      background:
                        progressPercent > 0 ? '#E8650A' : 'transparent',
                      boxShadow:
                        progressPercent > 0
                          ? '0 0 16px rgba(232, 101, 10, 0.4)'
                          : 'none',
                    }}
                  />
                </div>

                <div className="flex items-center gap-1.5 text-[13px] font-mono">
                  <span className="text-[#E8650A] font-medium">
                    {completedCount}
                  </span>
                  <span className="text-[#555]">/</span>
                  <span className="text-[#666]">{progress.total}</span>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
