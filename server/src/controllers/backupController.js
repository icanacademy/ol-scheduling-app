import Backup from '../models/Backup.js';

// Get all backups
export const getAllBackups = async (req, res) => {
  try {
    const backups = await Backup.getAll();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch backups', message: error.message });
  }
};

// Create a new backup
export const createBackup = async (req, res) => {
  try {
    const { description } = req.body;
    const backup = await Backup.create(description);
    res.status(201).json({
      success: true,
      message: 'Backup created successfully',
      backup
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create backup', message: error.message });
  }
};

// Preview backup contents
export const previewBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const preview = await Backup.preview(filename);
    res.json(preview);
  } catch (error) {
    res.status(404).json({ error: 'Backup not found', message: error.message });
  }
};

// Restore from backup
export const restoreBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const options = req.body;

    const result = await Backup.restore(filename, options);
    res.json({
      success: true,
      message: 'Restore completed successfully',
      result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore backup', message: error.message });
  }
};

// Download backup file
export const downloadBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const backupPath = Backup.getBackupPath(filename);

    res.download(backupPath, filename, (err) => {
      if (err) {
        res.status(404).json({ error: 'Backup file not found', message: err.message });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to download backup', message: error.message });
  }
};

// Delete a backup
export const deleteBackup = async (req, res) => {
  try {
    const { filename } = req.params;
    const result = await Backup.delete(filename);
    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete backup', message: error.message });
  }
};

// Sync backup metadata with files on disk
export const syncBackups = async (req, res) => {
  try {
    const result = await Backup.syncWithFiles();
    res.json({
      success: true,
      message: `Synced ${result.added} backup(s) from disk`,
      result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to sync backups', message: error.message });
  }
};
