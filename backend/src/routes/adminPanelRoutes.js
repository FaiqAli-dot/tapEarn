import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdminPanel } from '../middleware/adminAuth.js';
import {
  adminPanelLogin,
  adminPanelChangeCredentials,
  adminPanelMe
} from '../controllers/adminPanelController.js';

const router = express.Router();

router.post('/login', adminPanelLogin);

router.get('/me', requireAuth, requireAdminPanel, adminPanelMe);
router.post('/credentials', requireAuth, requireAdminPanel, adminPanelChangeCredentials);

export default router;
