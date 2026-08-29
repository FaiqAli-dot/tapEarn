import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { listCampaigns, completeCampaignHandler } from '../controllers/campaignController.js';

const router = express.Router();

router.use(requireAuth);

router.get('/', listCampaigns);
router.post('/:id/complete', completeCampaignHandler);

export default router;
