import express from 'express';
import {
  getAllNotes,
  getNoteById,
  createNote,
  updateNote,
  toggleNoteStatus,
  deleteNote,
  getNoteCounts
} from '../controllers/noteController.js';

const router = express.Router();

// GET /api/notes - Get all notes (optional ?status=open|completed)
router.get('/', getAllNotes);

// GET /api/notes/counts - Get note counts by status
router.get('/counts', getNoteCounts);

// GET /api/notes/:id - Get single note
router.get('/:id', getNoteById);

// POST /api/notes - Create note
router.post('/', createNote);

// PUT /api/notes/:id - Update note
router.put('/:id', updateNote);

// PATCH /api/notes/:id/toggle - Toggle status
router.patch('/:id/toggle', toggleNoteStatus);

// DELETE /api/notes/:id - Delete note
router.delete('/:id', deleteNote);

export default router;
