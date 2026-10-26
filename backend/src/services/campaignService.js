import Campaign from '../models/Campaign.js';
import CampaignCompletion from '../models/CampaignCompletion.js';
import { awardPoints } from './pointsService.js';
import { awardXp } from './xpService.js';
import { onCampaignCompleted, onPointsEarned } from './questService.js';

function deriveStatus(campaign) {
  if (campaign.status === 'INACTIVE') return 'INACTIVE';
  const now = new Date();
  if (campaign.endDate && now > campaign.endDate) return 'EXPIRED';
  if (campaign.maxCompletions != null && campaign.completionCount >= campaign.maxCompletions) {
    return 'EXPIRED';
  }
  if (campaign.startDate && now < campaign.startDate) return 'INACTIVE';
  return campaign.status;
}

export async function listActiveCampaigns() {
  const now = new Date();
  const campaigns = await Campaign.find({
    status: 'ACTIVE',
    startDate: { $lte: now },
    $or: [{ endDate: null }, { endDate: { $gte: now } }]
  }).sort({ createdAt: -1 });

  return campaigns.filter((c) => c.isCurrentlyActive());
}

export async function getCampaignById(campaignId) {
  return Campaign.findById(campaignId);
}

export async function createCampaign(data) {
  return Campaign.create(data);
}

export async function updateCampaign(campaignId, data) {
  const allowed = [
    'type', 'title', 'description', 'url', 'thumbnail',
    'rewardPoints', 'startDate', 'endDate', 'maxCompletions', 'status'
  ];
  const update = {};
  for (const key of allowed) {
    if (data[key] !== undefined) update[key] = data[key];
  }
  return Campaign.findByIdAndUpdate(campaignId, { $set: update }, { new: true });
}

export async function deactivateCampaign(campaignId) {
  return Campaign.findByIdAndUpdate(
    campaignId,
    { $set: { status: 'INACTIVE' } },
    { new: true }
  );
}

export async function deleteCampaign(campaignId) {
  return Campaign.findByIdAndDelete(campaignId);
}

export async function getCampaignStats(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) throw new Error('Campaign not found');

  const completions = await CampaignCompletion.find({ campaignId });
  const totalReward = completions.reduce((sum, c) => sum + c.reward, 0);

  return {
    campaign,
    completionCount: completions.length,
    totalRewardDistributed: totalReward,
    status: deriveStatus(campaign)
  };
}

export async function completeCampaign(userId, campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) {
    throw new Error('Campaign not found');
  }

  if (!campaign.isCurrentlyActive()) {
    throw new Error('Campaign is not active');
  }

  const existing = await CampaignCompletion.findOne({ userId, campaignId });
  if (existing) {
    return { duplicate: true, completion: existing, reward: existing.reward };
  }

  const pointType = campaign.type === 'VIDEO' ? 'VIDEO' : 'SPONSORED_TASK';

  let completion;
  try {
    completion = await CampaignCompletion.create({
      userId,
      campaignId: campaign._id,
      campaignType: campaign.type,
      reward: campaign.rewardPoints
    });
  } catch (error) {
    if (error.code === 11000) {
      const dup = await CampaignCompletion.findOne({ userId, campaignId });
      return { duplicate: true, completion: dup, reward: dup.reward };
    }
    throw error;
  }

  await Campaign.findByIdAndUpdate(campaignId, { $inc: { completionCount: 1 } });

  const pointsResult = await awardPoints(userId, campaign.rewardPoints, pointType, {
    referenceId: String(campaign._id),
    description: `Campaign: ${campaign.title}`
  });

  const campaignXp = campaign.rewardPoints >= 500 ? 100 : 50;
  await awardXp(userId, campaignXp, 'CAMPAIGN', {
    referenceId: String(campaign._id),
    description: `Campaign XP: ${campaign.title}`
  });

  await onCampaignCompleted(userId);
  await onPointsEarned(userId, campaign.rewardPoints);

  return {
    duplicate: false,
    completion,
    reward: campaign.rewardPoints,
    points: pointsResult.points
  };
}

export async function listAllCampaigns() {
  return Campaign.find({}).sort({ createdAt: -1 });
}
