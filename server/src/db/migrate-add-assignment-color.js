import pool from './connection.js';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration: Add color_keyword to assignments table');

    await client.query('BEGIN');

    // Add color_keyword column to assignments table
    console.log('Adding color_keyword column to assignments table...');
    await client.query(`
      ALTER TABLE assignments
      ADD COLUMN IF NOT EXISTS color_keyword VARCHAR(50)
    `);

    // Update existing assignments to use the first student's color
    console.log('Updating existing assignments with student colors...');
    const updateResult = await client.query(`
      UPDATE assignments a
      SET color_keyword = (
        SELECT s.color_keyword 
        FROM assignment_students ast
        JOIN students s ON s.id = ast.student_id
        WHERE ast.assignment_id = a.id
        LIMIT 1
      )
      WHERE a.color_keyword IS NULL
        AND EXISTS (
          SELECT 1 FROM assignment_students ast2 
          WHERE ast2.assignment_id = a.id
        )
    `);
    
    console.log(`Updated ${updateResult.rowCount} assignments with student colors`);

    await client.query('COMMIT');
    console.log('Migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run migration if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrate()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

export default migrate;