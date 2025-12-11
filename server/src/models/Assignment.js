import pool from '../db/connection.js';

class Assignment {
  // Get all assignments for a specific date
  static async getByDate(date) {
    const result = await pool.query(
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
      [date]
    );
    return result.rows;
  }

  // Get all assignments for a date range
  static async getByDateRange(startDate, daysCount) {
    // Parse date components to avoid timezone issues
    const [year, month, day] = startDate.split('-').map(Number);
    const endDate = new Date(year, month - 1, day);
    endDate.setDate(endDate.getDate() + daysCount - 1);
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const result = await pool.query(
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
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date >= $1 AND a.date <= $2 AND a.is_active = true
       GROUP BY a.id
       ORDER BY a.date, a.time_slot_id, a.room_id`,
      [startDate, endDateStr]
    );
    return result.rows;
  }

  // Get assignment by ID with full details
  static async getById(id) {
    const result = await pool.query(
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
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.id = $1 AND a.is_active = true
       GROUP BY a.id`,
      [id]
    );
    return result.rows[0];
  }

  // Create a new assignment
  static async create(data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { date, time_slot_id, teachers = [], students = [], notes, subject, color_keyword } = data;

      // Double-check validation before creation to prevent duplicates
      const validation = await this.validate(data);
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }

      // Create the assignment (no room required for online classes)
      const assignmentResult = await client.query(
        `INSERT INTO assignments (date, time_slot_id, room_id, notes, subject, color_keyword)
         VALUES ($1, $2, NULL, $3, $4, $5)
         RETURNING *`,
        [date, time_slot_id, notes, subject, color_keyword]
      );
      const assignment = assignmentResult.rows[0];

      // Add teachers
      for (const teacher of teachers) {
        await client.query(
          `INSERT INTO assignment_teachers (assignment_id, teacher_id, is_substitute)
           VALUES ($1, $2, $3)`,
          [assignment.id, teacher.teacher_id, teacher.is_substitute || false]
        );
      }

      // Add students
      for (const student of students) {
        await client.query(
          `INSERT INTO assignment_students (assignment_id, student_id, submission_id)
           VALUES ($1, $2, $3)`,
          [assignment.id, student.student_id, student.submission_id || null]
        );
      }

      await client.query('COMMIT');

