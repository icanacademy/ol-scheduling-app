-- Create schedule templates table
CREATE TABLE IF NOT EXISTS schedule_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  schedule_days JSONB NOT NULL DEFAULT '[]', -- e.g., ["Monday", "Wednesday", "Friday"]
  time_slots JSONB NOT NULL DEFAULT '[]', -- e.g., [1, 2, 3, 4] (time slot IDs)
  template_type VARCHAR(50) DEFAULT 'custom', -- 'predefined', 'custom'
  color_keyword VARCHAR(50) DEFAULT 'blue',
  max_students INTEGER DEFAULT NULL, -- Maximum students per session
  created_by VARCHAR(100), -- User who created template
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create template assignments table (linking templates to actual schedules)
CREATE TABLE IF NOT EXISTS template_assignments (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  date DATE NOT NULL, -- Specific date this template is applied
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  students_count INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_schedule_templates_type ON schedule_templates(template_type);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_days ON schedule_templates USING GIN(schedule_days);
CREATE INDEX IF NOT EXISTS idx_schedule_templates_slots ON schedule_templates USING GIN(time_slots);
CREATE INDEX IF NOT EXISTS idx_template_assignments_template ON template_assignments(template_id);
CREATE INDEX IF NOT EXISTS idx_template_assignments_date ON template_assignments(date);

-- Insert predefined common templates
INSERT INTO schedule_templates (name, description, schedule_days, time_slots, template_type, color_keyword, max_students) VALUES
('MWF Morning', 'Monday, Wednesday, Friday morning classes', '["Monday", "Wednesday", "Friday"]', '[1, 2, 3, 4]', 'predefined', 'blue', 5),
('MWF Afternoon', 'Monday, Wednesday, Friday afternoon classes', '["Monday", "Wednesday", "Friday"]', '[9, 10, 11, 12]', 'predefined', 'green', 5),
('Tuesday/Thursday Morning', 'Tuesday and Thursday morning sessions', '["Tuesday", "Thursday"]', '[1, 2, 3, 4]', 'predefined', 'purple', 5),
('Tuesday/Thursday Afternoon', 'Tuesday and Thursday afternoon sessions', '["Tuesday", "Thursday"]', '[9, 10, 11, 12]', 'predefined', 'orange', 5),
('Saturday Intensive', 'Saturday full day intensive course', '["Saturday"]', '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]', 'predefined', 'red', 8),
('Weekday Evening', 'Monday to Friday evening classes', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]', '[11, 12]', 'predefined', 'yellow', 4),
('Weekend Morning', 'Saturday and Sunday morning classes', '["Saturday", "Sunday"]', '[1, 2, 3, 4]', 'predefined', 'pink', 6),
('Daily All Day', 'Every day full availability', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]', '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]', 'predefined', 'blue', 10);

-- Add template_id to students table for linking students to templates
ALTER TABLE students ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES schedule_templates(id) ON DELETE SET NULL;

-- Add index for template_id in students table
CREATE INDEX IF NOT EXISTS idx_students_template ON students(template_id);