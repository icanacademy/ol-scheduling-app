import pool from '../db/connection.js';

class Teacher {
  // Get all teachers for a specific date
  static async getAll(date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      'SELECT * FROM teachers WHERE is_active = true AND date = $1 ORDER BY name',
      [date]
    );
    return result.rows;
  }

  // Find teacher by name and date (including inactive teachers)
  static async findByName(name, date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      'SELECT * FROM teachers WHERE LOWER(name) = LOWER($1) AND date = $2 LIMIT 1',
      [name, date]
    );
    return result.rows[0];
  }

  // Reactivate and update an existing teacher
  static async reactivate(id, data) {
    const { name, availability, color_keyword } = data;

    const result = await pool.query(
      `UPDATE teachers
       SET name = COALESCE($1, name),
           availability = COALESCE($2, availability),
           color_keyword = $3,
           is_active = true,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [
        name?.trim(),
        availability ? JSON.stringify(availability) : null,
        color_keyword,
        id
      ]
    );
    return result.rows[0];
  }

  // Get teacher by ID
  static async getById(id) {
    const result = await pool.query(
      'SELECT * FROM teachers WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }

  // Get teachers available for a specific time slot on a specific date
  static async getAvailableForTimeSlot(timeSlotId, date) {
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      `SELECT * FROM teachers
       WHERE is_active = true
       AND date = $1
       AND availability @> $2::jsonb
       ORDER BY name`,
      [date, JSON.stringify([timeSlotId])]
    );
    return result.rows;
  }

  // Create a new teacher
  static async create(data) {
    const { name, availability = [], color_keyword = null, date } = data;
    if (!date) {
      throw new Error('Date is required');
    }
    const result = await pool.query(
      `INSERT INTO teachers (name, availability, color_keyword, date)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name?.trim(), JSON.stringify(availability), color_keyword, date]
    );
    return result.rows[0];
  }

  // Update a teacher
  static async update(id, data) {
    const { name, availability, color_keyword } = data;
    const result = await pool.query(
      `UPDATE teachers
       SET name = COALESCE($1, name),
           availability = COALESCE($2, availability),
           color_keyword = $3,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name?.trim(), availability ? JSON.stringify(availability) : null, color_keyword, id]
    );
    return result.rows[0];
  }

  // Soft delete a teacher
  static async delete(id) {
    const result = await pool.query(
      `UPDATE teachers
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // Soft delete all teachers (DEPRECATED: Use deleteByDate instead)
  static async deleteAll() {
    const result = await pool.query(
      `UPDATE teachers
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE is_active = true
       RETURNING *`
    );
    return { count: result.rowCount, teachers: result.rows };
  }

  // Soft delete all teachers for a specific date
  static async deleteByDate(date) {
    const result = await pool.query(
      `UPDATE teachers
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE date = $1 AND is_active = true
       RETURNING *`,
      [date]
    );
    return { count: result.rowCount, teachers: result.rows };
  }

  // Check if teacher is available for a specific date/time/slot
  static async checkAvailability(teacherId, date, timeSlotId) {
    // Check if teacher has this time slot in their availability
    const availabilityCheck = await pool.query(
      `SELECT id FROM teachers
       WHERE id = $1
       AND is_active = true
       AND availability @> $2::jsonb`,
      [teacherId, JSON.stringify([timeSlotId])]
    );

    if (availabilityCheck.rows.length === 0) {
      return { available: false, reason: 'Teacher not available at this time slot' };
    }

    // Check if teacher is already assigned at this date/time
    const conflictCheck = await pool.query(
      `SELECT a.id FROM assignments a
       INNER JOIN assignment_teachers at ON a.id = at.assignment_id
       WHERE at.teacher_id = $1
       AND a.date = $2
       AND a.time_slot_id = $3
       AND a.is_active = true`,
      [teacherId, date, timeSlotId]
    );

    if (conflictCheck.rows.length > 0) {
      return { available: false, reason: 'Teacher already assigned at this time' };
    }

    return { available: true };
  }
}

export default Teacher;
