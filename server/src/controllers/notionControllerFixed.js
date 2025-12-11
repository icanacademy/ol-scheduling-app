import axios from 'axios';

// Simple preview that just returns teachers with full availability
export const previewTeachersFromNotion = async (req, res) => {
  console.log('Preview teachers called');
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_TEACHERS_DATABASE_ID;
    
    console.log('API Key exists:', !!notionApiKey);
    console.log('Database ID:', notionDatabaseId);

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query Notion database
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

    const teachers = [];
    
    for (const page of response.data.results) {
      const nickname = page.properties.Nickname?.rich_text?.[0]?.plain_text || '';
      
      if (nickname) {
        teachers.push({
          name: nickname,
          availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], // All slots
          exists: false
        });
      }
    }

    // Return in the format the frontend expects
    res.json({
      success: true,
      teachers: teachers,
      total: teachers.length,
      errors: []
    });
    
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ 
      error: 'Failed to preview teachers from Notion',
      details: error.message 
    });
  }
};