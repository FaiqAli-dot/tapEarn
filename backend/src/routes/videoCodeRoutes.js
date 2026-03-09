import express from 'express';
import {
  getVideoCode,
  getAllVideoCodes,
  createOrUpdateVideoCode,
  deleteVideoCode,
  verifyVideoCode
} from '../controllers/videoCodeController.js';

const router = express.Router();

// Verify video code (must come before :taskId routes)
router.post('/verify', verifyVideoCode);

// Get all video codes (admin)
router.get('/', getAllVideoCodes);

// Get video code by task ID
router.get('/:taskId', getVideoCode);

// Create or update video code (admin)
router.post('/:taskId', createOrUpdateVideoCode);

// Delete video code (admin)
router.delete('/:taskId', deleteVideoCode);

export default router;
