-- Migration: Remove salamander instrument, migrate to grandpiano
-- Date: 2025-11-17
-- Issue: Salamander is legacy, Grand Piano is the new default piano instrument

-- Step 1: Update all existing exercises using salamander to use grandpiano instead
UPDATE exercises
SET harmony_instrument = 'grandpiano'
WHERE harmony_instrument = 'salamander';

-- Step 2: Drop the existing constraint
ALTER TABLE exercises
DROP CONSTRAINT IF EXISTS chk_harmony_instrument;

-- Step 3: Add updated constraint without salamander
ALTER TABLE exercises
ADD CONSTRAINT chk_harmony_instrument
CHECK (harmony_instrument IN ('grandpiano', 'rhodes', 'wurlitzer', 'pad') OR harmony_instrument IS NULL);

-- Step 4: Update column comment to reflect valid instruments (without salamander)
COMMENT ON COLUMN exercises.harmony_instrument IS 'Default harmony instrument for this exercise. Valid values: grandpiano (Grand Piano - 7 layers), rhodes (Fender Rhodes), wurlitzer (Wurlitzer Electric Piano), pad (Synth Pad)';
