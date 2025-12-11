import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Health check
export const checkHealth = () => api.get('/health');

// Teachers
export const getTeachers = (date) => api.get('/teachers', { params: { date } });
export const getTeacherById = (id) => api.get(`/teachers/${id}`);
export const createTeacher = (data) => api.post('/teachers', data);
export const updateTeacher = (id, data) => api.put(`/teachers/${id}`, data);
export const deleteTeacher = (id) => api.delete(`/teachers/${id}`);
export const deleteAllTeachers = (date) => api.delete('/teachers/all', { data: { date } });

// Students
export const getStudents = (date) => api.get('/students', { params: { date } });
export const getAllUniqueStudents = () => api.get('/students/all-unique');
export const getStudentById = (id) => api.get(`/students/${id}`);
export const createStudent = (data) => api.post('/students', data);
export const updateStudent = (id, data) => api.put(`/students/${id}`, data);
export const deleteStudent = (id) => api.delete(`/students/${id}`);
export const deleteAllStudents = (date) => api.delete('/students/all', { data: { date } });

// Time Slots
export const getTimeSlots = () => api.get('/timeslots');

// Rooms
export const getRooms = () => api.get('/rooms');

// Assignments
export const getAssignments = (date) => api.get('/assignments', { params: { date } });
export const getAssignmentsByDateRange = (startDate, daysCount) => api.get('/assignments/date-range', { params: { startDate, daysCount } });
export const getAssignmentsByStudentId = (studentId) => api.get(`/assignments/student/${studentId}`);
export const createAssignment = (data) => api.post('/assignments', data);
export const updateAssignment = (id, data) => api.put(`/assignments/${id}`, data);
export const deleteAssignment = (id) => api.delete(`/assignments/${id}`);
export const deleteAllAssignments = (date) => api.delete('/assignments/all', { data: { date } });
export const validateAssignment = (data) => api.post('/assignments/validate', data);
export const copyDay = (data) => api.post('/assignments/copy-day', data);
export const copyWeek = (data) => api.post('/assignments/copy-week', data);

// Notion
export const previewTeachersFromNotion = (date) => api.get('/notion/preview-teachers', { params: { date } });
export const previewStudentsFromNotion = (date) => api.get('/notion/preview-students', { params: { date } });
export const importTeachersFromNotion = (data) => api.post('/notion/import-teachers', data);
export const importStudentsFromNotion = (data) => api.post('/notion/import-students', data);
export const getAllNotionStudents = () => api.get('/notion/students');
export const getNotionStudentById = (notionId) => api.get(`/notion/students/${notionId}`);
export const updateNotionStudent = (notionId, field, value) => api.patch(`/notion/students/${notionId}`, { field, value });

// Backups
export const getBackups = () => api.get('/backups');
export const createBackup = (description) => api.post('/backups/create', { description });
export const syncBackups = () => api.post('/backups/sync');
export const previewBackup = (filename) => api.get(`/backups/${filename}/preview`);
export const restoreBackup = (filename, options) => api.post(`/backups/${filename}/restore`, options);
export const downloadBackup = (filename) => api.get(`/backups/${filename}/download`, { responseType: 'blob' });
export const deleteBackup = (filename) => api.delete(`/backups/${filename}`);

// Weekly Scheduling
export const getWeeklyData = (date) => api.get('/weekly/data', { params: { date } });
export const getWeeklyStudents = (date) => api.get('/weekly/students', { params: { date } });
export const copyDaySchedule = (fromDate, toDate, options) => api.post('/weekly/copy-day', { 
  fromDate, 
  toDate, 
  ...options 
});

// Student Change History
export const getStudentChangeHistory = (studentId) => api.get(`/student-change-history/student/${studentId}`);
export const getRecentChanges = (limit = 50) => api.get('/student-change-history/recent', { params: { limit } });
export const createChangeHistory = (data) => api.post('/student-change-history', data);
export const updateChangeHistory = (id, data) => api.put(`/student-change-history/${id}`, data);
export const deleteChangeHistory = (id) => api.delete(`/student-change-history/${id}`);

// AI Chat
export const sendChatMessage = (message, conversationHistory = []) =>
  api.post('/chat', { message, conversationHistory });

export default api;
