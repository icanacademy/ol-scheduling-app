import pool from '../db/connection.js';

class Backup {
  // Get all backups with metadata
  static async getAll() {
    const result = await pool.query(
      'SELECT * FROM backup_metadata ORDER BY created_at DESC'
    );
    return result.rows;
  }

  // Get backup by filename
  static async getByFilename(filename) {
    const result = await pool.query(
      'SELECT * FROM backup_metadata WHERE filename = $1',
      [filename]
    );
    return result.rows[0];
  }

  // Create a new backup (serverless-compatible - stores data as JSON in database)
  static async create(description = null) {
    // Use Philippine Time (UTC+8) for timestamp
    const now = new Date();
    const phtOptions = { timeZone: 'Asia/Manila', hour12: false };
    const phtYear = now.toLocaleString('en-CA', { ...phtOptions, year: 'numeric' });
    const phtMonth = now.toLocaleString('en-CA', { ...phtOptions, month: '2-digit' });
    const phtDay = now.toLocaleString('en-CA', { ...phtOptions, day: '2-digit' });
    const phtHour = now.toLocaleString('en-GB', { ...phtOptions, hour: '2-digit' });
    const phtMinute = now.toLocaleString('en-GB', { ...phtOptions, minute: '2-digit' });
    const phtSecond = now.toLocaleString('en-GB', { ...phtOptions, second: '2-digit' });
    const timestamp = `${phtYear}-${phtMonth}-${phtDay}T${phtHour}-${phtMinute}-${phtSecond}`;
    const filename = `backup_${timestamp}.json`;

    // Get current counts
    const counts = await this.getCurrentCounts();

    // Export all data as JSON using SQL queries
    const backupData = await this.exportAllData();
    const backupJson = JSON.stringify(backupData);
    const fileSizeBytes = Buffer.byteLength(backupJson, 'utf8');

    // Store metadata and backup data in database
    const result = await pool.query(
      `INSERT INTO backup_metadata
       (filename, created_at, teachers_count, students_count, assignments_count, description, file_size_bytes, backup_data)
       VALUES ($1, NOW() AT TIME ZONE 'Asia/Manila', $2, $3, $4, $5, $6, $7)
       RETURNING id, filename, created_at, teachers_count, students_count, assignments_count, description, file_size_bytes`,
      [filename, counts.teachers, counts.students, counts.assignments, description, fileSizeBytes, backupJson]
    );

    return result.rows[0];
  }

  // Export all data from database as JSON
  static async exportAllData() {
    const teachers = await pool.query('SELECT * FROM teachers ORDER BY id');
    const students = await pool.query('SELECT * FROM students ORDER BY id');
    const assignments = await pool.query('SELECT * FROM assignments ORDER BY id');
    const assignmentTeachers = await pool.query('SELECT * FROM assignment_teachers ORDER BY id');
    const assignmentStudents = await pool.query('SELECT * FROM assignment_students ORDER BY id');
    const rooms = await pool.query('SELECT * FROM rooms ORDER BY id');
    const timeSlots = await pool.query('SELECT * FROM time_slots ORDER BY id');

    return {
      version: '2.0',
      exported_at: new Date().toISOString(),
      tables: {
        teachers: teachers.rows,
        students: students.rows,
        assignments: assignments.rows,
        assignment_teachers: assignmentTeachers.rows,
        assignment_students: assignmentStudents.rows,
        rooms: rooms.rows,
        time_slots: timeSlots.rows
      }
    };
  }

  // Get current database counts
  static async getCurrentCounts() {
    const teachersResult = await pool.query(
      'SELECT COUNT(*) FROM teachers WHERE is_active = true'
    );
    const studentsResult = await pool.query(
      'SELECT COUNT(*) FROM students WHERE is_active = true'
    );
    const assignmentsResult = await pool.query(
      'SELECT COUNT(*) FROM assignments WHERE is_active = true'
    );

    return {
      teachers: parseInt(teachersResult.rows[0].count),
      students: parseInt(studentsResult.rows[0].count),
      assignments: parseInt(assignmentsResult.rows[0].count)
    };
  }

