import pool from './src/db/connection.js';

async function checkMondayAssignments() {
  try {
    console.log('Checking assignments on Monday (2024-01-01)...\n');
    
    // Check all assignments on Monday
    const result = await pool.query(`
      SELECT a.id, a.is_active, r.name as room_name, ts.name as time_slot, 
             a.subject, a.created_at,
             COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
             COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
      FROM assignments a
      JOIN rooms r ON a.room_id = r.id
      JOIN time_slots ts ON a.time_slot_id = ts.id
      LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
      LEFT JOIN teachers t ON at.teacher_id = t.id
      LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
      LEFT JOIN students s ON ast.student_id = s.id
      WHERE a.date = '2024-01-01'
      GROUP BY a.id, r.name, ts.name
      ORDER BY a.is_active DESC, a.time_slot_id
    `);
    
    if (result.rows.length === 0) {
      console.log('✅ No assignments found on Monday');
    } else {
      console.log(`Found ${result.rows.length} assignment(s) on Monday:\n`);
      
      for (const assignment of result.rows) {
        console.log(`Assignment ID: ${assignment.id}`);
        console.log(`  Status: ${assignment.is_active ? 'ACTIVE ⚠️' : 'INACTIVE (soft-deleted)'}`);
        console.log(`  Room: ${assignment.room_name}`);
        console.log(`  Time: ${assignment.time_slot}`);
        console.log(`  Subject: ${assignment.subject || 'None'}`);
        console.log(`  Teachers: ${assignment.teachers.join(', ') || 'None'}`);
        console.log(`  Students: ${assignment.students.join(', ') || 'None'}`);
        console.log(`  Created: ${new Date(assignment.created_at).toLocaleString()}`);
        console.log('');
      }
      
      // Count active assignments
      const activeCount = result.rows.filter(a => a.is_active).length;
      console.log(`\nSummary: ${activeCount} ACTIVE assignment(s), ${result.rows.length - activeCount} inactive`);
      
      if (activeCount > 0) {
        console.log('\n⚠️  There are active assignments on Monday that may be causing conflicts!');
        console.log('These need to be deleted or deactivated to free up the rooms.');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMondayAssignments();