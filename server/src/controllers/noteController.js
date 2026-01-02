import Note from '../models/Note.js';

// Get all notes
export const getAllNotes = async (req, res) => {
  try {
    const { status } = req.query;
    const notes = await Note.getAll(status);
    res.json(notes);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notes', message: error.message });
  }
};

// Get note by ID
export const getNoteById = async (req, res) => {
  try {
    const note = await Note.getById(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch note', message: error.message });
  }
};

// Create note
export const createNote = async (req, res) => {
  try {
    const note = await Note.create(req.body);
    res.status(201).json(note);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create note', message: error.message });
  }
};

// Update note
export const updateNote = async (req, res) => {
  try {
    const note = await Note.update(req.params.id, req.body);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(400).json({ error: 'Failed to update note', message: error.message });
  }
};

// Toggle note status
export const toggleNoteStatus = async (req, res) => {
  try {
    const note = await Note.toggleStatus(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json(note);
  } catch (error) {
    res.status(400).json({ error: 'Failed to toggle note status', message: error.message });
  }
};

// Delete note
export const deleteNote = async (req, res) => {
  try {
    const note = await Note.delete(req.params.id);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    res.json({ message: 'Note deleted successfully', note });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete note', message: error.message });
  }
};

// Get note counts
export const getNoteCounts = async (req, res) => {
  try {
    const counts = await Note.getCounts();
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch note counts', message: error.message });
  }
};
