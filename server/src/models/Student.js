import pool from '../db/connection.js';

class Student {
  // Get all students for a specific date
  static async getAll(date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      'SELECT * FROM students WHERE is_active = true AND date = $1 ORDER BY name',
      [date]
    );
    return result.rows;
  }

  // Get all unique students across all dates (for Student Schedule Sheet)
  // Prioritize records with start dates, then fall back to lowest ID
  static async getAllUnique() {
    const result = await pool.query(
      `SELECT DISTINCT ON (LOWER(name)) *
       FROM students
       WHERE is_active = true
       ORDER BY LOWER(name), 
                (CASE WHEN first_start_date IS NOT NULL THEN 0 ELSE 1 END), 
                id ASC`
    );
    return result.rows;
  }

  // Find student by name and date (including inactive students)
  static async findByName(name, date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      'SELECT * FROM students WHERE LOWER(name) = LOWER($1) AND date = $2 LIMIT 1',
      [name, date]
    );
    return result.rows[0];
  }

  // Reactivate and update an existing student
  static async reactivate(id, data) {
    const {
      name,
      english_name,
      availability,
      color_keyword,
      weakness_level,
      teacher_notes,
      first_start_date,
      schedule_days,
      schedule_pattern,
      // Program details
      school,
      program_start_date,
      program_end_date,
      // Student information
      student_id,
      gender,
      grade,
      student_type,
      // Level test scores
      reading_score,
      grammar_score,
      listening_score,
      writing_score,
      level_test_total,
      // Reading level initial
      wpm_initial,
      gbwt_initial,
      reading_level_initial,
      // Interview
      interview_score
    } = data;

    const result = await pool.query(
      `UPDATE students
       SET name = COALESCE($1, name),
           english_name = $2,
           availability = COALESCE($3, availability),
           color_keyword = $4,
           weakness_level = $5,
           teacher_notes = $6,
           first_start_date = $7,
           school = $8,
           program_start_date = $9,
           program_end_date = $10,
           student_id = $11,
           gender = $12,
           grade = $13,
           student_type = $14,
           reading_score = $15,
           grammar_score = $16,
           listening_score = $17,
           writing_score = $18,
           level_test_total = $19,
           wpm_initial = $20,
           gbwt_initial = $21,
           reading_level_initial = $22,
           interview_score = $23,
           schedule_days = COALESCE($24, schedule_days),
           schedule_pattern = $25,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $26
       RETURNING *`,
      [
        name?.trim(),
        english_name?.trim(),
        availability ? JSON.stringify(availability) : null,
        color_keyword,
        weakness_level,
        teacher_notes,
        first_start_date,
        school,
        program_start_date,
        program_end_date,
        student_id,
        gender,
        grade,
        student_type,
        reading_score,
        grammar_score,
        listening_score,
        writing_score,
        level_test_total,
        wpm_initial,
        gbwt_initial,
        reading_level_initial,
        interview_score,
        schedule_days ? JSON.stringify(schedule_days) : null,
        schedule_pattern,
        id
      ]
    );
    return result.rows[0];
  }

  // Get student by ID
  static async getById(id) {
    const result = await pool.query(
      'SELECT * FROM students WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Get students by color keyword for a specific date
  static async getByColor(color, date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      `SELECT * FROM students
       WHERE is_active = true
       AND date = $1
       AND color_keyword = $2
       ORDER BY name`,
      [date, color]
    );
    return result.rows;
  }

  // Get students available for a specific time slot on a specific date
  static async getAvailableForTimeSlot(timeSlotId, date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      `SELECT * FROM students
       WHERE is_active = true
       AND date = $1
       AND availability @> $2::jsonb
       ORDER BY name`,
      [date, JSON.stringify([timeSlotId])]
    );
    return result.rows;
  }

  // Create a new student
  static async create(data) {
    const {
      name,
      english_name,
      availability = [],
      color_keyword,
      weakness_level,
      teacher_notes,
      date,
      first_start_date,
      schedule_days,
      schedule_pattern,
      // Program details
      school,
      program_start_date,
      program_end_date,
      // Student information
      student_id,
      gender,
      grade,
      student_type,
      // Level test scores
      reading_score,
      grammar_score,
      listening_score,
      writing_score,
      level_test_total,
      // Reading level initial
      wpm_initial,
      gbwt_initial,
      reading_level_initial,
      // Interview
      interview_score
    } = data;

    if (!date) {
      throw new Error('Date is required');
    }

    const result = await pool.query(
      `INSERT INTO students
       (name, english_name, availability, color_keyword, weakness_level, teacher_notes, date, first_start_date,
        school, program_start_date, program_end_date,
        student_id, gender, grade, student_type,
        reading_score, grammar_score, listening_score, writing_score, level_test_total,
        wpm_initial, gbwt_initial, reading_level_initial,
        interview_score, schedule_days, schedule_pattern)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
       RETURNING *`,
      [
        name?.trim(),
        english_name?.trim(),
        JSON.stringify(availability),
        color_keyword,
        weakness_level,
        teacher_notes,
        date,
        first_start_date,
        school,
        program_start_date,
        program_end_date,
        student_id,
        gender,
        grade,
        student_type,
        reading_score,
        grammar_score,
        listening_score,
        writing_score,
        level_test_total,
        wpm_initial,
        gbwt_initial,
        reading_level_initial,
        interview_score,
        schedule_days ? JSON.stringify(schedule_days) : null,
        schedule_pattern
      ]
    );
    return result.rows[0];
  }

  // Update a student
  static async update(id, data) {
    const {
      name,
      english_name,
      availability,
      color_keyword,
      weakness_level,
      teacher_notes,
      first_start_date,
      schedule_days,
      schedule_pattern,
      // Program details
      school,
      program_start_date,
      program_end_date,
      // Student information
      student_id,
      gender,
      grade,
      student_type,
      // Level test scores
      reading_score,
      grammar_score,
      listening_score,
      writing_score,
      level_test_total,
      // Reading level initial
      wpm_initial,
      gbwt_initial,
      reading_level_initial,
      // Interview
      interview_score
    } = data;

    const result = await pool.query(
      `UPDATE students
       SET name = COALESCE($1, name),
           english_name = $2,
           availability = COALESCE($3, availability),
           color_keyword = $4,
           weakness_level = $5,
           teacher_notes = $6,
           first_start_date = $7,
           school = $8,
           program_start_date = $9,
           program_end_date = $10,
           student_id = $11,
           gender = $12,
           grade = $13,
           student_type = $14,
           reading_score = $15,
           grammar_score = $16,
           listening_score = $17,
           writing_score = $18,
           level_test_total = $19,
           wpm_initial = $20,
           gbwt_initial = $21,
           reading_level_initial = $22,
           interview_score = $23,
           schedule_days = COALESCE($24, schedule_days),
           schedule_pattern = $25,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $26
       RETURNING *`,
      [
        name?.trim(),
        english_name?.trim(),
        availability ? JSON.stringify(availability) : null,
        color_keyword,
        weakness_level,
        teacher_notes,
        first_start_date,
        school,
        program_start_date,
        program_end_date,
        student_id,
        gender,
        grade,
        student_type,
        reading_score,
        grammar_score,
        listening_score,
        writing_score,
        level_test_total,
        wpm_initial,
        gbwt_initial,
        reading_level_initial,
        interview_score,
        schedule_days ? JSON.stringify(schedule_days) : null,
        schedule_pattern,
        id
      ]
    );
    return result.rows[0];
  }

  // Soft delete a student
  static async delete(id) {
    const result = await pool.query(
      `UPDATE students
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // Soft delete all students (DEPRECATED: Use deleteByDate instead)
  static async deleteAll() {
    const result = await pool.query(
      `UPDATE students
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true
       RETURNING *`
    );
    return { count: result.rowCount, students: result.rows };
  }

  // Soft delete all students for a specific date
  static async deleteByDate(date) {
    const result = await pool.query(
      `UPDATE students
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE date = $1 AND is_active = true
       RETURNING *`,
      [date]
    );
    return { count: result.rowCount, students: result.rows };
  }

  // Check if student is available for a specific date/time/slot
  static async checkAvailability(studentId, date, timeSlotId) {
    // Check if student has this time slot in their availability
    const availabilityCheck = await pool.query(
      `SELECT id FROM students
       WHERE id = $1
       AND is_active = true
       AND availability @> $2::jsonb`,
      [studentId, JSON.stringify([timeSlotId])]
    );

    if (availabilityCheck.rows.length === 0) {
      return { available: false, reason: 'Student not available at this time slot' };
    }

    // Check if student is already assigned at this date/time
    const conflictCheck = await pool.query(
      `SELECT a.id FROM assignments a
       INNER JOIN assignment_students ast ON a.id = ast.assignment_id
       WHERE ast.student_id = $1
       AND a.date = $2
       AND a.time_slot_id = $3
       AND a.is_active = true`,
      [studentId, date, timeSlotId]
    );

    if (conflictCheck.rows.length > 0) {
      return { available: false, reason: 'Student already assigned at this time' };
    }

    return { available: true };
  }
}

export default Student;
