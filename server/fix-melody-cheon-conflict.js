import pool from './src/db/connection.js';

async function fixMelodyCheonConflict() {
  try {
    console.log('Fixing conflict for Melody + Cheon Jae In...\n');
    
    // Show the conflicting assignment
    const conflict = await pool.query(`
      SELECT a.id, r.name as room_name,
             COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
             COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
      FROM assignments a
      JOIN rooms r ON a.room_id = r.id
      LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
      LEFT JOIN teachers t ON at.teacher_id = t.id
      LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
      LEFT JOIN students s ON ast.student_id = s.id
      WHERE a.date = '2024-01-01' 
      AND a.time_slot_id = 1 
      AND a.is_active = true
      GROUP BY a.id, r.name
    `);
    
    if (conflict.rows.length === 0) {
      console.log('✅ No conflicts found! The assignment should work now.');
      process.exit(0);
    }
    
    console.log('Current conflict in time slot 1 (8:00-8:30AM) on Monday:');
    for (const assignment of conflict.rows) {
      console.log(`  Assignment ID: ${assignment.id}`);
      console.log(`  Room: ${assignment.room_name}`);
      console.log(`  Teachers: ${assignment.teachers.join(', ')}`);
      console.log(`  Students: ${assignment.students.join(', ')}`);
    }
    
    console.log('\nOptions:');
    console.log('1. Delete the conflicting assignment');
    console.log('2. Show available alternative rooms');
    console.log('3. Exit without changes');
    
    // For automation, let's show available rooms (option 2)
    console.log('\n=== AVAILABLE ALTERNATIVE ROOMS ===');
    const availableRooms = await pool.query(`
      SELECT id, name
      FROM rooms
      WHERE id NOT IN (
        SELECT DISTINCT room_id
        FROM assignments
        WHERE date = '2024-01-01' 
        AND time_slot_id = 1 
        AND is_active = true
      )
      ORDER BY id
      LIMIT 10
    `);
    
    console.log('Available rooms for 8:00-8:30AM on Monday:');
    for (const room of availableRooms.rows) {
      console.log(`  ✅ Room ${room.name} (ID: ${room.id}) - AVAILABLE`);
    }
    
    console.log('\n💡 SOLUTION: Try assigning Melody + Cheon Jae In to any of the available rooms above!');
    console.log('   The room conflict is because you\'re trying to use Room 1, which is already taken.');
    
    // Optional: Delete the conflicting assignment (uncomment if needed)
    // console.log('\nDeleting conflicting assignment...');
    // await pool.query('UPDATE assignments SET is_active = false WHERE id = $1', [conflict.rows[0].id]);
    // console.log('✅ Conflicting assignment deleted!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixMelodyCheonConflict();