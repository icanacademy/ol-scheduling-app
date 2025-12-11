import pool from '../db/connection.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Create a new backup
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
    const filename = `backup_${timestamp}.sql`;
    const backupDir = path.join(__dirname, '../../backups');
    const backupPath = path.join(backupDir, filename);

    // Ensure backup directory exists
    await fs.mkdir(backupDir, { recursive: true });

    // Get current counts before backup
    const counts = await this.getCurrentCounts();

    // Execute pg_dump with plain SQL format
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = process.env.DB_PORT || '5432';
    const dbUser = process.env.DB_USER || 'postgres';
    const dbPassword = process.env.DB_PASSWORD || 'postgres';
    const dbName = process.env.DB_NAME || 'ol_scheduling_db';

    // Use Docker's pg_dump to avoid version mismatch
    // Container name is 'scheduling_db' but it hosts multiple databases
    const containerName = 'scheduling_db';

    try {
      // Use plain SQL format with --clean and --if-exists
      // Run pg_dump inside the Docker container
      await execAsync(`docker exec ${containerName} pg_dump -U ${dbUser} --clean --if-exists --exclude-table=backup_metadata ${dbName} > "${backupPath}"`);

      // Get file size
      const stats = await fs.stat(backupPath);
      const fileSizeBytes = stats.size;

      // Store metadata with PHT timestamp
      const result = await pool.query(
        `INSERT INTO backup_metadata
         (filename, created_at, teachers_count, students_count, assignments_count, description, file_size_bytes)
         VALUES ($1, NOW() AT TIME ZONE 'Asia/Manila', $2, $3, $4, $5, $6)
         RETURNING *`,
        [filename, counts.teachers, counts.students, counts.assignments, description, fileSizeBytes]
      );

      // Copy to second backup location (Desktop)
      const desktopBackupDir = path.join(process.env.HOME || '/Users/icanacademy', 'Desktop', 'ICAN_Backups');
      await fs.mkdir(desktopBackupDir, { recursive: true });
      const desktopBackupPath = path.join(desktopBackupDir, filename);
      await fs.copyFile(backupPath, desktopBackupPath);

      console.log(`✓ Backup also saved to: ${desktopBackupPath}`);

      return result.rows[0];
    } catch (error) {
      // Clean up failed backup file if it exists
      try {
        await fs.unlink(backupPath);
      } catch (unlinkError) {
        // Ignore if file doesn't exist
      }
      throw error;
    }
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
    const backupDir = path.join(__dirname, '../../backups');
    const backupPath = path.join(backupDir, filename);

    // Check if file exists
    try {
      await fs.access(backupPath);
    } catch {
      throw new Error('Backup file not found');
    }

    // Get metadata from database
    const metadata = await this.getByFilename(filename);

    if (!metadata) {
      throw new Error('Backup metadata not found');
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

  // Restore from backup
  static async restore(filename, options = {}) {
    const {
      restoreTeachers = true,
      restoreStudents = true,
      restoreAssignments = true,
      specificDates = null
    } = options;

    const backupDir = path.join(__dirname, '../../backups');
    const backupPath = path.join(backupDir, filename);

    // Check if file exists
    try {
      await fs.access(backupPath);
    } catch {
      throw new Error('Backup file not found');
    }

    // For full restore
    if (restoreTeachers && restoreStudents && restoreAssignments && !specificDates) {
      const dbUser = process.env.DB_USER || 'postgres';
      const dbName = process.env.DB_NAME || 'ol_scheduling_db';
      // Container name is 'scheduling_db' but it hosts multiple databases
      const containerName = 'scheduling_db';

      try {
        // Get counts before restore
        const beforeCounts = await this.getCurrentCounts();
        console.log(`\n=== Starting restore from ${filename} ===`);
        console.log(`Before restore: ${beforeCounts.teachers} teachers, ${beforeCounts.students} students, ${beforeCounts.assignments} assignments`);

        // Get expected counts from backup metadata
        const metadata = await this.getByFilename(filename);
        const expectedCounts = {
          teachers: metadata?.teachers_count || 0,
          students: metadata?.students_count || 0,
          assignments: metadata?.assignments_count || 0
        };
        console.log(`Expected from backup: ${expectedCounts.teachers} teachers, ${expectedCounts.students} students, ${expectedCounts.assignments} assignments`);

        // Use Docker to run psql inside the container
        // The backup file includes DROP TABLE IF EXISTS and CREATE TABLE, so the restore is still safe
        const command = `docker exec -i ${containerName} psql -U ${dbUser} -d ${dbName} < "${backupPath}"`;

        console.log(`Executing: ${command}`);

        const result = await execAsync(command, { maxBuffer: 10 * 1024 * 1024 }); // 10MB buffer for large output

        // Check for errors in stderr that indicate real problems
        if (result.stderr && result.stderr.includes('ERROR')) {
          console.error(`Restore completed with errors:`);
          console.error(result.stderr);
          // Don't throw - some errors are harmless (like backup_metadata conflicts)
        } else if (result.stderr) {
          console.log(`Notices/Warnings: ${result.stderr}`);
        }

        // Verify restoration by getting counts
        const afterCounts = await this.getCurrentCounts();
        console.log(`After restore: ${afterCounts.teachers} teachers, ${afterCounts.students} students, ${afterCounts.assignments} assignments`);

        // Only throw error if we expected data but got empty database
        const expectingData = expectedCounts.teachers > 0 || expectedCounts.students > 0 || expectedCounts.assignments > 0;
        const gotEmptyDatabase = afterCounts.teachers === 0 && afterCounts.students === 0 && afterCounts.assignments === 0;

        if (expectingData && gotEmptyDatabase) {
          throw new Error(`Restore failed: Expected ${expectedCounts.teachers} teachers, ${expectedCounts.students} students, ${expectedCounts.assignments} assignments but database is empty`);
        }

        // Reset all sequences to prevent duplicate key errors
        console.log(`Resetting sequences...`);
        await this.resetSequences();

        console.log(`✓ Restore completed successfully`);

        return {
          success: true,
          message: 'Full restore completed successfully',
          before: beforeCounts,
          after: afterCounts,
          expected: expectedCounts,
          warnings: result.stderr || null
        };
      } catch (error) {
        // Provide detailed error information
        console.error(`✗ Restore failed: ${error.message}`);
        if (error.stderr) {
          console.error(`stderr: ${error.stderr}`);
        }
        throw new Error(`Restore failed: ${error.message}\n${error.stderr || ''}`);
      }
    }

    // For selective restore, we need to parse and execute specific parts
    // This is complex - for now, throw an error and implement later if needed
    throw new Error('Selective restore not yet implemented. Use full restore.');
  }

  // Clean up old backups
  static async cleanupOldBackups(keepCount = 30) {
    const backupDir = path.join(__dirname, '../../backups');

    // Get all backups ordered by created_at
    const result = await pool.query(
      'SELECT filename FROM backup_metadata ORDER BY created_at DESC OFFSET $1',
      [keepCount]
    );

    const oldBackups = result.rows;

    for (const backup of oldBackups) {
      try {
        // Delete file
        const filePath = path.join(backupDir, backup.filename);
        await fs.unlink(filePath);

        // Delete metadata
        await pool.query('DELETE FROM backup_metadata WHERE filename = $1', [backup.filename]);
      } catch (error) {
        console.error(`Failed to delete old backup ${backup.filename}:`, error);
      }
    }

    return { deleted: oldBackups.length };
  }

  // Get backup file path for download
  static getBackupPath(filename) {
    const backupDir = path.join(__dirname, '../../backups');
    return path.join(backupDir, filename);
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
    const backupDir = path.join(__dirname, '../../backups');
    const backupPath = path.join(backupDir, filename);

    try {
      // Delete file
      await fs.unlink(backupPath);

      // Delete metadata
      await pool.query('DELETE FROM backup_metadata WHERE filename = $1', [filename]);

      return { success: true };
    } catch (error) {
      throw new Error(`Failed to delete backup: ${error.message}`);
    }
  }

  // Sync backup metadata with actual files on disk
  static async syncWithFiles() {
    const backupDir = path.join(__dirname, '../../backups');

    // Get all backup files from directory
    const files = await fs.readdir(backupDir);
    const backupFiles = files.filter(f => f.endsWith('.sql') && f.startsWith('backup_'));
    const backupFilesSet = new Set(backupFiles);

    // Get existing metadata records
    const existingResult = await pool.query('SELECT filename FROM backup_metadata');
    const existingFilenames = new Set(existingResult.rows.map(r => r.filename));

    const added = [];
    const removed = [];
    const skipped = [];

    // Add metadata for files that don't have it
    for (const filename of backupFiles) {
      if (existingFilenames.has(filename)) {
        skipped.push(filename);
        continue;
      }

      try {
        const backupPath = path.join(backupDir, filename);
        const stats = await fs.stat(backupPath);
        const fileSizeBytes = stats.size;
        const createdAt = stats.birthtime; // File creation time

        // Parse counts from backup file by actually counting data rows
        const content = await fs.readFile(backupPath, 'utf8');

        // Extract COPY blocks and count rows
        const extractCount = (tableName) => {
          // Find the COPY statement for this table
          const regex = new RegExp(`COPY public\\.${tableName}[^\\n]*\\n([\\s\\S]*?)\\n\\\\\\.`, 'm');
          const match = content.match(regex);
          if (!match || !match[1]) return 0;

          // Count non-empty lines in the data block
          const dataLines = match[1].split('\n').filter(line => line.trim().length > 0);
          return dataLines.length;
        };

        const teachersCount = extractCount('teachers');
        const studentsCount = extractCount('students');
        const assignmentsCount = extractCount('assignments');

        // Insert metadata
        await pool.query(
          `INSERT INTO backup_metadata
           (filename, created_at, teachers_count, students_count, assignments_count, description, file_size_bytes)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [filename, createdAt, teachersCount, studentsCount, assignmentsCount, 'Recovered from disk', fileSizeBytes]
        );

        added.push(filename);
        console.log(`✓ Added metadata for: ${filename}`);
      } catch (error) {
        console.error(`✗ Failed to add metadata for ${filename}:`, error.message);
      }
    }

    // Remove metadata for files that no longer exist
    for (const filename of existingFilenames) {
      if (!backupFilesSet.has(filename)) {
        try {
          await pool.query('DELETE FROM backup_metadata WHERE filename = $1', [filename]);
          removed.push(filename);
          console.log(`✓ Removed orphaned metadata for: ${filename}`);
        } catch (error) {
          console.error(`✗ Failed to remove metadata for ${filename}:`, error.message);
        }
      }
    }

    return {
      total_files: backupFiles.length,
      added: added.length,
      removed: removed.length,
      skipped: skipped.length,
      added_files: added,
      removed_files: removed
    };
  }
}

export default Backup;
