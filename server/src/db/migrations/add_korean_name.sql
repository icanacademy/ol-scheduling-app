-- Add korean_name field to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS korean_name VARCHAR(100);

-- Add comment explaining the field
COMMENT ON COLUMN students.korean_name IS 'Korean name (한글) of the student';
