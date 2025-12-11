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

    console.log('Adding Student Schedule Sheet fields to students table...');

    await client.query(`
      ALTER TABLE students
      -- Program Details (3 fields)
      ADD COLUMN IF NOT EXISTS school TEXT,
      ADD COLUMN IF NOT EXISTS program_start_date DATE,
      ADD COLUMN IF NOT EXISTS program_end_date DATE,

      -- Student Information (4 fields)
      ADD COLUMN IF NOT EXISTS student_id VARCHAR(50),
      ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
      ADD COLUMN IF NOT EXISTS grade VARCHAR(20),
      ADD COLUMN IF NOT EXISTS student_type VARCHAR(50),

      -- Level Test Scores (5 fields)
      ADD COLUMN IF NOT EXISTS reading_score INTEGER,
      ADD COLUMN IF NOT EXISTS grammar_score INTEGER,
      ADD COLUMN IF NOT EXISTS listening_score INTEGER,
      ADD COLUMN IF NOT EXISTS writing_score INTEGER,
      ADD COLUMN IF NOT EXISTS level_test_total INTEGER,

      -- Reading Level - Before (3 fields)
      ADD COLUMN IF NOT EXISTS wpm_initial INTEGER,
      ADD COLUMN IF NOT EXISTS gbwt_initial INTEGER,
      ADD COLUMN IF NOT EXISTS reading_level_initial VARCHAR(20),

      -- Interview Score (1 field)
      ADD COLUMN IF NOT EXISTS interview_score INTEGER
    `);

    await client.query('COMMIT');
    console.log('✅ Migration completed successfully!');
    console.log('\nAdded 17 columns:');
    console.log('  Program Details: school, program_start_date, program_end_date');
    console.log('  Student Info: student_id, gender, grade, student_type');
    console.log('  Level Test: reading_score, grammar_score, listening_score, writing_score, level_test_total');
    console.log('  Reading Level: wpm_initial, gbwt_initial, reading_level_initial');
    console.log('  Interview: interview_score');

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
