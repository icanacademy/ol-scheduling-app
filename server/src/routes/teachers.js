import express from 'express';
import {
  getAllTeachers,
  getTeacherById,
  getAvailableTeachers,
  createTeacher,
  updateTeacher,
  deleteTeacher,
  checkTeacherAvailability,
  deleteAllTeachers
} from '../controllers/teacherController.js';

const router = express.Router();

router.get('/', getAllTeachers);
router.get('/available', getAvailableTeachers);
router.get('/check-availability', checkTeacherAvailability);
router.get('/:id', getTeacherById);
router.post('/', createTeacher);
router.put('/:id', updateTeacher);
router.delete('/all', deleteAllTeachers);
router.delete('/:id', deleteTeacher);

export default router;
