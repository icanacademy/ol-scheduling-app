import express from 'express';
import {
  getAllStudents,
  getAllUniqueStudents,
  getStudentById,
  getStudentsByColor,
  getAvailableStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  checkStudentAvailability,
  deleteAllStudents
} from '../controllers/studentController.js';

const router = express.Router();

router.get('/', getAllStudents);
router.get('/all-unique', getAllUniqueStudents);
router.get('/by-color', getStudentsByColor);
router.get('/available', getAvailableStudents);
router.get('/check-availability', checkStudentAvailability);
router.get('/:id', getStudentById);
router.post('/', createStudent);
router.put('/:id', updateStudent);
router.delete('/all', deleteAllStudents);
router.delete('/:id', deleteStudent);

export default router;
