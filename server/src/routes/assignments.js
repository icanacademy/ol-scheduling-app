import express from 'express';
import {
  getAssignmentsByDate,
  getAssignmentsByDateRange,
  getAssignmentById,
  getAssignmentsByStudentId,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  validateAssignment,
  deleteAllAssignments,
  copyWeek,
  copyDay
} from '../controllers/assignmentController.js';

const router = express.Router();

router.get('/', getAssignmentsByDate);
router.get('/date-range', getAssignmentsByDateRange);
router.post('/validate', validateAssignment);
router.post('/copy-day', copyDay);
router.post('/copy-week', copyWeek);
router.get('/student/:studentId', getAssignmentsByStudentId);
router.get('/:id', getAssignmentById);
router.post('/', createAssignment);
router.put('/:id', updateAssignment);
router.delete('/all', deleteAllAssignments);
router.delete('/:id', deleteAssignment);

export default router;
