-- Drop existing tables if they exist (for development)
DROP TABLE IF EXISTS assignment_students CASCADE;
DROP TABLE IF EXISTS assignment_teachers CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS teachers CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;
DROP TABLE IF EXISTS time_slots CASCADE;

-- Time Slots Table
CREATE TABLE time_slots (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  display_order INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rooms Table
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_order INTEGER NOT NULL,
  max_teachers INTEGER DEFAULT 2,
  max_students INTEGER DEFAULT 5,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Teachers Table
CREATE TABLE teachers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  availability JSONB NOT NULL DEFAULT '[]', -- Array of time_slot_ids
  color_keyword VARCHAR(50), -- For color-based filtering (red, blue, green, etc.)
  date DATE NOT NULL, -- Date-specific teachers
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Students Table
CREATE TABLE students (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  english_name VARCHAR(100),
  availability JSONB NOT NULL DEFAULT '[]', -- Array of time_slot_ids
  color_keyword VARCHAR(50), -- For color-based filtering (blue, red, etc.)
  weakness_level INTEGER CHECK (weakness_level >= 0 AND weakness_level <= 10),
  teacher_notes TEXT,
  date DATE NOT NULL, -- Date-specific students
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  -- Program Details
  school TEXT,
  program_start_date DATE,
  program_end_date DATE,
  -- Student Information
  student_id VARCHAR(50),
  gender VARCHAR(20),
  grade VARCHAR(20),
  student_type VARCHAR(50),
  -- Level Test Scores
  reading_score INTEGER,
  grammar_score INTEGER,
  listening_score INTEGER,
  writing_score INTEGER,
  level_test_total INTEGER,
  -- Reading Level Initial
  wpm_initial INTEGER,
  gbwt_initial INTEGER,
  reading_level_initial VARCHAR(20),
  -- Interview Score
  interview_score INTEGER
);

-- Assignments Table (Main schedule)
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  time_slot_id INTEGER NOT NULL REFERENCES time_slots(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true
  -- Note: Unique constraint is added as partial index below to support soft deletes
);

-- Assignment Teachers Table (Many-to-many with substitute flag)
CREATE TABLE assignment_teachers (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  teacher_id INTEGER NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  is_substitute BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id, teacher_id)
);

-- Assignment Students Table (Many-to-many with submission tracking)
CREATE TABLE assignment_students (
  id SERIAL PRIMARY KEY,
  assignment_id INTEGER NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  submission_id VARCHAR(100), -- Track duplicate submissions
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(assignment_id, student_id)
);

-- Indexes for better performance
CREATE INDEX idx_assignments_date ON assignments(date);
CREATE INDEX idx_assignments_time_slot ON assignments(time_slot_id);
CREATE INDEX idx_assignments_room ON assignments(room_id);
CREATE INDEX idx_teachers_availability ON teachers USING GIN(availability);
CREATE INDEX idx_students_availability ON students USING GIN(availability);
CREATE INDEX idx_students_color ON students(color_keyword);
CREATE INDEX idx_assignment_teachers_assignment ON assignment_teachers(assignment_id);
CREATE INDEX idx_assignment_teachers_teacher ON assignment_teachers(teacher_id);
CREATE INDEX idx_assignment_students_assignment ON assignment_students(assignment_id);
CREATE INDEX idx_assignment_students_student ON assignment_students(student_id);

-- Partial unique index for assignments (only active assignments must be unique)
-- This allows soft-deleted assignments without blocking new assignments
CREATE UNIQUE INDEX assignments_date_time_slot_id_room_id_active_key
ON assignments (date, time_slot_id, room_id)
WHERE is_active = true;

-- Insert default time slots (30-minute blocks from 8AM to 10PM)
INSERT INTO time_slots (name, start_time, end_time, display_order) VALUES
  ('8:00 - 8:30', '08:00:00', '08:30:00', 1),
  ('8:30 - 9:00', '08:30:00', '09:00:00', 2),
  ('9:00 - 9:30', '09:00:00', '09:30:00', 3),
  ('9:30 - 10:00', '09:30:00', '10:00:00', 4),
  ('10:00 - 10:30', '10:00:00', '10:30:00', 5),
  ('10:30 - 11:00', '10:30:00', '11:00:00', 6),
  ('11:00 - 11:30', '11:00:00', '11:30:00', 7),
  ('11:30 - 12:00', '11:30:00', '12:00:00', 8),
  ('12:00 - 12:30', '12:00:00', '12:30:00', 9),
  ('12:30 - 1:00', '12:30:00', '13:00:00', 10),
  ('1:00 - 1:30', '13:00:00', '13:30:00', 11),
  ('1:30 - 2:00', '13:30:00', '14:00:00', 12),
  ('2:00 - 2:30', '14:00:00', '14:30:00', 13),
  ('2:30 - 3:00', '14:30:00', '15:00:00', 14),
  ('3:00 - 3:30', '15:00:00', '15:30:00', 15),
  ('3:30 - 4:00', '15:30:00', '16:00:00', 16),
  ('4:00 - 4:30', '16:00:00', '16:30:00', 17),
  ('4:30 - 5:00', '16:30:00', '17:00:00', 18),
  ('5:00 - 5:30', '17:00:00', '17:30:00', 19),
  ('5:30 - 6:00', '17:30:00', '18:00:00', 20),
  ('6:00 - 6:30', '18:00:00', '18:30:00', 21),
  ('6:30 - 7:00', '18:30:00', '19:00:00', 22),
  ('7:00 - 7:30', '19:00:00', '19:30:00', 23),
  ('7:30 - 8:00', '19:30:00', '20:00:00', 24),
  ('8:00 - 8:30 PM', '20:00:00', '20:30:00', 25),
  ('8:30 - 9:00 PM', '20:30:00', '21:00:00', 26),
  ('9:00 - 9:30 PM', '21:00:00', '21:30:00', 27),
  ('9:30 - 10:00 PM', '21:30:00', '22:00:00', 28);

-- Insert rooms
INSERT INTO rooms (name, display_order) VALUES
  ('1', 1), ('2', 2), ('3', 3), ('4', 4), ('5', 5),
  ('6', 6), ('7', 7), ('8', 8), ('9', 9), ('10', 10),
  ('11', 11), ('12', 12), ('13', 13), ('14', 14), ('15', 15),
  ('16', 16), ('17', 17), ('18', 18), ('19', 19), ('20', 20),
  ('21', 21), ('22', 22), ('23', 23), ('24', 24), ('25', 25),
  ('26', 26), ('27', 27), ('28', 28), ('29', 29), ('30', 30),
  ('31', 31), ('32', 32), ('33', 33), ('34', 34), ('35', 35),
  ('36', 36), ('37', 37),
  ('A1-1', 38), ('A1-2', 39), ('A2-1', 40), ('A2-2', 41),
  ('A3-1', 42), ('A3-2', 43), ('A4', 44), ('A5', 45),
  ('C1', 46), ('C2', 47),
  ('X1', 48), ('X2', 49), ('X3', 50), ('X4', 51), ('X5', 52),
  ('X6', 53), ('X7', 54), ('X8', 55), ('X9', 56), ('X10', 57);

-- Backup Metadata Table (for tracking backups)
CREATE TABLE IF NOT EXISTS backup_metadata (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  teachers_count INTEGER,
  students_count INTEGER,
  assignments_count INTEGER,
  description TEXT,
  file_size_bytes BIGINT,
  backup_data TEXT  -- JSON string containing full database backup data (for serverless)
);
