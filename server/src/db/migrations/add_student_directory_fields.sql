-- Migration: Add fields for Student Directory feature

-- Add country field
ALTER TABLE students ADD COLUMN IF NOT EXISTS country VARCHAR(100);

-- Add status field (New, Active, On Hold, Finished)
ALTER TABLE students ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'Active';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_students_country ON students(country);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
