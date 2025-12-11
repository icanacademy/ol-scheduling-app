import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Adding subject field to assignments table...');

    // Add subject field to assignments
    await client.query(`
      ALTER TABLE assignments 
      ADD COLUMN IF NOT EXISTS subject VARCHAR(200)
    `);

    // Remove subject field from students (if it exists)
    await client.query(`
      ALTER TABLE students 
      DROP COLUMN IF EXISTS subject
    `);

    // Add index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assignments_subject 
      ON assignments(subject)
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    console.log('- Added subject column to assignments table');
    console.log('- Removed subject column from students table');
    console.log('- Added index on assignments.subject');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);