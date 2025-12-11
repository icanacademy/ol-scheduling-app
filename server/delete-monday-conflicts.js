import pool from './src/db/connection.js';

async function deleteMondayConflicts() {
  try {
    console.log('Deleting active assignments on Monday (2024-01-01)...\n');
    
    // First, show what will be deleted
    const activeAssignments = await pool.query(`
      SELECT a.id, r.name as room_name, ts.name as time_slot, 
             COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
             COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
      FROM assignments a
      JOIN rooms r ON a.room_id = r.id
      JOIN time_slots ts ON a.time_slot_id = ts.id
      LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
      LEFT JOIN teachers t ON at.teacher_id = t.id
      LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
      LEFT JOIN students s ON ast.student_id = s.id
      WHERE a.date = '2024-01-01' AND a.is_active = true
      GROUP BY a.id, r.name, ts.name
    `);
    
    if (activeAssignments.rows.length === 0) {
      console.log('✅ No active assignments to delete on Monday');
    } else {
      console.log(`Found ${activeAssignments.rows.length} active assignment(s) to delete:\n`);
      
      for (const assignment of activeAssignments.rows) {
        console.log(`Assignment ID ${assignment.id}:`);
        console.log(`  Room: ${assignment.room_name}, Time: ${assignment.time_slot}`);
        console.log(`  Teachers: ${assignment.teachers.join(', ')}`);
        console.log(`  Students: ${assignment.students.join(', ')}\n`);
      }
      
      // Soft delete all active assignments on Monday
      const deleteResult = await pool.query(`
        UPDATE assignments 
        SET is_active = false 
        WHERE date = '2024-01-01' AND is_active = true
        RETURNING id
      `);
      
      console.log(`✅ Successfully deleted ${deleteResult.rowCount} assignment(s)`);
      console.log('Monday is now clear for new assignments!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deleteMondayConflicts();