'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { ZoneCard, ZoneCardContent } from '@/ui-libraries';
import { Clock, CheckCircle, Loader2, Zap, AlertCircle, Lock } from 'lucide-react';
import { getSamplePreloader } from '@/domains/playback/services/InitialSamplePreloader.bridge';
import { getLogger } from '@/utils/logger.js';
import { safeString, getExerciseId } from '../utils';
import { LOCKED_DIFFICULTIES, REQUIRED_COMPLETIONS } from '../constants';
import type { PracticeCompletions } from '@/domains/widgets/hooks/usePracticeCompletions';

const logger = getLogger('exercise-selector-card');

/**
 * Animated rotating gradient border wrapper.
 * Uses a spinning gradient pseudo-element behind an inset content area
 * to create the illusion of a moving border.
 */
function AnimatedBorderWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[88px] shrink-0" style={{ animation: 'scale-pulse 3s ease-in-out infinite' }}>
      {/* Soft radial glow behind the card */}
      <div
        className="absolute inset-0 -z-10 pointer-events-none animate-pulse"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.25) 0%, rgba(139, 92, 246, 0.08) 40%, transparent 70%)',
          filter: 'blur(12px)',
          transform: 'scale(1.5)',
        }}
      />
      {/* Border animation container */}
      <div className="relative rounded-[12px] overflow-hidden" style={{ padding: '1.5px' }}>
        {/* Spinning gradient – sits behind the content */}
        <div
          className="absolute inset-[-40%] pointer-events-none"
          style={{
            background:
              'conic-gradient(from 0deg, transparent 0deg, transparent 100deg, #8b5cf600 110deg, #8b5cf6 135deg, #a78bfa 155deg, #8b5cf6 170deg, #8b5cf600 180deg, transparent 180deg, transparent 280deg, #8b5cf600 290deg, #8b5cf6 315deg, #a78bfa 335deg, #8b5cf6 350deg, #8b5cf600 360deg)',
            animation: 'border-rotate 6s linear infinite',
          }}
        />
        {/* Inset content container – inner radius = outer (12px) minus padding (1.5px) */}
        <div className="relative rounded-[10.5px] overflow-hidden bg-[#0f172a]">
          {children}
        </div>
      </div>
    </div>
  );
}

// Difficulty color mapping
const difficultyColors: Record<string, { dot: string; text: string }> = {
  beginner: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  easy: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  intermediate: { dot: 'bg-amber-400', text: 'text-amber-400' },
  medium: { dot: 'bg-amber-400', text: 'text-amber-400' },
  advanced: { dot: 'bg-red-400', text: 'text-red-400' },
  hard: { dot: 'bg-red-400', text: 'text-red-400' },
  expert: { dot: 'bg-red-400', text: 'text-red-400' },
};

