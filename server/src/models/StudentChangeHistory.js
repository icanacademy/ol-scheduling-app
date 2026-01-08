import pool from '../db/connection.js';

class StudentChangeHistory {
  // Create a new change history entry
  static async create(data) {
    const {
      student_id,
      change_type,
      change_date,
      implementation_date,
      change_description,
      old_teacher_names,
      old_time_slot,
      old_days,
      old_subject,
      new_teacher_names,
      new_time_slot,
      new_days,
      new_subject,
      reason,
      notes,
      recorded_by = 'system'
    } = data;

    const result = await pool.query(
      `INSERT INTO student_change_history
       (student_id, change_type, change_date, implementation_date, change_description,
        old_teacher_names, old_time_slot, old_days, old_subject,
        new_teacher_names, new_time_slot, new_days, new_subject,
        reason, notes, recorded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        student_id,
        change_type,
        change_date,
        implementation_date || null,
        change_description || null,
        old_teacher_names || null,
        old_time_slot || null,
        old_days || null,
        old_subject || null,
        new_teacher_names || null,
        new_time_slot || null,
        new_days || null,
        new_subject || null,
        reason || null,
        notes || null,
        recorded_by
      ]
    );

    return result.rows[0];
  }

  // Get all change history for a specific student
  static async getByStudentId(studentId) {
    const result = await pool.query(
      `SELECT * FROM student_change_history 
       WHERE student_id = $1 
       ORDER BY change_date DESC, created_at DESC`,
      [studentId]
    );
    
    return result.rows;
  }

  // Get change history by date range
  static async getByDateRange(studentId, startDate, endDate) {
    const result = await pool.query(
      `SELECT * FROM student_change_history 
       WHERE student_id = $1 
       AND change_date >= $2 
       AND change_date <= $3
       ORDER BY change_date DESC, created_at DESC`,
      [studentId, startDate, endDate]
    );
    
    return result.rows;
  }

  // Get change history by type
  static async getByChangeType(studentId, changeType) {
    const result = await pool.query(
      `SELECT * FROM student_change_history 
       WHERE student_id = $1 
       AND change_type = $2
       ORDER BY change_date DESC, created_at DESC`,
      [studentId, changeType]
    );
    
    return result.rows;
  }

  // Get recent changes across all students (for admin view)
  static async getRecentChanges(limit = 50) {
    const result = await pool.query(
      `SELECT sch.*, s.name as student_name, s.english_name as student_english_name
       FROM student_change_history sch
       JOIN students s ON sch.student_id = s.id
       ORDER BY sch.created_at DESC
       LIMIT $1`,
      [limit]
    );
    
    return result.rows;
  }

  // Delete a change history entry
  static async delete(id) {
    const result = await pool.query(
      'DELETE FROM student_change_history WHERE id = $1 RETURNING *',
      [id]
    );
    
    return result.rows[0];
  }

  // Update a change history entry (for corrections)
  static async update(id, data) {
    const {
      change_description,
      reason,
      notes
    } = data;

    const result = await pool.query(
      `UPDATE student_change_history 
       SET change_description = COALESCE($1, change_description),
           reason = COALESCE($2, reason),
           notes = COALESCE($3, notes),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [change_description, reason, notes, id]
    );
    
    return result.rows[0];
  }

  // Automatically record a change when assignment is modified
  static async recordAssignmentChange(oldAssignment, newAssignment, studentId) {
    // Extract teacher names
    const oldTeacherNames = oldAssignment?.teachers?.map(t => t.name) || [];
    const newTeacherNames = newAssignment?.teachers?.map(t => t.name) || [];
    
    // Determine change type and build description
    let changeType = 'other';
    let changeDescription = '';
    
    // Check what changed
    const teachersChanged = JSON.stringify(oldTeacherNames.sort()) !== JSON.stringify(newTeacherNames.sort());
    const timeChanged = oldAssignment?.time_slot_id !== newAssignment?.time_slot_id;
    const subjectChanged = oldAssignment?.subject !== newAssignment?.subject;
    
    if (teachersChanged && timeChanged) {
      changeType = 'teacher_and_time_change';
      changeDescription = `Teacher and time changed`;
    } else if (teachersChanged) {
      changeType = 'teacher_change';
      changeDescription = `Teacher changed from ${oldTeacherNames.join(', ') || 'none'} to ${newTeacherNames.join(', ') || 'none'}`;
    } else if (timeChanged) {
      changeType = 'time_change';
      changeDescription = `Time slot changed`;
    } else if (subjectChanged) {
      changeType = 'subject_change';
      changeDescription = `Subject changed from "${oldAssignment?.subject || 'none'}" to "${newAssignment?.subject || 'none'}"`;
    }
    
    // Only record if there was a meaningful change
    if (changeType !== 'other') {
      await this.create({
        student_id: studentId,
        change_type: changeType,
        change_date: newAssignment.date || new Date().toISOString().split('T')[0],
        change_description: changeDescription,
        old_teacher_names: oldTeacherNames,
        old_time_slot: oldAssignment?.time_slot_id?.toString(),
        old_subject: oldAssignment?.subject,
        new_teacher_names: newTeacherNames,
        new_time_slot: newAssignment?.time_slot_id?.toString(),
        new_subject: newAssignment?.subject,
        recorded_by: 'system'
      });
    }
  }
}

export default StudentChangeHistory;