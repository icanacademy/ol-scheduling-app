import pool from './src/db/connection.js';

async function checkSpecificConflict() {
  try {
    console.log('Checking specific conflict for Melody + Cheon Jae In...\n');
    
    // Get the most recent Cheon Jae In and Melody records
    const latestCheon = await pool.query(`
      SELECT id, name, availability
      FROM students 
      WHERE name = 'Cheon Jae In' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    const latestMelody = await pool.query(`
      SELECT id, name, availability
      FROM teachers 
      WHERE name = 'Melody' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (latestCheon.rows.length === 0) {
      console.log('❌ No active Cheon Jae In found!');
      process.exit(1);
    }
    
    if (latestMelody.rows.length === 0) {
      console.log('❌ No active Melody found!');
      process.exit(1);
    }
    
    const student = latestCheon.rows[0];
    const teacher = latestMelody.rows[0];
    
    console.log(`Latest Student: ID ${student.id}, Name: ${student.name}`);
    console.log(`Student availability: ${JSON.stringify(student.availability)}`);
    console.log(`Latest Teacher: ID ${teacher.id}, Name: ${teacher.name}`);
    console.log(`Teacher availability: ${JSON.stringify(teacher.availability)}`);
    
    // Check what time slots they both have in common
    const studentSlots = student.availability || [];
    const teacherSlots = teacher.availability || [];
    const commonSlots = studentSlots.filter(slot => teacherSlots.includes(slot));
    
    console.log(`\nCommon time slots: ${JSON.stringify(commonSlots)}`);
    
    if (commonSlots.length === 0) {
      console.log('❌ NO COMMON TIME SLOTS AVAILABLE!');
      console.log('This explains why assignment fails - they have no overlapping availability.');
      process.exit(1);
    }
    
    // For each common time slot, check what's already assigned
    for (const timeSlotId of commonSlots) {
      console.log(`\n--- Checking Time Slot ${timeSlotId} on Monday ---`);
      
      const timeSlotInfo = await pool.query(`
        SELECT name, start_time, end_time
        FROM time_slots
        WHERE id = $1
      `, [timeSlotId]);
      
      if (timeSlotInfo.rows.length > 0) {
        const slot = timeSlotInfo.rows[0];
        console.log(`Time: ${slot.name} (${slot.start_time} - ${slot.end_time})`);
      }
      
      // Check existing assignments for this time slot on Monday
      const conflicts = await pool.query(`
        SELECT a.id, a.room_id, r.name as room_name,
               COALESCE(json_agg(DISTINCT t.name) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
               COALESCE(json_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
        FROM assignments a
        JOIN rooms r ON a.room_id = r.id
        LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
        LEFT JOIN teachers t ON at.teacher_id = t.id
        LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
        LEFT JOIN students s ON ast.student_id = s.id
        WHERE a.date = '2024-01-01' 
        AND a.time_slot_id = $1 
        AND a.is_active = true
        GROUP BY a.id, a.room_id, r.name
      `, [timeSlotId]);
      
      if (conflicts.rows.length === 0) {
        console.log(`✅ Time slot ${timeSlotId} is FREE - assignment should work!`);
        
        // Show available rooms
        const availableRooms = await pool.query(`
          SELECT id, name
          FROM rooms
          WHERE id NOT IN (
            SELECT DISTINCT room_id
            FROM assignments
            WHERE date = '2024-01-01' 
            AND time_slot_id = $1 
            AND is_active = true
          )
          ORDER BY id
          LIMIT 10
        `, [timeSlotId]);
        
        console.log('Available rooms:');
        for (const room of availableRooms.rows) {
          console.log(`  Room ${room.name} (ID: ${room.id})`);
        }
      } else {
        console.log(`⚠️ Time slot ${timeSlotId} has conflicts:`);
        for (const conflict of conflicts.rows) {
          console.log(`  Room ${conflict.room_name}: ${conflict.teachers.join(', ')} teaching ${conflict.students.join(', ')}`);
        }
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSpecificConflict();