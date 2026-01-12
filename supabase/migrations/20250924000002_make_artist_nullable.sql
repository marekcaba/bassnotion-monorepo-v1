-- Fix: Make artist column nullable for new tutorial creation flow
-- The artist column is from the old schema and blocks new tutorial creation

ALTER TABLE tutorials
ALTER COLUMN artist DROP NOT NULL;