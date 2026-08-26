import express from 'express';
import {
  authenticateWithTelegram,
  authenticateDev,
  getAuthMe
} from '../controllers/authController.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.post('/telegram', authenticateWithTelegram);
router.post('/dev', authenticateDev);
router.get('/me', requireAuth, getAuthMe);

export default router;
