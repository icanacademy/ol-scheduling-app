import pool from './connection.js';

async function migrate() {
  const client = await pool.connect();
  try {
    console.log('Starting migration: Add date column to teachers and students tables');

    await client.query('BEGIN');

    // Add date column to teachers table
    console.log('Adding date column to teachers table...');
    await client.query(`
      ALTER TABLE teachers
      ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE
    `);

    // Add date column to students table
    console.log('Adding date column to students table...');
    await client.query(`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS date DATE NOT NULL DEFAULT CURRENT_DATE
    `);

    // Create indexes for better performance
    console.log('Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_teachers_date ON teachers(date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_date ON students(date)
    `);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => {
    console.log('✓ Migration successful');
    process.exit(0);
  })
  .catch((error) => {
    console.error('✗ Migration failed:', error);
    process.exit(1);
  });
