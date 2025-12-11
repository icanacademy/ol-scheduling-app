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
    const { startDate, daysCount } = req.query;
    if (!startDate || !daysCount) {
      return res.status(400).json({ error: 'startDate and daysCount are required' });
    }
    const assignments = await Assignment.getByDateRange(startDate, parseInt(daysCount));
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignments by date range', message: error.message });
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
      return res.status(400).json({ error: 'sourceDate and targetDate are required' });
    }

    if (sourceDate === targetDate) {
      return res.status(400).json({ error: 'Source and target dates cannot be the same' });
    }

    // Import Teacher and Student models
    const Teacher = (await import('../models/Teacher.js')).default;
    const Student = (await import('../models/Student.js')).default;

    console.log(`\n=== Copying from ${sourceDate} to ${targetDate} ===`);

    // Delete existing teachers, students, and assignments on target date first
    console.log(`Clearing existing data on ${targetDate}...`);

    // Delete assignments first (due to foreign key constraints)
    const deletedAssignments = await Assignment.deleteByDateRange(targetDate, 1);
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

    // Copy teachers from source date to target date
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

    // Copy students from source date to target date
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

    // Get all assignments for the source date
    const sourceAssignments = await Assignment.getByDate(sourceDate);
    console.log(`Found ${sourceAssignments.length} assignment(s) on ${sourceDate}`);

    // Copy each assignment to the target date with mapped teacher and student IDs
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
        console.log(`  ✓ Created assignment ID ${newAssignment.id}`);
      } else {
        console.log(`  ✗ Skipped - no valid teacher/student mappings`);
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

export const copyWeek = async (req, res) => {
  try {
    const { sourceDate, targetDate } = req.body;

    if (!sourceDate || !targetDate) {
      return res.status(400).json({ error: 'sourceDate and targetDate are required' });
    }

    // Import Teacher and Student models
    const Teacher = (await import('../models/Teacher.js')).default;
    const Student = (await import('../models/Student.js')).default;

    // Helper function to add days to a date string (YYYY-MM-DD)
    const addDays = (dateStr, days) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      date.setUTCDate(date.getUTCDate() + days);
      return date.toISOString().split('T')[0];
    };

    // Calculate day difference
    const [sourceYear, sourceMonth, sourceDay] = sourceDate.split('-').map(Number);
    const [targetYear, targetMonth, targetDay] = targetDate.split('-').map(Number);
    const sourceTime = Date.UTC(sourceYear, sourceMonth - 1, sourceDay);
    const targetTime = Date.UTC(targetYear, targetMonth - 1, targetDay);
    const dayDiff = Math.round((targetTime - sourceTime) / (1000 * 60 * 60 * 24));

    // Copy teachers for the source week to target week
    const teachersMap = new Map();
    console.log(`Starting to copy teachers for 7 days from ${sourceDate} to ${targetDate}`);
    for (let i = 0; i < 7; i++) {
      const sourceDateStr = addDays(sourceDate, i);
      const targetDateStr = addDays(targetDate, i);

      const sourceTeachers = await Teacher.getAll(sourceDateStr);
      console.log(`Day ${i}: Found ${sourceTeachers.length} teacher(s) on ${sourceDateStr}`);
      for (const teacher of sourceTeachers) {
        const newTeacher = await Teacher.create({
          name: teacher.name,
          availability: teacher.availability,
          color_keyword: teacher.color_keyword,
          date: targetDateStr
        });
        // Map old teacher ID to new teacher ID for this date
        teachersMap.set(`${sourceDateStr}-${teacher.id}`, newTeacher.id);
      }
    }
    console.log(`Total teachers copied: ${teachersMap.size}`);

    // Copy students for the source week to target week
    const studentsMap = new Map();
    console.log(`Starting to copy students for 7 days from ${sourceDate} to ${targetDate}`);
    for (let i = 0; i < 7; i++) {
      const sourceDateStr = addDays(sourceDate, i);
      const targetDateStr = addDays(targetDate, i);

      const sourceStudents = await Student.getAll(sourceDateStr);
      console.log(`Day ${i}: Found ${sourceStudents.length} student(s) on ${sourceDateStr}`);
      for (const student of sourceStudents) {
        const newStudent = await Student.create({
          name: student.name,
          english_name: student.english_name,
          availability: student.availability,
          color_keyword: student.color_keyword,
          weakness_level: student.weakness_level,
          teacher_notes: student.teacher_notes,
          date: targetDateStr
        });
        // Map old student ID to new student ID for this date
        studentsMap.set(`${sourceDateStr}-${student.id}`, newStudent.id);
      }
    }
    console.log(`Total students copied: ${studentsMap.size}`);

    // Get all assignments for the week starting from sourceDate
    console.log(`Fetching assignments from ${sourceDate} for 7 days...`);
    const sourceAssignments = await Assignment.getByDateRange(sourceDate, 7);
    console.log(`Found ${sourceAssignments.length} assignment(s) in source week starting from ${sourceDate}`);
    if (sourceAssignments.length > 0) {
      const dates = [...new Set(sourceAssignments.map(a => a.date.toISOString().split('T')[0]))].sort();
      console.log(`Assignment dates found: ${dates.join(', ')}`);
    }

    // Delete any existing assignments in the target week (7 days starting from targetDate)
    const deletedResult = await Assignment.deleteByDateRange(targetDate, 7);
    console.log(`Deleted ${deletedResult.count} existing assignment(s) in target week`);

    // Copy each assignment to the new date with mapped teacher and student IDs
    const copiedAssignments = [];
    console.log(`Starting to copy ${sourceAssignments.length} assignment(s)`);
    for (const assignment of sourceAssignments) {
      // Parse the assignment date as YYYY-MM-DD string
      const assignmentDateStr = assignment.date.toISOString().split('T')[0];

      // Debug: log what we found in the assignment
      console.log(`\nProcessing assignment ID ${assignment.id} from ${assignmentDateStr}:`);
      console.log(`  - Original teachers:`, assignment.teachers);
      console.log(`  - Original students:`, assignment.students);

      // Add the day difference using the helper function
      const newDateStr = addDays(assignmentDateStr, dayDiff);

      const newAssignmentData = {
        date: newDateStr,
        time_slot_id: assignment.time_slot_id,
        room_id: assignment.room_id,
        teachers: assignment.teachers?.map(t => ({
          teacher_id: teachersMap.get(`${assignmentDateStr}-${t.id}`),
          is_substitute: t.is_substitute || false
        })).filter(t => t.teacher_id) || [],
        students: assignment.students?.map(s => ({
          student_id: studentsMap.get(`${assignmentDateStr}-${s.id}`)
        })).filter(s => s.student_id) || [],
        notes: assignment.notes
      };

      console.log(`Copying assignment from ${assignmentDateStr} to ${newDateStr}: ${newAssignmentData.teachers.length} teachers, ${newAssignmentData.students.length} students`);

      // Only create the assignment if it has at least one teacher or one student
      if (newAssignmentData.teachers.length > 0 || newAssignmentData.students.length > 0) {
        const newAssignment = await Assignment.create(newAssignmentData);
        copiedAssignments.push(newAssignment);
      } else {
        console.log(`Skipping assignment from ${assignmentDateStr} - no valid teacher/student mappings found`);
      }
    }
    console.log(`Finished copying ${copiedAssignments.length} assignment(s)`);

    res.json({
      message: `Successfully copied ${copiedAssignments.length} assignment(s), ${teachersMap.size} teacher(s), and ${studentsMap.size} student(s) from ${sourceDate} to ${targetDate}${deletedResult.count > 0 ? ` (replaced ${deletedResult.count} existing assignment(s))` : ''}`,
      count: copiedAssignments.length,
      teachersCount: teachersMap.size,
      studentsCount: studentsMap.size,
      deletedCount: deletedResult.count,
      assignments: copiedAssignments
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to copy week', message: error.message });
  }
};
