import pool from './connection.js';

async function insertTemplates() {
  try {
    // Clear existing templates first
    await pool.query('DELETE FROM schedule_templates WHERE template_type = $1', ['predefined']);
    console.log('✅ Cleared existing predefined templates');
    
    // Insert predefined templates
    const templates = [
      ['MWF Morning', 'Monday, Wednesday, Friday morning classes', '["Monday", "Wednesday", "Friday"]', '[1, 2, 3, 4]', 'predefined', 'blue', 5],
      ['MWF Afternoon', 'Monday, Wednesday, Friday afternoon classes', '["Monday", "Wednesday", "Friday"]', '[9, 10, 11, 12]', 'predefined', 'green', 5],
      ['Tuesday/Thursday Morning', 'Tuesday and Thursday morning sessions', '["Tuesday", "Thursday"]', '[1, 2, 3, 4]', 'predefined', 'purple', 5],
      ['Tuesday/Thursday Afternoon', 'Tuesday and Thursday afternoon sessions', '["Tuesday", "Thursday"]', '[9, 10, 11, 12]', 'predefined', 'orange', 5],
      ['Saturday Intensive', 'Saturday full day intensive course', '["Saturday"]', '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]', 'predefined', 'red', 8],
      ['Weekday Evening', 'Monday to Friday evening classes', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]', '[11, 12]', 'predefined', 'yellow', 4],
      ['Weekend Morning', 'Saturday and Sunday morning classes', '["Saturday", "Sunday"]', '[1, 2, 3, 4]', 'predefined', 'pink', 6],
      ['Daily All Day', 'Every day full availability', '["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]', '[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]', 'predefined', 'blue', 10]
    ];

    for (const template of templates) {
      await pool.query(
        `INSERT INTO schedule_templates (name, description, schedule_days, time_slots, template_type, color_keyword, max_students) 
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7)`,
        template
      );
    }
    console.log('✅ Added 8 predefined templates');
    
    // Verify insertion
    const result = await pool.query('SELECT count(*) FROM schedule_templates WHERE template_type = $1', ['predefined']);
    console.log(`✅ Total predefined templates: ${result.rows[0].count}`);
    
  } catch (error) {
    console.error('Error inserting templates:', error);
  } finally {
    await pool.end();
  }
}

insertTemplates();