      // Return the full assignment with relations
      return await this.getById(assignment.id);
    } catch (error) {
      await client.query('ROLLBACK');
      
      // Handle database constraint errors gracefully
      if (error.message && error.message.includes('is already assigned to another class')) {
        throw new Error('Student is already assigned to another class at this date and time');
      }
      
      throw error;
    } finally {
      client.release();
    }
  }

  // Update an assignment
  static async update(id, data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { date, time_slot_id, teachers, students, notes, subject, color_keyword } = data;

      // Build dynamic update query
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (date !== undefined) {
        updateFields.push(`date = $${paramIndex}`);
        updateValues.push(date);
        paramIndex++;
      }
      if (time_slot_id !== undefined) {
        updateFields.push(`time_slot_id = $${paramIndex}`);
        updateValues.push(time_slot_id);
        paramIndex++;
      }
      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`);
        updateValues.push(notes);
        paramIndex++;
      }
      if (subject !== undefined) {
        updateFields.push(`subject = $${paramIndex}`);
        updateValues.push(subject);
        paramIndex++;
      }
      if (color_keyword !== undefined) {
        updateFields.push(`color_keyword = $${paramIndex}`);
        updateValues.push(color_keyword);
        paramIndex++;
      }

      // Always update timestamp and room_id
      updateFields.push('room_id = NULL');
      updateFields.push('updated_at = CURRENT_TIMESTAMP');

      // Add id parameter for WHERE clause
      updateValues.push(id);

      // Update the assignment (no room for online classes)
      const updateQuery = `UPDATE assignments SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`;
      await client.query(updateQuery, updateValues);

      // Update teachers if provided
      if (teachers) {
        await client.query('DELETE FROM assignment_teachers WHERE assignment_id = $1', [id]);
        for (const teacher of teachers) {
          await client.query(
            `INSERT INTO assignment_teachers (assignment_id, teacher_id, is_substitute)
             VALUES ($1, $2, $3)`,
            [id, teacher.teacher_id, teacher.is_substitute || false]
          );
        }
      }

      // Update students if provided
      if (students) {
        await client.query('DELETE FROM assignment_students WHERE assignment_id = $1', [id]);
        for (const student of students) {
          await client.query(
            `INSERT INTO assignment_students (assignment_id, student_id, submission_id)
             VALUES ($1, $2, $3)`,
            [id, student.student_id, student.submission_id || null]
          );
        }
      }

      await client.query('COMMIT');

      return await this.getById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Delete an assignment (soft delete)
  static async delete(id) {
    const result = await pool.query(
      'UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_active = true RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Delete all assignments (soft delete) - DEPRECATED: Use deleteByDate instead
  static async deleteAll() {
    const result = await pool.query(
      'UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE is_active = true RETURNING *'
    );
    return { count: result.rowCount, assignments: result.rows };
  }

  // Delete all assignments for a specific date (soft delete)
  static async deleteByDate(date) {
    const result = await pool.query(
      'UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE date = $1 AND is_active = true RETURNING *',
      [date]
    );
    return { count: result.rowCount, assignments: result.rows };
  }

  // Delete assignments by date range (soft delete)
  static async deleteByDateRange(startDate, daysCount) {
    // Parse date components to avoid timezone issues
    const [year, month, day] = startDate.split('-').map(Number);
    const endDate = new Date(year, month - 1, day);
    endDate.setDate(endDate.getDate() + daysCount - 1);
    const endDateStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    const result = await pool.query(
      'UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE date >= $1 AND date <= $2 AND is_active = true RETURNING *',
      [startDate, endDateStr]
    );
    return { count: result.rowCount, assignments: result.rows };
  }

  // Restore soft-deleted assignment
  static async restore(id) {
    const result = await pool.query(
      'UPDATE assignments SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND is_active = false RETURNING *',
      [id]
    );
    return result.rows[0];
  }

  // Restore all soft-deleted assignments
  static async restoreAll() {
    const result = await pool.query(
      'UPDATE assignments SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE is_active = false RETURNING *'
    );
    return { count: result.rowCount, assignments: result.rows };
  }

  // Get all assignments for a specific student (across all dates)
  static async getByStudentId(studentId) {
    const result = await pool.query(
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
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.is_active = true
       AND a.id IN (
         SELECT assignment_id
         FROM assignment_students
         WHERE student_id = $1
       )
       GROUP BY a.id
       ORDER BY a.date, a.time_slot_id, a.room_id`,
      [studentId]
    );
    return result.rows;
  }

  // Validate an assignment (check for conflicts)
  static async validate(data) {
    const { id, date, time_slot_id, teachers = [], students = [] } = data;
    const errors = [];

    // Skip room validation for online classes (no physical room conflicts)

    // Check teacher conflicts (exclude current assignment if updating)
    for (const teacher of teachers) {
      const conflict = await pool.query(
        `SELECT a.id,
                COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
         FROM assignments a
         INNER JOIN assignment_teachers at ON a.id = at.assignment_id
         LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
         LEFT JOIN students s ON ast.student_id = s.id
         WHERE at.teacher_id = $1
         AND a.date = $2
         AND a.time_slot_id = $3
         AND a.is_active = true
         AND ($4::integer IS NULL OR a.id != $4)
         GROUP BY a.id`,
        [teacher.teacher_id, date, time_slot_id, id || null]
      );

      if (conflict.rows.length > 0) {
        const conflictingStudents = conflict.rows[0].students.join(', ');
        errors.push(`Teacher ${teacher.teacher_id} is already scheduled with student(s): ${conflictingStudents} at this time`);
      }
    }

    // Check student conflicts (exclude current assignment if updating)
    for (const student of students) {
      const conflict = await pool.query(
        `SELECT a.id, 
                COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers
         FROM assignments a
         INNER JOIN assignment_students ast ON a.id = ast.assignment_id
         LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
         LEFT JOIN teachers t ON at.teacher_id = t.id
         WHERE ast.student_id = $1
         AND a.date = $2
         AND a.time_slot_id = $3
         AND a.is_active = true
         AND ($4::integer IS NULL OR a.id != $4)
         GROUP BY a.id`,
        [student.student_id, date, time_slot_id, id || null]
      );

      if (conflict.rows.length > 0) {
        const conflictingTeachers = conflict.rows[0].teachers.join(', ');
        errors.push(`Student ${student.student_id} is already scheduled with teacher(s): ${conflictingTeachers} at this time`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export default Assignment;
