import pool from '../db/connection.js';

class ScheduleCache {
  // Refresh the student_schedule_cache table by re-computing from live data
  // This replaces the expensive 5-table join that the attendance app does on every request
  static async refresh() {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Clear existing cache
      await client.query('TRUNCATE student_schedule_cache');

      // 1. Get all unique active students
      const studentsResult = await client.query(
        `SELECT DISTINCT ON (
           COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, ''))
         ) id, name, korean_name, english_name, color_keyword
         FROM students
         WHERE is_active = true
         ORDER BY COALESCE(notion_page_id, LOWER(name) || '::' || COALESCE(korean_name, '')),
                  (CASE WHEN first_start_date IS NOT NULL THEN 0 ELSE 1 END),
                  id ASC`
      );

      // 2. Get all student-subject-schedule combos
      const subjectsResult = await client.query(
        `SELECT
          s.id as student_id,
          a.subject,
          t.name as teacher_name,
          TO_CHAR(ts.start_time, 'HH:MI AM') as start_time,
          TO_CHAR(ts.end_time, 'HH:MI AM') as end_time,
          ARRAY_AGG(DISTINCT a.date ORDER BY a.date) as days
        FROM assignment_students ast
        JOIN students s ON s.id = ast.student_id
        JOIN assignments a ON a.id = ast.assignment_id
        JOIN time_slots ts ON ts.id = a.time_slot_id
        LEFT JOIN assignment_teachers att ON att.assignment_id = a.id
        LEFT JOIN teachers t ON t.id = att.teacher_id
        WHERE a.is_active = true AND s.is_active = true
        GROUP BY s.id, a.subject, t.name, ts.start_time, ts.end_time
        ORDER BY s.id, a.subject, ts.start_time`
      );

      // 3. Get tuition-only subjects
      let tuitionSubjects = [];
      try {
        const tuitionResult = await client.query('SELECT DISTINCT student_id, subject FROM student_subject_tuition');
        tuitionSubjects = tuitionResult.rows;
      } catch (e) {
        // Table may not exist
      }

      const dayAbbrevMap = { 'Monday': 'M', 'Tuesday': 'T', 'Wednesday': 'W', 'Thursday': 'Th', 'Friday': 'F', 'Saturday': 'Sa', 'Sunday': 'Su' };

      // Build student subjects map
      const studentSubjectsMap = {};
      subjectsResult.rows.forEach(row => {
        if (!studentSubjectsMap[row.student_id]) {
          studentSubjectsMap[row.student_id] = [];
        }
        const daysStr = row.days ? row.days.map(d => dayAbbrevMap[d] || d).join('') : null;
        const scheduleEntry = {
          time: row.start_time && row.end_time ? `${row.start_time} - ${row.end_time}` : null,
          startTime: row.start_time || null,
          endTime: row.end_time || null,
          days: daysStr
        };

        const existing = studentSubjectsMap[row.student_id].find(s => s.subject === row.subject);
        if (existing) {
          if (scheduleEntry.time && scheduleEntry.days) {
            existing.schedules.push(scheduleEntry);
          }
        } else {
          studentSubjectsMap[row.student_id].push({
            subject: row.subject || null,
            teacher_name: row.teacher_name || null,
            schedules: scheduleEntry.time && scheduleEntry.days ? [scheduleEntry] : []
          });
        }
      });

      // Merge consecutive time slots
      const mergeConsecutive = (schedules) => {
        if (!schedules || schedules.length === 0) return [];
        const sorted = [...schedules].sort((a, b) => {
          if (a.days !== b.days) return a.days.localeCompare(b.days);
          return a.startTime.localeCompare(b.startTime);
        });
        const merged = [];
        let current = { ...sorted[0] };
        for (let i = 1; i < sorted.length; i++) {
          const next = sorted[i];
          if (current.days === next.days && current.endTime === next.startTime) {
            current.endTime = next.endTime;
            current.time = `${current.startTime} - ${current.endTime}`;
          } else {
            merged.push({ time: current.time, days: current.days });
            current = { ...next };
          }
        }
        merged.push({ time: current.time, days: current.days });
        return merged;
      };

      Object.values(studentSubjectsMap).forEach(subjects => {
        subjects.forEach(s => {
          if (s.schedules && s.schedules.length > 0) {
            s.schedules = mergeConsecutive(s.schedules);
          }
        });
      });

      // Add tuition-only subjects
      tuitionSubjects.forEach(row => {
        if (!studentSubjectsMap[row.student_id]) {
          studentSubjectsMap[row.student_id] = [];
        }
        if (!studentSubjectsMap[row.student_id].find(s => s.subject === row.subject)) {
          studentSubjectsMap[row.student_id].push({
            subject: row.subject,
            teacher_name: null,
            schedules: []
          });
        }
      });

      // Build cache rows and batch insert
      const cacheRows = [];
      studentsResult.rows.forEach(student => {
        const subjects = studentSubjectsMap[student.id];
        if (subjects && subjects.length > 0) {
          subjects.forEach(subjectInfo => {
            const schedules = subjectInfo.schedules || [];
            cacheRows.push({
              student_id: student.id,
              student_name: student.name,
              korean_name: student.korean_name,
              english_name: student.english_name,
              color_keyword: student.color_keyword,
              subject: subjectInfo.subject,
              teacher_name: subjectInfo.teacher_name,
              schedule_time: schedules.length > 0 ? schedules[0].time : null,
              schedule_days: schedules.length > 0 ? schedules[0].days : null,
              schedules: JSON.stringify(schedules.map(s => ({ time: s.time, days: s.days }))),
              row_key: `${student.id}-${subjectInfo.subject || 'default'}`
            });
          });
        } else {
          cacheRows.push({
            student_id: student.id,
            student_name: student.name,
            korean_name: student.korean_name,
            english_name: student.english_name,
            color_keyword: student.color_keyword,
            subject: null,
            teacher_name: null,
            schedule_time: null,
            schedule_days: null,
            schedules: '[]',
            row_key: `${student.id}-default`
          });
        }
      });

      // Batch insert cache rows (50 per batch)
      const BATCH_SIZE = 50;
      const cols = 11;
      for (let i = 0; i < cacheRows.length; i += BATCH_SIZE) {
        const batch = cacheRows.slice(i, i + BATCH_SIZE);
        const placeholders = batch.map((_, idx) =>
          `(${Array.from({ length: cols }, (__, c) => `$${idx * cols + c + 1}`).join(', ')})`
        ).join(', ');
        const params = batch.flatMap(row => [
          row.student_id, row.student_name, row.korean_name, row.english_name,
          row.color_keyword, row.subject, row.teacher_name, row.schedule_time,
          row.schedule_days, row.schedules, row.row_key
        ]);
        await client.query(
          `INSERT INTO student_schedule_cache
           (student_id, student_name, korean_name, english_name, color_keyword, subject, teacher_name, schedule_time, schedule_days, schedules, row_key)
           VALUES ${placeholders}`,
          params
        );
      }

      await client.query('COMMIT');

      // Also refresh subjects reference table
      await this.refreshSubjects();

      return {
        success: true,
        cached: cacheRows.length,
        students: studentsResult.rows.length,
        refreshed_at: new Date().toISOString()
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Get cached student schedules (used by attendance app)
  static async getAll() {
    const result = await pool.query(
      `SELECT * FROM student_schedule_cache ORDER BY student_name, subject`
    );
    return result.rows;
  }

  // Get last refresh time
  static async getLastRefresh() {
    const result = await pool.query(
      `SELECT MAX(refreshed_at) as last_refresh FROM student_schedule_cache`
    );
    return result.rows[0]?.last_refresh;
  }

  // Refresh subjects reference table from assignments
  static async refreshSubjects() {
    try {
      await pool.query(
        `INSERT INTO subjects (name)
         SELECT DISTINCT subject FROM assignments
         WHERE subject IS NOT NULL AND subject != ''
         AND subject NOT IN (SELECT name FROM subjects)
         ORDER BY subject`
      );
    } catch (e) {
      // Table may not exist yet
      console.log('Could not refresh subjects table:', e.message);
    }
  }

  // Get all subjects
  static async getAllSubjects() {
    try {
      const result = await pool.query('SELECT * FROM subjects ORDER BY name');
      return result.rows;
    } catch (e) {
      return [];
    }
  }
}

export default ScheduleCache;
