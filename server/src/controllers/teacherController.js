import Teacher from '../models/Teacher.js';
import Backup from '../models/Backup.js';

export const getAllTeachers = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    const teachers = await Teacher.getAll(date);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teachers', message: error.message });
  }
};

export const getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.getById(req.params.id);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(teacher);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch teacher', message: error.message });
  }
};

export const getAvailableTeachers = async (req, res) => {
  try {
    const { timeSlotId, date } = req.query;
    if (!timeSlotId || !date) {
      return res.status(400).json({ error: 'timeSlotId and date are required' });
    }
    const teachers = await Teacher.getAvailableForTimeSlot(parseInt(timeSlotId), date);
    res.json(teachers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch available teachers', message: error.message });
  }
};

export const createTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.create(req.body);
    res.status(201).json(teacher);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create teacher', message: error.message });
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.update(req.params.id, req.body);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json(teacher);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update teacher', message: error.message });
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.delete(req.params.id);
    if (!teacher) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json({ message: 'Teacher deleted successfully', teacher });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete teacher', message: error.message });
  }
};

export const checkTeacherAvailability = async (req, res) => {
  try {
    const { teacherId, date, timeSlotId } = req.query;
    if (!teacherId || !date || !timeSlotId) {
      return res.status(400).json({ error: 'teacherId, date, and timeSlotId are required' });
    }
    const result = await Teacher.checkAvailability(teacherId, date, timeSlotId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check availability', message: error.message });
  }
};

export const deleteAllTeachers = async (req, res) => {
  try {
    const { date } = req.body;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Create backup before deleting
    const backup = await Backup.create(`Auto-backup before deleting all teachers for ${date}`);

    // Perform the delete for the specific date
    const result = await Teacher.deleteByDate(date);

    res.json({
      message: `Successfully deleted ${result.count} teacher(s) for ${date}`,
      date: date,
      backup: {
        filename: backup.filename,
        message: 'Backup created automatically'
      },
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete all teachers', message: error.message });
  }
};
