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

    console.log('Changing subjects array to subject field...');

    // Drop the old subjects column
    await client.query(`
      ALTER TABLE students DROP COLUMN IF EXISTS subjects
    `);

    // Add new subject column
    await client.query(`
      ALTER TABLE students ADD COLUMN IF NOT EXISTS subject VARCHAR(200)
    `);

    // Drop old index
    await client.query(`
      DROP INDEX IF EXISTS idx_students_subjects
    `);

    // Add new index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_subject ON students(subject)
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    console.log('Changed subjects (JSONB array) to subject (VARCHAR)');

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