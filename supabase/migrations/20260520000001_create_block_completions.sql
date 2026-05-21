-- New per-block completion table — replaces tutorial_progress.block_progress JSONB.
--
-- Why this exists: the previous design stored all block completions for a
-- (user, tutorial) pair as a single JSONB column. Every per-block write was
-- an UPSERT with `block_progress: { [blockId]: progress }`, which PostgREST
-- writes as a whole-column replace — silently clobbering all OTHER blocks'
-- completion data on the server. The data loss was masked by an in-browser
-- localStorage mirror, but it surfaced as inconsistent "everything unlocked"
-- behaviour across devices.
--
-- New design: one row per completion, primary-keyed on (user, tutorial, block).
-- Inserts are atomic and independent. Cross-device sync works. Aggregations
-- become trivial SQL.
--
-- The legacy tutorial_progress.block_progress JSONB column stays in place for
-- now — a later migration will backfill from it and then drop it once the
-- new write path is the only writer.

CREATE TABLE IF NOT EXISTS public.block_completions (
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tutorial_id   UUID        NOT NULL,
  block_id      TEXT        NOT NULL,
  completed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  data          JSONB,
  PRIMARY KEY (user_id, tutorial_id, block_id)
);

COMMENT ON TABLE public.block_completions IS
  'Per-block completion records. One row per (user, tutorial, block). '
  'Replaces the legacy tutorial_progress.block_progress JSONB.';
COMMENT ON COLUMN public.block_completions.block_id IS
  'TEXT because block ids live inside tutorials.blocks JSONB as string keys, '
  'not as UUIDs in a separate table.';
COMMENT ON COLUMN public.block_completions.data IS
  'Optional per-block payload (e.g. quiz score, answers, freeform notes).';

-- Index for the most common query: "all completions for this user+tutorial"
CREATE INDEX IF NOT EXISTS idx_block_completions_user_tutorial
  ON public.block_completions (user_id, tutorial_id);

-- RLS — same pattern as tutorial_progress / practice_progress.
ALTER TABLE public.block_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own block completions"
  ON public.block_completions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own block completions"
  ON public.block_completions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- DELETE allowed so users (or admin tooling) can reset a single block's
-- completion without nuking the whole tutorial. No UPDATE policy — the row
-- is intentionally append-only; if a payload needs to change, delete + insert.
CREATE POLICY "Users can delete their own block completions"
  ON public.block_completions FOR DELETE
  USING (auth.uid() = user_id);