  // Preview backup contents
  static async preview(filename) {
    // Get metadata from database
    const metadata = await this.getByFilename(filename);

    if (!metadata) {
      throw new Error('Backup not found');
    }

    return {
      filename: metadata.filename,
      created_at: metadata.created_at,
      teachers_count: metadata.teachers_count,
      students_count: metadata.students_count,
      assignments_count: metadata.assignments_count,
      description: metadata.description,
      file_size_bytes: metadata.file_size_bytes,
      file_size_mb: (metadata.file_size_bytes / 1024 / 1024).toFixed(2)
    };
  }

  // Get backup data for download
  static async getBackupData(filename) {
    const result = await pool.query(
      'SELECT backup_data FROM backup_metadata WHERE filename = $1',
      [filename]
    );

    if (!result.rows[0]) {
      throw new Error('Backup not found');
    }

    return result.rows[0].backup_data;
  }

  // Restore from backup (serverless-compatible)
  static async restore(filename, options = {}) {
    const {
      restoreTeachers = true,
      restoreStudents = true,
      restoreAssignments = true
    } = options;

    // Get backup data from database
    const result = await pool.query(
      'SELECT backup_data FROM backup_metadata WHERE filename = $1',
      [filename]
    );

    if (!result.rows[0] || !result.rows[0].backup_data) {
      throw new Error('Backup not found or has no data');
    }

    const backupData = typeof result.rows[0].backup_data === 'string'
      ? JSON.parse(result.rows[0].backup_data)
      : result.rows[0].backup_data;

    // Get counts before restore
    const beforeCounts = await this.getCurrentCounts();
    console.log(`\n=== Starting restore from ${filename} ===`);
    console.log(`Before restore: ${beforeCounts.teachers} teachers, ${beforeCounts.students} students, ${beforeCounts.assignments} assignments`);

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Clear existing data in correct order (respect foreign keys)
      if (restoreAssignments) {
        await client.query('DELETE FROM assignment_students');
        await client.query('DELETE FROM assignment_teachers');
        await client.query('DELETE FROM assignments');
      }
      if (restoreStudents) {
        await client.query('DELETE FROM students');
      }
      if (restoreTeachers) {
        await client.query('DELETE FROM teachers');
      }

      // Restore data
      const tables = backupData.tables;

      if (restoreTeachers && tables.teachers) {
        for (const row of tables.teachers) {
          await client.query(
            `INSERT INTO teachers (id, name, availability, color_keyword, date, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET name = $2, availability = $3, color_keyword = $4, date = $5, is_active = $6`,
            [row.id, row.name, JSON.stringify(row.availability), row.color_keyword, row.date, row.is_active, row.created_at, row.updated_at]
          );
        }
      }

      if (restoreStudents && tables.students) {
        for (const row of tables.students) {
          await client.query(
            `INSERT INTO students (id, name, english_name, availability, color_keyword, weakness_level, teacher_notes, date, is_active, created_at, updated_at, school, program_start_date, program_end_date, student_id, gender, grade, student_type, reading_score, grammar_score, listening_score, writing_score, reading_level, wpm, gbwt, subjects)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
             ON CONFLICT (id) DO UPDATE SET name = $2, english_name = $3, availability = $4, color_keyword = $5, weakness_level = $6, teacher_notes = $7, date = $8, is_active = $9`,
            [row.id, row.name, row.english_name, JSON.stringify(row.availability), row.color_keyword, row.weakness_level, row.teacher_notes, row.date, row.is_active, row.created_at, row.updated_at, row.school, row.program_start_date, row.program_end_date, row.student_id, row.gender, row.grade, row.student_type, row.reading_score, row.grammar_score, row.listening_score, row.writing_score, row.reading_level, row.wpm, row.gbwt, row.subjects]
          );
        }
      }

      if (restoreAssignments && tables.assignments) {
        for (const row of tables.assignments) {
          await client.query(
            `INSERT INTO assignments (id, date, time_slot_id, room_id, notes, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO UPDATE SET date = $2, time_slot_id = $3, room_id = $4, notes = $5, is_active = $6`,
            [row.id, row.date, row.time_slot_id, row.room_id, row.notes, row.is_active, row.created_at, row.updated_at]
          );
        }

        if (tables.assignment_teachers) {
          for (const row of tables.assignment_teachers) {
            await client.query(
              `INSERT INTO assignment_teachers (id, assignment_id, teacher_id, is_substitute)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (id) DO NOTHING`,
              [row.id, row.assignment_id, row.teacher_id, row.is_substitute]
            );
          }
        }

        if (tables.assignment_students) {
          for (const row of tables.assignment_students) {
            await client.query(
              `INSERT INTO assignment_students (id, assignment_id, student_id, submission_id)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (id) DO NOTHING`,
              [row.id, row.assignment_id, row.student_id, row.submission_id]
            );
          }
        }
      }

      await client.query('COMMIT');

      // Reset sequences
      await this.resetSequences();

      // Get counts after restore
      const afterCounts = await this.getCurrentCounts();
      console.log(`After restore: ${afterCounts.teachers} teachers, ${afterCounts.students} students, ${afterCounts.assignments} assignments`);

      return {
        success: true,
        message: 'Restore completed successfully',
        before: beforeCounts,
        after: afterCounts
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error(`✗ Restore failed: ${error.message}`);
      throw new Error(`Restore failed: ${error.message}`);
    } finally {
      client.release();
    }
  }

