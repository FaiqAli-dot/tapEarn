import User from '../models/User.js';
import { getUtcDateString } from '../utils/dateUtils.js';
import { awardPoints } from './pointsService.js';
import { awardXp } from './xpService.js';
import { recordStreakActivity } from './streakService.js';
import { generateDailyQuests as buildDailyQuests, ALL_PRIMARY_BONUS } from '../constants/quests.js';

export const QUEST_TYPES = [
  'CLICK_COUNT',
  'CAMPAIGN_COMPLETION',
  'POINT_EARNINGS',
  'REFERRAL_SUCCESS',
  'DAILY_ACTIVITY'
];

const QUEST_DEFS = buildDailyQuests().map((q) => ({
  id: q.id,
  difficulty: q.difficulty,
  isPrimary: q.isPrimary,
  questType: q.questType,
  requiredAmount: q.requiredAmount,
  title: q.title,
  description: q.description,
  ypReward: q.ypReward,
  xpReward: q.xpReward
}));

function defaultDailyStats() {
  return {
    date: getUtcDateString(),
    taps: 0,
    pointsEarned: 0,
    campaignsCompleted: 0,
    referralsToday: 0,
    dailyCheckinAwarded: false
  };
}

export function ensureDailyStats(user) {
  const today = getUtcDateString();
  if (!user.dailyStats || user.dailyStats.date !== today) {
    user.dailyStats = defaultDailyStats();
  }
  return user.dailyStats;
}

export { buildDailyQuests as generateDailyQuests };

export function isLegacyDailyTasks(tasks) {
  if (!tasks?.length) return true;
  return tasks.some((t) => ['login', 'youtube', 'streak'].includes(t.type) && !t.questType);
}

export function ensureDailyQuests(user) {
  const today = getUtcDateString();
  const lastReset = user.lastDailyReset ? getUtcDateString(new Date(user.lastDailyReset)) : null;

  if (lastReset !== today || isLegacyDailyTasks(user.dailyTasks)) {
    user.dailyTasks = buildDailyQuests();
    user.lastDailyReset = new Date();
    user.dailyStats = defaultDailyStats();
    user.primaryQuestBonusClaimed = false;
  } else {
    ensureDailyStats(user);
  }

  return user.dailyTasks;
}

function getProgressForQuest(quest, stats) {
  switch (quest.questType) {
    case 'CLICK_COUNT':
      return stats.taps;
    case 'CAMPAIGN_COMPLETION':
      return stats.campaignsCompleted;
    case 'POINT_EARNINGS':
      return stats.pointsEarned;
    case 'REFERRAL_SUCCESS':
      return stats.referralsToday;
    case 'DAILY_ACTIVITY':
      return stats.taps >= 25 || stats.pointsEarned >= 100 || stats.campaignsCompleted >= 1
        ? 1
        : 0;
    default:
      return quest.currentProgress || 0;
  }
}

export function syncQuestProgress(user) {
  const stats = ensureDailyStats(user);
  const quests = ensureDailyQuests(user);

  for (const quest of quests) {
    if (quest.completed) continue;
    quest.currentProgress = Math.min(
      getProgressForQuest(quest, stats),
      quest.requiredAmount
    );
  }

  return quests;
}

export function getQuestStatus(user) {
  const quests = syncQuestProgress(user);
  const primary = quests.filter((q) => q.isPrimary);
  const primaryCompleted = primary.filter((q) => q.completed).length;
  const primaryReady = primary.filter(
    (q) => !q.completed && q.currentProgress >= q.requiredAmount
  ).length;
  const allPrimaryComplete = primary.every((q) => q.completed);
  const canClaimAllPrimaryBonus =
    allPrimaryComplete && !user.primaryQuestBonusClaimed;

  return {
    quests: quests.map(formatQuestForClient),
    primaryCompleted,
    primaryTotal: primary.length,
    primaryReady,
    allPrimaryComplete,
    canClaimAllPrimaryBonus,
    allPrimaryBonus: ALL_PRIMARY_BONUS
  };
}

function formatQuestForClient(quest) {
  const readyToClaim = !quest.completed && quest.currentProgress >= quest.requiredAmount;
  return {
    id: quest.id,
    title: quest.title,
    description: quest.description,
    questType: quest.questType,
    difficulty: quest.difficulty,
    isPrimary: quest.isPrimary,
    requiredAmount: quest.requiredAmount,
    currentProgress: quest.currentProgress,
    ypReward: quest.ypReward,
    xpReward: quest.xpReward,
    points: quest.ypReward,
    completed: quest.completed,
    readyToClaim,
    completedAt: quest.completedAt,
    type: quest.type || 'custom'
  };
}

