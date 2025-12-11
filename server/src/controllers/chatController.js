import OpenAI from 'openai';
import Assignment from '../models/Assignment.js';
import Teacher from '../models/Teacher.js';
import Student from '../models/Student.js';
import pool from '../db/connection.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TEMPLATE WEEK: The app uses a fixed week for scheduling (Jan 1-7, 2024)
// Monday=2024-01-01, Tuesday=2024-01-02, ..., Sunday=2024-01-07
const TEMPLATE_DATES = {
  'monday': '2024-01-01',
  'tuesday': '2024-01-02',
  'wednesday': '2024-01-03',
  'thursday': '2024-01-04',
  'friday': '2024-01-05',
  'saturday': '2024-01-06',
  'sunday': '2024-01-07'
};

// Get current day of week and map to template date
const getTodayTemplateDate = () => {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = new Date();
  const dayName = days[today.getDay()];
  return TEMPLATE_DATES[dayName] || '2024-01-01';
};

// Helper to parse relative dates - maps to TEMPLATE WEEK dates
const parseRelativeDate = (dateStr) => {
  if (!dateStr) return getTodayTemplateDate();

  const lowerDate = dateStr.toLowerCase().trim();

  // Map "today" to current day of week in template
  if (lowerDate === 'today') {
    return getTodayTemplateDate();
  }

  // Map "tomorrow" to next day in template
  if (lowerDate === 'tomorrow') {
    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const today = new Date();
    const tomorrowIndex = (today.getDay() + 1) % 7;
    const tomorrowName = days[tomorrowIndex];
    return TEMPLATE_DATES[tomorrowName] || '2024-01-01';
  }

  // Check for day names directly (monday, tuesday, etc.)
  if (TEMPLATE_DATES[lowerDate]) {
    return TEMPLATE_DATES[lowerDate];
  }

  // Check for "next monday", "next tuesday", etc.
  const nextMatch = lowerDate.match(/next\s+(\w+)/);
  if (nextMatch && TEMPLATE_DATES[nextMatch[1]]) {
    return TEMPLATE_DATES[nextMatch[1]];
  }

  // Try parsing as a regular date (for specific dates like 2024-01-03)
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Default to Monday
  return '2024-01-01';
};

// Helper to add days to a date string
const addDays = (dateStr, days) => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().split('T')[0];
};

