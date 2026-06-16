-- Bass Gym Training Engine — Phase 2 DEV SEED: the "SPEED scales" MVP goal.
--
-- Seeds ONE self-contained SPEED goal so the engine has content to plan from
-- (the first clickable climb). The goal's block_set embeds a `task` block
-- INLINE (no audio, no groove_library / stem dependency) so it works on the
-- EMPTY staging database — the spec's stub-widget validation path. The student
-- reads "play C major scale at {tempo} BPM"; generateRep interpolates the
-- per-level tempo into the {tempo} token (no playback engine needed).
--
-- THROWAWAY: this is replaced by real admin authoring in Phase 5. It is written
-- idempotently (ON CONFLICT DO NOTHING / guarded DO block) so re-running it —
-- and running it across staging (empty) + prod (has users) — is safe:
--   * The GOAL seeds unconditionally (no user dependency).
--   * The ENROLLMENT + CLIMB_STATE seed ONLY IF an admin profile exists
--     (skipped silently on empty staging; enrolls the first admin on prod).
--     This avoids hard-coding a user id that exists in one env but not the
--     other (local→prod has users; staging is empty — see CLAUDE.md).

-- ── 1. The goal (self-contained; embeds the task block inline in block_set) ──
INSERT INTO public.training_goals (
  slug, type, title, description, target, assessment_config, block_set,
  prerequisites, day30_milestone, fork_config, is_active
) VALUES (
  'speed-c-major-scale',
  'speed',
  'Speed: C Major Scale',
  'Get your C major scale fast and clean. The coach brackets each day around '
    'your current tempo and nudges it up as you lock it in.',
  '{"tempoBpm": 120}'::jsonb,
  '{"kind": "tempo", "prompt": "Push to the fastest tempo you can play C major clean + relaxed."}'::jsonb,
  -- block_set: ONE focal task block, embedded inline under `block` so the
  -- backend resolveBlockPool() needs no content lookup (works on empty staging).
  '[
    {
      "blockId": "speed-c-major-scale-focal",
      "ladderPosition": "L2",
      "block": {
        "id": "speed-c-major-scale-focal",
        "type": "task",
        "title": "C Major Scale",
        "order": 0,
        "tempoRange": { "min": 60, "max": 160 },
        "config": {
          "heading": "C Major Scale",
          "instruction": "Play the C major scale (two octaves, up and down) at {tempo} BPM. Keep it even and relaxed — no rushing.",
          "completionCriterion": { "type": "time", "target": 2 }
        }
      }
    }
  ]'::jsonb,
  '[]'::jsonb,
  '{"summary": "How much faster did your C major scale get this month?"}'::jsonb,
  '{"goDeeper": "raise the tempo target", "lockItIn": "hold + make it automatic", "switchLanes": "a new topic"}'::jsonb,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ── 2. Enrollment + climb_state for the first admin (prod), skipped if empty ──
DO $$
DECLARE
  v_goal_id    UUID;
  v_user_id    UUID;
  v_enroll_id  UUID;
  v_start_bpm  INTEGER := 90;   -- a gentle starting tempo (placement would set this for real)
BEGIN
  SELECT id INTO v_goal_id
    FROM public.training_goals
   WHERE slug = 'speed-c-major-scale';

  -- Pick the first admin profile; fall back to any profile. NULL on empty DB.
  SELECT id INTO v_user_id
    FROM public.profiles
   ORDER BY (role = 'admin') DESC, created_at ASC
   LIMIT 1;

  IF v_goal_id IS NULL OR v_user_id IS NULL THEN
    RAISE NOTICE 'speed-scales seed: no profile to enroll (empty DB) — goal seeded, enrollment skipped.';
    RETURN;
  END IF;

  -- Enrollment (idempotent on the UNIQUE(user_id, goal_id)). goal_snapshot is a
  -- deep copy of the climb-relevant goal fields, frozen at enroll time.
  INSERT INTO public.goal_enrollments (user_id, goal_id, status, goal_snapshot, placement)
  SELECT
    v_user_id,
    v_goal_id,
    'active',
    jsonb_build_object(
      'type',            g.type,
      'target',          g.target,
      'blockSet',        g.block_set,
      'assessmentConfig',g.assessment_config,
      'day30Milestone',  g.day30_milestone,
      'forkConfig',      g.fork_config
    ),
    jsonb_build_object('startTempoBpm', v_start_bpm)
  FROM public.training_goals g
  WHERE g.id = v_goal_id
  ON CONFLICT (user_id, goal_id) DO NOTHING;

  SELECT id INTO v_enroll_id
    FROM public.goal_enrollments
   WHERE user_id = v_user_id AND goal_id = v_goal_id;

  -- Climb state (one row per enrollment). current_position is the rep-driven
  -- spot on the climb; generateRep brackets L1/L2/L3 around tempoBpm.
  INSERT INTO public.climb_states (goal_enrollment_id, user_id, current_position, difficulty_scalar)
  VALUES (v_enroll_id, v_user_id, jsonb_build_object('tempoBpm', v_start_bpm), 1.0)
  ON CONFLICT (goal_enrollment_id) DO NOTHING;

  RAISE NOTICE 'speed-scales seed: enrolled user % into goal %.', v_user_id, v_goal_id;
END $$;
