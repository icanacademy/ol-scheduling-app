import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  // Get migration file from command line arg or use default
  const migrationFile = process.argv[2] || 'add_notion_page_id.sql';

  try {
    const migrationPath = path.join(__dirname, 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
      console.error(`Migration file not found: ${migrationPath}`);
      console.log('Available migrations:');
      const migrationsDir = path.join(__dirname, 'migrations');
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
      files.forEach(f => console.log(`  - ${f}`));
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf-8');

    await pool.query(sql);
    console.log(`Migration completed successfully: ${migrationFile}`);
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();