  // Clean up old backups (database only, no file system)
  static async cleanupOldBackups(keepCount = 30) {
    const result = await pool.query(
      'DELETE FROM backup_metadata WHERE id NOT IN (SELECT id FROM backup_metadata ORDER BY created_at DESC LIMIT $1) RETURNING filename',
      [keepCount]
    );

    return { deleted: result.rowCount };
  }

  // Get backup data for download (returns JSON string)
  static async getBackupForDownload(filename) {
    const result = await pool.query(
      'SELECT backup_data FROM backup_metadata WHERE filename = $1',
      [filename]
    );

    if (!result.rows[0]) {
      throw new Error('Backup not found');
    }

    return result.rows[0].backup_data;
  }

  // Reset all sequences after restore to prevent duplicate key errors
  static async resetSequences() {
    const sequences = [
      { table: 'teachers', sequence: 'teachers_id_seq' },
      { table: 'students', sequence: 'students_id_seq' },
      { table: 'assignments', sequence: 'assignments_id_seq' },
      { table: 'assignment_teachers', sequence: 'assignment_teachers_id_seq' },
      { table: 'assignment_students', sequence: 'assignment_students_id_seq' },
      { table: 'rooms', sequence: 'rooms_id_seq' },
      { table: 'time_slots', sequence: 'time_slots_id_seq' },
      { table: 'backup_metadata', sequence: 'backup_metadata_id_seq' }
    ];

    for (const { table, sequence } of sequences) {
      try {
        await pool.query(`SELECT setval('${sequence}', (SELECT COALESCE(MAX(id), 1) FROM ${table}))`);
        console.log(`  ✓ Reset ${sequence}`);
      } catch (error) {
        console.warn(`  ⚠ Could not reset ${sequence}: ${error.message}`);
      }
    }
  }

  // Delete a specific backup
  static async delete(filename) {
    const result = await pool.query(
      'DELETE FROM backup_metadata WHERE filename = $1 RETURNING filename',
      [filename]
    );

    if (result.rowCount === 0) {
      throw new Error('Backup not found');
    }

    return { success: true };
  }

  // Sync is no longer needed for serverless (backups are stored in DB)
  static async syncWithFiles() {
    return {
      message: 'Sync not needed - backups are stored in database',
      total_files: 0,
      added: 0,
      removed: 0,
      skipped: 0
    };
  }
}

export default Backup;
