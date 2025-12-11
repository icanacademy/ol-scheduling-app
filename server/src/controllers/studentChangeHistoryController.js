import StudentChangeHistory from '../models/StudentChangeHistory.js';

export const createChangeHistory = async (req, res) => {
  try {
    const changeHistory = await StudentChangeHistory.create(req.body);
    res.status(201).json(changeHistory);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create change history', message: error.message });
  }
};

export const getStudentChangeHistory = async (req, res) => {
  try {
    const { studentId } = req.params;
    const changeHistory = await StudentChangeHistory.getByStudentId(studentId);
    res.json(changeHistory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch change history', message: error.message });
  }
};

export const getChangeHistoryByDateRange = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }
    
    const changeHistory = await StudentChangeHistory.getByDateRange(studentId, startDate, endDate);
    res.json(changeHistory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch change history', message: error.message });
  }
};

export const getChangeHistoryByType = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { changeType } = req.query;
    
    if (!changeType) {
      return res.status(400).json({ error: 'changeType is required' });
    }
    
    const changeHistory = await StudentChangeHistory.getByChangeType(studentId, changeType);
    res.json(changeHistory);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch change history', message: error.message });
  }
};

export const getRecentChanges = async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const recentChanges = await StudentChangeHistory.getRecentChanges(parseInt(limit));
    res.json(recentChanges);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch recent changes', message: error.message });
  }
};

export const updateChangeHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const changeHistory = await StudentChangeHistory.update(id, req.body);
    
    if (!changeHistory) {
      return res.status(404).json({ error: 'Change history not found' });
    }
    
    res.json(changeHistory);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update change history', message: error.message });
  }
};

export const deleteChangeHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const changeHistory = await StudentChangeHistory.delete(id);
    
    if (!changeHistory) {
      return res.status(404).json({ error: 'Change history not found' });
    }
    
    res.json({ message: 'Change history deleted successfully', changeHistory });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete change history', message: error.message });
  }
};