// Helper to format 24h time to 12h AM/PM format
const formatTimeAmPm = (time24) => {
  if (!time24) return '';
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${String(minutes).padStart(2, '0')} ${period}`;
};

// Helper to find or create a teacher for a specific date
async function findOrCreateTeacherForDate(teacherName, targetDate) {
  const searchResult = await pool.query(
    `SELECT * FROM teachers
     WHERE LOWER(name) LIKE LOWER($1) AND is_active = true
     ORDER BY date DESC LIMIT 1`,
    [`%${teacherName}%`]
  );

  if (searchResult.rows.length === 0) {
    // Try to find similar names to suggest
    const allTeachers = await pool.query(
      `SELECT DISTINCT ON (LOWER(name)) name FROM teachers WHERE is_active = true ORDER BY LOWER(name), date DESC`
    );
    const teacherNames = allTeachers.rows.map(t => t.name);

    // Find similar names (simple fuzzy match)
    const similar = teacherNames.filter(name => {
      const lowerName = name.toLowerCase();
      const searchTerm = teacherName.toLowerCase();
      return lowerName.includes(searchTerm) || searchTerm.includes(lowerName) ||
             (searchTerm.length >= 2 && lowerName.startsWith(searchTerm.substring(0, 2)));
    });

    let suggestion = '';
    if (similar.length > 0) {
      suggestion = ` Did you mean: ${similar.slice(0, 3).join(', ')}?`;
    } else {
      suggestion = ` Available teachers: ${teacherNames.slice(0, 10).join(', ')}${teacherNames.length > 10 ? '...' : ''}`;
    }

    return { found: false, error: `No teacher found matching "${teacherName}".${suggestion}` };
  }

  const sourceTeacher = searchResult.rows[0];

  const existingResult = await pool.query(
    `SELECT * FROM teachers
     WHERE LOWER(name) = LOWER($1) AND date = $2 AND is_active = true`,
    [sourceTeacher.name, targetDate]
  );

  if (existingResult.rows.length > 0) {
    return { found: true, teacher: existingResult.rows[0] };
  }

  const newTeacher = await Teacher.create({
    name: sourceTeacher.name,
    color_keyword: sourceTeacher.color_keyword,
    availability: sourceTeacher.availability || [],
    date: targetDate
  });

  return { found: true, teacher: newTeacher, created: true };
}

// Helper to find or create a student for a specific date
async function findOrCreateStudentForDate(studentName, targetDate) {
  const searchResult = await pool.query(
    `SELECT * FROM students
     WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(english_name) LIKE LOWER($1))
     AND is_active = true
     ORDER BY date DESC LIMIT 1`,
    [`%${studentName}%`]
  );

  if (searchResult.rows.length === 0) {
    // Try to find similar names to suggest
    const allStudents = await pool.query(
      `SELECT DISTINCT ON (LOWER(name)) name, english_name FROM students WHERE is_active = true ORDER BY LOWER(name), date DESC`
    );
    const studentNames = allStudents.rows.map(s => s.english_name ? `${s.name} (${s.english_name})` : s.name);

    // Find similar names (simple fuzzy match)
    const similar = allStudents.rows.filter(s => {
      const searchTerm = studentName.toLowerCase();
      return s.name.toLowerCase().includes(searchTerm) ||
             (s.english_name && s.english_name.toLowerCase().includes(searchTerm)) ||
             searchTerm.includes(s.name.toLowerCase()) ||
             (s.english_name && searchTerm.includes(s.english_name.toLowerCase()));
    }).map(s => s.english_name ? `${s.name} (${s.english_name})` : s.name);

    let suggestion = '';
    if (similar.length > 0) {
      suggestion = ` Did you mean: ${similar.slice(0, 3).join(', ')}?`;
    } else {
      suggestion = ` Use "list all students" to see available students.`;
    }

    return { found: false, error: `No student found matching "${studentName}".${suggestion}` };
  }

  const sourceStudent = searchResult.rows[0];

  const existingResult = await pool.query(
    `SELECT * FROM students
     WHERE LOWER(name) = LOWER($1) AND date = $2 AND is_active = true`,
    [sourceStudent.name, targetDate]
  );

  if (existingResult.rows.length > 0) {
    return { found: true, student: existingResult.rows[0] };
  }

  const newStudent = await Student.create({
    name: sourceStudent.name,
    english_name: sourceStudent.english_name,
    color_keyword: sourceStudent.color_keyword,
    availability: sourceStudent.availability || [],
    weakness_level: sourceStudent.weakness_level,
    teacher_notes: sourceStudent.teacher_notes,
    date: targetDate
  });

  return { found: true, student: newStudent, created: true };
}

// Helper to parse time string and return hours/minutes
function parseTimeString(timeStr) {
  let normalizedTime = timeStr.toLowerCase().trim();

  const pmMatch = normalizedTime.match(/(\d{1,2})(?::(\d{2}))?\s*pm/i);
  const amMatch = normalizedTime.match(/(\d{1,2})(?::(\d{2}))?\s*am/i);

  let hours, minutes = 0;

  if (pmMatch) {
    hours = parseInt(pmMatch[1]);
    minutes = pmMatch[2] ? parseInt(pmMatch[2]) : 0;
    if (hours !== 12) hours += 12;
  } else if (amMatch) {
    hours = parseInt(amMatch[1]);
    minutes = amMatch[2] ? parseInt(amMatch[2]) : 0;
    if (hours === 12) hours = 0;
  } else {
    const match = normalizedTime.match(/(\d{1,2})(?::(\d{2}))?/);
    if (match) {
      hours = parseInt(match[1]);
      minutes = match[2] ? parseInt(match[2]) : 0;
    } else {
      return null;
    }
  }

  return { hours, minutes };
}

// Helper to find time slot by time
async function findTimeSlotByTime(timeStr) {
  const result = await pool.query('SELECT * FROM time_slots ORDER BY display_order');
  const timeSlots = result.rows;

  const parsed = parseTimeString(timeStr);
  if (!parsed) return null;

  const targetTime = `${String(parsed.hours).padStart(2, '0')}:${String(parsed.minutes).padStart(2, '0')}:00`;
  const slot = timeSlots.find(ts => ts.start_time === targetTime);
  return slot || null;
}

// Helper to get all time slots
async function getAllTimeSlots() {
  const result = await pool.query('SELECT * FROM time_slots ORDER BY display_order');
  return result.rows;
}

// Helper to get rooms
async function getAllRooms() {
  const result = await pool.query('SELECT * FROM rooms ORDER BY display_order');
  return result.rows;
}

// Helper to find room by name/number
async function findRoomByName(roomName) {
  const result = await pool.query(
    `SELECT * FROM rooms WHERE LOWER(name) = LOWER($1) OR name = $1`,
    [String(roomName)]
  );
  return result.rows[0] || null;
}

// Define available functions for OpenAI
const tools = [
  // === VIEW/QUERY FUNCTIONS ===
  {
    type: "function",
    function: {
      name: "get_schedule",
      description: "Get all class assignments/schedule for a specific date.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Date in YYYY-MM-DD format, or relative like 'today', 'tomorrow', 'monday'"
          }
        },
        required: ["date"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_all_teachers",
      description: "Get a list of ALL teachers in the system.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_all_students",
      description: "Get a list of ALL students in the system.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "list_all_rooms",
      description: "Get a list of ALL rooms available for scheduling.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "get_time_slots",
      description: "Get all available time slots.",
      parameters: { type: "object", properties: {} }
    }
  },
  {
    type: "function",
    function: {
      name: "search_teacher",
      description: "Search for a teacher by name.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Teacher name to search for" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_teacher_availability",
      description: "Get a teacher's availability - the time slots they have marked as available in the system. Use this when user asks 'what time is [teacher] available' or 'when can [teacher] teach'.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Teacher name to check availability for" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_student",
      description: "Search for a student by name (Korean or English).",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Student name to search for" }
        },
        required: ["name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_classes_by_teacher",
      description: "Get ALL classes for a specific teacher across the entire week. Use when user asks 'show Analyn's classes' or 'what classes does John have'.",
      parameters: {
        type: "object",
        properties: {
          teacher_name: { type: "string", description: "Teacher name to find classes for" }
        },
        required: ["teacher_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_classes_by_student",
      description: "Get ALL classes for a specific student across the entire week. Use when user asks 'show Ahn Jay's schedule' or 'what classes does Kim have'.",
      parameters: {
        type: "object",
        properties: {
          student_name: { type: "string", description: "Student name to find classes for" }
        },
        required: ["student_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "find_available_slots",
      description: "Find available time slots when a teacher is free (not already teaching). Use when user asks 'when is Analyn free' or 'find available slot for John'.",
      parameters: {
        type: "object",
        properties: {
          teacher_name: { type: "string", description: "Teacher name to check availability for" },
          date: { type: "string", description: "Date to check (optional, defaults to all days)" }
        },
        required: ["teacher_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_help",
      description: "Show all available commands and capabilities. Use when user asks 'what can you do', 'help', or 'show commands'.",
      parameters: { type: "object", properties: {} }
    }
  },

  // === CREATE FUNCTIONS ===
  {
    type: "function",
    function: {
      name: "create_class",
      description: "Create a new class/assignment for a single time slot (30 minutes).",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date (YYYY-MM-DD or 'today', 'tomorrow', etc.)" },
          time: { type: "string", description: "Start time (e.g., '8am', '14:30')" },
          teacher_names: { type: "array", items: { type: "string" }, description: "Teacher names" },
          student_names: { type: "array", items: { type: "string" }, description: "Student names" },
          room: { type: "string", description: "Room number/name (optional)" },
          notes: { type: "string", description: "Optional notes" }
        },
        required: ["date", "time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_class_range",
      description: "Create a class spanning multiple time slots (e.g., 8am to 10am = 4 slots). Use this for classes longer than 30 minutes.",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date (YYYY-MM-DD or 'today', 'tomorrow', etc.)" },
          start_time: { type: "string", description: "Start time (e.g., '8am')" },
          end_time: { type: "string", description: "End time (e.g., '10am')" },
          teacher_names: { type: "array", items: { type: "string" }, description: "Teacher names" },
          student_names: { type: "array", items: { type: "string" }, description: "Student names" },
          room: { type: "string", description: "Room number/name (optional)" },
          notes: { type: "string", description: "Optional notes" }
        },
        required: ["date", "start_time", "end_time"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_bulk_classes",
      description: "Create multiple classes at once for different days. Useful for setting up a week's schedule.",
      parameters: {
        type: "object",
        properties: {
          classes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string", description: "Date" },
                time: { type: "string", description: "Time" },
                teacher_names: { type: "array", items: { type: "string" } },
                student_names: { type: "array", items: { type: "string" } },
                room: { type: "string" }
              },
              required: ["date", "time"]
            },
            description: "Array of class objects to create"
          }
        },
        required: ["classes"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_recurring_class",
      description: "Create a recurring weekly class that repeats on the same day/time for multiple weeks.",
      parameters: {
        type: "object",
        properties: {
          start_date: { type: "string", description: "First class date (YYYY-MM-DD or 'monday', etc.)" },
          time: { type: "string", description: "Class time (e.g., '9am')" },
          teacher_names: { type: "array", items: { type: "string" }, description: "Teacher names" },
          student_names: { type: "array", items: { type: "string" }, description: "Student names" },
          room: { type: "string", description: "Room (optional)" },
          weeks: { type: "integer", description: "Number of weeks to repeat (default 4)" },
          notes: { type: "string", description: "Optional notes" }
        },
        required: ["start_date", "time"]
      }
    }
  },

  // === UPDATE FUNCTIONS ===
  {
    type: "function",
    function: {
      name: "update_class",
      description: "Update/modify an existing class. Can change time, date, teachers, students, or room.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class to update" },
          new_date: { type: "string", description: "New date (optional)" },
          new_time: { type: "string", description: "New time (optional)" },
          teacher_names: { type: "array", items: { type: "string" }, description: "New teacher names (replaces existing)" },
          student_names: { type: "array", items: { type: "string" }, description: "New student names (replaces existing)" },
          room: { type: "string", description: "New room (optional)" },
          notes: { type: "string", description: "New notes (optional)" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "move_class",
      description: "REQUIRED for moving/rescheduling a class. Use this when user says 'move class X to Y time' or 'reschedule class'. This preserves all teachers and students - just changes the time/date. DO NOT use delete_class for moving!",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class to move (e.g., 43)" },
          new_date: { type: "string", description: "New date (optional, keeps same date if not provided)" },
          new_time: { type: "string", description: "New time like '2pm' or '14:00' (optional, keeps same time if not provided)" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_student_to_class",
      description: "Add a student to an existing class without removing other students.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class" },
          student_name: { type: "string", description: "Student name to add" }
        },
        required: ["assignment_id", "student_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "remove_student_from_class",
      description: "Remove a student from an existing class.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class" },
          student_name: { type: "string", description: "Student name to remove" }
        },
        required: ["assignment_id", "student_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "swap_teacher",
      description: "Replace one teacher with another in a class. Use when user says 'replace Analyn with John in class 45' or 'swap teacher'.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class" },
          old_teacher_name: { type: "string", description: "Current teacher to remove" },
          new_teacher_name: { type: "string", description: "New teacher to add" }
        },
        required: ["assignment_id", "old_teacher_name", "new_teacher_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "add_teacher_to_class",
      description: "Add an additional teacher to an existing class without removing other teachers.",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class" },
          teacher_name: { type: "string", description: "Teacher name to add" }
        },
        required: ["assignment_id", "teacher_name"]
      }
    }
  },

  // === DELETE FUNCTIONS ===
  {
    type: "function",
    function: {
      name: "delete_class",
      description: "Permanently delete/cancel a class. Only use when user explicitly wants to DELETE or CANCEL a class. For MOVING a class to a different time, use move_class instead!",
      parameters: {
        type: "object",
        properties: {
          assignment_id: { type: "integer", description: "ID of the class to delete" }
        },
        required: ["assignment_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "delete_all_classes_on_date",
      description: "Delete ALL classes on a specific date. Use with caution!",
      parameters: {
        type: "object",
        properties: {
          date: { type: "string", description: "Date to clear" },
          confirm: { type: "boolean", description: "Must be true to confirm deletion" }
        },
        required: ["date", "confirm"]
      }
    }
  },

  // === COPY FUNCTIONS ===
  {
    type: "function",
    function: {
      name: "copy_day_schedule",
      description: "Copy all classes from one day to another.",
      parameters: {
        type: "object",
        properties: {
          source_date: { type: "string", description: "Date to copy from" },
          target_date: { type: "string", description: "Date to copy to" }
        },
        required: ["source_date", "target_date"]
      }
    }
  }
];

// Function implementations
async function executeFunction(name, args) {
  try {
    const timeSlots = await getAllTimeSlots();
    const timeSlotsMap = timeSlots.reduce((acc, ts) => {
      acc[ts.id] = ts;
      return acc;
    }, {});

    switch (name) {
      // === VIEW/QUERY FUNCTIONS ===
      case 'get_schedule': {
        const date = parseRelativeDate(args.date);
        const assignments = await Assignment.getByDate(date);
        // Get day name from template date
        const dayNames = { '2024-01-01': 'Monday', '2024-01-02': 'Tuesday', '2024-01-03': 'Wednesday',
                          '2024-01-04': 'Thursday', '2024-01-05': 'Friday', '2024-01-06': 'Saturday', '2024-01-07': 'Sunday' };

        return {
          date,
          day: dayNames[date] || date,
          count: assignments.length,
          assignments: assignments.map(a => ({
            id: a.id,
            time: formatTimeAmPm(timeSlotsMap[a.time_slot_id]?.start_time) || 'Unknown',
            teachers: a.teachers?.map(t => t.name) || [],
            students: a.students?.map(s => s.name + (s.english_name ? ` (${s.english_name})` : '')) || [],
            room: a.room_id ? `Room ${a.room_id}` : 'Online',
            notes: a.notes
          }))
        };
      }

      case 'list_all_teachers': {
        const result = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) name, color_keyword
           FROM teachers WHERE is_active = true
           ORDER BY LOWER(name), date DESC`
        );
        return { count: result.rows.length, teachers: result.rows.map(t => t.name) };
      }

      case 'list_all_students': {
        const result = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) name, english_name, color_keyword
           FROM students WHERE is_active = true
           ORDER BY LOWER(name), date DESC`
        );
        return {
          count: result.rows.length,
          students: result.rows.map(s => s.name + (s.english_name ? ` (${s.english_name})` : ''))
        };
      }

      case 'list_all_rooms': {
        const rooms = await getAllRooms();
        return {
          count: rooms.length,
          rooms: rooms.map(r => ({ name: r.name, capacity: r.capacity }))
        };
      }

      case 'get_time_slots': {
        return {
          time_slots: timeSlots.map(ts => ({
            id: ts.id,
            time: formatTimeAmPm(ts.start_time) + ' - ' + formatTimeAmPm(ts.end_time)
          }))
        };
      }

      case 'search_teacher': {
        const result = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) * FROM teachers
           WHERE LOWER(name) LIKE LOWER($1) AND is_active = true
           ORDER BY LOWER(name), date DESC`,
          [`%${args.name}%`]
        );
        return {
          found: result.rows.length > 0,
          teachers: result.rows.map(t => ({ name: t.name, color_keyword: t.color_keyword }))
        };
      }

      case 'get_teacher_availability': {
        const searchName = args.name.toLowerCase().trim();

        // Get all active teachers
        const allTeachersResult = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) * FROM teachers
           WHERE is_active = true
           ORDER BY LOWER(name), date DESC`
        );

        const allTeachers = allTeachersResult.rows;

        // Find exact match first
        let exactMatch = allTeachers.find(t => t.name.toLowerCase() === searchName);

        // If no exact match, try starts-with match
        if (!exactMatch) {
          const startsWithMatches = allTeachers.filter(t =>
            t.name.toLowerCase().startsWith(searchName)
          );
          if (startsWithMatches.length === 1) {
            exactMatch = startsWithMatches[0];
          } else if (startsWithMatches.length > 1) {
            // Multiple matches - ask for clarification
            return {
              found: false,
              ambiguous: true,
              message: `Multiple teachers match "${args.name}". Did you mean: ${startsWithMatches.map(t => t.name).join(', ')}?`
            };
          }
        }

        // If still no match, try contains match
        if (!exactMatch) {
          const containsMatches = allTeachers.filter(t =>
            t.name.toLowerCase().includes(searchName) ||
            searchName.includes(t.name.toLowerCase())
          );
          if (containsMatches.length === 1) {
            exactMatch = containsMatches[0];
          } else if (containsMatches.length > 1) {
            return {
              found: false,
              ambiguous: true,
              message: `Multiple teachers match "${args.name}". Did you mean: ${containsMatches.map(t => t.name).join(', ')}?`
            };
          }
        }

        // If still no match, try fuzzy matching (similar names)
        if (!exactMatch) {
          // Simple fuzzy: check if at least 60% of characters match
          const fuzzyMatches = allTeachers.filter(t => {
            const teacherName = t.name.toLowerCase();
            let matchCount = 0;
            for (const char of searchName) {
              if (teacherName.includes(char)) matchCount++;
            }
            return matchCount >= searchName.length * 0.6 && searchName.length >= 2;
          });

          if (fuzzyMatches.length === 1) {
            exactMatch = fuzzyMatches[0];
          } else if (fuzzyMatches.length > 1) {
            return {
              found: false,
              ambiguous: true,
              message: `No exact match for "${args.name}". Did you mean: ${fuzzyMatches.slice(0, 5).map(t => t.name).join(', ')}?`
            };
          }
        }

        // No match at all
        if (!exactMatch) {
          const teacherNames = allTeachers.map(t => t.name).join(', ');
          return {
            found: false,
            error: `No teacher found matching "${args.name}". Available teachers: ${teacherNames}`
          };
        }

        const teacher = exactMatch;
        const availability = teacher.availability || [];

        // Map time slot IDs to actual times
        const availableSlots = availability
          .map(slotId => {
            const slot = timeSlotsMap[slotId];
            if (!slot) return null;
            return {
              id: slotId,
              time: formatTimeAmPm(slot.start_time) + ' - ' + formatTimeAmPm(slot.end_time)
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.id - b.id);

        return {
          found: true,
          teacher_name: teacher.name,
          available_times: availableSlots.map(s => s.time),
          available_slot_ids: availability,
          total_slots: availableSlots.length
        };
      }

      case 'search_student': {
        const result = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) * FROM students
           WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(english_name) LIKE LOWER($1))
           AND is_active = true
           ORDER BY LOWER(name), date DESC`,
          [`%${args.name}%`]
        );
        return {
          found: result.rows.length > 0,
          students: result.rows.map(s => ({
            name: s.name,
            english_name: s.english_name,
            color_keyword: s.color_keyword
          }))
        };
      }

      case 'get_classes_by_teacher': {
        const dayNames = { '2024-01-01': 'Monday', '2024-01-02': 'Tuesday', '2024-01-03': 'Wednesday',
                          '2024-01-04': 'Thursday', '2024-01-05': 'Friday', '2024-01-06': 'Saturday', '2024-01-07': 'Sunday' };

        // Find teacher across all dates
        const teacherResult = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) name FROM teachers
           WHERE LOWER(name) LIKE LOWER($1) AND is_active = true
           ORDER BY LOWER(name), date DESC`,
          [`%${args.teacher_name}%`]
        );

        if (teacherResult.rows.length === 0) {
          return { found: false, error: `No teacher found matching "${args.teacher_name}"` };
        }

        const teacherName = teacherResult.rows[0].name;

        // Get all assignments where this teacher is assigned
        const assignmentsResult = await pool.query(
          `SELECT a.*, ts.start_time
           FROM assignments a
           JOIN time_slots ts ON a.time_slot_id = ts.id
           JOIN assignment_teachers at ON a.id = at.assignment_id
           JOIN teachers t ON at.teacher_id = t.id
           WHERE LOWER(t.name) = LOWER($1)
           ORDER BY a.date, ts.display_order`,
          [teacherName]
        );

        const classesByDay = {};
        for (const row of assignmentsResult.rows) {
          const day = dayNames[row.date] || row.date;
          if (!classesByDay[day]) classesByDay[day] = [];

          // Get full assignment details
          const assignment = await Assignment.getById(row.id);
          classesByDay[day].push({
            id: row.id,
            time: formatTimeAmPm(row.start_time),
            students: assignment.students?.map(s => s.name + (s.english_name ? ` (${s.english_name})` : '')) || [],
            room: assignment.room_id ? `Room ${assignment.room_id}` : 'Online'
          });
        }

        return {
          found: true,
          teacher: teacherName,
          total_classes: assignmentsResult.rows.length,
          schedule: classesByDay
        };
      }

      case 'get_classes_by_student': {
        const dayNames = { '2024-01-01': 'Monday', '2024-01-02': 'Tuesday', '2024-01-03': 'Wednesday',
                          '2024-01-04': 'Thursday', '2024-01-05': 'Friday', '2024-01-06': 'Saturday', '2024-01-07': 'Sunday' };

        // Find student across all dates
        const studentResult = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) name, english_name FROM students
           WHERE (LOWER(name) LIKE LOWER($1) OR LOWER(english_name) LIKE LOWER($1))
           AND is_active = true
           ORDER BY LOWER(name), date DESC`,
          [`%${args.student_name}%`]
        );

        if (studentResult.rows.length === 0) {
          return { found: false, error: `No student found matching "${args.student_name}"` };
        }

        const student = studentResult.rows[0];
        const studentDisplayName = student.name + (student.english_name ? ` (${student.english_name})` : '');

        // Get all assignments where this student is assigned
        const assignmentsResult = await pool.query(
          `SELECT a.*, ts.start_time
           FROM assignments a
           JOIN time_slots ts ON a.time_slot_id = ts.id
           JOIN assignment_students ast ON a.id = ast.assignment_id
           JOIN students s ON ast.student_id = s.id
           WHERE LOWER(s.name) = LOWER($1)
           ORDER BY a.date, ts.display_order`,
          [student.name]
        );

        const classesByDay = {};
        for (const row of assignmentsResult.rows) {
          const day = dayNames[row.date] || row.date;
          if (!classesByDay[day]) classesByDay[day] = [];

          // Get full assignment details
          const assignment = await Assignment.getById(row.id);
          classesByDay[day].push({
            id: row.id,
            time: formatTimeAmPm(row.start_time),
            teachers: assignment.teachers?.map(t => t.name) || [],
            room: assignment.room_id ? `Room ${assignment.room_id}` : 'Online'
          });
        }

        return {
          found: true,
          student: studentDisplayName,
          total_classes: assignmentsResult.rows.length,
          schedule: classesByDay
        };
      }

      case 'find_available_slots': {
        const dayNames = { '2024-01-01': 'Monday', '2024-01-02': 'Tuesday', '2024-01-03': 'Wednesday',
                          '2024-01-04': 'Thursday', '2024-01-05': 'Friday', '2024-01-06': 'Saturday', '2024-01-07': 'Sunday' };

        // Find teacher
        const teacherResult = await pool.query(
          `SELECT DISTINCT ON (LOWER(name)) name FROM teachers
           WHERE LOWER(name) LIKE LOWER($1) AND is_active = true
           ORDER BY LOWER(name), date DESC`,
          [`%${args.teacher_name}%`]
        );

        if (teacherResult.rows.length === 0) {
          return { found: false, error: `No teacher found matching "${args.teacher_name}"` };
        }

        const teacherName = teacherResult.rows[0].name;
        const targetDates = args.date ? [parseRelativeDate(args.date)] : Object.values(TEMPLATE_DATES);

        // Get all existing assignments for this teacher
        const busyResult = await pool.query(
          `SELECT a.date, a.time_slot_id, ts.start_time
           FROM assignments a
           JOIN time_slots ts ON a.time_slot_id = ts.id
           JOIN assignment_teachers at ON a.id = at.assignment_id
           JOIN teachers t ON at.teacher_id = t.id
           WHERE LOWER(t.name) = LOWER($1) AND a.date = ANY($2)
           ORDER BY a.date, ts.display_order`,
          [teacherName, targetDates]
        );

        const busySlots = new Set(busyResult.rows.map(r => `${r.date}-${r.time_slot_id}`));

        const availableByDay = {};
        for (const date of targetDates) {
          const day = dayNames[date] || date;
          const freeSlots = timeSlots.filter(ts => !busySlots.has(`${date}-${ts.id}`));
          if (freeSlots.length > 0) {
            availableByDay[day] = freeSlots.map(ts => formatTimeAmPm(ts.start_time));
          }
        }

        return {
          found: true,
          teacher: teacherName,
          available_slots: availableByDay,
          note: "These are times when the teacher is NOT currently scheduled"
        };
      }

      case 'get_help': {
        return {
          message: "Here's what I can help you with:",
          capabilities: {
            view: [
              "show schedule for [day]",
              "list all teachers / students",
              "show [teacher]'s classes",
              "show [student]'s schedule",
              "when is [teacher] free/available"
            ],
            create: [
              "create class with [teacher] and [student] at [time] on [day]",
              "schedule [student] with [teacher] from [start] to [end]",
              "create recurring class every [day] at [time]",
              "copy [day]'s schedule to [other day]"
            ],
            modify: [
              "move class [id] to [new time]",
              "add [student] to class [id]",
              "remove [student] from class [id]",
              "swap [teacher1] with [teacher2] in class [id]"
            ],
            delete: [
              "delete class [id]",
              "clear all classes on [day]"
            ]
          },
          examples: [
            "Create a class with Analyn and Ahn Jay at 9am on Monday",
            "Show all of John's classes",
            "Move class 45 to 2pm",
            "When is Ceige available?",
            "Add Kim to class 32"
          ]
        };
      }

      // === CREATE FUNCTIONS ===
      case 'create_class': {
        const date = parseRelativeDate(args.date);
        const timeSlot = await findTimeSlotByTime(args.time);
        if (!timeSlot) {
          return { success: false, error: `Invalid time: ${args.time}. Valid times are from 8:00 AM to 11:00 PM in 30-minute intervals (e.g., 8am, 9:30am, 2pm, 10:30pm).` };
        }

        const teacherIds = [];
        const studentIds = [];
        const errors = [];

        for (const name of (args.teacher_names || [])) {
          const result = await findOrCreateTeacherForDate(name, date);
          if (result.found) teacherIds.push(result.teacher.id);
          else errors.push(result.error);
        }

        for (const name of (args.student_names || [])) {
          const result = await findOrCreateStudentForDate(name, date);
          if (result.found) studentIds.push(result.student.id);
          else errors.push(result.error);
        }

        if (teacherIds.length === 0 && studentIds.length === 0) {
          return { success: false, error: errors.join('; ') || 'No teachers or students specified' };
        }

        // Auto-mark teachers as available at this time slot
        for (const teacherId of teacherIds) {
          try {
            const teacherResult = await pool.query('SELECT id, name, availability FROM teachers WHERE id = $1', [teacherId]);
            if (teacherResult.rows.length > 0) {
              let availability = teacherResult.rows[0].availability || [];
              if (!availability.includes(timeSlot.id)) {
                availability = [...availability, timeSlot.id].sort((a, b) => a - b);
                await pool.query('UPDATE teachers SET availability = $1::jsonb WHERE id = $2', [JSON.stringify(availability), teacherId]);
                console.log(`[Chat] Updated teacher ${teacherResult.rows[0].name} availability to include slot ${timeSlot.id}`);
              }
            }
          } catch (err) {
            console.error(`[Chat] Error updating teacher availability:`, err.message);
          }
        }

        // Auto-mark students as available at this time slot
        for (const studentId of studentIds) {
          try {
            const studentResult = await pool.query('SELECT id, name, availability FROM students WHERE id = $1', [studentId]);
            if (studentResult.rows.length > 0) {
              let availability = studentResult.rows[0].availability || [];
              if (!availability.includes(timeSlot.id)) {
                availability = [...availability, timeSlot.id].sort((a, b) => a - b);
                await pool.query('UPDATE students SET availability = $1::jsonb WHERE id = $2', [JSON.stringify(availability), studentId]);
                console.log(`[Chat] Updated student ${studentResult.rows[0].name} availability to include slot ${timeSlot.id}`);
              }
            }
          } catch (err) {
            console.error(`[Chat] Error updating student availability:`, err.message);
          }
        }

        // Find room if specified
        let roomId = null;
        if (args.room) {
          const room = await findRoomByName(args.room);
          if (room) roomId = room.id;
        }

        const assignmentData = {
          date,
          time_slot_id: timeSlot.id,
          room_id: roomId,
          teachers: teacherIds.map(id => ({ teacher_id: id, is_substitute: false })),
          students: studentIds.map(id => ({ student_id: id })),
          notes: args.notes || null
        };

        const validation = await Assignment.validate(assignmentData);
        if (!validation.valid) {
          return { success: false, error: `Conflict: ${validation.errors.join('; ')}` };
        }

        const assignment = await Assignment.create(assignmentData);
        // Get day name from template date
        const dayNames = { '2024-01-01': 'Monday', '2024-01-02': 'Tuesday', '2024-01-03': 'Wednesday',
                          '2024-01-04': 'Thursday', '2024-01-05': 'Friday', '2024-01-06': 'Saturday', '2024-01-07': 'Sunday' };
        return {
          success: true,
          message: 'Class created!',
          class: {
            id: assignment.id,
            day: dayNames[date] || date,
            time: formatTimeAmPm(timeSlot.start_time),
            teachers: assignment.teachers?.map(t => t.name) || [],
            students: assignment.students?.map(s => s.name) || []
          }
        };
      }

      case 'create_class_range': {
        const date = parseRelativeDate(args.date);
        const startParsed = parseTimeString(args.start_time);
        const endParsed = parseTimeString(args.end_time);

        if (!startParsed || !endParsed) {
          return { success: false, error: 'Invalid start or end time' };
        }

        const startMinutes = startParsed.hours * 60 + startParsed.minutes;
        const endMinutes = endParsed.hours * 60 + endParsed.minutes;
        const slotCount = Math.floor((endMinutes - startMinutes) / 30);

        if (slotCount <= 0) {
          return { success: false, error: 'End time must be after start time' };
        }

        const createdClasses = [];
        const errors = [];

        for (let i = 0; i < slotCount; i++) {
          const slotMinutes = startMinutes + (i * 30);
          const hours = Math.floor(slotMinutes / 60);
          const mins = slotMinutes % 60;
          const timeStr = `${hours}:${String(mins).padStart(2, '0')}`;

          const result = await executeFunction('create_class', {
            date: args.date,
            time: timeStr,
            teacher_names: args.teacher_names,
            student_names: args.student_names,
            room: args.room,
            notes: args.notes
          });

          if (result.success) {
            createdClasses.push(result.class);
          } else {
            errors.push(`${timeStr}: ${result.error}`);
          }
        }

        return {
          success: createdClasses.length > 0,
          message: `Created ${createdClasses.length} of ${slotCount} time slots`,
          classes: createdClasses,
          errors: errors.length > 0 ? errors : undefined
        };
      }

      case 'create_bulk_classes': {
        const results = [];
        for (const classData of args.classes) {
          const result = await executeFunction('create_class', classData);
          results.push({
            date: classData.date,
            time: classData.time,
            success: result.success,
            error: result.error,
            id: result.class?.id
          });
        }

        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          message: `Created ${successCount} of ${args.classes.length} classes`,
          results
        };
      }

      case 'create_recurring_class': {
        const startDate = parseRelativeDate(args.start_date);
        const weeks = args.weeks || 4;
        const results = [];

        for (let i = 0; i < weeks; i++) {
          const classDate = addDays(startDate, i * 7);
          const result = await executeFunction('create_class', {
            date: classDate,
            time: args.time,
            teacher_names: args.teacher_names,
            student_names: args.student_names,
            room: args.room,
            notes: args.notes
          });

          results.push({
            date: classDate,
            success: result.success,
            error: result.error,
            id: result.class?.id
          });
        }

        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          message: `Created recurring class for ${successCount} of ${weeks} weeks`,
          results
        };
      }

      // === UPDATE FUNCTIONS ===
      case 'update_class': {
        const existing = await Assignment.getById(args.assignment_id);
        if (!existing) {
          return { success: false, error: 'Class not found' };
        }

        const updateData = {};

        if (args.new_date) {
          updateData.date = parseRelativeDate(args.new_date);
        }

        if (args.new_time) {
          const timeSlot = await findTimeSlotByTime(args.new_time);
          if (!timeSlot) {
            return { success: false, error: `Invalid time: ${args.new_time}. Try formats like 8am, 9:30am, 2pm, or 14:30.` };
          }
          updateData.time_slot_id = timeSlot.id;
        }

        const targetDate = updateData.date || existing.date;

        if (args.teacher_names) {
          const teacherIds = [];
          for (const name of args.teacher_names) {
            const result = await findOrCreateTeacherForDate(name, targetDate);
            if (result.found) teacherIds.push(result.teacher.id);
          }
          updateData.teachers = teacherIds.map(id => ({ teacher_id: id, is_substitute: false }));
        }

        if (args.student_names) {
          const studentIds = [];
          for (const name of args.student_names) {
            const result = await findOrCreateStudentForDate(name, targetDate);
            if (result.found) studentIds.push(result.student.id);
          }
          updateData.students = studentIds.map(id => ({ student_id: id }));
        }

        if (args.room) {
          const room = await findRoomByName(args.room);
          if (room) updateData.room_id = room.id;
        }

        if (args.notes !== undefined) {
          updateData.notes = args.notes;
        }

        const updated = await Assignment.update(args.assignment_id, updateData);
        return {
          success: true,
          message: 'Class updated!',
          class: {
            id: updated.id,
            date: updated.date,
            time: formatTimeAmPm(timeSlotsMap[updated.time_slot_id]?.start_time),
            teachers: updated.teachers?.map(t => t.name) || [],
            students: updated.students?.map(s => s.name) || []
          }
        };
      }

      case 'move_class': {
        const existing = await Assignment.getById(args.assignment_id);
        if (!existing) {
          return { success: false, error: 'Class not found' };
        }

        const updateData = {};

        if (args.new_date) {
          updateData.date = parseRelativeDate(args.new_date);
        }

        if (args.new_time) {
          const timeSlot = await findTimeSlotByTime(args.new_time);
          if (!timeSlot) {
            return { success: false, error: `Invalid time: ${args.new_time}. Try formats like 8am, 9:30am, 2pm, or 14:30.` };
          }
          updateData.time_slot_id = timeSlot.id;
        }

        if (Object.keys(updateData).length === 0) {
          return { success: false, error: 'No new date or time specified' };
        }

        const updated = await Assignment.update(args.assignment_id, updateData);
        return {
          success: true,
          message: 'Class moved!',
          class: {
            id: updated.id,
            date: updated.date,
            time: timeSlotsMap[updated.time_slot_id]?.start_time?.slice(0, 5)
          }
        };
      }

      case 'add_student_to_class': {
        const existing = await Assignment.getById(args.assignment_id);
        if (!existing) {
          return { success: false, error: 'Class not found' };
        }

        const studentResult = await findOrCreateStudentForDate(args.student_name, existing.date);
        if (!studentResult.found) {
          return { success: false, error: studentResult.error };
        }

        const existingStudentIds = existing.students?.map(s => s.id) || [];
        if (existingStudentIds.includes(studentResult.student.id)) {
          return { success: false, error: 'Student is already in this class' };
        }

        const newStudents = [...existingStudentIds, studentResult.student.id].map(id => ({ student_id: id }));
        const updated = await Assignment.update(args.assignment_id, { students: newStudents });

        return {
          success: true,
          message: `Added ${studentResult.student.name} to class`,
          students: updated.students?.map(s => s.name) || []
        };
      }

      case 'remove_student_from_class': {
        const existing = await Assignment.getById(args.assignment_id);
        if (!existing) {
          return { success: false, error: 'Class not found' };
        }

        const studentToRemove = existing.students?.find(
          s => s.name.toLowerCase().includes(args.student_name.toLowerCase()) ||
               (s.english_name && s.english_name.toLowerCase().includes(args.student_name.toLowerCase()))
        );

        if (!studentToRemove) {
          return { success: false, error: 'Student not found in this class' };
        }

        const newStudents = existing.students
          .filter(s => s.id !== studentToRemove.id)
          .map(s => ({ student_id: s.id }));

        const updated = await Assignment.update(args.assignment_id, { students: newStudents });

        return {
          success: true,
          message: `Removed ${studentToRemove.name} from class`,
          students: updated.students?.map(s => s.name) || []
        };
      }

      case 'swap_teacher': {
        const existing = await Assignment.getById(args.assignment_id);
        if (!existing) {
          return { success: false, error: 'Class not found' };
        }

        // Find the old teacher to remove
        const oldTeacher = existing.teachers?.find(
          t => t.name.toLowerCase().includes(args.old_teacher_name.toLowerCase())
        );

        if (!oldTeacher) {
          return {
            success: false,
            error: `Teacher "${args.old_teacher_name}" not found in this class. Current teachers: ${existing.teachers?.map(t => t.name).join(', ') || 'none'}`
          };
        }

        // Find or create the new teacher
        const newTeacherResult = await findOrCreateTeacherForDate(args.new_teacher_name, existing.date);
        if (!newTeacherResult.found) {
          return { success: false, error: newTeacherResult.error };
        }

        // Build new teachers list
        const newTeachers = existing.teachers
          .filter(t => t.id !== oldTeacher.id)
          .map(t => ({ teacher_id: t.id, is_substitute: t.is_substitute || false }));
        newTeachers.push({ teacher_id: newTeacherResult.teacher.id, is_substitute: false });

        const updated = await Assignment.update(args.assignment_id, { teachers: newTeachers });

        return {
          success: true,
          message: `Replaced ${oldTeacher.name} with ${newTeacherResult.teacher.name}`,
          teachers: updated.teachers?.map(t => t.name) || []
        };
      }

      case 'add_teacher_to_class': {
        const existing = await Assignment.getById(args.assignment_id);
        if (!existing) {
          return { success: false, error: 'Class not found' };
        }

        const teacherResult = await findOrCreateTeacherForDate(args.teacher_name, existing.date);
        if (!teacherResult.found) {
          return { success: false, error: teacherResult.error };
        }

        const existingTeacherIds = existing.teachers?.map(t => t.id) || [];
        if (existingTeacherIds.includes(teacherResult.teacher.id)) {
          return { success: false, error: 'Teacher is already assigned to this class' };
        }

        const newTeachers = [...existingTeacherIds, teacherResult.teacher.id].map(id => ({
          teacher_id: id,
          is_substitute: false
        }));
        const updated = await Assignment.update(args.assignment_id, { teachers: newTeachers });

        return {
          success: true,
          message: `Added ${teacherResult.teacher.name} to class`,
          teachers: updated.teachers?.map(t => t.name) || []
        };
      }

      // === DELETE FUNCTIONS ===
      case 'delete_class': {
        const assignment = await Assignment.delete(args.assignment_id);
        if (!assignment) {
          return { success: false, error: 'Class not found' };
        }
        return { success: true, message: 'Class deleted!' };
      }

      case 'delete_all_classes_on_date': {
        if (!args.confirm) {
          return { success: false, error: 'Must set confirm=true to delete all classes' };
        }

        const date = parseRelativeDate(args.date);
        const result = await Assignment.deleteByDate(date);
        return {
          success: true,
          message: `Deleted ${result.count} classes on ${date}`
        };
      }

      // === COPY FUNCTIONS ===
      case 'copy_day_schedule': {
        const sourceDate = parseRelativeDate(args.source_date);
        const targetDate = parseRelativeDate(args.target_date);

        if (sourceDate === targetDate) {
          return { success: false, error: 'Source and target dates must be different' };
        }

        const sourceAssignments = await Assignment.getByDate(sourceDate);
        if (sourceAssignments.length === 0) {
          return { success: false, error: `No classes found on ${sourceDate}` };
        }

        const results = [];
        for (const assignment of sourceAssignments) {
          const result = await executeFunction('create_class', {
            date: targetDate,
            time: formatTimeAmPm(timeSlotsMap[assignment.time_slot_id]?.start_time),
            teacher_names: assignment.teachers?.map(t => t.name) || [],
            student_names: assignment.students?.map(s => s.name) || [],
            notes: assignment.notes
          });
          results.push(result);
        }

        const successCount = results.filter(r => r.success).length;
        return {
          success: successCount > 0,
          message: `Copied ${successCount} of ${sourceAssignments.length} classes from ${sourceDate} to ${targetDate}`
        };
      }

      default:
        return { error: `Unknown function: ${name}` };
    }
  } catch (error) {
    console.error(`Error executing ${name}:`, error);
    return { error: error.message };
  }
}

