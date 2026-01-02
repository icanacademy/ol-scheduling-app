import Student from '../models/Student.js';
import Backup from '../models/Backup.js';

export const getAllStudents = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    const students = await Student.getAll(date);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students', message: error.message });
  }
};

export const getAllUniqueStudents = async (req, res) => {
  try {
    const students = await Student.getAllUnique();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch unique students', message: error.message });
  }
};

export const getStudentById = async (req, res) => {
  try {
    const student = await Student.getById(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student', message: error.message });
  }
};

export const getStudentsByColor = async (req, res) => {
  try {
    const { color, date } = req.query;
    if (!color || !date) {
      return res.status(400).json({ error: 'color and date are required' });
    }
    const students = await Student.getByColor(color, date);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students by color', message: error.message });
  }
};

export const getAvailableStudents = async (req, res) => {
  try {
    const { timeSlotId, date } = req.query;
    if (!timeSlotId || !date) {
      return res.status(400).json({ error: 'timeSlotId and date are required' });
    }
    const students = await Student.getAvailableForTimeSlot(parseInt(timeSlotId), date);
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch available students', message: error.message });
  }
};

export const createStudent = async (req, res) => {
  try {
    const student = await Student.create(req.body);
    res.status(201).json(student);
  } catch (error) {
    console.error('Failed to create student:', error.message);
    console.error('Request body:', JSON.stringify(req.body, null, 2));
    res.status(400).json({ error: 'Failed to create student', message: error.message });
  }
};

export const updateStudent = async (req, res) => {
  try {
    const student = await Student.update(req.params.id, req.body);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update student', message: error.message });
  }
};

export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.delete(req.params.id);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ message: 'Student deleted successfully', student });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student', message: error.message });
  }
};

export const checkStudentAvailability = async (req, res) => {
  try {
    const { studentId, date, timeSlotId } = req.query;
    if (!studentId || !date || !timeSlotId) {
      return res.status(400).json({ error: 'studentId, date, and timeSlotId are required' });
    }
    const result = await Student.checkAvailability(studentId, date, timeSlotId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to check availability', message: error.message });
  }
};

export const deleteAllStudents = async (req, res) => {
  try {
    const { date } = req.body;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Create backup before deleting
    const backup = await Backup.create(`Auto-backup before deleting all students for ${date}`);

    // Perform the delete for the specific date
    const result = await Student.deleteByDate(date);

    res.json({
      message: `Successfully deleted ${result.count} student(s) for ${date}`,
      date: date,
      backup: {
        filename: backup.filename,
        message: 'Backup created automatically'
      },
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete all students', message: error.message });
  }
};

// Get student directory (all unique students with summary info)
export const getStudentDirectory = async (req, res) => {
  try {
    const students = await Student.getDirectory();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student directory', message: error.message });
  }
};

// Update student status
export const updateStudentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const student = await Student.updateStatus(req.params.id, status);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update student status', message: error.message });
  }
};

// Update student directory fields
export const updateStudentDirectoryFields = async (req, res) => {
  try {
    const student = await Student.updateDirectoryFields(req.params.id, req.body);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json(student);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update student', message: error.message });
  }
};
