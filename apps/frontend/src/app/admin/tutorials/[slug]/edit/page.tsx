'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

// Import tutorial page components individually so we can wrap them
import { YouTubeVideoSection } from '@/domains/widgets/components/YouTubeWidgetPage/YouTubeVideoSection';
import { TutorialInfoCard } from '@/domains/widgets/components/YouTubeWidgetPage/TutorialInfoCard';
import { ExerciseSelector } from '@/domains/widgets/components/YouTubeWidgetPage/ExerciseSelector';
import { TransportClock } from '@/domains/widgets/components/YouTubeWidgetPage/components/TransportClock';
import { FretboardCard } from '@/domains/widgets/components/YouTubeWidgetPage/FretboardCard/FretboardCard';
import { GlobalControlsCard } from '@/domains/widgets/components/YouTubeWidgetPage/components/GlobalControlsCard';
import { FourWidgetsCard } from '@/domains/widgets/components/YouTubeWidgetPage/components/FourWidgetsCard';
import { TeachingTakeawayCard } from '@/domains/widgets/components/YouTubeWidgetPage/TeachingTakeawayCard';
import { TimingDebugWindow } from '@/domains/widgets/components/YouTubeWidgetPage/components/TimingDebugWindow';
import { UserIndicator } from '@/domains/user/components/UserIndicator';
import { SyncProvider } from '@/domains/widgets/components/base/SyncProvider';
import { TransportProvider } from '@/domains/playback/contexts/TransportContext';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

// Import admin-specific components
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Plus, Settings, X, Check, Trash, ArrowLeft } from 'lucide-react';
import { useTutorialRepository } from '@/domains/tutorials/hooks/useTutorialRepository';
import { useExerciseRepository } from '@/domains/exercises/hooks/useExerciseRepository';
import { Tutorial } from '@/domains/tutorials/entities/tutorial.entity';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';
import { TutorialSlug } from '@/domains/tutorials/value-objects/tutorial-slug.vo';
import { TutorialLevel } from '@/domains/tutorials/value-objects/tutorial-level.vo';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { supabase } from '@/infrastructure/supabase/client';
import { ExerciseFormModal } from '@/domains/admin/components/ExerciseFormModal';
import { ExerciseListEdit } from '@/domains/admin/components/ExerciseListEdit';
import { useToast } from '@/shared/hooks/use-toast';

interface AdminTutorialPageProps {
  params: Promise<{ slug: string }>;
}

// Default template for new tutorials
const DEFAULT_TUTORIAL_TEMPLATE = {
  title: 'My Awesome Bass Tutorial',
  description:
    'Learn this amazing bass line step by step. Perfect for intermediate players looking to improve their groove and timing.',
  youtubeId: 'dQw4w9WgXcQ', // Default YouTube ID
  duration: 300, // 5 minutes
  authorName: 'Bass Master',
  level: 'intermediate' as const,
  tags: ['groove', 'funk', 'intermediate'],
  sections: [
    {
      title: 'Introduction',
      description: 'Welcome to this bass tutorial',
      timestamp: 0,
    },
    {
      title: 'Main Groove',
      description: 'Learn the main bass line',
      timestamp: 60,
    },
    {
      title: 'Practice Tips',
      description: 'How to practice effectively',
      timestamp: 240,
    },
  ],
  // Core Concept section
  coreConcept: {
    description:
      'Master the fundamentals of groove and timing through focused practice techniques.',
    bulletPoints: [
      'Develop solid time feel with metronome exercises',
      'Build muscle memory through repetition',
      'Learn to lock in with the drums',
    ],
  },
  // Teaching Takeaway
  teachingTakeaway: {
    title: "What You'll Learn",
    subtitle: 'Key learning points and practice tips',
    coreLearningTitle: 'Core Learning',
    coreLearningDescription:
      'This lesson encourages interval thinking, melodic phrasing, and rhythmic creativity — all through a familiar tool: the pentatonic scale. Great for breaking out of "box scale" habits.',
    keyConceptsCount: 3,
    duration: 15,
    level: 'Int',
    masterySectionTitle: "What You'll Master",
    points: [
      'Essential groove patterns for any style',
      'How to practice effectively with a metronome',
      'Techniques for playing in the pocket',
    ],
    practiceTipTitle: 'Practice Tip',
    practiceTipDescription:
      'Start slowly with each modal concept. Practice the exercises at 60-80 BPM before increasing tempo. Focus on hearing the tension and release rather than just playing the notes.',
  },
};

// Component wrapper that adds an edit button
function EditableSection({
  children,
  onEdit,
  title,
}: {
  children: React.ReactNode;
  onEdit: () => void;
  title: string;
}) {
  return (
    <div className="relative group">
      {children}
      <Button
        onClick={onEdit}
        size="sm"
        variant="ghost"
        className="absolute top-2 right-2 opacity-60 hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white z-10"
        title={`Edit ${title}`}
      >
        <Settings className="w-4 h-4" />
      </Button>
    </div>
  );
}

