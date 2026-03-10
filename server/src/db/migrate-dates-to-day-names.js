import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log('=== Running migration: convert dates to day names ===\n');

  const sqlPath = join(__dirname, 'migrations', 'convert_dates_to_day_names.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Execute the SQL migration
    await client.query(sql);

    await client.query('COMMIT');
    console.log('Migration completed successfully!');
    console.log('  - teachers.date: DATE -> VARCHAR(10) with day names');
    console.log('  - students.date: DATE -> VARCHAR(10) with day names');
    console.log('  - assignments.date: DATE -> VARCHAR(10) with day names');
    console.log('  - notes.date: DATE -> VARCHAR(10) with day names');
    console.log('  - Indexes recreated');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
