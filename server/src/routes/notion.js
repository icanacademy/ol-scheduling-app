import express from 'express';
import {
  importTeachersFromNotion,
  previewStudentsFromNotion,
  importStudentsFromNotion,
  getAllNotionStudents,
  getNotionStudentById,
  updateNotionStudent
} from '../controllers/notionController.js';

import { previewTeachersFromNotion } from '../controllers/notionControllerFixed.js';

const router = express.Router();

// Teacher routes
router.get('/preview-teachers', previewTeachersFromNotion);
router.post('/import-teachers', importTeachersFromNotion);

// Student routes
router.get('/preview-students', previewStudentsFromNotion);
router.post('/import-students', importStudentsFromNotion);

// Student Schedule Sheet routes
router.get('/students', getAllNotionStudents);
router.get('/students/:notionId', getNotionStudentById);
router.patch('/students/:notionId', updateNotionStudent);

export default router;