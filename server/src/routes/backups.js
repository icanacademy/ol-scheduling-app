import express from 'express';
import {
  getAllBackups,
  createBackup,
  previewBackup,
  restoreBackup,
  downloadBackup,
  deleteBackup,
  syncBackups
} from '../controllers/backupController.js';

const router = express.Router();

router.get('/', getAllBackups);
router.post('/create', createBackup);
router.post('/sync', syncBackups);
router.get('/:filename/preview', previewBackup);
router.post('/:filename/restore', restoreBackup);
router.get('/:filename/download', downloadBackup);
router.delete('/:filename', deleteBackup);

export default router;
