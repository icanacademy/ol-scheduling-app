import axios from 'axios';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import TimeSlot from '../models/TimeSlot.js';

// Helper function to fetch all pages from Notion with pagination
async function fetchAllNotionPages(notionApiKey, notionDatabaseId, queryBody = {}) {
  const allResults = [];
  let hasMore = true;
  let nextCursor = undefined;

  while (hasMore) {
    const response = await axios.post(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {
        ...queryBody,
        start_cursor: nextCursor
      },
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    allResults.push(...response.data.results);
    hasMore = response.data.has_more;
    nextCursor = response.data.next_cursor;
  }

  return allResults;
}

// Map Notion time values to 30-minute time slot IDs
// This mapping assumes Notion still uses hour-based times
// Each hour maps to two 30-minute slots
const timeToSlotMap = {
  // 8AM maps to slots 1-2 (8:00-8:30, 8:30-9:00)
  '8:00AM': 1, '8:00am': 1,
  '8:30AM': 2, '8:30am': 2,
  '8AM': [1, 2], '8am': [1, 2], // If just "8AM" is specified, include both slots
  
  // 9AM maps to slots 3-4 (9:00-9:30, 9:30-10:00)
  '9:00AM': 3, '9:00am': 3,
  '9:30AM': 4, '9:30am': 4,
  '9AM': [3, 4], '9am': [3, 4],
  
  // 10AM maps to slots 5-6 (10:00-10:30, 10:30-11:00)
  '10:00AM': 5, '10:00am': 5,
  '10:30AM': 6, '10:30am': 6,
  '10AM': [5, 6], '10am': [5, 6],
  
  // 11AM maps to slots 7-8 (11:00-11:30, 11:30-12:00)
  '11:00AM': 7, '11:00am': 7,
  '11:30AM': 8, '11:30am': 8,
  '11AM': [7, 8], '11am': [7, 8],
  
  // 12PM ends the morning session
  '12:00PM': 8, '12:00pm': 8,
  '12PM': 8, '12pm': 8,
  
  // 1PM maps to slots 9-10 (1:00-1:30, 1:30-2:00)
  '1:00PM': 9, '1:00pm': 9,
  '1:30PM': 10, '1:30pm': 10,
  '1PM': [9, 10], '1pm': [9, 10],
  
  // 2PM maps to slots 11-12 (2:00-2:30, 2:30-3:00)
  '2:00PM': 11, '2:00pm': 11,
  '2:30PM': 12, '2:30pm': 12,
  '2PM': [11, 12], '2pm': [11, 12],
  
  // 3PM maps to slots 13-14 (3:00-3:30, 3:30-4:00)
  '3:00PM': 13, '3:00pm': 13,
  '3:30PM': 14, '3:30pm': 14,
  '3PM': [13, 14], '3pm': [13, 14],
  
  // 4PM maps to slots 15-16 (4:00-4:30, 4:30-5:00)
  '4:00PM': 15, '4:00pm': 15,
  '4:30PM': 16, '4:30pm': 16,
  '4PM': [15, 16], '4pm': [15, 16],
  
  // 5PM maps to slots 17-18 (5:00-5:30, 5:30-6:00)
  '5:00PM': 17, '5:00pm': 17,
  '5:30PM': 18, '5:30pm': 18,
  '5PM': [17, 18], '5pm': [17, 18],
  
  // 6PM maps to slots 19-20 (6:00-6:30, 6:30-7:00)
  '6:00PM': 19, '6:00pm': 19,
  '6:30PM': 20, '6:30pm': 20,
  '6PM': [19, 20], '6pm': [19, 20],
  
  // 7PM maps to slots 21-22 (7:00-7:30, 7:30-8:00)
  '7:00PM': 21, '7:00pm': 21,
  '7:30PM': 22, '7:30pm': 22,
  '7PM': [21, 22], '7pm': [21, 22],
  
  // 8PM maps to slots 23-24 (8:00-8:30, 8:30-9:00)
  '8:00PM': 23, '8:00pm': 23,
  '8:30PM': 24, '8:30pm': 24,
  '8PM': [23, 24], '8pm': [23, 24],
  
  // 9PM ends the evening session
  '9:00PM': 24, '9:00pm': 24,
  '9PM': 24, '9pm': 24
};

// Helper function to parse time and get slot IDs
function getSlotIds(startTime, endTime) {
  const startMapping = timeToSlotMap[startTime];
  const endMapping = timeToSlotMap[endTime];
  
  if (!startMapping || !endMapping) {
    return null;
  }
  
  // Get the first slot ID for start time
  let startSlotId;
  if (Array.isArray(startMapping)) {
    startSlotId = startMapping[0]; // Take the first slot of the hour
  } else {
    startSlotId = startMapping;
  }
  
  // Get the last slot ID for end time
  let endSlotId;
  if (Array.isArray(endMapping)) {
    endSlotId = endMapping[endMapping.length - 1]; // Take the last slot of the hour
  } else {
    endSlotId = endMapping;
  }
  
  // Generate all slot IDs from start to end
  const slotIds = [];
  for (let id = startSlotId; id <= endSlotId; id++) {
    slotIds.push(id);
  }
  
  return slotIds;
}

// Preview teachers from Notion (doesn't import, just returns list)
export const previewTeachersFromNotion = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_TEACHERS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query Notion database - no filter so we get all teachers
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

    const data = response.data;
    const teachers = [];
    const errors = [];

    // Get existing teachers for this date to check for duplicates
    const existingTeachers = await Teacher.getAll(date);
    const existingNames = new Set(existingTeachers.map(t => t.name.toLowerCase()));

    for (const page of data.results) {
      try {
        const nickname = (page.properties.Nickname?.rich_text?.[0]?.plain_text || '').trim();

        // Skip teachers without nicknames
        if (!nickname) {
          continue;
        }

        const exists = existingNames.has(nickname.toLowerCase());

        // For Desktop version, default to all 12 slots (full day availability)
        teachers.push({
          name: nickname,
          availability: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
          slots: 12,
          exists: exists
        });
      } catch (error) {
        errors.push(error.message);
      }
    }

    res.json({
      success: true,
      teachers: teachers,
      total: teachers.length,
      errors: errors
    });
  } catch (error) {
    console.error('Error previewing teachers from Notion:', error);
    res.status(500).json({ 
      error: 'Failed to preview teachers from Notion',
      details: error.message 
    });
  }
};

