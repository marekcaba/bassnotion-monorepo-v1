-- ============================================================================
-- Repair: speed-c-major-scale got saved as a MULTI-TOPIC goal with empty stages
-- (a half-authored test edit in the admin UI), which 500s the gym at plan time
-- (generateRep topic path → no playable blocks). The goal still has its valid
-- single-focal block_set (from 20260616000001); the stray empty `topics` array
-- just shadows it (the engine prefers topics when present).
--
-- Fix = clear the empty topics so the goal falls back to its single-focal
-- block_set. Only clears topics that are EMPTY (no stage has a block), so a
-- properly-authored multi-topic goal is never clobbered. Idempotent.
--
-- (The real prevention is the admin validateTopics guard shipped alongside this —
-- this just cleans the one row that predates it.)
-- ============================================================================

UPDATE public.training_goals AS g
   SET topics = '[]'::jsonb,
       updated_at = NOW()
 WHERE g.slug = 'speed-c-major-scale'
   AND jsonb_typeof(g.topics) = 'array'
   AND jsonb_array_length(g.topics) > 0
   -- only when NO topic has any stage with a non-null inline block (i.e. the
   -- topics are unplayable). Guards against clobbering a real multi-topic goal.
   AND NOT EXISTS (
     SELECT 1
       FROM jsonb_array_elements(g.topics) AS topic
       CROSS JOIN LATERAL jsonb_array_elements(
         COALESCE(topic->'stages', '[]'::jsonb)
       ) AS stage
       CROSS JOIN LATERAL jsonb_array_elements(
         COALESCE(stage->'blocks', '[]'::jsonb)
       ) AS blk
      WHERE blk ? 'block' AND jsonb_typeof(blk->'block') = 'object'
   );
