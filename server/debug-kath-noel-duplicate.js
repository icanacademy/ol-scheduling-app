import pool from './src/db/connection.js';

async function debugKathNoelDuplicate() {
  try {
    console.log('Debugging Kath and Noel duplicate student issue...\n');
    
    // Find teachers Kath and Noel
    const kathResult = await pool.query(`
      SELECT id, name, availability
      FROM teachers 
      WHERE name ILIKE '%kath%' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    const noelResult = await pool.query(`
      SELECT id, name, availability
      FROM teachers 
      WHERE name ILIKE '%noel%' AND is_active = true
      ORDER BY created_at DESC
      LIMIT 1
    `);
    
    if (kathResult.rows.length === 0) {
      console.log('❌ Teacher Kath not found');
    } else {
      console.log(`Teacher Kath: ID ${kathResult.rows[0].id}, Name: ${kathResult.rows[0].name}`);
    }
    
    if (noelResult.rows.length === 0) {
      console.log('❌ Teacher Noel not found');
    } else {
      console.log(`Teacher Noel: ID ${noelResult.rows[0].id}, Name: ${noelResult.rows[0].name}`);
    }
    
    if (kathResult.rows.length === 0 || noelResult.rows.length === 0) {
      console.log('\nSearching for similar teacher names...');
      const allTeachers = await pool.query(`
        SELECT id, name 
        FROM teachers 
        WHERE is_active = true
        ORDER BY name
      `);
      
      console.log('All active teachers:');
      for (const teacher of allTeachers.rows) {
        console.log(`  ID: ${teacher.id}, Name: ${teacher.name}`);
      }
      process.exit(1);
    }
    
    const kath = kathResult.rows[0];
    const noel = noelResult.rows[0];
    
    // Look for assignments where both teachers have the same student at the same time
    console.log('\n--- Searching for duplicate assignments ---');
    const duplicates = await pool.query(`
      SELECT 
        a1.id as kath_assignment_id,
        a2.id as noel_assignment_id,
        a1.date,
        a1.time_slot_id,
        ts.name as time_slot_name,
        s.id as student_id,
        s.name as student_name
      FROM assignments a1
      JOIN assignments a2 ON (
        a1.date = a2.date 
        AND a1.time_slot_id = a2.time_slot_id
        AND a1.id != a2.id
        AND a1.is_active = true
        AND a2.is_active = true
      )
      JOIN assignment_teachers at1 ON a1.id = at1.assignment_id
      JOIN assignment_teachers at2 ON a2.id = at2.assignment_id
      JOIN assignment_students as1 ON a1.id = as1.assignment_id
      JOIN assignment_students as2 ON a2.id = as2.assignment_id
      JOIN students s ON as1.student_id = s.id AND as2.student_id = s.id
      JOIN time_slots ts ON a1.time_slot_id = ts.id
      WHERE at1.teacher_id = $1 
      AND at2.teacher_id = $2
    `, [kath.id, noel.id]);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No current duplicates found between Kath and Noel');
    } else {
      console.log(`⚠️ Found ${duplicates.rows.length} duplicate(s):`);
      for (const dup of duplicates.rows) {
        console.log(`  Date: ${dup.date}`);
        console.log(`  Time: ${dup.time_slot_name} (ID: ${dup.time_slot_id})`);
        console.log(`  Student: ${dup.student_name} (ID: ${dup.student_id})`);
        console.log(`  Kath assignment: ${dup.kath_assignment_id}`);
        console.log(`  Noel assignment: ${dup.noel_assignment_id}`);
        console.log('');
      }
      
      // Show detailed info about the duplicate assignments
      for (const dup of duplicates.rows) {
        console.log(`--- Details for duplicate on ${dup.date} at ${dup.time_slot_name} ---`);
        
        // Get full assignment details
        const kathAssignment = await pool.query(`
          SELECT a.*, 
                 json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) as teachers,
                 json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) as students
          FROM assignments a
          LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
          LEFT JOIN teachers t ON at.teacher_id = t.id
          LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
          LEFT JOIN students s ON ast.student_id = s.id
          WHERE a.id = $1
          GROUP BY a.id
        `, [dup.kath_assignment_id]);
        
        const noelAssignment = await pool.query(`
          SELECT a.*, 
                 json_agg(DISTINCT jsonb_build_object('id', t.id, 'name', t.name)) as teachers,
                 json_agg(DISTINCT jsonb_build_object('id', s.id, 'name', s.name)) as students
          FROM assignments a
          LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
          LEFT JOIN teachers t ON at.teacher_id = t.id
          LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
          LEFT JOIN students s ON ast.student_id = s.id
          WHERE a.id = $1
          GROUP BY a.id
        `, [dup.noel_assignment_id]);
        
        if (kathAssignment.rows[0]) {
          const ka = kathAssignment.rows[0];
          console.log(`Kath Assignment ${ka.id}:`);
          console.log(`  Created: ${ka.created_at}`);
          console.log(`  Teachers: ${ka.teachers.map(t => t.name).join(', ')}`);
          console.log(`  Students: ${ka.students.map(s => s.name).join(', ')}`);
          console.log(`  Subject: ${ka.subject || 'None'}`);
          console.log(`  Notes: ${ka.notes || 'None'}`);
        }
        
        if (noelAssignment.rows[0]) {
          const na = noelAssignment.rows[0];
          console.log(`Noel Assignment ${na.id}:`);
          console.log(`  Created: ${na.created_at}`);
          console.log(`  Teachers: ${na.teachers.map(t => t.name).join(', ')}`);
          console.log(`  Students: ${na.students.map(s => s.name).join(', ')}`);
          console.log(`  Subject: ${na.subject || 'None'}`);
          console.log(`  Notes: ${na.notes || 'None'}`);
        }
        console.log('');
      }
    }
    
    // Search for ANY duplicate student assignments (regardless of teacher)
    console.log('\n--- Searching for ALL student duplicates ---');
    const allDuplicates = await pool.query(`
      SELECT 
        s.id as student_id,
        s.name as student_name,
        a1.date,
        ts.name as time_slot_name,
        COUNT(*) as assignment_count,
        json_agg(DISTINCT jsonb_build_object(
          'assignment_id', a1.id,
          'teacher_names', (
            SELECT json_agg(t.name)
            FROM assignment_teachers at
            JOIN teachers t ON at.teacher_id = t.id
            WHERE at.assignment_id = a1.id
          )
        )) as assignments
      FROM assignments a1
      JOIN assignment_students as1 ON a1.id = as1.assignment_id
      JOIN students s ON as1.student_id = s.id
      JOIN time_slots ts ON a1.time_slot_id = ts.id
      WHERE a1.is_active = true
      GROUP BY s.id, s.name, a1.date, a1.time_slot_id, ts.name
      HAVING COUNT(*) > 1
      ORDER BY s.name, a1.date, a1.time_slot_id
    `);
    
    if (allDuplicates.rows.length === 0) {
      console.log('✅ No student duplicates found in the system');
    } else {
      console.log(`⚠️ Found ${allDuplicates.rows.length} student duplicate situation(s):`);
      for (const dup of allDuplicates.rows) {
        console.log(`Student: ${dup.student_name} (ID: ${dup.student_id})`);
        console.log(`Date: ${dup.date}, Time: ${dup.time_slot_name}`);
        console.log(`Number of assignments: ${dup.assignment_count}`);
        console.log(`Assignments: ${JSON.stringify(dup.assignments, null, 2)}`);
        console.log('');
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugKathNoelDuplicate();