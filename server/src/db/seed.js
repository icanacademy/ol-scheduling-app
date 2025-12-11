import pool from './connection.js';
import dotenv from 'dotenv';

dotenv.config();

const teachers = [
  { name: 'Analyn', availability: [2, 3, 4, 5] }, // 10AM-12PM, 1PM-3PM, 3PM-5PM, 5PM-7PM
  { name: 'Argel', availability: [2, 3, 4, 5] },
  { name: 'Cha', availability: [1, 2, 3, 4] }, // 8AM-10AM, 10AM-12PM, 1PM-3PM, 3PM-5PM
  { name: 'Ceige', availability: [1, 2, 3, 4, 5] },
  { name: 'Frenzy', availability: [2, 3, 4, 5] },
  { name: 'Deena', availability: [1, 2, 3, 4, 5, 6] },
  { name: 'Demple', availability: [1, 2, 3, 4] },
  { name: 'Eunice', availability: [1, 2, 3, 4, 5] },
  { name: 'Edward', availability: [2, 3, 4, 5] },
  { name: 'Ezra', availability: [3, 4, 5, 6] }, // 1PM-3PM, 3PM-5PM, 5PM-7PM, 7PM-9PM
  { name: 'Faye', availability: [3, 4, 5, 6] },
  { name: 'Janice', availability: [3, 4, 5, 6] },
  { name: 'Karen', availability: [3, 4, 5, 6] },
  { name: 'Mari', availability: [1, 2, 3, 4] },
  { name: 'Melody', availability: [3, 4, 5, 6] },
  { name: 'Justine', availability: [4, 5] }, // 3PM-5PM, 5PM-7PM
  { name: 'Noel', availability: [2, 3, 4, 5] },
  { name: 'Mikay', availability: [1, 2, 3, 4] },
  { name: 'Jasmin', availability: [1, 2, 3, 4] },
  { name: 'Paula', availability: [3, 4, 5, 6] },
  { name: 'Rafael', availability: [3, 4, 5] },
  { name: 'Rose', availability: [1, 2] }, // 8AM-10AM, 10AM-12PM
  { name: 'Mr. Choi', availability: [4, 5] },
  { name: 'Lianah', availability: [1, 2] },
  { name: 'Jessica', availability: [1, 2, 3, 4] },
  { name: 'Marc', availability: [1, 2, 3, 4] },
  { name: 'Joyce', availability: [1, 2, 3, 4] },
  { name: 'Delene', availability: [1, 2, 3, 4] },
  { name: 'June', availability: [1, 2, 3, 4] },
  { name: 'Luis', availability: [1, 2] },
  { name: 'Ianne', availability: [1, 2, 3, 4] },
  { name: 'Ada', availability: [1, 2] },
  { name: 'Chester', availability: [1, 2] },
  { name: 'Leah', availability: [1, 2] },
  { name: 'Ashley', availability: [1, 2, 3, 4] },
  { name: 'Chrystal', availability: [1, 2] },
];

const students = [
  { name: 'Kim Hyun Sol', availability: [4], color_keyword: null },
  { name: 'Yoo A Yeong', availability: [4], color_keyword: null },
  { name: 'Jeon Ju Jeong', availability: [2, 3], color_keyword: null },
  { name: 'Hong Seo Hun', availability: [4, 5], color_keyword: null },
  { name: 'Hong Seo Yoo', availability: [4, 5], color_keyword: null },
  { name: 'Kim Ji Min', availability: [5, 6], color_keyword: null },
  { name: 'Ihn Eun Jae', availability: [6], color_keyword: null },
  { name: 'Han Ju Won', availability: [5], color_keyword: null },
  { name: 'Han Chae Won', availability: [5], color_keyword: null },
  { name: 'Choi Ji Won', availability: [5], color_keyword: null },
  { name: 'Kim Da In', availability: [3], color_keyword: null },
  { name: 'Kim Yu Ri', availability: [3], color_keyword: null },
  { name: 'Ko Eun Seo', availability: [5], color_keyword: null },
  { name: 'Kim Ji Yong', availability: [2, 3, 4], color_keyword: null },
  { name: 'Song Jun Ho', availability: [2, 3, 4], color_keyword: null },
  { name: 'Kim Ji Hye', english_name: 'Sophia', availability: [1], color_keyword: null },
  { name: 'Kim Sang Il', availability: [1], color_keyword: null },
  { name: 'Kim Bo Yeon', english_name: 'Sharon', availability: [1], color_keyword: null },
  { name: 'Youn Chung Gwon', english_name: 'Bread', availability: [1], color_keyword: null },
  { name: 'Jeon Ye Won', english_name: 'Solar', availability: [1], color_keyword: null },
  { name: 'Noh Hee Chul', availability: [1, 2], color_keyword: null },
  { name: 'Lee Hye Eun', availability: [2], color_keyword: null },
  { name: 'Park Seo Rin', availability: [2], color_keyword: null },
  { name: 'Moon Seo In', availability: [4, 5], color_keyword: null },
  { name: 'Park Ju Man', english_name: 'Tom', availability: [1], color_keyword: null },
  { name: 'Lee Ye Ji', english_name: 'Rudia', availability: [1], color_keyword: null },
];

async function seed() {
  const client = await pool.connect();

  try {
    console.log('Starting database seeding...\n');

    // Clear existing data
    console.log('Clearing existing data...');
    await client.query('DELETE FROM assignment_students');
    await client.query('DELETE FROM assignment_teachers');
    await client.query('DELETE FROM assignments');
    await client.query('DELETE FROM students');
    await client.query('DELETE FROM teachers');
    console.log('✓ Cleared existing data\n');

    // Insert teachers
    console.log('Inserting teachers...');
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    for (const teacher of teachers) {
      await client.query(
        'INSERT INTO teachers (name, availability, date) VALUES ($1, $2, $3)',
        [teacher.name, JSON.stringify(teacher.availability), today]
      );
    }
    console.log(`✓ Inserted ${teachers.length} teachers\n`);

    // Insert students
    console.log('Inserting students...');
    for (const student of students) {
      await client.query(
        'INSERT INTO students (name, english_name, availability, color_keyword, date) VALUES ($1, $2, $3, $4, $5)',
        [
          student.name,
          student.english_name || null,
          JSON.stringify(student.availability),
          student.color_keyword,
          today
        ]
      );
    }
    console.log(`✓ Inserted ${students.length} students\n`);

    console.log('Database seeding completed successfully! 🎉');
    console.log('\nYou can now:');
    console.log('1. Start the backend: cd server && npm run dev');
    console.log('2. Start the frontend: cd client && npm run dev');
    console.log('3. Open http://localhost:5173 in your browser');

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
