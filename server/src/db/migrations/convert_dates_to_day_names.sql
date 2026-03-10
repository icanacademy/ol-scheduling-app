-- Migration: Convert date columns from DATE type to VARCHAR day names
-- Tables affected: teachers, students, assignments, notes
-- Maps: 2024-01-01→Monday, 2024-01-02→Tuesday, ..., 2024-01-07→Sunday

-- Step 1: Drop existing indexes on date columns (if any)
DROP INDEX IF EXISTS idx_teachers_date;
DROP INDEX IF EXISTS idx_students_date;
DROP INDEX IF EXISTS idx_assignments_date;
DROP INDEX IF EXISTS idx_notes_date;
DROP INDEX IF EXISTS idx_assignments_date_timeslot;

-- Step 2: ALTER columns from DATE to VARCHAR(10)
-- Teachers
ALTER TABLE teachers ALTER COLUMN date TYPE VARCHAR(10) USING date::text;

-- Students
ALTER TABLE students ALTER COLUMN date TYPE VARCHAR(10) USING date::text;

-- Assignments
ALTER TABLE assignments ALTER COLUMN date TYPE VARCHAR(10) USING date::text;

-- Notes (may not exist in all environments)
DO $$ BEGIN
  ALTER TABLE notes ALTER COLUMN date TYPE VARCHAR(10) USING date::text;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Step 3: UPDATE existing data - map fixed dates to day names
UPDATE teachers SET date = CASE date
  WHEN '2024-01-01' THEN 'Monday'
  WHEN '2024-01-02' THEN 'Tuesday'
  WHEN '2024-01-03' THEN 'Wednesday'
  WHEN '2024-01-04' THEN 'Thursday'
  WHEN '2024-01-05' THEN 'Friday'
  WHEN '2024-01-06' THEN 'Saturday'
  WHEN '2024-01-07' THEN 'Sunday'
  ELSE date
END WHERE date IS NOT NULL;

UPDATE students SET date = CASE date
  WHEN '2024-01-01' THEN 'Monday'
  WHEN '2024-01-02' THEN 'Tuesday'
  WHEN '2024-01-03' THEN 'Wednesday'
  WHEN '2024-01-04' THEN 'Thursday'
  WHEN '2024-01-05' THEN 'Friday'
  WHEN '2024-01-06' THEN 'Saturday'
  WHEN '2024-01-07' THEN 'Sunday'
  ELSE date
END WHERE date IS NOT NULL;

UPDATE assignments SET date = CASE date
  WHEN '2024-01-01' THEN 'Monday'
  WHEN '2024-01-02' THEN 'Tuesday'
  WHEN '2024-01-03' THEN 'Wednesday'
  WHEN '2024-01-04' THEN 'Thursday'
  WHEN '2024-01-05' THEN 'Friday'
  WHEN '2024-01-06' THEN 'Saturday'
  WHEN '2024-01-07' THEN 'Sunday'
  ELSE date
END WHERE date IS NOT NULL;

DO $$ BEGIN
  UPDATE notes SET date = CASE date
    WHEN '2024-01-01' THEN 'Monday'
    WHEN '2024-01-02' THEN 'Tuesday'
    WHEN '2024-01-03' THEN 'Wednesday'
    WHEN '2024-01-04' THEN 'Thursday'
    WHEN '2024-01-05' THEN 'Friday'
    WHEN '2024-01-06' THEN 'Saturday'
    WHEN '2024-01-07' THEN 'Sunday'
    ELSE date
  END WHERE date IS NOT NULL;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- Step 3b: Convert any other date formats (real dates) to day names
UPDATE teachers SET date = CASE EXTRACT(DOW FROM date::date)
  WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
  WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
  WHEN 6 THEN 'Saturday'
END WHERE date NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') AND date IS NOT NULL AND date ~ '^\d{4}-\d{2}-\d{2}$';

UPDATE students SET date = CASE EXTRACT(DOW FROM date::date)
  WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
  WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
  WHEN 6 THEN 'Saturday'
END WHERE date NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') AND date IS NOT NULL AND date ~ '^\d{4}-\d{2}-\d{2}$';

UPDATE assignments SET date = CASE EXTRACT(DOW FROM date::date)
  WHEN 0 THEN 'Sunday' WHEN 1 THEN 'Monday' WHEN 2 THEN 'Tuesday'
  WHEN 3 THEN 'Wednesday' WHEN 4 THEN 'Thursday' WHEN 5 THEN 'Friday'
  WHEN 6 THEN 'Saturday'
END WHERE date NOT IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday') AND date IS NOT NULL AND date ~ '^\d{4}-\d{2}-\d{2}$';

-- Step 4: Recreate indexes
CREATE INDEX idx_teachers_date ON teachers(date);
CREATE INDEX idx_students_date ON students(date);
CREATE INDEX idx_assignments_date ON assignments(date);
DO $$ BEGIN
  CREATE INDEX idx_notes_date ON notes(date);
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
CREATE INDEX idx_assignments_date_timeslot ON assignments(date, time_slot_id);
