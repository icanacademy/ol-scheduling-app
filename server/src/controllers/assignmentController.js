import Assignment from '../models/Assignment.js';
import Backup from '../models/Backup.js';

export const getAssignmentsByDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }
    const assignments = await Assignment.getByDate(date);
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments', message: error.message });
  }
};

export const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.getById(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignment', message: error.message });
  }
};

export const getAssignmentsByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }
    const assignments = await Assignment.getByStudentId(studentId);
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments for student', message: error.message });
  }
};

export const getAssignmentsByDateRange = async (req, res) => {
  try {
    const { days, startDate, daysCount } = req.query;

    // Support new format: comma-separated day names
    if (days) {
      const dayNames = days.split(',').map(d => d.trim());
      const assignments = await Assignment.getByDays(dayNames);
      return res.json(assignments);
    }

    // Backward compat: convert old startDate/daysCount to day names
    if (startDate && daysCount) {
      const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      const assignments = await Assignment.getByDays(ALL_DAYS);
      return res.json(assignments);
    }

    return res.status(400).json({ error: 'days parameter is required (comma-separated day names)' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments by days', message: error.message });
  }
};

export const createAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.create(req.body);
    res.status(201).json(assignment);
  } catch (error) {
    console.error('Error creating assignment:', error);
    res.status(400).json({ error: 'Failed to create assignment', message: error.message });
  }
};

export const updateAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.update(req.params.id, req.body);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json(assignment);
  } catch (error) {
    console.error('Assignment update error:', error.message);
    res.status(400).json({ error: 'Failed to update assignment', message: error.message });
  }
};

export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.delete(req.params.id);
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Assignment deleted successfully', assignment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment', message: error.message });
  }
};

export const validateAssignment = async (req, res) => {
  try {
    const validation = await Assignment.validate(req.body);
    res.json(validation);
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ error: 'Failed to validate assignment', message: error.message });
  }
};

