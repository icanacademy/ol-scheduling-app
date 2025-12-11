import pool from '../db/connection.js';

class Room {
  // Get all rooms
  static async getAll() {
    const result = await pool.query(
      'SELECT * FROM rooms ORDER BY display_order'
    );
    return result.rows;
  }

  // Get room by ID
  static async getById(id) {
    const result = await pool.query(
      'SELECT * FROM rooms WHERE id = $1',
      [id]
    );
    return result.rows[0];
  }
}

export default Room;
