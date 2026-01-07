-- Add notion_page_id column to students table for tracking Notion imports
-- This allows proper handling of students with the same name

ALTER TABLE students ADD COLUMN IF NOT EXISTS notion_page_id VARCHAR(100);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_students_notion_page_id ON students(notion_page_id);
