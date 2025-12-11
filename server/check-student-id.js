import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const notionApiKey = process.env.NOTION_API_KEY;
const studentsDatabaseId = process.env.NOTION_STUDENTS_DATABASE_ID;

console.log('\n===========================================');
console.log('CHECKING STUDENT ID PROPERTY');
console.log('===========================================\n');

async function checkStudentId() {
  try {
    console.log('📋 Fetching students from Notion...\n');

    const response = await axios.post(
      `https://api.notion.com/v1/databases/${studentsDatabaseId}/query`,
      {
        page_size: 5,
        filter: {
          property: 'Status',
          select: {
            equals: 'Active'
          }
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`✅ Found ${response.data.results.length} student(s)\n`);

    response.data.results.forEach((page, index) => {
      const fullName = page.properties['Full Name']?.title?.[0]?.plain_text || 'Unknown';

      console.log(`\n========== STUDENT ${index + 1}: ${fullName} ==========`);
      console.log('\n📌 Student ID Property Structure:');
      console.log(JSON.stringify(page.properties['Student ID'], null, 2));

      console.log('\n📌 All Available Properties:');
      Object.keys(page.properties).forEach(key => {
        console.log(`  - ${key}: ${page.properties[key].type}`);
      });
    });

    console.log('\n===========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Error details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkStudentId();
