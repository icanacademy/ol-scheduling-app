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

    console.log('Adding subjects field to students table...');

    // Add subjects field
    await client.query(`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS subjects JSONB DEFAULT '[]'
    `);

    // Add index for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_subjects 
      ON students USING GIN(subjects)
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    console.log('Added column: subjects (JSONB) with GIN index');

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