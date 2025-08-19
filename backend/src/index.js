const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const TelegramBot = require('node-telegram-bot-api');
const { TonClient, WalletContractV4, internal } = require('ton');
const { mnemonicToWalletKey } = require('ton-crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// TON Client setup
const tonClient = new TonClient({
  endpoint: process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC'
});

// Check required environment variables
if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN === 'your_bot_token_here') {
  console.error('❌ ERROR: TELEGRAM_BOT_TOKEN environment variable is not set or is using placeholder value!');
  console.error('Please edit the .env file and replace "your_bot_token_here" with your actual bot token.');
  console.error('');
  console.error('To get a bot token:');
  console.error('1. Open Telegram and search for @BotFather');
  console.error('2. Send /newbot command');
  console.error('3. Follow the instructions to create your bot');
  console.error('4. Copy the token provided by BotFather');
  console.error('5. Edit .env file and replace the placeholder');
  console.error('');
  process.exit(1);
}

// Telegram Bot setup
let bot;
try {
  bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
    polling: true,
    // Add error handling for polling
    polling_error_timeout: 10,
    polling_timeout: 10
  });
  
  // Handle bot errors
  bot.on('polling_error', (error) => {
    console.error('🤖 Telegram Bot Polling Error:', error.message);
    if (error.code === 'ETELEGRAM' && error.message.includes('404')) {
      console.error('❌ Bot token is invalid or bot was deleted!');
      console.error('Please check your TELEGRAM_BOT_TOKEN in the .env file');
      console.error('Make sure you copied the entire token from BotFather');
    }
  });
  
  bot.on('error', (error) => {
    console.error('🤖 Telegram Bot Error:', error.message);
  });
  
  console.log('✅ Telegram Bot initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize Telegram Bot:', error.message);
  process.exit(1);
}

// Game state storage (in production, use Redis or database)
const gameStates = new Map();
const userSessions = new Map();

