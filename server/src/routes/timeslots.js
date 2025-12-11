import express from 'express';
import {
  getAllTimeSlots,
  getTimeSlotById
} from '../controllers/timeslotController.js';

const router = express.Router();

router.get('/', getAllTimeSlots);
router.get('/:id', getTimeSlotById);

export default router;
