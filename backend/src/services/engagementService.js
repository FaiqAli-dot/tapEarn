import User from '../models/User.js';
import { getUserRank } from './leaderboardService.js';
import { buildXpSummary } from './xpService.js';
import {
  getQuestStatus,
  ensureDailyQuests,
  awardDailyCheckin,
  claimQuest,
  claimAllPrimaryBonus
} from './questService.js';
import { buildStreakSummary } from './streakService.js';
import { buildMilestoneSummary } from './milestoneService.js';

export async function ensureEngagementState(userId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) throw new Error('User not found');

  ensureDailyQuests(user);
  await user.save();
  await awardDailyCheckin(userId);

  return user;
}

export async function getEngagementData(userId) {
  const user = await ensureEngagementState(userId);
  const refreshed = await User.findOne({ telegramId: userId });

  const questStatus = getQuestStatus(refreshed);
  const xp = buildXpSummary(refreshed);
  const streak = buildStreakSummary(refreshed);
  const milestones = buildMilestoneSummary(refreshed);
  const myRank = await getUserRank(userId, 'points');

  return {
    quests: questStatus,
    xp,
    streak,
    milestones,
    leaderboard: {
      rank: myRank?.rank ?? null,
      score: myRank?.score ?? refreshed.points
    }
  };
}

export { claimQuest, claimAllPrimaryBonus };