// System prompt for the AI
const getSystemPrompt = () => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const todayDayName = days[new Date().getDay()];

  return `You are a helpful scheduling assistant for ICAN Academy's online class scheduling system.

IMPORTANT - TEMPLATE WEEK SYSTEM:
This app uses a FIXED TEMPLATE WEEK (not real dates). When user says "today" or a day name, use these mappings:
- Monday = 2024-01-01
- Tuesday = 2024-01-02
- Wednesday = 2024-01-03
- Thursday = 2024-01-04
- Friday = 2024-01-05
- Saturday = 2024-01-06
- Sunday = 2024-01-07

Current day of week: ${todayDayName} (maps to ${TEMPLATE_DATES[todayDayName.toLowerCase()]})

AVAILABLE FUNCTIONS (use these directly):

VIEW FUNCTIONS:
- get_schedule(date) - View all classes on a date
- list_all_teachers() - List all teachers
- list_all_students() - List all students
- list_all_rooms() - List all rooms
- search_teacher(name) - Find a teacher
- search_student(name) - Find a student
- get_teacher_availability(name) - Get a teacher's MARKED available time slots from their profile
- get_classes_by_teacher(teacher_name) - Get ALL classes for a teacher across the week
- get_classes_by_student(student_name) - Get ALL classes for a student across the week
- find_available_slots(teacher_name, date?) - Find when a teacher is FREE (not scheduled)
- get_help() - Show all available commands

CREATE FUNCTIONS:
- create_class(date, time, teacher_names[], student_names[]) - Create ONE 30-min class
- create_class_range(date, start_time, end_time, teacher_names[], student_names[]) - Create class spanning multiple slots (e.g., 8am-10am)
- create_recurring_class(start_date, time, teacher_names[], student_names[], weeks) - Create weekly recurring class
- create_bulk_classes(classes[]) - Create multiple classes at once

UPDATE FUNCTIONS:
- move_class(assignment_id, new_time, new_date) - JUST moves a class to new time/date, keeps teachers & students
- update_class(assignment_id, ...) - Full update of a class
- add_student_to_class(assignment_id, student_name) - Add student to existing class
- remove_student_from_class(assignment_id, student_name) - Remove student from class
- add_teacher_to_class(assignment_id, teacher_name) - Add another teacher to a class
- swap_teacher(assignment_id, old_teacher_name, new_teacher_name) - Replace one teacher with another

DELETE FUNCTIONS:
- delete_class(assignment_id) - Delete one class (ONLY for actual deletions!)
- delete_all_classes_on_date(date, confirm=true) - Clear entire day

COPY FUNCTIONS:
- copy_day_schedule(source_date, target_date) - Copy all classes from one day to another

TEACHERS LIST (use list_all_teachers to get current list):
AJ, Analyn, Argel, Ceige, Deena, Eunice, Ezra, Faye, Janice, Jennifer, John, Joric, Karen, Kath, Leo, Melody, Noel, Paula, Rafael, Rozeil

CRITICAL RULES:
1. **TEACHERS vs STUDENTS**:
   - TEACHERS are who TEACH the class (Analyn, John, AJ, etc.)
   - STUDENTS are who ATTEND the class (Ahn Jay, Kim Ha Min, etc.)
   - When user says "Ahn Jay with Analyn" = Analyn is TEACHER, Ahn Jay is STUDENT
   - Every class MUST have at least one teacher AND one student
2. **MOVE vs DELETE**: When user says "move", "reschedule", or "change time" → ALWAYS use move_class function! NEVER use delete_class for moving!
3. **SWAP vs DELETE**: When user says "replace X with Y" or "swap teacher" → use swap_teacher! NEVER delete and recreate!
4. **DELETE**: Only use delete_class when user explicitly says "delete", "cancel", or "remove the class entirely"
5. Use teacher/student NAMES not IDs when creating classes
6. For time ranges like "8am to 10am", use create_class_range
7. Time slots are 30 minutes each (8:00-22:00)
8. Always confirm actions after completing them

EXAMPLES:
- "Ahn Jay and Analyn at 8am" → create_class(teacher_names=["Analyn"], student_names=["Ahn Jay"])
- "show John's classes" → get_classes_by_teacher(teacher_name="John")
- "when is Ceige free?" → find_available_slots(teacher_name="Ceige")
- "move class 45 to 2pm" → move_class(assignment_id=45, new_time="2pm")
- "replace Analyn with John in class 45" → swap_teacher(assignment_id=45, old_teacher_name="Analyn", new_teacher_name="John")
- "add Kim to class 32" → add_student_to_class(assignment_id=32, student_name="Kim")
- "delete class 45" → delete_class(assignment_id=45)
- "help" or "what can you do?" → get_help()

TIME FORMATS: "8am", "2pm", "14:30", "9:30am"
DATE FORMATS: "today", "monday", "tuesday", etc. (maps to template week)

Be concise and helpful!`;
};

