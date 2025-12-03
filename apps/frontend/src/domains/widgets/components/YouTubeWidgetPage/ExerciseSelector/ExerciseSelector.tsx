'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import {
  Clock,
  Music,
  CheckCircle,
  Loader2,
  PlayCircle,
  ListMusic,
  Sparkles,
  ChevronRight,
  Zap,
  Target,
  TrendingUp,
} from 'lucide-react';
import { getSamplePreloader } from '@/domains/playback/services/InitialSamplePreloader.bridge';
import { getLogger } from '@/utils/logger.js';

const logger = getLogger('exercise-selector');

interface ExerciseSelectorProps {
  exercises: any[];
  selectedExerciseId: string | null;
  onExerciseSelect: (exerciseId: string) => void;
  loading?: boolean;
  error?: string | null;
}

export function ExerciseSelector({
  exercises,
  selectedExerciseId,
  onExerciseSelect,
  loading = false,
  error = null,
}: ExerciseSelectorProps) {
  const [hoveredExerciseId, setHoveredExerciseId] = useState<string | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredFullLoadRef = useRef(false);

  // Phase 3: Load full samples for ALL exercises when ExerciseSelector becomes visible
  useEffect(() => {
    const loadFullSamplesWhenVisible = async (
      entries: IntersectionObserverEntry[],
    ) => {
      const [entry] = entries;

      if (entry.isIntersecting && !hasTriggeredFullLoadRef.current) {
        hasTriggeredFullLoadRef.current = true;

        logger.info(
          '🎯 ExerciseSelector visible - loading samples for ALL exercises (silent background)',
          {
            exerciseCount: exercises.length,
            exerciseTitles: exercises.map(e => e.title),
          }
        );

        try {
          const preloader = getSamplePreloader();

          // Preload ALL exercises sequentially (silent background operation)
          for (let i = 0; i < exercises.length; i++) {
            const exercise = exercises[i];

            if (!exercise?.id) continue;

            logger.info(`📥 Preloading exercise ${i + 1}/${exercises.length}: ${exercise.title}`, {
              exerciseId: exercise.id,
              harmonyInstrument: exercise.harmonyInstrument,
              hasHarmonyNotes: !!exercise?.harmonyNotes && exercise.harmonyNotes.length > 0,
            });

            // Load samples for this exercise
            const result = await preloader.loadFullSamples(exercise);

            // CRITICAL FIX: Emit event after each exercise loads to trigger HarmonyWidget re-registration
            if (typeof window !== 'undefined') {
              const event = new CustomEvent('harmony-samples-loaded', {
                detail: {
                  exerciseId: exercise.id,
                  instrument: exercise.harmonyInstrument,
                  samplesLoaded: result.loaded,
                  exerciseTitle: exercise.title,
                }
              });
              window.dispatchEvent(event);
              console.log('📢 [EXERCISE-SELECTOR] Emitted harmony-samples-loaded event', {
                exerciseId: exercise.id,
                instrument: exercise.harmonyInstrument,
                samplesLoaded: result.loaded,
              });
            }

            // Small delay between exercises to avoid overwhelming the system
            await new Promise(resolve => setTimeout(resolve, 300));
          }

          logger.info('✅ All exercise samples preloaded successfully', {
            totalExercises: exercises.length,
          });

          // Mark that all samples are ready
          if (typeof window !== 'undefined') {
            (window as any).__allSamplesLoaded = true;
            window.dispatchEvent(new Event('allSamplesLoaded'));
          }
        } catch (error) {
          logger.error('❌ Failed to load exercise samples:', error);
        }
      }
    };

    // Create intersection observer
    const observer = new IntersectionObserver(loadFullSamplesWhenVisible, {
      threshold: 0.1, // Trigger when 10% visible
      rootMargin: '50px', // Start loading 50px before visible
    });

    // Observe the container
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    // Cleanup
    return () => {
      observer.disconnect();
    };
  }, [exercises]);

  // Format duration as bars helper - uses total_bars directly
  const formatDurationInBars = (exercise: any) => {
    // Use total_bars directly (primary field)
    if (exercise.total_bars) {
      return `${exercise.total_bars} bars`;
    }

    // Fallback: calculate from duration_beats if available
    if (exercise.duration_beats) {
      const timeSignature = exercise.timeSignature?.numerator || 4;
      const bars = Math.round(exercise.duration_beats / timeSignature);
      return `${bars} bars`;
    }

    return '--';
  };

  // Get difficulty config with enhanced styling
  const getDifficultyConfig = (difficulty: any) => {
    const configs = {
      beginner: {
        label: 'Beginner',
        gradient: 'from-emerald-500/30 to-green-600/20',
        icon: '🌱',
        shadowColor: 'rgba(16, 185, 129, 0.3)',
        borderColor: 'border-emerald-500/30',
      },
      easy: {
        label: 'Easy',
        gradient: 'from-emerald-500/30 to-green-600/20',
        icon: '🌱',
        shadowColor: 'rgba(16, 185, 129, 0.3)',
        borderColor: 'border-emerald-500/30',
      },
      intermediate: {
        label: 'Intermediate',
        gradient: 'from-amber-500/30 to-orange-600/20',
        icon: '🔥',
        shadowColor: 'rgba(245, 158, 11, 0.3)',
        borderColor: 'border-amber-500/30',
      },
      medium: {
        label: 'Medium',
        gradient: 'from-amber-500/30 to-orange-600/20',
        icon: '🔥',
        shadowColor: 'rgba(245, 158, 11, 0.3)',
        borderColor: 'border-amber-500/30',
      },
      advanced: {
        label: 'Advanced',
        gradient: 'from-rose-500/30 to-red-600/20',
        icon: '⚡',
        shadowColor: 'rgba(244, 63, 94, 0.3)',
        borderColor: 'border-rose-500/30',
      },
      hard: {
        label: 'Hard',
        gradient: 'from-rose-500/30 to-red-600/20',
        icon: '⚡',
        shadowColor: 'rgba(244, 63, 94, 0.3)',
        borderColor: 'border-rose-500/30',
      },
    };
    // Handle both string and Difficulty object with value property
    const difficultyValue = typeof difficulty === 'object' ? difficulty?.value : difficulty;
    const normalizedDifficulty = difficultyValue?.toLowerCase();
    return (
      configs[normalizedDifficulty as keyof typeof configs] || {
        label: difficultyValue || 'Unknown',
        gradient: 'from-gray-500/30 to-gray-600/20',
        icon: '❓',
        shadowColor: 'rgba(107, 114, 128, 0.3)',
        borderColor: 'border-gray-500/30',
      }
    );
  };

  return (
    <Card
      ref={containerRef}
      className="w-full bg-gradient-to-br from-slate-800/70 to-slate-900/70 backdrop-blur-xl shadow-[10px_10px_30px_rgba(0,0,0,0.7),-10px_-10px_30px_rgba(255,255,255,0.05)] rounded-3xl border border-slate-700/40 overflow-hidden"
    >
      <CardHeader className="relative bg-gradient-to-r from-slate-800/95 via-slate-800/85 to-slate-900/95 p-6 border-b border-slate-700/40">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Enhanced icon container */}
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/30 rounded-2xl blur-2xl animate-pulse" />
              <div className="relative p-4 rounded-2xl bg-gradient-to-br from-slate-700/70 to-slate-800/70 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.05)] border border-slate-600/30">
                <ListMusic className="w-7 h-7 text-orange-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Exercise Library
                </h3>
                <Sparkles className="w-5 h-5 text-orange-400/70 animate-pulse" />
              </div>
              <p className="text-sm text-slate-400 mt-1 font-medium">
                Master your skills with structured practice
              </p>
            </div>
          </div>

          {/* Stats badges */}
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-2xl bg-gradient-to-br from-slate-700/50 to-slate-800/50 shadow-[inset_3px_3px_6px_rgba(0,0,0,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.05)] border border-slate-600/40">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-orange-400">
                  {exercises.length}
                </span>
                <span className="text-xs text-slate-400">exercises</span>
              </div>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6 bg-gradient-to-b from-slate-800/40 to-slate-900/60">
        {/* Exercise Grid */}
        <div className="space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
                <span className="text-sm text-slate-400 font-medium">
                  Loading exercises...
                </span>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/30">
                <span className="text-sm text-red-400">{error}</span>
              </div>
            </div>
          )}

          {!loading && !error && exercises.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">No exercises available</p>
            </div>
          )}

          {!loading &&
            !error &&
            exercises
              .filter((exercise) => exercise?.id && exercise?.title)
              .map((exercise, index) => {
                const isSelected = selectedExerciseId === exercise.id;
                const isHovered = hoveredExerciseId === exercise.id;
                const difficultyConfig = getDifficultyConfig(
                  exercise.difficulty,
                );

                return (
                  <div
                    key={exercise.id}
                    className={`
                    relative group cursor-pointer transition-all duration-500 transform
                    ${isSelected ? 'scale-[0.99]' : 'scale-100 hover:scale-[1.01]'}
                  `}
                    onClick={() => onExerciseSelect(exercise.id)}
                    onMouseEnter={() => setHoveredExerciseId(exercise.id)}
                    onMouseLeave={() => setHoveredExerciseId(null)}
                  >
                    {/* Exercise Card */}
                    <div
                      className={`
                    relative p-5 rounded-2xl transition-all duration-300
                    ${
                      isSelected
                        ? 'bg-gradient-to-r from-orange-500/20 via-orange-600/15 to-orange-500/20 shadow-[inset_4px_4px_8px_rgba(0,0,0,0.6),inset_-4px_-4px_8px_rgba(255,255,255,0.08)] border-2 border-orange-500/40'
                        : 'bg-gradient-to-r from-slate-700/50 via-slate-700/40 to-slate-800/50 shadow-[6px_6px_12px_rgba(0,0,0,0.5),-6px_-6px_12px_rgba(255,255,255,0.03)] border border-slate-600/30 hover:shadow-[8px_8px_16px_rgba(0,0,0,0.6),-8px_-8px_16px_rgba(255,255,255,0.05)] hover:border-slate-500/40'
                    }
                  `}
                    >
                      <div className="flex items-start justify-between gap-4">
                        {/* Left content */}
                        <div className="flex-1 space-y-3">
                          {/* Title row */}
                          <div className="flex items-center gap-3">
                            {/* Exercise number badge */}
                            <div
                              className={`
                            relative flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                            ${
                              isSelected
                                ? 'bg-orange-500/30 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]'
                                : 'bg-slate-800/60 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.05)]'
                            }
                          `}
                            >
                              <span
                                className={`text-sm font-bold ${isSelected ? 'text-orange-300' : 'text-slate-300'}`}
                              >
                                {index + 1}
                              </span>
                            </div>

                            {/* Title and check */}
                            <h4 className="flex-1 font-semibold text-base text-white group-hover:text-orange-200 transition-colors duration-300 truncate">
                              {exercise.title}
                            </h4>

                            {isSelected && (
                              <div className="flex-shrink-0 p-2 rounded-xl bg-orange-500/20 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4)]">
                                <CheckCircle className="w-5 h-5 text-orange-400" />
                              </div>
                            )}
                          </div>

                          {/* Info row */}
                          <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-slate-800/50 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <span className="text-slate-300 font-medium">
                                {formatDurationInBars(exercise)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-slate-800/50 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
                                <Music className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <span className="text-slate-300 font-medium">
                                {exercise.bpm || '--'} BPM
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-lg bg-slate-800/50 shadow-[inset_1px_1px_3px_rgba(0,0,0,0.4)]">
                                <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
                              </div>
                              <span className="text-slate-300 font-medium">
                                Key: {exercise.key || '--'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right side - Difficulty badge and play button */}
                        <div className="flex items-center gap-3">
                          {/* Difficulty badge */}
                          <div
                            className={`
                          px-4 py-2 rounded-xl bg-gradient-to-br ${difficultyConfig.gradient} 
                          shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]
                          border ${difficultyConfig.borderColor} transition-all duration-300
                          ${isHovered ? 'scale-105' : 'scale-100'}
                        `}
                            style={{
                              boxShadow: isHovered
                                ? `inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.1),0_0_20px_${difficultyConfig.shadowColor}`
                                : undefined,
                            }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">
                                {difficultyConfig.icon}
                              </span>
                              <span className="text-xs font-bold text-white/90">
                                {difficultyConfig.label}
                              </span>
                            </div>
                          </div>

                          {/* Play indicator */}
                          <div
                            className={`
                          p-3 rounded-xl transition-all duration-300 
                          ${
                            isSelected || isHovered
                              ? 'bg-orange-500/20 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.4),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] scale-110'
                              : 'bg-slate-800/50 shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.05)] scale-100'
                          }
                        `}
                          >
                            <ChevronRight
                              className={`w-5 h-5 transition-colors duration-300 ${isSelected || isHovered ? 'text-orange-400' : 'text-slate-400'}`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Progress indicator (if selected) */}
                      {isSelected && (
                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-500/0 via-orange-500/50 to-orange-500/0 rounded-b-2xl" />
                      )}
                    </div>
                  </div>
                );
              })}
        </div>
      </CardContent>
    </Card>
  );
}
