import pool from './src/db/connection.js';
import Assignment from './src/models/Assignment.js';

async function fixDuplicates() {
  try {
    console.log('Fixing Kath and Noel duplicate assignments...\n');
    
    // Delete the duplicate assignments
    console.log('--- Removing duplicate assignments ---');
    await pool.query('UPDATE assignments SET is_active = false WHERE id IN (74, 75)');
    console.log('✅ Deactivated duplicate assignments 74 and 75');
    
    // Verify they're gone
    const remaining = await pool.query(`
      SELECT 
        s.name as student_name,
        a.date,
        ts.name as time_slot_name,
        COUNT(*) as assignment_count
      FROM assignments a
      JOIN assignment_students as1 ON a.id = as1.assignment_id
      JOIN students s ON as1.student_id = s.id
      JOIN time_slots ts ON a.time_slot_id = ts.id
      WHERE a.is_active = true
      AND s.name = 'Cheon Jae In'
      AND a.date = '2024-01-01'
      AND a.time_slot_id = 1
      GROUP BY s.name, a.date, a.time_slot_id, ts.name
      HAVING COUNT(*) > 1
    `);
    
    if (remaining.rows.length === 0) {
      console.log('✅ No more duplicates found for Cheon Jae In on Monday 8:00-8:30AM');
    } else {
      console.log('❌ Still have duplicates:', remaining.rows);
    }
    
    // Now test if validation would catch this if we try to recreate
    console.log('\n--- Testing validation ---');
    
    // Get teacher and student IDs
    const kathResult = await pool.query(`SELECT id FROM teachers WHERE name = 'Kath' AND is_active = true LIMIT 1`);
    const noelResult = await pool.query(`SELECT id FROM teachers WHERE name = 'Noel' AND is_active = true LIMIT 1`);
    const cheonResult = await pool.query(`SELECT id FROM students WHERE name = 'Cheon Jae In' AND is_active = true ORDER BY created_at DESC LIMIT 1`);
    
    if (kathResult.rows.length === 0 || noelResult.rows.length === 0 || cheonResult.rows.length === 0) {
      console.log('❌ Could not find required teachers/students for validation test');
      process.exit(1);
    }
    
    const kathId = kathResult.rows[0].id;
    const noelId = noelResult.rows[0].id;
    const cheonId = cheonResult.rows[0].id;
    
    // Test 1: Create Kath + Cheon assignment
    console.log('\nStep 1: Creating Kath + Cheon assignment...');
    const kathAssignmentData = {
      date: '2024-01-01',
      time_slot_id: 1,
      teachers: [{ teacher_id: kathId, is_substitute: false }],
      students: [{ student_id: cheonId }],
      notes: 'Test Kath assignment',
      subject: 'English'
    };
    
    const kathAssignment = await Assignment.create(kathAssignmentData);
    console.log(`✅ Created Kath assignment: ${kathAssignment.id}`);
    
    // Test 2: Try to create Noel + Cheon assignment (should fail)
    console.log('\nStep 2: Attempting to create Noel + Cheon assignment (should fail)...');
    const noelAssignmentData = {
      date: '2024-01-01',
      time_slot_id: 1,
      teachers: [{ teacher_id: noelId, is_substitute: false }],
      students: [{ student_id: cheonId }],
      notes: 'Test Noel assignment',
      subject: 'Math'
    };
    
    try {
      // Test validation
      const validation = await Assignment.validate(noelAssignmentData);
      console.log('Validation result:', validation);
      
      if (!validation.valid) {
        console.log('✅ SUCCESS: Validation correctly prevented duplicate');
        console.log('Errors:', validation.errors);
      } else {
        console.log('❌ PROBLEM: Validation should have failed!');
        
        // Try to create it anyway to see what happens
        try {
          const noelAssignment = await Assignment.create(noelAssignmentData);
          console.log('❌ PROBLEM: Assignment was created despite duplicate!', noelAssignment.id);
          await pool.query('UPDATE assignments SET is_active = false WHERE id = $1', [noelAssignment.id]);
        } catch (createError) {
          console.log('✅ At least creation failed:', createError.message);
        }
      }
    } catch (validationError) {
      console.log('❌ Validation threw error:', validationError.message);
    }
    
    // Clean up test assignment
    await pool.query('UPDATE assignments SET is_active = false WHERE id = $1', [kathAssignment.id]);
    console.log('✅ Cleaned up test assignment');
    
    console.log('\n✅ Duplicate fix and validation test completed');
    process.exit(0);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixDuplicates();