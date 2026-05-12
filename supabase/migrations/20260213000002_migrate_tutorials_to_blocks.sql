-- Migrate existing tutorials from act-specific columns to blocks array.
-- This converts the fixed 3-act structure to the modular block format.

-- Step 1: Build blocks array for each tutorial
UPDATE public.tutorials t
SET blocks = (
  SELECT COALESCE(jsonb_agg(block ORDER BY block_order), '[]'::jsonb)
  FROM (
    -- Video block (Act 1: Understand) — only if video is configured
    SELECT
      1 AS block_order,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'video',
        'title', 'Understand',
        'order', 0,
        'config', jsonb_build_object(
          'videoUrl', COALESCE(t.understand_video_url, ''),
          'videoLibraryId', COALESCE(t.understand_video_library_id, ''),
          'headline', t.understand_headline,
          'questions', COALESCE(t.understand_questions, '[]'::jsonb),
          'overlayTypes', '["QUIZ"]'::jsonb
        )
      ) AS block
    WHERE t.understand_video_url IS NOT NULL
      AND t.understand_video_url != ''

    UNION ALL

    -- Exercise block (Act 2: Practice) — always present
    SELECT
      2 AS block_order,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'exercise',
        'title', 'Practice',
        'order', CASE
          WHEN t.understand_video_url IS NOT NULL AND t.understand_video_url != '' THEN 1
          ELSE 0
        END,
        'config', jsonb_build_object(
          'exerciseIds', COALESCE(
            (
              SELECT jsonb_agg(e.id::text ORDER BY e.created_at)
              FROM exercises e
              WHERE e.tutorial_id = t.id
                AND COALESCE(e.difficulty::text, 'beginner') NOT IN ('advanced', 'hard', 'expert')
            ),
            '[]'::jsonb
          ),
          'requiredCompletions', 4,
          'lockedDifficulties', '["advanced", "hard", "expert"]'::jsonb
        )
      ) AS block

    UNION ALL

    -- Groove block (Act 3: Apply) — always present
    SELECT
      3 AS block_order,
      jsonb_build_object(
        'id', gen_random_uuid()::text,
        'type', 'groove',
        'title', 'Apply',
        'order', CASE
          WHEN t.understand_video_url IS NOT NULL AND t.understand_video_url != '' THEN 2
          ELSE 1
        END,
        'config', jsonb_build_object(
          'youtubeUrl', t.youtube_url,
          'grooveExerciseId', (
            SELECT e.id::text
            FROM exercises e
            WHERE e.tutorial_id = t.id
              AND COALESCE(e.difficulty::text, 'beginner') IN ('advanced', 'hard', 'expert')
            ORDER BY e.created_at
            LIMIT 1
          ),
          'requiresPreviousCompletion', true
        )
      ) AS block
  ) sub
)
WHERE t.blocks = '[]'::jsonb OR t.blocks IS NULL;

-- Step 2: Migrate tutorial_progress understood/applied → block_progress
-- For users who have progress, convert their boolean flags into block-level progress
UPDATE public.tutorial_progress tp
SET block_progress = (
  SELECT COALESCE(jsonb_object_agg(sub.block_id, sub.progress_data), '{}'::jsonb)
  FROM (
    -- Map "understood" → first video block
    SELECT
      (tut.blocks->0->>'id') AS block_id,
      jsonb_build_object(
        'blockId', tut.blocks->0->>'id',
        'completed', true,
        'completedAt', tp.understood_at
      ) AS progress_data
    FROM tutorials tut
    WHERE tut.id = tp.tutorial_id
      AND tut.blocks->0->>'type' = 'video'
      AND tp.understood = true

    UNION ALL

    -- Map "applied" → last groove block
    SELECT
      (tut.blocks->(jsonb_array_length(tut.blocks) - 1)->>'id') AS block_id,
      jsonb_build_object(
        'blockId', tut.blocks->(jsonb_array_length(tut.blocks) - 1)->>'id',
        'completed', true,
        'completedAt', tp.applied_at
      ) AS progress_data
    FROM tutorials tut
    WHERE tut.id = tp.tutorial_id
      AND jsonb_array_length(tut.blocks) > 0
      AND tut.blocks->(jsonb_array_length(tut.blocks) - 1)->>'type' = 'groove'
      AND tp.applied = true
  ) sub
  WHERE sub.block_id IS NOT NULL
)
WHERE (tp.understood = true OR tp.applied = true)
  AND (tp.block_progress = '{}'::jsonb OR tp.block_progress IS NULL);
