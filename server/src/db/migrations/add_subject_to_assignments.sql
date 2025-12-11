-- Add subject field to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS subject VARCHAR(100);

-- Add index for better search performance
CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject);