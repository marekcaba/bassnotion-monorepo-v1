-- Migration: take_results.playback_context — the RECONSTRUCTION recipe for a take.
-- Date: 2026-06-29
--
-- A submitted take stores ONLY the student's bass audio (a tiny mono Opus clip). To replay it
-- "in context" months later — with the same click / drone / drum backing the student heard while
-- recording — we don't store that backing audio (it's large + reconstructable). Instead we snapshot
-- WHAT TO LOAD: the exercise, key, tempo, loop count, fretboard position, string count, and which
-- backing groove. The history player rebuilds the backing deterministically from this and plays it
-- under the stored bass clip.
--
-- JSONB (not columns) because the recipe shape will grow (per-station backing kinds: metronome-only,
-- drone, drum loop, full stems) and we don't want a migration per field. The grade/stat columns stay
-- typed (they're queried for trends); the playback recipe is opaque load-instructions.

ALTER TABLE public.take_results
  ADD COLUMN IF NOT EXISTS playback_context JSONB;

COMMENT ON COLUMN public.take_results.playback_context IS
  'Reconstruction recipe for replaying this take in context (no backing audio stored): '
  '{ exerciseId, scaleKey, tempoBpm, recordLoops, position, stringCount, backingId, station }. '
  'The history player rebuilds the click/drone/drums backing from this under the stored bass clip.';