export async function awardDailyCheckin(userId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) return null;

  const stats = ensureDailyStats(user);
  if (stats.dailyCheckinAwarded) {
    await user.save();
    return { duplicate: true };
  }

  stats.dailyCheckinAwarded = true;
  await user.save();

  return awardXp(userId, 10, 'DAILY_CHECKIN', {
    referenceId: stats.date,
    description: 'Daily check-in'
  });
}

export async function onTaps(userId, tapCount) {
  const user = await User.findOne({ telegramId: userId });
  if (!user || tapCount <= 0) return null;

  const stats = ensureDailyStats(user);
  stats.taps += tapCount;
  syncQuestProgress(user);
  await user.save();

  if (stats.taps >= 25) {
    await recordStreakActivity(userId, 'taps');
  }

  return getQuestStatus(user);
}

export async function onPointsEarned(userId, amount) {
  const user = await User.findOne({ telegramId: userId });
  if (!user || amount <= 0) return null;

  const stats = ensureDailyStats(user);
  stats.pointsEarned += amount;
  syncQuestProgress(user);
  await user.save();

  if (stats.pointsEarned >= 100) {
    await recordStreakActivity(userId, 'points');
  }

  return getQuestStatus(user);
}

export async function onCampaignCompleted(userId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) return null;

  const stats = ensureDailyStats(user);
  stats.campaignsCompleted += 1;
  syncQuestProgress(user);
  await user.save();

  await recordStreakActivity(userId, 'campaign');
  return getQuestStatus(user);
}

export async function onReferralSuccess(referrerId) {
  const user = await User.findOne({ telegramId: referrerId });
  if (!user) return null;

  const stats = ensureDailyStats(user);
  stats.referralsToday += 1;
  syncQuestProgress(user);
  await user.save();

  return getQuestStatus(user);
}

export async function claimQuest(userId, questId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) throw new Error('User not found');

  const today = getUtcDateString();
  syncQuestProgress(user);

  const quest = user.dailyTasks.find((q) => q.id === questId);
  if (!quest) throw new Error('Quest not found');
  if (quest.completed) throw new Error('Quest already claimed');

  if (quest.currentProgress < quest.requiredAmount) {
    throw new Error('Quest requirements not met');
  }

  quest.completed = true;
  quest.completedAt = new Date();
  await user.save();

  const ypResult = await awardPoints(userId, quest.ypReward, 'QUEST_REWARD', {
    referenceId: `quest-${questId}-${today}`,
    description: `Daily quest: ${quest.title}`
  });

  const xpResult = await awardXp(userId, quest.xpReward, 'QUEST', {
    referenceId: `quest-${questId}-${today}`,
    description: `Daily quest XP: ${quest.title}`
  });

  await recordStreakActivity(userId, 'quest');

  const refreshed = await User.findOne({ telegramId: userId });
  syncQuestProgress(refreshed);

  let allPrimaryBonus = null;
  const primary = refreshed.dailyTasks.filter((q) => q.isPrimary);
  if (primary.every((q) => q.completed) && !refreshed.primaryQuestBonusClaimed) {
    allPrimaryBonus = await claimAllPrimaryBonus(userId);
  }

  await refreshed.save();

  return {
    quest: formatQuestForClient(quest),
    points: ypResult.points,
    xp: xpResult.xp,
    level: xpResult.level,
    levelUp: xpResult.levelUp,
    allPrimaryBonus,
    dailyTasks: refreshed.dailyTasks.map(formatQuestForClient)
  };
}

export async function claimAllPrimaryBonus(userId) {
  const user = await User.findOne({ telegramId: userId });
  if (!user) throw new Error('User not found');

  const today = getUtcDateString();
  syncQuestProgress(user);

  const primary = user.dailyTasks.filter((q) => q.isPrimary);
  if (!primary.every((q) => q.completed)) {
    throw new Error('Complete all primary quests first');
  }
  if (user.primaryQuestBonusClaimed) {
    return { duplicate: true };
  }

  user.primaryQuestBonusClaimed = true;
  await user.save();

  const ypResult = await awardPoints(userId, ALL_PRIMARY_BONUS.ypReward, 'QUEST_BONUS', {
    referenceId: `all-primary-${today}`,
    description: 'All primary daily quests bonus'
  });

  const xpResult = await awardXp(userId, ALL_PRIMARY_BONUS.xpReward, 'QUEST_BONUS', {
    referenceId: `all-primary-${today}`,
    description: 'All primary daily quests XP bonus'
  });

  return {
    ypReward: ALL_PRIMARY_BONUS.ypReward,
    xpReward: ALL_PRIMARY_BONUS.xpReward,
    points: ypResult.points,
    xp: xpResult.xp,
    duplicate: ypResult.duplicate && xpResult.duplicate
  };
}

/** Backward-compatible alias for complete-task endpoint. */
export async function completeDailyTask(userId, taskId) {
  return claimQuest(userId, taskId);
}
