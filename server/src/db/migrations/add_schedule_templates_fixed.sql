-- Create schedule templates table
CREATE TABLE IF NOT EXISTS schedule_templates (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  schedule_days JSONB NOT NULL DEFAULT '[]',
  time_slots JSONB NOT NULL DEFAULT '[]', 
  template_type VARCHAR(50) DEFAULT 'custom',
  color_keyword VARCHAR(50) DEFAULT 'blue',
  max_students INTEGER DEFAULT NULL,
  created_by VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create template assignments table
CREATE TABLE IF NOT EXISTS template_assignments (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  room_id INTEGER REFERENCES rooms(id) ON DELETE SET NULL,
  students_count INTEGER DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);