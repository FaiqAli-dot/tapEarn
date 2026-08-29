import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/adminAuth.js';
import {
  adminListCampaigns,
  adminGetCampaign,
  adminCreateCampaign,
  adminUpdateCampaign,
  adminDeleteCampaign,
  adminCampaignStats
} from '../controllers/adminCampaignController.js';

const router = express.Router();

router.use(requireAuth);
router.use(requireAdmin);

router.get('/', adminListCampaigns);
router.post('/', adminCreateCampaign);
router.get('/:id/stats', adminCampaignStats);
router.get('/:id', adminGetCampaign);
router.patch('/:id', adminUpdateCampaign);
router.delete('/:id', adminDeleteCampaign);

export default router;
