import pool from './connection.js';

async function fixTemplatesTable() {
  try {
    // Add missing columns
    await pool.query("ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS schedule_days JSONB DEFAULT '[]'");
    await pool.query("ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS time_slots JSONB DEFAULT '[]'");
    await pool.query("ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(50) DEFAULT 'custom'");
    await pool.query("ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS color_keyword VARCHAR(50) DEFAULT 'blue'");
    await pool.query("ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS max_students INTEGER");
    await pool.query("ALTER TABLE schedule_templates ADD COLUMN IF NOT EXISTS created_by VARCHAR(100)");
    console.log('✅ Added missing columns to schedule_templates');
    
    // Add indexes
    await pool.query('CREATE INDEX IF NOT EXISTS idx_schedule_templates_days ON schedule_templates USING GIN(schedule_days)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_schedule_templates_slots ON schedule_templates USING GIN(time_slots)');
    console.log('✅ Added JSONB indexes');
    
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
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (name) DO NOTHING`,
        template
      );
    }
    console.log('✅ Added predefined templates');

    // Add template_id to students table
    await pool.query('ALTER TABLE students ADD COLUMN IF NOT EXISTS template_id INTEGER REFERENCES schedule_templates(id) ON DELETE SET NULL');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_students_template ON students(template_id)');
    console.log('✅ Added template_id to students table');
    
    console.log('Templates setup completed successfully!');
  } catch (error) {
    console.error('Error fixing templates:', error);
  } finally {
    await pool.end();
  }
}

fixTemplatesTable();