import axios from 'axios';
import pool from '../db/connection.js';

// Simple import - just get teacher names from Notion
export const importTeachersSimple = async (req, res) => {
  try {
    const { templateId, dayOfWeek } = req.body;

    if (!templateId || dayOfWeek === undefined) {
      return res.status(400).json({ error: 'templateId and dayOfWeek are required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_TEACHERS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query all teachers from Notion (no status filter since many don't have it set)
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const imported = [];
    const skipped = [];
    const errors = [];

    for (const page of response.data.results) {
      try {
        const nickname = page.properties.Nickname?.rich_text?.[0]?.plain_text || '';
        
        if (!nickname) {
          errors.push('Teacher without nickname found');
          continue;
        }

        // Check if teacher already exists for this template and day
        const checkResult = await pool.query(
          'SELECT id FROM template_teachers WHERE template_id = $1 AND name = $2 AND day_of_week = $3',
          [templateId, nickname, dayOfWeek]
        );

        if (checkResult.rows.length > 0) {
          skipped.push(nickname);
          continue;
        }

        // Add teacher with full day availability (can be adjusted later)
        const result = await pool.query(
          `INSERT INTO template_teachers (template_id, name, day_of_week, availability, color_keyword)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [templateId, nickname, dayOfWeek, JSON.stringify([]), 'blue']
        );

        imported.push(nickname);
      } catch (error) {
        errors.push(`${page.properties.Nickname?.rich_text?.[0]?.plain_text || 'Unknown'}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      imported: imported,
      skipped: skipped,
      errors: errors,
      summary: {
        total: imported.length + skipped.length,
        imported: imported.length,
        skipped: skipped.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Error importing teachers from Notion:', error);
    res.status(500).json({ 
      error: 'Failed to import teachers from Notion',
      details: error.message 
    });
  }
};

// Get all teacher names from Notion (no time requirements)
export const getNotionTeachers = async (req, res) => {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_TEACHERS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    const response = await axios.post(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {
        sorts: [
          {
            property: 'Nickname',
            direction: 'ascending'
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const teachers = [];
    for (const page of response.data.results) {
      const nickname = page.properties.Nickname?.rich_text?.[0]?.plain_text || '';
      if (nickname) {
        teachers.push({
          notionId: page.id,
          name: nickname,
          status: page.properties.Status?.select?.name || ''
        });
      }
    }

    res.json({
      success: true,
      teachers: teachers,
      total: teachers.length
    });
  } catch (error) {
    console.error('Error fetching teachers from Notion:', error);
    res.status(500).json({ 
      error: 'Failed to fetch teachers from Notion',
      details: error.message 
    });
  }
};

// Import students without time requirements
export const importStudentsSimple = async (req, res) => {
  try {
    const { templateId, dayOfWeek } = req.body;

    if (!templateId || dayOfWeek === undefined) {
      return res.status(400).json({ error: 'templateId and dayOfWeek are required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_STUDENTS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    const response = await axios.post(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const imported = [];
    const skipped = [];
    const errors = [];

    for (const page of response.data.results) {
      try {
        const name = page.properties['Student']?.title?.[0]?.plain_text || '';
        
        if (!name) {
          errors.push('Student without name found');
          continue;
        }

        // Check if student already exists
        const checkResult = await pool.query(
          'SELECT id FROM template_students WHERE template_id = $1 AND name = $2 AND day_of_week = $3',
          [templateId, name, dayOfWeek]
        );

        if (checkResult.rows.length > 0) {
          skipped.push(name);
          continue;
        }

        // Add student with full day availability
        const result = await pool.query(
          `INSERT INTO template_students (template_id, name, day_of_week, availability, color_keyword)
           VALUES ($1, $2, $3, $4, $5) RETURNING *`,
          [templateId, name, dayOfWeek, JSON.stringify([]), 'green']
        );

        imported.push(name);
      } catch (error) {
        errors.push(`${page.properties['Student']?.title?.[0]?.plain_text || 'Unknown'}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      imported: imported,
      skipped: skipped,
      errors: errors,
      summary: {
        total: imported.length + skipped.length,
        imported: imported.length,
        skipped: skipped.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Error importing students from Notion:', error);
    res.status(500).json({ 
      error: 'Failed to import students from Notion',
      details: error.message 
    });
  }
};

export default {
  importTeachersSimple,
  importStudentsSimple,
  getNotionTeachers
};