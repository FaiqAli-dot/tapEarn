import User from '../models/User.js';
import { applyReferralOnSignup } from '../services/referralService.js';
import { processSingleTap, processTapBatch } from '../services/clickService.js';
import { awardPoints } from '../services/pointsService.js';
import { getLeaderboardByType, getUserRank } from '../services/leaderboardService.js';

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
      const now = new Date();
      const lastReset = user.lastDailyReset ? new Date(user.lastDailyReset) : new Date(0);
      const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));

      if (daysSinceReset >= 1) {
        user.resetDailyTasks();
        await user.save();
      }

      if (!user.dailyTasks || user.dailyTasks.length === 0) {
        user.dailyTasks = [
          {
            id: 'daily_login',
            title: 'Daily Login',
            description: 'Log in to earn bonus points',
            points: 50,
            completed: false,
            type: 'login'
          },
          {
            id: 'watch video naa',
            title: 'Watch Video',
            description: 'Watch our featured video',
            points: 150,
            completed: false,
            type: 'youtube',
            url: 'https://www.youtube.com/watch?v=pmog2cABaJk&t=2595s&ab_channel=JamalRoomi'
          },
          {
            id: 'streak_bonus',
            title: '7-Day Streak',
            description: 'Maintain daily login for 7 days',
            points: 500,
            completed: false,
            type: 'streak'
          }
        ];
        await user.save();
      }

      // Referrer is permanent — ignore referral code on re-auth for existing users
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
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  const task = user.dailyTasks.find((t) => t.id === taskId);
  if (!task) throw new Error('Task not found or already completed');
  if (task.completed) throw new Error('Task not found or already completed');

  task.completed = true;
  task.completedAt = new Date();
  await user.save();

  const pointType = task.type === 'streak' ? 'DAILY_STREAK' : 'VIDEO';
  const result = await awardPoints(telegramId, task.points, pointType, {
    referenceId: `daily-${taskId}-${user.lastDailyReset?.toISOString?.() || 'current'}`,
    description: `Daily task: ${task.title}`
  });

  return {
    success: true,
    points: result.points,
    dailyTasks: user.dailyTasks,
    message: 'Task completed successfully'
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
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  const now = new Date();
  const lastReset = user.lastDailyReset ? new Date(user.lastDailyReset) : new Date(0);
  const daysSinceReset = Math.floor((now - lastReset) / (1000 * 60 * 60 * 24));

  if (daysSinceReset >= 1) {
    user.resetDailyTasks();
    await user.save();
  }

  const currentEnergy = user.calculateCurrentEnergy();

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
    dailyTasks: user.dailyTasks,
    lastDailyReset: user.lastDailyReset,
    referralCode: user.referralCode,
    referralCount: user.referrals.length,
    walletConnected: user.walletConnected,
    walletAddress: user.walletAddress
  };
};

const ALLOWED_GAME_STATE_FIELDS = ['walletConnected', 'walletAddress'];

const updateUserGameState = async (telegramId, gameState) => {
  const user = await User.findOne({ telegramId });
  if (!user) throw new Error('User not found');

  for (const key of ALLOWED_GAME_STATE_FIELDS) {
    if (gameState[key] !== undefined) {
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
  return {
    success: true,
    dailyTasks: user.dailyTasks,
    message: 'Daily tasks reset successfully'
  };
};

const getLeaderboard = async (type = 'points', limit = 10) =>
  getLeaderboardByType(type, limit);

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
  syncTaps
};
