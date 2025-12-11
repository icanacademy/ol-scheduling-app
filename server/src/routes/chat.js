import express from 'express';
import { chat } from '../controllers/chatController.js';

const router = express.Router();

// POST /api/chat - Send a message to the AI assistant
router.post('/', chat);

export default router;