// Import teachers from Notion
export const importTeachersFromNotion = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_TEACHERS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query Notion database with pagination - no filter so we get all teachers
    const allPages = await fetchAllNotionPages(notionApiKey, notionDatabaseId);

    const createdTeachers = [];
    const updatedTeachers = [];
    const errors = [];

    for (const page of allPages) {
      try {
        const nickname = (page.properties.Nickname?.rich_text?.[0]?.plain_text || '').trim();
        
        // Skip teachers without nicknames
        if (!nickname) {
          continue;
        }

        // For Desktop version, default to all 12 slots (full day availability)
        const availability = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

        // Check if teacher already exists
        const existingTeacher = await Teacher.findByName(nickname, date);

        const teacherData = {
          name: nickname,
          availability: availability,
          color_keyword: 'blue',
          date: date
        };

        let teacher;
        if (existingTeacher) {
          teacher = await Teacher.reactivate(existingTeacher.id, teacherData);
          updatedTeachers.push({
            name: nickname,
            availability: 'Full day',
            slots: availability.length
          });
        } else {
          teacher = await Teacher.create(teacherData);
          createdTeachers.push({
            name: nickname,
            availability: 'Full day',
            slots: availability.length
          });
        }

      } catch (error) {
        const teacherName = page.properties.Nickname?.rich_text?.[0]?.plain_text || 'Unknown';
        errors.push(`${teacherName}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      created: createdTeachers,
      updated: updatedTeachers,
      errors: errors,
      summary: {
        total: createdTeachers.length + updatedTeachers.length,
        created: createdTeachers.length,
        updated: updatedTeachers.length,
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

// Preview students from Notion
export const previewStudentsFromNotion = async (req, res) => {
  try {
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_STUDENTS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query Notion database with pagination
    const allPages = await fetchAllNotionPages(notionApiKey, notionDatabaseId);

    const students = [];
    const errors = [];
    let skippedCount = 0;

    // Get all existing students to check which ones are already imported
    const allExistingStudents = await Student.getAllActive();

    // Check by notion_page_id (for students imported with the new system)
    const existingNotionPageIds = new Set(
      allExistingStudents
        .filter(s => s.notion_page_id)
        .map(s => s.notion_page_id)
    );

    // Also check by name (for students imported before notion_page_id was added)
    const existingNames = new Set(
      allExistingStudents.map(s => s.name.toLowerCase().trim())
    );

    for (const page of allPages) {
      try {
        // Try multiple field names for student name
        const name = (page.properties['Full Name']?.title?.[0]?.plain_text ||
                     page.properties['Student']?.title?.[0]?.plain_text ||
                     page.properties['English Name']?.rich_text?.[0]?.plain_text || '').trim();

        // Get Korean name from Notion
        const koreanName = (page.properties['Korean Name']?.rich_text?.[0]?.plain_text || '').trim();

        // Get grade level from Notion
        const grade = page.properties['Grade']?.rich_text?.[0]?.plain_text || '';

        // Get time preferences from Start Time and End Time (select fields)
        const startTime = page.properties['Start Time']?.select?.name || '';
        const endTime = page.properties['End Time']?.select?.name || '';
        let preferredTime = '';

        if (startTime && endTime) {
          preferredTime = `${startTime} - ${endTime}`;
        } else if (startTime) {
          preferredTime = `From ${startTime}`;
        } else {
          preferredTime = 'All day';
        }

        // Only require name
        if (!name) {
          continue;
        }

        // Skip students who are already imported
        // Check by Notion page ID first, then by name as fallback
        if (existingNotionPageIds.has(page.id) || existingNames.has(name.toLowerCase().trim())) {
          skippedCount++;
          continue;
        }

        // Only show students who are NOT already in the system
        students.push({
          name: name,
          koreanName: koreanName,
          grade: grade,
          preferredTime: preferredTime,
          notionPageId: page.id,
          exists: false
        });
      } catch (error) {
        errors.push(error.message);
      }
    }

    res.json({
      success: true,
      students: students,
      total: students.length,
      skipped: skippedCount,
      errors: errors
    });
  } catch (error) {
    console.error('Error previewing students from Notion:', error);
    res.status(500).json({ 
      error: 'Failed to preview students from Notion',
      details: error.message 
    });
  }
};

// Import students from Notion
export const importStudentsFromNotion = async (req, res) => {
  try {
    const { date } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_STUDENTS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query Notion database with pagination
    const allPages = await fetchAllNotionPages(notionApiKey, notionDatabaseId);

    const createdStudents = [];
    const updatedStudents = [];
    const errors = [];

    for (const page of allPages) {
      try {
        // Try multiple field names for student name (same as preview function)
        const name = (page.properties['Full Name']?.title?.[0]?.plain_text ||
                     page.properties['Student']?.title?.[0]?.plain_text ||
                     page.properties['English Name']?.rich_text?.[0]?.plain_text || '').trim();

        // Get Korean name from Notion
        const koreanName = (page.properties['Korean Name']?.rich_text?.[0]?.plain_text || '').trim();

        // Get grade level from Notion
        const grade = page.properties['Grade']?.rich_text?.[0]?.plain_text || '';

        // Get time preferences from Start Time and End Time (select fields)
        const startTime = page.properties['Start Time']?.select?.name || '';
        const endTime = page.properties['End Time']?.select?.name || '';
        const preferredTime = page.properties['Preferred Time']?.rich_text?.[0]?.plain_text || '';

        // Get the Notion page ID for unique identification
        const notionPageId = page.id;

        if (!name) {
          continue;
        }

        // Set empty availability - students start with no scheduled times
        const availability = [];

        // Determine schedule pattern based on time preferences
        let scheduleDays = []; // Empty by default - will be set manually
        let schedulePattern = 'Manual scheduling';

        if (startTime && endTime) {
          schedulePattern = `${startTime} - ${endTime}`;
          // For now, leave scheduleDays empty until we add dedicated fields to Notion
          // Later we can add logic here to parse schedule days from Notion
        }

        // Check if student already exists by Notion page ID (NOT by name)
        // This allows multiple students with the same name to be imported
        const existingStudent = await Student.findByNotionPageId(notionPageId);

        const studentData = {
          name: name,
          korean_name: koreanName,
          grade: grade,
          availability: availability,
          color_keyword: 'blue',
          date: date,
          teacher_notes: '',
          schedule_days: scheduleDays,
          schedule_pattern: schedulePattern,
          notion_page_id: notionPageId
        };

        let student;
        if (existingStudent) {
          // Update existing student (same Notion record imported before)
          student = await Student.reactivate(existingStudent.id, studentData);
          updatedStudents.push({
            name: name,
            koreanName: koreanName,
            preferredTime: startTime && endTime ? `${startTime} - ${endTime}` : 'All day',
            slots: 0
          });
        } else {
          // Create new student (new Notion record or first import)
          student = await Student.create(studentData);
          createdStudents.push({
            name: name,
            koreanName: koreanName,
            preferredTime: startTime && endTime ? `${startTime} - ${endTime}` : 'All day',
            slots: 0
          });
        }

      } catch (error) {
        const studentName = (page.properties['Full Name']?.title?.[0]?.plain_text ||
                           page.properties['Student']?.title?.[0]?.plain_text ||
                           page.properties['English Name']?.rich_text?.[0]?.plain_text || 'Unknown').trim();
        errors.push(`${studentName}: ${error.message}`);
      }
    }

    res.json({
      success: true,
      created: createdStudents,
      updated: updatedStudents,
      errors: errors,
      summary: {
        total: createdStudents.length + updatedStudents.length,
        created: createdStudents.length,
        updated: updatedStudents.length,
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

// Get all students from Notion for the Student Schedule Sheet
export const getAllNotionStudents = async (req, res) => {
  try {
    const notionApiKey = process.env.NOTION_API_KEY;
    const notionDatabaseId = process.env.NOTION_STUDENTS_DATABASE_ID;

    if (!notionApiKey || !notionDatabaseId) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Query the Notion database for active students only with pagination
    const allPages = await fetchAllNotionPages(notionApiKey, notionDatabaseId, {
      filter: {
        property: 'Status',
        select: {
          equals: 'Active'
        }
      },
      sorts: [
        {
          property: 'Full Name',
          direction: 'ascending'
        }
      ]
    });

    const students = allPages.map(page => {
      // Debug: Log the Student ID property structure
      console.log(`Student: ${page.properties['Full Name']?.title?.[0]?.plain_text}`);
      console.log('Student ID property:', JSON.stringify(page.properties['Student ID'], null, 2));

      // Handle Prefix field type specifically
      let studentId = '';
      const studentIdProp = page.properties['Student ID'];

      if (studentIdProp) {
        if (studentIdProp.unique_id) {
          // For Prefix/Unique ID fields - combine prefix and number
          const prefix = studentIdProp.unique_id.prefix || '';
          const number = studentIdProp.unique_id.number || '';
          studentId = `${prefix}${number}`;
        } else if (studentIdProp.number) {
          studentId = String(studentIdProp.number);
        } else if (studentIdProp.rich_text?.[0]?.plain_text) {
          studentId = studentIdProp.rich_text[0].plain_text;
        } else if (studentIdProp.title?.[0]?.plain_text) {
          studentId = studentIdProp.title[0].plain_text;
        } else if (studentIdProp.formula?.string) {
          studentId = studentIdProp.formula.string;
        } else if (studentIdProp.formula?.number) {
          studentId = String(studentIdProp.formula.number);
        }
      }

      console.log('Extracted Student ID:', studentId);
      console.log('---');

      // Get Korean name from Notion
      const koreanName = (page.properties['Korean Name']?.rich_text?.[0]?.plain_text || '').trim();

      // Get gender from Notion
      const gender = page.properties['Gender']?.select?.name ||
                    page.properties['Gender']?.rich_text?.[0]?.plain_text ||
                    page.properties['Sex']?.select?.name ||
                    page.properties['Sex']?.rich_text?.[0]?.plain_text || '';

      // Get start date from Notion (try different possible field names)
      const startDate = page.properties['Start Date']?.date?.start ||
                       page.properties['Program Start']?.date?.start ||
                       page.properties['First Start Date']?.date?.start ||
                       page.properties['Program Start Date']?.date?.start ||
                       page.properties['Start Date']?.rich_text?.[0]?.plain_text || '';

      return {
        notionId: page.id,
        name: (page.properties['Full Name']?.title?.[0]?.plain_text ||
               page.properties['Student']?.title?.[0]?.plain_text ||
               page.properties['English Name']?.rich_text?.[0]?.plain_text || 'Unknown').trim(),
        koreanName: koreanName,
        englishName: (page.properties['Full Name']?.title?.[0]?.plain_text ||
                     page.properties['Student']?.title?.[0]?.plain_text ||
                     page.properties['English Name']?.rich_text?.[0]?.plain_text || 'Unknown').trim(),
        grade: page.properties['Grade']?.rich_text?.[0]?.plain_text || '',
        studentId: studentId,
        gender: gender,
        startDate: startDate
      };
    });

    res.json(students);
  } catch (error) {
    console.error('Error fetching Notion students:', error);
    res.status(500).json({
      error: 'Failed to fetch students from Notion',
      message: error.message
    });
  }
};

// Get single student details from Notion by Notion page ID
export const getNotionStudentById = async (req, res) => {
  try {
    const { notionId } = req.params;
    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Fetch the specific page from Notion
    const response = await axios.get(
      `https://api.notion.com/v1/pages/${notionId}`,
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    const page = response.data;

    // Extract all student information - adapting for current database structure
    const studentData = {
      notionId: page.id,
      fullName: (page.properties['Full Name']?.title?.[0]?.plain_text ||
                page.properties['Student']?.title?.[0]?.plain_text ||
                page.properties['English Name']?.rich_text?.[0]?.plain_text || '').trim(),
      koreanName: (page.properties['Korean Name']?.rich_text?.[0]?.plain_text || '').trim(),
      englishName: (page.properties['Full Name']?.title?.[0]?.plain_text ||
                   page.properties['Student']?.title?.[0]?.plain_text ||
                   page.properties['English Name']?.rich_text?.[0]?.plain_text || '').trim(),
      grade: page.properties['Grade']?.rich_text?.[0]?.plain_text || '',
      preferredTime: page.properties['Preferred Time']?.rich_text?.[0]?.plain_text || ''
    };

    res.json(studentData);
  } catch (error) {
    console.error('Error fetching Notion student:', error);
    res.status(500).json({
      error: 'Failed to fetch student from Notion',
      message: error.message
    });
  }
};

// Update student in Notion
export const updateNotionStudent = async (req, res) => {
  try {
    const { notionId } = req.params;
    const { field, value } = req.body;

    if (!field || value === undefined) {
      return res.status(400).json({ error: 'field and value are required' });
    }

    const notionApiKey = process.env.NOTION_API_KEY;

    if (!notionApiKey) {
      return res.status(500).json({
        error: 'Notion API credentials not configured'
      });
    }

    // Map field names to Notion property names and construct the update payload
    const fieldPropertyMap = {
      preferredTime: 'Preferred Time'
    };

    const notionPropertyName = fieldPropertyMap[field];
    if (!notionPropertyName) {
      return res.status(400).json({ error: `Field '${field}' is not supported for update` });
    }

    // Construct the properties object for the update
    const properties = {};

    // For rich_text fields (like Preferred Time)
    if (field === 'preferredTime') {
      properties[notionPropertyName] = {
        rich_text: [
          {
            text: {
              content: value
            }
          }
        ]
      };
    }

    // Update the Notion page using PATCH
    const response = await axios.patch(
      `https://api.notion.com/v1/pages/${notionId}`,
      { properties },
      {
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        }
      }
    );

    res.json({
      success: true,
      message: `Successfully updated ${field}`,
      data: response.data
    });

  } catch (error) {
    console.error('Error updating Notion student:', error.response?.data || error);
    res.status(500).json({
      error: 'Failed to update student in Notion',
      message: error.response?.data?.message || error.message
    });
  }
};