// Main chat endpoint
export const chat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your-openai-api-key-here') {
      return res.status(500).json({
        error: 'OpenAI API key not configured',
        message: 'Please add your OpenAI API key to the server/.env file'
      });
    }

    // Keyword detection to force correct function usage
    const lowerMessage = message.toLowerCase();
    let toolChoice = 'auto';
    let enhancedMessage = message;

    // Check for help command
    const isHelpCommand = lowerMessage === 'help' ||
                          lowerMessage.includes('what can you do') ||
                          lowerMessage.includes('show commands') ||
                          lowerMessage.includes('how do i use') ||
                          lowerMessage.includes('what are your capabilities');

    // Check for swap/replace teacher patterns
    const isSwapTeacherCommand = lowerMessage.match(/(?:swap|replace|substitute)\s+(\w+)\s+(?:with|for)\s+(\w+)\s+(?:in\s+)?class\s+(\d+)/i) ||
                                  lowerMessage.match(/class\s+(\d+).*(?:swap|replace|substitute)\s+(\w+)\s+(?:with|for)\s+(\w+)/i);

    // Check for show teacher's classes patterns
    const isShowTeacherClassesCommand = lowerMessage.match(/(?:show|list|get|what are|what's)\s+(\w+)(?:'s|s)?\s+(?:classes|schedule|assignments)/i) ||
                                         lowerMessage.match(/(?:classes|schedule)\s+(?:for|of)\s+(\w+)/i);

    // Check for show student's classes patterns
    const isShowStudentClassesCommand = lowerMessage.match(/(?:show|list|get)\s+(\w+)(?:'s|s)?\s+(?:schedule|classes)/i) &&
                                         !isShowTeacherClassesCommand;

    // Check for when is teacher free (not just "available" which could mean profile availability)
    const isFindFreeSlots = lowerMessage.match(/when\s+is\s+(\w+)\s+free/i) ||
                            lowerMessage.match(/find\s+(?:free|available|open)\s+(?:slots?|times?)\s+(?:for\s+)?(\w+)/i) ||
                            lowerMessage.match(/(\w+)(?:'s)?\s+free\s+(?:slots?|times?)/i);

    // Check for teacher availability query (e.g., "what time is ceige available", "when can ceige teach")
    const teacherAvailabilityMatch = lowerMessage.match(/(?:what\s+time|when)\s+(?:is|can)\s+(\w+)(?:'s)?\s+(?:available|teach)/i) ||
                                     lowerMessage.match(/(\w+)(?:'s)?\s+(?:available|availability)\s+(?:time|slots?)/i);

    // Check for move/reschedule patterns FIRST (highest priority)
    const isMoveCommand = lowerMessage.includes('move class') ||
                          lowerMessage.includes('reschedule class') ||
                          lowerMessage.match(/move\s+class\s+\d+/i) ||
                          lowerMessage.match(/reschedule\s+class\s+\d+/i);

    // Check for add student patterns
    const isAddStudentCommand = lowerMessage.match(/add\s+(student\s+)?(.+?)\s+to\s+class\s+(\d+)/i);

    // Check for remove student patterns
    const isRemoveStudentCommand = lowerMessage.match(/remove\s+(student\s+)?(.+?)\s+from\s+class\s+(\d+)/i);

    // Check for add teacher patterns
    const isAddTeacherCommand = lowerMessage.match(/add\s+(teacher\s+)?(\w+)\s+to\s+class\s+(\d+)/i);

    // Now apply tool_choice based on priority
    if (isHelpCommand) {
      toolChoice = { type: 'function', function: { name: 'get_help' } };
      console.log('[Chat] Forcing get_help function');
    } else if (isMoveCommand) {
      // MOVE CLASS has highest priority - never override this
      toolChoice = { type: 'function', function: { name: 'move_class' } };
      console.log('[Chat] Forcing move_class function (highest priority)');
    } else if (isSwapTeacherCommand) {
      toolChoice = { type: 'function', function: { name: 'swap_teacher' } };
      console.log('[Chat] Forcing swap_teacher function');
    } else if (isFindFreeSlots) {
      toolChoice = { type: 'function', function: { name: 'find_available_slots' } };
      console.log('[Chat] Forcing find_available_slots function');
    } else if (teacherAvailabilityMatch) {
      // Teacher availability query - profile-based
      toolChoice = { type: 'function', function: { name: 'get_teacher_availability' } };
      console.log('[Chat] Forcing get_teacher_availability function');
    } else if (isAddStudentCommand) {
      toolChoice = { type: 'function', function: { name: 'add_student_to_class' } };
      console.log('[Chat] Forcing add_student_to_class function');
    } else if (isRemoveStudentCommand) {
      toolChoice = { type: 'function', function: { name: 'remove_student_from_class' } };
      console.log('[Chat] Forcing remove_student_from_class function');
    } else if (isAddTeacherCommand) {
      toolChoice = { type: 'function', function: { name: 'add_teacher_to_class' } };
      console.log('[Chat] Forcing add_teacher_to_class function');
    } else if (isShowTeacherClassesCommand) {
      toolChoice = { type: 'function', function: { name: 'get_classes_by_teacher' } };
      console.log('[Chat] Forcing get_classes_by_teacher function');
    } else {
      // Only check for time range, recurring, and copy if not a move/student command

      // Detect time range patterns like "8am to 10am" or "from 8am to 10am"
      const timeRangeMatch = lowerMessage.match(/(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
      if (timeRangeMatch && (lowerMessage.includes('create') || lowerMessage.includes('schedule') || lowerMessage.includes('book'))) {
        toolChoice = { type: 'function', function: { name: 'create_class_range' } };
        console.log('[Chat] Forcing create_class_range function');
      }

      // Detect recurring/weekly patterns
      else if ((lowerMessage.includes('recurring') || lowerMessage.includes('weekly') || lowerMessage.includes('every week'))
          && lowerMessage.includes('class')) {
        toolChoice = { type: 'function', function: { name: 'create_recurring_class' } };
        console.log('[Chat] Forcing create_recurring_class function');
      }

      // Detect copy day patterns
      else if ((lowerMessage.includes('copy') && lowerMessage.includes('schedule')) ||
          lowerMessage.match(/copy\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|today|tomorrow)/i)) {
        toolChoice = { type: 'function', function: { name: 'copy_day_schedule' } };
        console.log('[Chat] Forcing copy_day_schedule function');
      }
    }

    const messages = [
      { role: 'system', content: getSystemPrompt() },
      ...conversationHistory,
      { role: 'user', content: enhancedMessage }
    ];

    // Track if we're forcing a specific function to prevent wrong function calls
    const forcedFunction = typeof toolChoice === 'object' ? toolChoice.function.name : null;

    console.log(`[Chat] Initial tool_choice:`, JSON.stringify(toolChoice));

    let response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools,
      tool_choice: toolChoice,
      max_tokens: 2000
    });

    let assistantMessage = response.choices[0].message;
    let iterations = 0;
    const maxIterations = 15;

    while (assistantMessage.tool_calls && iterations < maxIterations) {
      iterations++;
      const toolResults = [];

      for (const toolCall of assistantMessage.tool_calls) {
        let functionName = toolCall.function.name;
        let functionArgs = JSON.parse(toolCall.function.arguments);

        console.log(`[Chat] Requested function: ${functionName}`, JSON.stringify(functionArgs).slice(0, 100));

        // SAFETY CHECK: Block delete_class when we forced move_class
        if (forcedFunction === 'move_class' && functionName === 'delete_class') {
          console.log(`[Chat] BLOCKED delete_class - user wants move_class! Converting to move_class.`);
          // Convert delete to move - extract the assignment_id
          functionName = 'move_class';
          // Try to extract target time from original message
          const timeMatch = lowerMessage.match(/to\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
          functionArgs = {
            assignment_id: functionArgs.assignment_id,
            new_time: timeMatch ? timeMatch[1] : null
          };
          console.log(`[Chat] Converted to move_class with args:`, functionArgs);
        }

        // SAFETY CHECK: Block delete when we forced add_student_to_class
        if (forcedFunction === 'add_student_to_class' && functionName === 'delete_class') {
          console.log(`[Chat] BLOCKED delete_class - user wants add_student_to_class!`);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ error: 'Cannot delete class - please use add_student_to_class function instead' })
          });
          continue;
        }

        // SAFETY CHECK: Block delete when we forced swap_teacher
        if (forcedFunction === 'swap_teacher' && functionName === 'delete_class') {
          console.log(`[Chat] BLOCKED delete_class - user wants swap_teacher!`);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ error: 'Cannot delete class - please use swap_teacher function to replace the teacher instead' })
          });
          continue;
        }

        // SAFETY CHECK: Block delete when we forced add_teacher_to_class
        if (forcedFunction === 'add_teacher_to_class' && functionName === 'delete_class') {
          console.log(`[Chat] BLOCKED delete_class - user wants add_teacher_to_class!`);
          toolResults.push({
            tool_call_id: toolCall.id,
            role: 'tool',
            content: JSON.stringify({ error: 'Cannot delete class - please use add_teacher_to_class function instead' })
          });
          continue;
        }

        console.log(`[Chat] Executing: ${functionName}`, JSON.stringify(functionArgs).slice(0, 100));

        const result = await executeFunction(functionName, functionArgs);

        console.log(`[Chat] Result:`, JSON.stringify(result).slice(0, 150));

        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(result)
        });
      }

      messages.push(assistantMessage);
      messages.push(...toolResults);

      response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        tools,
        tool_choice: 'auto',
        max_tokens: 2000
      });

      assistantMessage = response.choices[0].message;
    }

    res.json({
      response: assistantMessage.content,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: assistantMessage.content }
      ]
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      message: error.message
    });
  }
};
