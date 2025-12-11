import pool from './src/db/connection.js';

async function debugMelodyCheonConflict() {
  try {
    console.log('Debugging conflict for Teacher Melody and Student Cheon Jae In on Monday...\n');
    
    // First, let's see all assignments on Monday
    console.log('=== ALL ASSIGNMENTS ON MONDAY (2024-01-01) ===');
    const mondayAssignments = await pool.query(`
      SELECT a.id, a.is_active, a.time_slot_id, a.room_id,
             r.name as room_name, 
             ts.name as time_slot_name,
             ts.start_time, ts.end_time,
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
      WHERE a.date = '2024-01-01' AND a.is_active = true
      GROUP BY a.id, r.name, ts.name, ts.start_time, ts.end_time
      ORDER BY a.time_slot_id, a.room_id
    `);
    
    if (mondayAssignments.rows.length === 0) {
      console.log('✅ No active assignments found on Monday');
    } else {
      for (const assignment of mondayAssignments.rows) {
        console.log(`Assignment ID: ${assignment.id}`);
        console.log(`  Room: ${assignment.room_name} (ID: ${assignment.room_id})`);
        console.log(`  Time: ${assignment.time_slot_name} (ID: ${assignment.time_slot_id})`);
        console.log(`  Schedule: ${assignment.start_time} - ${assignment.end_time}`);
        console.log(`  Teachers: ${assignment.teachers.join(', ')}`);
        console.log(`  Students: ${assignment.students.join(', ')}`);
        console.log(`  Subject: ${assignment.subject || 'None'}`);
        console.log(`  Created: ${new Date(assignment.created_at).toLocaleString()}`);
        console.log('');
      }
    }
    
    // Check if Teacher Melody exists and get her ID
    console.log('\n=== TEACHER MELODY INFO ===');
    const melodyInfo = await pool.query(`
      SELECT id, name, availability
      FROM teachers 
      WHERE name ILIKE '%melody%' AND is_active = true
      ORDER BY created_at DESC
    `);
    
    if (melodyInfo.rows.length === 0) {
      console.log('❌ Teacher Melody not found!');
    } else {
      console.log(`Found ${melodyInfo.rows.length} teacher(s) named Melody:`);
      for (const teacher of melodyInfo.rows) {
        console.log(`  ID: ${teacher.id}, Name: ${teacher.name}`);
        console.log(`  Availability: ${JSON.stringify(teacher.availability)}`);
      }
    }
    
    // Check if Student Cheon Jae In exists and get info
    console.log('\n=== STUDENT CHEON JAE IN INFO ===');
    const cheonInfo = await pool.query(`
      SELECT id, name, availability
      FROM students 
      WHERE name ILIKE '%cheon%' AND is_active = true
      ORDER BY created_at DESC
    `);
    
    if (cheonInfo.rows.length === 0) {
      console.log('❌ Student Cheon Jae In not found!');
    } else {
      console.log(`Found ${cheonInfo.rows.length} student(s) with name containing "cheon":`);
      for (const student of cheonInfo.rows) {
        console.log(`  ID: ${student.id}, Name: ${student.name}`);
        console.log(`  Availability: ${JSON.stringify(student.availability)}`);
      }
    }
    
    // Check what time slots exist
    console.log('\n=== AVAILABLE TIME SLOTS ===');
    const timeSlots = await pool.query(`
      SELECT id, name, start_time, end_time
      FROM time_slots
      ORDER BY start_time
    `);
    
    console.log('Available time slots:');
    for (const slot of timeSlots.rows) {
      console.log(`  ID: ${slot.id}, Name: ${slot.name}, Time: ${slot.start_time} - ${slot.end_time}`);
    }
    
    // Check what rooms exist  
    console.log('\n=== AVAILABLE ROOMS ===');
    const rooms = await pool.query(`
      SELECT id, name
      FROM rooms
      ORDER BY id
    `);
    
    console.log('Available rooms:');
    for (const room of rooms.rows) {
      console.log(`  ID: ${room.id}, Name: ${room.name}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugMelodyCheonConflict();