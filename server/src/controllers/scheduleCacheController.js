import ScheduleCache from '../models/ScheduleCache.js';

export const refreshCache = async (req, res) => {
  try {
    const result = await ScheduleCache.refresh();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh schedule cache', message: error.message });
  }
};

export const getCachedStudents = async (req, res) => {
  try {
    const students = await ScheduleCache.getAll();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cached students', message: error.message });
  }
};

export const getCacheStatus = async (req, res) => {
  try {
    const lastRefresh = await ScheduleCache.getLastRefresh();
    res.json({ last_refresh: lastRefresh, stale: !lastRefresh });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cache status', message: error.message });
  }
};

export const getSubjects = async (req, res) => {
  try {
    const subjects = await ScheduleCache.getAllSubjects();
    res.json(subjects);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get subjects', message: error.message });
  }
};
