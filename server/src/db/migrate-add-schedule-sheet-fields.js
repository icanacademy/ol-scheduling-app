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

    console.log('Adding schedule sheet fields to students table...');

    await client.query(`
      ALTER TABLE students
      ADD COLUMN IF NOT EXISTS school TEXT,
      ADD COLUMN IF NOT EXISTS program_start_date DATE,
      ADD COLUMN IF NOT EXISTS program_end_date DATE
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    console.log('Added columns: school, program_start_date, program_end_date');

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
