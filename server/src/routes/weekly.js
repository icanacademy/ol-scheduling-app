import express from 'express';
import {
  getWeeklyData,
  copyDaySchedule,
  getStudentsForWeeklyView
} from '../controllers/weeklyController.js';

const router = express.Router();

// Get all data for a week (students and teachers for all 7 days)
router.get('/data', getWeeklyData);

// Get students filtered by schedule days for weekly view
router.get('/students', getStudentsForWeeklyView);

// Copy schedule from one day to another within the same week
router.post('/copy-day', copyDaySchedule);

export default router;