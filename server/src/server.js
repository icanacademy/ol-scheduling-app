import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './db/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import teacherRoutes from './routes/teachers.js';
import studentRoutes from './routes/students.js';
import assignmentRoutes from './routes/assignments.js';
import timeslotRoutes from './routes/timeslots.js';
import roomRoutes from './routes/rooms.js';
import notionRoutes from './routes/notion.js';
import backupRoutes from './routes/backups.js';
import weeklyRoutes from './routes/weekly.js';
import studentChangeHistoryRoutes from './routes/studentChangeHistory.js';
import chatRoutes from './routes/chat.js';
import noteRoutes from './routes/notes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      message: 'Server and database are running',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/timeslots', timeslotRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/notion', notionRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/weekly', weeklyRoutes);
app.use('/api/student-change-history', studentChangeHistoryRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/notes', noteRoutes);

// Serve static frontend files
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Serve frontend for all non-API routes (SPA fallback)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    res.status(404).json({ error: 'Route not found' });
  } else {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}/api/health`);
  console.log(`📍 Network: http://0.0.0.0:${PORT}/api/health\n`);
});
