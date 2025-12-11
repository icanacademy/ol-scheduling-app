import pool from './src/db/connection.js';
import fs from 'fs';

async function runRoomMigration() {
  try {
    console.log('Running room requirement removal migration...\n');
    
    // Read the migration SQL
    const migrationSQL = fs.readFileSync('./src/db/migrations/remove_room_requirement.sql', 'utf8');
    
    console.log('Migration SQL:');
    console.log(migrationSQL);
    console.log('\n--- Executing Migration ---');
    
    // Execute the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the change
    const result = await pool.query(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'assignments' AND column_name = 'room_id'
    `);
    
    console.log('\n--- Verification ---');
    console.log('room_id column info:', result.rows[0]);
    
    // Check how many assignments now have NULL room_id
    const countResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(room_id) as with_room,
        COUNT(*) - COUNT(room_id) as null_rooms
      FROM assignments
    `);
    
    console.log('Assignment room statistics:', countResult.rows[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('Migration error:', error);
    process.exit(1);
  }
}

runRoomMigration();