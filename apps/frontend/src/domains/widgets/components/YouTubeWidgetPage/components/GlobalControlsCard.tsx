'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { ZoneCard, ZoneCardContent } from '@/ui-libraries';
import { Clock, CheckCircle, Loader2, Zap, AlertCircle } from 'lucide-react';
import { GlobalControls } from './GlobalControls';
import { getSamplePreloader } from '@/domains/playback/services/InitialSamplePreloader.bridge';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('global-controls-card');

// =============================================================================
// HELPER FUNCTIONS (from ExerciseSelector)
// =============================================================================

function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  return String(value);
}

function getExerciseId(exercise: any): string {
  return typeof exercise.id === 'object' && exercise.id !== null
    ? (exercise.id as any).value
    : exercise.id;
}

// Difficulty color mapping
const difficultyColors: Record<string, { dot: string; text: string }> = {
  beginner: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  easy: { dot: 'bg-emerald-400', text: 'text-emerald-400' },
  intermediate: { dot: 'bg-amber-400', text: 'text-amber-400' },
  medium: { dot: 'bg-amber-400', text: 'text-amber-400' },
  advanced: { dot: 'bg-orange-400', text: 'text-orange-400' },
  hard: { dot: 'bg-orange-400', text: 'text-orange-400' },
  expert: { dot: 'bg-red-400', text: 'text-red-400' },
};

interface GlobalControlsCardProps {
  // Exercise data
  selectedExercise?: any;
  exercises?: any[];
  // Exercise navigation
  onExerciseSelect?: (exerciseId: string) => void;
  // Fretboard action props
  hasSelectedDots?: boolean;
  // Loop settings
  loopRegion?: {
    startMeasure: number;
    endMeasure: number;
    startBeat?: number;
    endBeat?: number;
  } | null;
  isLoopEnabled?: boolean;
  // Play state callback
  onPlayStateChange?: (isPlaying: boolean) => void;
  // Exercise list options
  showExerciseList?: boolean;
  exerciseListLoading?: boolean;
  exerciseListError?: string | null;
}

