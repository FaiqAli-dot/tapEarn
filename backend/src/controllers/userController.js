import User from '../models/User.js';
import { applyReferralOnSignup } from '../services/referralService.js';
import { processSingleTap, processTapBatch } from '../services/clickService.js';
import { getLeaderboardByType, getUserRank } from '../services/leaderboardService.js';
import {
  ensureDailyQuests,
  getQuestStatus,
  claimQuest,
  claimAllPrimaryBonus
} from '../services/questService.js';
import {
  getEngagementData,
  ensureEngagementState
} from '../services/engagementService.js';
import { buildXpSummary } from '../services/xpService.js';
import { buildStreakSummary } from '../services/streakService.js';
import { buildMilestoneSummary } from '../services/milestoneService.js';
import { getUtcDateString } from '../utils/dateUtils.js';

const ALLOWED_PROFILE_FIELDS = ['username', 'firstName', 'lastName', 'walletAddress', 'walletConnected'];

const getOrCreateUser = async (telegramId, userData = {}) => {
  try {
    let user = await User.findOne({ telegramId });

    if (!user) {
      user = new User({
        telegramId,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name
      });

      await user.save();

      if (userData.start) {
        await applyReferralOnSignup(user, userData.start);
        await user.save();
      }
    } else {
      const today = getUtcDateString();
      const lastReset = user.lastDailyReset
        ? getUtcDateString(new Date(user.lastDailyReset))
        : null;

      if (lastReset !== today) {
        user.resetDailyTasks();
        await user.save();
      }

      ensureDailyQuests(user);
      await user.save();
    }

    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
};

const getUser = async (telegramId) => {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');
  return user;
};

const updateUser = async (telegramId, updateData) => {
  const safeUpdate = {};
  for (const key of ALLOWED_PROFILE_FIELDS) {
    if (updateData[key] !== undefined) {
      safeUpdate[key] = updateData[key];
    }
  }

  const user = await User.findOneAndUpdate(
    { telegramId },
    { $set: safeUpdate },
    { new: true }
  );
  if (!user) throw new Error('User not found');
  return user;
};

const handleTap = async (telegramId) => processSingleTap(telegramId);

const syncTaps = async (telegramId, tapCount) => processTapBatch(telegramId, tapCount);

const completeDailyTask = async (telegramId, taskId) => {
  const result = await claimQuest(telegramId, taskId);
  return {
    success: true,
    points: result.points,
    xp: result.xp,
    level: result.level,
    levelUp: result.levelUp,
    allPrimaryBonus: result.allPrimaryBonus,
    dailyTasks: result.dailyTasks,
    message: 'Quest claimed successfully'
  };
};

const UPGRADE_COSTS = {
  tap_power: 100,
  offline_earning: 200,
  energy_regen: 150
};

const purchaseUpgrade = async (telegramId, upgradeId) => {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  const cost = UPGRADE_COSTS[upgradeId];
  if (!cost) throw new Error('Invalid upgrade');

  const success = user.purchaseUpgrade(upgradeId, cost);
  if (!success) throw new Error('Insufficient points or invalid upgrade');

  await user.save();

  return {
    success: true,
    points: user.points,
    tapPower: user.tapPower,
    offlineEarningRate: user.offlineEarningRate,
    energyRegenRate: user.energyRegenRate,
    message: 'Upgrade purchased successfully'
  };
};

const getUserGameState = async (telegramId) => {
  await ensureEngagementState(telegramId);
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  const currentEnergy = user.calculateCurrentEnergy();
  const questStatus = getQuestStatus(user);
  const xp = buildXpSummary(user);
  const streak = buildStreakSummary(user);
  const milestones = buildMilestoneSummary(user);
  const myRank = await getUserRank(telegramId, 'points');

  return {
    points: user.points,
    energy: currentEnergy,
    maxEnergy: user.maxEnergy,
    energyRegenRate: user.energyRegenRate,
    tapPower: user.tapPower,
    offlineEarningRate: user.offlineEarningRate,
    offlineEarningMaxHours: user.offlineEarningMaxHours,
    totalTaps: user.totalTaps,
    totalPointsEarned: user.totalPointsEarned,
    offlineEarnings: user.offlineEarnings,
    referralEarnings: user.referralEarnings,
    lastActive: user.lastActive,
    dailyTasks: questStatus.quests,
    lastDailyReset: user.lastDailyReset,
    referralCode: user.referralCode,
    referralCount: user.referrals.length,
    walletConnected: user.walletConnected,
    walletAddress: user.walletAddress,
    walletVerified: user.walletVerified,
    walletVerifiedAt: user.walletVerifiedAt,
    engagement: {
      quests: questStatus,
      xp,
      streak,
      milestones,
      leaderboard: {
        rank: myRank?.rank ?? null,
        score: myRank?.score ?? user.points
      }
    }
  };
};

const ALLOWED_GAME_STATE_FIELDS = ['walletConnected', 'walletAddress'];

const updateUserGameState = async (telegramId, gameState) => {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  if (
    gameState.points !== undefined ||
    gameState.totalTaps !== undefined ||
    gameState.xp !== undefined ||
    gameState.level !== undefined
  ) {
    throw new Error('Economy fields are server-authoritative');
  }

  for (const key of ALLOWED_GAME_STATE_FIELDS) {
    if (gameState[key] !== undefined) {
      if (key === 'walletAddress' && gameState.walletAddress !== user.walletAddress) {
        user.walletVerified = false;
        user.walletVerifiedAt = null;
      }
      user[key] = gameState[key];
    }
  }

  await user.save();

  return {
    success: true,
    message: 'Game state updated successfully (economy fields are server-authoritative)'
  };
};

const getAvailableUpgrades = async (telegramId) => {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');
  return user.getAvailableUpgrades();
};

const resetDailyTasks = async (telegramId) => {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');
  user.resetDailyTasks();
  await user.save();
  const questStatus = getQuestStatus(user);
  return {
    success: true,
    dailyTasks: questStatus.quests,
    message: 'Daily quests reset successfully'
  };
};

const getLeaderboard = async (type = 'points', limit = 10) =>
  getLeaderboardByType(type, limit);

const getEngagement = async (telegramId) => getEngagementData(telegramId);

const completeQuest = async (telegramId, questId) => {
  const result = await claimQuest(telegramId, questId);
  return { success: true, ...result };
};

const claimQuestBonus = async (telegramId) => {
  const result = await claimAllPrimaryBonus(telegramId);
  return { success: true, ...result };
};

export {
  getOrCreateUser,
  getUser,
  updateUser,
  handleTap,
  completeDailyTask,
  purchaseUpgrade,
  getUserGameState,
  updateUserGameState,
  getAvailableUpgrades,
  resetDailyTasks,
  getLeaderboard,
  getUserRank,
  syncTaps,
  getEngagement,
  completeQuest,
  claimQuestBonus
};
