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
    const [teachers, students, assignments, assignmentTeachers, assignmentStudents, rooms, timeSlots] =
      await Promise.all([
        pool.query('SELECT * FROM teachers ORDER BY id'),
        pool.query('SELECT * FROM students ORDER BY id'),
        pool.query('SELECT * FROM assignments ORDER BY id'),
        pool.query('SELECT * FROM assignment_teachers ORDER BY id'),
        pool.query('SELECT * FROM assignment_students ORDER BY id'),
        pool.query('SELECT * FROM rooms ORDER BY id'),
        pool.query('SELECT * FROM time_slots ORDER BY id'),
      ]);

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
    const result = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM teachers WHERE is_active = true) as teachers,
        (SELECT COUNT(*) FROM students WHERE is_active = true) as students,
        (SELECT COUNT(*) FROM assignments WHERE is_active = true) as assignments`
    );

    return {
      teachers: parseInt(result.rows[0].teachers),
      students: parseInt(result.rows[0].students),
      assignments: parseInt(result.rows[0].assignments)
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

      // Convert old date format (2024-01-01 through 2024-01-07) to day names
      const oldDateToDayName = {
        '2024-01-01': 'Monday',
        '2024-01-02': 'Tuesday',
        '2024-01-03': 'Wednesday',
        '2024-01-04': 'Thursday',
        '2024-01-05': 'Friday',
        '2024-01-06': 'Saturday',
        '2024-01-07': 'Sunday'
      };
      const convertDate = (dateVal) => {
        if (!dateVal) return dateVal;
        const dateStr = typeof dateVal === 'object' && dateVal instanceof Date
          ? dateVal.toISOString().split('T')[0]
          : String(dateVal).split('T')[0];
        return oldDateToDayName[dateStr] || dateStr;
      };

      // Apply date conversion to all tables with date columns
      if (tables.teachers) {
        tables.teachers.forEach(row => { row.date = convertDate(row.date); });
      }
      if (tables.students) {
        tables.students.forEach(row => { row.date = convertDate(row.date); });
      }
      if (tables.assignments) {
        tables.assignments.forEach(row => { row.date = convertDate(row.date); });
      }

      const BATCH_SIZE = 50;

      if (restoreTeachers && tables.teachers) {
        for (let i = 0; i < tables.teachers.length; i += BATCH_SIZE) {
          const batch = tables.teachers.slice(i, i + BATCH_SIZE);
          const placeholders = batch.map((_, idx) =>
            `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`
          ).join(', ');
          const params = batch.flatMap(row => [
            row.id, row.name, JSON.stringify(row.availability), row.color_keyword, row.date, row.is_active, row.created_at, row.updated_at
          ]);
          await client.query(
            `INSERT INTO teachers (id, name, availability, color_keyword, date, is_active, created_at, updated_at)
             VALUES ${placeholders}
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, availability = EXCLUDED.availability, color_keyword = EXCLUDED.color_keyword, date = EXCLUDED.date, is_active = EXCLUDED.is_active`,
            params
          );
        }
      }

      if (restoreStudents && tables.students) {
        for (let i = 0; i < tables.students.length; i += BATCH_SIZE) {
          const batch = tables.students.slice(i, i + BATCH_SIZE);
          const cols = 26;
          const placeholders = batch.map((_, idx) =>
            `(${Array.from({ length: cols }, (__, c) => `$${idx * cols + c + 1}`).join(', ')})`
          ).join(', ');
          const params = batch.flatMap(row => [
            row.id, row.name, row.english_name, JSON.stringify(row.availability), row.color_keyword, row.weakness_level, row.teacher_notes, row.date, row.is_active, row.created_at, row.updated_at, row.school, row.program_start_date, row.program_end_date, row.student_id, row.gender, row.grade, row.student_type, row.reading_score, row.grammar_score, row.listening_score, row.writing_score, row.reading_level, row.wpm, row.gbwt, row.subjects
          ]);
          await client.query(
            `INSERT INTO students (id, name, english_name, availability, color_keyword, weakness_level, teacher_notes, date, is_active, created_at, updated_at, school, program_start_date, program_end_date, student_id, gender, grade, student_type, reading_score, grammar_score, listening_score, writing_score, reading_level, wpm, gbwt, subjects)
             VALUES ${placeholders}
             ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, english_name = EXCLUDED.english_name, availability = EXCLUDED.availability, color_keyword = EXCLUDED.color_keyword, weakness_level = EXCLUDED.weakness_level, teacher_notes = EXCLUDED.teacher_notes, date = EXCLUDED.date, is_active = EXCLUDED.is_active`,
            params
          );
        }
      }

      if (restoreAssignments && tables.assignments) {
        for (let i = 0; i < tables.assignments.length; i += BATCH_SIZE) {
          const batch = tables.assignments.slice(i, i + BATCH_SIZE);
          const placeholders = batch.map((_, idx) =>
            `($${idx * 8 + 1}, $${idx * 8 + 2}, $${idx * 8 + 3}, $${idx * 8 + 4}, $${idx * 8 + 5}, $${idx * 8 + 6}, $${idx * 8 + 7}, $${idx * 8 + 8})`
          ).join(', ');
          const params = batch.flatMap(row => [
            row.id, row.date, row.time_slot_id, row.room_id, row.notes, row.is_active, row.created_at, row.updated_at
          ]);
          await client.query(
            `INSERT INTO assignments (id, date, time_slot_id, room_id, notes, is_active, created_at, updated_at)
             VALUES ${placeholders}
             ON CONFLICT (id) DO UPDATE SET date = EXCLUDED.date, time_slot_id = EXCLUDED.time_slot_id, room_id = EXCLUDED.room_id, notes = EXCLUDED.notes, is_active = EXCLUDED.is_active`,
            params
          );
        }

        if (tables.assignment_teachers) {
          for (let i = 0; i < tables.assignment_teachers.length; i += BATCH_SIZE) {
            const batch = tables.assignment_teachers.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map((_, idx) =>
              `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`
            ).join(', ');
            const params = batch.flatMap(row => [row.id, row.assignment_id, row.teacher_id, row.is_substitute]);
            await client.query(
              `INSERT INTO assignment_teachers (id, assignment_id, teacher_id, is_substitute)
               VALUES ${placeholders}
               ON CONFLICT (id) DO NOTHING`,
              params
            );
          }
        }

        if (tables.assignment_students) {
          for (let i = 0; i < tables.assignment_students.length; i += BATCH_SIZE) {
            const batch = tables.assignment_students.slice(i, i + BATCH_SIZE);
            const placeholders = batch.map((_, idx) =>
              `($${idx * 4 + 1}, $${idx * 4 + 2}, $${idx * 4 + 3}, $${idx * 4 + 4})`
            ).join(', ');
            const params = batch.flatMap(row => [row.id, row.assignment_id, row.student_id, row.submission_id]);
            await client.query(
              `INSERT INTO assignment_students (id, assignment_id, student_id, submission_id)
               VALUES ${placeholders}
               ON CONFLICT (id) DO NOTHING`,
              params
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

  // Clean up soft-deleted records older than specified days
  static async cleanupSoftDeletes(daysOld = 90) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete old soft-deleted assignment junction records first (FK order)
      const assignmentStudents = await client.query(
        `DELETE FROM assignment_students WHERE assignment_id IN (
          SELECT id FROM assignments WHERE is_active = false AND updated_at < NOW() - INTERVAL '1 day' * $1
        )`,
        [daysOld]
      );
      const assignmentTeachers = await client.query(
        `DELETE FROM assignment_teachers WHERE assignment_id IN (
          SELECT id FROM assignments WHERE is_active = false AND updated_at < NOW() - INTERVAL '1 day' * $1
        )`,
        [daysOld]
      );

      // Delete old soft-deleted records
      const assignments = await client.query(
        `DELETE FROM assignments WHERE is_active = false AND updated_at < NOW() - INTERVAL '1 day' * $1`,
        [daysOld]
      );
      const teachers = await client.query(
        `DELETE FROM teachers WHERE is_active = false AND updated_at < NOW() - INTERVAL '1 day' * $1`,
        [daysOld]
      );
      const students = await client.query(
        `DELETE FROM students WHERE is_active = false AND updated_at < NOW() - INTERVAL '1 day' * $1`,
        [daysOld]
      );

      await client.query('COMMIT');

      return {
        deleted: {
          students: students.rowCount,
          teachers: teachers.rowCount,
          assignments: assignments.rowCount,
          assignment_teachers: assignmentTeachers.rowCount,
          assignment_students: assignmentStudents.rowCount,
        },
        olderThanDays: daysOld
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
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