export function GlobalControlsCard({
  selectedExercise,
  exercises = [],
  onExerciseSelect,
  hasSelectedDots,
  loopRegion,
  isLoopEnabled,
  onPlayStateChange,
  showExerciseList = true,
  exerciseListLoading = false,
  exerciseListError = null,
}: GlobalControlsCardProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredFullLoadRef = useRef(false);

  // Get selected exercise ID for comparison
  const selectedExerciseId = useMemo(() => {
    if (!selectedExercise) return null;
    return getExerciseId(selectedExercise);
  }, [selectedExercise]);

  // Calculate duration from exercise data
  const calculateDuration = useCallback((exercise: any): number => {
    if (
      !exercise?.notes ||
      !Array.isArray(exercise.notes) ||
      exercise.notes.length === 0
    ) {
      return 0;
    }

    // Find the maximum timestamp + duration from all notes
    const maxEndTime = exercise.notes.reduce((max: number, note: any) => {
      // Validate and sanitize timestamp
      const timestamp =
        typeof note.timestamp === 'number' && isFinite(note.timestamp)
          ? note.timestamp
          : 0;

      // Validate and sanitize duration
      const duration_ms =
        typeof note.duration_ms === 'number' && isFinite(note.duration_ms)
          ? note.duration_ms
          : typeof note.duration === 'number' && isFinite(note.duration)
            ? note.duration
            : 500; // Default 500ms if no valid duration

      const endTime = timestamp + duration_ms;
      return Math.max(max, endTime);
    }, 0);

    // Convert to seconds if the value is in milliseconds (> 1000 suggests milliseconds)
    const result =
      maxEndTime > 1000 ? Math.floor(maxEndTime / 1000) : maxEndTime;

    // Ensure we never return NaN
    return isFinite(result) ? result : 0;
  }, []);

  const duration = calculateDuration(selectedExercise);

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
            (window as any).__allSamplesLoaded = true;
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

          {/* Playback Controls Header */}
          <div className="relative">
            <GlobalControls
              selectedExercise={selectedExercise}
              duration={duration}
              exercises={exercises}
              onExerciseSelect={onExerciseSelect}
              hasSelectedDots={hasSelectedDots}
              loopRegion={loopRegion}
              isLoopEnabled={isLoopEnabled}
              onPlayStateChange={onPlayStateChange}
            />
          </div>

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

              {/* Exercise List */}
              {!exerciseListLoading && !exerciseListError && exercises.length > 0 && (
                <div className="space-y-2">
                  {exercises
                    .filter((ex) => ex?.id && ex?.title)
                    .map((exercise, index) => {
                      const id = getExerciseId(exercise);
                      const isSelected = id === selectedExerciseId;
                      const details = getExerciseDetails(exercise);

                      return (
                        <button
                          key={id}
                          onClick={() => handleExerciseSelect(id)}
                          className={`
                            w-full text-left px-3 py-2.5 rounded-xl
                            transition-[border-color,box-shadow] duration-300 ease-out
                            group relative overflow-hidden
                            bg-white/5
                            ${
                              isSelected
                                ? 'border border-violet-400/30 shadow-lg shadow-violet-500/10'
                                : 'border border-white/10 hover:border-white/20 hover:shadow-md hover:shadow-black/10'
                            }
                          `}
                        >
                          {/* Purple gradient overlay for selected state - fades in/out smoothly */}
                          <div
                            className={`
                              absolute inset-0 rounded-xl pointer-events-none
                              bg-gradient-to-r from-violet-500/20 via-purple-500/15 to-violet-500/20
                              transition-opacity duration-300 ease-out
                              ${isSelected ? 'opacity-100' : 'opacity-0'}
                            `}
                          />
                          {/* Hover glow effect */}
                          <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-r from-transparent via-white/5 to-transparent" />

                          <div className="relative flex items-center gap-3">
                            {/* Check with animation - at the front */}
                            {isSelected ? (
                              <div className="relative w-4 flex-shrink-0">
                                <CheckCircle className="w-4 h-4 text-violet-400" />
                                <div className="absolute inset-0 blur-md bg-violet-400/40" />
                              </div>
                            ) : (
                              <div className="w-4 flex-shrink-0" />
                            )}

                            {/* Number */}
                            <span
                              className={`
                                w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold
                                transition-all duration-300 group-hover:scale-110
                                ${isSelected
                                  ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 text-violet-200 shadow-inner'
                                  : 'bg-white/10 text-slate-400 group-hover:bg-white/20 group-hover:text-slate-300'}
                              `}
                            >
                              {index + 1}
                            </span>

                            {/* Title */}
                            <span
                              className={`flex-1 text-sm truncate transition-colors duration-200 ${isSelected ? 'text-white font-medium' : 'text-slate-300 group-hover:text-white'}`}
                            >
                              {details.title}
                            </span>

                            {/* Difficulty dot with glow */}
                            <span className={`relative w-2.5 h-2.5 rounded-full ${details.colors.dot} transition-transform duration-200 group-hover:scale-125`}>
                              <span className={`absolute inset-0 rounded-full ${details.colors.dot} blur-sm opacity-50`} />
                            </span>
                          </div>
                        </button>
                      );
                    })}
                </div>
              )}

              {/* Selected Exercise Details Box */}
              {exercises.length > 0 && (
                <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10 backdrop-blur-sm shadow-inner transition-all duration-300">
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
}

/**
 * Skeleton loading state for GlobalControlsCard
 * Matches the glassmorphism design with exercise list
 */
export function GlobalControlsCardSkeleton() {
  return (
    <ZoneCard className="zone-card overflow-visible border-0 shadow-none bg-transparent">
      <ZoneCardContent className="p-0 overflow-visible">
        {/* Main glassmorphism container */}
        <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20">
          {/* Glassmorphism overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />

          {/* Playback Controls Header Skeleton */}
          <div className="relative bg-slate-800 rounded-2xl p-4 m-0 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                {/* Left spacer */}
                <div className="flex justify-center items-center py-2 w-24">
                  <div className="skeleton-shimmer w-20 h-10 rounded-xl" />
                </div>

                {/* Center - Playback Controls */}
                <div className="flex flex-col items-center justify-center gap-2">
                  {/* Countdown dots placeholder */}
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className="skeleton-shimmer w-3 h-3 rounded-full"
                      />
                    ))}
                  </div>
                  {/* Transport buttons */}
                  <div className="flex items-center justify-center gap-4">
                    <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                    <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                    <div className="skeleton-shimmer w-[78px] h-[78px] rounded-full" />
                    <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                    <div className="skeleton-shimmer w-10 h-10 rounded-full" />
                  </div>
                </div>

                {/* Right spacer */}
                <div className="flex justify-center items-center py-2 w-24">
                  <div className="skeleton-shimmer w-20 h-10 rounded-xl" />
                </div>
              </div>
            </div>
          </div>

          {/* Exercise List Section Skeleton */}
          <div className="relative p-4 border-t border-white/10">
            {/* Exercise list skeleton */}
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer w-7 h-7 rounded-lg" />
                    <div className="skeleton-shimmer flex-1 h-4 rounded max-w-[160px]" />
                    <div className="skeleton-shimmer w-2.5 h-2.5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>

            {/* Description box skeleton */}
            <div className="mt-4 p-4 rounded-xl bg-gradient-to-br from-white/5 to-white/[0.02] border border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="skeleton-shimmer w-32 h-5 rounded" />
                <div className="skeleton-shimmer w-20 h-5 rounded-md" />
              </div>
              <div className="skeleton-shimmer w-full h-4 rounded mb-2" />
              <div className="skeleton-shimmer w-3/4 h-4 rounded mb-4" />
              <div className="flex gap-5 pt-3 border-t border-white/10">
                <div className="skeleton-shimmer w-16 h-3 rounded" />
                <div className="skeleton-shimmer w-16 h-3 rounded" />
                <div className="skeleton-shimmer w-16 h-3 rounded" />
              </div>
            </div>
          </div>
        </div>
      </ZoneCardContent>
      <span className="sr-only">Loading playback controls and exercises...</span>
    </ZoneCard>
  );
}
