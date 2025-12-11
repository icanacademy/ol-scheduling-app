-- Add color_keyword field to assignments table
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS color_keyword VARCHAR(50);

-- Update existing assignments to use the first student's color
UPDATE assignments a
SET color_keyword = (
    SELECT s.color_keyword 
    FROM assignment_students ast
    JOIN students s ON s.id = ast.student_id
    WHERE ast.assignment_id = a.id
    LIMIT 1
)
WHERE a.color_keyword IS NULL;