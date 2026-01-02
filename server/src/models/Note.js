import pool from '../db/connection.js';

class Note {
  // Get all notes, optionally filter by status
  static async getAll(status = null) {
    let query = 'SELECT * FROM notes WHERE is_active = true';
    const params = [];

    if (status && ['open', 'completed'].includes(status)) {
      query += ' AND status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC';

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
    const { title, description = null, priority = 'normal', color_keyword = null } = data;

    if (!title || !title.trim()) {
      throw new Error('Title is required');
    }

    const result = await pool.query(
      `INSERT INTO notes (title, description, priority, color_keyword)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [title.trim(), description?.trim() || null, priority, color_keyword]
    );
    return result.rows[0];
  }

  // Update note
  static async update(id, data) {
    const { title, description, priority, color_keyword } = data;

    const result = await pool.query(
      `UPDATE notes
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           priority = COALESCE($3, priority),
           color_keyword = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5 AND is_active = true
       RETURNING *`,
      [title?.trim(), description?.trim(), priority, color_keyword, id]
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