// Progress dots component showing practice completion status
function ProgressDots({
  completed,
  total,
  isLocked,
}: {
  completed: number;
  total: number;
  isLocked: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
            isLocked
              ? 'bg-slate-600/50'
              : i < completed
                ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                : 'bg-slate-500/60 border border-slate-400/30'
          }`}
        />
      ))}
    </div>
  );
}

interface ExerciseSelectorCardProps {
  selectedExercise?: any;
  exercises?: any[];
  onExerciseSelect?: (exerciseId: string) => void;
  showExerciseList?: boolean;
  exerciseListLoading?: boolean;
  exerciseListError?: string | null;
  showDescription?: boolean;
  practiceCompletions?: PracticeCompletions;
  /** Optional content rendered at the top of the card (e.g. playback controls) */
  headerContent?: React.ReactNode;
  /** Called when user clicks the Unlock button on the last locked card (after all exercises are complete) */
  onUnlock?: () => void;
}

export const ExerciseSelectorCard = React.memo(function ExerciseSelectorCard({
  selectedExercise,
  exercises = [],
  onExerciseSelect,
  showExerciseList = true,
  exerciseListLoading = false,
  exerciseListError = null,
  showDescription = true,
  practiceCompletions = {},
  headerContent,
  onUnlock,
}: ExerciseSelectorCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredFullLoadRef = useRef(false);

  // Get selected exercise ID for comparison
  const selectedExerciseId = useMemo(() => {
    if (!selectedExercise) return null;
    return getExerciseId(selectedExercise);
  }, [selectedExercise]);

  // Extract exercise details for display
  const getExerciseDetails = useCallback((exercise: any) => {
    const difficulty = safeString(exercise.difficulty).toLowerCase() || 'beginner';
    const colors = difficultyColors[difficulty] || difficultyColors.beginner;
    return {
      title: safeString(exercise.title) || 'Untitled',
      description: safeString(exercise.description) || 'No description available.',
      difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
      colors,
      bpm: exercise.bpm || '\u2014',
      bars: exercise.total_bars || '\u2014',
      key: safeString(exercise.key) || '\u2014',
    };
  }, []);

  // Memoized exercise select handler
  const handleExerciseSelect = useCallback((exerciseId: string) => {
    onExerciseSelect?.(exerciseId);
  }, [onExerciseSelect]);

  // Sample preloading on visibility
  useEffect(() => {
    if (!showExerciseList || exercises.length === 0) return;

    const loadFullSamplesWhenVisible = async (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;

      if (entry.isIntersecting && !hasTriggeredFullLoadRef.current) {
        hasTriggeredFullLoadRef.current = true;

        logger.info('ExerciseList visible - loading samples for ALL exercises', {
          exerciseCount: exercises.length,
        });

        try {
          const preloader = getSamplePreloader();

          for (let i = 0; i < exercises.length; i++) {
            const exercise = exercises[i];
            if (!exercise?.id) continue;

            const exerciseIdValue = getExerciseId(exercise);
            const isCurrentlySelected = exerciseIdValue === selectedExerciseId;

            const result = await preloader.loadFullSamples(exercise, {
              skipBufferInjection: !isCurrentlySelected,
            });

            if (typeof window !== 'undefined' && isCurrentlySelected) {
              window.dispatchEvent(
                new CustomEvent('harmony-samples-loaded', {
                  detail: {
                    exerciseId: exercise.id,
                    instrument: exercise.harmonyInstrument,
                    samplesLoaded: result.loaded,
                    exerciseTitle: exercise.title,
                  },
                })
              );
            }

            await new Promise((resolve) => setTimeout(resolve, 300));
          }

          if (typeof window !== 'undefined') {
            window.__allSamplesLoaded = true;
            window.dispatchEvent(new Event('allSamplesLoaded'));
          }
        } catch (error) {
          logger.error('Failed to load exercise samples:', error);
        }
      }
    };

    const observer = new IntersectionObserver(loadFullSamplesWhenVisible, {
      threshold: 0.1,
      rootMargin: '50px',
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [exercises, selectedExerciseId, showExerciseList]);

  return (
    <ZoneCard className="zone-card overflow-visible border-0 shadow-none bg-transparent">
      <ZoneCardContent className="p-0 overflow-visible">
        {/* Main glassmorphism container */}
        <div
          ref={containerRef}
          className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20"
        >
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />

          {/* Header content (e.g. playback controls) */}
          {headerContent && (
            <div className="relative">
              {headerContent}
            </div>
          )}

          {/* Exercise List Section */}
          {showExerciseList && (
            <div className="relative p-4">
              {/* Loading State */}
              {exerciseListLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="relative">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-400" />
                    <div className="absolute inset-0 blur-lg bg-violet-400/30 animate-pulse" />
                  </div>
                </div>
              )}

              {/* Error State */}
              {exerciseListError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-sm text-red-400">{exerciseListError}</span>
                </div>
              )}

              {/* Empty State */}
              {!exerciseListLoading && !exerciseListError && exercises.length === 0 && (
                <p className="text-center text-slate-500 py-6 text-sm">No exercises available</p>
              )}

              {/* Exercise List — Horizontal Journey */}
              {!exerciseListLoading && !exerciseListError && exercises.length > 0 && (
                (() => {
                  // Split exercises into unlocked and locked
                  const filteredExercises = exercises.filter((ex) => ex?.id && ex?.title);
                  const unlockedExercises: Array<{ exercise: any; index: number }> = [];
                  const lockedExercises: Array<{ exercise: any; index: number }> = [];

                  filteredExercises.forEach((exercise, index) => {
                    const difficulty = safeString(exercise.difficulty).toLowerCase();
                    const isLocked = LOCKED_DIFFICULTIES.includes(difficulty);
                    if (isLocked) {
                      lockedExercises.push({ exercise, index });
                    } else {
                      unlockedExercises.push({ exercise, index });
                    }
                  });

                  // Calculate progress for the progress bar
                  const totalRequired = unlockedExercises.length * REQUIRED_COMPLETIONS;
                  const totalCompleted = unlockedExercises.reduce((sum, { exercise }) => {
                    const exId = getExerciseId(exercise);
                    return sum + Math.min(practiceCompletions[exId]?.count || 0, REQUIRED_COMPLETIONS);
                  }, 0);
                  const progressPercent = totalRequired > 0 ? (totalCompleted / totalRequired) * 100 : 0;

                  // Advanced exercises are unlocked when all basic exercises are completed (100%)
                  const advancedUnlocked = progressPercent >= 100;

                  // All exercises in order with their locked state
                  // isRewardCard: last exercise from the locked-difficulty group (animated border + Unlock button)
                  const allExerciseItems = [
                    ...unlockedExercises.map((item) => ({ ...item, isLocked: false, isRewardCard: false })),
                    ...lockedExercises.map((item, idx) => ({
                      ...item,
                      isLocked: !advancedUnlocked,
                      isRewardCard: idx === lockedExercises.length - 1,
                    })),
                  ];

                  return (
                    <div className="space-y-3">
                      {/* Horizontal scrollable journey */}
                      <div className="pb-2">
                        <div className="flex items-stretch justify-evenly gap-0">
                          {allExerciseItems.map(({ exercise, index, isLocked, isRewardCard }, i) => {
                            const id = getExerciseId(exercise);
                            const isSelected = id === selectedExerciseId;
                            const details = getExerciseDetails(exercise);
                            const completedCount = practiceCompletions[id]?.count || 0;
                            const isCompleted = completedCount >= REQUIRED_COMPLETIONS;
                            const isLastItem = i === allExerciseItems.length - 1;
                            // Show progress bar connector between unlocked and locked sections
                            const isProgressBoundary = i === unlockedExercises.length - 1 && lockedExercises.length > 0;
                            // Reward card: the last locked-difficulty exercise (always gets animated border)
                            const isRewardReady = isRewardCard && advancedUnlocked;

                            const cardButton = (
                                <button
                                  onClick={() => {
                                    if (isRewardCard && isRewardReady && onUnlock) {
                                      onUnlock();
                                    } else if (!isLocked) {
                                      handleExerciseSelect(id);
                                    }
                                  }}
                                  disabled={isLocked && !isRewardReady}
                                  className={`
                                    relative flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl
                                    ${isRewardCard ? 'w-full' : 'w-[88px]'} shrink-0
                                    transition-all duration-300 ease-out
                                    group
                                    ${isRewardCard
                                      ? isRewardReady
                                        ? 'bg-transparent border-0 cursor-pointer opacity-100'
                                        : 'bg-transparent border-0 cursor-not-allowed opacity-70 animate-pulse'
                                      : isLocked
                                        ? 'bg-white/[0.02] border border-slate-600/30 cursor-not-allowed opacity-50 animate-pulse'
                                        : isSelected
                                          ? 'bg-white/5 border border-violet-400/30 shadow-lg shadow-violet-500/10 scale-[1.05]'
                                          : 'bg-white/5 border border-white/10 hover:border-white/20 hover:shadow-md hover:shadow-black/10 hover:scale-[1.02]'
                                    }
                                  `}
                                  title={isRewardCard ? (isRewardReady ? 'Click to unlock the groove' : 'Complete all exercises to unlock') : details.title}
                                >
                                  {/* Selected glow */}
                                  <div
                                    className={`
                                      absolute inset-0 rounded-xl pointer-events-none
                                      bg-gradient-to-b from-violet-500/20 via-purple-500/10 to-transparent
                                      transition-opacity duration-300
                                      ${isSelected && !isLocked ? 'opacity-100' : 'opacity-0'}
                                    `}
                                  />

                                  {/* Status icon */}
                                  <div className="relative flex items-center justify-center w-8 h-8">
                                    {isRewardCard && isRewardReady ? (
                                      <>
                                        <Zap className="w-5 h-5 text-emerald-400" />
                                        <div className="absolute inset-0 blur-md bg-emerald-400/20 rounded-full" />
                                      </>
                                    ) : isCompleted && !isLocked ? (
                                      <>
                                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                                        <div className="absolute inset-0 blur-md bg-emerald-400/20 rounded-full" />
                                      </>
                                    ) : isLocked || isRewardCard ? (
                                      <Lock className="w-4 h-4 text-slate-500" />
                                    ) : isSelected ? (
                                      <div className={`w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.5)]`} />
                                    ) : (
                                      <div className="w-3 h-3 rounded-full border-2 border-slate-500/60" />
                                    )}
                                  </div>

                                  {/* Number badge */}
                                  <span
                                    className={`
                                      text-[11px] font-bold leading-none
                                      ${isRewardCard
                                        ? isRewardReady ? 'text-emerald-300' : 'text-slate-500'
                                        : isLocked
                                          ? 'text-slate-500'
                                          : isSelected
                                            ? 'text-violet-300'
                                            : 'text-slate-400 group-hover:text-slate-300'}
                                    `}
                                  >
                                    Ex {index + 1}
                                  </span>

                                  {isRewardCard ? (
                                    /* Unlock button for the reward card */
                                    <span className={`text-[9px] font-semibold px-2.5 py-1 rounded-md border transition-all duration-300 ${
                                      isRewardReady
                                        ? 'text-emerald-300 bg-emerald-500/20 border-emerald-400/30 shadow-sm shadow-emerald-500/20'
                                        : 'text-violet-300 bg-violet-500/15 border-violet-400/20'
                                    }`}>
                                      {isRewardReady ? 'Play Groove' : 'Unlock'}
                                    </span>
                                  ) : (
                                    <>
                                      {/* Progress dots */}
                                      <ProgressDots
                                        completed={completedCount}
                                        total={REQUIRED_COMPLETIONS}
                                        isLocked={isLocked}
                                      />

                                      {/* Difficulty color bar at bottom */}
                                      <div className={`w-6 h-0.5 rounded-full ${isLocked ? 'bg-slate-600/30' : details.colors.dot} mt-0.5`} />
                                    </>
                                  )}
                                </button>
                            );

                            return (
                              <React.Fragment key={id}>
                                {isRewardCard ? (
                                  <AnimatedBorderWrapper>{cardButton}</AnimatedBorderWrapper>
                                ) : (
                                  cardButton
                                )}

                                {/* Arrow connector between cards */}
                                {!isLastItem && (
                                  <div className="flex items-center px-0.5 shrink-0 self-center">
                                    {isProgressBoundary ? (
                                      /* Progress bar connector at unlock boundary */
                                      <div className="flex flex-col items-center gap-0.5 px-1">
                                        <div className="w-6 h-0.5 bg-slate-600/50 rounded-full relative overflow-hidden">
                                          <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-green-400 rounded-full transition-all duration-500"
                                            style={{ width: `${progressPercent}%` }}
                                          />
                                        </div>
                                        <span className="text-[8px] text-slate-500 font-medium">
                                          {Math.round(progressPercent)}%
                                        </span>
                                      </div>
                                    ) : (
                                      <svg width="12" height="12" viewBox="0 0 12 12" className="text-slate-600/60">
                                        <path d="M2 6h6M6 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}

              {/* Selected Exercise Details Box - Below the list (only if showDescription is true) */}
              {showDescription && !exerciseListLoading && !exerciseListError && exercises.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-transparent transition-all duration-300">
                  {!selectedExercise ? (
                    <p className="text-slate-500/80 text-sm text-center py-3 italic">
                      Select an exercise to see details
                    </p>
                  ) : (
                    (() => {
                      const details = getExerciseDetails(selectedExercise);
                      return (
                        <div>
                          {/* Title & Difficulty */}
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h4 className="text-base font-semibold text-white/90">{details.title}</h4>
                            <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${details.colors.text} bg-white/5 border border-current/20`}>
                              {details.difficulty}
                            </span>
                          </div>

                          {/* Description - max 3 lines with fixed height */}
                          <p className="text-slate-400/90 text-sm leading-relaxed mb-4 line-clamp-3 h-[4.5rem]">{details.description}</p>

                          {/* Meta */}
                          <div className="flex items-center gap-5 text-xs pt-3 border-t border-white/10">
                            <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors">
                              <Clock className="w-3.5 h-3.5 text-violet-400/70" />
                              <span>{details.bars} bars</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors">
                              <Zap className="w-3.5 h-3.5 text-amber-400/70" />
                              <span>{details.bpm} BPM</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors">
                              <span className="text-emerald-400/70">{'\u266A'}</span>
                              <span>Key: {details.key}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  )}
                </div>
              )}

            </div>
          )}
        </div>
      </ZoneCardContent>
    </ZoneCard>
  );
});

/**
 * Skeleton loading state for ExerciseSelectorCard
 */
export function ExerciseSelectorCardSkeleton() {
  return (
    <ZoneCard className="zone-card overflow-visible border-0 shadow-none bg-transparent">
      <ZoneCardContent className="p-0 overflow-visible">
        <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />

          {/* Exercise List Section Skeleton — Horizontal */}
          <div className="relative p-4">
            <div className="flex items-stretch gap-0">
              {[1, 2, 3, 4].map((i) => (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl bg-white/5 border border-white/10 animate-pulse min-w-[80px]">
                    <div className="skeleton-shimmer w-8 h-8 rounded-full" />
                    <div className="skeleton-shimmer w-10 h-3 rounded" />
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((d) => (
                        <div key={d} className="skeleton-shimmer w-1.5 h-1.5 rounded-full" />
                      ))}
                    </div>
                    <div className="skeleton-shimmer w-6 h-0.5 rounded-full" />
                  </div>
                  {i < 4 && (
                    <div className="flex items-center px-1 self-center">
                      <div className="skeleton-shimmer w-3 h-3 rounded" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </ZoneCardContent>
      <span className="sr-only">Loading exercises...</span>
    </ZoneCard>
  );
}
