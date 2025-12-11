const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkDuplicates() {
  try {
    console.log('Checking for duplicate student records...\n');
    
    // First, check for Ahn Jay specifically
    const ahnJayQuery = `
      SELECT id, name, date, first_start_date, program_start_date, created_at
      FROM students 
      WHERE LOWER(name) LIKE '%ahn jay%' 
      ORDER BY id;
    `;
    
    const ahnJayResult = await pool.query(ahnJayQuery);
    console.log('Ahn Jay Records:');
    console.table(ahnJayResult.rows);
    
    // Check for all duplicates by name
    const duplicatesQuery = `
      SELECT name, COUNT(*) as count
      FROM students 
      GROUP BY LOWER(name)
      HAVING COUNT(*) > 1
      ORDER BY count DESC;
    `;
    
    const duplicatesResult = await pool.query(duplicatesQuery);
    console.log('\nAll Duplicate Names:');
    console.table(duplicatesResult.rows);
    
    // Get details for each duplicate
    if (duplicatesResult.rows.length > 0) {
      for (const duplicate of duplicatesResult.rows) {
        console.log(`\nDetails for "${duplicate.name}":`);
        const detailQuery = `
          SELECT id, name, date, first_start_date, program_start_date, created_at
          FROM students 
          WHERE LOWER(name) = LOWER($1)
          ORDER BY id;
        `;
        const detailResult = await pool.query(detailQuery, [duplicate.name]);
        console.table(detailResult.rows);
      }
    }
    
  } catch (error) {
    console.error('Database error:', error);
  } finally {
    await pool.end();
  }
}

checkDuplicates();