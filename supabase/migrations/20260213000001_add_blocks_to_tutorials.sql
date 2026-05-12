-- Add blocks JSONB column to tutorials table for modular tutorial structure
ALTER TABLE public.tutorials
  ADD COLUMN IF NOT EXISTS blocks JSONB DEFAULT '[]'::jsonb;

-- GIN index for block type queries (admin filtering by block type)
CREATE INDEX IF NOT EXISTS idx_tutorials_blocks_gin
  ON public.tutorials USING gin (blocks);

-- Add per-block progress tracking to tutorial_progress
ALTER TABLE public.tutorial_progress
  ADD COLUMN IF NOT EXISTS block_progress JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_accessed_block_id TEXT;

COMMENT ON COLUMN public.tutorials.blocks IS
  'Ordered array of lesson blocks. Each block has: id, type, title, config, order.';
COMMENT ON COLUMN public.tutorial_progress.block_progress IS
  'Per-block completion data: { blockId: { completed, completedAt, data } }';
