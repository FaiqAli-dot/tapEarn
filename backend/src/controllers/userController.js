import User from '../models/User.js';

// Get or create user
const getOrCreateUser = async (telegramId, userData = {}) => {
  try {
    let user = await User.findOne({ telegramId });
    
    if (!user) {
      console.log(`👤 CREATING NEW USER: ${telegramId}`);
      // Create new user with provided data
      user = new User({
        telegramId,
        username: userData.username,
        firstName: userData.first_name,
        lastName: userData.last_name,
        // Check for referral code in start parameter
        ...(userData.start && { referredBy: userData.start })
      });
      await user.save();
      
      // If user was referred, update referrer's referrals
      if (user.referredBy) {
        await User.findOneAndUpdate(
          { referralCode: user.referredBy },
          { 
            $push: { 
              referrals: { 
                userId: user.telegramId,
                username: user.username || `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
              } 
            } 
          }
        );
      }
    } else {
      // Ensure daily tasks are initialized for existing users too
      if (!user.dailyTasks || user.dailyTasks.length === 0) {
        console.log(`🔄 INITIALIZING DAILY TASKS for existing user: ${telegramId}`);
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
            id: 'watch_youtube',
            title: 'Watch YouTube Video',
            description: 'Watch our featured video',
            points: 100,
            completed: false,
            type: 'youtube',
            url: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
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
      // Only log for new users or significant changes to reduce spam
      // console.log(`👤 FOUND EXISTING USER: ${telegramId} - Points: ${user.points}, Energy: ${user.energy}`);
    }
    
    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw error;
  }
};

// Get user by Telegram ID
const getUser = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    console.error('Error in getUser:', error);
    throw error;
  }
};

// Update user data
const updateUser = async (telegramId, updateData) => {
  try {
    const user = await User.findOneAndUpdate(
      { telegramId },
      { $set: updateData },
      { new: true }
    );
    if (!user) throw new Error('User not found');
    return user;
  } catch (error) {
    console.error('Error in updateUser:', error);
    throw error;
  }
};

// Handle tap action
const handleTap = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    // Check if user has enough energy
    if (!user.useEnergy()) {
      throw new Error('Not enough energy');
    }
    
    // Add points based on tap power
    const pointsEarned = user.tapPower;
    user.addPoints(pointsEarned);
    user.totalTaps += 1;
    
    await user.save();
    
    console.log(`🎯 TAP: User ${telegramId} - Points: ${user.points}, Energy: ${user.energy}, Total Taps: ${user.totalTaps}`);
    
    return {
      points: user.points,
      energy: user.energy,
      totalTaps: user.totalTaps,
      pointsEarned
    };
  } catch (error) {
    console.error('Error in handleTap:', error);
    throw error;
  }
};

// Complete daily task
const completeDailyTask = async (telegramId, taskId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    // Ensure daily tasks are initialized
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
          id: 'watch_youtube',
          title: 'Watch YouTube Video',
          description: 'Watch our featured video',
          points: 100,
          completed: false,
          type: 'youtube',
          url: 'https://youtube.com/watch?v=dQw4w9WgXcQ'
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
    }
    
    const success = user.completeDailyTask(taskId);
    if (!success) throw new Error('Task not found or already completed');
    
    await user.save();
    
    console.log(`✅ DAILY TASK: User ${telegramId} completed task ${taskId} - Points: ${user.points}`);
    
    return {
      success: true,
      points: user.points,
      dailyTasks: user.dailyTasks,
      message: 'Task completed successfully'
    };
  } catch (error) {
    console.error('Error in completeDailyTask:', error);
    throw error;
  }
};

// Purchase upgrade
const purchaseUpgrade = async (telegramId, upgradeId, cost) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    const success = user.purchaseUpgrade(upgradeId, cost);
    if (!success) throw new Error('Insufficient points or invalid upgrade');
    
    await user.save();
    
    console.log(`🆙 UPGRADE: User ${telegramId} purchased ${upgradeId} - Points: ${user.points}`);
    
    return {
      success: true,
      points: user.points,
      tapPower: user.tapPower,
      offlineEarningRate: user.offlineEarningRate,
      energyRegenRate: user.energyRegenRate,
      message: 'Upgrade purchased successfully'
    };
  } catch (error) {
    console.error('Error in purchaseUpgrade:', error);
    throw error;
  }
};

// Get user game state
const getUserGameState = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    // Calculate current energy
    const currentEnergy = user.calculateCurrentEnergy();
    
    // Only log significant changes to reduce spam
    // console.log(`📊 GAME STATE: User ${telegramId} - Points: ${user.points}, Energy: ${currentEnergy}, Total Taps: ${user.totalTaps}`);
    
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
  } catch (error) {
    console.error('Error in getUserGameState:', error);
    throw error;
  }
};

// Update user game state
const updateUserGameState = async (telegramId, gameState) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    // Update game state fields
    Object.assign(user, {
      points: gameState.points,
      energy: gameState.energy,
      tapPower: gameState.tapPower,
      offlineEarningRate: gameState.offlineEarningRate,
      offlineEarningMaxHours: gameState.offlineEarningMaxHours,
      totalTaps: gameState.totalTaps,
      totalPointsEarned: gameState.totalPointsEarned,
      offlineEarnings: gameState.offlineEarnings,
      referralEarnings: gameState.referralEarnings,
      lastActive: gameState.lastActive,
      dailyTasks: gameState.dailyTasks,
      lastDailyReset: gameState.lastDailyReset,
      walletConnected: gameState.walletConnected,
      walletAddress: gameState.walletAddress
    });
    
    await user.save();
    
    return {
      success: true,
      message: 'Game state updated successfully'
    };
  } catch (error) {
    console.error('Error in updateUserGameState:', error);
    throw error;
  }
};

// Get available upgrades
const getAvailableUpgrades = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    return user.getAvailableUpgrades();
  } catch (error) {
    console.error('Error in getAvailableUpgrades:', error);
    throw error;
  }
};

// Reset daily tasks
const resetDailyTasks = async (telegramId) => {
  try {
    const user = await User.findOne({ telegramId });
    if (!user) throw new Error('User not found');
    
    const tasks = user.resetDailyTasks();
    await user.save();
    
    console.log(`🔄 RESET: User ${telegramId} daily tasks reset`);
    
    return {
      success: true,
      dailyTasks: tasks,
      message: 'Daily tasks reset successfully'
    };
  } catch (error) {
    console.error('Error in resetDailyTasks:', error);
    throw error;
  }
};

// Get leaderboard
const getLeaderboard = async (limit = 10) => {
  try {
    return await User.find({})
      .sort({ points: -1 })
      .limit(limit)
      .select('username firstName lastName points -_id');
  } catch (error) {
    console.error('Error in getLeaderboard:', error);
    throw error;
  }
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
  getLeaderboard
};
