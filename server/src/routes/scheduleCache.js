import express from 'express';
import { refreshCache, getCachedStudents, getCacheStatus, getSubjects } from '../controllers/scheduleCacheController.js';

const router = express.Router();

router.post('/refresh', refreshCache);
router.get('/refresh', refreshCache); // GET for Vercel cron
router.get('/students', getCachedStudents);
router.get('/status', getCacheStatus);
router.get('/subjects', getSubjects);

export default router;