export const deleteAllAssignments = async (req, res) => {
  try {
    const { date } = req.body;

    // Validate date parameter
    if (!date) {
      return res.status(400).json({ error: 'Date is required' });
    }

    // Create backup before deleting
    const backup = await Backup.create(`Auto-backup before deleting all assignments for ${date}`);

    // Perform the delete for the specific date
    const result = await Assignment.deleteByDate(date);

    res.json({
      message: `Successfully deleted ${result.count} assignment(s) for ${date}`,
      date: date,
      backup: {
        filename: backup.filename,
        message: 'Backup created automatically'
      },
      ...result
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete all assignments', message: error.message });
  }
};

export const copyDay = async (req, res) => {
  try {
    const { sourceDate, targetDate } = req.body;

    if (!sourceDate || !targetDate) {
      return res.status(400).json({ error: 'sourceDate and targetDate are required (day names like "Monday")' });
    }

    if (sourceDate === targetDate) {
      return res.status(400).json({ error: 'Source and target days cannot be the same' });
    }

    // Import Teacher and Student models
    const Teacher = (await import('../models/Teacher.js')).default;
    const Student = (await import('../models/Student.js')).default;

    console.log(`\n=== Copying from ${sourceDate} to ${targetDate} ===`);

    // Delete existing teachers, students, and assignments on target day first
    console.log(`Clearing existing data on ${targetDate}...`);

    // Delete assignments first (due to foreign key constraints)
    const deletedAssignments = await Assignment.deleteByDays([targetDate]);
    console.log(`  Deleted ${deletedAssignments.count} existing assignment(s)`);

    // Delete teachers
    const existingTeachers = await Teacher.getAll(targetDate);
    for (const teacher of existingTeachers) {
      await Teacher.delete(teacher.id);
    }
    console.log(`  Deleted ${existingTeachers.length} existing teacher(s)`);

    // Delete students
    const existingStudents = await Student.getAll(targetDate);
    for (const student of existingStudents) {
      await Student.delete(student.id);
    }
    console.log(`  Deleted ${existingStudents.length} existing student(s)`);

    // Copy teachers from source day to target day
    const teachersMap = new Map();
    const sourceTeachers = await Teacher.getAll(sourceDate);
    console.log(`Found ${sourceTeachers.length} teacher(s) on ${sourceDate}`);

    for (const teacher of sourceTeachers) {
      const newTeacher = await Teacher.create({
        name: teacher.name,
        availability: teacher.availability,
        color_keyword: teacher.color_keyword,
        date: targetDate
      });
      teachersMap.set(teacher.id, newTeacher.id);
      console.log(`  Copied teacher: ${teacher.name} (${teacher.id} -> ${newTeacher.id})`);
    }

    // Copy students from source day to target day
    const studentsMap = new Map();
    const sourceStudents = await Student.getAll(sourceDate);
    console.log(`Found ${sourceStudents.length} student(s) on ${sourceDate}`);

    for (const student of sourceStudents) {
      const newStudent = await Student.create({
        name: student.name,
        english_name: student.english_name,
        availability: student.availability,
        color_keyword: student.color_keyword,
        weakness_level: student.weakness_level,
        teacher_notes: student.teacher_notes,
        date: targetDate
      });
      studentsMap.set(student.id, newStudent.id);
      console.log(`  Copied student: ${student.name} (${student.id} -> ${newStudent.id})`);
    }

    // Get all assignments for the source day
    const sourceAssignments = await Assignment.getByDate(sourceDate);
    console.log(`Found ${sourceAssignments.length} assignment(s) on ${sourceDate}`);

    // Copy each assignment to the target day with mapped teacher and student IDs
    const copiedAssignments = [];
    for (const assignment of sourceAssignments) {
      console.log(`\nProcessing assignment ID ${assignment.id}:`);
      console.log(`  - Original teachers:`, assignment.teachers?.map(t => `${t.name} (${t.id})`));
      console.log(`  - Original students:`, assignment.students?.map(s => `${s.name} (${s.id})`));

      const newAssignmentData = {
        date: targetDate,
        time_slot_id: assignment.time_slot_id,
        room_id: assignment.room_id,
        teachers: assignment.teachers?.map(t => ({
          teacher_id: teachersMap.get(t.id),
          is_substitute: t.is_substitute || false
        })).filter(t => t.teacher_id) || [],
        students: assignment.students?.map(s => ({
          student_id: studentsMap.get(s.id)
        })).filter(s => s.student_id) || [],
        notes: assignment.notes
      };

      console.log(`  - Mapped to: ${newAssignmentData.teachers.length} teachers, ${newAssignmentData.students.length} students`);

      // Only create the assignment if it has at least one teacher or one student
      if (newAssignmentData.teachers.length > 0 || newAssignmentData.students.length > 0) {
        const newAssignment = await Assignment.create(newAssignmentData);
        copiedAssignments.push(newAssignment);
        console.log(`  Created assignment ID ${newAssignment.id}`);
      } else {
        console.log(`  Skipped - no valid teacher/student mappings`);
      }
    }

    console.log(`\n=== Copy completed: ${copiedAssignments.length} assignment(s) ===\n`);

    res.json({
      message: `Successfully copied ${copiedAssignments.length} assignment(s), ${teachersMap.size} teacher(s), and ${studentsMap.size} student(s) from ${sourceDate} to ${targetDate}${deletedAssignments.count > 0 ? ` (replaced ${deletedAssignments.count} existing assignment(s), ${existingTeachers.length} teacher(s), and ${existingStudents.length} student(s))` : ''}`,
      count: copiedAssignments.length,
      teachersCount: teachersMap.size,
      studentsCount: studentsMap.size,
      deletedCount: deletedAssignments.count,
      deletedTeachersCount: existingTeachers.length,
      deletedStudentsCount: existingStudents.length,
      assignments: copiedAssignments
    });
  } catch (error) {
    console.error('Copy day error:', error);
    res.status(500).json({ error: 'Failed to copy day', message: error.message });
  }
};

export const findDuplicates = async (req, res) => {
  try {
    const duplicates = await Assignment.findDuplicates();
    res.json({
      count: duplicates.length,
      duplicates
    });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    res.status(500).json({ error: 'Failed to find duplicates', message: error.message });
  }
};

export const removeDuplicates = async (req, res) => {
  try {
    // Create backup before removing duplicates
    const backup = await Backup.create('Auto-backup before removing duplicate assignments');

    const result = await Assignment.removeDuplicates();
    res.json({
      message: `Removed ${result.removed} duplicate assignment(s)`,
      ...result,
      backup: {
        filename: backup.filename,
        message: 'Backup created automatically'
      }
    });
  } catch (error) {
    console.error('Error removing duplicates:', error);
    res.status(500).json({ error: 'Failed to remove duplicates', message: error.message });
  }
};

export const copyWeek = async (req, res) => {
  try {
    // copyWeek now copies all 7 day names. sourceDate/targetDate are ignored
    // since day names are the same ("Monday" -> "Monday"). This is effectively
    // a no-op for the template week model, but kept for API compatibility.
    // In practice, this duplicates teachers/students within the same day names.

    const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    // Import Teacher and Student models
    const Teacher = (await import('../models/Teacher.js')).default;
    const Student = (await import('../models/Student.js')).default;

    // Copy teachers for each day (duplicate within same day name)
    const teachersMap = new Map();
    console.log(`Starting to copy teachers for all 7 days`);
    for (const day of ALL_DAYS) {
      const sourceTeachers = await Teacher.getAll(day);
      console.log(`${day}: Found ${sourceTeachers.length} teacher(s)`);
      for (const teacher of sourceTeachers) {
        // Since source and target day are the same, just map ID to itself
        teachersMap.set(`${day}-${teacher.id}`, teacher.id);
      }
    }
    console.log(`Total teachers mapped: ${teachersMap.size}`);

    // Copy students for each day
    const studentsMap = new Map();
    console.log(`Starting to copy students for all 7 days`);
    for (const day of ALL_DAYS) {
      const sourceStudents = await Student.getAll(day);
      console.log(`${day}: Found ${sourceStudents.length} student(s)`);
      for (const student of sourceStudents) {
        studentsMap.set(`${day}-${student.id}`, student.id);
      }
    }
    console.log(`Total students mapped: ${studentsMap.size}`);

    // Get all assignments for all days
    console.log(`Fetching assignments for all days...`);
    const sourceAssignments = await Assignment.getByDays(ALL_DAYS);
    console.log(`Found ${sourceAssignments.length} assignment(s) total`);

    res.json({
      message: `Week data contains ${sourceAssignments.length} assignment(s), ${teachersMap.size} teacher(s), and ${studentsMap.size} student(s)`,
      count: sourceAssignments.length,
      teachersCount: teachersMap.size,
      studentsCount: studentsMap.size,
      deletedCount: 0,
      assignments: sourceAssignments
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to copy week', message: error.message });
  }
};
