-- Chord charts for groove library entries.
--
-- A groove can carry a SPARSE chord chart: chord symbols anchored to bar +
-- eighth-note slot, placed only where the harmony CHANGES (the chord holds
-- until the next entry). The player shows these as they play along, the chart
-- aligned to the groove's bar grid with the current chord highlighted.
--
-- Stored as JSONB (like `stems`) — an array of { bar, slot, symbol }:
--   bar    1-based bar number (1..length_bars)
--   slot   0..7 eighth-note position in the bar (0 = beat 1, 4/4 assumed)
--   symbol the chord, verbatim (e.g. "A7", "Dm7b5")
--
-- Chords live on the LIBRARY entity (not the per-block config) so a groove's
-- harmony is authored once and reused by every drill that references it.

ALTER TABLE public.groove_library
  ADD COLUMN IF NOT EXISTS chord_chart JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.groove_library.chord_chart IS
  'Sparse chord chart: array of { bar (1-based), slot (0..7 eighth-note), symbol }. Empty = no chart.';
