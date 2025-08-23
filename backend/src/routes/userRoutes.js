import express from 'express';
import { 
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
} from '../controllers/userController.js';

const router = express.Router();

// Middleware to extract user ID from URL
const extractUserId = (req, res, next) => {
  // Get user ID from URL query parameters or headers
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) {
    return res.status(400).json({ success: false, error: 'User ID is required' });
  }
  req.userId = userId;
  next();
};

// User routes
router.get('/me', extractUserId, async (req, res) => {
  try {
    const user = await getUser(req.userId);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Initialize or get user
router.get('/init', async (req, res) => {
  try {
    const { userId, ...userData } = req.query;
    if (!userId) {
      return res.status(400).json({ success: false, error: 'User ID is required' });
    }
    
    const user = await getOrCreateUser(userId, userData);
    res.json({ 
      success: true, 
      data: user,
      referralLink: `${process.env.FRONTEND_URL}?start=${user.referralCode}`
    });
  } catch (error) {
    console.error('Error initializing user:', error);
    res.status(500).json({ success: false, error: 'Failed to initialize user' });
  }
});

// Handle tap action
router.post('/tap', extractUserId, async (req, res) => {
  try {
    const result = await handleTap(req.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update user data
router.patch('/update', extractUserId, async (req, res) => {
  try {
    const user = await updateUser(req.userId, req.body);
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get user game state
router.get('/game-state', extractUserId, async (req, res) => {
  try {
    const gameState = await getUserGameState(req.userId);
    res.json({ success: true, data: gameState });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Update user game state
router.post('/game-state', extractUserId, async (req, res) => {
  try {
    const result = await updateUserGameState(req.userId, req.body);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Complete daily task
router.post('/complete-task', extractUserId, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (!taskId) {
      return res.status(400).json({ success: false, error: 'Task ID is required' });
    }
    
    const result = await completeDailyTask(req.userId, taskId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Purchase upgrade
router.post('/purchase-upgrade', extractUserId, async (req, res) => {
  try {
    const { upgradeId, cost } = req.body;
    if (!upgradeId || cost === undefined) {
      return res.status(400).json({ success: false, error: 'Upgrade ID and cost are required' });
    }
    
    const result = await purchaseUpgrade(req.userId, upgradeId, cost);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get available upgrades
router.get('/upgrades', extractUserId, async (req, res) => {
  try {
    const upgrades = await getAvailableUpgrades(req.userId);
    res.json({ success: true, data: upgrades });
  } catch (error) {
    res.status(404).json({ success: false, error: error.message });
  }
});

// Reset daily tasks
router.post('/reset-daily-tasks', extractUserId, async (req, res) => {
  try {
    const result = await resetDailyTasks(req.userId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const leaderboard = await getLeaderboard(limit);
    res.json({ success: true, data: leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch leaderboard' });
  }
});

export default router;
