-- Add subjects field to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]';

-- Add index for subjects for better performance
CREATE INDEX IF NOT EXISTS idx_students_subjects ON students USING GIN(subjects);

-- Example of how subjects will be stored:
-- ["Basic ESL (Listening, Grammar, Vocabulary, Writing)", "Elementary TED", "SAT Practice"]
-- Empty array [] for students with no subjects selected