-- Add backup_data column to store JSON backup data in database
-- This enables serverless-compatible backups without file system access

ALTER TABLE backup_metadata
ADD COLUMN IF NOT EXISTS backup_data TEXT;

-- Add comment explaining the column
COMMENT ON COLUMN backup_metadata.backup_data IS 'JSON string containing full database backup data';
