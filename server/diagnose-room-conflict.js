import pool from './src/db/connection.js';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => {
    rl.question(query, resolve);
  });
}

async function diagnoseRoomConflict() {
  try {
    console.log('Room Conflict Diagnostic Tool');
    console.log('============================\n');

    const date = await question('Enter the date (YYYY-MM-DD): ');
    const timeSlotId = await question('Enter the time slot ID: ');
    const roomId = await question('Enter the room ID: ');

    console.log(`\nChecking for conflicts on ${date}, Time Slot ${timeSlotId}, Room ${roomId}...\n`);

    // Check for existing assignments
    const conflicts = await pool.query(
      `SELECT a.*, 
              r.name as room_name, 
              ts.name as time_slot_name,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', t.id,
                'name', t.name
              )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', s.id,
                'name', s.name
              )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       LEFT JOIN rooms r ON a.room_id = r.id
       LEFT JOIN time_slots ts ON a.time_slot_id = ts.id
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date = $1 
       AND a.time_slot_id = $2 
       AND a.room_id = $3
       GROUP BY a.id, r.name, ts.name
       ORDER BY a.is_active DESC, a.created_at DESC`,
      [date, timeSlotId, roomId]
    );

    if (conflicts.rows.length === 0) {
      console.log('✅ No conflicts found! The room is available for this time slot.');
    } else {
      console.log(`⚠️  Found ${conflicts.rows.length} assignment(s) for this room and time:\n`);
      
      for (const assignment of conflicts.rows) {
        console.log(`Assignment ID: ${assignment.id}`);
        console.log(`  Status: ${assignment.is_active ? 'ACTIVE' : 'INACTIVE (soft-deleted)'}`);
        console.log(`  Room: ${assignment.room_name}`);
        console.log(`  Time: ${assignment.time_slot_name}`);
        console.log(`  Created: ${new Date(assignment.created_at).toLocaleString()}`);
        console.log(`  Teachers: ${assignment.teachers.map(t => t.name).join(', ') || 'None'}`);
        console.log(`  Students: ${assignment.students.map(s => s.name).join(', ') || 'None'}`);
        console.log(`  Notes: ${assignment.notes || 'None'}`);
        console.log(`  Subject: ${assignment.subject || 'None'}`);
        console.log('');
        
        if (assignment.is_active) {
          const shouldDelete = await question(`Would you like to delete assignment ${assignment.id}? (y/n): `);
          if (shouldDelete.toLowerCase() === 'y') {
            await pool.query(
              'UPDATE assignments SET is_active = false WHERE id = $1',
              [assignment.id]
            );
            console.log(`✅ Assignment ${assignment.id} has been deleted (soft delete).\n`);
          }
        }
      }
    }

    // Check all assignments for this date
    const allForDate = await pool.query(
      `SELECT a.*, r.name as room_name, ts.name as time_slot_name
       FROM assignments a
       JOIN rooms r ON a.room_id = r.id
       JOIN time_slots ts ON a.time_slot_id = ts.id
       WHERE a.date = $1 AND a.is_active = true
       ORDER BY a.time_slot_id, a.room_id`,
      [date]
    );

    console.log(`\n📊 Summary for ${date}:`);
    console.log(`Total active assignments: ${allForDate.rows.length}`);
    
    if (allForDate.rows.length > 0) {
      console.log('\nActive assignments by time slot:');
      let currentTimeSlot = null;
      for (const assignment of allForDate.rows) {
        if (assignment.time_slot_id !== currentTimeSlot) {
          currentTimeSlot = assignment.time_slot_id;
          console.log(`\n${assignment.time_slot_name}:`);
        }
        console.log(`  - ${assignment.room_name} (ID: ${assignment.id})`);
      }
    }

    rl.close();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    rl.close();
    process.exit(1);
  }
}

diagnoseRoomConflict();