import pool from '../db/connection.js';

class TimeSlot {
  // Get all time slots
  static async getAll() {
    const result = await pool.query(
      'SELECT * FROM time_slots ORDER BY display_order'
    );
    return result.rows;
  }

  // Get time slot by ID
  static async getById(id) {
    const result = await pool.query(
      'SELECT * FROM time_slots WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
}

export default TimeSlot;
