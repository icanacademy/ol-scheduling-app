import pool from './connection.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTemplatesMigration() {
  try {
    const migrationPath = path.join(__dirname, 'migrations/add_schedule_templates.sql');
    const sql = fs.readFileSync(migrationPath, 'utf-8');
    
    await pool.query(sql);
    console.log('Templates migration completed successfully!');
    console.log('✅ Created schedule_templates table');
    console.log('✅ Created template_assignments table');  
    console.log('✅ Added 8 predefined templates');
    console.log('✅ Added template_id to students table');
  } catch (error) {
    console.error('Templates migration failed:', error);
  } finally {
    await pool.end();
  }
}

runTemplatesMigration();