import pool from '../db/connection.js';

class Note {
  // Get all notes, optionally filter by status and date
  static async getAll(status = null, date = null) {
    let query = 'SELECT * FROM notes WHERE is_active = true';
    const params = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }

    if (status && ['open', 'completed'].includes(status)) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ' ORDER BY priority DESC, created_at DESC';

    const result = await pool.query(query, params);
    return result.rows;
  }

  // Get note by ID
  static async getById(id) {
    const result = await pool.query(
      'SELECT * FROM notes WHERE id = $1 AND is_active = true',
      [id]
    );
    return result.rows[0];
  }

  // Create new note
  static async create(data) {
    const { title, description = null, priority = 'normal', color_keyword = null, date = null } = data;

    if (!title || !title.trim()) {
      throw new Error('Title is required');
    }

    const result = await pool.query(
      `INSERT INTO notes (title, description, priority, color_keyword, date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [title.trim(), description?.trim() || null, priority, color_keyword, date]
    );
    return result.rows[0];
  }

  // Update note
  static async update(id, data) {
    const { title, description, priority, color_keyword, date } = data;

    const result = await pool.query(
      `UPDATE notes
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           priority = COALESCE($3, priority),
           color_keyword = $4,
           date = COALESCE($5, date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 AND is_active = true
       RETURNING *`,
      [title?.trim(), description?.trim(), priority, color_keyword, date, id]
    );
    return result.rows[0];
  }

  // Toggle note status between open and completed
  static async toggleStatus(id) {
    const result = await pool.query(
      `UPDATE notes
       SET status = CASE WHEN status = 'open' THEN 'completed' ELSE 'open' END,
           completed_at = CASE WHEN status = 'open' THEN CURRENT_TIMESTAMP ELSE NULL END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND is_active = true
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // Soft delete note
  static async delete(id) {
    const result = await pool.query(
      `UPDATE notes
       SET is_active = false, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id]
    );
    return result.rows[0];
  }

  // Get counts by status
  static async getCounts() {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = true) as total,
         COUNT(*) FILTER (WHERE status = 'open' AND is_active = true) as open,
         COUNT(*) FILTER (WHERE status = 'completed' AND is_active = true) as completed
       FROM notes`
    );
    return result.rows[0];
  }
}

export default Note;
