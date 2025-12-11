import TimeSlot from '../models/TimeSlot.js';

export const getAllTimeSlots = async (req, res) => {
  try {
    const timeSlots = await TimeSlot.getAll();
    res.json(timeSlots);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time slots', message: error.message });
  }
};

export const getTimeSlotById = async (req, res) => {
  try {
    const timeSlot = await TimeSlot.getById(req.params.id);
    if (!timeSlot) {
      return res.status(404).json({ error: 'Time slot not found' });
    }
    res.json(timeSlot);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch time slot', message: error.message });
  }
};
