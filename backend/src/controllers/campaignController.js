import {
  listActiveCampaigns,
  completeCampaign
} from '../services/campaignService.js';

export async function listCampaigns(req, res) {
  try {
    const campaigns = await listActiveCampaigns();
    res.json({ success: true, data: campaigns });
  } catch (error) {
    console.error('listCampaigns error:', error);
    res.status(500).json({ success: false, error: 'Failed to list campaigns' });
  }
}

export async function completeCampaignHandler(req, res) {
  try {
    const { id } = req.params;
    const result = await completeCampaign(req.telegramId, id);
    res.json({
      success: true,
      duplicate: result.duplicate,
      reward: result.reward,
      points: result.points ?? undefined
    });
  } catch (error) {
    console.error('completeCampaign error:', error);
    res.status(400).json({ success: false, error: error.message });
  }
}
