import type { AnyBlock, Tutorial } from '@bassnotion/contracts';

/** Safely extract a string from a value that may be a string, value-object, or nullish */
function safeDifficulty(value: unknown): string {
  if (value === null || value === undefined) return 'beginner';
  if (typeof value === 'string') return value.toLowerCase();
  if (typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value).toLowerCase();
  }
  return String(value).toLowerCase();
}

/**
 * Derives a blocks array from legacy act-specific tutorial fields.
 * Used as a fallback when tutorial.blocks is empty/undefined.
 *
 * Maps the old three-act structure to the new block system:
 *   Act 1 (Understand) -> VideoBlock
 *   Act 2 (Practice)   -> ExerciseBlock
 *   Act 3 (Apply)      -> GrooveBlock
 */
export function deriveBlocksFromLegacy(
  tutorial: Tutorial,
  exercises: any[]
): AnyBlock[] {
  const blocks: AnyBlock[] = [];
  let order = 0;

  // Video block (if understand video exists)
  if (tutorial.understand_video_url && tutorial.understand_video_library_id) {
    blocks.push({
      id: `legacy-video-${tutorial.id}`,
      type: 'video',
      title: 'Understand',
      order: order++,
      showInIsland: true,
      config: {
        videoUrl: tutorial.understand_video_url,
        videoLibraryId: tutorial.understand_video_library_id,
        headline: tutorial.understand_headline,
        questions: tutorial.understand_questions,
        overlayTypes: ['QUIZ'],
      },
    });
  }

  // Exercise block (unlocked difficulties only)
  const LOCKED_DIFFICULTIES = ['advanced', 'hard', 'expert'];
  const unlockedExercises = exercises.filter(
    (ex) => !LOCKED_DIFFICULTIES.includes(safeDifficulty(ex.difficulty))
  );

  if (unlockedExercises.length > 0) {
    blocks.push({
      id: `legacy-exercise-${tutorial.id}`,
      type: 'exercise',
      title: 'Practice',
      order: order++,
      showInIsland: true,
      config: {
        exerciseIds: unlockedExercises.map((ex) =>
          typeof ex.id === 'object' ? ex.id.value : String(ex.id)
        ),
        requiredCompletions: 4,
        lockedDifficulties: LOCKED_DIFFICULTIES,
      },
    });
  }

  // Groove block (always present — the "Apply" act)
  const grooveExercise = exercises.find((ex) =>
    LOCKED_DIFFICULTIES.includes(safeDifficulty(ex.difficulty))
  );

  blocks.push({
    id: `legacy-groove-${tutorial.id}`,
    type: 'groove',
    title: 'Apply',
    order: order++,
    showInIsland: true,
    config: {
      youtubeUrl: tutorial.youtube_url,
      grooveExerciseId: grooveExercise
        ? typeof grooveExercise.id === 'object'
          ? grooveExercise.id.value
          : String(grooveExercise.id)
        : undefined,
      requiresPreviousCompletion: true,
    },
  });

  return blocks;
}
