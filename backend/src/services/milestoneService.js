import User from '../models/User.js';
import { awardPoints } from './pointsService.js';

export const LIFETIME_MILESTONES = [
  { threshold: 1000, reward: 100 },
  { threshold: 10000, reward: 500 },
  { threshold: 50000, reward: 1000 },
  { threshold: 100000, reward: 2500 },
  { threshold: 250000, reward: 5000 },
  { threshold: 500000, reward: 10000 },
  { threshold: 1000000, reward: 25000 },
  { threshold: 5000000, reward: 50000 },
  { threshold: 10000000, reward: 100000 }
];

export function getNextLifetimeMilestone(totalPointsEarned) {
  return LIFETIME_MILESTONES.find((m) => totalPointsEarned < m.threshold) || null;
}

export function getLifetimeMilestoneProgress(totalPointsEarned) {
  const claimed = totalPointsEarned;
  const next = getNextLifetimeMilestone(totalPointsEarned);
  if (!next) {
    const last = LIFETIME_MILESTONES[LIFETIME_MILESTONES.length - 1];
    return {
      next: null,
      current: totalPointsEarned,
      threshold: last.threshold,
      percent: 100,
      reward: 0
    };
  }

  const prevThreshold =
    LIFETIME_MILESTONES.filter((m) => m.threshold < next.threshold).pop()?.threshold || 0;
  const span = next.threshold - prevThreshold;
  const progress = totalPointsEarned - prevThreshold;

  return {
    next: next.threshold,
    current: totalPointsEarned,
    threshold: next.threshold,
    reward: next.reward,
    percent: span > 0 ? Math.min(100, Math.floor((progress / span) * 100)) : 0
  };
}

/**
 * Check and award any newly reached lifetime milestones (race-safe via referenceId).
 */
export async function checkLifetimeMilestones(userId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) return [];

  const claimed = new Set(user.lifetimeMilestonesClaimed || []);
  const newMilestones = [];

  for (const milestone of LIFETIME_MILESTONES) {
    if (user.totalPointsEarned < milestone.threshold) continue;
    if (claimed.has(milestone.threshold)) continue;

    const result = await awardPoints(userId, milestone.reward, 'LIFETIME_MILESTONE', {
      referenceId: `lifetime-${milestone.threshold}`,
      description: `Lifetime milestone: ${milestone.threshold.toLocaleString()} YP earned`
    });

    if (!result.duplicate) {
      user.lifetimeMilestonesClaimed = [
        ...(user.lifetimeMilestonesClaimed || []),
        milestone.threshold
      ];
      await user.save();
      newMilestones.push({
        threshold: milestone.threshold,
        reward: milestone.reward
      });
    }
  }

  return newMilestones;
}

export function buildMilestoneSummary(user) {
  const progress = getLifetimeMilestoneProgress(user.totalPointsEarned || 0);
  return {
    totalPointsEarned: user.totalPointsEarned || 0,
    claimed: user.lifetimeMilestonesClaimed || [],
    progress,
    milestones: LIFETIME_MILESTONES
  };
}
