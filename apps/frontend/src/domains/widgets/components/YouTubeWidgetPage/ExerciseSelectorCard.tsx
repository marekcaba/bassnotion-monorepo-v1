'use client';

import React, { useState, useEffect, useCallback } from 'react';
import '@/domains/widgets/api/clearExerciseCache'; // Make cache clearing available
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import {
  Clock,
  Target,
  Music,
  CheckCircle,
  Loader2,
  FileText,
  Download,
} from 'lucide-react';
import { useExerciseSelection } from '../../hooks/useExerciseSelection';
import { SyncedWidget } from '../base';
import type { SyncedWidgetRenderProps } from '../base';
import type { Tutorial } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface ExerciseSelectorCardProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[]; // Exercise data from tutorial API
  onExerciseSelect?: (exerciseId: string) => void;
}

// Helper function to format duration as bars (measures)
function formatDurationInBars(totalBars?: number): string {
  if (!totalBars || totalBars <= 0) {
    return '--';
  }

  return `${totalBars} ${totalBars === 1 ? 'bar' : 'bars'}`;
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

// Helper function to download MIDI file
async function downloadMidiFile(
  exerciseId: string,
  filename: string,
): Promise<void> {
  try {
    const response = await fetch(`/api/exercises/${exerciseId}/download-midi`, {
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    const data = await response.json();

    if (data.error) {
      throw new Error(data.error);
    }

    // Open download URL in new tab
    window.open(data.downloadUrl, '_blank');
  } catch (error) {
    logger.error('Error downloading MIDI file:', error);
    // Could add toast notification here
  }
}

const difficultyConfig = {
  beginner: {
    color: 'bg-green-500/20 text-green-300 border-green-500/30',
    label: 'Beginner',
  },
  intermediate: {
    color: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    label: 'Intermediate',
  },
  advanced: {
    color: 'bg-red-500/20 text-red-300 border-red-500/30',
    label: 'Advanced',
  },
} as const;

// Helper function to get difficulty config with fallback
function getDifficultyConfig(difficulty: any) {
  // Handle both string and Difficulty object with value property
  const difficultyValue =
    typeof difficulty === 'object' ? difficulty?.value : difficulty;
  const normalizedDifficulty = difficultyValue?.toLowerCase();
  if (normalizedDifficulty in difficultyConfig) {
    return difficultyConfig[
      normalizedDifficulty as keyof typeof difficultyConfig
    ];
  }
  // Fallback for unknown difficulties
  return {
    color: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
    label: difficultyValue || 'Unknown',
  };
}

export function ExerciseSelectorCard({
  tutorialData: _tutorialData,
  tutorialSlug,
  exercises: propExercises,
  onExerciseSelect,
}: ExerciseSelectorCardProps) {
  const { correlationId, logger } = useCorrelation('ExerciseSelectorCard');
  // Debug: Log every render of ExerciseSelectorCard
  // logger.info('🔄 ExerciseSelectorCard RENDER:', {
  //   tutorialSlug,
  //   propExercisesCount: propExercises?.length || 0,
  //   timestamp: new Date().toISOString(),
  // });

  // Debug: Log mount/unmount
  React.useEffect(() => {
    // logger.info('🟢 ExerciseSelectorCard MOUNTED');
    return () => {
      // logger.info('🔴 ExerciseSelectorCard UNMOUNTED');
    };
  }, []);

  return (
    <SyncedWidget
      widgetId="exercise-selector"
      widgetName="Exercise Selector"
      debugMode={false}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <ExerciseSelectorCardContent
          tutorialData={_tutorialData}
          tutorialSlug={tutorialSlug}
          exercises={propExercises}
          onExerciseSelect={onExerciseSelect}
          syncProps={syncProps}
        />
      )}
    </SyncedWidget>
  );
}

interface ExerciseSelectorCardContentProps {
  tutorialData?: Tutorial;
  tutorialSlug?: string;
  exercises?: any[];
  onExerciseSelect?: (exerciseId: string) => void;
  syncProps: SyncedWidgetRenderProps;
}

function ExerciseSelectorCardContent({
  tutorialData: _tutorialData,
  tutorialSlug: _tutorialSlug,
  exercises: propExercises,
  onExerciseSelect,
  syncProps,
}: ExerciseSelectorCardContentProps) {
  // Use tutorial-specific exercises if provided, otherwise fallback to useExerciseSelection
  const {
    exercises: fallbackExercises,
    isLoading: loading,
    error,
    selectExercise,
  } = useExerciseSelection();

  // Prefer prop exercises (from tutorial) over fallback exercises
  const exercises =
    propExercises && propExercises.length > 0
      ? propExercises
      : fallbackExercises;

  const [selectedExerciseId, setSelectedExerciseId] = useState<string>('');

  const handleExerciseSelect = (exerciseId: string) => {
    // Handle both Exercise entity (id.value) and plain Exercise interface (id as string)
    const exercise = exercises.find((ex) => {
      const exId = typeof ex.id === 'object' && ex.id !== null ? ex.id.value : ex.id;
      return exId === exerciseId;
    });
    if (exercise) {
      // Check if this exercise is already selected by comparing with sync state
      // Use the current syncProps.selectedExercise from the current render
      const syncExId = syncProps.selectedExercise?.id;
      const wasAlreadySelected = (typeof syncExId === 'object' && syncExId !== null ? syncExId.value : syncExId) === exerciseId;

      // Add a unique selection timestamp to track user clicks
      const timestamp = Date.now();
      const exerciseWithTimestamp = {
        ...exercise,
        _selectionTimestamp: timestamp,
      };

      setSelectedExerciseId(exerciseId);
      selectExercise(exerciseWithTimestamp);
      onExerciseSelect?.(exerciseId);

      // Emit comprehensive sync events to configure all widgets

      // 1. Main exercise change event (always emit to ensure all widgets sync)
      syncProps.sync.actions.emitEvent(
        'EXERCISE_CHANGE',
        {
          exercise,
          forceReload: wasAlreadySelected,
          clickTimestamp: timestamp,
        },
        'high',
      );

      // 1b. If same exercise was re-selected, include forceReload flag in the EXERCISE_CHANGE event
      // (handled by forceReload flag in the event above)

      // 2. Tempo change for metronome and global controls
      if (exercise.bpm && exercise.bpm > 0) {
        syncProps.sync.actions.emitEvent(
          'TEMPO_CHANGE',
          {
            tempo: exercise.bpm,
            source: 'exercise-selector',
            reason: 'exercise-template',
          },
          'high',
        );
      }

      // 3. Custom bassline pattern if available
      if (
        exercise.chord_progression &&
        Array.isArray(exercise.chord_progression)
      ) {
        syncProps.sync.actions.emitEvent(
          'CUSTOM_BASSLINE',
          {
            chordProgression: exercise.chord_progression,
            key: exercise.key,
            source: 'exercise-selector',
            reason: 'exercise-template',
          },
          'normal',
        );
      }

      // 4. Volume configuration for optimal practice
      syncProps.sync.actions.emitEvent(
        'VOLUME_CHANGE',
        {
          masterVolume: 0.8,
          metronomeVolume: 0.7,
          source: 'exercise-selector',
          reason: 'exercise-template',
        },
        'low',
      );
    }
  };

  // Auto-select first exercise when exercises load
  useEffect(() => {
    // Auto-select first exercise if none is selected and exercises are available
    if (exercises.length > 0 && !selectedExerciseId) {
      const firstExercise = exercises[0];
      if (firstExercise && firstExercise.id) {
        handleExerciseSelect(firstExercise.id);
      }
    }
  }, [exercises, selectedExerciseId]); // Remove handleExerciseSelect dependency

  return (
    <Card className="bg-transparent border-transparent shadow-none overflow-visible">
      <CardContent className="p-0 overflow-visible">
        {/* Unified Neumorphic Exercise Panel */}
        <div className="bg-slate-800 rounded-2xl p-4 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300">
          {/* Header Section */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full shadow-[1px_1px_2px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)] bg-orange-400"
                role="img"
                aria-label="Exercise selector"
              />
              <div>
                <h3 className="font-semibold text-sm text-white">
                  🎯 Exercise Selector
                </h3>
                <p className="text-xs text-slate-400">
                  Choose practice exercise
                </p>
              </div>
            </div>
          </div>

          {/* Exercise List */}
          <div className="space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-orange-500" />
                <span className="ml-2 text-xs text-slate-400">Loading...</span>
              </div>
            )}
            {error && (
              <div className="text-center py-4">
                <p className="text-xs text-red-400">{error}</p>
              </div>
            )}
            {!loading &&
              !error &&
              exercises
                .filter((exercise) => exercise?.id && exercise?.title)
                .map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className={`relative p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                      selectedExerciseId === exercise.id
                        ? 'bg-orange-500/20 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)] border border-orange-500/30'
                        : 'bg-slate-700/50 hover:bg-slate-600/50 shadow-[1px_1px_2px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3)]'
                    }`}
                    onClick={() => handleExerciseSelect(exercise.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-orange-400">
                            #{index + 1}
                          </span>
                          <h4 className="font-medium text-sm text-white truncate">
                            {exercise.title}
                          </h4>
                          {selectedExerciseId === exercise.id && (
                            <CheckCircle className="w-3 h-3 text-orange-400 flex-shrink-0" />
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>
                              {formatDurationInBars(exercise.total_bars)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Music className="w-3 h-3" />
                            <span>
                              {exercise.bpm !== undefined &&
                              exercise.bpm !== null &&
                              exercise.bpm !== 0
                                ? `${exercise.bpm} BPM`
                                : '-- BPM'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span>
                              Key:{' '}
                              {exercise.key && exercise.key !== ''
                                ? exercise.key
                                : 'N/A'}
                            </span>
                          </div>
                          {exercise.midi_file_path && (
                            <div className="flex items-center gap-1">
                              <FileText className="w-3 h-3 text-blue-400" />
                              <span className="text-blue-400">MIDI</span>
                            </div>
                          )}
                        </div>

                        {/* MIDI File Info and Download */}
                        {exercise.midi_file_path && (
                          <div className="mt-2 flex items-center gap-2 text-xs">
                            <div className="flex items-center gap-1 text-slate-500">
                              <span>
                                {exercise.original_filename || 'midi-file.mid'}
                              </span>
                              {exercise.file_size && (
                                <span>
                                  ({formatFileSize(exercise.file_size)})
                                </span>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent exercise selection
                                downloadMidiFile(
                                  exercise.id,
                                  exercise.original_filename || 'exercise.mid',
                                );
                              }}
                              className="flex items-center gap-1 px-2 py-1 bg-blue-500/20 text-blue-400 rounded hover:bg-blue-500/30 transition-colors"
                              title="Download MIDI file"
                            >
                              <Download className="w-3 h-3" />
                              <span>Download</span>
                            </button>
                          </div>
                        )}
                      </div>

                      <div
                        className={`px-2 py-1 rounded-md text-xs font-medium ${
                          getDifficultyConfig(exercise.difficulty).color
                        } shadow-[1px_1px_2px_rgba(0,0,0,0.4),-1px_-1px_2px_rgba(255,255,255,0.1)]`}
                      >
                        {getDifficultyConfig(exercise.difficulty).label}
                      </div>
                    </div>
                  </div>
                ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
