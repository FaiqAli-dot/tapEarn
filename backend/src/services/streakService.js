import User from '../models/User.js';
import { awardPoints } from './pointsService.js';
import {
  getUtcDateString,
  isConsecutiveUtcDay,
  isSameUtcDay
} from '../utils/dateUtils.js';

export const STREAK_MILESTONES = [
  { days: 3, ypReward: 250 },
  { days: 7, ypReward: 1000, achievement: 'streak_7' },
  { days: 14, ypReward: 2500 },
  { days: 21, ypReward: 5000 },
  { days: 30, ypReward: 10000, achievement: 'streak_30' },
  { days: 60, ypReward: 25000 },
  { days: 100, ypReward: 50000, achievement: 'streak_100' }
];

/**
 * Record meaningful streak activity. Idempotent per UTC day.
 * Activities: quest claim, campaign, 100+ YP earned, 25+ taps.
 */
export async function recordStreakActivity(userId, activityType) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) return null;

  const today = getUtcDateString();

  if (isSameUtcDay(user.lastStreakActivityDate, today)) {
    return buildStreakSummary(user);
  }

  if (!user.lastStreakActivityDate) {
    user.currentStreak = 1;
  } else if (isConsecutiveUtcDay(user.lastStreakActivityDate, today)) {
    user.currentStreak = (user.currentStreak || 0) + 1;
  } else {
    user.currentStreak = 1;
  }

  user.lastStreakActivityDate = today;
  if ((user.currentStreak || 0) > (user.longestStreak || 0)) {
    user.longestStreak = user.currentStreak;
  }

  await user.save();

  const milestones = await checkStreakMilestones(userId);
  const refreshed = await User.findOne({ telegramId: userId });

  return {
    ...buildStreakSummary(refreshed),
    activityType,
    newMilestones: milestones
  };
}

export async function checkStreakMilestones(userId) {
  const newMilestones = [];

  for (const milestone of STREAK_MILESTONES) {
    const user = await User.findOne({ telegramId: userId });
    if (!user) return newMilestones;

    const claimed = new Set(user.streakMilestonesClaimed || []);
    if ((user.currentStreak || 0) < milestone.days) continue;
    if (claimed.has(milestone.days)) continue;

    const result = await awardPoints(userId, milestone.ypReward, 'STREAK_MILESTONE', {
      referenceId: `streak-${milestone.days}`,
      description: `${milestone.days}-day streak milestone`
    });

    if (!result.duplicate) {
      const update = { $addToSet: { streakMilestonesClaimed: milestone.days } };
      if (milestone.achievement) {
        update.$addToSet.achievements = milestone.achievement;
      }
      await User.findOneAndUpdate({ telegramId: userId }, update);
      newMilestones.push({
        days: milestone.days,
        ypReward: milestone.ypReward,
        achievement: milestone.achievement || null
      });
    }
  }

  return newMilestones;
}

export function buildStreakSummary(user) {
  return {
    currentStreak: user.currentStreak || 0,
    longestStreak: user.longestStreak || 0,
    lastStreakActivityDate: user.lastStreakActivityDate || null,
    streakMilestonesClaimed: user.streakMilestonesClaimed || [],
    achievements: user.achievements || [],
    nextMilestone: STREAK_MILESTONES.find(
      (m) => (user.currentStreak || 0) < m.days
    ) || null
  };
}
