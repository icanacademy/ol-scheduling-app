-- Migration: Add date column to notes table for per-day tracking

ALTER TABLE notes ADD COLUMN IF NOT EXISTS date DATE;

-- Create index for date filtering
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);

-- Update existing notes to have today's date (optional - they'll show as undated)
-- UPDATE notes SET date = CURRENT_DATE WHERE date IS NULL;
