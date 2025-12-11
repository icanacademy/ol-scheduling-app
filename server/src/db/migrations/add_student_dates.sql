-- Add first start date to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS first_start_date DATE;

-- Add implementation date to student change history table
ALTER TABLE student_change_history ADD COLUMN IF NOT EXISTS implementation_date DATE;

-- Add comment to clarify the difference between change_date and implementation_date
COMMENT ON COLUMN student_change_history.change_date IS 'The date when the change decision was made or recorded';
COMMENT ON COLUMN student_change_history.implementation_date IS 'The actual date when the change takes effect/was implemented';

-- Add index for better query performance on the new fields
CREATE INDEX IF NOT EXISTS idx_students_first_start_date ON students(first_start_date);
CREATE INDEX IF NOT EXISTS idx_student_change_history_implementation_date ON student_change_history(implementation_date);