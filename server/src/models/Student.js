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

  // Get all active students across all dates (allows duplicate names if they're different people)
  // Used by attendance app which needs to see all students including those with same names
  // Deduplicates by notion_page_id (primary) or name+korean_name (fallback)
  // This ensures: same person on different dates = 1 row, different people with same name = multiple rows
  static async getAllActive() {
    const result = await pool.query(
      `SELECT DISTINCT ON (
         COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, ''))
       ) *
       FROM students
       WHERE is_active = true
       ORDER BY COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')),
                (CASE WHEN first_start_date IS NOT NULL THEN 0 ELSE 1 END),
                id ASC`
    );
    return result.rows;
  }

  // Get all students for directory with their assignments info
  // For On Hold/Finished students, uses saved snapshot values instead of live assignment data
  static async getDirectory() {
    const result = await pool.query(
      `WITH active_student_ids AS (
         -- Only aggregate for students that aren't stopped/finished (they use snapshots)
         SELECT id FROM students
         WHERE is_active = true AND COALESCE(status, 'Active') NOT IN ('Stopped', 'Finished')
       ),
       student_schedules AS (
         SELECT
           ast.student_id,
           array_agg(DISTINCT a.date ORDER BY a.date) as class_days,
           array_agg(DISTINCT ts.name ORDER BY ts.name) as class_times
         FROM assignment_students ast
         JOIN active_student_ids asi ON asi.id = ast.student_id
         JOIN assignments a ON ast.assignment_id = a.id AND a.is_active = true
         JOIN time_slots ts ON a.time_slot_id = ts.id
         GROUP BY ast.student_id
       ),
       student_teachers AS (
         SELECT
           ast.student_id,
           array_agg(DISTINCT t.name ORDER BY t.name) as teacher_names
         FROM assignment_students ast
         JOIN active_student_ids asi ON asi.id = ast.student_id
         JOIN assignments a ON ast.assignment_id = a.id AND a.is_active = true
         JOIN assignment_teachers ateach ON a.id = ateach.assignment_id
         JOIN teachers t ON ateach.teacher_id = t.id AND t.is_active = true
         GROUP BY ast.student_id
       ),
       student_subjects AS (
         SELECT
           ast.student_id,
           array_agg(DISTINCT a.subject ORDER BY a.subject) FILTER (WHERE a.subject IS NOT NULL AND a.subject != '') as subject_names
         FROM assignment_students ast
         JOIN active_student_ids asi ON asi.id = ast.student_id
         JOIN assignments a ON ast.assignment_id = a.id AND a.is_active = true
         GROUP BY ast.student_id
       )
       SELECT DISTINCT ON (LOWER(s.name))
         s.id,
         s.name,
         s.english_name,
         s.korean_name,
         s.grade,
         s.country,
         CASE
           WHEN s.status = 'Finished' THEN 'Finished'
           WHEN s.status = 'New' THEN 'New'
           WHEN s.status = 'Stopped' THEN 'On Hold'
           WHEN s.availability IS NULL OR s.availability = '[]'::jsonb THEN 'On Hold'
           ELSE COALESCE(s.status, 'Active')
         END as status,
         COALESCE(subj.subject_names, ARRAY[]::text[]) as subjects,
         s.program_start_date,
         s.program_end_date,
         CASE
           WHEN s.status IN ('Stopped', 'Finished') AND s.saved_class_days IS NOT NULL AND s.saved_class_days != '[]'::jsonb
           THEN ARRAY(SELECT jsonb_array_elements_text(s.saved_class_days))
           ELSE COALESCE(ss.class_days, ARRAY[]::text[])
         END as schedule_days,
         CASE
           WHEN s.status IN ('Stopped', 'Finished') AND s.saved_class_times IS NOT NULL AND s.saved_class_times != '[]'::jsonb
           THEN ARRAY(SELECT jsonb_array_elements_text(s.saved_class_times))
           ELSE COALESCE(ss.class_times, ARRAY[]::text[])
         END as class_times,
         CASE
           WHEN s.status IN ('Stopped', 'Finished') AND s.saved_teachers IS NOT NULL AND s.saved_teachers != '[]'::jsonb
           THEN ARRAY(SELECT jsonb_array_elements_text(s.saved_teachers))
           ELSE COALESCE(st.teacher_names, ARRAY[]::text[])
         END as assigned_teachers,
         s.schedule_pattern,
         s.student_type,
         s.created_at,
         s.updated_at
       FROM students s
       LEFT JOIN student_schedules ss ON s.id = ss.student_id
       LEFT JOIN student_teachers st ON s.id = st.student_id
       LEFT JOIN student_subjects subj ON s.id = subj.student_id
       WHERE s.is_active = true
       ORDER BY LOWER(s.name),
                (CASE WHEN s.first_start_date IS NOT NULL THEN 0 ELSE 1 END),
                s.id ASC`
    );
    return result.rows;
  }

  // Update student status (updates all records with the same name for directory consistency)
  // When status changes to "On Hold" or "Finished", snapshots schedule data and removes from assignments
  static async updateStatus(id, status) {
    // Map "On Hold" to "Stopped" for database storage (Students tab uses "Stopped")
    const dbStatus = status === 'On Hold' ? 'Stopped' : status;

    // Combined query: get student name + all IDs with same name in one shot
    const studentResult = await pool.query(
      `SELECT s2.id, s1.name
       FROM students s1
       JOIN students s2 ON LOWER(s2.name) = LOWER(s1.name) AND s2.is_active = true
       WHERE s1.id = $1`,
      [id]
    );

    if (studentResult.rows.length === 0) {
      return null;
    }

    const studentName = studentResult.rows[0].name;
    const studentIds = studentResult.rows.map(r => r.id);

    // If changing to On Hold or Finished, snapshot schedule and remove from assignments
    if (status === 'On Hold' || status === 'Finished') {
      // Run both snapshot queries in parallel
      const [scheduleSnapshot, teacherSnapshot] = await Promise.all([
        pool.query(
          `SELECT
             array_agg(DISTINCT a.date ORDER BY a.date) as class_days,
             array_agg(DISTINCT ts.name ORDER BY ts.name) as class_times
           FROM assignment_students ast
           JOIN assignments a ON ast.assignment_id = a.id AND a.is_active = true
           JOIN time_slots ts ON a.time_slot_id = ts.id
           WHERE ast.student_id = ANY($1)`,
          [studentIds]
        ),
        pool.query(
          `SELECT array_agg(DISTINCT t.name ORDER BY t.name) as teacher_names
           FROM assignment_students ast
           JOIN assignments a ON ast.assignment_id = a.id AND a.is_active = true
           JOIN assignment_teachers ateach ON a.id = ateach.assignment_id
           JOIN teachers t ON ateach.teacher_id = t.id AND t.is_active = true
           WHERE ast.student_id = ANY($1)`,
          [studentIds]
        ),
      ]);

      const classDays = scheduleSnapshot.rows[0]?.class_days || [];
      const classTimes = scheduleSnapshot.rows[0]?.class_times || [];
      const teachers = teacherSnapshot.rows[0]?.teacher_names || [];

      // Save snapshot + update status + clear availability in one UPDATE
      await pool.query(
        `UPDATE students
         SET saved_class_days = $1::jsonb,
             saved_class_times = $2::jsonb,
             saved_teachers = $3::jsonb,
             availability = '[]'::jsonb,
             status = $4,
             updated_at = CURRENT_TIMESTAMP
         WHERE LOWER(name) = LOWER($5) AND is_active = true
         RETURNING *`,
        [JSON.stringify(classDays), JSON.stringify(classTimes), JSON.stringify(teachers), dbStatus, studentName]
      );

      // Remove student from assignments + clean up empty assignments
      await pool.query(
        `DELETE FROM assignment_students WHERE student_id = ANY($1)`,
        [studentIds]
      );
      await pool.query(
        `UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP
         WHERE is_active = true
         AND NOT EXISTS (SELECT 1 FROM assignment_students WHERE assignment_id = assignments.id)`
      );

      // Return the updated student
      const updated = await pool.query('SELECT * FROM students WHERE id = $1', [id]);
      return updated.rows[0];
    }

    // For non-hold/finished status changes, just update status
    const result = await pool.query(
      `UPDATE students
       SET status = $1, updated_at = CURRENT_TIMESTAMP
       WHERE LOWER(name) = LOWER($2) AND is_active = true
       RETURNING *`,
      [dbStatus, studentName]
    );

    return result.rows[0];
  }

  // Update student directory fields (country, status, etc.)
  static async updateDirectoryFields(id, data) {
    const { country, status, grade, program_start_date, program_end_date, schedule_days } = data;
    // Map "On Hold" to "Stopped" for database storage (Students tab uses "Stopped")
    const dbStatus = status === 'On Hold' ? 'Stopped' : status;

    const result = await pool.query(
      `UPDATE students
       SET country = COALESCE($1, country),
           status = COALESCE($2, status),
           grade = COALESCE($3, grade),
           program_start_date = COALESCE($4, program_start_date),
           program_end_date = COALESCE($5, program_end_date),
           schedule_days = COALESCE($6, schedule_days),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND is_active = true
       RETURNING *`,
      [country, dbStatus, grade, program_start_date, program_end_date, schedule_days ? JSON.stringify(schedule_days) : null, id]
    );
    return result.rows[0];
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

  // Find student by Notion page ID (for import deduplication)
  static async findByNotionPageId(notionPageId) {
    if (!notionPageId) {
      return null;
    }
    const result = await pool.query(
      'SELECT * FROM students WHERE notion_page_id = $1 LIMIT 1',
      [notionPageId]
    );
    return result.rows[0];
  }

  // Find all existing students by Notion page IDs (batch lookup for import)
  static async findByNotionPageIds(notionPageIds) {
    if (!notionPageIds || notionPageIds.length === 0) return [];
    const result = await pool.query(
      'SELECT id, notion_page_id FROM students WHERE notion_page_id = ANY($1)',
      [notionPageIds]
    );
    return result.rows;
  }

  // Batch create multiple students in a single query
  static async createBatch(studentsData) {
    if (!studentsData || studentsData.length === 0) return [];

    const columns = [
      'name', 'english_name', 'korean_name', 'availability', 'color_keyword',
      'weakness_level', 'teacher_notes', 'date', 'first_start_date',
      'school', 'program_start_date', 'program_end_date',
      'student_id', 'gender', 'grade', 'student_type', 'country',
      'reading_score', 'grammar_score', 'listening_score', 'writing_score', 'level_test_total',
      'wpm_initial', 'gbwt_initial', 'reading_level_initial',
      'interview_score', 'schedule_days', 'schedule_pattern', 'notion_page_id'
    ];
    const paramsPerRow = columns.length;
    const valuePlaceholders = studentsData.map((_, rowIdx) => {
      const offset = rowIdx * paramsPerRow;
      return `(${columns.map((_, colIdx) => `$${offset + colIdx + 1}`).join(', ')})`;
    }).join(', ');

    const params = [];
    for (const data of studentsData) {
      params.push(
        data.name?.trim() || null,
        data.english_name?.trim() || null,
        data.korean_name?.trim() || null,
        JSON.stringify(data.availability || []),
        data.color_keyword || null,
        data.weakness_level || null,
        data.teacher_notes || null,
        data.date,
        data.first_start_date || null,
        data.school || null,
        data.program_start_date || null,
        data.program_end_date || null,
        data.student_id || null,
        data.gender || null,
        data.grade || null,
        data.student_type || null,
        data.country || null,
        data.reading_score || null,
        data.grammar_score || null,
        data.listening_score || null,
        data.writing_score || null,
        data.level_test_total || null,
        data.wpm_initial || null,
        data.gbwt_initial || null,
        data.reading_level_initial || null,
        data.interview_score || null,
        data.schedule_days ? JSON.stringify(data.schedule_days) : null,
        data.schedule_pattern || null,
        data.notion_page_id || null
      );
    }

    const result = await pool.query(
      `INSERT INTO students (${columns.join(', ')}) VALUES ${valuePlaceholders} RETURNING *`,
      params
    );
    return result.rows;
  }

  // Batch reactivate multiple students by their IDs
  static async reactivateBatch(updates) {
    if (!updates || updates.length === 0) return [];
    const results = [];
    // Use a single transaction for all updates
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const { id, data } of updates) {
        const result = await client.query(
          `UPDATE students
           SET name = COALESCE($1, name),
               korean_name = COALESCE($2, korean_name),
               availability = COALESCE($3, availability),
               color_keyword = $4,
               date = $5,
               grade = COALESCE($6, grade),
               country = COALESCE($7, country),
               schedule_days = COALESCE($8, schedule_days),
               schedule_pattern = $9,
               notion_page_id = COALESCE($10, notion_page_id),
               is_active = true,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $11
           RETURNING *`,
          [
            data.name?.trim(), data.korean_name?.trim() || null,
            data.availability ? JSON.stringify(data.availability) : null,
            data.color_keyword || null, data.date,
            data.grade || null, data.country || null,
            data.schedule_days ? JSON.stringify(data.schedule_days) : null,
            data.schedule_pattern || null, data.notion_page_id || null, id
          ]
        );
        if (result.rows[0]) results.push(result.rows[0]);
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    return results;
  }

  // Reactivate and update an existing student
  static async reactivate(id, data) {
    const {
      name,
      english_name,
      korean_name,
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
      country,
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
           english_name = COALESCE($2, english_name),
           korean_name = COALESCE($3, korean_name),
           availability = COALESCE($4, availability),
           color_keyword = $5,
           weakness_level = $6,
           teacher_notes = $7,
           first_start_date = $8,
           school = $9,
           program_start_date = $10,
           program_end_date = $11,
           student_id = $12,
           gender = $13,
           grade = $14,
           student_type = $15,
           country = COALESCE($16, country),
           reading_score = $17,
           grammar_score = $18,
           listening_score = $19,
           writing_score = $20,
           level_test_total = $21,
           wpm_initial = $22,
           gbwt_initial = $23,
           reading_level_initial = $24,
           interview_score = $25,
           schedule_days = COALESCE($26, schedule_days),
           schedule_pattern = $27,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $28
       RETURNING *`,
      [
        name?.trim(),
        english_name?.trim(),
        korean_name?.trim(),
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
        country,
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
      korean_name,
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
      country,
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
      interview_score,
      // Notion tracking
      notion_page_id
    } = data;

    if (!date) {
      throw new Error('Date is required');
    }

    const result = await pool.query(
      `INSERT INTO students
       (name, english_name, korean_name, availability, color_keyword, weakness_level, teacher_notes, date, first_start_date,
        school, program_start_date, program_end_date,
        student_id, gender, grade, student_type, country,
        reading_score, grammar_score, listening_score, writing_score, level_test_total,
        wpm_initial, gbwt_initial, reading_level_initial,
        interview_score, schedule_days, schedule_pattern, notion_page_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29)
       RETURNING *`,
      [
        name?.trim(),
        english_name?.trim(),
        korean_name?.trim(),
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
        country,
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
        notion_page_id
      ]
    );
    return result.rows[0];
  }

  // Update a student
  static async update(id, data) {
    const {
      name,
      english_name,
      korean_name,
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
           english_name = COALESCE($2, english_name),
           korean_name = COALESCE($3, korean_name),
           availability = COALESCE($4, availability),
           color_keyword = $5,
           weakness_level = $6,
           teacher_notes = $7,
           first_start_date = $8,
           school = $9,
           program_start_date = $10,
           program_end_date = $11,
           student_id = $12,
           gender = $13,
           grade = $14,
           student_type = $15,
           reading_score = $16,
           grammar_score = $17,
           listening_score = $18,
           writing_score = $19,
           level_test_total = $20,
           wpm_initial = $21,
           gbwt_initial = $22,
           reading_level_initial = $23,
           interview_score = $24,
           schedule_days = COALESCE($25, schedule_days),
           schedule_pattern = $26,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $27
       RETURNING *`,
      [
        name?.trim(),
        english_name?.trim(),
        korean_name?.trim(),
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

  // Soft delete a student and all their records across all dates
  // Also cleans up assignment_students and orphaned assignments (like updateStatus does)
  static async delete(id) {
    // First, get the student to find their identifying info
    const student = await pool.query(
      'SELECT id, name, korean_name, notion_page_id FROM students WHERE id = $1',
      [id]
    );

    if (student.rows.length === 0) {
      return null;
    }

    const { name, korean_name, notion_page_id } = student.rows[0];

    // Find all student IDs that will be deactivated
    let allIdsResult;
    if (notion_page_id) {
      allIdsResult = await pool.query(
        'SELECT id FROM students WHERE notion_page_id = $1 AND is_active = true',
        [notion_page_id]
      );
    } else {
      allIdsResult = await pool.query(
        `SELECT id FROM students WHERE LOWER(name) = LOWER($1)
         AND (korean_name = $2 OR (korean_name IS NULL AND $2 IS NULL))
         AND is_active = true`,
        [name, korean_name]
      );
    }
    const studentIds = allIdsResult.rows.map(r => r.id);

    if (studentIds.length === 0) return null;

    // Soft-delete all matching student records
    const result = await pool.query(
      `UPDATE students SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = ANY($1) RETURNING *`,
      [studentIds]
    );

    // Clean up assignment_students entries for deleted students
    await pool.query(
      'DELETE FROM assignment_students WHERE student_id = ANY($1)',
      [studentIds]
    );

    // Soft-delete any assignments that now have no students left
    await pool.query(
      `UPDATE assignments SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true
       AND NOT EXISTS (SELECT 1 FROM assignment_students WHERE assignment_id = assignments.id)`
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
