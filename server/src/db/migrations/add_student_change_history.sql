-- Create student change history table
CREATE TABLE IF NOT EXISTS student_change_history (
  id SERIAL PRIMARY KEY,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  change_type VARCHAR(50) NOT NULL, -- 'teacher_change', 'time_change', 'day_change', 'subject_change', 'other'
  change_date DATE NOT NULL,
  change_description TEXT NOT NULL,
  
  -- Old values
  old_teacher_names TEXT[], -- Array of teacher names
  old_time_slot VARCHAR(50),
  old_days TEXT[], -- Array of day names
  old_subject VARCHAR(100),
  
  -- New values
  new_teacher_names TEXT[], -- Array of teacher names
  new_time_slot VARCHAR(50),
  new_days TEXT[], -- Array of day names
  new_subject VARCHAR(100),
  
  -- Additional info
  reason TEXT,
  notes TEXT,
  recorded_by VARCHAR(100), -- Who recorded this change (could be 'system' or username)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_student_change_history_student_id ON student_change_history(student_id);
CREATE INDEX IF NOT EXISTS idx_student_change_history_change_date ON student_change_history(change_date);
CREATE INDEX IF NOT EXISTS idx_student_change_history_change_type ON student_change_history(change_type);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_student_change_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_student_change_history_updated_at_trigger
BEFORE UPDATE ON student_change_history
FOR EACH ROW
EXECUTE FUNCTION update_student_change_history_updated_at();