-- Drop the old subjects column and add new subject column
ALTER TABLE students DROP COLUMN IF EXISTS subjects;
ALTER TABLE students ADD COLUMN IF NOT EXISTS subject VARCHAR(200);

-- Drop the old index
DROP INDEX IF EXISTS idx_students_subjects;

-- Add index for subject for better performance
CREATE INDEX IF NOT EXISTS idx_students_subject ON students(subject);