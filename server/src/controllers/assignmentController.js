import Assignment from '../models/Assignment.js';
import Backup from '../models/Backup.js';
import pool from '../db/connection.js';

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
  const { sourceDate, targetDate } = req.body;

  if (!sourceDate || !targetDate) {
    return res.status(400).json({ error: 'sourceDate and targetDate are required (day names like "Monday")' });
  }

  if (sourceDate === targetDate) {
    return res.status(400).json({ error: 'Source and target days cannot be the same' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log(`\n=== Copying from ${sourceDate} to ${targetDate} ===`);

    // --- Read source data first (before any deletes) ---

    // Read source teachers
    const sourceTeachersResult = await client.query(
      'SELECT * FROM teachers WHERE is_active = true AND date = $1 ORDER BY name',
      [sourceDate]
    );
    const sourceTeachers = sourceTeachersResult.rows;
    console.log(`Found ${sourceTeachers.length} teacher(s) on ${sourceDate}`);

    // Read source students
    const sourceStudentsResult = await client.query(
      'SELECT * FROM students WHERE is_active = true AND date = $1 ORDER BY name',
      [sourceDate]
    );
    const sourceStudents = sourceStudentsResult.rows;
    console.log(`Found ${sourceStudents.length} student(s) on ${sourceDate}`);

    // Read source assignments (with teacher/student joins)
    const sourceAssignmentsResult = await client.query(
      `SELECT
         a.*,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'color_keyword', t.color_keyword,
           'is_substitute', at.is_substitute
         )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'english_name', s.english_name,
           'korean_name', s.korean_name,
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date = $1 AND a.is_active = true
       GROUP BY a.id
       ORDER BY a.time_slot_id, a.room_id`,
      [sourceDate]
    );
    const sourceAssignments = sourceAssignmentsResult.rows;
    console.log(`Found ${sourceAssignments.length} assignment(s) on ${sourceDate}`);

    // --- Delete existing data on target day ---
    console.log(`Clearing existing data on ${targetDate}...`);

    // Soft-delete assignments first (due to foreign key constraints)
    const deletedAssignmentsResult = await client.query(
      'UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE date = $1 AND is_active = true RETURNING *',
      [targetDate]
    );
    const deletedAssignmentsCount = deletedAssignmentsResult.rowCount;
    console.log(`  Deleted ${deletedAssignmentsCount} existing assignment(s)`);

    // Soft-delete teachers on target day
    const existingTeachersResult = await client.query(
      'SELECT id FROM teachers WHERE is_active = true AND date = $1',
      [targetDate]
    );
    const existingTeachersCount = existingTeachersResult.rowCount;
    if (existingTeachersCount > 0) {
      await client.query(
        'UPDATE teachers SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE is_active = true AND date = $1',
        [targetDate]
      );
    }
    console.log(`  Deleted ${existingTeachersCount} existing teacher(s)`);

    // Soft-delete students on target day
    const existingStudentsResult = await client.query(
      'SELECT id FROM students WHERE is_active = true AND date = $1',
      [targetDate]
    );
    const existingStudentsCount = existingStudentsResult.rowCount;
    if (existingStudentsCount > 0) {
      await client.query(
        'UPDATE students SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE is_active = true AND date = $1',
        [targetDate]
      );
    }
    console.log(`  Deleted ${existingStudentsCount} existing student(s)`);

    // --- Copy teachers from source to target ---
    const teachersMap = new Map();
    for (const teacher of sourceTeachers) {
      const result = await client.query(
        `INSERT INTO teachers (name, availability, color_keyword, date)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [teacher.name, JSON.stringify(teacher.availability), teacher.color_keyword, targetDate]
      );
      const newTeacher = result.rows[0];
      teachersMap.set(teacher.id, newTeacher.id);
      console.log(`  Copied teacher: ${teacher.name} (${teacher.id} -> ${newTeacher.id})`);
    }

    // --- Copy students from source to target ---
    const studentsMap = new Map();
    for (const student of sourceStudents) {
      const result = await client.query(
        `INSERT INTO students (name, english_name, availability, color_keyword, weakness_level, teacher_notes, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          student.name,
          student.english_name,
          JSON.stringify(student.availability),
          student.color_keyword,
          student.weakness_level,
          student.teacher_notes,
          targetDate
        ]
      );
      const newStudent = result.rows[0];
      studentsMap.set(student.id, newStudent.id);
      console.log(`  Copied student: ${student.name} (${student.id} -> ${newStudent.id})`);
    }

    // --- Copy assignments from source to target ---
    const copiedAssignments = [];
    for (const assignment of sourceAssignments) {
      console.log(`\nProcessing assignment ID ${assignment.id}:`);
      console.log(`  - Original teachers:`, assignment.teachers?.map(t => `${t.name} (${t.id})`));
      console.log(`  - Original students:`, assignment.students?.map(s => `${s.name} (${s.id})`));

      const mappedTeachers = (assignment.teachers || [])
        .map(t => ({
          teacher_id: teachersMap.get(t.id),
          is_substitute: t.is_substitute || false
        }))
        .filter(t => t.teacher_id);

      const mappedStudents = (assignment.students || [])
        .map(s => ({
          student_id: studentsMap.get(s.id)
        }))
        .filter(s => s.student_id);

      console.log(`  - Mapped to: ${mappedTeachers.length} teachers, ${mappedStudents.length} students`);

      // Only create the assignment if it has at least one teacher or one student
      if (mappedTeachers.length > 0 || mappedStudents.length > 0) {
        // Insert the assignment
        const assignmentResult = await client.query(
          `INSERT INTO assignments (date, time_slot_id, room_id, notes, subject, color_keyword)
           VALUES ($1, $2, NULL, $3, $4, $5)
           RETURNING *`,
          [targetDate, assignment.time_slot_id, assignment.notes, assignment.subject, assignment.color_keyword]
        );
        const newAssignment = assignmentResult.rows[0];

        // Insert assignment_teachers
        if (mappedTeachers.length > 0) {
          const teacherValues = mappedTeachers.map((t, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
          const teacherParams = [newAssignment.id];
          mappedTeachers.forEach(t => { teacherParams.push(t.teacher_id, t.is_substitute); });
          await client.query(
            `INSERT INTO assignment_teachers (assignment_id, teacher_id, is_substitute) VALUES ${teacherValues}`,
            teacherParams
          );
        }

        // Insert assignment_students
        if (mappedStudents.length > 0) {
          const studentValues = mappedStudents.map((s, i) => `($1, $${i + 2})`).join(', ');
          const studentParams = [newAssignment.id];
          mappedStudents.forEach(s => { studentParams.push(s.student_id); });
          await client.query(
            `INSERT INTO assignment_students (assignment_id, student_id) VALUES ${studentValues}`,
            studentParams
          );
        }

        copiedAssignments.push(newAssignment);
        console.log(`  Created assignment ID ${newAssignment.id}`);
      } else {
        console.log(`  Skipped - no valid teacher/student mappings`);
      }
    }

    await client.query('COMMIT');

    console.log(`\n=== Copy completed: ${copiedAssignments.length} assignment(s) ===\n`);

    res.json({
      message: `Successfully copied ${copiedAssignments.length} assignment(s), ${teachersMap.size} teacher(s), and ${studentsMap.size} student(s) from ${sourceDate} to ${targetDate}${deletedAssignmentsCount > 0 ? ` (replaced ${deletedAssignmentsCount} existing assignment(s), ${existingTeachersCount} teacher(s), and ${existingStudentsCount} student(s))` : ''}`,
      count: copiedAssignments.length,
      teachersCount: teachersMap.size,
      studentsCount: studentsMap.size,
      deletedCount: deletedAssignmentsCount,
      deletedTeachersCount: existingTeachersCount,
      deletedStudentsCount: existingStudentsCount,
      assignments: copiedAssignments
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Copy day error:', error);
    res.status(500).json({ error: 'Failed to copy day', message: error.message });
  } finally {
    client.release();
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
  // copyWeek now copies all 7 day names. sourceDate/targetDate are ignored
  // since day names are the same ("Monday" -> "Monday"). This is effectively
  // a no-op for the template week model, but kept for API compatibility.
  // In practice, this duplicates teachers/students within the same day names.

  const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Read teachers for each day
    const teachersMap = new Map();
    console.log(`Starting to copy teachers for all 7 days`);
    for (const day of ALL_DAYS) {
      const result = await client.query(
        'SELECT * FROM teachers WHERE is_active = true AND date = $1 ORDER BY name',
        [day]
      );
      const sourceTeachers = result.rows;
      console.log(`${day}: Found ${sourceTeachers.length} teacher(s)`);
      for (const teacher of sourceTeachers) {
        // Since source and target day are the same, just map ID to itself
        teachersMap.set(`${day}-${teacher.id}`, teacher.id);
      }
    }
    console.log(`Total teachers mapped: ${teachersMap.size}`);

    // Read students for each day
    const studentsMap = new Map();
    console.log(`Starting to copy students for all 7 days`);
    for (const day of ALL_DAYS) {
      const result = await client.query(
        'SELECT * FROM students WHERE is_active = true AND date = $1 ORDER BY name',
        [day]
      );
      const sourceStudents = result.rows;
      console.log(`${day}: Found ${sourceStudents.length} student(s)`);
      for (const student of sourceStudents) {
        studentsMap.set(`${day}-${student.id}`, student.id);
      }
    }
    console.log(`Total students mapped: ${studentsMap.size}`);

    // Get all assignments for all days
    console.log(`Fetching assignments for all days...`);
    const assignmentsResult = await client.query(
      `SELECT
         a.*,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'color_keyword', t.color_keyword,
           'is_substitute', at.is_substitute
         )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'english_name', s.english_name,
           'korean_name', s.korean_name,
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date = ANY($1::text[]) AND a.is_active = true
       GROUP BY a.id
       ORDER BY a.date, a.time_slot_id, a.room_id`,
      [ALL_DAYS]
    );
    const sourceAssignments = assignmentsResult.rows;
    console.log(`Found ${sourceAssignments.length} assignment(s) total`);

    await client.query('COMMIT');

    res.json({
      message: `Week data contains ${sourceAssignments.length} assignment(s), ${teachersMap.size} teacher(s), and ${studentsMap.size} student(s)`,
      count: sourceAssignments.length,
      teachersCount: teachersMap.size,
      studentsCount: studentsMap.size,
      deletedCount: 0,
      assignments: sourceAssignments
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to copy week', message: error.message });
  } finally {
    client.release();
  }
};
