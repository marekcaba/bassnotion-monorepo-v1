-- Bass Gym Training Engine — Treadmill epic Story 3: put a BAND in the rep.
--
-- The Phase-2 dev seed (20260613000003) made the daily rep a TEXT `task` block
-- ("play C major scale at {tempo} BPM") so it worked on empty staging with no
-- audio dependency. That made the rep silent — the "play along with a band /
-- the pocket locks" payoff was impossible. This migration swaps the focal block
-- to a real `groove-card` (audio) block, pointing at the proven-playable
-- `economy-groove-1` stems (the same groove the marketing waitlist uses), with
-- the stems embedded INLINE so it still needs no groove_library row on staging.
--
-- The engine's generateRep already sets config.tempoOverride per ladder level;
-- the groove-card view now honors that override on the inline path too (see the
-- GrooveCardBlockView change in this PR), so the band SPEEDS UP with the climb
-- (Story 2). tempoRange [60,160] clamps the climb to the groove's musical band.
--
-- Idempotent: matched by slug; re-running overwrites the same block_set. Also
-- RE-SYNCS the frozen blockSet inside any existing enrollment snapshot for this
-- goal — the snapshot is frozen at enroll time, so without this an already
-- enrolled user (e.g. the seeded admin) would keep planning the old text task.

DO $$
DECLARE
  v_block_set JSONB := '[
    {
      "blockId": "speed-c-major-scale-focal",
      "ladderPosition": "L2",
      "block": {
        "id": "speed-c-major-scale-focal",
        "type": "groove-card",
        "title": "Lock the Groove",
        "order": 0,
        "tempoRange": { "min": 60, "max": 160 },
        "config": {
          "title": "Economy Groove 1",
          "subtitle": "Lock into the pocket",
          "originalBpm": 133,
          "originalKey": "E",
          "lengthBars": 8,
          "role": "groove",
          "stems": {
            "bass": "https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/grooves/economy-groove-1/e/bass.ogg",
            "drums": "https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/grooves/economy-groove-1/e/drums.ogg",
            "harmony": "https://iuuplfrktnzsbzibpfjm.supabase.co/storage/v1/object/public/audio-samples/grooves/economy-groove-1/e/harmony.ogg"
          },
          "completionCriterion": { "type": "time", "target": 2 }
        }
      }
    }
  ]'::jsonb;
  v_goal_id UUID;
BEGIN
  SELECT id INTO v_goal_id
    FROM public.training_goals
   WHERE slug = 'speed-c-major-scale';

  IF v_goal_id IS NULL THEN
    RAISE NOTICE 'swap-speed-goal-to-groove: goal not found — nothing to do.';
    RETURN;
  END IF;

  -- 1. The goal template: new block_set + copy that matches a groove (not a scale).
  UPDATE public.training_goals
     SET block_set = v_block_set,
         title = 'Lock the Pocket',
         description = 'Lock into a real groove. The coach brackets each day '
           'around your current tempo and nudges it up as you settle into the '
           'pocket.',
         assessment_config = '{"kind": "tempo", "prompt": "Push to the fastest tempo you can stay locked in the pocket — clean + relaxed."}'::jsonb,
         day30_milestone = '{"summary": "How much faster is your pocket this month?"}'::jsonb,
         updated_at = NOW()
   WHERE id = v_goal_id;

  -- 2. Re-sync the frozen blockSet inside existing enrollment snapshots for this
  --    goal (the snapshot froze the OLD text task at enroll time).
  UPDATE public.goal_enrollments
     SET goal_snapshot = jsonb_set(goal_snapshot, '{blockSet}', v_block_set, true),
         updated_at = NOW()
   WHERE goal_id = v_goal_id;

  RAISE NOTICE 'swap-speed-goal-to-groove: goal % now plays a groove-card rep.', v_goal_id;
END $$;
