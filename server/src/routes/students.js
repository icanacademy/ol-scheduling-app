import express from 'express';
import {
  getAllStudents,
  getAllUniqueStudents,
  getAllActiveStudents,
  getStudentById,
  getStudentsByColor,
  getAvailableStudents,
  createStudent,
  updateStudent,
  deleteStudent,
  checkStudentAvailability,
  deleteAllStudents,
  getStudentDirectory,
  updateStudentStatus,
  updateStudentDirectoryFields
} from '../controllers/studentController.js';

const router = express.Router();

router.get('/', getAllStudents);
router.get('/all-unique', getAllUniqueStudents);
router.get('/all-active', getAllActiveStudents);
router.get('/directory', getStudentDirectory);
router.get('/by-color', getStudentsByColor);
router.get('/available', getAvailableStudents);
router.get('/check-availability', checkStudentAvailability);
router.get('/:id', getStudentById);
router.post('/', createStudent);
router.put('/:id', updateStudent);
router.patch('/:id/status', updateStudentStatus);
router.patch('/:id/directory', updateStudentDirectoryFields);
router.delete('/all', deleteAllStudents);
router.delete('/:id', deleteStudent);

export default router;
