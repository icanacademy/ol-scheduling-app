import express from 'express';
import {
  createChangeHistory,
  getStudentChangeHistory,
  getChangeHistoryByDateRange,
  getChangeHistoryByType,
  getRecentChanges,
  updateChangeHistory,
  deleteChangeHistory
} from '../controllers/studentChangeHistoryController.js';

const router = express.Router();

// Get recent changes across all students
router.get('/recent', getRecentChanges);

// Get all change history for a specific student
router.get('/student/:studentId', getStudentChangeHistory);

// Get change history by date range
router.get('/student/:studentId/date-range', getChangeHistoryByDateRange);

// Get change history by type
router.get('/student/:studentId/by-type', getChangeHistoryByType);

// Create a new change history entry
router.post('/', createChangeHistory);

// Update a change history entry
router.put('/:id', updateChangeHistory);

// Delete a change history entry
router.delete('/:id', deleteChangeHistory);

export default router;