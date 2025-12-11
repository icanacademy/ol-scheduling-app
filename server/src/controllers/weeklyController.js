import Student from '../models/Student.js';
import Teacher from '../models/Teacher.js';
import { getWeekRange } from '../utils/weekUtils.js';

/**
 * Get all students and teachers for a given week
 */
export const getWeeklyData = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const { dates } = getWeekRange(date);
    
    // Get students and teachers for all dates in the week
    const weeklyData = {};
    
    for (const currentDate of dates) {
      const students = await Student.getAll(currentDate);
      const teachers = await Teacher.getAll(currentDate);
      
      weeklyData[currentDate] = {
        students,
        teachers,
        date: currentDate
      };
    }

    res.json({
      success: true,
      weekRange: getWeekRange(date),
      data: weeklyData
    });
  } catch (error) {
    console.error('Error fetching weekly data:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weekly data',
      details: error.message 
    });
  }
};

/**
 * Copy students/teachers from one day to another within the same week
 */
export const copyDaySchedule = async (req, res) => {
  try {
    const { fromDate, toDate, copyStudents = true, copyTeachers = true } = req.body;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({ error: 'fromDate and toDate are required' });
    }

    // Verify both dates are in the same week
    const fromWeek = getWeekRange(fromDate);
    const toWeek = getWeekRange(toDate);
    
    if (fromWeek.startDate !== toWeek.startDate) {
      return res.status(400).json({ error: 'Dates must be in the same week' });
    }

    const results = {
      students: { copied: 0, errors: [] },
      teachers: { copied: 0, errors: [] }
    };

    // Copy students
    if (copyStudents) {
      const sourceStudents = await Student.getAll(fromDate);
      
      for (const student of sourceStudents) {
        try {
          const existingStudent = await Student.findByName(student.name, toDate);
          
          const studentData = {
            name: student.name,
            english_name: student.english_name,
            availability: student.availability,
            color_keyword: student.color_keyword,
            weakness_level: student.weakness_level,
            teacher_notes: student.teacher_notes,
            schedule_days: student.schedule_days,
            schedule_pattern: student.schedule_pattern,
            date: toDate
          };
          
          if (existingStudent) {
            await Student.reactivate(existingStudent.id, studentData);
          } else {
            await Student.create(studentData);
          }
          
          results.students.copied++;
        } catch (error) {
          results.students.errors.push(`${student.name}: ${error.message}`);
        }
      }
    }

    // Copy teachers
    if (copyTeachers) {
      const sourceTeachers = await Teacher.getAll(fromDate);
      
      for (const teacher of sourceTeachers) {
        try {
          const existingTeacher = await Teacher.findByName(teacher.name, toDate);
          
          const teacherData = {
            name: teacher.name,
            availability: teacher.availability,
            color_keyword: teacher.color_keyword,
            date: toDate
          };
          
          if (existingTeacher) {
            await Teacher.reactivate(existingTeacher.id, teacherData);
          } else {
            await Teacher.create(teacherData);
          }
          
          results.teachers.copied++;
        } catch (error) {
          results.teachers.errors.push(`${teacher.name}: ${error.message}`);
        }
      }
    }

    res.json({
      success: true,
      message: `Copied schedule from ${fromDate} to ${toDate}`,
      results
    });
  } catch (error) {
    console.error('Error copying day schedule:', error);
    res.status(500).json({ 
      error: 'Failed to copy day schedule',
      details: error.message 
    });
  }
};

/**
 * Get students filtered by their schedule days for weekly view
 */
export const getStudentsForWeeklyView = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'date is required' });
    }

    const { dates } = getWeekRange(date);
    const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const weeklyStudents = {};
    
    // Initialize each day
    dates.forEach((currentDate, index) => {
      weeklyStudents[currentDate] = {
        date: currentDate,
        dayName: dayNames[index],
        students: []
      };
    });

    // Get all students for the week and filter by schedule days
    for (let i = 0; i < dates.length; i++) {
      const currentDate = dates[i];
      const dayName = dayNames[i];
      
      const allStudents = await Student.getAll(currentDate);
      
      // Filter students who should be scheduled for this day
      const dayStudents = allStudents.filter(student => {
        const scheduleDays = student.schedule_days || [];
        // If no schedule days set, they can be manually scheduled any day
        return scheduleDays.length === 0 || scheduleDays.includes(dayName);
      });
      
      weeklyStudents[currentDate].students = dayStudents;
    }

    res.json({
      success: true,
      weekRange: getWeekRange(date),
      data: weeklyStudents
    });
  } catch (error) {
    console.error('Error fetching students for weekly view:', error);
    res.status(500).json({ 
      error: 'Failed to fetch weekly student data',
      details: error.message 
    });
  }
};