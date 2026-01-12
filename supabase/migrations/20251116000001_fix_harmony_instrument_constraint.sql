-- Migration: Fix harmony_instrument constraint to include grandpiano
-- Story: Story 5.1 - Professional Bass Instrument Epic
-- Date: 2025-11-16
-- Issue: The chk_harmony_instrument constraint was missing 'grandpiano' which is a valid instrument type

-- Drop the existing constraint
ALTER TABLE exercises
DROP CONSTRAINT IF EXISTS chk_harmony_instrument;

-- Add updated constraint with grandpiano included
ALTER TABLE exercises
ADD CONSTRAINT chk_harmony_instrument
CHECK (harmony_instrument IN ('salamander', 'grandpiano', 'rhodes', 'wurlitzer', 'pad') OR harmony_instrument IS NULL);

-- Update column comment to reflect all valid instruments
COMMENT ON COLUMN exercises.harmony_instrument IS 'Default harmony instrument for this exercise. Valid values: salamander (Salamander Grand Piano - 16 layers), grandpiano (Grand Piano - 7 layers), rhodes (Fender Rhodes), wurlitzer (Wurlitzer Electric Piano), pad (Synth Pad)';
