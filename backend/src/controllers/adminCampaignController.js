import {
  createCampaign,
  updateCampaign,
  deactivateCampaign,
  getCampaignById,
  getCampaignStats,
  listAllCampaigns
} from '../services/campaignService.js';

export async function adminListCampaigns(req, res) {
  try {
    const campaigns = await listAllCampaigns();
    res.json({ success: true, data: campaigns });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function adminGetCampaign(req, res) {
  try {
    const campaign = await getCampaignById(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export async function adminCreateCampaign(req, res) {
  try {
    const {
      type, title, description, url, thumbnail,
      rewardPoints, startDate, endDate, maxCompletions, status
    } = req.body;

    if (!type || !title || rewardPoints === undefined) {
      return res.status(400).json({
        success: false,
        error: 'type, title, and rewardPoints are required'
      });
    }

    const campaign = await createCampaign({
      type,
      title,
      description,
      url,
      thumbnail,
      rewardPoints,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : null,
      maxCompletions,
      status: status || 'ACTIVE'
    });

    res.status(201).json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function adminUpdateCampaign(req, res) {
  try {
    const campaign = await updateCampaign(req.params.id, req.body);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function adminDeleteCampaign(req, res) {
  try {
    const campaign = await deactivateCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    res.json({ success: true, data: campaign, message: 'Campaign deactivated' });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
}

export async function adminCampaignStats(req, res) {
  try {
    const stats = await getCampaignStats(req.params.id);
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
}