// TON Contract configuration
const CONTRACT_ADDRESS = process.env.TON_CONTRACT_ADDRESS;
const CONTRACT_ABI = require('./contracts/TapEarn.json');

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Get user game state
app.get('/api/user/:userId/state', (req, res) => {
  try {
    const { userId } = req.params;
    const gameState = gameStates.get(userId) || getDefaultGameState();
    
    res.json({
      success: true,
      data: gameState
    });
  } catch (error) {
    console.error('Error getting user state:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Update user game state
app.post('/api/user/:userId/state', (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    const currentState = gameStates.get(userId) || getDefaultGameState();
    const newState = { ...currentState, ...updates, lastUpdated: Date.now() };
    
    gameStates.set(userId, newState);
    
    // Sync with TON blockchain if wallet is connected
    if (updates.walletConnected && updates.walletAddress) {
      syncUserDataToBlockchain(userId, newState);
    }
    
    res.json({
      success: true,
      data: newState
    });
  } catch (error) {
    console.error('Error updating user state:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Process tap action
app.post('/api/user/:userId/tap', (req, res) => {
  try {
    const { userId } = req.params;
    const gameState = gameStates.get(userId) || getDefaultGameState();
    
    if (gameState.energy <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient energy'
      });
    }
    
    // Calculate points earned
    const pointsEarned = gameState.tapPower;
    
    // Update game state
    const updatedState = {
      ...gameState,
      energy: gameState.energy - 1,
      points: gameState.points + pointsEarned,
      totalTaps: gameState.totalTaps + 1,
      totalPointsEarned: gameState.totalPointsEarned + pointsEarned,
      lastActive: Date.now()
    };
    
    gameStates.set(userId, updatedState);
    
    res.json({
      success: true,
      data: {
        pointsEarned,
        newEnergy: updatedState.energy,
        newPoints: updatedState.points
      }
    });
  } catch (error) {
    console.error('Error processing tap:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Complete daily task
app.post('/api/user/:userId/task/:taskId/complete', (req, res) => {
  try {
    const { userId, taskId } = req.params;
    const gameState = gameStates.get(userId) || getDefaultGameState();
    
    const task = gameState.dailyTasks.find(t => t.id === taskId);
    if (!task || task.completed) {
      return res.status(400).json({
        success: false,
        error: 'Task not found or already completed'
      });
    }
    
    // Update task completion
    const updatedTasks = gameState.dailyTasks.map(t =>
      t.id === taskId ? { ...t, completed: true, completedAt: Date.now() } : t
    );
    
    // Update game state
    const updatedState = {
      ...gameState,
      dailyTasks: updatedTasks,
      points: gameState.points + task.points,
      totalPointsEarned: gameState.totalPointsEarned + task.points
    };
    
    gameStates.set(userId, updatedState);
    
    res.json({
      success: true,
      data: {
        pointsEarned: task.points,
        newPoints: updatedState.points
      }
    });
  } catch (error) {
    console.error('Error completing task:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Purchase upgrade
app.post('/api/user/:userId/upgrade/:upgradeId', (req, res) => {
  try {
    const { userId, upgradeId } = req.params;
    const { cost, costType } = req.body;
    
    const gameState = gameStates.get(userId) || getDefaultGameState();
    
    if (costType === 'points' && gameState.points < cost) {
      return res.status(400).json({
        success: false,
        error: 'Insufficient points'
      });
    }
    
    // Apply upgrade effects
    let updatedState = { ...gameState };
    
    if (upgradeId === 'tap_power') {
      updatedState.tapPower = Math.min(gameState.tapPower + 1, 5);
    } else if (upgradeId === 'offline_earning') {
      updatedState.offlineEarningRate = Math.min(gameState.offlineEarningRate + 4, 20);
    } else if (upgradeId === 'energy_regen') {
      updatedState.energyRegenRate = Math.min(gameState.energyRegenRate + 1, 10);
    }
    
    if (costType === 'points') {
      updatedState.points = gameState.points - cost;
    }
    
    gameStates.set(userId, updatedState);
    
    // If using TON, process blockchain transaction
    if (costType === 'ton' && gameState.walletConnected) {
      processUpgradeTransaction(userId, upgradeId, cost);
    }
    
    res.json({
      success: true,
      data: updatedState
    });
  } catch (error) {
    console.error('Error purchasing upgrade:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Register referral
app.post('/api/user/:userId/referral', (req, res) => {
  try {
    const { userId } = req.params;
    const { referrerCode } = req.body;
    
    const gameState = gameStates.get(userId) || getDefaultGameState();
    
    if (gameState.referredBy) {
      return res.status(400).json({
        success: false,
        error: 'User already has a referrer'
      });
    }
    
    // Find referrer by code
    const referrer = findUserByReferralCode(referrerCode);
    if (!referrer) {
      return res.status(400).json({
        success: false,
        error: 'Invalid referral code'
      });
    }
    
    // Update referral relationship
    const updatedState = {
      ...gameState,
      referredBy: referrer.userId
    };
    
    gameStates.set(userId, updatedState);
    
    // Update referrer's stats
    const referrerState = gameStates.get(referrer.userId);
    if (referrerState) {
      referrerState.referralCount += 1;
      gameStates.set(referrer.userId, referrerState);
    }
    
    res.json({
      success: true,
      data: {
        referrerUsername: referrer.username
      }
    });
  } catch (error) {
    console.error('Error registering referral:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Telegram Bot Commands
bot.onText(/\/start(.+)?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const startParam = match[1];
  
  try {
    // Handle referral parameter
    if (startParam && startParam.trim().startsWith('ref_')) {
      const referralCode = startParam.trim().substring(4);
      await handleReferral(userId, referralCode);
    }
    
    // Send welcome message
    const welcomeMessage = `
🎮 Welcome to TapEarn!

Tap to earn points, complete daily tasks, and upgrade your earning potential!

💰 Current Features:
• Tap to earn points
• Daily tasks and bonuses
• Upgrades system
• Referral rewards
• TON blockchain integration

Start tapping to earn your first points! 🚀
    `;
    
    bot.sendMessage(chatId, welcomeMessage);
    
    // Initialize user game state if not exists
    if (!gameStates.has(userId)) {
      gameStates.set(userId, getDefaultGameState());
    }
    
  } catch (error) {
    console.error('Error handling start command:', error);
    bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }
});

bot.onText(/\/balance/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  
  try {
    const gameState = gameStates.get(userId) || getDefaultGameState();
    
    const balanceMessage = `
💰 Your TapEarn Balance:

🪙 Points: ${gameState.points.toLocaleString()}
⚡ Energy: ${gameState.energy}/${gameState.maxEnergy}
🔋 Tap Power: +${gameState.tapPower} per tap
📊 Total Taps: ${gameState.totalTaps.toLocaleString()}
👥 Referrals: ${gameState.referralCount}
    `;
    
    bot.sendMessage(chatId, balanceMessage);
    
  } catch (error) {
    console.error('Error handling balance command:', error);
    bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again.');
  }
});

bot.onText(/\/help/, async (msg) => {
  const chatId = msg.chat.id;
  
  const helpMessage = `
🤖 TapEarn Bot Commands:

/start - Start the game
/balance - Check your balance
/help - Show this help message
/daily - View daily tasks
/upgrades - View available upgrades
/referral - Get your referral link

🎮 How to play:
1. Tap the button to earn points
2. Complete daily tasks for bonuses
3. Upgrade your earning power
4. Invite friends for referral rewards
5. Connect TON wallet for premium features

Need help? Contact @support_username
    `;
    
  bot.sendMessage(chatId, helpMessage);
});

// Helper functions
function getDefaultGameState() {
  return {
    points: 0,
    energy: 1000,
    maxEnergy: 1000,
    energyRegenRate: 3,
    tapPower: 1,
    offlineEarningRate: 4,
    offlineEarningMaxHours: 4,
    totalTaps: 0,
    totalPointsEarned: 0,
    offlineEarnings: 0,
    referralEarnings: 0,
    lastActive: Date.now(),
    dailyTasks: [
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
    ],
    lastDailyReset: Date.now(),
    referralCode: generateReferralCode(),
    referralCount: 0,
    walletConnected: false,
    lastUpdated: Date.now()
  };
}

function generateReferralCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function findUserByReferralCode(code) {
  for (const [userId, gameState] of gameStates) {
    if (gameState.referralCode === code) {
      return { userId, username: `user_${userId}` };
    }
  }
  return null;
}

async function handleReferral(userId, referralCode) {
  try {
    const referrer = findUserByReferralCode(referralCode);
    if (referrer && referrer.userId !== userId) {
      await registerReferral(userId, referrer.userId);
    }
  } catch (error) {
    console.error('Error handling referral:', error);
  }
}

async function registerReferral(userId, referrerId) {
  try {
    const gameState = gameStates.get(userId) || getDefaultGameState();
    const referrerState = gameStates.get(referrerId);
    
    if (referrerState && !gameState.referredBy) {
      gameState.referredBy = referrerId;
      gameStates.set(userId, gameState);
      
      referrerState.referralCount += 1;
      gameStates.set(referrerId, referrerState);
      
      // Send notification to referrer
      bot.sendMessage(referrerId, `🎉 New referral! User @user_${userId} joined using your code!`);
    }
  } catch (error) {
    console.error('Error registering referral:', error);
  }
}

async function syncUserDataToBlockchain(userId, gameState) {
  try {
    // This would integrate with your TON smart contract
    // For now, just log the action
    console.log(`Syncing user ${userId} data to blockchain:`, gameState);
  } catch (error) {
    console.error('Error syncing to blockchain:', error);
  }
}

async function processUpgradeTransaction(userId, upgradeId, cost) {
  try {
    // This would process the TON transaction
    // For now, just log the action
    console.log(`Processing upgrade transaction for user ${userId}: ${upgradeId} at cost ${cost} TON`);
  } catch (error) {
    console.error('Error processing upgrade transaction:', error);
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TapEarn Backend Server running on port ${PORT}`);
  console.log(`🤖 Telegram Bot initialized`);
  console.log(`🔗 TON Client connected to ${process.env.TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  bot.stopPolling();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  bot.stopPolling();
  process.exit(0);
});
