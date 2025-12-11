-- Add schedule_days field to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS schedule_days JSONB DEFAULT '[]';

-- Add schedule_pattern field for display purposes
ALTER TABLE students ADD COLUMN IF NOT EXISTS schedule_pattern VARCHAR(100);

-- Add index for schedule_days for better performance
CREATE INDEX IF NOT EXISTS idx_students_schedule_days ON students USING GIN(schedule_days);

-- Example of how schedule_days will be stored:
-- ["Monday", "Wednesday", "Friday"] for MWF students
-- ["Tuesday", "Thursday"] for T/Th students
-- ["Saturday"] for once a week students
-- [] for students with no set schedule (manually scheduled)