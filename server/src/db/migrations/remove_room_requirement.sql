-- Remove room requirement for online classes
-- This migration allows room_id to be NULL since online classes don't need physical rooms

-- Make room_id nullable
ALTER TABLE assignments ALTER COLUMN room_id DROP NOT NULL;

-- Update any existing assignments that might have room conflicts
-- Set all existing assignments to room_id = NULL for consistency
UPDATE assignments SET room_id = NULL WHERE room_id IS NOT NULL;

-- Add a comment to document this change
COMMENT ON COLUMN assignments.room_id IS 'Room ID for physical classes, NULL for online classes';