export default function AdminTutorialEditPage({
  params,
}: AdminTutorialPageProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { correlationId, logger } = useCorrelation('AdminTutorialEditPage');
  const { isReady, isAuthenticated, user } = useAuth();
  const { profile } = useUserProfile();
  const { navigateWithTransition } = useViewTransitionRouter();
  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.slug;

  // State
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loadedExercises, setLoadedExercises] = useState<Exercise[]>([]); // Track exercises from DB
  const [isLoading, setIsLoading] = useState(true);
  const [editMode, setEditMode] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showTimingDebug, setShowTimingDebug] = useState(false);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    null,
  );
  const [autoSaveStatus, setAutoSaveStatus] = useState<
    'idle' | 'saving' | 'saved'
  >('idle');
  const [showExerciseModal, setShowExerciseModal] = useState(false);
  const [editingExercise, setEditingExercise] = useState<Exercise | null>(null);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // WeakMap to store temp MIDI paths for exercises (Story 4.4 - Task 4.2)
  // Uses WeakMap because Exercise entities are frozen/non-extensible
  const exerciseTempMidiPaths = useRef(
    new WeakMap<
      Exercise,
      {
        temp_bassline_midi_path?: string;
        temp_drummer_midi_path?: string;
        temp_harmony_midi_path?: string;
        temp_metronome_midi_path?: string;
      }
    >(),
  ).current;

  // Core Concept state - will be loaded from tutorial
  const [coreConcept, setCoreConcept] = useState({
    description: '',
    bulletPoints: [] as string[],
  });

  const [teachingTakeaway, setTeachingTakeaway] = useState({
    title: '',
    subtitle: '',
    coreLearningTitle: '',
    coreLearningDescription: '',
    keyConceptsCount: 0,
    duration: 0,
    level: '',
    masterySectionTitle: '',
    points: [] as string[],
    practiceTipTitle: '',
    practiceTipDescription: '',
  });

  // Bass configuration state (loaded from user profile)
  const [stringCount, setStringCount] = useState<4 | 5 | 6>(4);
  const [maxFrets, setMaxFrets] = useState(24);

  // Widget state for compatibility
  const widgetState = useWidgetPageState();

  // Check if user is admin
  const isAdmin = profile?.role === 'admin';

  // Toast notifications
  const { toast } = useToast();

  // Repositories
  const tutorialRepo = useTutorialRepository();
  const exerciseRepo = useExerciseRepository();

  // Load bass settings from user profile
  const bassStringCount = profile?.preferences?.bassConfiguration?.stringCount;
  const bassMaxFrets = profile?.preferences?.bassConfiguration?.maxFrets;
  const isProfileLoading = !profile && isAuthenticated;

  useEffect(() => {
    if (
      !isProfileLoading &&
      bassStringCount !== undefined &&
      bassMaxFrets !== undefined
    ) {
      logger.info('Loading bass settings from profile', {
        stringCount: bassStringCount,
        maxFrets: bassMaxFrets,
      });
      setStringCount(bassStringCount);
      setMaxFrets(bassMaxFrets);
    }
  }, [bassStringCount, bassMaxFrets, isProfileLoading]);

  // Load tutorial and manage preview state
  useEffect(() => {
    // OPTIMIZATION: Prevent multiple loads in React Strict Mode
    let mounted = true;

    const initialize = async () => {
      if (isReady && isAuthenticated && mounted) {
        // Clear preview state when entering edit mode
        // This ensures we don't show "Back to Edit" when visiting the tutorial normally later
        const previewingSlug = sessionStorage.getItem('previewingFromEdit');
        if (previewingSlug === tutorialSlug) {
          sessionStorage.removeItem('previewingFromEdit');
        }
        await loadTutorial();
      } else if (isReady && !isAuthenticated && mounted) {
        router.push('/login');
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutorialSlug, isReady, isAuthenticated]); // Only reload if slug or auth changes

  const loadTutorial = async () => {
    try {
      setIsLoading(true);
      logger.info('Loading tutorial', { slug: tutorialSlug });

      // OPTIMIZATION: Load tutorial with exercises in a single API call
      const result = await tutorialRepo.findBySlugWithExercises(
        TutorialSlug.create(tutorialSlug),
      );
      if (result.ok) {
        const { tutorial: loadedTutorial, exercises: loadedExercisesList } =
          result.value;
        setTutorial(loadedTutorial);

        // Load Core Concept data from tutorial
        if (
          loadedTutorial.coreConceptDescription ||
          loadedTutorial.coreConceptPoints?.length
        ) {
          setCoreConcept({
            description: loadedTutorial.coreConceptDescription || '',
            bulletPoints: loadedTutorial.coreConceptPoints || [],
          });
        }

        // Load Teaching Takeaway data from tutorial
        if (loadedTutorial.teachingTakeaway) {
          setTeachingTakeaway({
            title: loadedTutorial.teachingTakeaway.title || '',
            subtitle: loadedTutorial.teachingTakeaway.subtitle || '',
            coreLearningTitle:
              loadedTutorial.teachingTakeaway.coreLearningTitle || '',
            coreLearningDescription:
              loadedTutorial.teachingTakeaway.coreLearningDescription || '',
            keyConceptsCount:
              loadedTutorial.teachingTakeaway.keyConceptsCount || 0,
            duration: loadedTutorial.teachingTakeaway.duration || 0,
            level: loadedTutorial.teachingTakeaway.level || '',
            masterySectionTitle:
              loadedTutorial.teachingTakeaway.masterySectionTitle || '',
            points: loadedTutorial.teachingTakeaway.points || [],
            practiceTipTitle:
              loadedTutorial.teachingTakeaway.practiceTipTitle || '',
            practiceTipDescription:
              loadedTutorial.teachingTakeaway.practiceTipDescription || '',
          });
        }

        // Set exercises (already loaded in single batch call)
        setExercises(loadedExercisesList);
        setLoadedExercises(loadedExercisesList); // Keep track of originally loaded exercises
      } else {
        logger.error('Failed to load tutorial', result.error);
        router.push('/admin/tutorials');
      }
    } catch (error) {
      logger.error('Error loading tutorial', error);
      router.push('/admin/tutorials');
    } finally {
      setIsLoading(false);
    }
  };

  // Save all changes
  const handleSave = useCallback(
    async (isAutoSave = false) => {
      if (!tutorial || (!hasChanges && !isAutoSave)) return;

      try {
        if (isAutoSave) {
          setAutoSaveStatus('saving');
        } else {
          setIsSaving(true);
        }

        // Create updated tutorial with Core Concept and Teaching Takeaway data
        const updatedTutorial = Tutorial.reconstitute({
          id: tutorial.id,
          title: tutorial.title,
          slug: tutorial.slug,
          description: tutorial.description,
          youtubeId: tutorial.youtubeId,
          duration: tutorial.duration,
          authorName: tutorial.authorName,
          thumbnailUrl: tutorial.thumbnailUrl,
          level: tutorial.level,
          tags: tutorial.tags,
          isActive: tutorial.isActive,
          publishedAt: tutorial.publishedAt,
          createdAt: tutorial.createdAt,
          updatedAt: new Date(),
          sections: tutorial.sections,
          viewCount: tutorial.viewCount,
          status: tutorial.status,
          coreConceptDescription: coreConcept.description,
          coreConceptPoints: coreConcept.bulletPoints,
          teachingTakeaway: teachingTakeaway,
          // Include creator fields
          creatorName: tutorial.creatorName,
          creatorChannelUrl: tutorial.creatorChannelUrl,
          creatorAvatarUrl: tutorial.creatorAvatarUrl,
          creatorSubscriberCount: tutorial.creatorSubscriberCount,
        });

        // FAANG-level batch save - single API call for all changes
        logger.info('Initiating batch save', {
          tutorialId: tutorial.id.value,
          exerciseCount: exercises.length,
          isAutoSave,
        });

        // Find exercises that were deleted (need to be removed from DB)
        const deletedExercises = loadedExercises.filter(
          (loaded) => !exercises.some((ex) => ex.id.value === loaded.id.value),
        );

        // Batch delete removed exercises (FAANG-level: single API call for deletes)
        if (deletedExercises.length > 0) {
          logger.info('Batch deleting exercises', {
            count: deletedExercises.length,
          });
          const deleteIds = deletedExercises.map((ex) => ex.id);
          const deleteResult = await exerciseRepo.deleteMany(deleteIds);
          if (!deleteResult.ok) {
            logger.error('Failed to delete exercises', deleteResult.error);
          }
        }

        // Prepare exercises for batch save - just pass the entities
        // Repository will handle DTO conversion and ID logic
        const exercisesForSave = exercises.map((exercise) => {
          const isExisting = loadedExercises.some(
            (loaded) => loaded.id.value === exercise.id.value,
          );

          // Mark whether exercise is existing (has metadata we can use)
          return {
            exercise,
            isExisting,
          };
        });

        // Single batch save operation (Story 4.4 - Task 4.2: pass WeakMap for temp MIDI paths)
        const result = await tutorialRepo.saveWithExercises(
          updatedTutorial,
          exercisesForSave,
          exerciseTempMidiPaths,
        );

        if (result.ok) {
          logger.info('Batch save successful', {
            tutorialId: result.value.tutorial.id.value,
            exerciseCount: result.value.exercises.length,
          });

          // Update state with server-reconciled data
          setTutorial(result.value.tutorial);

          // Convert exercise DTOs back to entities
          const savedExercises = result.value.exercises.map((dto: any) => {
            logger.info('Exercise DTO from server', {
              id: dto.id,
              title: dto.title,
              bpm: dto.bpm,
              duration: dto.duration,
              key: dto.key,
            });
            return Exercise.fromDTO(dto);
          });

          logger.info('Converted exercises to entities', {
            count: savedExercises.length,
            firstExercise: savedExercises[0]
              ? {
                  id: savedExercises[0].id.value,
                  bpm: savedExercises[0].bpm,
                  duration: savedExercises[0].duration,
                  key: savedExercises[0].key,
                }
              : null,
          });

          setExercises(savedExercises);
          setLoadedExercises(savedExercises);

          setHasChanges(false);
          setLastSavedAt(new Date());

          // Invalidate React Query cache to ensure fresh data on tutorial page
          // This fixes the issue where drummer MIDI URLs weren't showing after save
          queryClient.invalidateQueries({
            queryKey: ['tutorial-exercises', tutorialSlug],
          });
          logger.info('Invalidated React Query cache for tutorial exercises', {
            tutorialSlug,
          });

          if (isAutoSave) {
            setAutoSaveStatus('saved');
            setTimeout(() => setAutoSaveStatus('idle'), 2000);
          } else {
            // Show success toast for manual saves
            toast({
              title: 'Tutorial Saved',
              description: 'All changes have been saved successfully.',
              variant: 'default',
            });
          }
        } else {
          throw new Error(result.error || 'Batch save failed');
        }
      } catch (error) {
        logger.error('Batch save failed - maintaining current state', error);

        // Optimistic update failed - state remains unchanged
        // User can see the error and retry or discard changes

        if (isAutoSave) {
          setAutoSaveStatus('idle');
        }

        // Parse error message to show user-friendly notification
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        // Check for specific database errors
        if (
          errorMessage.includes(
            'duplicate key value violates unique constraint "tutorials_slug_key"',
          )
        ) {
          toast({
            title: 'Duplicate Tutorial Slug',
            description:
              'A tutorial with this slug already exists. Please change the tutorial slug to a unique value.',
            variant: 'destructive',
          });
        } else if (errorMessage.includes('duplicate key')) {
          toast({
            title: 'Duplicate Entry',
            description:
              'This value already exists in the database. Please use a unique value.',
            variant: 'destructive',
          });
        } else if (errorMessage.includes('Internal server error')) {
          toast({
            title: 'Server Error',
            description:
              'An error occurred on the server. Please check the console for details and try again.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Save Failed',
            description:
              errorMessage || 'Failed to save tutorial. Please try again.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!isAutoSave) {
          setIsSaving(false);
        }
      }
    },
    [
      tutorial,
      exercises,
      hasChanges,
      coreConcept,
      teachingTakeaway,
      loadedExercises,
      queryClient,
      tutorialSlug,
    ],
  );

  // Auto-save functionality with debouncing
  // OPTIMIZATION: Increased debounce from 3s to 10s to reduce API calls
  // Simplified dependencies to only trigger on hasChanges flag
  useEffect(() => {
    if (hasChanges && tutorial) {
      // Clear existing timer
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Set new timer for auto-save (10 seconds debounce - optimized from 3s)
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(true);
      }, 10000);
    }

    // Cleanup on unmount
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasChanges]);

  // Handle edit mode toggle
  const toggleEditMode = (componentName: string | null) => {
    setEditMode(editMode === componentName ? null : componentName);
  };

  // Check auth state
  if (!isReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Checking authentication...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Loading tutorial...</p>
        </div>
      </div>
    );
  }

  if (!tutorial) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">Tutorial Not Found</h1>
          <Button
            onClick={() => router.push('/admin/tutorials')}
            variant="secondary"
          >
            Back to Tutorials
          </Button>
        </div>
      </div>
    );
  }

  // Format tutorial data for components - always use current thumbnail URL
  const tutorialData = {
    id: tutorial.id.value,
    slug: tutorial.slug.value,
    title: tutorial.title,
    description: tutorial.description,
    youtube_id: tutorial.youtubeId,
    youtube_url: tutorial.youtubeId
      ? `https://www.youtube.com/watch?v=${tutorial.youtubeId}`
      : '',
    duration_seconds: tutorial.duration,
    author_name: tutorial.authorName,
    // Always generate thumbnail URL from YouTube ID for consistency
    thumbnail_url: tutorial.youtubeId
      ? `https://img.youtube.com/vi/${tutorial.youtubeId}/maxresdefault.jpg`
      : tutorial.thumbnailUrl,
    level: tutorial.level.value,
    tags: tutorial.tags,
    sections: tutorial.sections,
    view_count: tutorial.viewCount,
    created_at: tutorial.createdAt.toISOString(),
    updated_at: tutorial.updatedAt.toISOString(),
    // Add editable core concept and teaching takeaway data
    coreConcept: {
      description: coreConcept.description,
      bulletPoints: coreConcept.bulletPoints,
    },
    teachingTakeaway,
    // Also include raw fields for compatibility
    core_concept_description: coreConcept.description,
    core_concept_points: coreConcept.bulletPoints,
    // Add creator fields from tutorial entity
    creator_name: tutorial.creatorName,
    creator_channel_url: tutorial.creatorChannelUrl,
    creator_avatar_url: tutorial.creatorAvatarUrl,
    creator_subscriber_count: tutorial.creatorSubscriberCount,
  };

  // Format exercises
  const formattedExercises = exercises.map((ex) => ({
    id: ex.id?.value || `temp-${Math.random()}`,
    title: ex.title,
    description: ex.description,
    tempo: ex.tempo,
    difficulty: ex.difficulty,
    notes: ex.notes || [],
    drum_pattern: ex.drumPattern,
    harmony_pattern: ex.harmonyPattern,
  }));

  return (
    <>
      {/* Main Tutorial Page Layout - Full width background outside SyncProvider */}
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <TransportProvider>
          <SyncProvider>
            {/* Edit Modal */}
            {editMode && (
              <div
                className="fixed inset-0 bg-black/50 z-40"
                onClick={() => toggleEditMode(null)}
              >
                <div
                  className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold">Edit {editMode}</h3>
                    <Button
                      onClick={() => toggleEditMode(null)}
                      variant="ghost"
                      size="sm"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Core Concept Edit Form */}
                  {editMode === 'core-concept' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Core Concept Description
                        </label>
                        <textarea
                          value={coreConcept.description}
                          onChange={(e) => {
                            setCoreConcept({
                              ...coreConcept,
                              description: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          rows={3}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Bullet Points
                        </label>
                        {coreConcept.bulletPoints.map((point, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...coreConcept.bulletPoints];
                                newPoints[index] = e.target.value;
                                setCoreConcept({
                                  ...coreConcept,
                                  bulletPoints: newPoints,
                                });
                                setHasChanges(true);
                              }}
                              className="flex-1 px-3 py-2 border rounded-md"
                            />
                            <Button
                              onClick={() => {
                                const newPoints =
                                  coreConcept.bulletPoints.filter(
                                    (_, i) => i !== index,
                                  );
                                setCoreConcept({
                                  ...coreConcept,
                                  bulletPoints: newPoints,
                                });
                                setHasChanges(true);
                              }}
                              size="sm"
                              variant="ghost"
                              className="text-red-500"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          onClick={() => {
                            setCoreConcept({
                              ...coreConcept,
                              bulletPoints: [
                                ...coreConcept.bulletPoints,
                                'New point',
                              ],
                            });
                            setHasChanges(true);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Point
                        </Button>
                      </div>
                      <Button
                        onClick={() => toggleEditMode(null)}
                        className="w-full"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Done Editing
                      </Button>
                    </div>
                  )}

                  {/* Teaching Takeaway Edit Form */}
                  {editMode === 'teaching-takeaway' && (
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Main Title
                        </label>
                        <input
                          type="text"
                          value={teachingTakeaway.title}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              title: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Subtitle
                        </label>
                        <input
                          type="text"
                          value={teachingTakeaway.subtitle}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              subtitle: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Core Learning Section Title
                        </label>
                        <input
                          type="text"
                          value={teachingTakeaway.coreLearningTitle}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              coreLearningTitle: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Core Learning Description
                        </label>
                        <textarea
                          value={teachingTakeaway.coreLearningDescription}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              coreLearningDescription: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          rows={3}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Key Concepts Count
                          </label>
                          <input
                            type="number"
                            value={teachingTakeaway.keyConceptsCount}
                            onChange={(e) => {
                              setTeachingTakeaway({
                                ...teachingTakeaway,
                                keyConceptsCount: parseInt(e.target.value) || 0,
                              });
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Duration (minutes)
                          </label>
                          <input
                            type="number"
                            value={teachingTakeaway.duration}
                            onChange={(e) => {
                              setTeachingTakeaway({
                                ...teachingTakeaway,
                                duration: parseInt(e.target.value) || 0,
                              });
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">
                            Level
                          </label>
                          <input
                            type="text"
                            value={teachingTakeaway.level}
                            onChange={(e) => {
                              setTeachingTakeaway({
                                ...teachingTakeaway,
                                level: e.target.value,
                              });
                              setHasChanges(true);
                            }}
                            className="w-full px-3 py-2 border rounded-md"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Mastery Section Title
                        </label>
                        <input
                          type="text"
                          value={teachingTakeaway.masterySectionTitle}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              masterySectionTitle: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Learning Points
                        </label>
                        {teachingTakeaway.points.map((point, index) => (
                          <div key={index} className="flex gap-2 mb-2">
                            <input
                              type="text"
                              value={point}
                              onChange={(e) => {
                                const newPoints = [...teachingTakeaway.points];
                                newPoints[index] = e.target.value;
                                setTeachingTakeaway({
                                  ...teachingTakeaway,
                                  points: newPoints,
                                });
                                setHasChanges(true);
                              }}
                              className="flex-1 px-3 py-2 border rounded-md"
                            />
                            <Button
                              onClick={() => {
                                const newPoints =
                                  teachingTakeaway.points.filter(
                                    (_, i) => i !== index,
                                  );
                                setTeachingTakeaway({
                                  ...teachingTakeaway,
                                  points: newPoints,
                                });
                                setHasChanges(true);
                              }}
                              size="sm"
                              variant="ghost"
                              className="text-red-500"
                            >
                              <Trash className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          onClick={() => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              points: [
                                ...teachingTakeaway.points,
                                'New learning point',
                              ],
                            });
                            setHasChanges(true);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Add Point
                        </Button>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Practice Tip Title
                        </label>
                        <input
                          type="text"
                          value={teachingTakeaway.practiceTipTitle}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              practiceTipTitle: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Practice Tip Description
                        </label>
                        <textarea
                          value={teachingTakeaway.practiceTipDescription}
                          onChange={(e) => {
                            setTeachingTakeaway({
                              ...teachingTakeaway,
                              practiceTipDescription: e.target.value,
                            });
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          rows={3}
                        />
                      </div>
                      <Button
                        onClick={() => toggleEditMode(null)}
                        className="w-full"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Done Editing
                      </Button>
                    </div>
                  )}

                  {/* Tutorial Info Edit Form */}
                  {editMode === 'tutorial-info' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={tutorial.title}
                          onChange={(e) => {
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: e.target.value,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Description
                        </label>
                        <textarea
                          value={tutorial.description}
                          onChange={(e) => {
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: e.target.value,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          rows={4}
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Level
                        </label>
                        <select
                          value={tutorial.level.value}
                          onChange={(e) => {
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: TutorialLevel.create(e.target.value),
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                        >
                          <option value="beginner">Beginner</option>
                          <option value="intermediate">Intermediate</option>
                          <option value="advanced">Advanced</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Creator Info Edit Form */}
                  {editMode === 'creator-info' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Creator Name
                        </label>
                        <input
                          type="text"
                          value={tutorial.creatorName || ''}
                          onChange={(e) => {
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                              creatorName: e.target.value || undefined,
                              creatorChannelUrl: tutorial.creatorChannelUrl,
                              creatorAvatarUrl: tutorial.creatorAvatarUrl,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          placeholder="e.g. Queen Official"
                          className="w-full px-3 py-2 border rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          YouTube channel name
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Channel URL
                        </label>
                        <input
                          type="text"
                          value={tutorial.creatorChannelUrl || ''}
                          onChange={(e) => {
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                              creatorName: tutorial.creatorName,
                              creatorChannelUrl: e.target.value || undefined,
                              creatorAvatarUrl: tutorial.creatorAvatarUrl,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          placeholder="https://www.youtube.com/channel/..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          Avatar URL
                        </label>
                        <input
                          type="text"
                          value={tutorial.creatorAvatarUrl || ''}
                          onChange={(e) => {
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                              creatorName: tutorial.creatorName,
                              creatorChannelUrl: tutorial.creatorChannelUrl,
                              creatorAvatarUrl: e.target.value || undefined,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          placeholder="https://yt3.ggpht.com/..."
                          className="w-full px-3 py-2 border rounded-md"
                        />
                        <p className="text-xs text-gray-500 mt-1">
                          Leave empty to auto-fetch from YouTube
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          try {
                            // Check if we have a YouTube ID
                            if (!tutorial.youtubeId) {
                              alert('Please set a YouTube video ID first');
                              return;
                            }

                            // Call the API to fetch YouTube channel info
                            const response = await fetch(
                              '/api/v1/tutorials/fetch-youtube-channel-info',
                              {
                                method: 'POST',
                                headers: {
                                  'Content-Type': 'application/json',
                                  Authorization: `Bearer ${await supabase.auth.getSession().then((s) => s.data.session?.access_token)}`,
                                },
                                body: JSON.stringify({
                                  youtubeUrl: `https://www.youtube.com/watch?v=${tutorial.youtubeId}`,
                                }),
                              },
                            );

                            if (!response.ok) {
                              const error = await response.json();
                              throw new Error(
                                error.message || 'Failed to fetch channel info',
                              );
                            }

                            const channelData = await response.json();

                            // Update the tutorial with the fetched data
                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: tutorial.youtubeId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: tutorial.thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                              creatorName: channelData.creatorName,
                              creatorChannelUrl: channelData.creatorChannelUrl,
                              creatorAvatarUrl: channelData.creatorAvatarUrl,
                              creatorSubscriberCount:
                                channelData.subscriberCount,
                            });

                            setTutorial(updated);
                            setHasChanges(true);

                            // Show success message
                            alert(
                              `Successfully fetched channel info for: ${channelData.creatorName}`,
                            );
                          } catch (error) {
                            logger.error(
                              'Error fetching YouTube channel info',
                              error,
                            );
                            alert(
                              `Failed to fetch channel info: ${error.message}`,
                            );
                          }
                        }}
                        className="w-full"
                      >
                        Auto-fetch from YouTube
                      </Button>
                    </div>
                  )}

                  {/* YouTube Video Edit Form */}
                  {editMode === 'youtube-video' && (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-1">
                          YouTube Video
                        </label>
                        <input
                          type="text"
                          defaultValue={tutorial.youtubeId}
                          onBlur={(e) => {
                            // Parse YouTube URL or ID
                            let videoId = e.target.value;

                            // Check if it's a full YouTube URL
                            const urlPatterns = [
                              /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
                              /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/,
                              /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/,
                            ];

                            for (const pattern of urlPatterns) {
                              const match = videoId.match(pattern);
                              if (match) {
                                videoId = match[1];
                                break;
                              }
                            }

                            // Update thumbnail URL based on new video ID
                            const thumbnailUrl = videoId
                              ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
                              : tutorial.thumbnailUrl;

                            const updated = Tutorial.reconstitute({
                              id: tutorial.id,
                              title: tutorial.title,
                              slug: tutorial.slug,
                              description: tutorial.description,
                              youtubeId: videoId,
                              duration: tutorial.duration,
                              authorName: tutorial.authorName,
                              thumbnailUrl: thumbnailUrl,
                              level: tutorial.level,
                              tags: tutorial.tags,
                              isActive: tutorial.isActive,
                              publishedAt: tutorial.publishedAt,
                              createdAt: tutorial.createdAt,
                              updatedAt: new Date(),
                              sections: tutorial.sections,
                              viewCount: tutorial.viewCount,
                            });
                            setTutorial(updated);
                            setHasChanges(true);
                          }}
                          className="w-full px-3 py-2 border rounded-md"
                          placeholder="Paste YouTube URL or video ID"
                        />
                        <p className="text-sm text-gray-500 mt-1">
                          You can paste a full YouTube URL or just the video ID
                        </p>
                      </div>

                      {/* Preview - only show if we have a valid YouTube ID (at least 11 characters) */}
                      {tutorial.youtubeId &&
                        tutorial.youtubeId.length >= 11 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Preview:</p>
                            <div className="aspect-video w-full rounded-lg overflow-hidden bg-gray-100">
                              <iframe
                                src={`https://www.youtube.com/embed/${tutorial.youtubeId}`}
                                className="w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <img
                                src={`https://img.youtube.com/vi/${tutorial.youtubeId}/default.jpg`}
                                alt="Thumbnail"
                                className="w-20 h-15 object-cover rounded"
                                onError={(e) => {
                                  // Fallback to a placeholder if thumbnail fails to load
                                  (e.target as HTMLImageElement).style.display =
                                    'none';
                                }}
                              />
                              <div className="text-xs text-gray-600">
                                <p>Video ID: {tutorial.youtubeId}</p>
                                <p>
                                  Thumbnail URL: https://img.youtube.com/vi/
                                  {tutorial.youtubeId}/maxresdefault.jpg
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                      <Button
                        onClick={() => toggleEditMode(null)}
                        className="w-full"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Done Editing
                      </Button>
                    </div>
                  )}

                  {/* Exercises Edit Form */}
                  {editMode === 'exercises' && (
                    <div className="space-y-4">
                      <ExerciseListEdit
                        exercises={exercises}
                        onAddExercise={() => {
                          setEditingExercise(null);
                          setShowExerciseModal(true);
                        }}
                        onEditExercise={(exercise) => {
                          setEditingExercise(exercise);
                          setShowExerciseModal(true);
                        }}
                        onDeleteExercise={(index) => {
                          const updated = exercises.filter(
                            (_, i) => i !== index,
                          );
                          setExercises(updated);
                          setHasChanges(true);
                        }}
                      />
                      {/* Old inline exercise editing code removed - using ExerciseListEdit component above */}
                      <Button
                        onClick={() => toggleEditMode(null)}
                        className="w-full"
                      >
                        <Check className="w-4 h-4 mr-2" />
                        Done Editing
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mobile-first central container */}
            <div className="mx-auto px-4 py-6 max-w-[600px]">
              <div className="space-y-4">
                {/* Header with Admin Controls and User Indicator */}
                <div className="flex justify-between items-center gap-3">
                  {/* Back arrow and auto-save indicator on the left */}
                  <div className="flex items-center gap-3">
                    <Button
                      onClick={() => router.push('/library')}
                      variant="ghost"
                      size="sm"
                      className="text-white/70 hover:text-white p-2"
                      title="Back to Library"
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <div className="flex items-center gap-2">
                      {autoSaveStatus === 'saving' && (
                        <span className="text-blue-400 text-sm flex items-center gap-1">
                          <div className="w-3 h-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                          Auto-saving...
                        </span>
                      )}
                      {autoSaveStatus === 'saved' && (
                        <span className="text-green-400 text-sm flex items-center gap-1">
                          <Check className="w-4 h-4" />
                          Saved
                        </span>
                      )}
                      {hasChanges && autoSaveStatus === 'idle' && (
                        <span className="text-yellow-400 text-sm flex items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-yellow-400" />
                          Unsaved changes
                        </span>
                      )}
                      {lastSavedAt &&
                        autoSaveStatus === 'idle' &&
                        !hasChanges && (
                          <span className="text-gray-400 text-sm">
                            All changes saved
                          </span>
                        )}
                    </div>
                  </div>

                  {/* Admin buttons and user indicator on the right */}
                  <div className="flex items-center gap-3">
                    {isAdmin && (
                      <>
                        <Button
                          onClick={() => {
                            // Set flag to indicate we're previewing from edit mode
                            sessionStorage.setItem(
                              'previewingFromEdit',
                              tutorial.slug.value,
                            );
                            router.push(`/library/${tutorial.slug.value}`);
                          }}
                          size="sm"
                          variant="outline"
                          className="text-white border-white/30 hover:bg-white/10"
                        >
                          Preview
                        </Button>
                        <Button
                          onClick={async () => {
                            try {
                              setIsSaving(true);

                              // FAANG-level defensive save: Always save on Done, even if auto-save ran
                              // This ensures no data loss from race conditions, network issues, or edge cases
                              await handleSave(false);

                              // Brief success feedback
                              setAutoSaveStatus('saved');

                              // Small delay to let user see "saved" confirmation
                              await new Promise((resolve) =>
                                setTimeout(resolve, 300),
                              );

                              // Navigate to view mode
                              router.push(`/library/${tutorial.slug.value}`);
                            } catch (error) {
                              logger.error('Failed to save on Done', error);
                              // Don't navigate - keep user in edit mode
                              setAutoSaveStatus('idle');
                              // Error toast is already shown by handleSave
                            } finally {
                              setIsSaving(false);
                            }
                          }}
                          disabled={isSaving}
                          size="sm"
                          className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                        >
                          {isSaving ? (
                            <>
                              <div className="w-4 h-4 mr-1 animate-spin rounded-full border-2 border-white border-t-transparent" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Check className="w-4 h-4 mr-1" />
                              Done
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    <UserIndicator />
                  </div>
                </div>

                {/* YouTube Video Section with edit button */}
                <EditableSection
                  title="YouTube Video"
                  onEdit={() => toggleEditMode('youtube-video')}
                >
                  <YouTubeVideoSection tutorialData={tutorialData} />
                  {/* Add Creator Info edit button */}
                  <div className="mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleEditMode('creator-info')}
                      className="w-full"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Edit Creator Info
                    </Button>
                  </div>
                </EditableSection>

                {/* Tutorial Info Card - contains both Tutorial Info AND Core Concept */}
                <div className="relative">
                  <TutorialInfoCard tutorialData={tutorialData} />
                  {/* Two edit buttons - one for each section */}
                  <Button
                    onClick={() => toggleEditMode('tutorial-info')}
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2 opacity-60 hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white z-10"
                    title="Edit Tutorial Info"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => toggleEditMode('core-concept')}
                    size="sm"
                    variant="ghost"
                    className="absolute top-[180px] right-2 opacity-60 hover:opacity-100 transition-opacity bg-white/10 hover:bg-white/20 text-white z-10"
                    title="Edit Core Concept"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                </div>

                {/* Exercise Selector with edit button */}
                <EditableSection
                  title="Exercises"
                  onEdit={() => toggleEditMode('exercises')}
                >
                  <ExerciseSelector
                    exercises={formattedExercises || []}
                    selectedExerciseId={selectedExerciseId}
                    onExerciseSelect={setSelectedExerciseId}
                  />
                </EditableSection>

                {/* Transport Clock */}
                <TransportClock
                  selectedExercise={widgetState.selectedExercise}
                  loopRegion={widgetState.loopRegion}
                  onLoopRegionChange={(region) =>
                    widgetState.setLoopRegion(region)
                  }
                  currentTime={widgetState.currentTime || 0}
                  onSeek={() => {}}
                />

                {/* Fretboard Card */}
                <FretboardCard
                  is3DMode={false}
                  onToggle3DMode={() => {}}
                  selectedDots3D={new Map()}
                  setSelectedDots3D={() => {}}
                  stringCount3D={stringCount}
                  setStringCount3D={setStringCount}
                  cameraMode="overview"
                  setCameraMode={() => {}}
                  maxFrets={maxFrets}
                  tiltAngle={35}
                  onTiltAngleChange={() => {}}
                  tutorialData={tutorialData}
                  tutorialSlug={tutorial.slug.value}
                  exercises={formattedExercises}
                  selectedExerciseId={selectedExerciseId}
                  onExerciseSelect={setSelectedExerciseId}
                />

                {/* Global Controls */}
                <GlobalControlsCard
                  selectedExercise={formattedExercises.find(
                    (e) => e.id === selectedExerciseId,
                  )}
                  exercises={formattedExercises}
                />

                {/* Four Widgets */}
                <FourWidgetsCard
                  widgetState={widgetState}
                  tutorialId={tutorial.id.value}
                  isAdminMode={true}
                />

                {/* Teaching Takeaway */}
                <EditableSection
                  title="Teaching Takeaway"
                  onEdit={() => toggleEditMode('teaching-takeaway')}
                >
                  <TeachingTakeawayCard tutorialData={tutorialData} />
                </EditableSection>

                {/* Debug Toggle */}
                <div className="text-center mt-4">
                  <button
                    onClick={() => setShowTimingDebug(!showTimingDebug)}
                    className="px-4 py-2 bg-slate-800 rounded-lg text-sm text-slate-200 hover:bg-slate-700 hover:text-white transition-colors border border-slate-600"
                  >
                    {showTimingDebug ? '🔴 Hide' : '🟢 Show'} Timing Debug
                  </button>
                </div>
              </div>
            </div>

            {/* Timing Debug Window */}
            <TimingDebugWindow
              isVisible={showTimingDebug}
              onClose={() => setShowTimingDebug(false)}
            />

            {/* Exercise Form Modal */}
            <ExerciseFormModal
              isOpen={showExerciseModal}
              onClose={() => {
                setShowExerciseModal(false);
                setEditingExercise(null);
              }}
              onSave={(exerciseData) => {
                if (editingExercise) {
                  // Update existing exercise
                  const updatedExercise = Exercise.reconstitute({
                    ...exerciseData,
                    id: editingExercise.id,
                    createdAt: editingExercise.createdAt,
                    updatedAt: new Date(),
                  });

                  // Preserve temp MIDI paths for backend migration (Story 4.4 - Task 4.2)
                  // Use WeakMap because Exercise entities are frozen/non-extensible
                  exerciseTempMidiPaths.set(updatedExercise, {
                    temp_bassline_midi_path:
                      exerciseData.temp_bassline_midi_path,
                    temp_drummer_midi_path: exerciseData.temp_drummer_midi_path,
                    temp_harmony_midi_path: exerciseData.temp_harmony_midi_path,
                    temp_metronome_midi_path:
                      exerciseData.temp_metronome_midi_path,
                  });

                  const updated = exercises.map((ex) =>
                    ex.id?.value === editingExercise.id?.value
                      ? updatedExercise
                      : ex,
                  );
                  setExercises(updated);
                } else {
                  // Add new exercise - create proper Exercise entity
                  const newExercise = Exercise.create({
                    ...exerciseData,
                    tutorialId: tutorial?.id.value,
                  });

                  // Preserve temp MIDI paths for backend migration (Story 4.4 - Task 4.2)
                  // Use WeakMap because Exercise entities are frozen/non-extensible
                  exerciseTempMidiPaths.set(newExercise, {
                    temp_bassline_midi_path:
                      exerciseData.temp_bassline_midi_path,
                    temp_drummer_midi_path: exerciseData.temp_drummer_midi_path,
                    temp_harmony_midi_path: exerciseData.temp_harmony_midi_path,
                    temp_metronome_midi_path:
                      exerciseData.temp_metronome_midi_path,
                  });

                  setExercises([...exercises, newExercise]);
                  // Note: Don't add to loadedExercises here - it will be reconciled after batch save
                  // The batch save will detect missing ID and create new exercise with server-assigned ID
                }
                setHasChanges(true);
                setShowExerciseModal(false);
                setEditingExercise(null);
              }}
              exercise={editingExercise}
              tutorialId={tutorial?.id.value || ''}
            />
          </SyncProvider>
        </TransportProvider>
      </div>
    </>
  );
}
